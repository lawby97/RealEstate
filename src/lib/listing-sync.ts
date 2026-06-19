import { prisma } from "@/lib/prisma";
import { evaluateListing } from "@/lib/evaluation";
import { mapCentrisListing, type CentrisListing } from "@/lib/centris-api";
import { findBestListingMatch } from "@/lib/listing-match";
import { mapRealtorCaListing, type RealtorCaListing } from "@/lib/realtor-ca-api";

export const MONTREAL_ISLAND_5PLEX_SYNC_SCOPE = "montreal_island_5plex_600k_1300k";
export const MONTREAL_AREA_RESIDENTIAL_SYNC_SCOPE = "montreal_area_residential_250k_1300k";

export const MONTREAL_ISLAND_5PLEX_FILTER = {
  minPrice: 600_000,
  maxPrice: 1_300_000,
  units: 5,
  cityNames: [
    "Montreal",
    "Montréal",
    "Westmount",
    "Cote-Saint-Luc",
    "Côte-Saint-Luc",
    "Mont-Royal",
    "Mount Royal",
    "Montreal West",
    "Montréal-Ouest",
    "Hampstead",
    "Dorval",
    "Pointe-Claire",
    "Kirkland",
    "Beaconsfield",
    "Baie-D'Urfe",
    "Baie-D'Urfé",
    "Sainte-Anne-de-Bellevue",
    "Senneville",
    "Dollard-des-Ormeaux",
    "L'Ile-Dorval",
    "L'Île-Dorval",
  ],
} as const;

export const GREATER_MONTREAL_CITY_NAMES = [
  "Montreal",
  "Montréal",
  "Ahuntsic-Cartierville",
  "Anjou",
  "Baie-D'Urfe",
  "Baie-D'Urfé",
  "Beaconsfield",
  "Cote-Saint-Luc",
  "Côte-Saint-Luc",
  "Dollard-des-Ormeaux",
  "Dorval",
  "Hampstead",
  "Kirkland",
  "L'Ile-Dorval",
  "L'Île-Dorval",
  "Mont-Royal",
  "Mount Royal",
  "Montreal East",
  "Montréal-Est",
  "Montreal West",
  "Montréal-Ouest",
  "Outremont",
  "Pierrefonds-Roxboro",
  "Pointe-Claire",
  "Sainte-Anne-de-Bellevue",
  "Senneville",
  "Verdun",
  "Westmount",
  "Laval",
  "Longueuil",
  "Boucherville",
  "Brossard",
  "Saint-Bruno-de-Montarville",
  "Saint-Lambert",
  "Saint-Hubert",
  "Greenfield Park",
  "Beloeil",
  "Carignan",
  "Chambly",
  "McMasterville",
  "Mont-Saint-Hilaire",
  "Saint-Basile-le-Grand",
  "Saint-Jean-sur-Richelieu",
  "Saint-Constant",
  "Delson",
  "La Prairie",
  "Candiac",
  "Sainte-Catherine",
  "Chateauguay",
  "Châteauguay",
  "Mercier",
  "Varennes",
  "Vercheres",
  "Verchères",
  "Contrecoeur",
  "Repentigny",
  "Charlemagne",
  "L'Assomption",
  "Terrebonne",
  "Mascouche",
  "Boisbriand",
  "Blainville",
  "Bois-des-Filion",
  "Lorraine",
  "Rosemere",
  "Rosemère",
  "Sainte-Therese",
  "Sainte-Thérèse",
  "Saint-Eustache",
  "Deux-Montagnes",
  "Pointe-Calumet",
  "Saint-Joseph-du-Lac",
  "Sainte-Marthe-sur-le-Lac",
  "Oka",
  "Vaudreuil-Dorion",
  "Hudson",
  "L'Ile-Perrot",
  "L'Île-Perrot",
  "Notre-Dame-de-l'Ile-Perrot",
  "Notre-Dame-de-l'Île-Perrot",
  "Pincourt",
  "Terrasse-Vaudreuil",
] as const;

export const MONTREAL_AREA_RESIDENTIAL_FILTER = {
  minPrice: 250_000,
  maxPrice: 1_300_000,
  cityNames: GREATER_MONTREAL_CITY_NAMES,
  excludeNonResidential: true,
} as const;

export type MappedListing = ReturnType<typeof mapRealtorCaListing> | ReturnType<typeof mapCentrisListing>;

export type ListingSnapshotFilters = {
  minPrice?: number;
  maxPrice?: number;
  units?: number;
  cityNames?: readonly string[];
  excludeNonResidential?: boolean;
};

export type ListingSnapshotSyncOptions = ListingSnapshotFilters & {
  syncScope: string;
  source?: string;
  markMissingAsSold?: boolean;
  allowEmptySnapshot?: boolean;
  runAt?: Date;
};

export type ListingSnapshotSyncResult = {
  source: string;
  syncScope: string;
  received: number;
  accepted: number;
  skipped: number;
  created: number;
  updated: number;
  reactivated: number;
  priceChanged: number;
  soldMarked: number;
  evaluated: number;
  filters: ListingSnapshotFilters;
};

export function resolveListingSnapshotFilters(params: {
  syncScope?: string | null;
  captureScope?: string | null;
  fallback?: ListingSnapshotFilters;
}): ListingSnapshotFilters {
  const scopes = [params.syncScope, params.captureScope].filter(Boolean);
  if (scopes.includes(MONTREAL_AREA_RESIDENTIAL_SYNC_SCOPE)) return MONTREAL_AREA_RESIDENTIAL_FILTER;
  if (scopes.includes(MONTREAL_ISLAND_5PLEX_SYNC_SCOPE)) return MONTREAL_ISLAND_5PLEX_FILTER;
  return params.fallback ?? {};
}

type CanonicalListingMatch = {
  id: string;
  externalId: string;
  source: string;
  address: string;
  city: string;
  price: number;
  units: number;
  listingStatus: string;
  listingUrl: string | null;
  photoUrls: string | null;
};

function normalizeCityName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function passesListingSnapshotFilters(
  listing: MappedListing,
  filters: ListingSnapshotFilters
): boolean {
  if (filters.minPrice != null && listing.price < filters.minPrice) return false;
  if (filters.maxPrice != null && listing.price > filters.maxPrice) return false;
  if (filters.units != null && listing.units !== filters.units) return false;
  if (filters.cityNames && filters.cityNames.length > 0) {
    const allowed = new Set(filters.cityNames.map(normalizeCityName));
    if (!allowed.has(normalizeCityName(listing.city))) return false;
  }
  if (filters.excludeNonResidential && isExcludedResidentialCaptureListing(listing)) return false;
  return true;
}

export function isExcludedResidentialCaptureListing(listing: MappedListing): boolean {
  const propertyType = listing.propertyType.toLowerCase();
  const description = (listing.description ?? "").toLowerCase();
  const listingUrl = (listing.listingUrl ?? "").toLowerCase();
  const text = `${propertyType} ${description} ${listingUrl}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const excludedTypePatterns = [
    /\bvacant\s+land\b/,
    /\bland\b/,
    /\blot\b/,
    /\bterrain\b/,
    /\bmobile\s+home\b/,
    /\bmaison\s+mobile\b/,
    /\bmanufactured\s+home\b/,
    /\bhobby\s+farm\b/,
    /\bfarmette\b/,
    /\bfermette\b/,
    /\bfarm\b/,
    /\bagricultur(?:al|e)\b/,
    /\branch\b/,
  ];
  if (excludedTypePatterns.some((pattern) => pattern.test(propertyType))) return true;

  const excludedTextPatterns = [
    /\bvacant\s+land\b/,
    /\bland\s+for\s+sale\b/,
    /\bterrain\s+(?:a|à)\s+vendre\b/,
    /\bterrain\s+vacant\b/,
    /\b(?:building|residential|vacant)\s+lot\b/,
    /\blot\s+for\s+sale\b/,
    /\bmobile\s+home\b/,
    /\bmaison\s+mobile\b/,
    /\bmanufactured\s+home\b/,
    /\bhobby\s+farm\b/,
    /\bfarmette\b/,
    /\bfermette\b/,
    /\bfarm\s+for\s+sale\b/,
    /\bagricultural\s+(?:property|land|zoning|use)\b/,
    /\branch\s+for\s+sale\b/,
  ];

  return excludedTextPatterns.some((pattern) => pattern.test(text));
}

async function upsertEvaluation(listing: {
  id: string;
  price: number;
  city: string;
  province: string;
  postalCode: string | null;
  units: number;
  bedrooms: number | null;
}) {
  const result = evaluateListing({
    price: listing.price,
    city: listing.city,
    province: listing.province,
    postalCode: listing.postalCode,
    units: listing.units,
    bedrooms: listing.bedrooms,
  });

  await prisma.listingEvaluation.upsert({
    where: { listingId: listing.id },
    create: {
      listingId: listing.id,
      cashflowScore: result.cashflowScore,
      equityGrowthScore: result.equityGrowthScore,
      combinedScore: result.combinedScore,
      cashflowNotes: result.cashflowNotes,
      equityNotes: result.equityNotes,
    },
    update: {
      cashflowScore: result.cashflowScore,
      equityGrowthScore: result.equityGrowthScore,
      combinedScore: result.combinedScore,
      cashflowNotes: result.cashflowNotes,
      equityNotes: result.equityNotes,
      computedAt: new Date(),
    },
  });
}

function canonicalExternalId(mapped: MappedListing): string {
  return mapped.source === "realtor_ca"
    ? mapped.externalId
    : `${mapped.source}:${mapped.externalId}`;
}

async function findCanonicalListing(mapped: MappedListing): Promise<CanonicalListingMatch | null> {
  const sourceMatch = await prisma.listingSource.findUnique({
    where: {
      source_externalId: {
        source: mapped.source,
        externalId: mapped.externalId,
      },
    },
    select: { listingId: true },
  });
  if (sourceMatch) {
    return prisma.listing.findUnique({
      where: { id: sourceMatch.listingId },
      select: {
        id: true,
        externalId: true,
        source: true,
        address: true,
        city: true,
        price: true,
        units: true,
        listingStatus: true,
        listingUrl: true,
        photoUrls: true,
      },
    });
  }

  const legacyMatch = await prisma.listing.findFirst({
    where: {
      source: mapped.source,
      externalId: mapped.externalId,
    },
    select: {
      id: true,
      externalId: true,
      source: true,
      address: true,
      city: true,
      price: true,
      units: true,
      listingStatus: true,
      listingUrl: true,
      photoUrls: true,
    },
  });
  if (legacyMatch) return legacyMatch;

  const tolerance = Math.max(25_000, mapped.price * 0.03);
  const candidates = await prisma.listing.findMany({
    where: {
      units: mapped.units,
      price: {
        gte: Math.max(0, mapped.price - tolerance),
        lte: mapped.price + tolerance,
      },
    },
    select: {
      id: true,
      externalId: true,
      source: true,
      address: true,
      city: true,
      price: true,
      units: true,
      listingStatus: true,
      listingUrl: true,
      photoUrls: true,
    },
    take: 100,
  });

  return findBestListingMatch(mapped, candidates);
}

function mergedSourceLabel(existingSource: string, incomingSource: string): string {
  if (existingSource === incomingSource) return existingSource;
  if (existingSource === "multi_source") return existingSource;
  return "multi_source";
}

async function upsertSourceRecord(params: {
  listingId: string;
  mapped: MappedListing;
  syncScope: string;
  runAt: Date;
  changedPrice: boolean;
}) {
  const { listingId, mapped, syncScope, runAt, changedPrice } = params;
  await prisma.listingSource.upsert({
    where: {
      source_externalId: {
        source: mapped.source,
        externalId: mapped.externalId,
      },
    },
    create: {
      listingId,
      source: mapped.source,
      externalId: mapped.externalId,
      syncScope,
      address: mapped.address,
      price: mapped.price,
      propertyType: mapped.propertyType,
      units: mapped.units,
      listingUrl: mapped.listingUrl,
      photoUrls: mapped.photoUrls,
      rawJson: mapped.rawJson,
      capturedAt: runAt,
      listingStatus: "active",
      unavailableSince: null,
      lastSeenAt: runAt,
      lastPriceChangeAt: null,
      isLinkActive: true,
      linkCheckedAt: runAt,
      linkStatusCode: 200,
      linkStatusNote: `Seen in ${syncScope} capture.`,
    },
    update: {
      listingId,
      syncScope,
      address: mapped.address,
      price: mapped.price,
      propertyType: mapped.propertyType,
      units: mapped.units,
      listingUrl: mapped.listingUrl,
      photoUrls: mapped.photoUrls,
      rawJson: mapped.rawJson,
      capturedAt: runAt,
      listingStatus: "active",
      unavailableSince: null,
      lastSeenAt: runAt,
      lastPriceChangeAt: changedPrice ? runAt : undefined,
      isLinkActive: true,
      linkCheckedAt: runAt,
      linkStatusCode: 200,
      linkStatusNote: `Seen in ${syncScope} capture.`,
    },
  });
}

async function markMissingSourceListingsSold(params: {
  source: string;
  syncScope: string;
  acceptedExternalIds: Set<string>;
  allowEmptySnapshot?: boolean;
  runAt: Date;
}): Promise<number> {
  const { source, syncScope, acceptedExternalIds, allowEmptySnapshot, runAt } = params;
  if (acceptedExternalIds.size === 0 && !allowEmptySnapshot) return 0;

  const missingSources = await prisma.listingSource.findMany({
    where: {
      source,
      syncScope,
      listingStatus: { not: "sold" },
      ...(acceptedExternalIds.size > 0
        ? { externalId: { notIn: Array.from(acceptedExternalIds) } }
        : {}),
    },
    select: { id: true, listingId: true },
  });

  if (missingSources.length === 0) return 0;

  const listingIds = Array.from(new Set(missingSources.map((sourceRow) => sourceRow.listingId)));
  await prisma.listingSource.updateMany({
    where: { id: { in: missingSources.map((sourceRow) => sourceRow.id) } },
    data: {
      listingStatus: "sold",
      unavailableSince: runAt,
      isLinkActive: false,
      linkCheckedAt: runAt,
      linkStatusCode: null,
      linkStatusNote: `No longer found in ${syncScope} nightly capture; marked sold/unavailable.`,
    },
  });

  const stillActiveSources = await prisma.listingSource.findMany({
    where: {
      listingId: { in: listingIds },
      listingStatus: { not: "sold" },
    },
    select: { listingId: true },
  });
  const activeListingIds = new Set(stillActiveSources.map((sourceRow) => sourceRow.listingId));
  const fullyMissingListingIds = listingIds.filter((listingId) => !activeListingIds.has(listingId));

  if (fullyMissingListingIds.length > 0) {
    await prisma.listing.updateMany({
      where: { id: { in: fullyMissingListingIds } },
      data: {
        listingStatus: "sold",
        soldAt: runAt,
        unavailableSince: runAt,
        isLinkActive: false,
        linkCheckedAt: runAt,
        linkStatusCode: null,
        linkStatusNote: `No longer found in ${syncScope} nightly capture; marked sold/unavailable.`,
      },
    });
  }

  return missingSources.length;
}

async function syncMappedListingSnapshot(
  rawCount: number,
  mappedListings: MappedListing[],
  options: ListingSnapshotSyncOptions
): Promise<ListingSnapshotSyncResult> {
  const source = options.source ?? mappedListings[0]?.source ?? "unknown";
  const runAt = options.runAt ?? new Date();
  const filters: ListingSnapshotFilters = {
    minPrice: options.minPrice,
    maxPrice: options.maxPrice,
    units: options.units,
    cityNames: options.cityNames,
    excludeNonResidential: options.excludeNonResidential,
  };
  const sourceMappedListings = mappedListings.map((listing) => ({
    ...listing,
    source,
  })) as MappedListing[];
  const acceptedListings = sourceMappedListings.filter((listing) =>
    passesListingSnapshotFilters(listing, filters)
  );
  const acceptedExternalIds = new Set(acceptedListings.map((listing) => listing.externalId));

  let created = 0;
  let updated = 0;
  let reactivated = 0;
  let priceChanged = 0;
  let evaluated = 0;

  for (const mapped of acceptedListings) {
    const existing = await findCanonicalListing(mapped);
    const changedPrice = existing != null && existing.price !== mapped.price;
    const wasSold = existing?.listingStatus === "sold";

    const listing = existing
      ? await prisma.listing.update({
          where: { id: existing.id },
          data: {
            source: mergedSourceLabel(existing.source, mapped.source),
            price: mapped.price,
            address: mapped.address !== "Unknown" ? mapped.address : existing.address,
            city: mapped.city,
            province: mapped.province,
            propertyType: mapped.propertyType,
            units: mapped.units,
            postalCode: mapped.postalCode,
            latitude: mapped.latitude,
            longitude: mapped.longitude,
            bedrooms: mapped.bedrooms,
            bathrooms: mapped.bathrooms,
            squareFeet: mapped.squareFeet,
            lotSizeSqFt: mapped.lotSizeSqFt,
            yearBuilt: mapped.yearBuilt,
            description: mapped.description,
            photoUrls: mapped.photoUrls ?? existing.photoUrls,
            listingUrl:
              existing.source === mapped.source || !existing.listingUrl
                ? mapped.listingUrl
                : existing.listingUrl,
            rawJson: mapped.rawJson,
            listingStatus: "active",
            soldAt: null,
            unavailableSince: null,
            syncScope: options.syncScope,
            lastSyncRunAt: runAt,
            lastSeenAt: runAt,
            lastPriceChangeAt: changedPrice ? runAt : undefined,
            isLinkActive: true,
            linkCheckedAt: runAt,
            linkStatusCode: 200,
            linkStatusNote: `Seen in ${options.syncScope} capture.`,
          },
        })
      : await prisma.listing.create({
          data: {
            ...mapped,
            externalId: canonicalExternalId(mapped),
            listingStatus: "active",
            soldAt: null,
            unavailableSince: null,
            syncScope: options.syncScope,
            lastSyncRunAt: runAt,
            lastPriceChangeAt: null,
            lastSeenAt: runAt,
            isLinkActive: true,
            linkCheckedAt: runAt,
            linkStatusCode: 200,
            linkStatusNote: `Seen in ${options.syncScope} capture.`,
          },
        });

    await upsertSourceRecord({
      listingId: listing.id,
      mapped,
      syncScope: options.syncScope,
      runAt,
      changedPrice,
    });

    if (existing == null) {
      created++;
    } else {
      updated++;
    }
    if (wasSold) reactivated++;
    if (changedPrice) priceChanged++;

    if (existing == null || changedPrice) {
      await prisma.listingPriceHistory.create({
        data: {
          listingId: listing.id,
          price: mapped.price,
          recordedAt: runAt,
        },
      });
    }

    await upsertEvaluation(listing);
    evaluated++;
  }

  const soldMarked = options.markMissingAsSold
    ? await markMissingSourceListingsSold({
        source,
        syncScope: options.syncScope,
        acceptedExternalIds,
        allowEmptySnapshot: options.allowEmptySnapshot,
        runAt,
      })
    : 0;

  return {
    source,
    syncScope: options.syncScope,
    received: rawCount,
    accepted: acceptedListings.length,
    skipped: rawCount - acceptedListings.length,
    created,
    updated,
    reactivated,
    priceChanged,
    soldMarked,
    evaluated,
    filters,
  };
}

export async function syncRealtorCaSnapshot(
  rawListings: Array<RealtorCaListing | Record<string, unknown>>,
  options: ListingSnapshotSyncOptions
): Promise<ListingSnapshotSyncResult> {
  return syncMappedListingSnapshot(
    rawListings.length,
    rawListings.map((raw) => mapRealtorCaListing(raw)),
    { ...options, source: options.source ?? "realtor_ca" }
  );
}

export async function syncCentrisSnapshot(
  rawListings: Array<CentrisListing | Record<string, unknown>>,
  options: ListingSnapshotSyncOptions
): Promise<ListingSnapshotSyncResult> {
  return syncMappedListingSnapshot(
    rawListings.length,
    rawListings.map((raw) => mapCentrisListing(raw)),
    { ...options, source: options.source ?? "centris_ca" }
  );
}
