import { prisma } from "@/lib/prisma";
import { buildActiveListingWhere, refreshListingActivityCache } from "@/lib/listing-activity";

export const dynamic = "force-dynamic";

export async function GET() {
  await refreshListingActivityCache();
  const activeWhere = buildActiveListingWhere();

  const [total, topDeals, highScore80, highScore90, avgResult, sumResult] = await Promise.all([
    prisma.listing.count({ where: activeWhere }),
    prisma.listing.count({
      where: { ...activeWhere, evaluation: { combinedScore: { gte: 80 } } },
    }),
    prisma.listing.count({
      where: { ...activeWhere, evaluation: { combinedScore: { gte: 80 } } },
    }),
    prisma.listing.count({
      where: { ...activeWhere, evaluation: { combinedScore: { gte: 90 } } },
    }),
    prisma.listingEvaluation.aggregate({
      where: { listing: activeWhere },
      _avg: { combinedScore: true },
    }),
    prisma.listing.aggregate({
      where: activeWhere,
      _sum: { price: true },
    }),
  ]);

  const avgScore = avgResult._avg.combinedScore ?? 0;
  const avgRoi = total > 0 ? Math.min(12, Math.max(0, (avgScore / 100) * 12)) : 0;
  const totalPortfolioValue = sumResult._sum.price ?? 0;

  return Response.json({
    totalListings: total,
    topDeals,
    highScoreCount: highScore80,
    highScore90,
    avgScore,
    avgRoi: Math.round(avgRoi * 10) / 10,
    totalPortfolioValue,
  });
}
