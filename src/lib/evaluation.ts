import { prisma } from "@/lib/prisma";
import { buildInvestorContextDefaults } from "@/lib/investor-context";
import { buildInvestmentWorkspace } from "@/lib/investment-workspace";
import { buildListingUnderwritingSnapshot } from "@/lib/listing-underwriting";
import { summarizeInvestmentWorkspace } from "@/lib/quick-decision";
import { STRATEGY_META } from "@/lib/strategy-applicability";

export interface EvaluatedListingSummary {
  cashflowScore: number;
  equityGrowthScore: number;
  combinedScore: number;
  cashflowNotes: string;
  equityNotes: string;
  primaryScenarioId: string | null;
  primaryScenarioStatus: string | null;
  primaryBridgeUsage: string | null;
  primaryAnnualCashflow: number | null;
  primaryMonthlyCashflow: number | null;
  primaryDscr: number | null;
  primaryCashOnCashReturn: number | null;
  baseHoldScenarioId: string | null;
  baseHoldAnnualCashflow: number | null;
  baseHoldMonthlyCashflow: number | null;
  quickVerdict: string;
  carryScore: number;
  executionScore: number;
  upsideScore: number;
  confidenceScore: number;
}

export async function evaluateListing(listingId: string): Promise<EvaluatedListingSummary> {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: { area: true },
  });

  if (!listing) {
    throw new Error(`Listing ${listingId} not found`);
  }

  const snapshot = await buildListingUnderwritingSnapshot(listing, {
    appreciationRateAnnual: listing.area?.appreciationRateAnnual ?? null,
    operatingExpenseTemplate: null,
  });
  const investorContext = buildInvestorContextDefaults(snapshot.profile, null);
  const workspace = buildInvestmentWorkspace({
    price: listing.price,
    squareFeet: listing.squareFeet,
    lotSizeSqFt: listing.lotSizeSqFt,
    descriptionText: listing.description,
    defaultAssumptions: snapshot.defaultAssumptions,
    profile: snapshot.profile,
    unitRentBenchmarks: snapshot.marketBenchmark.unitRentBenchmarks,
    marketCity: snapshot.marketBenchmark.mappedMarketCity,
    province: listing.province,
    investorContext,
    operatingExpenseTemplate: null,
  });

  const summary = summarizeInvestmentWorkspace(workspace, snapshot.dataConfidence);
  const primaryScenarioLabel = summary.primaryScenarioId ? STRATEGY_META[summary.primaryScenarioId]?.name ?? summary.primaryScenarioId : null;
  const baseHoldScenarioLabel = summary.baseHoldScenarioId ? STRATEGY_META[summary.baseHoldScenarioId]?.name ?? summary.baseHoldScenarioId : null;

  const cashflowNotes = primaryScenarioLabel
    ? `${primaryScenarioLabel} is the best viable path in neutral review mode${summary.primaryScenarioStatus ? ` (${summary.primaryScenarioStatus.replaceAll("_", " ")})` : ""}. ${summary.primaryMonthlyCashflow != null ? `${toCurrency(summary.primaryMonthlyCashflow)}/mo` : "No cashflow figure available"}${summary.primaryDscr != null ? `, DSCR ${summary.primaryDscr.toFixed(2)}` : ""}.`
    : summary.quickVerdict;

  const equityNotes = [
    baseHoldScenarioLabel && summary.baseHoldMonthlyCashflow != null
      ? `Base hold benchmark: ${baseHoldScenarioLabel} at ${toCurrency(summary.baseHoldMonthlyCashflow)}/mo.`
      : snapshot.profile.normalizedAssetType === "land" || snapshot.profile.normalizedAssetType === "parking"
        ? "Base hold benchmark: Development / land carry only."
        : null,
    summary.quickVerdict,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    cashflowScore: summary.carryScore,
    equityGrowthScore: summary.upsideScore,
    combinedScore: summary.combinedScore,
    cashflowNotes,
    equityNotes,
    primaryScenarioId: summary.primaryScenarioId,
    primaryScenarioStatus: summary.primaryScenarioStatus,
    primaryBridgeUsage: summary.primaryBridgeUsage,
    primaryAnnualCashflow: summary.primaryAnnualCashflow,
    primaryMonthlyCashflow: summary.primaryMonthlyCashflow,
    primaryDscr: summary.primaryDscr,
    primaryCashOnCashReturn: summary.primaryCashOnCashReturn,
    baseHoldScenarioId: summary.baseHoldScenarioId,
    baseHoldAnnualCashflow: summary.baseHoldAnnualCashflow,
    baseHoldMonthlyCashflow: summary.baseHoldMonthlyCashflow,
    quickVerdict: summary.quickVerdict,
    carryScore: summary.carryScore,
    executionScore: summary.executionScore,
    upsideScore: summary.upsideScore,
    confidenceScore: summary.confidenceScore,
  };
}

function toCurrency(value: number): string {
  const rounded = Math.round(value);
  return rounded.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  });
}
