import type { Listing } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fetchAllRealtorCaListings, mapRealtorCaListing } from "@/lib/realtor-ca-api";
import { fetchAllCentrisListings, mapCentrisListing } from "@/lib/centris-api";
import { deriveNormalizedProfile } from "@/lib/normalized-profile";
import { upsertMappedListing, type MappedListingInput } from "@/lib/listing-sync";

export type StrategicSource = "realtor_ca" | "centris_ca" | "duproprio_ca";
export type StrategicLane =
  | "five_plus_multifamily"
  | "small_bay_2to4"
  | "broad_residential";
export type StrategicMode = "preview" | "ingest";

export interface StrategicSegment {
  source: StrategicSource;
  market: string;
  city: string;
  provinceCode: string;
  lane: StrategicLane;
  priceMin: number;
  priceMax: number;
  minBedrooms?: number;
  maxBedrooms?: number;
  maxResults: number;
  priority: number;
  wasSplit?: boolean;
}

type MarketConfig = {
  city: string;
  provinceCode: string;
  sources: StrategicSource[];
  broadResidentialBands: Array<[number, number]>;
  smallBayBands: Array<[number, number]>;
  multifamilyBands: Array<[number, number]>;
};

const MARKET_CONFIGS: Record<string, MarketConfig> = {
  montreal: {
    city: "Montreal",
    provinceCode: "QC",
    sources: ["centris_ca", "realtor_ca"],
    broadResidentialBands: [[0, 400000], [400000, 700000], [700000, 1100000], [1100000, 1800000], [1800000, 5000000]],
    smallBayBands: [[0, 800000], [800000, 1200000], [1200000, 1800000], [1800000, 6000000]],
    multifamilyBands: [[0, 1500000], [1500000, 3000000], [3000000, 6000000], [6000000, 25000000]],
  },
  toronto: {
    city: "Toronto",
    provinceCode: "ON",
    sources: ["realtor_ca"],
    broadResidentialBands: [[0, 500000], [500000, 900000], [900000, 1500000], [1500000, 2500000], [2500000, 7500000]],
    smallBayBands: [[0, 1250000], [1250000, 2000000], [2000000, 3000000], [3000000, 10000000]],
    multifamilyBands: [[0, 3000000], [3000000, 7000000], [7000000, 15000000], [15000000, 50000000]],
  },
  ottawa: {
    city: "Ottawa",
    provinceCode: "ON",
    sources: ["realtor_ca"],
    broadResidentialBands: [[0, 400000], [400000, 700000], [700000, 1100000], [1100000, 1800000], [1800000, 5000000]],
    smallBayBands: [[0, 800000], [800000, 1200000], [1200000, 1800000], [1800000, 6000000]],
    multifamilyBands: [[0, 1500000], [1500000, 3000000], [3000000, 6000000], [6000000, 25000000]],
  },
  vancouver: {
    city: "Vancouver",
    provinceCode: "BC",
    sources: ["realtor_ca"],
    broadResidentialBands: [[0, 500000], [500000, 900000], [900000, 1500000], [1500000, 2500000], [2500000, 7500000]],
    smallBayBands: [[0, 1250000], [1250000, 2000000], [2000000, 3000000], [3000000, 10000000]],
    multifamilyBands: [[0, 3000000], [3000000, 7000000], [7000000, 15000000], [15000000, 50000000]],
  },
  calgary: {
    city: "Calgary",
    provinceCode: "AB",
    sources: ["realtor_ca"],
    broadResidentialBands: [[0, 400000], [400000, 700000], [700000, 1100000], [1100000, 1800000], [1800000, 5000000]],
    smallBayBands: [[0, 800000], [800000, 1200000], [1200000, 1800000], [1800000, 6000000]],
    multifamilyBands: [[0, 1500000], [1500000, 3000000], [3000000, 6000000], [6000000, 25000000]],
  },
  edmonton: {
    city: "Edmonton",
    provinceCode: "AB",
    sources: ["realtor_ca"],
    broadResidentialBands: [[0, 400000], [400000, 700000], [700000, 1100000], [1100000, 1800000], [1800000, 5000000]],
    smallBayBands: [[0, 800000], [800000, 1200000], [1200000, 1800000], [1800000, 6000000]],
    multifamilyBands: [[0, 1500000], [1500000, 3000000], [3000000, 6000000], [6000000, 25000000]],
  },
};

function buildListingLike(mapped: MappedListingInput): Listing {
  return {
    id: "",
    externalId: mapped.externalId,
    source: mapped.source,
    mlsNumber: mapped.mlsNumber,
    address: mapped.address,
    city: mapped.city,
    province: mapped.province,
    postalCode: mapped.postalCode,
    latitude: mapped.latitude,
    longitude: mapped.longitude,
    price: mapped.price,
    currency: mapped.currency,
    propertyType: mapped.propertyType,
    units: mapped.units,
    bedrooms: mapped.bedrooms,
    bathrooms: mapped.bathrooms,
    squareFeet: mapped.squareFeet,
    lotSizeSqFt: mapped.lotSizeSqFt,
    yearBuilt: mapped.yearBuilt,
    ownershipType: mapped.ownershipType,
    zoningType: mapped.zoningType,
    timeOnSourceDays: mapped.timeOnSourceDays,
    mediaDescriptionText: mapped.mediaDescriptionText,
    description: mapped.description,
    photoUrls: mapped.photoUrls,
    listingUrl: mapped.listingUrl,
    isLinkActive: null,
    linkCheckedAt: null,
    linkStatusCode: null,
    linkStatusNote: null,
    duplicateOfListingId: null,
    dedupeReason: null,
    rawJson: mapped.rawJson,
    lastSeenAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    areaId: null,
  };
}

function keepForLane(mapped: MappedListingInput, lane: StrategicLane): boolean {
  const listingLike = buildListingLike(mapped);
  const profile = deriveNormalizedProfile(listingLike);
  const isResidentialAsset =
    profile.residentialUseCategory !== "non_residential" &&
    profile.normalizedAssetType !== "land" &&
    profile.normalizedAssetType !== "parking";

  switch (lane) {
    case "five_plus_multifamily":
      return isResidentialAsset && profile.normalizedUnits >= 5;
    case "small_bay_2to4":
      return isResidentialAsset && profile.normalizedUnits >= 2 && profile.normalizedUnits <= 4;
    case "broad_residential":
    default:
      return isResidentialAsset;
  }
}

function shouldSplitSegment(segment: StrategicSegment, previewCount: number): boolean {
  return previewCount >= segment.maxResults && segment.priceMax - segment.priceMin > 250000;
}

function splitSegment(segment: StrategicSegment): [StrategicSegment, StrategicSegment] {
  const midpoint = Math.round((segment.priceMin + segment.priceMax) / 2);
  return [
    { ...segment, priceMax: midpoint, wasSplit: true },
    { ...segment, priceMin: midpoint + 1, wasSplit: true },
  ];
}

export function buildStrategicSegments(markets: string[], includeBroadResidential = false): StrategicSegment[] {
  const lanes: StrategicLane[] = includeBroadResidential
    ? ["five_plus_multifamily", "small_bay_2to4", "broad_residential"]
    : ["five_plus_multifamily", "small_bay_2to4"];
  const segments: StrategicSegment[] = [];

  for (const marketKey of markets) {
    const config = MARKET_CONFIGS[marketKey];
    if (!config) continue;

    for (const source of config.sources) {
      for (const lane of lanes) {
        const bands =
          lane === "five_plus_multifamily"
            ? config.multifamilyBands
            : lane === "small_bay_2to4"
              ? config.smallBayBands
              : config.broadResidentialBands;

        for (const [priceMin, priceMax] of bands) {
          segments.push({
            source,
            market: marketKey,
            city: config.city,
            provinceCode: config.provinceCode,
            lane,
            priceMin,
            priceMax,
            maxResults: 200,
            priority:
              lane === "broad_residential"
                ? 110
                : lane === "small_bay_2to4"
                ? 100
                : lane === "five_plus_multifamily"
                  ? 90
                  : 10,
          });
        }
      }
    }
  }

  return segments.sort((left, right) => right.priority - left.priority);
}

async function fetchSegmentMappings(segment: StrategicSegment): Promise<MappedListingInput[]> {
  if (segment.source === "realtor_ca") {
    const raw = await fetchAllRealtorCaListings({
      provinceCode: segment.provinceCode,
      city: segment.city,
      maxResults: segment.maxResults,
      minPrice: segment.priceMin,
      maxPrice: segment.priceMax,
      minBedrooms: segment.minBedrooms,
      maxBedrooms: segment.maxBedrooms,
    });
    return raw.map((item) => mapRealtorCaListing(item));
  }

  if (segment.source === "duproprio_ca") {
    throw new Error("DuProprio strategic collection is browser-assisted only. Use the DuProprio ingest route with browser capture.");
  }

  const raw = await fetchAllCentrisListings({
    provinceCode: segment.provinceCode,
    city: segment.city,
    market: segment.market,
    lane: segment.lane,
    maxResults: segment.maxResults,
    minPrice: segment.priceMin,
    maxPrice: segment.priceMax,
    minBedrooms: segment.minBedrooms,
    maxBedrooms: segment.maxBedrooms,
  });
  return raw.map((item) => mapCentrisListing(item));
}

async function withSegmentTelemetry<T>(
  runId: string,
  segment: StrategicSegment,
  callback: (segmentRunId: string) => Promise<T & {
    previewCount: number;
    keptCount: number;
    createdCount: number;
    updatedCount: number;
    skippedCount: number;
    dedupedCount: number;
    investorRelevantYield: number;
    notes?: string | null;
  }>
): Promise<T> {
  const segmentRun = await prisma.ingestSegmentRun.create({
    data: {
      ingestRunId: runId,
      source: segment.source,
      market: segment.market,
      city: segment.city,
      province: segment.provinceCode,
      lane: segment.lane,
      priceMin: segment.priceMin,
      priceMax: segment.priceMax,
      minBedrooms: segment.minBedrooms ?? null,
      maxBedrooms: segment.maxBedrooms ?? null,
      maxResults: segment.maxResults,
      priority: segment.priority,
      wasSplit: segment.wasSplit ?? false,
    },
  });

  try {
    const result = await callback(segmentRun.id);
    await prisma.ingestSegmentRun.update({
      where: { id: segmentRun.id },
      data: {
        previewCount: result.previewCount,
        keptCount: result.keptCount,
        createdCount: result.createdCount,
        updatedCount: result.updatedCount,
        skippedCount: result.skippedCount,
        dedupedCount: result.dedupedCount,
        investorRelevantYield: result.investorRelevantYield,
        notes: result.notes ?? null,
        status: "completed",
        completedAt: new Date(),
      },
    });
    return result;
  } catch (error) {
    await prisma.ingestSegmentRun.update({
      where: { id: segmentRun.id },
      data: {
        status: "failed",
        notes: error instanceof Error ? error.message : "Segment failed",
        completedAt: new Date(),
      },
    });
    throw error;
  }
}

async function runSingleSegment(runId: string, segment: StrategicSegment, mode: StrategicMode): Promise<{
  previewCount: number;
  keptCount: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  dedupedCount: number;
}> {
  return withSegmentTelemetry(runId, segment, async () => {
    const mapped = await fetchSegmentMappings(segment);
    const kept = mapped.filter((item) => keepForLane(item, segment.lane));
    const segmentNeedsSplit = shouldSplitSegment(segment, mapped.length) && !segment.wasSplit;

    if (mode === "preview" || segmentNeedsSplit) {
      return {
        previewCount: mapped.length,
        keptCount: kept.length,
        createdCount: 0,
        updatedCount: 0,
        skippedCount: mapped.length - kept.length,
        dedupedCount: 0,
        investorRelevantYield: mapped.length === 0 ? 0 : kept.length / mapped.length,
        notes: segmentNeedsSplit ? "Segment hit cap; split before ingest." : null,
      };
    }

    let createdCount = 0;
    let updatedCount = 0;
    let dedupedCount = 0;

    for (const item of kept) {
      const outcome = await upsertMappedListing(item);
      if (outcome.status === "created") createdCount += 1;
      else updatedCount += 1;
      if (outcome.duplicateOfListingId) dedupedCount += 1;
    }

    return {
      previewCount: mapped.length,
      keptCount: kept.length,
      createdCount,
      updatedCount,
      skippedCount: mapped.length - kept.length,
      dedupedCount,
      investorRelevantYield: mapped.length === 0 ? 0 : kept.length / mapped.length,
      notes: null,
    };
  });
}

export async function runStrategicIngest(options: {
  markets: string[];
  mode: StrategicMode;
  includeBroadResidential?: boolean;
}): Promise<{
  runId: string;
  processedSegments: number;
  failedSegments: number;
  previewCount: number;
  keptCount: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  dedupedCount: number;
}> {
  const segments = buildStrategicSegments(options.markets, options.includeBroadResidential ?? false);
  const run = await prisma.ingestRun.create({
    data: {
      source: options.markets.includes("montreal") ? "multi_source" : "realtor_ca",
      mode: options.mode,
      markets: options.markets.join(","),
      laneSummary: Array.from(new Set(segments.map((segment) => segment.lane))).join(","),
    },
  });

  let previewCount = 0;
  let keptCount = 0;
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let dedupedCount = 0;
  let processedSegments = 0;
  let failedSegments = 0;
  const failures: string[] = [];

  const queue = [...segments];
  while (queue.length > 0) {
    const segment = queue.shift()!;
    processedSegments += 1;
    try {
      const result = await runSingleSegment(run.id, segment, options.mode);
      previewCount += result.previewCount;
      keptCount += result.keptCount;
      createdCount += result.createdCount;
      updatedCount += result.updatedCount;
      skippedCount += result.skippedCount;
      dedupedCount += result.dedupedCount;

      if (shouldSplitSegment(segment, result.previewCount) && !segment.wasSplit) {
        const [low, high] = splitSegment(segment);
        queue.unshift(high);
        queue.unshift(low);
      }
    } catch (error) {
      failedSegments += 1;
      failures.push(
        `${segment.source}:${segment.market}:${segment.lane}:${segment.priceMin}-${segment.priceMax} -> ${
          error instanceof Error ? error.message : "Segment failed"
        }`
      );
    }
  }

  await prisma.ingestRun.update({
    where: { id: run.id },
    data: {
      status: failedSegments > 0 ? "completed_with_errors" : "completed",
      totalReceived: previewCount,
      totalKept: keptCount,
      totalCreated: createdCount,
      totalUpdated: updatedCount,
      totalSkipped: skippedCount,
      totalDeduped: dedupedCount,
      notes: failures.length > 0 ? failures.join("\n").slice(0, 4000) : null,
      completedAt: new Date(),
    },
  });

  return {
    runId: run.id,
    processedSegments,
    failedSegments,
    previewCount,
    keptCount,
    createdCount,
    updatedCount,
    skippedCount,
    dedupedCount,
  };
}
