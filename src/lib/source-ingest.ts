import type { MappedListingInput } from "@/lib/listing-sync";
import { upsertMappedListing } from "@/lib/listing-sync";
import {
  computeBrowserCapturePayloadHash,
  extractBrowserCaptureItems,
  normalizeBrowserCaptureEnvelope,
  type BrowserCaptureSource,
} from "@/lib/browser-capture";
import { deriveNormalizedProfile } from "@/lib/normalized-profile";
import { recordBrowserCaptureIngest } from "@/lib/quebec-capture-state";
import type { Listing } from "@prisma/client";

const MAX_LISTINGS_PER_REQUEST = 1000;

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

function keepForCaptureLane(mapped: MappedListingInput, lane: NonNullable<ReturnType<typeof normalizeBrowserCaptureEnvelope>>["lane"]): boolean {
  if (!lane) return true;
  const profile = deriveNormalizedProfile(buildListingLike(mapped));
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

function extractRawList(body: unknown): Record<string, unknown>[] {
  if (Array.isArray(body)) {
    return body.slice(0, MAX_LISTINGS_PER_REQUEST).filter(
      (item): item is Record<string, unknown> => Boolean(item) && typeof item === "object"
    );
  }
  const record = (body ?? {}) as Record<string, unknown>;
  const rawList =
    Array.isArray(record.listings) ? record.listings
    : Array.isArray(record.items) ? record.items
    : Array.isArray(record.results) ? record.results
    : Array.isArray(record.data) ? record.data
    : [];
  return rawList.slice(0, MAX_LISTINGS_PER_REQUEST).filter(
    (item): item is Record<string, unknown> => Boolean(item) && typeof item === "object"
  );
}

export interface IngestPayloadResult {
  ok: boolean;
  source: BrowserCaptureSource;
  received: number;
  created: number;
  updated: number;
  deduped: number;
  skipped: number;
  evaluated: number;
  message?: string;
  browserCapture?: {
    segmentKey: string;
    pageNumber: number;
    runId: string;
    state: string;
    nextPageNumber: number | null;
    completedAt: string | null;
  };
}

export async function ingestSourcePayload(params: {
  source: BrowserCaptureSource;
  body: unknown;
  mapRaw: (raw: Record<string, unknown>) => MappedListingInput;
  emptyPayloadError: string;
  messageBuilder: (counts: Pick<IngestPayloadResult, "received" | "created" | "updated" | "deduped" | "skipped">) => string;
}): Promise<{ status: number; body: IngestPayloadResult | { ok: false; source: BrowserCaptureSource; error: string } }> {
  const envelope = normalizeBrowserCaptureEnvelope(params.body, params.source);

  let rawListings: Record<string, unknown>[] = [];
  let payloadHash: string | null = null;

  if (envelope) {
    rawListings = extractBrowserCaptureItems(envelope).slice(0, MAX_LISTINGS_PER_REQUEST);
    payloadHash = computeBrowserCapturePayloadHash(envelope);
  } else {
    rawListings = extractRawList(params.body);
  }

  if (rawListings.length === 0 && !envelope) {
    return {
      status: 400,
      body: {
        ok: false,
        source: params.source,
        error: params.emptyPayloadError,
      },
    };
  }

  let created = 0;
  let updated = 0;
  let deduped = 0;
  let skipped = 0;

  for (const raw of rawListings) {
    try {
      const mapped = params.mapRaw(raw);
      if (envelope && !keepForCaptureLane(mapped, envelope.lane)) {
        skipped += 1;
        continue;
      }
      const outcome = await upsertMappedListing(mapped);
      if (outcome.status === "created") created += 1;
      else updated += 1;
      if (outcome.duplicateOfListingId) deduped += 1;
    } catch (error) {
      skipped += 1;
      console.warn(`Skip ${params.source} listing:`, error);
    }
  }

  const baseBody: IngestPayloadResult = {
    ok: true,
    source: params.source,
    received: rawListings.length,
    created,
    updated,
    deduped,
    skipped,
    evaluated: created + updated,
    message: params.messageBuilder({
      received: rawListings.length,
      created,
      updated,
      deduped,
      skipped,
    }),
  };

  if (!envelope || !payloadHash) {
    return { status: 200, body: baseBody };
  }

  const recorded = await recordBrowserCaptureIngest({
    envelope,
    payloadHash,
    counts: {
      received: rawListings.length,
      created,
      updated,
      deduped,
      skipped,
    },
    note:
      rawListings.length === 0
        ? "Capture received with no parseable listings."
        : null,
  });

  return {
    status: 200,
    body: {
      ...baseBody,
      browserCapture: {
        segmentKey: envelope.segmentKey,
        pageNumber: envelope.pageNumber,
        runId: recorded.runId,
        state: recorded.segmentState.currentState,
        nextPageNumber: recorded.segmentState.resumePageNumber,
        completedAt: recorded.segmentState.completedAt,
      },
    },
  };
}
