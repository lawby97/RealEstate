import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildActiveListingWhere, refreshListingActivityCache } from "@/lib/listing-activity";
import { deriveNormalizedProfile } from "@/lib/normalized-profile";

export const dynamic = "force-dynamic";

type SortOption =
  | "price_asc"
  | "price_desc"
  | "deal_score_desc"
  | "deal_score_asc"
  | "score_desc"
  | "score_asc"
  | "best_case_cashflow_desc"
  | "base_hold_cashflow_desc"
  | "newest";

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

const VIABLE_STATUSES = new Set(["applicable", "potentially_applicable"]);

function normalizeSort(sort: string | null): Exclude<SortOption, "score_desc" | "score_asc"> {
  if (sort === "score_desc") return "deal_score_desc";
  if (sort === "score_asc") return "deal_score_asc";
  if (
    sort === "price_asc" ||
    sort === "price_desc" ||
    sort === "deal_score_desc" ||
    sort === "deal_score_asc" ||
    sort === "best_case_cashflow_desc" ||
    sort === "base_hold_cashflow_desc" ||
    sort === "newest"
  ) {
    return sort;
  }
  return "deal_score_desc";
}

function compareNumbersDesc(a: number | null | undefined, b: number | null | undefined): number {
  return (b ?? Number.NEGATIVE_INFINITY) - (a ?? Number.NEGATIVE_INFINITY);
}

function parseReasons(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const city = searchParams.get("city");
  const market = searchParams.get("market");
  const propertyType = searchParams.get("propertyType");
  const minPrice = searchParams.get("minPrice");
  const maxPrice = searchParams.get("maxPrice");
  const minUnits = searchParams.get("minUnits");
  const minScore = searchParams.get("minScore");
  const sort = normalizeSort(searchParams.get("sort"));
  const includeInactive = searchParams.get("includeInactive") === "1";
  const positiveCashflowOnly = searchParams.get("positiveCashflowOnly") === "1";
  const bridgeFreeOnly = searchParams.get("bridgeFreeOnly") === "1";
  const viableOnly = searchParams.get("viableOnly") === "1";
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
      baseWhere.OR = [{ city: { contains: "Montreal" } }, { city: { contains: "Montréal" } }];
    } else {
      baseWhere.city = { contains: c };
    }
  }
  if (minPrice) baseWhere.price = { ...((baseWhere.price as Prisma.FloatFilter) ?? {}), gte: parseFloat(minPrice) };
  if (maxPrice) baseWhere.price = { ...((baseWhere.price as Prisma.FloatFilter) ?? {}), lte: parseFloat(maxPrice) };
  if (minUnits) baseWhere.units = { gte: parseInt(minUnits, 10) };

  try {
    if (!includeInactive) {
      await refreshListingActivityCache(baseWhere);
    }
    const where = includeInactive ? baseWhere : buildActiveListingWhere(baseWhere);
    const rawListings = await prisma.listing.findMany({
      where: {
        AND: [
          where,
          { duplicateOfListingId: null },
        ],
      },
      include: { evaluation: true, profile: true },
    });
    let listings = rawListings.map((listing) => {
      const derived = deriveNormalizedProfile(listing);
      const profile = listing.profile
        ? {
            normalizedAssetType: listing.profile.normalizedAssetType as typeof derived.normalizedAssetType,
            normalizedAssetSubtype: (listing.profile.normalizedAssetSubtype as typeof derived.normalizedAssetSubtype | null) ?? derived.normalizedAssetSubtype,
            normalizedAssetLabel: listing.profile.normalizedAssetLabel ?? derived.normalizedAssetLabel,
            classificationConfidence: (listing.profile.classificationConfidence as typeof derived.classificationConfidence | null) ?? derived.classificationConfidence,
            classificationReasons: (() => {
              const reasons = parseReasons(listing.profile.classificationReasons);
              return reasons.length > 0 ? reasons : derived.classificationReasons;
            })(),
            sourceTypeConflict: listing.profile.sourceTypeConflict,
          }
        : {
            normalizedAssetType: derived.normalizedAssetType,
            normalizedAssetSubtype: derived.normalizedAssetSubtype,
            normalizedAssetLabel: derived.normalizedAssetLabel,
            classificationConfidence: derived.classificationConfidence,
            classificationReasons: derived.classificationReasons,
            sourceTypeConflict: derived.sourceTypeConflict,
          };
      return {
        ...listing,
        normalizedAssetType: profile.normalizedAssetType,
        normalizedAssetSubtype: profile.normalizedAssetSubtype,
        normalizedAssetLabel: profile.normalizedAssetLabel,
        classificationConfidence: profile.classificationConfidence,
        classificationReasons: profile.classificationReasons,
        sourceTypeConflict: profile.sourceTypeConflict,
      };
    });

    if (propertyType && propertyType.trim()) {
      const target = propertyType.trim().toLowerCase();
      listings = listings.filter(
        (listing) =>
          listing.normalizedAssetLabel.toLowerCase() === target ||
          listing.normalizedAssetType.toLowerCase() === target ||
          listing.normalizedAssetSubtype.toLowerCase() === target
      );
    }

    if (minScore) {
      const threshold = parseFloat(minScore);
      listings = listings.filter((listing) => (listing.evaluation?.combinedScore ?? Number.NEGATIVE_INFINITY) >= threshold);
    }
    if (positiveCashflowOnly) {
      listings = listings.filter((listing) => (listing.evaluation?.primaryMonthlyCashflow ?? Number.NEGATIVE_INFINITY) > 0);
    }
    if (bridgeFreeOnly) {
      listings = listings.filter((listing) => listing.evaluation?.primaryBridgeUsage === "not_needed");
    }
    if (viableOnly) {
      listings = listings.filter((listing) => VIABLE_STATUSES.has(listing.evaluation?.primaryScenarioStatus ?? "not_applicable"));
    }

    listings.sort((a, b) => {
      switch (sort) {
        case "price_asc":
          return a.price - b.price;
        case "price_desc":
          return b.price - a.price;
        case "deal_score_asc":
          return (a.evaluation?.combinedScore ?? Number.POSITIVE_INFINITY) - (b.evaluation?.combinedScore ?? Number.POSITIVE_INFINITY);
        case "best_case_cashflow_desc":
          return compareNumbersDesc(a.evaluation?.primaryMonthlyCashflow, b.evaluation?.primaryMonthlyCashflow);
        case "base_hold_cashflow_desc":
          return compareNumbersDesc(a.evaluation?.baseHoldMonthlyCashflow, b.evaluation?.baseHoldMonthlyCashflow);
        case "newest":
          return new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime();
        case "deal_score_desc":
        default:
          return compareNumbersDesc(a.evaluation?.combinedScore, b.evaluation?.combinedScore);
      }
    });

    const total = listings.length;
    return Response.json({ listings: listings.slice(offset, offset + limit), total });
  } catch (e) {
    console.error("[listings API]", e);
    return Response.json({ listings: [], total: 0 });
  }
}
