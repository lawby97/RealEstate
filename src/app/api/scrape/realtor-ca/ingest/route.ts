import { NextRequest } from "next/server";
import { mapRealtorCaListing, type RealtorCaListing } from "@/lib/realtor-ca-api";
import { ingestSourcePayload } from "@/lib/source-ingest";

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
    const body = await req.json().catch(() => ({}));
    const result = await ingestSourcePayload({
      source: "realtor_ca",
      body,
      mapRaw: (raw) => mapRealtorCaListing(raw as RealtorCaListing),
      emptyPayloadError:
        "Missing or empty listings. Send a Realtor.ca listing array or a browser capture envelope.",
      messageBuilder: ({ received, created, updated, deduped, skipped }) =>
        `Ingested ${received} Realtor.ca listings (${created} new, ${updated} updated, ${deduped} deduped, ${skipped} skipped).`,
    });
    return Response.json(result.body, { status: result.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ingest failed";
    return Response.json(
      { ok: false, error: message, source: "realtor_ca" },
      { status: 500 }
    );
  }
}
