import type { Listing } from "@prisma/client";
import { deriveNormalizedProfile } from "@/lib/normalized-profile";
import { buildMarketBenchmarkProfile } from "@/lib/market-benchmark";
import { parseUnitBedroomMix } from "@/lib/quebec-unit-mix";
import { buildOperatingExpenseSchedule, deriveOperatingExpenseRatioAssumption } from "@/lib/operating-expenses";
import { resolvePropertyTaxEstimate } from "@/lib/property-tax";
import { effectiveGrossIncome, grossScheduledRent } from "@/lib/finance";
import type { MarketBenchmarkProfile, OperatingExpenseTemplate, ScenarioAssumptions, AssumptionSource, AssumptionValue } from "@/types/listing";

export interface ListingUnderwritingSnapshot {
  profile: ReturnType<typeof deriveNormalizedProfile>;
  marketBenchmark: MarketBenchmarkProfile;
  defaultAssumptions: ScenarioAssumptions;
  dataConfidence: "high" | "medium" | "low";
  missingInputsNote: string | null;
}

function toAssumptionValue<T>(
  value: T,
  source: AssumptionSource,
  label: string
): AssumptionValue<T> {
  return { value, source, label };
}

export async function buildListingUnderwritingSnapshot(
  listing: Listing,
  options?: { appreciationRateAnnual?: number | null; operatingExpenseTemplate?: OperatingExpenseTemplate | null }
): Promise<ListingUnderwritingSnapshot> {
  const profile = deriveNormalizedProfile(listing);
  const parsedBedroomMix = parseUnitBedroomMix(
    [listing.description, listing.rawJson].filter(Boolean).join(" "),
    listing.units ?? 1
  );

  const marketBenchmark = await buildMarketBenchmarkProfile({
    city: listing.city,
    province: listing.province,
    postalCode: listing.postalCode,
    normalizedAssetType: profile.normalizedAssetType,
    normalizedUnits: profile.normalizedUnits,
    bedrooms: listing.bedrooms,
    parsedBedroomMix,
    yearBuilt: listing.yearBuilt,
    squareFeet: listing.squareFeet,
  });

  const appreciationRate = options?.appreciationRateAnnual ?? 0.04;
  const propertyTaxEstimate = resolvePropertyTaxEstimate({
    city: listing.city,
    province: listing.province,
    postalCode: listing.postalCode,
    marketCity: marketBenchmark.mappedMarketCity,
    normalizedAssetType: profile.normalizedAssetType,
    normalizedUnits: profile.normalizedUnits,
    purchasePrice: listing.price,
    residentialShareEstimated: profile.residentialShareEstimated,
  });
  const defaultCurrentMarketRent = marketBenchmark.benchmarkCurrentRent ?? 1500;
  const defaultVacancyRate = marketBenchmark.benchmarkVacancyRate ?? 0.03;
  const baselineEffectiveGrossIncome = effectiveGrossIncome(
    grossScheduledRent(Math.max(profile.normalizedUnits, 0), defaultCurrentMarketRent),
    defaultVacancyRate
  );
  const defaultOperatingExpenses = buildOperatingExpenseSchedule({
    effectiveGrossIncome: baselineEffectiveGrossIncome,
    purchasePrice: listing.price,
    propertyTaxEstimate,
    normalizedAssetType: profile.normalizedAssetType,
    unitCount: profile.normalizedUnits,
    squareFeet: listing.squareFeet,
    province: listing.province,
    city: listing.city,
    propertyType: listing.propertyType,
    descriptionText: [listing.description, listing.rawJson].filter(Boolean).join(" "),
    baselineMode: "existing",
    template: options?.operatingExpenseTemplate ?? null,
  });

  const defaultAssumptions: ScenarioAssumptions = {
    vacancyRate: toAssumptionValue(
      defaultVacancyRate,
      marketBenchmark.benchmarkVacancyProvenance,
      marketBenchmark.benchmarkVacancyLabel
    ),
    currentMarketRent: toAssumptionValue(
      defaultCurrentMarketRent,
      marketBenchmark.benchmarkCurrentRentProvenance,
      marketBenchmark.benchmarkCurrentRentLabel
    ),
    turnoverMarketRent: toAssumptionValue(
      marketBenchmark.benchmarkTurnoverRent ?? marketBenchmark.benchmarkCurrentRent ?? 1500,
      marketBenchmark.benchmarkTurnoverRentProvenance,
      marketBenchmark.benchmarkTurnoverRentLabel
    ),
    renovatedRentProxy: toAssumptionValue(
      marketBenchmark.benchmarkRenovatedRentProxy ?? 1680,
      marketBenchmark.benchmarkRenovatedRentProvenance,
      marketBenchmark.benchmarkRenovatedRentLabel
    ),
    rentGrowthRateAnnual: toAssumptionValue(
      marketBenchmark.benchmarkRentGrowthRateAnnual ?? 0.04,
      marketBenchmark.benchmarkRentGrowthProvenance,
      marketBenchmark.benchmarkRentGrowthLabel
    ),
    operatingExpenses: defaultOperatingExpenses,
    operatingExpenseRatio: deriveOperatingExpenseRatioAssumption(
      defaultOperatingExpenses,
      baselineEffectiveGrossIncome,
      listing.price
    ),
    appreciationRateAnnual: toAssumptionValue(
      appreciationRate,
      "market_benchmark",
      options?.appreciationRateAnnual != null ? "City-level from area" : "Default fallback"
    ),
    renoCostPerSqFt: toAssumptionValue(50, "assumed", "Default $/sq ft"),
    closingCostPct: toAssumptionValue(0.02, "assumed", "2%"),
    exitCapRate: toAssumptionValue(0.055, "assumed", "5.5%"),
    mortgageRate: toAssumptionValue(0.055, "assumed", "5.5%"),
    amortizationYears: toAssumptionValue(30, "assumed", "30 years"),
    ltvPct: toAssumptionValue(0.75, "assumed", "75% LTV"),
    takeoutLtvPct: toAssumptionValue(0.75, "assumed", "75% takeout LTV default"),
    bridgeAdvancePct: toAssumptionValue(0.75, "assumed", "75% bridge advance default"),
    bridgeRateAnnual: toAssumptionValue(0.075, "assumed", "7.5% bridge rate default"),
    bridgeTermMonths: toAssumptionValue(12, "assumed", "12-month bridge term default"),
    bridgeFeePct: toAssumptionValue(0.01, "assumed", "1.0% bridge lender fee default"),
    bridgeInterestReserveMonths: toAssumptionValue(6, "assumed", "6 months of interest reserve default"),
    holdPeriodYears: toAssumptionValue(5, "assumed", "5-year base hold"),
  };

  const dataConfidence: "high" | "medium" | "low" =
    profile.assetTypeConfidence === "high" && profile.unitsConfidence === "high" && marketBenchmark.mappedZone
      ? "high"
      : profile.assetTypeConfidence === "low" || profile.unitsConfidence === "low"
        ? "low"
        : "medium";

  let missingInputsNote: string | null = null;
  if (!listing.bedrooms && !parsedBedroomMix && profile.normalizedUnits > 1) {
    missingInputsNote = "Bedroom mix unknown; using total rent benchmark.";
  }
  if (parsedBedroomMix && profile.normalizedUnits > 1) {
    missingInputsNote = `Bedroom mix inferred from listing unit-mix text (${parsedBedroomMix.label}); benchmark basis uses ~${parsedBedroomMix.avgBedroomsPerUnit.toFixed(1)} bed/unit.`;
  }
  if (!listing.yearBuilt) {
    missingInputsNote = (missingInputsNote ? `${missingInputsNote} ` : "") + "Year built unknown; zone-level benchmarks used.";
  }
  if (!listing.squareFeet && profile.normalizedAssetType !== "land" && profile.normalizedAssetType !== "parking") {
    missingInputsNote = (missingInputsNote ? `${missingInputsNote} ` : "") + "Square footage missing; reno budget is manual or per-sq-ft default.";
  }

  return {
    profile,
    marketBenchmark,
    defaultAssumptions,
    dataConfidence,
    missingInputsNote,
  };
}
