import { NextRequest } from "next/server";
import {
  fetchAllRealtorCaListings,
  mapRealtorCaListing,
  type RealtorCaListing,
} from "@/lib/realtor-ca-api";
import {
  passesListingSnapshotFilters,
  resolveListingSnapshotFilters,
  syncRealtorCaSnapshot,
} from "@/lib/listing-sync";

const MAX_RESULTS_DEFAULT = 200;
const MAX_RESULTS_CAP = 500;

/**
 * POST /api/scrape/realtor-ca
 *
 * Scrapes listing data from Realtor.ca, upserts into DB, runs evaluation.
 *
 * Query params:
 *   - provinceCode: ON | BC | QC | AB | ... (optional)
 *   - city: e.g. Toronto, Montreal (optional)
 *   - maxResults: 1–500 (default 200)
 *   - minPrice, maxPrice: price range in CAD (optional)
 *   - minBedrooms, maxBedrooms: bedroom range (optional)
 *   - buildingTypeId: property type ID (optional)
 *   - preview: 1 = return fetched data without saving to DB
 */
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const provinceCode = searchParams.get("provinceCode") ?? undefined;
    const city = searchParams.get("city") ?? undefined;
    const preview = searchParams.get("preview") === "1" || searchParams.get("preview") === "true";
    const maxResults = Math.min(
      Math.max(1, parseInt(searchParams.get("maxResults") ?? String(MAX_RESULTS_DEFAULT), 10)),
      MAX_RESULTS_CAP
    );
    const minPrice = searchParams.get("minPrice") ? parseInt(searchParams.get("minPrice")!, 10) : undefined;
    const maxPrice = searchParams.get("maxPrice") ? parseInt(searchParams.get("maxPrice")!, 10) : undefined;
    const minBedrooms = searchParams.get("minBedrooms") ? parseInt(searchParams.get("minBedrooms")!, 10) : undefined;
    const maxBedrooms = searchParams.get("maxBedrooms") ? parseInt(searchParams.get("maxBedrooms")!, 10) : undefined;
    const buildingTypeId = searchParams.get("buildingTypeId") ? parseInt(searchParams.get("buildingTypeId")!, 10) : undefined;
    const syncScope = searchParams.get("syncScope") ?? searchParams.get("captureScope") ?? "realtor_ca_direct";
    const filters = resolveListingSnapshotFilters({
      syncScope,
      captureScope: searchParams.get("captureScope"),
      fallback: {
          minPrice,
          maxPrice,
          units: searchParams.get("units") ? parseInt(searchParams.get("units")!, 10) : undefined,
          excludeNonResidential:
            searchParams.get("excludeNonResidential") === "1" ||
            searchParams.get("excludeNonResidential") === "true",
        },
    });
    const markMissingAsSold =
      searchParams.get("markMissingAsSold") === "1" ||
      searchParams.get("markMissingAsSold") === "true";

    const rawListings = await fetchAllRealtorCaListings({
      provinceCode,
      city,
      maxResults,
      recordsPerPage: 100,
      minPrice,
      maxPrice,
      minBedrooms,
      maxBedrooms,
      buildingTypeId,
    });

    if (rawListings.length === 0) {
      return Response.json({
        ok: true,
        source: "realtor_ca",
        preview: !!preview,
        fetched: 0,
        created: 0,
        updated: 0,
        evaluated: 0,
        listings: [],
        message: "No listings returned from Realtor.ca (try different filters or check API).",
      });
    }

    if (preview) {
      const mapped = (rawListings as RealtorCaListing[])
        .map((raw) => mapRealtorCaListing(raw))
        .filter((listing) => passesListingSnapshotFilters(listing, filters));
      return Response.json({
        ok: true,
        source: "realtor_ca",
        preview: true,
        fetched: mapped.length,
        listings: mapped,
        message: `Preview: ${mapped.length} listings (not saved).`,
      });
    }

    const result = await syncRealtorCaSnapshot(rawListings as RealtorCaListing[], {
      syncScope,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      units: filters.units,
      cityNames: "cityNames" in filters ? filters.cityNames : undefined,
      excludeNonResidential: filters.excludeNonResidential,
      markMissingAsSold,
    });

    return Response.json({
      ok: true,
      fetched: rawListings.length,
      ...result,
      message: `Upserted ${result.accepted} scoped listings from Realtor.ca (${result.soldMarked} marked sold).`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Realtor.ca scrape failed";
    const isBlocked =
      typeof message === "string" &&
      (message.includes("403") || message.includes("Incapsula") || message.includes("blocked"));
    return Response.json(
      {
        ok: false,
        error: message,
        source: "realtor_ca",
        hint: isBlocked
          ? "Realtor.ca may block server-side requests. Use POST /api/scrape/realtor-ca/ingest with body { listings: [...] } and send data from a browser-based scraper or Apify (e.g. Realtor.ca Property Search Scraper)."
          : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/scrape/realtor-ca
 *
 * Same as POST; accepts query params for provinceCode, city, maxResults.
 */
export async function GET(req: NextRequest) {
  return POST(req);
}
