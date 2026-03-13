import type {
  AssumptionValue,
  BridgeUsage,
  BusinessPlanId,
  DealStage,
  InvestorContext,
  NormalizedAssetType,
  OperatingExpenseTemplate,
  ScenarioAssumptions,
  StrategyId,
  StrategyUnitRentLineItem,
  UnitRentBenchmark,
} from "@/types/listing";
import type { BridgeFacilityResult, FinanceResult, ReturnBridgeResult } from "./finance";
import {
  computeBuyAndHold,
  computeBridgeFacility,
  computeCashflowProjection,
  computeReturnBridge,
  effectiveGrossIncome,
  grossScheduledRent,
} from "./finance";
import type { NormalizedProfileResult } from "./normalized-profile";
import {
  clampAmortization,
  getProgramEnvelope,
  resolveMinimumDownPaymentRule,
  resolveProgramId,
  type ProgramId,
} from "./program-rules";
import { SCENARIO_ORDER } from "./strategy-applicability";
import {
  buildOperatingExpenseSchedule,
  deriveOperatingExpenseRatioAssumption,
  type OperatingExpenseBaselineMode,
  toFinanceOperatingExpenseItems,
} from "./operating-expenses";
import { scoreMliSelect, type MliSelectScoreResult } from "./mli-select";
import { resolvePropertyTaxEstimate } from "./property-tax";

type UnderwritingMode = "current_income" | "stabilized_income" | "covered_land";
type RentBasis = "current" | "renovated" | "affordable" | "new_build" | "interim";

export interface StrategyVariant {
  name: string;
  propertyTypes: string[];
  description: string;
}

export interface StrategyCapitalPlan {
  budget: number;
  targetAreaSqFt: number | null;
  label: string;
}

export interface StrategyModel {
  strategyId: StrategyId;
  businessPlanId: BusinessPlanId;
  programId: ProgramId;
  requiresBridgeLoan: boolean;
  bridgeUsage: BridgeUsage;
  ownerOccupied: boolean;
  stage?: DealStage;
  assetType: NormalizedAssetType;
  overview: string;
  underwritingMode: UnderwritingMode;
  targetPropertyTypes: string[];
  suitableAssetTypes: NormalizedAssetType[];
  strategyVariants: StrategyVariant[];
  modelBasis: string[];
  executionPlan: string[];
  financingPlan: string[];
  keyRisks: string[];
  assumptions: ScenarioAssumptions;
  modeledUnits: AssumptionValue<number>;
  modeledRentPerUnit: AssumptionValue<number>;
  unitRentSchedule: StrategyUnitRentLineItem[];
  modeledRentBasis: RentBasis;
  modeledRentBasisLabel: string;
  capitalPlan: StrategyCapitalPlan;
  result: FinanceResult;
  stabilizedValue: number | null;
  bridgeFacility: BridgeFacilityResult | null;
  returnBridge: ReturnBridgeResult;
  programEnvelope: {
    maxLeveragePct: number;
    maxAmortizationYears: number;
    leverageMetric: "LTV" | "LTC";
    note: string | null;
  };
  mliSelectAnalysis: MliSelectScoreResult | null;
}

interface StrategyPreset {
  businessPlanId: BusinessPlanId;
  overview: string;
  underwritingMode: UnderwritingMode;
  targetPropertyTypes: string[];
  suitableAssetTypes: NormalizedAssetType[];
  strategyVariants: StrategyVariant[];
  modelBasis: string[];
  executionPlan: string[];
  financingPlan: string[];
  keyRisks: string[];
  rentBasis: RentBasis;
  vacancyShift: number;
  closingCostPct: number;
  mortgageRate: number;
  amortizationYears: number;
  ltvPct: number;
  takeoutLtvPct?: number;
  bridgeAdvancePct?: number;
  bridgeRateAnnual?: number;
  bridgeTermMonths?: number;
  bridgeFeePct?: number;
  bridgeInterestReserveMonths?: number;
  holdPeriodYears: number;
  renoCostPerSqFt: number;
  exitCapRate: number;
  appreciationShift: number;
  capitalPlanLabel: string;
  programId?: ProgramId;
  requiresBridgeLoan?: boolean;
  bridgeUsage: BridgeUsage;
  stage?: DealStage;
  ownerOccupied?: boolean;
  showStabilizedValue?: boolean;
  futureUnits?: "lot_size";
}

interface StrategyModelInput {
  strategyId: StrategyId;
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

const PRESETS: Record<StrategyId, StrategyPreset> = {
  conventional_owner_occupied: {
    businessPlanId: "live_in_homeowner",
    overview: "Owner-occupied residential hold using conventional leverage and principal-residence down-payment rules.",
    underwritingMode: "current_income",
    targetPropertyTypes: ["Single-family", "Condo", "Townhouse", "Duplex", "Triplex", "Fourplex"],
    suitableAssetTypes: ["single_family", "condo", "townhouse", "duplex", "triplex", "fourplex"],
    strategyVariants: [
      { name: "House-hack hold", propertyTypes: ["Single-family", "Duplex", "Triplex", "Fourplex"], description: "Live in one unit and optimize the carry with the rest of the rent roll." },
    ],
    modelBasis: [
      "Uses current market rent and owner-occupied down-payment rules.",
      "Emphasizes stable carry, paydown, and appreciation rather than a bridge or refinance event.",
    ],
    executionPlan: [
      "Confirm the property can support owner-occupied financing and intended rental use.",
      "Stress taxes, insurance, and maintenance before relying on house-hack cashflow.",
    ],
    financingPlan: ["Conventional owner-occupied mortgage sized from purchase price and insured-style down-payment rules."],
    keyRisks: ["Thin carry can flip negative quickly when operating costs rise."],
    rentBasis: "current",
    vacancyShift: 0,
    closingCostPct: 0.02,
    mortgageRate: 0.052,
    amortizationYears: 30,
    ltvPct: 0.9,
    holdPeriodYears: 5,
    renoCostPerSqFt: 0,
    exitCapRate: 0.0525,
    appreciationShift: 0,
    capitalPlanLabel: "No heavy improvement budget is assumed in the live-in hold base case.",
    programId: "conventional_owner_occupied",
    ownerOccupied: true,
    requiresBridgeLoan: false,
    bridgeUsage: "not_needed",
  },
  cmhc_homeowner: {
    businessPlanId: "live_in_homeowner",
    overview: "Owner-occupied CMHC-insured homeowner financing for 1-4 unit residential assets.",
    underwritingMode: "current_income",
    targetPropertyTypes: ["Single-family", "Condo", "Townhouse", "Duplex", "Triplex", "Fourplex"],
    suitableAssetTypes: ["single_family", "condo", "townhouse", "duplex", "triplex", "fourplex"],
    strategyVariants: [
      { name: "Insured homeowner carry", propertyTypes: ["Single-family", "Condo", "Duplex"], description: "Use insured owner-occupied leverage to reduce upfront equity while preserving flexibility." },
    ],
    modelBasis: [
      "Uses current market rent and insured homeowner leverage.",
      "Keeps the hold lens focused on stable occupancy and manageable debt service.",
    ],
    executionPlan: ["Confirm owner-occupied eligibility and any rental-unit configuration."],
    financingPlan: ["CMHC homeowner leverage sized from insured owner-occupied rules."],
    keyRisks: ["Mixed-use or non-self-contained layouts can fail insured underwriting late."],
    rentBasis: "current",
    vacancyShift: 0,
    closingCostPct: 0.02,
    mortgageRate: 0.049,
    amortizationYears: 25,
    ltvPct: 0.95,
    holdPeriodYears: 5,
    renoCostPerSqFt: 0,
    exitCapRate: 0.0525,
    appreciationShift: 0,
    capitalPlanLabel: "No immediate renovation budget assumed.",
    programId: "cmhc_homeowner",
    ownerOccupied: true,
    requiresBridgeLoan: false,
    bridgeUsage: "not_needed",
  },
  cmhc_home_start: {
    businessPlanId: "live_in_homeowner",
    overview: "High-ratio owner-occupied Home Start path with longer amortization for first-time buyers or newly built homes.",
    underwritingMode: "current_income",
    targetPropertyTypes: ["Single-family", "Condo", "Townhouse", "Duplex", "Triplex", "Fourplex"],
    suitableAssetTypes: ["single_family", "condo", "townhouse", "duplex", "triplex", "fourplex"],
    strategyVariants: [
      { name: "First home with long amortization", propertyTypes: ["Single-family", "Condo", "Duplex"], description: "Use the longer amortization to protect year-one carry." },
    ],
    modelBasis: [
      "Uses the homeowner path but extends amortization to the Home Start maximum when eligible.",
      "Assumes a high-ratio owner-occupied loan rather than investor financing.",
    ],
    executionPlan: ["Confirm first-time buyer or new-build eligibility before relying on Home Start terms."],
    financingPlan: ["CMHC Home Start pricing and amortization with owner-occupied down-payment rules."],
    keyRisks: ["If the borrower or property misses Home Start criteria, the model reverts to standard owner-occupied logic."],
    rentBasis: "current",
    vacancyShift: 0,
    closingCostPct: 0.02,
    mortgageRate: 0.0485,
    amortizationYears: 30,
    ltvPct: 0.95,
    holdPeriodYears: 5,
    renoCostPerSqFt: 0,
    exitCapRate: 0.0525,
    appreciationShift: 0,
    capitalPlanLabel: "No immediate renovation budget assumed.",
    programId: "cmhc_home_start",
    ownerOccupied: true,
    requiresBridgeLoan: false,
    bridgeUsage: "not_needed",
  },
  cmhc_improvement_owner_occupied: {
    businessPlanId: "live_in_homeowner",
    overview: "Owner-occupied CMHC Improvement path for live-in properties with an immediate renovation or suite-add scope.",
    underwritingMode: "stabilized_income",
    targetPropertyTypes: ["Single-family", "Townhouse", "Duplex", "Triplex", "Fourplex"],
    suitableAssetTypes: ["single_family", "townhouse", "duplex", "triplex", "fourplex"],
    strategyVariants: [
      { name: "Live-in improvement", propertyTypes: ["Single-family", "Duplex"], description: "Renovate while occupying the property and underwrite the improved income profile conservatively." },
    ],
    modelBasis: [
      "Uses turnover or post-improvement rent on the renovated suites while still respecting owner-occupied program rules.",
      "Improvement budget is capitalized into the modeled basis.",
    ],
    executionPlan: ["Confirm the scope is real and immediate before underwriting improvement financing."],
    financingPlan: ["CMHC Improvement owner-occupied leverage tied to supported lending value."],
    keyRisks: ["Improvement timing slippage can leave the owner carrying investor-style risk on an owner-occupied budget."],
    rentBasis: "renovated",
    vacancyShift: 0.005,
    closingCostPct: 0.0225,
    mortgageRate: 0.0495,
    amortizationYears: 25,
    ltvPct: 0.9,
    holdPeriodYears: 5,
    renoCostPerSqFt: 65,
    exitCapRate: 0.0525,
    appreciationShift: 0,
    capitalPlanLabel: "Improvement budget is included for owner-occupied renovation scope.",
    programId: "cmhc_improvement_owner_occupied",
    ownerOccupied: true,
    requiresBridgeLoan: false,
    bridgeUsage: "not_needed",
    showStabilizedValue: true,
  },
  conventional_investor_small_bay: {
    businessPlanId: "small_bay_hold",
    overview: "Small-bay investor hold for 1-4 units using conventional debt and current income underwriting.",
    underwritingMode: "current_income",
    targetPropertyTypes: ["Single-family with suite", "Duplex", "Triplex", "Fourplex", "Townhouse"],
    suitableAssetTypes: ["single_family", "townhouse", "duplex", "triplex", "fourplex", "condo"],
    strategyVariants: [
      { name: "Turnkey small-bay hold", propertyTypes: ["Duplex", "Triplex", "Fourplex"], description: "Own stabilized 1-4 unit residential with no major repositioning thesis." },
    ],
    modelBasis: [
      "Uses current market rent and conventional investor leverage.",
      "Year-one return is cashflow plus paydown plus appreciation.",
    ],
    executionPlan: ["Validate in-place rents and turnover assumptions before relying on carry."],
    financingPlan: ["Conventional investor debt sized to durable small-bay carry."],
    keyRisks: ["Small rent rolls have limited room for vacancy shocks."],
    rentBasis: "current",
    vacancyShift: 0,
    closingCostPct: 0.02,
    mortgageRate: 0.055,
    amortizationYears: 30,
    ltvPct: 0.8,
    holdPeriodYears: 5,
    renoCostPerSqFt: 0,
    exitCapRate: 0.055,
    appreciationShift: 0,
    capitalPlanLabel: "No major capex assumed beyond normal turnover reserves.",
    programId: "conventional_investor",
    requiresBridgeLoan: false,
    bridgeUsage: "not_needed",
  },
  cmhc_income_property: {
    businessPlanId: "small_bay_hold",
    overview: "CMHC small-rental takeout for 2-4 unit investor-owned properties.",
    underwritingMode: "current_income",
    targetPropertyTypes: ["Duplex", "Triplex", "Fourplex"],
    suitableAssetTypes: ["duplex", "triplex", "fourplex"],
    strategyVariants: [
      { name: "Insured small-rental hold", propertyTypes: ["Duplex", "Triplex", "Fourplex"], description: "Use CMHC small-rental leverage to improve equity efficiency on a stabilized 2-4 unit asset." },
    ],
    modelBasis: [
      "Keeps the hold lens but caps leverage and amortization to CMHC Income Property parameters.",
      "Uses current market rent, not a heavy-renovation thesis.",
    ],
    executionPlan: ["Confirm the property is non-owner-occupied, fully residential, and configured as a rental."],
    financingPlan: ["CMHC Income Property takeout sized to 2-4 unit insured rental rules."],
    keyRisks: ["Owner-occupancy or mixed-use issues can break eligibility late."],
    rentBasis: "current",
    vacancyShift: 0,
    closingCostPct: 0.02,
    mortgageRate: 0.05,
    amortizationYears: 25,
    ltvPct: 0.8,
    holdPeriodYears: 5,
    renoCostPerSqFt: 0,
    exitCapRate: 0.0525,
    appreciationShift: 0,
    capitalPlanLabel: "Only light turnover capex is assumed.",
    programId: "cmhc_income_property",
    requiresBridgeLoan: false,
    bridgeUsage: "not_needed",
  },
  cmhc_improvement_small_rental: {
    businessPlanId: "small_bay_hold",
    overview: "CMHC Improvement path for 2-4 unit investor-owned rentals with a real near-term renovation scope.",
    underwritingMode: "stabilized_income",
    targetPropertyTypes: ["Duplex", "Triplex", "Fourplex"],
    suitableAssetTypes: ["duplex", "triplex", "fourplex"],
    strategyVariants: [
      { name: "Light improvement hold", propertyTypes: ["Triplex", "Fourplex"], description: "Renovate enough to improve rent quality without moving into a full bridge/refi execution." },
    ],
    modelBasis: [
      "Uses improvement rent and a supported capex budget without forcing a bridge-first execution.",
      "Best fit when the work is real but the deal still stabilizes into a 2-4 unit CMHC-style hold.",
    ],
    executionPlan: ["Confirm the improvement scope is immediate and measurable."],
    financingPlan: ["CMHC Improvement small-rental leverage sized to 80% of supported lending value."],
    keyRisks: ["If the work drifts into a deeper value-add, a bridge/refi path may be more realistic."],
    rentBasis: "renovated",
    vacancyShift: 0.005,
    closingCostPct: 0.0225,
    mortgageRate: 0.051,
    amortizationYears: 25,
    ltvPct: 0.8,
    holdPeriodYears: 5,
    renoCostPerSqFt: 55,
    exitCapRate: 0.0525,
    appreciationShift: 0,
    capitalPlanLabel: "Improvement budget is included for the small-rental scope.",
    programId: "cmhc_improvement_small_rental",
    requiresBridgeLoan: false,
    bridgeUsage: "not_needed",
    showStabilizedValue: true,
  },
  bridge_conventional_small_bay_refi: {
    businessPlanId: "small_bay_value_add_refi",
    overview: "Small-bay bridge-to-conventional refi path for 1-4 unit value-add execution.",
    underwritingMode: "stabilized_income",
    targetPropertyTypes: ["Single-family with suite potential", "Duplex", "Triplex", "Fourplex"],
    suitableAssetTypes: ["single_family", "townhouse", "duplex", "triplex", "fourplex"],
    strategyVariants: [
      { name: "Bridge BRRR", propertyTypes: ["Duplex", "Triplex", "Fourplex"], description: "Acquire, improve, lease-up, and refinance once the new rent roll is proven." },
    ],
    modelBasis: [
      "Uses renovated rent and full capex in basis.",
      "Year-one return includes stabilization lift and bridge carry when enabled.",
    ],
    executionPlan: ["Bid only where post-reno rent and refinance proceeds are defensible."],
    financingPlan: ["Bridge first, then conventional takeout once stabilized."],
    keyRisks: ["Appraisal or timeline slippage can leave too much dead equity in the deal."],
    rentBasis: "renovated",
    vacancyShift: 0.01,
    closingCostPct: 0.025,
    mortgageRate: 0.06,
    amortizationYears: 30,
    ltvPct: 0.8,
    takeoutLtvPct: 0.8,
    bridgeAdvancePct: 0.8,
    bridgeRateAnnual: 0.0845,
    bridgeTermMonths: 12,
    bridgeFeePct: 0.01,
    bridgeInterestReserveMonths: 6,
    holdPeriodYears: 3,
    renoCostPerSqFt: 70,
    exitCapRate: 0.055,
    appreciationShift: 0,
    capitalPlanLabel: "Capex budget is included as part of total basis before refinance.",
    programId: "conventional_investor",
    requiresBridgeLoan: true,
    bridgeUsage: "common",
    showStabilizedValue: true,
  },
  bridge_cmhc_income_property_takeout: {
    businessPlanId: "small_bay_value_add_refi",
    overview: "Small-bay bridge path that aims to term out into CMHC Income Property after the renovation and stabilization work is complete.",
    underwritingMode: "stabilized_income",
    targetPropertyTypes: ["Duplex", "Triplex", "Fourplex"],
    suitableAssetTypes: ["duplex", "triplex", "fourplex"],
    strategyVariants: [
      { name: "Bridge to CMHC small-rental takeout", propertyTypes: ["Duplex", "Triplex", "Fourplex"], description: "Use bridge capital for the work, then refinance into insured 2-4 unit rental debt." },
    ],
    modelBasis: [
      "Uses renovated rent and a bridge-first value-add stack.",
      "Permanent takeout is constrained to CMHC Income Property rules.",
    ],
    executionPlan: ["Underwrite the refinance to the insured 2-4 unit takeout, not just the rent lift."],
    financingPlan: ["Bridge acquisition plus capex, then CMHC Income Property takeout."],
    keyRisks: ["If the stabilized asset misses CMHC small-rental criteria, the takeout will not clear the bridge."],
    rentBasis: "renovated",
    vacancyShift: 0.01,
    closingCostPct: 0.025,
    mortgageRate: 0.05,
    amortizationYears: 25,
    ltvPct: 0.8,
    takeoutLtvPct: 0.8,
    bridgeAdvancePct: 0.78,
    bridgeRateAnnual: 0.0845,
    bridgeTermMonths: 12,
    bridgeFeePct: 0.01,
    bridgeInterestReserveMonths: 6,
    holdPeriodYears: 3,
    renoCostPerSqFt: 70,
    exitCapRate: 0.0525,
    appreciationShift: 0,
    capitalPlanLabel: "Capex budget is included as part of total basis before insured takeout.",
    programId: "cmhc_income_property",
    requiresBridgeLoan: true,
    bridgeUsage: "common",
    showStabilizedValue: true,
  },
  owner_occupied_improvement_refi: {
    businessPlanId: "small_bay_value_add_refi",
    overview: "Owner-occupied improvement path for 1-4 unit assets where the renovation thesis is real but the borrower still lives in the property.",
    underwritingMode: "stabilized_income",
    targetPropertyTypes: ["Single-family", "Duplex", "Triplex", "Fourplex"],
    suitableAssetTypes: ["single_family", "duplex", "triplex", "fourplex", "townhouse"],
    strategyVariants: [
      { name: "Owner-occupied suite-add", propertyTypes: ["Single-family", "Duplex"], description: "Improve layout or add a suite while still occupying the asset." },
    ],
    modelBasis: [
      "Uses renovated rent with owner-occupied financing assumptions.",
      "Stabilization lift matters, but the capital stack stays owner-occupied rather than bridge-first.",
    ],
    executionPlan: ["Confirm the borrower intends to remain owner-occupied through the improvement period."],
    financingPlan: ["Owner-occupied improvement loan sized to the supported renovation plan."],
    keyRisks: ["This path breaks down quickly if the occupancy plan changes after closing."],
    rentBasis: "renovated",
    vacancyShift: 0.005,
    closingCostPct: 0.0225,
    mortgageRate: 0.0495,
    amortizationYears: 25,
    ltvPct: 0.9,
    holdPeriodYears: 5,
    renoCostPerSqFt: 60,
    exitCapRate: 0.0525,
    appreciationShift: 0,
    capitalPlanLabel: "Improvement budget is included for the owner-occupied renovation thesis.",
    programId: "cmhc_improvement_owner_occupied",
    ownerOccupied: true,
    requiresBridgeLoan: false,
    bridgeUsage: "optional",
    showStabilizedValue: true,
  },
  conventional_multifamily_hold: {
    businessPlanId: "multifamily_hold",
    overview: "Conventional hold for stabilized 5+ unit rental where the edge is durable carry, not program leverage.",
    underwritingMode: "current_income",
    targetPropertyTypes: ["5+ unit apartment building", "Residential-heavy mixed-use"],
    suitableAssetTypes: ["apartment", "mixed_use"],
    strategyVariants: [
      { name: "Conventional multifamily hold", propertyTypes: ["Apartment building", "Mixed-use"], description: "Use conventional permanent debt on an existing stabilized multifamily asset." },
    ],
    modelBasis: [
      "Uses current market rent and conventional multifamily leverage.",
      "Hold-period return comes from carry, paydown, and appreciation.",
    ],
    executionPlan: ["Confirm the rent roll and operating expenses support a stable carry case without relying on CMHC execution."],
    financingPlan: ["Conventional multifamily debt with a lower leverage ceiling than CMHC."],
    keyRisks: ["Conventional coupons can compress carry if rates stay elevated."],
    rentBasis: "current",
    vacancyShift: 0,
    closingCostPct: 0.0225,
    mortgageRate: 0.0565,
    amortizationYears: 30,
    ltvPct: 0.75,
    holdPeriodYears: 7,
    renoCostPerSqFt: 0,
    exitCapRate: 0.055,
    appreciationShift: 0,
    capitalPlanLabel: "No major repositioning budget is assumed in the conventional multifamily hold path.",
    programId: "conventional_multifamily",
    requiresBridgeLoan: false,
    bridgeUsage: "not_needed",
  },
  cmhc_standard_rental_existing: {
    businessPlanId: "multifamily_hold",
    overview: "CMHC Standard Rental takeout for stabilized existing 5+ unit rental buildings.",
    underwritingMode: "current_income",
    targetPropertyTypes: ["Stabilized apartment building", "Residential-heavy mixed-use"],
    suitableAssetTypes: ["apartment", "mixed_use"],
    strategyVariants: [
      { name: "Existing insured hold", propertyTypes: ["Apartment building"], description: "Use CMHC Standard Rental to maximize efficient permanent debt on a stabilized building." },
    ],
    modelBasis: [
      "Uses current market rent and existing-building Standard Rental terms.",
      "Longer amortization improves carry and equity compounding.",
    ],
    executionPlan: ["Confirm residential share and stabilized-operating quality before underwriting insured takeout."],
    financingPlan: ["CMHC Standard Rental (existing) takeout with long amortization and lower coupon than conventional debt."],
    keyRisks: ["Program timing and mixed-use leakage can jeopardize closing late."],
    rentBasis: "current",
    vacancyShift: 0,
    closingCostPct: 0.02,
    mortgageRate: 0.049,
    amortizationYears: 40,
    ltvPct: 0.85,
    takeoutLtvPct: 0.85,
    bridgeAdvancePct: 0.8,
    bridgeRateAnnual: 0.0745,
    bridgeTermMonths: 12,
    bridgeFeePct: 0.01,
    bridgeInterestReserveMonths: 6,
    holdPeriodYears: 7,
    renoCostPerSqFt: 0,
    exitCapRate: 0.0525,
    appreciationShift: 0,
    capitalPlanLabel: "Only light reserve and leasing capex is assumed.",
    programId: "cmhc_standard_rental_existing",
    requiresBridgeLoan: false,
    bridgeUsage: "optional",
  },
  mli_select_existing: {
    businessPlanId: "multifamily_hold",
    overview: "Existing 5+ unit MLI Select path where affordability, energy, or accessibility scoring can unlock better leverage and amortization.",
    underwritingMode: "stabilized_income",
    targetPropertyTypes: ["Apartment building", "Affordable preservation asset", "Retrofit candidate"],
    suitableAssetTypes: ["apartment", "mixed_use"],
    strategyVariants: [
      { name: "Existing MLI Select hold", propertyTypes: ["Apartment building"], description: "Term into MLI Select when the project can genuinely support the required score." },
    ],
    modelBasis: [
      "Uses a policy-driven scoring path layered on top of the hold underwriting.",
      "Modeled rent reflects the selected operating path while the scorecard drives leverage and amortization.",
    ],
    executionPlan: ["Prove the scoring path before counting on headline leverage."],
    financingPlan: ["MLI Select existing leverage and amortization depend on the achieved point tier."],
    keyRisks: ["If the score slips below the target tier, the leverage edge disappears quickly."],
    rentBasis: "affordable",
    vacancyShift: 0,
    closingCostPct: 0.02,
    mortgageRate: 0.045,
    amortizationYears: 45,
    ltvPct: 0.85,
    takeoutLtvPct: 0.85,
    bridgeAdvancePct: 0.8,
    bridgeRateAnnual: 0.0695,
    bridgeTermMonths: 18,
    bridgeFeePct: 0.01,
    bridgeInterestReserveMonths: 6,
    holdPeriodYears: 10,
    renoCostPerSqFt: 35,
    exitCapRate: 0.05,
    appreciationShift: 0,
    capitalPlanLabel: "Retrofit budget is included only if the MLI path relies on real project work.",
    programId: "mli_select_existing",
    requiresBridgeLoan: false,
    bridgeUsage: "optional",
  },
  bridge_conventional_multifamily: {
    businessPlanId: "multifamily_value_add_refi",
    overview: "Bridge-to-conventional multifamily value-add path for 5+ unit repositioning deals.",
    underwritingMode: "stabilized_income",
    targetPropertyTypes: ["5+ unit apartment building", "Residential-heavy mixed-use"],
    suitableAssetTypes: ["apartment", "mixed_use"],
    strategyVariants: [
      { name: "Bridge to conventional refi", propertyTypes: ["Apartment building", "Mixed-use"], description: "Acquire under-managed 5+ units, improve NOI, then refinance conventionally." },
    ],
    modelBasis: [
      "All-in basis includes renovation spend and bridge carry.",
      "Permanent takeout follows conventional multifamily leverage, not CMHC execution.",
    ],
    executionPlan: ["Underwrite turn velocity, rent lift, and exit leverage together."],
    financingPlan: ["Bridge acquisition plus capex, then conventional multifamily takeout."],
    keyRisks: ["Conventional takeout proceeds may lag the sponsor's initial refi assumptions."],
    rentBasis: "renovated",
    vacancyShift: 0.015,
    closingCostPct: 0.025,
    mortgageRate: 0.0575,
    amortizationYears: 30,
    ltvPct: 0.75,
    takeoutLtvPct: 0.75,
    bridgeAdvancePct: 0.75,
    bridgeRateAnnual: 0.0695,
    bridgeTermMonths: 18,
    bridgeFeePct: 0.01,
    bridgeInterestReserveMonths: 6,
    holdPeriodYears: 3,
    renoCostPerSqFt: 85,
    exitCapRate: 0.055,
    appreciationShift: 0,
    capitalPlanLabel: "Turnover and common-area capex are included in the total basis.",
    programId: "conventional_multifamily",
    requiresBridgeLoan: true,
    bridgeUsage: "common",
    showStabilizedValue: true,
  },
  bridge_standard_rental_takeout: {
    businessPlanId: "multifamily_value_add_refi",
    overview: "Bridge-first multifamily value-add path that aims to refinance into CMHC Standard Rental once the building stabilizes.",
    underwritingMode: "stabilized_income",
    targetPropertyTypes: ["5+ unit apartment building", "Residential-heavy mixed-use"],
    suitableAssetTypes: ["apartment", "mixed_use"],
    strategyVariants: [
      { name: "Bridge to Standard Rental", propertyTypes: ["Apartment building"], description: "Use bridge debt to reposition the asset, then term out with CMHC once the NOI is cleaner." },
    ],
    modelBasis: [
      "Uses renovated rent and full capex basis.",
      "Permanent takeout is constrained to existing Standard Rental terms.",
    ],
    executionPlan: ["Model bridge carry, rent lift, and CMHC eligibility as one integrated path."],
    financingPlan: ["Bridge acquisition plus capex, then existing-building Standard Rental takeout."],
    keyRisks: ["If the building misses CMHC stabilized-rental criteria, the takeout will not clear the bridge cleanly."],
    rentBasis: "renovated",
    vacancyShift: 0.015,
    closingCostPct: 0.025,
    mortgageRate: 0.049,
    amortizationYears: 40,
    ltvPct: 0.75,
    takeoutLtvPct: 0.85,
    bridgeAdvancePct: 0.75,
    bridgeRateAnnual: 0.0695,
    bridgeTermMonths: 18,
    bridgeFeePct: 0.01,
    bridgeInterestReserveMonths: 6,
    holdPeriodYears: 3,
    renoCostPerSqFt: 85,
    exitCapRate: 0.0525,
    appreciationShift: 0,
    capitalPlanLabel: "Turnover and common-area capex are included before Standard Rental takeout.",
    programId: "cmhc_standard_rental_existing",
    requiresBridgeLoan: true,
    bridgeUsage: "common",
    showStabilizedValue: true,
  },
  bridge_mli_select_takeout: {
    businessPlanId: "multifamily_value_add_refi",
    overview: "Bridge-first multifamily value-add path that targets MLI Select takeout once the asset and scorecard are ready.",
    underwritingMode: "stabilized_income",
    targetPropertyTypes: ["Apartment building", "Affordable preservation asset", "Retrofit candidate"],
    suitableAssetTypes: ["apartment", "mixed_use"],
    strategyVariants: [
      { name: "Bridge to MLI Select", propertyTypes: ["Apartment building"], description: "Bridge the repositioning period, then term into MLI Select once the scoring path is documented." },
    ],
    modelBasis: [
      "Uses renovated rent, capex, and bridge carry while the scorecard drives final leverage and amortization.",
      "Best fit when the value-add and the points case are both real.",
    ],
    executionPlan: ["Tie the retrofit and operating plan directly to the MLI scoring buckets you intend to claim."],
    financingPlan: ["Bridge now, MLI Select takeout later once the project qualifies."],
    keyRisks: ["Score slippage and capex drift can compress both takeout leverage and real cash profit."],
    rentBasis: "renovated",
    vacancyShift: 0.015,
    closingCostPct: 0.025,
    mortgageRate: 0.045,
    amortizationYears: 45,
    ltvPct: 0.75,
    takeoutLtvPct: 0.85,
    bridgeAdvancePct: 0.75,
    bridgeRateAnnual: 0.0695,
    bridgeTermMonths: 18,
    bridgeFeePct: 0.01,
    bridgeInterestReserveMonths: 6,
    holdPeriodYears: 3,
    renoCostPerSqFt: 90,
    exitCapRate: 0.05,
    appreciationShift: 0,
    capitalPlanLabel: "Capex is included to reflect the repositioning and scoring work required for MLI takeout.",
    programId: "mli_select_existing",
    requiresBridgeLoan: true,
    bridgeUsage: "common",
    showStabilizedValue: true,
  },
  conventional_construction_takeout: {
    businessPlanId: "rental_development",
    overview: "Conventional rental-development path for land, parking, or low-density redevelopment sites.",
    underwritingMode: "stabilized_income",
    targetPropertyTypes: ["Vacant land", "Parking lot", "House on redevelopment lot", "Conversion site"],
    suitableAssetTypes: ["land", "parking", "single_family", "mixed_use"],
    strategyVariants: [
      { name: "Conventional rental development", propertyTypes: ["Vacant land", "Assembly site"], description: "Use a construction-oriented conventional stack and refinance once stabilized." },
    ],
    modelBasis: [
      "Uses new-build rent and a full construction basis.",
      "Bridge or construction financing is a core part of the business plan.",
    ],
    executionPlan: ["Underwrite entitlement and future density conservatively before trusting lease-up math."],
    financingPlan: ["Construction-style bridge or facility first, then conventional takeout."],
    keyRisks: ["Entitlement and construction delay can overwhelm the modeled spread."],
    rentBasis: "new_build",
    vacancyShift: 0,
    closingCostPct: 0.04,
    mortgageRate: 0.055,
    amortizationYears: 30,
    ltvPct: 0.75,
    takeoutLtvPct: 0.75,
    bridgeAdvancePct: 0.75,
    bridgeRateAnnual: 0.0725,
    bridgeTermMonths: 24,
    bridgeFeePct: 0.01,
    bridgeInterestReserveMonths: 6,
    holdPeriodYears: 10,
    renoCostPerSqFt: 225,
    exitCapRate: 0.0525,
    appreciationShift: 0,
    capitalPlanLabel: "Construction budget is sized from modeled future density and rentable area.",
    programId: "conventional_construction_takeout",
    stage: "new_construction",
    requiresBridgeLoan: true,
    bridgeUsage: "core",
    showStabilizedValue: true,
    futureUnits: "lot_size",
  },
  cmhc_standard_rental_new_construction: {
    businessPlanId: "rental_development",
    overview: "New-construction Standard Rental path for purpose-built rental development that can term out into CMHC Standard Rental.",
    underwritingMode: "stabilized_income",
    targetPropertyTypes: ["Vacant land", "Parking lot", "Redevelopment site", "Conversion site"],
    suitableAssetTypes: ["land", "parking", "single_family", "mixed_use"],
    strategyVariants: [
      { name: "Standard Rental development", propertyTypes: ["Vacant land", "Assembly site"], description: "Build purpose-built rental and target Standard Rental takeout on completion." },
    ],
    modelBasis: [
      "Uses new-build rent and full development capitalization.",
      "Permanent takeout is constrained to Standard Rental new-construction limits.",
    ],
    executionPlan: ["Confirm the future program fit before counting on CMHC new-build takeout leverage."],
    financingPlan: ["Construction-style bridge or build facility first, then Standard Rental takeout."],
    keyRisks: ["If the finished asset misses CMHC quality or residential-share requirements, the takeout weakens materially."],
    rentBasis: "new_build",
    vacancyShift: 0,
    closingCostPct: 0.04,
    mortgageRate: 0.052,
    amortizationYears: 50,
    ltvPct: 0.8,
    takeoutLtvPct: 0.85,
    bridgeAdvancePct: 0.75,
    bridgeRateAnnual: 0.0695,
    bridgeTermMonths: 24,
    bridgeFeePct: 0.01,
    bridgeInterestReserveMonths: 6,
    holdPeriodYears: 10,
    renoCostPerSqFt: 225,
    exitCapRate: 0.05,
    appreciationShift: 0,
    capitalPlanLabel: "Construction budget is sized from modeled future density and rentable area.",
    programId: "cmhc_standard_rental_new_construction",
    stage: "new_construction",
    requiresBridgeLoan: true,
    bridgeUsage: "core",
    showStabilizedValue: true,
    futureUnits: "lot_size",
  },
  mli_select_new_construction: {
    businessPlanId: "rental_development",
    overview: "New-construction MLI Select path where the development and operating program are designed to meet the target points tier.",
    underwritingMode: "stabilized_income",
    targetPropertyTypes: ["Vacant land", "Parking lot", "Redevelopment site", "Conversion site"],
    suitableAssetTypes: ["land", "parking", "single_family", "mixed_use"],
    strategyVariants: [
      { name: "MLI Select development", propertyTypes: ["Vacant land", "Assembly site"], description: "Use development scope and operating commitments to reach a qualifying MLI Select points tier." },
    ],
    modelBasis: [
      "Uses new-build rent, full development capitalization, and MLI scoring to determine leverage and amortization.",
      "Affordability, energy, and accessibility inputs all affect the takeout envelope.",
    ],
    executionPlan: ["Do not assume the MLI leverage until the scoring path is real and documented."],
    financingPlan: ["Construction financing plus MLI Select takeout, with tier-driven leverage and amortization."],
    keyRisks: ["If the project misses its target tier, the capital stack and DSCR can change materially."],
    rentBasis: "new_build",
    vacancyShift: 0,
    closingCostPct: 0.04,
    mortgageRate: 0.0475,
    amortizationYears: 50,
    ltvPct: 0.85,
    takeoutLtvPct: 0.95,
    bridgeAdvancePct: 0.8,
    bridgeRateAnnual: 0.0675,
    bridgeTermMonths: 24,
    bridgeFeePct: 0.01,
    bridgeInterestReserveMonths: 6,
    holdPeriodYears: 10,
    renoCostPerSqFt: 225,
    exitCapRate: 0.05,
    appreciationShift: 0,
    capitalPlanLabel: "Construction budget is included and MLI inputs determine the final takeout envelope.",
    programId: "mli_select_new_construction",
    stage: "new_construction",
    requiresBridgeLoan: true,
    bridgeUsage: "core",
    showStabilizedValue: true,
    futureUnits: "lot_size",
  },
  aclp_construction_stabilization: {
    businessPlanId: "rental_development",
    overview: "ACLP construction-through-stabilization path for purpose-built rental development.",
    underwritingMode: "stabilized_income",
    targetPropertyTypes: ["Vacant land", "Parking lot", "Redevelopment site", "Conversion site"],
    suitableAssetTypes: ["land", "parking", "single_family", "mixed_use"],
    strategyVariants: [
      { name: "ACLP direct execution", propertyTypes: ["Vacant land", "Assembly site"], description: "Use CMHC direct construction-through-stabilization capital on purpose-built rental." },
    ],
    modelBasis: [
      "Capital stack is sized on full project capitalization rather than just purchase price.",
      "Return bridge includes stabilization lift because created NOI must exceed total capitalization cost.",
    ],
    executionPlan: ["Treat draw timing, compliance, and stabilization milestones as hard underwriting assumptions."],
    financingPlan: ["High-leverage CMHC direct construction-through-stabilization financing."],
    keyRisks: ["Construction inflation and delayed stabilization can wipe out the modeled leverage advantage."],
    rentBasis: "new_build",
    vacancyShift: 0,
    closingCostPct: 0.035,
    mortgageRate: 0.0475,
    amortizationYears: 50,
    ltvPct: 0.95,
    takeoutLtvPct: 0.95,
    bridgeAdvancePct: 0.9,
    bridgeRateAnnual: 0.06,
    bridgeTermMonths: 24,
    bridgeFeePct: 0.01,
    bridgeInterestReserveMonths: 6,
    holdPeriodYears: 10,
    renoCostPerSqFt: 235,
    exitCapRate: 0.05,
    appreciationShift: 0,
    capitalPlanLabel: "Construction and conversion budget is capitalized into the underwriting basis.",
    programId: "aclp",
    stage: "new_construction",
    requiresBridgeLoan: true,
    bridgeUsage: "core",
    showStabilizedValue: true,
    futureUnits: "lot_size",
  },
  conventional_land_bridge_hold: {
    businessPlanId: "land_bank_covered_land",
    overview: "Land-bank or covered-land carry path focused on preserving optionality while minimizing carry drag.",
    underwritingMode: "covered_land",
    targetPropertyTypes: ["Vacant land", "Parking lot", "Assembly site", "Redevelopment parcel"],
    suitableAssetTypes: ["land", "parking", "single_family", "mixed_use"],
    strategyVariants: [
      { name: "Covered land hold", propertyTypes: ["Vacant land", "Parking lot", "Assembly site"], description: "Carry land or a low-density redevelopment basis while waiting for the next development catalyst." },
    ],
    modelBasis: [
      "Uses carry logic with heavily discounted or zero interim rent.",
      "Appreciation and future optionality dominate the return stack.",
    ],
    executionPlan: ["Treat interim income as downside mitigation rather than the primary thesis."],
    financingPlan: ["Conservative land or bridge-hold leverage sized to survive a longer entitlement clock."],
    keyRisks: ["Carry can compound for years before zoning or density value actually materializes."],
    rentBasis: "interim",
    vacancyShift: 0,
    closingCostPct: 0.025,
    mortgageRate: 0.06,
    amortizationYears: 25,
    ltvPct: 0.65,
    takeoutLtvPct: 0.65,
    bridgeAdvancePct: 0.6,
    bridgeRateAnnual: 0.08,
    bridgeTermMonths: 24,
    bridgeFeePct: 0.01,
    bridgeInterestReserveMonths: 6,
    holdPeriodYears: 5,
    renoCostPerSqFt: 0,
    exitCapRate: 0.06,
    appreciationShift: 0.01,
    capitalPlanLabel: "No vertical capex is assumed before the redevelopment event.",
    programId: "land_bridge_hold",
    requiresBridgeLoan: false,
    bridgeUsage: "optional",
  },
};
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function vacancyAssumption(
  baseVacancyRate: AssumptionValue<number>
): AssumptionValue<number> {
  return assume(
    clamp(baseVacancyRate.value, 0, 0.2),
    `${baseVacancyRate.label}. Calculation: using base CMHC market vacancy for this listing; turnover and lease-up friction should be modeled separately from market vacancy.`,
    baseVacancyRate.source
  );
}

function assume(value: number, label: string, source: AssumptionValue<number>["source"] = "assumed"): AssumptionValue<number> {
  return { value, label, source };
}

function modeledUnits(
  preset: StrategyPreset,
  profile: NormalizedProfileResult,
  lotSizeSqFt: number | null
): AssumptionValue<number> {
  if (preset.futureUnits === "lot_size") {
    const futureUnits = estimateFutureUnits(lotSizeSqFt, profile.normalizedUnits);
    return assume(futureUnits, lotSizeSqFt ? "Future units inferred from lot size." : "Future units assumed for redevelopment path.");
  }

  if (preset.underwritingMode === "covered_land" && (profile.normalizedAssetType === "land" || profile.normalizedAssetType === "parking")) {
    return assume(0, "No interim residential units assumed while land is held.");
  }

  return assume(profile.normalizedUnits, "Using listing unit count.", "actual");
}

function estimateFutureUnits(lotSizeSqFt: number | null, currentUnits: number): number {
  if (lotSizeSqFt != null) {
    if (lotSizeSqFt >= 20000) return 30;
    if (lotSizeSqFt >= 12000) return 20;
    if (lotSizeSqFt >= 7500) return 12;
    if (lotSizeSqFt >= 4000) return 8;
  }
  return Math.max(currentUnits, 8);
}

function estimateAreaSqFt(
  squareFeet: number | null,
  preset: StrategyPreset,
  modeledUnitCount: number
): number | null {
  if (squareFeet != null && squareFeet > 0) return squareFeet;
  if (preset.renoCostPerSqFt <= 0) return null;
  const perUnit =
    preset.futureUnits === "lot_size" ? 750 : preset.underwritingMode === "stabilized_income" ? 700 : 650;
  if (modeledUnitCount <= 0) return null;
  return modeledUnitCount * perUnit;
}

function modeledRent(
  preset: StrategyPreset,
  defaults: ScenarioAssumptions,
  profile: NormalizedProfileResult,
  unitRentBenchmarks: UnitRentBenchmark[]
): { rentAssumption: AssumptionValue<number>; unitRentSchedule: StrategyUnitRentLineItem[] } {
  const current = defaults.currentMarketRent.value;
  const turnover = defaults.turnoverMarketRent.value;
  const renovated = defaults.renovatedRentProxy.value;
  const improvementFloorValue = Math.max(turnover, renovated, 0);
  const modeledAverage =
    current > 0 && renovated > 0
      ? Math.round((current + renovated) / 2)
      : Math.round(Math.max(current, renovated, 0));

  if (
    preset.rentBasis === "interim" &&
    (profile.normalizedAssetType === "land" || profile.normalizedAssetType === "parking")
  ) {
    return {
      rentAssumption: assume(0, "No interim residential rent assumed on land-banking basis."),
      unitRentSchedule: [],
    };
  }

  const usesTurnoverMarketRent =
    preset.rentBasis === "current" || preset.rentBasis === "affordable" || preset.rentBasis === "interim";
  const usesTurnoverProxy = preset.rentBasis === "renovated" || preset.rentBasis === "new_build";

  if (unitRentBenchmarks.length > 0) {
    const unitRentSchedule = unitRentBenchmarks.map((unit) => {
      const modeledRent =
        usesTurnoverMarketRent
          ? unit.turnoverMarketRent
          : usesTurnoverProxy
            ? unit.renovatedRentProxy.value >= unit.turnoverMarketRent.value
              ? unit.renovatedRentProxy
              : assume(
                  unit.turnoverMarketRent.value,
                  `Higher of ${unit.turnoverMarketRent.label} and ${unit.renovatedRentProxy.label}; floor applied so improvement underwriting does not go below plain turnover rent.`,
                  unit.turnoverMarketRent.source
                )
            : unit.modeledMarketRent;

      return {
        unitNumber: unit.unitNumber,
        unitLabel: unit.unitLabel,
        bedrooms: unit.bedrooms,
        bedroomLabel: unit.bedroomLabel,
        currentMarketRent: unit.currentMarketRent,
        turnoverMarketRent: unit.turnoverMarketRent,
        renovatedRentProxy: unit.renovatedRentProxy,
        modeledRent: modeledRent,
      };
    });
    const averageModeledRent = Math.round(
      unitRentSchedule.reduce((sum, unit) => sum + unit.modeledRent.value, 0) / unitRentSchedule.length
    );

    const basisLabel = usesTurnoverMarketRent
      ? defaults.turnoverMarketRent.label
      : usesTurnoverProxy
        ? defaults.renovatedRentProxy.value >= defaults.turnoverMarketRent.value
          ? defaults.renovatedRentProxy.label
          : `Higher of ${defaults.turnoverMarketRent.label} and ${defaults.renovatedRentProxy.label}; floor applied so improvement underwriting does not go below plain turnover rent.`
        : `Average of ${defaults.currentMarketRent.label} and ${defaults.renovatedRentProxy.label}.`;

    return {
      rentAssumption: assume(
        averageModeledRent,
        basisLabel
      ),
      unitRentSchedule,
    };
  }

  const scalarLabel = usesTurnoverMarketRent
    ? defaults.turnoverMarketRent.label
    : usesTurnoverProxy
      ? defaults.renovatedRentProxy.value >= defaults.turnoverMarketRent.value
        ? defaults.renovatedRentProxy.label
        : `Higher of ${defaults.turnoverMarketRent.label} and ${defaults.renovatedRentProxy.label}; floor applied so improvement underwriting does not go below plain turnover rent.`
      : `Average of ${defaults.currentMarketRent.label} and ${defaults.renovatedRentProxy.label}.`;
  const scalarValue = usesTurnoverMarketRent ? turnover : usesTurnoverProxy ? improvementFloorValue : modeledAverage;

  return {
    rentAssumption: assume(
      scalarValue,
      scalarLabel,
    ),
    unitRentSchedule: [],
  };
}

function modeledRentsForMli(
  preset: StrategyPreset,
  stage: DealStage,
  rentModel: { rentAssumption: AssumptionValue<number>; unitRentSchedule: StrategyUnitRentLineItem[] },
  defaults: ScenarioAssumptions
): number[] {
  if (rentModel.unitRentSchedule.length > 0) {
    return rentModel.unitRentSchedule.map((unit) => {
      if (stage === "new_construction" || preset.rentBasis === "new_build") {
        return unit.renovatedRentProxy.value;
      }
      return unit.modeledRent.value;
    });
  }

  if (stage === "new_construction" || preset.rentBasis === "new_build") {
    return [defaults.renovatedRentProxy.value];
  }

  return [rentModel.rentAssumption.value];
}

function buildAssumptions(
  preset: StrategyPreset,
  defaults: ScenarioAssumptions,
  price: number,
  unitCount: number,
  avgMonthlyRentPerUnit: number,
  squareFeet: number | null,
  descriptionText: string | null,
  profile: NormalizedProfileResult,
  marketCity: string | null,
  province: string | null,
  ownerOccupied: boolean,
  stage: DealStage | undefined,
  programEnvelope: StrategyModel["programEnvelope"],
  mliSelectAnalysis: MliSelectScoreResult | null,
  projectUse: InvestorContext["projectUse"],
  operatingExpenseTemplate?: OperatingExpenseTemplate | null
): ScenarioAssumptions {
  const bridgeAssumptionsRelevant = preset.bridgeUsage !== "not_needed";
  const financingProgramId = resolveProgramId(preset.programId);
  const downPaymentRule = resolveMinimumDownPaymentRule(financingProgramId, {
    price,
    assetType: profile.normalizedAssetType,
    units: unitCount,
    ownerOccupiedPrimaryHome: ownerOccupied,
  });
  const amortization = clampAmortization(financingProgramId, preset.amortizationYears, stage, {
    mliTotalPoints: mliSelectAnalysis?.totalPoints,
    projectUse,
  });
  const vacancyRate = vacancyAssumption(defaults.vacancyRate);
  const defaultPropertyTaxEstimate =
    defaults.operatingExpenses.find((item) => item.key === "property_tax")?.propertyTaxEstimate ??
    resolvePropertyTaxEstimate({
      city: marketCity ?? profile.zoneLabel ?? "",
      province: province ?? "ON",
      marketCity,
      normalizedAssetType: profile.normalizedAssetType,
      normalizedUnits: unitCount,
      purchasePrice: price,
      residentialShareEstimated: profile.residentialShareEstimated,
    });
  const baselineEffectiveGrossIncome = effectiveGrossIncome(
    grossScheduledRent(unitCount, avgMonthlyRentPerUnit),
    vacancyRate.value
  );
  const baselineMode: OperatingExpenseBaselineMode =
    preset.underwritingMode === "covered_land"
      ? "covered_land"
      : stage === "new_construction"
        ? "new_construction"
        : "existing";
  const operatingExpenses = buildOperatingExpenseSchedule({
    effectiveGrossIncome: baselineEffectiveGrossIncome,
    purchasePrice: price,
    propertyTaxEstimate: defaultPropertyTaxEstimate,
    normalizedAssetType: profile.normalizedAssetType,
    unitCount,
    squareFeet,
    province,
    city: marketCity,
    propertyType: null,
    descriptionText,
    baselineMode,
    template: operatingExpenseTemplate ?? null,
  });

  return {
    vacancyRate,
    currentMarketRent: defaults.currentMarketRent,
    turnoverMarketRent: defaults.turnoverMarketRent,
    renovatedRentProxy: defaults.renovatedRentProxy,
    rentGrowthRateAnnual: defaults.rentGrowthRateAnnual,
    operatingExpenses,
    operatingExpenseRatio: deriveOperatingExpenseRatioAssumption(
      operatingExpenses,
      baselineEffectiveGrossIncome,
      price
    ),
    appreciationRateAnnual: assume(
      clamp(defaults.appreciationRateAnnual.value + preset.appreciationShift, 0, 0.15),
      preset.appreciationShift > 0
        ? "Appreciation premium applied for land optionality or redevelopment upside."
        : "City-level appreciation baseline."
    ),
    renoCostPerSqFt: assume(
      preset.renoCostPerSqFt,
      preset.capitalPlanLabel
    ),
    closingCostPct: assume(preset.closingCostPct, "Acquisition cost allowance from the spreadsheet-style basis."),
    exitCapRate: assume(preset.exitCapRate, "Exit cap used to translate stabilized NOI into value."),
    mortgageRate: assume(preset.mortgageRate, "Debt pricing assumption for the selected financing path."),
    amortizationYears: assume(amortization, "Amortization aligned to the financing path."),
    ltvPct: assume(
      Math.min(preset.ltvPct, programEnvelope.maxLeveragePct),
      `${downPaymentRule.label} Max ${programEnvelope.leverageMetric} = ${(programEnvelope.maxLeveragePct * 100).toFixed(1)}%; minimum down payment = ${(downPaymentRule.minDownPaymentPct * 100).toFixed(1)}% of purchase price proxy.`
    ),
    takeoutLtvPct: assume(
      Math.min(preset.takeoutLtvPct ?? preset.ltvPct, programEnvelope.maxLeveragePct),
      bridgeAssumptionsRelevant
        ? `Permanent refinance leverage assumption after stabilization. Max takeout ${programEnvelope.leverageMetric} = ${(programEnvelope.maxLeveragePct * 100).toFixed(1)}% under ${programEnvelope.note ?? "the selected financing path"}.`
        : defaults.takeoutLtvPct.label
    ),
    bridgeAdvancePct: assume(
      preset.bridgeAdvancePct ?? defaults.bridgeAdvancePct.value,
      bridgeAssumptionsRelevant
        ? "Bridge advance rate applied to purchase price plus capex basis."
        : defaults.bridgeAdvancePct.label
    ),
    bridgeRateAnnual: assume(
      preset.bridgeRateAnnual ?? defaults.bridgeRateAnnual.value,
      bridgeAssumptionsRelevant
        ? "Bridge coupon assumption used to size monthly carry and total bridge interest."
        : defaults.bridgeRateAnnual.label
    ),
    bridgeTermMonths: assume(
      preset.bridgeTermMonths ?? defaults.bridgeTermMonths.value,
      bridgeAssumptionsRelevant
        ? "Bridge term assumption for the short-duration acquisition-to-refinance window."
        : defaults.bridgeTermMonths.label
    ),
    bridgeFeePct: assume(
      preset.bridgeFeePct ?? defaults.bridgeFeePct.value,
      bridgeAssumptionsRelevant
        ? "Lender fee applied to the bridge principal advance."
        : defaults.bridgeFeePct.label
    ),
    bridgeInterestReserveMonths: assume(
      preset.bridgeInterestReserveMonths ?? defaults.bridgeInterestReserveMonths.value,
      bridgeAssumptionsRelevant
        ? "Months of bridge carry reserved up front inside the facility sizing."
        : defaults.bridgeInterestReserveMonths.label
    ),
    holdPeriodYears: assume(preset.holdPeriodYears, "Hold length used for compounded equity and ROI."),
  };
}

function buildCapitalPlan(
  preset: StrategyPreset,
  squareFeet: number | null,
  modeledUnitCount: number
): StrategyCapitalPlan {
  const targetAreaSqFt = estimateAreaSqFt(squareFeet, preset, modeledUnitCount);
  const budget =
    targetAreaSqFt != null && preset.renoCostPerSqFt > 0
      ? Math.round(targetAreaSqFt * preset.renoCostPerSqFt)
      : 0;

  return {
    budget,
    targetAreaSqFt,
    label: preset.capitalPlanLabel,
  };
}

function buildOne(input: StrategyModelInput): StrategyModel {
  const preset = PRESETS[input.strategyId];
  const stage = preset.stage ?? input.investorContext.dealStage;
  const ownerOccupied = preset.ownerOccupied ?? input.investorContext.willLiveThere;
  const unitAssumption = modeledUnits(preset, input.profile, input.lotSizeSqFt);
  const rentModel = modeledRent(preset, input.defaultAssumptions, input.profile, input.unitRentBenchmarks);
  const mliSelectAnalysis =
    preset.programId === "mli_select_existing" || preset.programId === "mli_select_new_construction"
      ? scoreMliSelect({
          marketCity: input.marketCity,
          province: input.province,
          stage: stage ?? "existing",
          projectUse: input.investorContext.projectUse,
          modeledRents: modeledRentsForMli(preset, stage ?? "existing", rentModel, input.defaultAssumptions),
          mliAffordabilityCommitmentYears: input.investorContext.mliAffordabilityCommitmentYears,
          mliEnergyPoints: input.investorContext.mliEnergyPoints,
          mliAccessibilityPoints: input.investorContext.mliAccessibilityPoints,
        })
      : null;
  const programEnvelope = getProgramEnvelope(resolveProgramId(preset.programId), {
    stage,
    mliTotalPoints: mliSelectAnalysis?.totalPoints,
    projectUse: input.investorContext.projectUse,
  });
  const assumptions = buildAssumptions(
    preset,
    input.defaultAssumptions,
    input.price,
    unitAssumption.value,
    rentModel.rentAssumption.value,
    input.squareFeet,
    input.descriptionText,
    input.profile,
    input.marketCity,
    input.province,
    ownerOccupied,
    stage,
    {
      maxLeveragePct: programEnvelope.maxLeveragePct,
      maxAmortizationYears: programEnvelope.maxAmortizationYears,
      leverageMetric: programEnvelope.leverageMetric,
      note: programEnvelope.notes ?? null,
    },
    mliSelectAnalysis,
    input.investorContext.projectUse,
    input.operatingExpenseTemplate
  );
  const capitalPlan = buildCapitalPlan(preset, input.squareFeet, unitAssumption.value);
  const financeOperatingExpenses = toFinanceOperatingExpenseItems(assumptions.operatingExpenses);
  const permanentLtv = preset.requiresBridgeLoan
    ? assumptions.takeoutLtvPct.value
    : assumptions.ltvPct.value;

  const result = computeBuyAndHold({
    price: input.price,
    units: unitAssumption.value,
    avgMonthlyRentPerUnit: rentModel.rentAssumption.value,
    vacancyRate: assumptions.vacancyRate.value,
    operatingExpenseItems: financeOperatingExpenses,
    mortgageRate: assumptions.mortgageRate.value,
    amortizationYears: assumptions.amortizationYears.value,
    ltvPct: permanentLtv,
    closingCostPct: assumptions.closingCostPct.value,
    capitalBudget: capitalPlan.budget,
  });
  const bridgeFacility =
    preset.requiresBridgeLoan
      ? computeBridgeFacility({
          purchasePrice: input.price,
          closingCosts: result.closingCosts,
          capitalBudget: capitalPlan.budget,
          bridgePrincipalAdvance: (input.price + capitalPlan.budget) * assumptions.bridgeAdvancePct.value,
          takeoutProceeds: result.loanAmount,
          bridgeRateAnnual: assumptions.bridgeRateAnnual.value,
          bridgeTermMonths: assumptions.bridgeTermMonths.value,
          bridgeFeePct: assumptions.bridgeFeePct.value,
          bridgeInterestReserveMonths: assumptions.bridgeInterestReserveMonths.value,
        })
      : null;
  const cashflowProjection = computeCashflowProjection({
    financeInputs: {
      price: input.price,
      units: unitAssumption.value,
      avgMonthlyRentPerUnit: rentModel.rentAssumption.value,
      vacancyRate: assumptions.vacancyRate.value,
      operatingExpenseItems: financeOperatingExpenses,
      mortgageRate: assumptions.mortgageRate.value,
      amortizationYears: assumptions.amortizationYears.value,
      ltvPct: permanentLtv,
      closingCostPct: assumptions.closingCostPct.value,
      capitalBudget: capitalPlan.budget,
    },
    holdPeriodYears: assumptions.holdPeriodYears.value,
    rentGrowthRateAnnual: assumptions.rentGrowthRateAnnual.value,
    bridge:
      preset.requiresBridgeLoan && bridgeFacility
        ? {
            enabled: true,
            bridgeMonthlyCarry: bridgeFacility.monthlyInterestCarry,
            bridgeTermMonths: assumptions.bridgeTermMonths.value,
            takeoutLoanAmount: result.loanAmount,
            takeoutMortgageRate: assumptions.mortgageRate.value,
            takeoutAmortizationYears: assumptions.amortizationYears.value,
          }
        : null,
  });

  const derivedExitCapRate =
    input.price > 0 && result.noi > 0 ? result.noi / input.price : assumptions.exitCapRate.value;
  const derivedExitCapAssumption = {
    value: derivedExitCapRate,
    source: "assumed" as const,
    label:
      input.price > 0 && result.noi > 0
        ? `Source: Derived from modeled stabilized NOI and purchase price proxy. Calculation: ${result.noi.toLocaleString("en-CA", {
            style: "currency",
            currency: "CAD",
            maximumFractionDigits: 0,
          })} / ${input.price.toLocaleString("en-CA", {
            style: "currency",
            currency: "CAD",
            maximumFractionDigits: 0,
          })} = ${(derivedExitCapRate * 100).toFixed(2)}%.`
        : "Source: Derived from modeled stabilized NOI and purchase price proxy. Calculation: not available because price or NOI is zero.",
  };

  const strategyStabilizedValue =
    preset.showStabilizedValue && result.noi > 0
      ? input.price
      : null;
  const stabilizationLift =
    strategyStabilizedValue != null
      ? Math.max(0, strategyStabilizedValue - result.basisPrice)
      : null;
  const yearOneProjection = cashflowProjection.years[0];
  const exitProjection = cashflowProjection.years[cashflowProjection.years.length - 1];
  const returnBridge = computeReturnBridge({
    result,
    price: input.price,
    appreciationRateAnnual: assumptions.appreciationRateAnnual.value,
    mortgageRate: assumptions.mortgageRate.value,
    amortizationYears: assumptions.amortizationYears.value,
    holdPeriodYears: assumptions.holdPeriodYears.value,
    yearOneCashflowOverride: yearOneProjection?.annualCashflow,
    yearOneDebtPaydownOverride: yearOneProjection?.principalPaidYear,
    exitLoanBalanceOverride: exitProjection?.loanBalanceEnd,
    holdPeriodCashflow: cashflowProjection.totalCashflow,
    stabilizationLift,
    projectionStartValue: strategyStabilizedValue ?? result.basisPrice,
  });

  return {
    strategyId: input.strategyId,
    businessPlanId: preset.businessPlanId,
    programId: resolveProgramId(preset.programId),
    requiresBridgeLoan: preset.requiresBridgeLoan ?? false,
    bridgeUsage: preset.bridgeUsage,
    ownerOccupied,
    stage,
    assetType: input.profile.normalizedAssetType,
    overview: preset.overview,
    underwritingMode: preset.underwritingMode,
    targetPropertyTypes: preset.targetPropertyTypes,
    suitableAssetTypes: preset.suitableAssetTypes,
    strategyVariants: preset.strategyVariants,
    modelBasis: preset.modelBasis,
    executionPlan: preset.executionPlan,
    financingPlan: preset.financingPlan,
    keyRisks: preset.keyRisks,
    assumptions: {
      ...assumptions,
      exitCapRate: derivedExitCapAssumption,
    },
    modeledUnits: unitAssumption,
    modeledRentPerUnit: rentModel.rentAssumption,
    unitRentSchedule: rentModel.unitRentSchedule,
    modeledRentBasis: preset.rentBasis,
    modeledRentBasisLabel: rentModel.rentAssumption.label,
    capitalPlan,
    result,
    stabilizedValue: strategyStabilizedValue,
    bridgeFacility,
    returnBridge,
    programEnvelope: {
      maxLeveragePct: programEnvelope.maxLeveragePct,
      maxAmortizationYears: programEnvelope.maxAmortizationYears,
      leverageMetric: programEnvelope.leverageMetric,
      note: programEnvelope.notes ?? null,
    },
    mliSelectAnalysis,
  };
}

export function buildStrategyModels(
  input: Omit<StrategyModelInput, "strategyId">
): Record<StrategyId, StrategyModel> {
  return SCENARIO_ORDER.reduce((acc, strategyId) => {
    acc[strategyId] = buildOne({ ...input, strategyId });
    return acc;
  }, {} as Record<StrategyId, StrategyModel>);
}
