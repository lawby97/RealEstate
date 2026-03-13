import { prisma } from "@/lib/prisma";
import { getQuebecCaptureManifest } from "@/lib/quebec-capture-manifest";
import type { BrowserCaptureLane, BrowserCaptureSource } from "@/lib/browser-capture";

function parseArg(name: string, fallback: string): string {
  const entry = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return entry ? entry.split("=").slice(1).join("=") : fallback;
}

function hoursSince(date: Date | null): number | null {
  if (!date) return null;
  return (Date.now() - date.getTime()) / (1000 * 60 * 60);
}

async function main() {
  const source = (parseArg("source", "") || null) as BrowserCaptureSource | null;
  const lane = (parseArg("lane", "") || null) as BrowserCaptureLane | null;
  const limit = Math.min(Math.max(parseInt(parseArg("limit", "25"), 10), 1), 250);
  const dueOnly = parseArg("dueOnly", "1") === "1";

  const manifest = getQuebecCaptureManifest(source).filter((entry) => !lane || entry.lane === lane);
  const states = await prisma.captureManifestState.findMany({
    where: source ? { source } : undefined,
  });
  const stateMap = new Map(states.map((state) => [`${state.source}:${state.segmentKey}`, state]));

  const items = manifest
    .map((entry) => {
      const state = stateMap.get(`${entry.source}:${entry.segmentKey}`);
      const elapsed = hoursSince(state?.lastCapturedAt ?? null);
      const dueNow =
        !state?.lastCapturedAt ||
        (state.currentState === "completed"
          ? (elapsed ?? Number.MAX_SAFE_INTEGER) >= entry.cadenceHours
          : true);
      return {
        segmentKey: entry.segmentKey,
        source: entry.source,
        market: entry.market,
        region: entry.regionLabel,
        lane: entry.lane,
        priceBand: `${entry.priceMin}-${entry.priceMax}`,
        priority: entry.priority,
        cadenceHours: entry.cadenceHours,
        dueNow,
        state: state?.currentState ?? "pending",
        resumePageNumber: state?.resumePageNumber ?? 1,
        lastCapturedAt: state?.lastCapturedAt?.toISOString() ?? null,
        operatorHint: entry.operatorHint,
      };
    })
    .filter((entry) => (dueOnly ? entry.dueNow : true))
    .sort((left, right) =>
      Number(right.dueNow) - Number(left.dueNow) ||
      (left.state === "in_progress" ? 0 : left.state === "pending" ? 1 : 2) -
        (right.state === "in_progress" ? 0 : right.state === "pending" ? 1 : 2) ||
      right.priority - left.priority
    );

  console.log(JSON.stringify({ total: items.length, items: items.slice(0, limit) }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
