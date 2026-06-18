import assert from "node:assert/strict";
import test from "node:test";
import { buildOperatingExpenseSchedule } from "../src/lib/operating-expenses";
import { resolvePropertyTaxEstimate } from "../src/lib/property-tax";
import { buildStrategyModels } from "../src/lib/strategy-modeling";
import type {
  AssumptionSource,
  AssumptionValue,
  InvestorContext,
  ScenarioAssumptions,
  UnitRentBenchmark,
} from "../src/types/listing";
import type { NormalizedProfileResult } from "../src/lib/normalized-profile";

function assumption(value: number, label = "Test assumption", source: AssumptionSource = "assumed"): AssumptionValue<number> {
  return { value, label, source };
}

function baseScenarioAssumptions(): ScenarioAssumptions {
  return {
    vacancyRate: assumption(0.03),
    currentMarketRent: assumption(1_200, "Current market rent"),
    turnoverMarketRent: assumption(1_650, "Turnover market rent"),
    renovatedRentProxy: assumption(1_850, "Renovated rent proxy"),
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

const fiveUnitProfile: NormalizedProfileResult = {
  normalizedAssetType: "apartment",
  normalizedUnits: 5,
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

const investorContext: InvestorContext = {
  firstPropertyBuyer: false,
  willLiveThere: false,
  preferredAssetBand: "five_plus_units",
  dealStage: "existing",
  plansRenovations: false,
  projectUse: "standard_rental",
  residentialSharePct: 1,
  mliAffordabilityCommitmentYears: 0,
  mliEnergyPoints: 0,
  mliAccessibilityPoints: 0,
};

function unitRent(unitNumber: number, currentRent: number, turnoverRent: number): UnitRentBenchmark {
  return {
    unitNumber,
    unitLabel: `Unit ${unitNumber}`,
    bedrooms: 2,
    bedroomLabel: "2 BR",
    currentMarketRent: assumption(currentRent, `Unit ${unitNumber} current rent`, "actual"),
    turnoverMarketRent: assumption(turnoverRent, `Unit ${unitNumber} turnover rent`, "market_benchmark"),
    renovatedRentProxy: assumption(turnoverRent + 300, `Unit ${unitNumber} renovated rent`, "market_benchmark"),
    modeledMarketRent: assumption(Math.round((currentRent + turnoverRent + 300) / 2), `Unit ${unitNumber} blended rent`, "market_benchmark"),
  };
}

test("operating expense schedule defaults management fee to zero", () => {
  const propertyTaxEstimate = resolvePropertyTaxEstimate({
    city: "Montreal",
    province: "QC",
    marketCity: "Montreal",
    normalizedAssetType: "apartment",
    normalizedUnits: 5,
    purchasePrice: 1_000_000,
    residentialShareEstimated: 1,
  });

  const schedule = buildOperatingExpenseSchedule({
    effectiveGrossIncome: 72_000,
    purchasePrice: 1_000_000,
    propertyTaxEstimate,
    normalizedAssetType: "apartment",
    unitCount: 5,
    squareFeet: null,
    province: "QC",
    city: "Montreal",
    propertyType: "Multi-Family",
    descriptionText: null,
    baselineMode: "existing",
  });

  const managementLine = schedule.find((item) => item.key === "management");
  assert.ok(managementLine);
  assert.equal(managementLine.rate.value, 0);
  assert.equal(managementLine.amountAnnual.value, 0);
  assert.match(managementLine.amountAnnual.label, /No professional management fee is included by default/);
});

test("source annual property tax uses municipal plus school tax directly", () => {
  const propertyTaxEstimate = resolvePropertyTaxEstimate({
    city: "Montreal",
    province: "QC",
    marketCity: "Montreal",
    normalizedAssetType: "apartment",
    normalizedUnits: 5,
    purchasePrice: 1_100_000,
    residentialShareEstimated: 1,
    exactAnnualTax: 9_850,
    exactAnnualTaxYear: 2025,
    exactAnnualTaxSourceLabel: "Centris municipal and school taxes",
    exactAnnualTaxSourceSummary: "Centris municipal plus school tax captured from the listing (2025)",
    exactAnnualTaxFormulaSummary:
      "Annual municipal + school tax = municipal taxes $8,900 + school taxes $950 = $9,850 per year",
    assessedValue: null,
  });

  assert.equal(propertyTaxEstimate.method, "exact_bill");
  assert.equal(propertyTaxEstimate.amountAnnual, 9_850);
  assert.equal(propertyTaxEstimate.assessedValue, null);
  assert.equal(propertyTaxEstimate.assessedValueSource, "not_available");
  assert.match(propertyTaxEstimate.sourceSummary, /municipal plus school tax/);
  assert.match(propertyTaxEstimate.formulaSummary, /Annual municipal \+ school tax/);
});

test("current-income strategy projections use current unit rents", () => {
  const unitRentBenchmarks = [
    unitRent(1, 1_000, 1_800),
    unitRent(2, 1_100, 1_850),
    unitRent(3, 1_200, 1_900),
    unitRent(4, 1_300, 1_950),
    unitRent(5, 1_400, 2_000),
  ];

  const models = buildStrategyModels({
    price: 1_200_000,
    squareFeet: null,
    lotSizeSqFt: null,
    descriptionText: null,
    defaultAssumptions: baseScenarioAssumptions(),
    profile: fiveUnitProfile,
    unitRentBenchmarks,
    marketCity: "Montreal",
    province: "QC",
    investorContext,
  });

  const model = models.personal_plex_lender_exception;
  assert.equal(model.modeledRentPerUnit.value, 1_200);
  assert.equal(model.unitRentSchedule[0]?.modeledRent.value, 1_000);
  assert.equal(model.unitRentSchedule[4]?.modeledRent.value, 1_400);
  assert.equal(model.result.grossScheduledRent, 72_000);
  assert.equal(model.cashflowProjection.years[0]?.grossScheduledRent, 72_000);
});
