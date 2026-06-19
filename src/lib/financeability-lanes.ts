import type { InvestmentWorkspace } from "./investment-workspace";
import type { FinancingScenarioApplicabilityResult, StrategyId } from "@/types/listing";

export type FinanceabilityLaneStatus = "eligible" | "verify" | "blocked";
export type FinanceabilityLaneVerdict = "recommended" | "candidate" | "manual_verification" | "blocked";

export type FinanceabilityLaneId =
  | "owner_occupied_conventional_1_4"
  | "owner_occupied_cmhc_1_4"
  | "conventional_investor_1_4"
  | "cmhc_income_property_2_4"
  | "personal_plex_exception_5_8"
  | "conventional_multifamily_5_plus"
  | "cmhc_standard_rental_5_plus"
  | "mli_select_5_plus"
  | "commercial_cmhc_style_9_plus";

export interface FinanceabilityTopMetrics {
  purchasePrice: number;
  units: number;
  modeledNoi: number | null;
  annualDebtService: number | null;
  dscr: number | null;
  ltvPct: number | null;
  annualCashflow: number | null;
  cashOnCashReturnPct: number | null;
}

export interface FinanceabilityManualVerificationItem {
  id: string;
  label: string;
  severity: "required" | "recommended";
  appliesTo: FinanceabilityLaneId[];
  reason: string;
}

export interface FinanceabilityPolicyWarning {
  id: string;
  title: string;
  severity: "info" | "warning" | "critical";
  body: string;
  appliesTo: FinanceabilityLaneId[];
}

export interface FinanceabilityLaneSummaryItem {
  id: FinanceabilityLaneId;
  label: string;
  status: FinanceabilityLaneStatus;
  verdict: FinanceabilityLaneVerdict;
  strategyIds: StrategyId[];
  reason: string;
  missingInputs: string[];
  topMetrics: FinanceabilityTopMetrics | null;
  policyWarnings: FinanceabilityPolicyWarning[];
  manualVerificationItems: FinanceabilityManualVerificationItem[];
}

export interface FinanceabilityLaneSummary {
  unitBand: "one_to_four" | "five_to_eight" | "nine_plus" | "unknown";
  recommendedLane: FinanceabilityLaneSummaryItem | null;
  eligibleLanes: FinanceabilityLaneSummaryItem[];
  blockedLanes: FinanceabilityLaneSummaryItem[];
  manualVerificationItems: FinanceabilityManualVerificationItem[];
  topMetrics: FinanceabilityTopMetrics | null;
  policyWarnings: FinanceabilityPolicyWarning[];
  lanes: FinanceabilityLaneSummaryItem[];
}

interface LaneDefinition {
  id: FinanceabilityLaneId;
  label: string;
  strategyIds: StrategyId[];
  unitBands: FinanceabilityLaneSummary["unitBand"][];
  verificationRequired?: boolean;
  reasonWhenUnavailable: string;
}

const LANE_DEFINITIONS: LaneDefinition[] = [
  {
    id: "owner_occupied_conventional_1_4",
    label: "1-4 owner-occupied conventional",
    strategyIds: ["conventional_owner_occupied"],
    unitBands: ["one_to_four"],
    reasonWhenUnavailable: "Owner-occupied conventional financing is a 1-4 unit homeowner lane.",
  },
  {
    id: "owner_occupied_cmhc_1_4",
    label: "1-4 owner-occupied CMHC",
    strategyIds: ["cmhc_homeowner", "cmhc_home_start", "cmhc_improvement_owner_occupied"],
    unitBands: ["one_to_four"],
    reasonWhenUnavailable: "Owner-occupied CMHC homeowner paths are limited to eligible 1-4 unit assets.",
  },
  {
    id: "conventional_investor_1_4",
    label: "1-4 conventional rental",
    strategyIds: ["conventional_investor_small_bay"],
    unitBands: ["one_to_four"],
    reasonWhenUnavailable: "Conventional small-rental financing is a 1-4 unit rental lane.",
  },
  {
    id: "cmhc_income_property_2_4",
    label: "2-4 CMHC Income Property",
    strategyIds: ["cmhc_income_property", "cmhc_improvement_small_rental"],
    unitBands: ["one_to_four"],
    reasonWhenUnavailable: "CMHC Income Property is a non-owner-occupied 2-4 unit rental lane.",
  },
  {
    id: "personal_plex_exception_5_8",
    label: "5-8 personal plex exception",
    strategyIds: ["personal_plex_lender_exception"],
    unitBands: ["five_to_eight"],
    verificationRequired: true,
    reasonWhenUnavailable: "The personal plex exception is only a 5-8 unit existing-plex screen.",
  },
  {
    id: "conventional_multifamily_5_plus",
    label: "5+ conventional multifamily",
    strategyIds: ["conventional_multifamily_hold", "bridge_conventional_multifamily"],
    unitBands: ["five_to_eight", "nine_plus"],
    reasonWhenUnavailable: "Conventional multifamily financing is a 5+ unit lane.",
  },
  {
    id: "cmhc_standard_rental_5_plus",
    label: "5+ CMHC Standard Rental",
    strategyIds: ["cmhc_standard_rental_existing", "bridge_standard_rental_takeout"],
    unitBands: ["five_to_eight", "nine_plus"],
    verificationRequired: true,
    reasonWhenUnavailable: "CMHC Standard Rental is a 5+ unit rental lane subject to program fit.",
  },
  {
    id: "mli_select_5_plus",
    label: "5+ MLI Select",
    strategyIds: ["mli_select_existing", "bridge_mli_select_takeout"],
    unitBands: ["five_to_eight", "nine_plus"],
    verificationRequired: true,
    reasonWhenUnavailable: "MLI Select is a 5+ unit CMHC-style lane that needs a documented scorecard.",
  },
  {
    id: "commercial_cmhc_style_9_plus",
    label: "9+ commercial / CMHC-style",
    strategyIds: ["conventional_multifamily_hold", "cmhc_standard_rental_existing", "mli_select_existing"],
    unitBands: ["nine_plus"],
    verificationRequired: true,
    reasonWhenUnavailable: "9+ unit buildings should be screened through commercial, CMHC Standard Rental, or MLI Select style underwriting.",
  },
];

const STATUS_RANK: Record<FinanceabilityLaneStatus, number> = {
  eligible: 0,
  verify: 1,
  blocked: 2,
};

export function buildFinanceabilityLaneSummary(workspace: InvestmentWorkspace): FinanceabilityLaneSummary {
  const unitBand = resolveUnitBand(workspace.input.profile.normalizedUnits);
  const scenarioById = new Map(workspace.scenarioResults.map((result) => [result.scenarioId, result]));
  const lanes = LANE_DEFINITIONS.map((definition) => buildLane(definition, workspace, scenarioById, unitBand));
  const sortedCandidateLanes = lanes
    .filter((lane) => lane.status !== "blocked")
    .sort((a, b) => lanePriority(a, unitBand) - lanePriority(b, unitBand) || STATUS_RANK[a.status] - STATUS_RANK[b.status]);
  const recommendedLane = sortedCandidateLanes[0] ? markRecommended(sortedCandidateLanes[0]) : null;
  const finalizedLanes = lanes.map((lane) => (recommendedLane?.id === lane.id ? recommendedLane : lane));
  const manualVerificationItems = uniqueById(finalizedLanes.flatMap((lane) => lane.manualVerificationItems));
  const policyWarnings = uniqueById(finalizedLanes.flatMap((lane) => lane.policyWarnings));

  return {
    unitBand,
    recommendedLane,
    eligibleLanes: finalizedLanes.filter((lane) => lane.status !== "blocked"),
    blockedLanes: finalizedLanes.filter((lane) => lane.status === "blocked"),
    manualVerificationItems,
    topMetrics: recommendedLane?.topMetrics ?? null,
    policyWarnings,
    lanes: finalizedLanes,
  };
}

function buildLane(
  definition: LaneDefinition,
  workspace: InvestmentWorkspace,
  scenarioById: Map<StrategyId, FinancingScenarioApplicabilityResult>,
  unitBand: FinanceabilityLaneSummary["unitBand"]
): FinanceabilityLaneSummaryItem {
  const scenarioResults = definition.strategyIds
    .map((strategyId) => scenarioById.get(strategyId))
    .filter((result): result is FinancingScenarioApplicabilityResult => Boolean(result));
  const bestScenario = scenarioResults.sort((a, b) => applicabilityRank(a.status) - applicabilityRank(b.status))[0];
  const inBand = definition.unitBands.includes(unitBand);
  const available = inBand && bestScenario && bestScenario.status !== "not_applicable";
  const needsVerification =
    definition.verificationRequired ||
    bestScenario?.status === "potentially_applicable" ||
    bestScenario?.status === "needs_more_data" ||
    Boolean(bestScenario?.missingInputs.length);
  const status: FinanceabilityLaneStatus = !available ? "blocked" : needsVerification ? "verify" : "eligible";
  const manualVerificationItems = buildManualVerificationItems(definition, bestScenario, workspace);
  const policyWarnings = buildPolicyWarnings(definition, workspace);

  return {
    id: definition.id,
    label: definition.label,
    status,
    verdict: status === "blocked" ? "blocked" : status === "verify" ? "manual_verification" : "candidate",
    strategyIds: definition.strategyIds,
    reason: available ? bestScenario.reason : bestScenario?.reason ?? definition.reasonWhenUnavailable,
    missingInputs: uniqueStrings(scenarioResults.flatMap((result) => result.missingInputs)),
    topMetrics: bestScenario ? topMetricsForStrategy(workspace, bestScenario.scenarioId) : null,
    policyWarnings,
    manualVerificationItems,
  };
}

function markRecommended(lane: FinanceabilityLaneSummaryItem): FinanceabilityLaneSummaryItem {
  return {
    ...lane,
    verdict: "recommended",
  };
}

function buildManualVerificationItems(
  definition: LaneDefinition,
  bestScenario: FinancingScenarioApplicabilityResult | undefined,
  workspace: InvestmentWorkspace
): FinanceabilityManualVerificationItem[] {
  const items: FinanceabilityManualVerificationItem[] = [];

  if (definition.id === "personal_plex_exception_5_8") {
    items.push({
      id: "written_personal_lender_exception",
      label: "Written lender/broker confirmation for 5-8 personal treatment",
      severity: "required",
      appliesTo: [definition.id],
      reason:
        "The 5-8 unit personal plex lane is an exception screen, not a guaranteed program. Confirm unit-count treatment, rental-income inclusion, borrower/title structure, amortization, reporting, and release conditions in writing before relying on it.",
    });
  }

  if (definition.id === "cmhc_standard_rental_5_plus" || definition.id === "commercial_cmhc_style_9_plus") {
    items.push({
      id: "cmhc_multifamily_program_fit",
      label: "Confirm CMHC/commercial multifamily program fit",
      severity: "recommended",
      appliesTo: [definition.id],
      reason: "Validate residential share, stabilized operating quality, DSCR, LTV, amortization, timing, and lender/insurer interpretation.",
    });
  }

  if (definition.id === "mli_select_5_plus") {
    items.push({
      id: "mli_select_scorecard",
      label: "Document MLI Select scorecard",
      severity: "required",
      appliesTo: [definition.id],
      reason: "MLI Select leverage and amortization depend on a real affordability, energy, or accessibility score, not just unit count.",
    });
  }

  if (workspace.input.profile.residentialUseCategory === "mixed_use" && workspace.input.investorContext.residentialSharePct == null) {
    items.push({
      id: "residential_share",
      label: "Verify residential share",
      severity: "required",
      appliesTo: [definition.id],
      reason: "Mixed-use files need a documented residential share before CMHC-style multifamily paths can be trusted.",
    });
  }

  for (const input of bestScenario?.missingInputs ?? []) {
    items.push({
      id: `missing_${input.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`,
      label: `Verify ${input}`,
      severity: "required",
      appliesTo: [definition.id],
      reason: `The underlying strategy result marked "${input}" as missing or unresolved.`,
    });
  }

  return uniqueById(items);
}

function buildPolicyWarnings(
  definition: LaneDefinition,
  workspace: InvestmentWorkspace
): FinanceabilityPolicyWarning[] {
  const warnings: FinanceabilityPolicyWarning[] = [];

  if (definition.id === "personal_plex_exception_5_8") {
    warnings.push({
      id: "personal_exception_not_guaranteed",
      title: "5-8 personal exception requires written confirmation",
      severity: "critical",
      appliesTo: [definition.id],
      body:
        "Do not present the 5-8 personal plex lane as guaranteed. Public lender pages do not establish a universal rule; require written lender or broker confirmation before offer removal.",
    });
  }

  if (definition.id === "commercial_cmhc_style_9_plus") {
    warnings.push({
      id: "nine_plus_commercial_boundary",
      title: "9+ units should not default to the personal exception",
      severity: "warning",
      appliesTo: [definition.id],
      body: "Use commercial, conventional multifamily, CMHC Standard Rental, or MLI Select style underwriting for 9+ unit buildings.",
    });
  }

  if (
    workspace.input.profile.residentialUseCategory === "mixed_use" &&
    (definition.id === "cmhc_standard_rental_5_plus" ||
      definition.id === "mli_select_5_plus" ||
      definition.id === "commercial_cmhc_style_9_plus")
  ) {
    warnings.push({
      id: "mixed_use_residential_share",
      title: "Mixed-use share can block CMHC-style lanes",
      severity: "warning",
      appliesTo: [definition.id],
      body: "Mixed-use files need a documented residential share before CMHC-style multifamily eligibility is reliable.",
    });
  }

  return warnings;
}

function topMetricsForStrategy(workspace: InvestmentWorkspace, strategyId: StrategyId): FinanceabilityTopMetrics | null {
  const model = workspace.scenarioModels[strategyId];
  if (!model) return null;

  return {
    purchasePrice: workspace.input.price,
    units: model.modeledUnits.value,
    modeledNoi: finiteOrNull(model.result.noi),
    annualDebtService: finiteOrNull(model.result.annualDebtService),
    dscr: finiteOrNull(model.result.dscr),
    ltvPct: finiteOrNull(model.assumptions.ltvPct.value),
    annualCashflow: finiteOrNull(model.result.annualCashflow),
    cashOnCashReturnPct: finiteOrNull(model.result.cashOnCashReturn),
  };
}

function resolveUnitBand(units: number | null | undefined): FinanceabilityLaneSummary["unitBand"] {
  if (units == null || units <= 0) return "unknown";
  if (units <= 4) return "one_to_four";
  if (units <= 8) return "five_to_eight";
  return "nine_plus";
}

function applicabilityRank(status: FinancingScenarioApplicabilityResult["status"]): number {
  if (status === "applicable") return 0;
  if (status === "potentially_applicable") return 1;
  if (status === "needs_more_data") return 2;
  return 3;
}

function lanePriority(lane: FinanceabilityLaneSummaryItem, unitBand: FinanceabilityLaneSummary["unitBand"]): number {
  if (unitBand === "five_to_eight" && lane.id === "personal_plex_exception_5_8") return 0;
  if (unitBand === "nine_plus" && lane.id === "commercial_cmhc_style_9_plus") return 0;
  return LANE_DEFINITIONS.findIndex((definition) => definition.id === lane.id) + 1;
}

function finiteOrNull(value: number | null): number | null {
  return value != null && Number.isFinite(value) ? value : null;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function uniqueById<T extends { id: string }>(values: T[]): T[] {
  const byId = new Map<string, T>();
  for (const value of values) {
    if (!byId.has(value.id)) byId.set(value.id, value);
  }
  return Array.from(byId.values());
}
