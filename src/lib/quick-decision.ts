import type {
  DataConfidence,
  QuickDecisionSummary,
  StrategyApplicabilityStatus,
  StrategyId,
} from "@/types/listing";
import type { InvestmentWorkspace } from "./investment-workspace";
import { STRATEGY_META } from "./strategy-applicability";

const VIABLE_STATUSES = new Set<StrategyApplicabilityStatus>(["applicable", "potentially_applicable"]);
const STATUS_RANK: Record<StrategyApplicabilityStatus, number> = {
  applicable: 0,
  potentially_applicable: 1,
  needs_more_data: 2,
  not_applicable: 3,
};

type ScenarioCandidate = {
  scenarioId: StrategyId;
  status: StrategyApplicabilityStatus;
  reason: string;
  model: InvestmentWorkspace["scenarioModels"][StrategyId];
};

export function summarizeInvestmentWorkspace(
  workspace: InvestmentWorkspace,
  dataConfidence: DataConfidence
): QuickDecisionSummary {
  const primaryScenario = pickPrimaryScenario(workspace);
  const scoringScenario = primaryScenario ?? pickFallbackScenario(workspace);
  const baseHoldScenario = pickBaseHoldScenario(workspace);

  const carryScore = scoringScenario ? computeCarryScore(scoringScenario.model) : 0;
  const executionScore = scoringScenario ? computeExecutionScore(scoringScenario) : 0;
  const upsideScore = scoringScenario ? computeUpsideScore(scoringScenario) : 0;
  const confidenceScore = computeConfidenceScore(dataConfidence, workspace.input.profile.hasInferredFields);
  const combinedScore = round1(
    carryScore * 0.45 + executionScore * 0.25 + upsideScore * 0.2 + confidenceScore * 0.1
  );

  return {
    primaryScenarioId: primaryScenario?.scenarioId ?? null,
    primaryScenarioStatus: primaryScenario?.status ?? null,
    primaryBridgeUsage: primaryScenario?.model.bridgeUsage ?? null,
    primaryAnnualCashflow: primaryScenario ? round2(primaryScenario.model.result.annualCashflow) : null,
    primaryMonthlyCashflow: primaryScenario ? round2(primaryScenario.model.result.monthlyCashflow) : null,
    primaryDscr: primaryScenario ? round2(primaryScenario.model.result.dscr) : null,
    primaryCashOnCashReturn: primaryScenario?.model.result.cashOnCashReturn != null ? round2(primaryScenario.model.result.cashOnCashReturn) : null,
    baseHoldScenarioId: baseHoldScenario?.scenarioId ?? null,
    baseHoldAnnualCashflow: baseHoldScenario ? round2(baseHoldScenario.model.result.annualCashflow) : null,
    baseHoldMonthlyCashflow: baseHoldScenario ? round2(baseHoldScenario.model.result.monthlyCashflow) : null,
    quickVerdict: buildQuickVerdict(primaryScenario, pickFallbackScenario(workspace)),
    carryScore,
    executionScore,
    upsideScore,
    confidenceScore,
    combinedScore,
  };
}

export function deriveQuickDecisionConstraint(summary: QuickDecisionSummary): {
  label: string;
  value: number | string;
  tone: "emerald" | "amber" | "rose" | "slate";
} | null {
  if (!summary.primaryScenarioId || !summary.primaryScenarioStatus) {
    return null;
  }

  if (summary.primaryBridgeUsage === "common" || summary.primaryBridgeUsage === "core") {
    return {
      label: "Bridge required",
      value: STRATEGY_META[summary.primaryScenarioId].name,
      tone: "amber",
    };
  }

  if (summary.primaryMonthlyCashflow != null && summary.primaryMonthlyCashflow < 0) {
    return {
      label: "Cashflow gap to break-even",
      value: round2(Math.abs(summary.primaryMonthlyCashflow)),
      tone: "rose",
    };
  }

  if (summary.primaryDscr != null && summary.primaryDscr < 1.2) {
    return {
      label: "DSCR gap to 1.20",
      value: round2(1.2 - summary.primaryDscr),
      tone: "amber",
    };
  }

  return {
    label: "Current screen",
    value: "Meets base carry test",
    tone: "emerald",
  };
}

function pickPrimaryScenario(workspace: InvestmentWorkspace): ScenarioCandidate | null {
  const candidates = collectCandidates(workspace).filter((candidate) => VIABLE_STATUSES.has(candidate.status));
  if (candidates.length === 0) return null;
  candidates.sort(compareByCashflow);
  return candidates[0] ?? null;
}

function pickFallbackScenario(workspace: InvestmentWorkspace): ScenarioCandidate | null {
  const candidates = collectCandidates(workspace);
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    const statusDiff = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (statusDiff !== 0) return statusDiff;
    return compareByCashflow(a, b);
  });
  return candidates[0] ?? null;
}

function pickBaseHoldScenario(workspace: InvestmentWorkspace): ScenarioCandidate | null {
  const profile = workspace.input.profile;
  if (profile.normalizedAssetType === "land" || profile.normalizedAssetType === "parking") {
    return null;
  }

  let candidateIds: StrategyId[];
  if (profile.normalizedUnits >= 5) {
    candidateIds = ["conventional_multifamily_hold", "cmhc_standard_rental_existing"];
  } else if (workspace.input.investorContext.willLiveThere) {
    candidateIds = [
      "conventional_owner_occupied",
      "cmhc_homeowner",
      "cmhc_home_start",
      "conventional_investor_small_bay",
    ];
  } else {
    candidateIds = ["conventional_investor_small_bay", "cmhc_income_property"];
  }

  for (const scenarioId of candidateIds) {
    const result = workspace.scenarioResults.find((item) => item.scenarioId === scenarioId);
    if (!result || !VIABLE_STATUSES.has(result.status)) continue;
    const model = workspace.scenarioModels[scenarioId];
    if (!model) continue;
    return {
      scenarioId,
      status: result.status,
      reason: result.reason,
      model,
    };
  }

  return null;
}

function collectCandidates(workspace: InvestmentWorkspace): ScenarioCandidate[] {
  return workspace.scenarioResults
    .map((result) => {
      const model = workspace.scenarioModels[result.scenarioId];
      if (!model) return null;
      return {
        scenarioId: result.scenarioId,
        status: result.status,
        reason: result.reason,
        model,
      } satisfies ScenarioCandidate;
    })
    .filter((candidate): candidate is ScenarioCandidate => candidate != null);
}

function compareByCashflow(a: ScenarioCandidate, b: ScenarioCandidate): number {
  const annualCashflowDiff = b.model.result.annualCashflow - a.model.result.annualCashflow;
  if (Math.abs(annualCashflowDiff) > 0.005) return annualCashflowDiff;

  const dscrDiff = b.model.result.dscr - a.model.result.dscr;
  if (Math.abs(dscrDiff) > 0.0001) return dscrDiff;

  return STATUS_RANK[a.status] - STATUS_RANK[b.status];
}

function computeCarryScore(model: ScenarioCandidate["model"]): number {
  const unitCount = Math.max(1, model.modeledUnits.value || 1);
  const monthlyCashflowPerUnit = model.result.monthlyCashflow / unitCount;
  const dscrScore = normalize(model.result.dscr, 0.85, 1.3);
  const monthlyCashflowScore = normalize(monthlyCashflowPerUnit, -250, 250);
  return round1(dscrScore * 0.65 + monthlyCashflowScore * 0.35);
}

function computeExecutionScore(candidate: ScenarioCandidate): number {
  const bridgePenalty = {
    not_needed: 0,
    optional: 10,
    common: 25,
    core: 40,
  }[candidate.model.bridgeUsage];
  const statusPenalty = {
    applicable: 0,
    potentially_applicable: 15,
    needs_more_data: 35,
    not_applicable: 60,
  }[candidate.status];
  const stagePenalty = candidate.model.stage === "new_construction" ? 15 : 0;
  return round1(clamp(100 - bridgePenalty - statusPenalty - stagePenalty, 0, 100));
}

function computeUpsideScore(candidate: ScenarioCandidate): number {
  const holdRoiScore = normalize(candidate.model.returnBridge.holdPeriodRoiPct ?? 0, 0, 35);
  if (!candidate.model.requiresBridgeLoan || !candidate.model.bridgeFacility) {
    return round1(holdRoiScore);
  }

  const refiRatioPct = (candidate.model.bridgeFacility.refiSurplusShortfall / Math.max(1, candidate.model.result.totalCost)) * 100;
  const refiScore = normalize(refiRatioPct, -10, 10);
  return round1(holdRoiScore * 0.6 + refiScore * 0.4);
}

function computeConfidenceScore(dataConfidence: DataConfidence, hasInferredFields: boolean): number {
  const base =
    dataConfidence === "high" ? 90 : dataConfidence === "medium" ? 70 : 45;
  return round1(clamp(base - (hasInferredFields ? 10 : 0), 0, 100));
}

function buildQuickVerdict(
  primaryScenario: ScenarioCandidate | null,
  fallbackScenario: ScenarioCandidate | null
): string {
  if (!primaryScenario) {
    return fallbackScenario
      ? `No viable path yet. ${fallbackScenario.reason}`
      : "No viable path yet.";
  }

  if (primaryScenario.model.result.monthlyCashflow < 0) {
    return "Negative carry even in the best viable path.";
  }

  if (primaryScenario.model.bridgeUsage === "common" || primaryScenario.model.bridgeUsage === "core") {
    return "Works only with bridge financing before takeout.";
  }

  if (primaryScenario.status === "potentially_applicable") {
    return `Potentially viable once the current missing inputs are confirmed.`;
  }

  if (primaryScenario.model.bridgeUsage === "not_needed") {
    return "Bridge-free hold is viable.";
  }

  return "Best viable path is currently financeable.";
}

function normalize(value: number, floor: number, ceiling: number): number {
  if (ceiling <= floor) return 0;
  return clamp(((value - floor) / (ceiling - floor)) * 100, 0, 100);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
