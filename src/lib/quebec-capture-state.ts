import { prisma } from "@/lib/prisma";
import type { BrowserCaptureEnvelope } from "@/lib/browser-capture";

export interface CaptureIngestCounts {
  received: number;
  created: number;
  updated: number;
  deduped: number;
  skipped: number;
}

export async function recordBrowserCaptureIngest(params: {
  envelope: BrowserCaptureEnvelope;
  payloadHash: string;
  counts: CaptureIngestCounts;
  note?: string | null;
}): Promise<{
  runId: string;
  segmentState: {
    currentState: string;
    resumePageNumber: number | null;
    completedAt: string | null;
  };
}> {
  const { envelope, payloadHash, counts } = params;
  const isCompleted =
    envelope.isTerminalPage === true ||
    (counts.received === 0 && envelope.captureType === "search_results");
  const run = await prisma.ingestRun.create({
    data: {
      source: envelope.source,
      mode: "browser_capture",
      markets: envelope.market ?? "quebec",
      laneSummary: envelope.lane ?? null,
      status: "completed",
      totalReceived: counts.received,
      totalKept: counts.received - counts.skipped,
      totalCreated: counts.created,
      totalUpdated: counts.updated,
      totalSkipped: counts.skipped,
      totalDeduped: counts.deduped,
      notes: params.note ?? null,
      completedAt: new Date(),
    },
  });

  await prisma.ingestSegmentRun.create({
    data: {
      ingestRunId: run.id,
      source: envelope.source,
      market: envelope.market ?? "quebec",
      city: envelope.region ?? envelope.market ?? null,
      province: "QC",
      lane: envelope.lane ?? "broad_residential",
      segmentKey: envelope.segmentKey,
      captureType: envelope.captureType,
      pageNumber: envelope.pageNumber,
      pageUrl: envelope.pageUrl,
      payloadHash,
      priority: 0,
      previewCount: counts.received,
      keptCount: counts.received - counts.skipped,
      createdCount: counts.created,
      updatedCount: counts.updated,
      skippedCount: counts.skipped,
      dedupedCount: counts.deduped,
      investorRelevantYield: null,
      status: isCompleted ? "completed" : "running",
      notes: params.note ?? null,
      completedAt: new Date(),
    },
  });

  const state = await prisma.captureManifestState.upsert({
    where: {
      source_segmentKey: {
        source: envelope.source,
        segmentKey: envelope.segmentKey,
      },
    },
    create: {
      source: envelope.source,
      segmentKey: envelope.segmentKey,
      market: envelope.market ?? "quebec",
      region: envelope.region ?? null,
      lane: envelope.lane ?? null,
      currentState: isCompleted ? "completed" : "in_progress",
      lastCaptureType: envelope.captureType,
      lastPageNumber: envelope.pageNumber,
      resumePageNumber: isCompleted ? null : envelope.pageNumber + 1,
      lastPageUrl: envelope.pageUrl,
      lastPayloadHash: payloadHash,
      lastCapturedAt: new Date(envelope.capturedAt),
      totalCaptures: 1,
      totalListingsReceived: counts.received,
      totalCreated: counts.created,
      totalUpdated: counts.updated,
      totalDeduped: counts.deduped,
      totalSkipped: counts.skipped,
      completedAt: isCompleted ? new Date(envelope.capturedAt) : null,
      notes: params.note ?? null,
    },
    update: {
      market: envelope.market ?? undefined,
      region: envelope.region ?? undefined,
      lane: envelope.lane ?? undefined,
      currentState: isCompleted ? "completed" : "in_progress",
      lastCaptureType: envelope.captureType,
      lastPageNumber: envelope.pageNumber,
      resumePageNumber: isCompleted ? null : envelope.pageNumber + 1,
      lastPageUrl: envelope.pageUrl,
      lastPayloadHash: payloadHash,
      lastCapturedAt: new Date(envelope.capturedAt),
      totalCaptures: { increment: 1 },
      totalListingsReceived: { increment: counts.received },
      totalCreated: { increment: counts.created },
      totalUpdated: { increment: counts.updated },
      totalDeduped: { increment: counts.deduped },
      totalSkipped: { increment: counts.skipped },
      completedAt: isCompleted ? new Date(envelope.capturedAt) : null,
      notes: params.note ?? null,
    },
  });

  return {
    runId: run.id,
    segmentState: {
      currentState: state.currentState,
      resumePageNumber: state.resumePageNumber,
      completedAt: state.completedAt ? state.completedAt.toISOString() : null,
    },
  };
}
