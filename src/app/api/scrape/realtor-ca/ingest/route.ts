import { NextRequest } from "next/server";
import type { RealtorCaListing } from "@/lib/realtor-ca-api";
import {
  resolveListingSnapshotFilters,
  syncRealtorCaSnapshot,
} from "@/lib/listing-sync";

const MAX_LISTINGS_PER_REQUEST = 1000;

function optionalNumber(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function optionalDate(value: unknown): Date | undefined {
  if (typeof value !== "string") return undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : undefined;
}

/**
 * POST /api/scrape/realtor-ca/ingest
 *
 * Ingest Realtor.ca-shaped listing data (e.g. from Apify, browser scraper, or
 * saved JSON). Body: { "listings": [ ... ] } or { "items": [ ... ] } (Apify) or [ ... ].
 *
 * Supports both PascalCase (realtor.ca API) and camelCase (Apify-style) field names.
 */
export async function POST(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const body = await req.json().catch(() => ({}));
    const rawList =
      Array.isArray(body.listings) ? body.listings
      : Array.isArray(body.items) ? body.items
      : Array.isArray(body) ? body
      : Array.isArray(body.data) ? body.data
      : [];
    const rawListings = rawList.slice(0, MAX_LISTINGS_PER_REQUEST) as RealtorCaListing[];
    const syncScope = String(
      body.syncScope ??
      searchParams.get("syncScope") ??
      "realtor_ca_manual"
    );
    const filters = resolveListingSnapshotFilters({
      syncScope,
      captureScope: String(body.captureScope ?? searchParams.get("captureScope") ?? ""),
      fallback: {
          minPrice: optionalNumber(body.minPrice ?? searchParams.get("minPrice")),
          maxPrice: optionalNumber(body.maxPrice ?? searchParams.get("maxPrice")),
          units: optionalNumber(body.units ?? searchParams.get("units")),
          cityNames: Array.isArray(body.cityNames) ? body.cityNames.map(String) : undefined,
          excludeNonResidential:
            body.excludeNonResidential === true ||
            searchParams.get("excludeNonResidential") === "1" ||
            searchParams.get("excludeNonResidential") === "true",
        },
    });
    const markMissingAsSold =
      body.markMissingAsSold === true ||
      searchParams.get("markMissingAsSold") === "1" ||
      searchParams.get("markMissingAsSold") === "true";

    if (rawListings.length === 0) {
      return Response.json(
        {
          ok: false,
          error: "Missing or empty listings. Send { listings: [ ... ] } or { items: [ ... ] } (Apify) or a JSON array. Supports PascalCase (Id, City, Price) or camelCase (id, city, price).",
          source: "realtor_ca",
        },
        { status: 400 }
      );
    }

    const result = await syncRealtorCaSnapshot(rawListings, {
      syncScope,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      units: filters.units,
      cityNames: filters.cityNames,
      excludeNonResidential: filters.excludeNonResidential,
      markMissingAsSold,
      runAt: optionalDate(body.capturedAt ?? searchParams.get("capturedAt")),
    });

    return Response.json({
      ok: true,
      ...result,
      message: `Ingested ${result.accepted} scoped Realtor.ca listings (${result.created} new, ${result.updated} updated, ${result.soldMarked} marked sold).`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ingest failed";
    return Response.json(
      { ok: false, error: message, source: "realtor_ca" },
      { status: 500 }
    );
  }
}
