import { NextRequest } from "next/server";
import { fetchAllCentrisListings, mapCentrisListing, type CentrisListing } from "@/lib/centris-api";
import { upsertMappedListing } from "@/lib/listing-sync";

const MAX_RESULTS_DEFAULT = 200;
const MAX_RESULTS_CAP = 500;

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const city = searchParams.get("city") ?? undefined;
    const market = searchParams.get("market") ?? undefined;
    const provinceCode = searchParams.get("provinceCode") ?? "QC";
    const preview = searchParams.get("preview") === "1" || searchParams.get("preview") === "true";
    const maxResults = Math.min(
      Math.max(1, parseInt(searchParams.get("maxResults") ?? String(MAX_RESULTS_DEFAULT), 10)),
      MAX_RESULTS_CAP
    );
    const minPrice = searchParams.get("minPrice") ? parseInt(searchParams.get("minPrice")!, 10) : undefined;
    const maxPrice = searchParams.get("maxPrice") ? parseInt(searchParams.get("maxPrice")!, 10) : undefined;
    const minBedrooms = searchParams.get("minBedrooms") ? parseInt(searchParams.get("minBedrooms")!, 10) : undefined;
    const maxBedrooms = searchParams.get("maxBedrooms") ? parseInt(searchParams.get("maxBedrooms")!, 10) : undefined;
    const lane = searchParams.get("lane") ?? undefined;

    const rawListings = await fetchAllCentrisListings({
      city,
      market,
      provinceCode,
      lane,
      maxResults,
      minPrice,
      maxPrice,
      minBedrooms,
      maxBedrooms,
    });

    if (preview) {
      const mapped = (rawListings as CentrisListing[]).map((raw) => mapCentrisListing(raw));
      return Response.json({
        ok: true,
        source: "centris_ca",
        preview: true,
        fetched: mapped.length,
        listings: mapped,
      });
    }

    let created = 0;
    let updated = 0;
    let deduped = 0;

    for (const raw of rawListings as CentrisListing[]) {
      const outcome = await upsertMappedListing(mapCentrisListing(raw));
      if (outcome.status === "created") created++;
      else updated++;
      if (outcome.duplicateOfListingId) deduped++;
    }

    return Response.json({
      ok: true,
      source: "centris_ca",
      fetched: rawListings.length,
      created,
      updated,
      deduped,
      evaluated: rawListings.length,
      message: `Upserted ${rawListings.length} listings from Centris.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Centris scrape failed";
    return Response.json({ ok: false, error: message, source: "centris_ca" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
