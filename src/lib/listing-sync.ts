import type { Listing } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { evaluateListing, type EvaluatedListingSummary } from "@/lib/evaluation";
import { deriveNormalizedProfile } from "@/lib/normalized-profile";
import type { NormalizedProfileResult } from "@/lib/normalized-profile";

export interface MappedListingInput {
  externalId: string;
  source: string;
  mlsNumber: string | null;
  address: string;
  city: string;
  province: string;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  price: number;
  currency: string;
  propertyType: string;
  units: number;
  bedrooms: number | null;
  bathrooms: number | null;
  squareFeet: number | null;
  lotSizeSqFt: number | null;
  yearBuilt: number | null;
  ownershipType: string | null;
  zoningType: string | null;
  timeOnSourceDays: number | null;
  mediaDescriptionText: string | null;
  description: string | null;
  photoUrls: string | null;
  listingUrl: string | null;
  rawJson: string;
}

export interface ListingUpsertOutcome {
  listing: Listing;
  status: "created" | "updated";
  profile: NormalizedProfileResult;
  duplicateOfListingId: string | null;
  evaluation: EvaluatedListingSummary;
}

function normalizeAddressForDedupe(address: string): string {
  return address
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\|/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\b(quebec|qc|ontario|on|canada)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedTypeFamily(type: string): string {
  if (["duplex", "triplex", "fourplex", "apartment", "condo", "single_family", "townhouse"].includes(type)) {
    return "residential";
  }
  return type;
}

function looksLikeInvestorException(text: string): boolean {
  return /secondary suite|income property|intergenerational|bi-generation|bachelor|redevelopment|land assembly|parking space|stationnement/i.test(text);
}

export function isStrategicInvestorRelevant(listing: Listing, profile?: NormalizedProfileResult): boolean {
  const resolvedProfile = profile ?? deriveNormalizedProfile(listing);
  if (resolvedProfile.normalizedUnits >= 2) return true;
  if (resolvedProfile.normalizedAssetType === "land" || resolvedProfile.normalizedAssetType === "parking") return true;
  return looksLikeInvestorException([listing.description, listing.mediaDescriptionText, listing.rawJson].filter(Boolean).join(" "));
}

function sourcePriority(listing: Listing, profile: NormalizedProfileResult): number {
  const isQuebecResidential =
    listing.province === "QC" &&
    profile.residentialUseCategory !== "non_residential" &&
    profile.normalizedAssetType !== "land" &&
    profile.normalizedAssetType !== "parking";
  if (isQuebecResidential) {
    if (listing.source === "centris_ca") return 300;
    if (listing.source === "realtor_ca") return 220;
    if (listing.source === "duproprio_ca") return 160;
  }
  if (listing.source === "realtor_ca") return 200;
  if (listing.source === "centris_ca") return 100;
  if (listing.source === "duproprio_ca") return 75;
  return 50;
}

function isPriceClose(a: number, b: number): boolean {
  const tolerance = Math.max(25000, Math.max(a, b) * 0.075);
  return Math.abs(a - b) <= tolerance;
}

function isStrongFsboPriceMatch(a: number, b: number): boolean {
  const tolerance = Math.max(10000, Math.max(a, b) * 0.025);
  return Math.abs(a - b) <= tolerance;
}

function sameFamilyProfile(left: NormalizedProfileResult, right: NormalizedProfileResult): boolean {
  return normalizedTypeFamily(left.normalizedAssetType) === normalizedTypeFamily(right.normalizedAssetType);
}

async function upsertListingEvaluation(listingId: string): Promise<EvaluatedListingSummary> {
  const result = await evaluateListing(listingId);
  await prisma.listingEvaluation.upsert({
    where: { listingId },
    create: {
      listingId,
      cashflowScore: result.cashflowScore,
      equityGrowthScore: result.equityGrowthScore,
      combinedScore: result.combinedScore,
      cashflowNotes: result.cashflowNotes,
      equityNotes: result.equityNotes,
      primaryScenarioId: result.primaryScenarioId,
      primaryScenarioStatus: result.primaryScenarioStatus,
      primaryBridgeUsage: result.primaryBridgeUsage,
      primaryAnnualCashflow: result.primaryAnnualCashflow,
      primaryMonthlyCashflow: result.primaryMonthlyCashflow,
      primaryDscr: result.primaryDscr,
      primaryCashOnCashReturn: result.primaryCashOnCashReturn,
      baseHoldScenarioId: result.baseHoldScenarioId,
      baseHoldAnnualCashflow: result.baseHoldAnnualCashflow,
      baseHoldMonthlyCashflow: result.baseHoldMonthlyCashflow,
      quickVerdict: result.quickVerdict,
      carryScore: result.carryScore,
      executionScore: result.executionScore,
      upsideScore: result.upsideScore,
      confidenceScore: result.confidenceScore,
    },
    update: {
      cashflowScore: result.cashflowScore,
      equityGrowthScore: result.equityGrowthScore,
      combinedScore: result.combinedScore,
      cashflowNotes: result.cashflowNotes,
      equityNotes: result.equityNotes,
      primaryScenarioId: result.primaryScenarioId,
      primaryScenarioStatus: result.primaryScenarioStatus,
      primaryBridgeUsage: result.primaryBridgeUsage,
      primaryAnnualCashflow: result.primaryAnnualCashflow,
      primaryMonthlyCashflow: result.primaryMonthlyCashflow,
      primaryDscr: result.primaryDscr,
      primaryCashOnCashReturn: result.primaryCashOnCashReturn,
      baseHoldScenarioId: result.baseHoldScenarioId,
      baseHoldAnnualCashflow: result.baseHoldAnnualCashflow,
      baseHoldMonthlyCashflow: result.baseHoldMonthlyCashflow,
      quickVerdict: result.quickVerdict,
      carryScore: result.carryScore,
      executionScore: result.executionScore,
      upsideScore: result.upsideScore,
      confidenceScore: result.confidenceScore,
      computedAt: new Date(),
    },
  });
  return result;
}

export async function upsertListingProfile(listingId: string): Promise<NormalizedProfileResult> {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
  });
  if (!listing) {
    throw new Error(`Listing ${listingId} not found`);
  }

  const profile = deriveNormalizedProfile(listing);
  const marketCity = await prisma.marketCity.findUnique({
    where: { city_province: { city: listing.city, province: listing.province } },
    select: { id: true },
  });
  const marketZone = profile.zoneLabel && marketCity
    ? await prisma.marketZone.findFirst({
        where: {
          marketCityId: marketCity.id,
          OR: [{ zoneLabel: profile.zoneLabel }, { zoneDisplayName: profile.zoneLabel }],
        },
        select: { id: true },
      })
    : null;

  await prisma.listingProfile.upsert({
    where: { listingId },
    create: {
      listingId,
      normalizedAssetType: profile.normalizedAssetType,
      normalizedAssetSubtype: profile.normalizedAssetSubtype,
      normalizedAssetLabel: profile.normalizedAssetLabel,
      normalizedUnits: profile.normalizedUnits,
      assetTypeConfidence: profile.assetTypeConfidence,
      classificationConfidence: profile.classificationConfidence,
      classificationProvenance: profile.classificationProvenance,
      classificationReasons: JSON.stringify(profile.classificationReasons),
      sourceTypeConflict: profile.sourceTypeConflict,
      unitsConfidence: profile.unitsConfidence,
      residentialUseCategory: profile.residentialUseCategory,
      residentialShareEstimated: profile.residentialShareEstimated,
      redevelopmentCandidate: profile.redevelopmentCandidate,
      strategyEligibilityFlags: JSON.stringify(profile.strategyEligibilityFlags),
      normalizationNotes: profile.normalizationNotes,
      normalizationVersion: "2",
      reviewStatus: profile.reviewStatus,
      provenanceByField: JSON.stringify(profile.provenanceByField),
      hasInferredFields: profile.hasInferredFields,
      marketCityId: marketCity?.id,
      marketZoneId: marketZone?.id,
      zoneMatchMethod: profile.zoneMatchMethod,
      zoneMatchConfidence: profile.zoneMatchConfidence,
    },
    update: {
      normalizedAssetType: profile.normalizedAssetType,
      normalizedAssetSubtype: profile.normalizedAssetSubtype,
      normalizedAssetLabel: profile.normalizedAssetLabel,
      normalizedUnits: profile.normalizedUnits,
      assetTypeConfidence: profile.assetTypeConfidence,
      classificationConfidence: profile.classificationConfidence,
      classificationProvenance: profile.classificationProvenance,
      classificationReasons: JSON.stringify(profile.classificationReasons),
      sourceTypeConflict: profile.sourceTypeConflict,
      unitsConfidence: profile.unitsConfidence,
      residentialUseCategory: profile.residentialUseCategory,
      residentialShareEstimated: profile.residentialShareEstimated,
      redevelopmentCandidate: profile.redevelopmentCandidate,
      strategyEligibilityFlags: JSON.stringify(profile.strategyEligibilityFlags),
      normalizationNotes: profile.normalizationNotes,
      normalizationVersion: "2",
      reviewStatus: profile.reviewStatus,
      provenanceByField: JSON.stringify(profile.provenanceByField),
      hasInferredFields: profile.hasInferredFields,
      marketCityId: marketCity?.id ?? null,
      marketZoneId: marketZone?.id ?? null,
      zoneMatchMethod: profile.zoneMatchMethod,
      zoneMatchConfidence: profile.zoneMatchConfidence,
    },
  });

  return profile;
}

async function resolveDuplicateForListing(listingId: string, profile: NormalizedProfileResult): Promise<string | null> {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
  });
  if (!listing) {
    throw new Error(`Listing ${listingId} not found`);
  }

  const candidates = await prisma.listing.findMany({
    where: {
      id: { not: listingId },
      city: listing.city,
      province: listing.province,
      duplicateOfListingId: null,
    },
    include: { profile: true },
  });

  const addressKey = normalizeAddressForDedupe(listing.address);
  const duplicate = candidates.find((candidate) => {
    const candidateProfile = deriveNormalizedProfile(candidate);
    const sameMls = listing.mlsNumber && candidate.mlsNumber && listing.mlsNumber === candidate.mlsNumber;
    const involvesFsbo = listing.source === "duproprio_ca" || candidate.source === "duproprio_ca";
    const sameAddress =
      normalizeAddressForDedupe(candidate.address) === addressKey &&
      (involvesFsbo ? isStrongFsboPriceMatch(candidate.price, listing.price) : isPriceClose(candidate.price, listing.price)) &&
      Math.abs((candidate.units ?? 1) - (listing.units ?? 1)) <= (involvesFsbo ? 0 : 1);
    const sameTypeFamily = sameFamilyProfile(profile, candidateProfile);
    if (!sameTypeFamily) return false;
    if (involvesFsbo) {
      return sameAddress;
    }
    return sameMls || sameAddress;
  });

  if (!duplicate) {
    await prisma.listing.update({
      where: { id: listingId },
      data: { duplicateOfListingId: null, dedupeReason: null },
    });
    return null;
  }

  const duplicateProfile = deriveNormalizedProfile(duplicate);
  const listingPriority = sourcePriority(listing, profile);
  const duplicatePriority = sourcePriority(duplicate, duplicateProfile);
  const canonical = duplicatePriority >= listingPriority ? duplicate : listing;
  const secondary = canonical.id === listing.id ? duplicate : listing;

  await prisma.listing.update({
    where: { id: secondary.id },
    data: {
      duplicateOfListingId: canonical.id,
      dedupeReason:
        listing.mlsNumber && duplicate.mlsNumber && listing.mlsNumber === duplicate.mlsNumber
          ? `Duplicate MLS ${listing.mlsNumber}; canonical source ${canonical.source}`
          : `Duplicate address/price match; canonical source ${canonical.source}`,
    },
  });

  await prisma.listing.update({
    where: { id: canonical.id },
    data: {
      duplicateOfListingId: null,
      dedupeReason: null,
    },
  });

  return secondary.id === listing.id ? canonical.id : null;
}

export async function syncListingDerivedState(listingId: string): Promise<{
  profile: NormalizedProfileResult;
  duplicateOfListingId: string | null;
  evaluation: EvaluatedListingSummary;
}> {
  const profile = await upsertListingProfile(listingId);
  const duplicateOfListingId = await resolveDuplicateForListing(listingId, profile);
  const evaluation = await upsertListingEvaluation(listingId);
  return { profile, duplicateOfListingId, evaluation };
}

export async function upsertMappedListing(mapped: MappedListingInput): Promise<ListingUpsertOutcome> {
  const existing = await prisma.listing.findUnique({
    where: { externalId: mapped.externalId },
    select: { id: true },
  });

  const listing = await prisma.listing.upsert({
    where: { externalId: mapped.externalId },
    create: {
      ...mapped,
      isLinkActive: null,
      linkCheckedAt: null,
      linkStatusCode: null,
      linkStatusNote: null,
    },
    update: {
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
      rawJson: mapped.rawJson,
      lastSeenAt: new Date(),
      isLinkActive: null,
      linkCheckedAt: null,
      linkStatusCode: null,
      linkStatusNote: null,
    },
  });

  const { profile, duplicateOfListingId, evaluation } = await syncListingDerivedState(listing.id);
  return {
    listing,
    status: existing ? "updated" : "created",
    profile,
    duplicateOfListingId,
    evaluation,
  };
}
