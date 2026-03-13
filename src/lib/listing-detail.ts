/**
 * Build full listing detail payload: listing facts, normalized profile, market benchmark,
 * and default assumptions used to seed the investment workspace.
 */

import { prisma } from "@/lib/prisma";
import { buildListingUnderwritingSnapshot } from "@/lib/listing-underwriting";
import type {
  BridgeUsage,
  MarketBenchmarkProfile,
  OperatingExpenseTemplate,
  ProvenanceCounts,
  ScenarioAssumptions,
  StrategyApplicabilityStatus,
  StrategyId,
} from "@/types/listing";
import type { NormalizedProfileResult } from "@/lib/normalized-profile";

export interface ListingDetailPayload {
  listing: {
    id: string;
    externalId: string;
    address: string;
    city: string;
    province: string;
    postalCode: string | null;
    price: number;
    currency: string;
    propertyType: string;
    units: number;
    bedrooms: number | null;
    bathrooms: number | null;
    squareFeet: number | null;
    lotSizeSqFt: number | null;
    yearBuilt: number | null;
    source: string;
    listingUrl: string | null;
    photoUrls: string | null;
    description: string | null;
  };
  area: { appreciationRateAnnual: number; city: string; province: string } | null;
  evaluation: {
    cashflowScore: number;
    equityGrowthScore: number;
    combinedScore: number;
    cashflowNotes: string | null;
    equityNotes: string | null;
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
    quickVerdict: string | null;
    carryScore: number | null;
    executionScore: number | null;
    upsideScore: number | null;
    confidenceScore: number | null;
  } | null;
  profile: NormalizedProfileResult;
  marketBenchmark: MarketBenchmarkProfile;
  provenanceCounts: ProvenanceCounts;
  defaultAssumptions: ScenarioAssumptions;
  dataConfidence: "high" | "medium" | "low";
  missingInputsNote: string | null;
}


export async function getListingDetailPayload(
  listingId: string,
  options?: { operatingExpenseTemplate?: OperatingExpenseTemplate | null }
): Promise<ListingDetailPayload | null> {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: { evaluation: true, area: true },
  });
  if (!listing) return null;

  const {
    profile,
    marketBenchmark,
    defaultAssumptions,
    dataConfidence,
    missingInputsNote,
  } = await buildListingUnderwritingSnapshot(listing, {
    appreciationRateAnnual: listing.area?.appreciationRateAnnual ?? null,
    operatingExpenseTemplate: options?.operatingExpenseTemplate ?? null,
  });

  let sourceCount = 0;
  let inferredCount = 0;
  let marketBenchmarkCount = 4;
  let assumedCount = 0;
  const prov = profile.provenanceByField;
  if (prov.normalizedAssetType === "source") sourceCount += 1;
  else if (prov.normalizedAssetType === "inferred") inferredCount += 1;
  if (prov.normalizedUnits === "source") sourceCount += 1;
  else if (prov.normalizedUnits === "inferred") inferredCount += 1;
  if (marketBenchmark.benchmarkVacancyProvenance !== "market_benchmark") assumedCount += 1;
  if (marketBenchmark.benchmarkCurrentRentProvenance !== "market_benchmark") assumedCount += 1;
  if (marketBenchmark.benchmarkRenovatedRentProvenance !== "market_benchmark") assumedCount += 1;
  if (marketBenchmark.benchmarkRentGrowthProvenance !== "market_benchmark") assumedCount += 1;
  assumedCount += 14;

  const provenanceCounts: ProvenanceCounts = {
    source: sourceCount + 8,
    inferred: inferredCount,
    marketBenchmark: marketBenchmarkCount,
    assumed: assumedCount,
    userOverride: 0,
  };

  return {
    listing: {
      id: listing.id,
      externalId: listing.externalId,
      address: listing.address,
      city: listing.city,
      province: listing.province,
      postalCode: listing.postalCode,
      price: listing.price,
      currency: listing.currency,
      propertyType: listing.propertyType,
      units: listing.units,
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathrooms,
      squareFeet: listing.squareFeet,
      lotSizeSqFt: listing.lotSizeSqFt,
      yearBuilt: listing.yearBuilt,
      source: listing.source,
      listingUrl: listing.listingUrl,
      photoUrls: listing.photoUrls,
      description: listing.description,
    },
    area: listing.area
      ? {
          appreciationRateAnnual: listing.area.appreciationRateAnnual,
          city: listing.area.city,
          province: listing.area.province,
        }
      : null,
    evaluation: listing.evaluation
      ? {
          cashflowScore: listing.evaluation.cashflowScore,
          equityGrowthScore: listing.evaluation.equityGrowthScore,
          combinedScore: listing.evaluation.combinedScore,
          cashflowNotes: listing.evaluation.cashflowNotes,
          equityNotes: listing.evaluation.equityNotes,
          primaryScenarioId: listing.evaluation.primaryScenarioId as StrategyId | null,
          primaryScenarioStatus: listing.evaluation.primaryScenarioStatus as StrategyApplicabilityStatus | null,
          primaryBridgeUsage: listing.evaluation.primaryBridgeUsage as BridgeUsage | null,
          primaryAnnualCashflow: listing.evaluation.primaryAnnualCashflow,
          primaryMonthlyCashflow: listing.evaluation.primaryMonthlyCashflow,
          primaryDscr: listing.evaluation.primaryDscr,
          primaryCashOnCashReturn: listing.evaluation.primaryCashOnCashReturn,
          baseHoldScenarioId: listing.evaluation.baseHoldScenarioId as StrategyId | null,
          baseHoldAnnualCashflow: listing.evaluation.baseHoldAnnualCashflow,
          baseHoldMonthlyCashflow: listing.evaluation.baseHoldMonthlyCashflow,
          quickVerdict: listing.evaluation.quickVerdict,
          carryScore: listing.evaluation.carryScore,
          executionScore: listing.evaluation.executionScore,
          upsideScore: listing.evaluation.upsideScore,
          confidenceScore: listing.evaluation.confidenceScore,
        }
      : null,
    profile,
    marketBenchmark,
    provenanceCounts,
    defaultAssumptions,
    dataConfidence,
    missingInputsNote,
  };
}
