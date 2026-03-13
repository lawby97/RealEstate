import { NextRequest } from "next/server";
import { mapCentrisListing, type CentrisListing } from "@/lib/centris-api";
import { ingestSourcePayload } from "@/lib/source-ingest";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await ingestSourcePayload({
      source: "centris_ca",
      body,
      mapRaw: (raw) => mapCentrisListing(raw as CentrisListing),
      emptyPayloadError:
        "Missing or empty listings. Send a Centris-shaped listing array or a browser capture envelope.",
      messageBuilder: ({ received, created, updated, deduped, skipped }) =>
        `Ingested ${received} Centris listings (${created} new, ${updated} updated, ${deduped} deduped, ${skipped} skipped).`,
    });
    return Response.json(result.body, { status: result.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Centris ingest failed";
    return Response.json({ ok: false, error: message, source: "centris_ca" }, { status: 500 });
  }
}
