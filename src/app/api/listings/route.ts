import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildActiveListingWhere, refreshListingActivityCache } from "@/lib/listing-activity";

export const dynamic = "force-dynamic";

type SortOption = "price_asc" | "price_desc" | "score_desc" | "score_asc" | "newest";

const SORT_MAP: Record<SortOption, { orderBy: { price?: "asc" | "desc"; lastSeenAt?: "desc" } }> = {
  price_asc: { orderBy: { price: "asc" } },
  price_desc: { orderBy: { price: "desc" } },
  score_desc: { orderBy: {} },
  score_asc: { orderBy: {} },
  newest: { orderBy: { lastSeenAt: "desc" } },
};

const MARKET_CITY_GROUPS: Record<string, string[]> = {
  montreal: [
    "Montreal",
    "Montréal",
    "Laval",
    "Longueuil",
    "Brossard",
    "Blainville",
    "Boisbriand",
    "Deux-Montagnes",
    "Saint-Eustache",
    "Sainte-Marthe-sur-le-Lac",
    "Dollard-des-Ormeaux",
    "Pointe-Claire",
    "Dorval",
    "Kirkland",
    "Beaconsfield",
    "Saint-Laurent",
    "LaSalle",
    "Verdun",
    "Westmount",
    "Cote-Saint-Luc",
    "Côte-Saint-Luc",
    "Mont-Royal",
    "Mount Royal",
  ],
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const city = searchParams.get("city");
  const market = searchParams.get("market");
  const propertyType = searchParams.get("propertyType");
  const minPrice = searchParams.get("minPrice");
  const maxPrice = searchParams.get("maxPrice");
  const minUnits = searchParams.get("minUnits");
  const minScore = searchParams.get("minScore");
  const sort = (searchParams.get("sort") ?? "price_asc") as SortOption;
  const includeInactive = searchParams.get("includeInactive") === "1";
  const validSort: SortOption = SORT_MAP[sort] ? sort : "price_asc";
  const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") ?? "24", 10) || 24), 100);
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10) || 0);

  const baseWhere: Prisma.ListingWhereInput = {};
  if (market) {
    const marketKey = market.trim().toLowerCase();
    const marketCities = MARKET_CITY_GROUPS[marketKey];
    if (marketCities) {
      baseWhere.OR = marketCities.map((name) => ({ city: { equals: name } }));
    }
  } else if (city) {
    const c = city.trim();
    if (c.toLowerCase() === "montreal") {
      baseWhere.OR = [
        { city: { contains: "Montreal" } },
        { city: { contains: "Montréal" } },
      ];
    } else {
      baseWhere.city = { contains: c };
    }
  }
  if (propertyType && propertyType.trim()) {
    baseWhere.propertyType = { contains: propertyType.trim() };
  }
  if (minPrice) baseWhere.price = { ...((baseWhere.price as Prisma.FloatFilter) ?? {}), gte: parseFloat(minPrice) };
  if (maxPrice) baseWhere.price = { ...((baseWhere.price as Prisma.FloatFilter) ?? {}), lte: parseFloat(maxPrice) };
  if (minUnits) baseWhere.units = { gte: parseInt(minUnits, 10) };
  if (minScore) {
    baseWhere.evaluation = {
      combinedScore: { gte: parseFloat(minScore) },
    };
  }

  const orderBy = SORT_MAP[validSort].orderBy;
  const needsScoreSort = validSort === "score_desc" || validSort === "score_asc";

  try {
    if (!includeInactive) {
      await refreshListingActivityCache(baseWhere);
    }
    const where = includeInactive ? baseWhere : buildActiveListingWhere(baseWhere);
    const [listings, total] = await Promise.all([
      needsScoreSort
        ? prisma.listing.findMany({ where, include: { evaluation: true } }).then((rows) => {
            const dir = validSort === "score_desc" ? -1 : 1;
            rows.sort((a, b) => {
              const sa = a.evaluation?.combinedScore ?? -1;
              const sb = b.evaluation?.combinedScore ?? -1;
              return (sa - sb) * dir;
            });
            return rows.slice(offset, offset + limit);
          })
        : prisma.listing.findMany({
            where,
            orderBy,
            take: limit,
            skip: offset,
            include: { evaluation: true },
          }),
      prisma.listing.count({ where }),
    ]);
    return Response.json({ listings, total });
  } catch (e) {
    console.error("[listings API]", e);
    return Response.json({ listings: [], total: 0 });
  }
}
