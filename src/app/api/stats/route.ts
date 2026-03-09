import { prisma } from "@/lib/prisma";

export async function GET() {
  const [total, topDeals, highScore80, highScore90, avgResult, sumResult] = await Promise.all([
    prisma.listing.count(),
    prisma.listing.count({
      where: { evaluation: { combinedScore: { gte: 80 } } },
    }),
    prisma.listing.count({
      where: { evaluation: { combinedScore: { gte: 80 } } },
    }),
    prisma.listing.count({
      where: { evaluation: { combinedScore: { gte: 90 } } },
    }),
    prisma.listingEvaluation.aggregate({
      _avg: { combinedScore: true },
    }),
    prisma.listing.aggregate({
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
