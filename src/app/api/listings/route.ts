import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildActiveListingWhere, refreshListingActivityCache } from "@/lib/listing-activity";
import { computeListingCashOnCashRoi, sortByCashOnCashRoi } from "@/lib/listing-roi";
import { parsePropertyTypeParams, propertyTypeWhere } from "@/lib/property-type-filters";
import { getListingCashRequirement } from "@/lib/underwriting";

export const dynamic = "force-dynamic";

type SortOption = "price_asc" | "price_desc" | "score_desc" | "score_asc" | "roi_desc" | "roi_asc" | "newest" | "sold_newest";
type ListingStatusFilter = "active" | "sold" | "all";

const SORT_MAP: Record<SortOption, { orderBy: Prisma.ListingOrderByWithRelationInput }> = {
  price_asc: { orderBy: { price: "asc" } },
  price_desc: { orderBy: { price: "desc" } },
  score_desc: { orderBy: {} },
  score_asc: { orderBy: {} },
  roi_desc: { orderBy: {} },
  roi_asc: { orderBy: {} },
  newest: { orderBy: { lastSeenAt: "desc" } },
  sold_newest: { orderBy: { soldAt: "desc" } },
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

function optionalNumber(value: string | null): number | null {
  if (value == null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sortByScore<T extends { evaluation: { combinedScore: number } | null }>(
  rows: T[],
  direction: "asc" | "desc"
): T[] {
  const multiplier = direction === "desc" ? -1 : 1;
  return rows.sort((a, b) => {
    const scoreA = a.evaluation?.combinedScore ?? -1;
    const scoreB = b.evaluation?.combinedScore ?? -1;
    return (scoreA - scoreB) * multiplier;
  });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const city = searchParams.get("city");
  const market = searchParams.get("market");
  const propertyTypes = parsePropertyTypeParams(searchParams);
  const minPrice = searchParams.get("minPrice");
  const maxPrice = searchParams.get("maxPrice");
  const minUnits = searchParams.get("minUnits");
  const maxUnits = searchParams.get("maxUnits");
  const minScore = searchParams.get("minScore");
  const syncScope = searchParams.get("syncScope");
  const maxDownPayment = optionalNumber(searchParams.get("maxDownPayment"));
  const ownerOccupied = searchParams.get("ownerOccupied") === "1";
  const sort = (searchParams.get("sort") ?? "price_asc") as SortOption;
  const status = (searchParams.get("status") ?? "active") as ListingStatusFilter;
  const includeInactive = searchParams.get("includeInactive") === "1";
  const validSort: SortOption = SORT_MAP[sort] ? sort : "price_asc";
  const validStatus: ListingStatusFilter =
    status === "sold" || status === "all" ? status : "active";
  const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") ?? "24", 10) || 24), 500);
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10) || 0);

  const baseWhere: Prisma.ListingWhereInput = {};
  const andFilters: Prisma.ListingWhereInput[] = [];
  if (validStatus === "sold") {
    baseWhere.listingStatus = "sold";
  } else if (validStatus === "active") {
    baseWhere.listingStatus = { not: "sold" };
  }
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
  const propertyTypeFilter = propertyTypeWhere(propertyTypes);
  if (propertyTypeFilter) {
    andFilters.push(propertyTypeFilter);
  }
  if (minPrice) baseWhere.price = { ...((baseWhere.price as Prisma.FloatFilter) ?? {}), gte: parseFloat(minPrice) };
  if (maxPrice) baseWhere.price = { ...((baseWhere.price as Prisma.FloatFilter) ?? {}), lte: parseFloat(maxPrice) };
  if (minUnits) {
    baseWhere.units = { ...((baseWhere.units as Prisma.IntFilter) ?? {}), gte: parseInt(minUnits, 10) };
  }
  if (maxUnits) {
    baseWhere.units = { ...((baseWhere.units as Prisma.IntFilter) ?? {}), lte: parseInt(maxUnits, 10) };
  }
  if (minScore) {
    baseWhere.evaluation = {
      combinedScore: { gte: parseFloat(minScore) },
    };
  }
  if (syncScope) {
    baseWhere.sources = {
      some: {
        syncScope,
        ...(validStatus === "sold" ? { listingStatus: "sold" } : { listingStatus: { not: "sold" } }),
      },
    };
  }
  if (andFilters.length > 0) {
    baseWhere.AND = andFilters;
  }

  const orderBy = SORT_MAP[validSort].orderBy;
  const needsScoreSort = validSort === "score_desc" || validSort === "score_asc";
  const needsRoiSort = validSort === "roi_desc" || validSort === "roi_asc";

  const withComputedFields = <T extends {
    price: number;
    units: number;
    city: string;
    propertyType: string;
  }>(listing: T) => ({
    ...listing,
    underwriting: getListingCashRequirement(
      listing.price,
      listing.units,
      ownerOccupied,
      listing.propertyType
    ),
    roi: computeListingCashOnCashRoi({
      price: listing.price,
      city: listing.city,
      units: listing.units,
      propertyType: listing.propertyType,
      ownerOccupied,
    }),
  });

  try {
    if (!includeInactive && validStatus !== "sold") {
      await refreshListingActivityCache(baseWhere);
    }
    const where =
      includeInactive || validStatus === "sold"
        ? baseWhere
        : buildActiveListingWhere(baseWhere);
    const needsInMemoryFiltering = maxDownPayment != null || needsScoreSort || needsRoiSort;

    if (needsInMemoryFiltering) {
      let rows = await prisma.listing.findMany({
        where,
        orderBy: needsScoreSort || needsRoiSort ? undefined : orderBy,
        include: { evaluation: true },
      });

      if (maxDownPayment != null) {
        rows = rows.filter((listing) =>
          getListingCashRequirement(
            listing.price,
            listing.units,
            ownerOccupied,
            listing.propertyType
          )
            .minimumDownPayment <= maxDownPayment
        );
      }
      if (needsScoreSort) {
        sortByScore(rows, validSort === "score_desc" ? "desc" : "asc");
      }
      let enriched = rows.map(withComputedFields);
      if (needsRoiSort) {
        sortByCashOnCashRoi(enriched, validSort === "roi_desc" ? "desc" : "asc");
      }

      const total = rows.length;
      const listings = enriched.slice(offset, offset + limit);
      return Response.json({ listings, total });
    }

    const [rows, total] = await Promise.all([
      prisma.listing.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
        include: { evaluation: true },
      }),
      prisma.listing.count({ where }),
    ]);
    const listings = rows.map(withComputedFields);
    return Response.json({ listings, total });
  } catch (e) {
    console.error("[listings API]", e);
    return Response.json({ listings: [], total: 0 });
  }
}
