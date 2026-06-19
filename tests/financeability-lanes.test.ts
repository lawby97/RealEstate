import assert from "node:assert/strict";
import test from "node:test";
import { buildFinanceabilityLaneSummary } from "../src/lib/financeability-lanes";
import { buildInvestmentWorkspace } from "../src/lib/investment-workspace";
import type { NormalizedProfileResult } from "../src/lib/normalized-profile";
import type {
  AssumptionSource,
  AssumptionValue,
  InvestorContext,
  NormalizedAssetType,
  ScenarioAssumptions,
  UnitRentBenchmark,
} from "../src/types/listing";

function assumption(value: number, label = "Test assumption", source: AssumptionSource = "assumed"): AssumptionValue<number> {
  return { value, label, source };
}

function baseAssumptions(): ScenarioAssumptions {
  return {
    vacancyRate: assumption(0.03),
    currentMarketRent: assumption(1_300, "Current market rent"),
    turnoverMarketRent: assumption(1_700, "Turnover market rent"),
    renovatedRentProxy: assumption(1_950, "Renovated rent proxy"),
    rentGrowthRateAnnual: assumption(0.03),
    operatingExpenses: [],
    operatingExpenseRatio: assumption(0),
    appreciationRateAnnual: assumption(0.03),
    renoCostPerSqFt: assumption(0),
    closingCostPct: assumption(0.02),
    exitCapRate: assumption(0.055),
    mortgageRate: assumption(0.0495),
    amortizationYears: assumption(30),
    ltvPct: assumption(0.8),
    takeoutLtvPct: assumption(0.8),
    bridgeAdvancePct: assumption(0.75),
    bridgeRateAnnual: assumption(0.0695),
    bridgeTermMonths: assumption(12),
    bridgeFeePct: assumption(0.01),
    bridgeInterestReserveMonths: assumption(6),
    holdPeriodYears: assumption(5),
  };
}

function baseInvestorContext(overrides: Partial<InvestorContext> = {}): InvestorContext {
  return {
    firstPropertyBuyer: false,
    willLiveThere: false,
    preferredAssetBand: "flexible",
    dealStage: "existing",
    plansRenovations: false,
    projectUse: "standard_rental",
    residentialSharePct: 100,
    mliAffordabilityCommitmentYears: 0,
    mliEnergyPoints: 0,
    mliAccessibilityPoints: 0,
    ...overrides,
  };
}

function profile(units: number, assetType: NormalizedAssetType): NormalizedProfileResult {
  return {
    normalizedAssetType: assetType,
    normalizedUnits: units,
    assetTypeConfidence: "high",
    unitsConfidence: "high",
    residentialUseCategory: "residential",
    residentialShareEstimated: 1,
    redevelopmentCandidate: false,
    strategyEligibilityFlags: {},
    normalizationNotes: null,
    reviewStatus: "auto",
    provenanceByField: {
      normalizedAssetType: "source",
      normalizedUnits: "source",
    },
    zoneLabel: "Montreal",
    zoneMatchMethod: "fallback_city",
    zoneMatchConfidence: 0.6,
    hasInferredFields: false,
  };
}

function unitRent(unitNumber: number): UnitRentBenchmark {
  return {
    unitNumber,
    unitLabel: `Unit ${unitNumber}`,
    bedrooms: 2,
    bedroomLabel: "2 BR",
    currentMarketRent: assumption(1_250 + unitNumber * 25, `Unit ${unitNumber} current rent`, "actual"),
    turnoverMarketRent: assumption(1_650 + unitNumber * 25, `Unit ${unitNumber} turnover rent`, "market_benchmark"),
    renovatedRentProxy: assumption(1_900 + unitNumber * 25, `Unit ${unitNumber} renovated rent`, "market_benchmark"),
    modeledMarketRent: assumption(1_500 + unitNumber * 25, `Unit ${unitNumber} modeled rent`, "market_benchmark"),
  };
}

function workspaceFor({
  units,
  assetType,
  investorContext = {},
}: {
  units: number;
  assetType: NormalizedAssetType;
  investorContext?: Partial<InvestorContext>;
}) {
  return buildInvestmentWorkspace({
    price: units <= 4 ? 850_000 : units <= 8 ? 1_350_000 : 2_400_000,
    squareFeet: null,
    lotSizeSqFt: null,
    descriptionText: null,
    defaultAssumptions: baseAssumptions(),
    profile: profile(units, assetType),
    unitRentBenchmarks: Array.from({ length: units }, (_, index) => unitRent(index + 1)),
    marketCity: "Montreal",
    province: "QC",
    investorContext: baseInvestorContext(investorContext),
  });
}

test("classifies 1-4 unit owner-occupied/conventional/CMHC income lanes", () => {
  const summary = buildFinanceabilityLaneSummary(
    workspaceFor({
      units: 4,
      assetType: "fourplex",
      investorContext: { willLiveThere: false, preferredAssetBand: "one_to_four_units" },
    })
  );

  assert.equal(summary.unitBand, "one_to_four");
  assert.equal(summary.recommendedLane?.id, "conventional_investor_1_4");
  assert.equal(summary.eligibleLanes.some((lane) => lane.id === "cmhc_income_property_2_4"), true);
  assert.equal(summary.blockedLanes.some((lane) => lane.id === "personal_plex_exception_5_8"), true);
  assert.equal(summary.topMetrics?.units, 4);
  assert.equal(typeof summary.topMetrics?.dscr, "number");
});

test("classifies 5-8 plex personal exception as verify with written confirmation", () => {
  const summary = buildFinanceabilityLaneSummary(
    workspaceFor({
      units: 6,
      assetType: "apartment",
      investorContext: { preferredAssetBand: "five_plus_units" },
    })
  );

  assert.equal(summary.unitBand, "five_to_eight");
  assert.equal(summary.recommendedLane?.id, "personal_plex_exception_5_8");
  assert.equal(summary.recommendedLane?.status, "verify");
  assert.equal(summary.recommendedLane?.verdict, "recommended");
  assert.equal(summary.eligibleLanes.some((lane) => lane.id === "conventional_multifamily_5_plus"), true);
  assert.equal(
    summary.manualVerificationItems.some((item) => item.id === "written_personal_lender_exception"),
    true
  );
  assert.equal(
    summary.policyWarnings.some((warning) => warning.id === "personal_exception_not_guaranteed"),
    true
  );
});

test("classifies 9+ buildings into commercial and CMHC-style lanes without personal exception", () => {
  const summary = buildFinanceabilityLaneSummary(
    workspaceFor({
      units: 12,
      assetType: "apartment",
      investorContext: { preferredAssetBand: "five_plus_units" },
    })
  );

  assert.equal(summary.unitBand, "nine_plus");
  assert.equal(summary.recommendedLane?.id, "commercial_cmhc_style_9_plus");
  assert.equal(summary.recommendedLane?.status, "verify");
  assert.equal(summary.blockedLanes.some((lane) => lane.id === "personal_plex_exception_5_8"), true);
  assert.equal(summary.eligibleLanes.some((lane) => lane.id === "cmhc_standard_rental_5_plus"), true);
  assert.equal(summary.eligibleLanes.some((lane) => lane.id === "mli_select_5_plus"), true);
  assert.equal(
    summary.policyWarnings.some((warning) => warning.id === "nine_plus_commercial_boundary"),
    true
  );
});

test("mixed-use CMHC-style lanes surface residential share verification", () => {
  const workspace = workspaceFor({
    units: 8,
    assetType: "mixed_use",
    investorContext: { preferredAssetBand: "five_plus_units", residentialSharePct: null },
  });
  workspace.input.profile.residentialUseCategory = "mixed_use";
  workspace.input.profile.residentialShareEstimated = null;

  const summary = buildFinanceabilityLaneSummary(workspace);

  assert.equal(summary.unitBand, "five_to_eight");
  assert.equal(summary.manualVerificationItems.some((item) => item.id === "residential_share"), true);
  assert.equal(
    summary.policyWarnings.some((warning) => warning.id === "mixed_use_residential_share"),
    true
  );
});
