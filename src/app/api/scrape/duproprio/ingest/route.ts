import { NextRequest } from "next/server";
import { ingestSourcePayload } from "@/lib/source-ingest";
import { mapDuProprioListing } from "@/lib/duproprio-api";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await ingestSourcePayload({
      source: "duproprio_ca",
      body,
      mapRaw: mapDuProprioListing,
      emptyPayloadError:
        "Missing or empty listings. Send a DuProprio listing array or a browser capture envelope.",
      messageBuilder: ({ received, created, updated, deduped, skipped }) =>
        `Ingested ${received} DuProprio listings (${created} new, ${updated} updated, ${deduped} deduped, ${skipped} skipped).`,
    });
    return Response.json(result.body, { status: result.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "DuProprio ingest failed";
    return Response.json({ ok: false, error: message, source: "duproprio_ca" }, { status: 500 });
  }
}
