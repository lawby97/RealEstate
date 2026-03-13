import { prisma } from "@/lib/prisma";
import { getQuebecCaptureManifest } from "@/lib/quebec-capture-manifest";
import type { BrowserCaptureSource, BrowserCaptureLane } from "@/lib/browser-capture";
import type { QuebecCaptureScope } from "@/lib/quebec-capture-manifest";

function hoursSince(dateIso: string | null): number | null {
  if (!dateIso) return null;
  const millis = Date.now() - new Date(dateIso).getTime();
  return millis >= 0 ? millis / (1000 * 60 * 60) : 0;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const source = (searchParams.get("source") as BrowserCaptureSource | null) ?? null;
  const lane = (searchParams.get("lane") as BrowserCaptureLane | null) ?? null;
  const scope = (searchParams.get("scope") as QuebecCaptureScope | null) ?? "quebec_full";
  const nextOnly = searchParams.get("next") === "1" || searchParams.get("next") === "true";
  const dueOnly = searchParams.get("dueOnly") === "1" || searchParams.get("dueOnly") === "true";
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "50", 10), 1), 250);

  const manifest = getQuebecCaptureManifest(source, scope).filter((entry) => !lane || entry.lane === lane);
  const states = await prisma.captureManifestState.findMany({
    where: source ? { source } : undefined,
  });
  const stateMap = new Map(states.map((state) => [`${state.source}:${state.segmentKey}`, state]));

  const entries = manifest
    .map((entry) => {
      const state = stateMap.get(`${entry.source}:${entry.segmentKey}`);
      const lastCapturedAt = state?.lastCapturedAt ? state.lastCapturedAt.toISOString() : null;
      const hoursSinceCapture = hoursSince(lastCapturedAt);
      const dueNow =
        !lastCapturedAt ||
        (state?.currentState === "completed"
          ? (hoursSinceCapture ?? Number.MAX_SAFE_INTEGER) >= entry.cadenceHours
          : true);
      const resumePageNumber = state?.resumePageNumber ?? 1;

      return {
        ...entry,
        state: state?.currentState ?? "pending",
        lastCapturedAt,
        hoursSinceCapture,
        dueNow,
        resumePageNumber,
        lastPageNumber: state?.lastPageNumber ?? null,
        lastPageUrl: state?.lastPageUrl ?? null,
        totalCaptures: state?.totalCaptures ?? 0,
        totalListingsReceived: state?.totalListingsReceived ?? 0,
        totalCreated: state?.totalCreated ?? 0,
        totalUpdated: state?.totalUpdated ?? 0,
        totalDeduped: state?.totalDeduped ?? 0,
        totalSkipped: state?.totalSkipped ?? 0,
        completedAt: state?.completedAt ? state.completedAt.toISOString() : null,
        notes: state?.notes ?? null,
      };
    })
    .filter((entry) => (dueOnly ? entry.dueNow : true))
    .sort((left, right) => {
      const stateRank = (value: string) =>
        value === "in_progress" ? 0 : value === "pending" ? 1 : value === "completed" ? 2 : 3;
      return (
        Number(right.dueNow) - Number(left.dueNow) ||
        stateRank(left.state) - stateRank(right.state) ||
        right.priority - left.priority ||
        left.segmentKey.localeCompare(right.segmentKey)
      );
    });

  if (nextOnly) {
    return Response.json({
      ok: true,
      scope,
      item: entries[0] ?? null,
      total: entries.length,
    });
  }

  return Response.json({
    ok: true,
    scope,
    total: entries.length,
    items: entries.slice(0, limit),
  });
}
