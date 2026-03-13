import { prisma } from "@/lib/prisma";
import { buildActiveListingWhere, refreshListingActivityCache } from "@/lib/listing-activity";

export const dynamic = "force-dynamic";

const VIABLE_STATUSES = new Set(["applicable", "potentially_applicable"]);

export async function GET() {
  await refreshListingActivityCache({ duplicateOfListingId: null });
  const activeWhere = buildActiveListingWhere({ duplicateOfListingId: null });

  const listings = await prisma.listing.findMany({
    where: activeWhere,
    include: { evaluation: true },
  });

  const total = listings.length;
  const viable = listings.filter((listing) => VIABLE_STATUSES.has(listing.evaluation?.primaryScenarioStatus ?? "not_applicable"));
  const positiveCarryViableDeals = viable.filter((listing) => (listing.evaluation?.primaryMonthlyCashflow ?? Number.NEGATIVE_INFINITY) > 0).length;
  const bridgeFreeViableDeals = viable.filter((listing) => listing.evaluation?.primaryBridgeUsage === "not_needed").length;
  const dealScores = listings.map((listing) => listing.evaluation?.combinedScore).filter((value): value is number => typeof value === "number");
  const bestCaseCashflows = viable
    .map((listing) => listing.evaluation?.primaryMonthlyCashflow)
    .filter((value): value is number => typeof value === "number");
  const totalPortfolioValue = listings.reduce((sum, listing) => sum + (listing.price ?? 0), 0);
  const highScore90 = listings.filter((listing) => (listing.evaluation?.combinedScore ?? 0) >= 90).length;
  const highScore80 = listings.filter((listing) => (listing.evaluation?.combinedScore ?? 0) >= 80).length;
  const avgScore = dealScores.length > 0 ? dealScores.reduce((sum, value) => sum + value, 0) / dealScores.length : 0;
  const avgBestViableMonthlyCashflow =
    bestCaseCashflows.length > 0 ? bestCaseCashflows.reduce((sum, value) => sum + value, 0) / bestCaseCashflows.length : 0;

  return Response.json({
    totalListings: total,
    positiveCarryViableDeals,
    bridgeFreeViableDeals,
    avgBestViableMonthlyCashflow: Math.round(avgBestViableMonthlyCashflow * 100) / 100,
    avgDealScore: Math.round(avgScore * 10) / 10,
    totalPortfolioValue,
    topDeals: positiveCarryViableDeals,
    highScoreCount: highScore80,
    highScore90,
    avgScore: Math.round(avgScore * 10) / 10,
  });
}
