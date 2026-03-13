/**
 * Domain types for listing detail, provenance, and assumptions.
 */

export type FieldProvenance = "source" | "inferred" | "internally_reviewed" | "internal_override";

export type AssumptionSource =
  | "actual"
  | "market_benchmark"
  | "official_rate"
  | "assumed"
  | "description_inferred"
  | "profile_default"
  | "asset_baseline"
  | "user_override";

export type DataConfidence = "high" | "medium" | "low";

export type NormalizedAssetType =
  | "apartment"
  | "single_family"
  | "duplex"
  | "triplex"
  | "fourplex"
  | "townhouse"
  | "condo"
  | "mixed_use"
  | "land"
  | "parking";

export type NormalizedAssetSubtype =
  | "parking_space"
  | "parking_lot"
  | "vacant_land"
  | "covered_land"
  | "unknown";

export type AssetClassificationProvenance =
  | "source"
  | "description_inferred"
  | "structural_inferred"
  | "mixed_signal";

export type BusinessPlanId =
  | "live_in_homeowner"
  | "small_bay_hold"
  | "small_bay_value_add_refi"
  | "multifamily_hold"
  | "multifamily_value_add_refi"
  | "rental_development"
  | "land_bank_covered_land";

export type FinancingScenarioId =
  | "conventional_owner_occupied"
  | "cmhc_homeowner"
  | "cmhc_home_start"
  | "cmhc_improvement_owner_occupied"
  | "conventional_investor_small_bay"
  | "cmhc_income_property"
  | "cmhc_improvement_small_rental"
  | "bridge_conventional_small_bay_refi"
  | "bridge_cmhc_income_property_takeout"
  | "owner_occupied_improvement_refi"
  | "conventional_multifamily_hold"
  | "cmhc_standard_rental_existing"
  | "mli_select_existing"
  | "bridge_conventional_multifamily"
  | "bridge_standard_rental_takeout"
  | "bridge_mli_select_takeout"
  | "conventional_construction_takeout"
  | "cmhc_standard_rental_new_construction"
  | "mli_select_new_construction"
  | "aclp_construction_stabilization"
  | "conventional_land_bridge_hold";

export type StrategyId = FinancingScenarioId;

export type DealStage = "existing" | "new_construction";
export type ProjectUse = "standard_rental" | "student" | "seniors" | "supportive_sro";
export type BridgeUsage = "not_needed" | "optional" | "common" | "core";

export interface InvestorContext {
  firstPropertyBuyer: boolean;
  willLiveThere: boolean;
  preferredAssetBand: "one_to_four_units" | "five_plus_units" | "flexible";
  dealStage: DealStage;
  plansRenovations: boolean;
  projectUse: ProjectUse;
  residentialSharePct: number | null;
  mliAffordabilityCommitmentYears: number;
  mliEnergyPoints: 0 | 20 | 35 | 50;
  mliAccessibilityPoints: 0 | 20 | 30;
}

export type StrategyApplicabilityStatus =
  | "applicable"
  | "potentially_applicable"
  | "not_applicable"
  | "needs_more_data";

export interface BusinessPlanApplicabilityResult {
  businessPlanId: BusinessPlanId;
  status: StrategyApplicabilityStatus;
  reason: string;
  confidence: DataConfidence;
  scenarioIds: FinancingScenarioId[];
}

export interface FinancingScenarioApplicabilityResult {
  scenarioId: FinancingScenarioId;
  businessPlanId: BusinessPlanId;
  status: StrategyApplicabilityStatus;
  reason: string;
  confidence: DataConfidence;
  maxLeveragePct: number | null;
  leverageMetric: "LTV" | "LTC";
  maxAmortizationYears: number | null;
  bridgeUsage: BridgeUsage;
  missingInputs: string[];
}

export type StrategyApplicabilityResult = FinancingScenarioApplicabilityResult;

export interface QuickDecisionSummary {
  primaryScenarioId: StrategyId | null;
  primaryScenarioStatus: StrategyApplicabilityStatus | null;
  primaryBridgeUsage: BridgeUsage | null;
  primaryAnnualCashflow: number | null;
  primaryMonthlyCashflow: number | null;
  primaryDscr: number | null;
  primaryCashOnCashReturn: number | null;
  baseHoldScenarioId: StrategyId | null;
  baseHoldAnnualCashflow: number | null;
  baseHoldMonthlyCashflow: number | null;
  quickVerdict: string;
  carryScore: number;
  executionScore: number;
  upsideScore: number;
  confidenceScore: number;
  combinedScore: number;
}

export interface ProvenanceCounts {
  source: number;
  inferred: number;
  marketBenchmark: number;
  assumed: number;
  userOverride: number;
}

export interface MarketBenchmarkProfile {
  mappedMarketCity: string | null;
  mappedZone: string | null;
  zoneMatchMethod: string | null;
  benchmarkVacancyRate: number | null;
  benchmarkVacancyProvenance: AssumptionSource;
  benchmarkVacancyLabel: string;
  benchmarkCurrentRent: number | null;
  benchmarkCurrentRentProvenance: AssumptionSource;
  benchmarkCurrentRentLabel: string;
  benchmarkTurnoverRent: number | null;
  benchmarkTurnoverRentProvenance: AssumptionSource;
  benchmarkTurnoverRentLabel: string;
  benchmarkRenovatedRentProxy: number | null;
  benchmarkRenovatedRentProvenance: AssumptionSource;
  benchmarkRenovatedRentLabel: string;
  benchmarkRentGrowthRateAnnual: number | null;
  benchmarkRentGrowthProvenance: AssumptionSource;
  benchmarkRentGrowthLabel: string;
  benchmarkAssetClass: string;
  benchmarkBedroomBasis: string | null;
  benchmarkStructureSizeBasis: string | null;
  benchmarkYearBuiltBasis: string | null;
  benchmarkSourceYear: number | null;
  benchmarkConfidence: DataConfidence;
  unitRentBenchmarks: UnitRentBenchmark[];
}

export interface AssumptionValue<T = number> {
  value: T;
  source: AssumptionSource;
  label: string;
  userOverrideAt?: string | null;
}

export interface UnitRentBenchmark {
  unitNumber: number;
  unitLabel: string;
  bedrooms: number;
  bedroomLabel: string;
  currentMarketRent: AssumptionValue<number>;
  turnoverMarketRent: AssumptionValue<number>;
  renovatedRentProxy: AssumptionValue<number>;
  modeledMarketRent: AssumptionValue<number>;
}

export interface StrategyUnitRentLineItem {
  unitNumber: number;
  unitLabel: string;
  bedrooms: number;
  bedroomLabel: string;
  currentMarketRent: AssumptionValue<number>;
  turnoverMarketRent: AssumptionValue<number>;
  renovatedRentProxy: AssumptionValue<number>;
  modeledRent: AssumptionValue<number>;
}

export type OperatingExpenseBasis = "effective_gross_income" | "purchase_price" | "fixed_annual";
export type OperatingExpenseTemplateBasis =
  | "percent_of_egi"
  | "annual_total"
  | "annual_per_unit"
  | "annual_per_sqft";
export type PropertyTaxMethod =
  | "exact_bill"
  | "assessed_value_x_official_rate"
  | "jurisdiction_proxy_x_official_rate"
  | "province_proxy_x_official_rate"
  | "effective_tax_backup"
  | "user_override";

export type PropertyTaxConfidence = "high" | "medium" | "low";
export type PropertyTaxClass =
  | "residential"
  | "multi_residential"
  | "new_multi_residential"
  | "non_residential"
  | "mixed_use"
  | "vacant_land";

export type PropertyTaxAssessedValueSource =
  | "exact"
  | "jurisdiction_proxy"
  | "province_proxy"
  | "effective_tax_backup"
  | "user_override"
  | "not_available";

export interface PropertyTaxEstimate {
  amountAnnual: number;
  effectiveRateVsPrice: number | null;
  effectiveRateVsAssessment: number | null;
  method: PropertyTaxMethod;
  confidence: PropertyTaxConfidence;
  province: string | null;
  taxYear: number | null;
  jurisdiction: string | null;
  areaLabel: string | null;
  taxClass: PropertyTaxClass;
  assessedValue: number | null;
  assessedValueSource: PropertyTaxAssessedValueSource;
  assessmentProxyRatio: number | null;
  appliedRate: number | null;
  source: AssumptionSource;
  sourceLabel: string | null;
  sourceUrl: string | null;
  sourceSummary: string;
  formulaSummary: string;
  fallbackReason: string | null;
}

export interface OperatingExpenseTemplate {
  averageManagementFeePct: number | null;
  insuranceDefaultBasis: OperatingExpenseTemplateBasis | null;
  insuranceDefaultValue: number | null;
  repairsDefaultBasis: OperatingExpenseTemplateBasis | null;
  repairsDefaultValue: number | null;
  utilitiesDefaultBasis: OperatingExpenseTemplateBasis | null;
  utilitiesDefaultValue: number | null;
  snowDefaultBasis: OperatingExpenseTemplateBasis | null;
  snowDefaultValue: number | null;
}

export type BuiltInOperatingExpenseKey =
  | "property_tax"
  | "insurance"
  | "repairs_maintenance"
  | "utilities_common"
  | "management"
  | "snow_landscaping";

export type OperatingExpenseKey = BuiltInOperatingExpenseKey | `custom_${string}`;

export type OperatingExpenseInputMode = "annual" | "monthly" | "rate";

export interface OperatingExpenseLineItem {
  key: OperatingExpenseKey;
  label: string;
  basis: OperatingExpenseBasis;
  percentBasis: Exclude<OperatingExpenseBasis, "fixed_annual">;
  inputMode: OperatingExpenseInputMode;
  isCustom?: boolean;
  rate: AssumptionValue<number>;
  amountAnnual: AssumptionValue<number>;
  description: string;
  formula: string;
  propertyTaxEstimate?: PropertyTaxEstimate;
}

export interface ScenarioAssumptions {
  vacancyRate: AssumptionValue<number>;
  currentMarketRent: AssumptionValue<number>;
  turnoverMarketRent: AssumptionValue<number>;
  renovatedRentProxy: AssumptionValue<number>;
  rentGrowthRateAnnual: AssumptionValue<number>;
  operatingExpenses: OperatingExpenseLineItem[];
  operatingExpenseRatio: AssumptionValue<number>;
  appreciationRateAnnual: AssumptionValue<number>;
  renoCostPerSqFt: AssumptionValue<number>;
  closingCostPct: AssumptionValue<number>;
  exitCapRate: AssumptionValue<number>;
  mortgageRate: AssumptionValue<number>;
  amortizationYears: AssumptionValue<number>;
  ltvPct: AssumptionValue<number>;
  takeoutLtvPct: AssumptionValue<number>;
  bridgeAdvancePct: AssumptionValue<number>;
  bridgeRateAnnual: AssumptionValue<number>;
  bridgeTermMonths: AssumptionValue<number>;
  bridgeFeePct: AssumptionValue<number>;
  bridgeInterestReserveMonths: AssumptionValue<number>;
  holdPeriodYears: AssumptionValue<number>;
}
