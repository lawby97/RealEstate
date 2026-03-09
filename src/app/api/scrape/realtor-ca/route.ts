import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { evaluateListing } from "@/lib/evaluation";
import {
  fetchAllRealtorCaListings,
  mapRealtorCaListing,
  type RealtorCaListing,
} from "@/lib/realtor-ca-api";

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
      const mapped = (rawListings as RealtorCaListing[]).map((raw) => mapRealtorCaListing(raw));
      return Response.json({
        ok: true,
        source: "realtor_ca",
        preview: true,
        fetched: mapped.length,
        listings: mapped,
        message: `Preview: ${mapped.length} listings (not saved).`,
      });
    }

    let created = 0;
    let updated = 0;

    for (const raw of rawListings as RealtorCaListing[]) {
      const mapped = mapRealtorCaListing(raw);
      const listing = await prisma.listing.upsert({
        where: { externalId: mapped.externalId },
        create: mapped,
        update: {
          price: mapped.price,
          address: mapped.address,
          city: mapped.city,
          province: mapped.province,
          postalCode: mapped.postalCode,
          latitude: mapped.latitude,
          longitude: mapped.longitude,
          bedrooms: mapped.bedrooms,
          bathrooms: mapped.bathrooms,
          squareFeet: mapped.squareFeet,
          lotSizeSqFt: mapped.lotSizeSqFt,
          yearBuilt: mapped.yearBuilt,
          description: mapped.description,
          photoUrls: mapped.photoUrls,
          listingUrl: mapped.listingUrl,
          lastSeenAt: new Date(),
          rawJson: mapped.rawJson,
        },
      });
      if (listing.createdAt.getTime() === listing.updatedAt.getTime()) created++;
      else updated++;

      const result = evaluateListing({
        price: listing.price,
        city: listing.city,
        province: listing.province,
        postalCode: listing.postalCode,
        units: listing.units,
        bedrooms: listing.bedrooms,
      });

      await prisma.listingEvaluation.upsert({
        where: { listingId: listing.id },
        create: {
          listingId: listing.id,
          cashflowScore: result.cashflowScore,
          equityGrowthScore: result.equityGrowthScore,
          combinedScore: result.combinedScore,
          cashflowNotes: result.cashflowNotes,
          equityNotes: result.equityNotes,
        },
        update: {
          cashflowScore: result.cashflowScore,
          equityGrowthScore: result.equityGrowthScore,
          combinedScore: result.combinedScore,
          cashflowNotes: result.cashflowNotes,
          equityNotes: result.equityNotes,
          computedAt: new Date(),
        },
      });
    }

    return Response.json({
      ok: true,
      source: "realtor_ca",
      fetched: rawListings.length,
      created,
      updated,
      evaluated: rawListings.length,
      message: `Upserted ${rawListings.length} listings from Realtor.ca.`,
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
