import { prisma } from "@/lib/prisma";
import { buildActiveListingWhere, refreshListingActivityCache } from "@/lib/listing-activity";
import { computeListingCashOnCashRoi } from "@/lib/listing-roi";

export const dynamic = "force-dynamic";

export async function GET() {
  await refreshListingActivityCache();
  const activeWhere = buildActiveListingWhere();

  const [total, fivePlusListings, highScore80, highScore90, avgResult, sumResult, latestSeenResult, roiRows] = await Promise.all([
    prisma.listing.count({ where: activeWhere }),
    prisma.listing.count({
      where: { ...activeWhere, units: { gte: 5 } },
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
    prisma.listing.aggregate({
      where: activeWhere,
      _max: { lastSeenAt: true },
    }),
    prisma.listing.findMany({
      where: activeWhere,
      select: {
        price: true,
        city: true,
        units: true,
        propertyType: true,
      },
    }),
  ]);

  const avgScore = avgResult._avg.combinedScore ?? 0;
  const roiValues = roiRows
    .map((listing) =>
      computeListingCashOnCashRoi({
        price: listing.price,
        city: listing.city,
        units: listing.units,
        propertyType: listing.propertyType,
        ownerOccupied: false,
      }).cashOnCashReturn
    )
    .filter((value): value is number => value != null && Number.isFinite(value));
  const avgRoi =
    roiValues.length > 0
      ? roiValues.reduce((sum, value) => sum + value, 0) / roiValues.length
      : 0;
  const totalPortfolioValue = sumResult._sum.price ?? 0;

  return Response.json({
    totalListings: total,
    topDeals: highScore80,
    fivePlusListings,
    highScoreCount: highScore80,
    highScore90,
    avgScore,
    avgRoi: Math.round(avgRoi * 10) / 10,
    totalPortfolioValue,
    latestCapturedAt: latestSeenResult._max.lastSeenAt?.toISOString() ?? null,
  });
}
