import type {
  BusinessPlanApplicabilityResult,
  InvestorContext,
  OperatingExpenseTemplate,
  StrategyId,
  UnitRentBenchmark,
  ScenarioAssumptions,
} from "@/types/listing";
import type { NormalizedProfileResult } from "./normalized-profile";
import {
  BUSINESS_PLAN_META,
  BUSINESS_PLAN_ORDER,
  getBusinessPlanApplicability,
  getScenarioApplicability,
  SCENARIO_ORDER,
  STRATEGY_META,
  type BusinessPlanMeta,
  type StrategyMeta,
} from "./strategy-applicability";
import { buildStrategyModels, type StrategyModel } from "./strategy-modeling";

export interface InvestmentWorkspaceInput {
  price: number;
  squareFeet: number | null;
  lotSizeSqFt: number | null;
  descriptionText: string | null;
  defaultAssumptions: ScenarioAssumptions;
  profile: NormalizedProfileResult;
  unitRentBenchmarks: UnitRentBenchmark[];
  marketCity: string | null;
  province: string | null;
  investorContext: InvestorContext;
  operatingExpenseTemplate?: OperatingExpenseTemplate | null;
}

export interface InvestmentWorkspace {
  input: InvestmentWorkspaceInput;
  businessPlanMeta: Record<string, BusinessPlanMeta>;
  scenarioMeta: Record<StrategyId, StrategyMeta>;
  businessPlanResults: BusinessPlanApplicabilityResult[];
  scenarioResults: ReturnType<typeof getScenarioApplicability>;
  scenarioModels: Record<StrategyId, StrategyModel>;
}

const STATUS_RANK = {
  applicable: 0,
  potentially_applicable: 1,
  needs_more_data: 2,
  not_applicable: 3,
} as const;

export function buildInvestmentWorkspace(input: InvestmentWorkspaceInput): InvestmentWorkspace {
  const scenarioModels = buildStrategyModels(input);
  const scenarioResults = getScenarioApplicability(input.profile, input.investorContext, scenarioModels);
  const businessPlanResults = getBusinessPlanApplicability(scenarioResults).sort(
    (a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]
  );

  return {
    input,
    businessPlanMeta: BUSINESS_PLAN_META,
    scenarioMeta: STRATEGY_META,
    businessPlanResults,
    scenarioResults,
    scenarioModels,
  };
}

export function scenariosForBusinessPlan(
  workspace: InvestmentWorkspace,
  businessPlanId: BusinessPlanApplicabilityResult["businessPlanId"]
) {
  return workspace.scenarioResults
    .filter((result) => result.businessPlanId === businessPlanId)
    .sort((a, b) => {
      const statusDiff = STATUS_RANK[a.status] - STATUS_RANK[b.status];
      if (statusDiff !== 0) return statusDiff;
      return SCENARIO_ORDER.indexOf(a.scenarioId) - SCENARIO_ORDER.indexOf(b.scenarioId);
    });
}

export function selectDefaultBusinessPlan(workspace: InvestmentWorkspace) {
  const preferred =
    workspace.businessPlanResults.find((result) => result.status === "applicable") ??
    workspace.businessPlanResults.find((result) => result.status === "potentially_applicable") ??
    workspace.businessPlanResults.find((result) => result.status === "needs_more_data") ??
    workspace.businessPlanResults[0];

  return preferred?.businessPlanId ?? BUSINESS_PLAN_ORDER[0];
}

export function selectDefaultScenario(
  workspace: InvestmentWorkspace,
  businessPlanId: BusinessPlanApplicabilityResult["businessPlanId"]
) {
  const scenarios = scenariosForBusinessPlan(workspace, businessPlanId);
  const preferred =
    scenarios.find((result) => result.status === "applicable") ??
    scenarios.find((result) => result.status === "potentially_applicable") ??
    scenarios.find((result) => result.status === "needs_more_data") ??
    scenarios[0];

  return preferred?.scenarioId ?? SCENARIO_ORDER[0];
}
