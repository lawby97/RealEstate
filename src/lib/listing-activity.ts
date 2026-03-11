import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const ACTIVITY_CACHE_HOURS = 24;
const LINK_CHECK_TIMEOUT_MS = 3500;
const USER_AGENT =
  "Mozilla/5.0 (compatible; InvestorListingsBot/1.0; +http://localhost:3000)";

type ListingActivityCandidate = {
  id: string;
  listingUrl: string | null;
  source: string;
  isLinkActive: boolean | null;
  linkCheckedAt: Date | null;
  linkStatusNote: string | null;
};

type LinkProbeResult = {
  isActive: boolean | null;
  statusCode: number | null;
  note: string;
};

const inFlightChecks = new Map<string, Promise<void>>();

function andWhere(...clauses: (Prisma.ListingWhereInput | undefined)[]): Prisma.ListingWhereInput {
  const filtered = clauses.filter((clause) => clause && Object.keys(clause).length > 0) as Prisma.ListingWhereInput[];
  if (filtered.length === 0) return {};
  if (filtered.length === 1) return filtered[0];
  return { AND: filtered };
}

function staleCutoff(): Date {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - ACTIVITY_CACHE_HOURS);
  return cutoff;
}

export function buildActiveListingWhere(baseWhere: Prisma.ListingWhereInput = {}): Prisma.ListingWhereInput {
  return andWhere(baseWhere, { isLinkActive: true });
}

function needsRefresh(candidate: ListingActivityCandidate, cutoff: Date): boolean {
  if (!candidate.listingUrl) return candidate.isLinkActive !== false || candidate.linkCheckedAt == null;
  if (!candidate.linkCheckedAt) return true;
  return candidate.linkCheckedAt < cutoff;
}

async function headRequest(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LINK_CHECK_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-CA,en;q=0.9,fr-CA;q=0.8,fr;q=0.7",
      },
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function probeListingUrl(listingUrl: string, source: string): Promise<LinkProbeResult> {
  try {
    const response = await headRequest(listingUrl);
    const { status } = response;

    if (status === 404 || status === 410 || status === 451) {
      return {
        isActive: false,
        statusCode: status,
        note: `Source link returned HTTP ${status}; treated as inactive.`,
      };
    }

    if ((status >= 200 && status < 500) || status === 405) {
      const hostLabel = source.toLowerCase().includes("centris")
        ? "Centris"
        : source.toLowerCase().includes("realtor")
          ? "Realtor.ca"
          : "source";
      return {
        isActive: true,
        statusCode: status,
        note: `${hostLabel} link responded with HTTP ${status}; treated as active.`,
      };
    }

    return {
      isActive: null,
      statusCode: status,
      note: `Source link returned HTTP ${status}; keeping prior cached status.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Link check failed";
    return {
      isActive: null,
      statusCode: null,
      note: `Source link check failed (${message}); keeping prior cached status.`,
    };
  }
}

async function refreshCandidate(candidate: ListingActivityCandidate): Promise<void> {
  const checkedAt = new Date();

  if (!candidate.listingUrl) {
    await prisma.listing.update({
      where: { id: candidate.id },
      data: {
        isLinkActive: false,
        linkCheckedAt: checkedAt,
        linkStatusCode: null,
        linkStatusNote: "Listing URL missing; cannot verify active source page.",
      },
    });
    return;
  }

  const probe = await probeListingUrl(candidate.listingUrl, candidate.source);
  await prisma.listing.update({
    where: { id: candidate.id },
    data: {
      isLinkActive: probe.isActive ?? candidate.isLinkActive ?? null,
      linkCheckedAt: checkedAt,
      linkStatusCode: probe.statusCode,
      linkStatusNote: probe.note,
    },
  });
}

async function refreshWithDedupe(candidate: ListingActivityCandidate): Promise<void> {
  const existing = inFlightChecks.get(candidate.id);
  if (existing) {
    await existing;
    return;
  }

  const task = refreshCandidate(candidate).finally(() => {
    inFlightChecks.delete(candidate.id);
  });
  inFlightChecks.set(candidate.id, task);
  await task;
}

async function mapWithConcurrency<T>(
  values: T[],
  concurrency: number,
  worker: (value: T) => Promise<void>
): Promise<void> {
  const queue = [...values];
  const runners = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length > 0) {
      const value = queue.shift();
      if (!value) return;
      await worker(value);
    }
  });
  await Promise.all(runners);
}

export async function refreshListingActivityCache(baseWhere: Prisma.ListingWhereInput = {}): Promise<void> {
  const cutoff = staleCutoff();
  const candidates = await prisma.listing.findMany({
    where: andWhere(baseWhere, {
      OR: [
        { linkCheckedAt: null },
        { linkCheckedAt: { lt: cutoff } },
        { isLinkActive: null },
        { linkStatusNote: { contains: "Dynamic server usage" } },
      ],
    }),
    select: {
      id: true,
      listingUrl: true,
      source: true,
      isLinkActive: true,
      linkCheckedAt: true,
      linkStatusNote: true,
    },
    orderBy: { lastSeenAt: "desc" },
  });

  const staleCandidates = candidates.filter((candidate) => needsRefresh(candidate, cutoff));
  if (staleCandidates.length === 0) return;

  await mapWithConcurrency(staleCandidates, 8, refreshWithDedupe);
}
