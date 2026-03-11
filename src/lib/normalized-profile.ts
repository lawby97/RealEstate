/**
 * Derive normalized listing profile from raw listing.
 * Platform-owned; user never edits these fields.
 */

import type { Listing } from "@prisma/client";
import type { NormalizedAssetType } from "@/types/listing";
import { resolveCmhcZone } from "./cmhc-zone";

export type ProvenanceByField = Record<string, "source" | "inferred" | "internally_reviewed" | "internal_override">;

const PROPERTY_TYPE_TO_ASSET: Record<string, NormalizedAssetType> = {
  "single family": "single_family",
  "single-family": "single_family",
  "multi-family": "apartment",
  "multifamily": "apartment",
  "multi family": "apartment",
  "apartment": "apartment",
  "condo": "condo",
  "condominium": "condo",
  "townhouse": "townhouse",
  "town house": "townhouse",
  "duplex": "duplex",
  "triplex": "triplex",
  "fourplex": "fourplex",
  "land": "land",
  "parking": "parking",
  "parking lot": "parking",
  "vacant land": "land",
  "mixed use": "mixed_use",
  "mixed-use": "mixed_use",
};

function normalizeAssetType(
  propertyType: string,
  units: number
): { assetType: NormalizedAssetType; confidence: "high" | "medium" | "low"; provenance: "source" | "inferred" } {
  const key = propertyType?.toLowerCase().trim() ?? "";
  const fromMap = PROPERTY_TYPE_TO_ASSET[key];
  if (fromMap) {
    if (fromMap === "land" || fromMap === "parking")
      return { assetType: fromMap, confidence: "high", provenance: "source" };
    if (units >= 5 && (fromMap === "apartment" || fromMap === "duplex" || fromMap === "triplex" || fromMap === "fourplex"))
      return { assetType: "apartment", confidence: "high", provenance: "source" };
    if (units === 2 && fromMap === "duplex") return { assetType: "duplex", confidence: "high", provenance: "source" };
    if (units === 3 && fromMap === "triplex") return { assetType: "triplex", confidence: "high", provenance: "source" };
    if (units === 4 && fromMap === "fourplex") return { assetType: "fourplex", confidence: "high", provenance: "source" };
    return { assetType: fromMap, confidence: "medium", provenance: "source" };
  }
  if (units >= 5) return { assetType: "apartment", confidence: "medium", provenance: "inferred" };
  if (units === 4) return { assetType: "fourplex", confidence: "low", provenance: "inferred" };
  if (units === 3) return { assetType: "triplex", confidence: "low", provenance: "inferred" };
  if (units === 2) return { assetType: "duplex", confidence: "low", provenance: "inferred" };
  if (units === 1) return { assetType: "single_family", confidence: "low", provenance: "inferred" };
  return { assetType: "apartment", confidence: "low", provenance: "inferred" };
}

function unitsConfidence(units: number, sourceUnits: number): "high" | "medium" | "low" {
  if (sourceUnits === units && sourceUnits > 0) return "high";
  if (sourceUnits > 0) return "medium";
  return "low";
}

export interface NormalizedProfileResult {
  normalizedAssetType: NormalizedAssetType;
  normalizedUnits: number;
  assetTypeConfidence: "high" | "medium" | "low";
  unitsConfidence: "high" | "medium" | "low";
  residentialUseCategory: "residential" | "mixed_use" | "non_residential";
  residentialShareEstimated: number | null;
  redevelopmentCandidate: boolean;
  strategyEligibilityFlags: Record<string, boolean>;
  normalizationNotes: string | null;
  reviewStatus: "auto" | "needs_review" | "reviewed" | "overridden";
  provenanceByField: ProvenanceByField;
  zoneLabel: string | null;
  zoneMatchMethod: "exact_postal" | "fsa" | "geospatial" | "fallback_city" | "fallback_province" | "internal_override" | null;
  zoneMatchConfidence: number | null;
  hasInferredFields: boolean;
}

/**
 * Derive normalized profile from a listing. Does not require DB; can be used for display or to upsert ListingProfile.
 */
export function deriveNormalizedProfile(listing: Listing): NormalizedProfileResult {
  const units = listing.units ?? 1;
  const { assetType, confidence: atConf, provenance: atProv } = normalizeAssetType(
    listing.propertyType,
    units
  );
  const prov: ProvenanceByField = {
    normalizedAssetType: atProv,
    normalizedUnits: listing.units != null && listing.units > 0 ? "source" : "inferred",
  };
  const unitsConf = unitsConfidence(units, listing.units ?? 0);

  let residentialUseCategory: "residential" | "mixed_use" | "non_residential" = "residential";
  let residentialShareEstimated: number | null = 1;
  let redevelopmentCandidate = false;

  if (assetType === "land" || assetType === "parking") {
    residentialUseCategory = "non_residential";
    residentialShareEstimated = null;
    redevelopmentCandidate = true;
  } else if (assetType === "mixed_use") {
    residentialUseCategory = "mixed_use";
    residentialShareEstimated = 0.7;
  }

  const { cma, zone } = resolveCmhcZone(
    listing.city,
    listing.province,
    listing.postalCode
  );
  const zoneLabel = zone ?? null;
  const zoneMatchMethod: NormalizedProfileResult["zoneMatchMethod"] = zone
    ? "fsa"
    : "fallback_city";
  const zoneMatchConfidence = zone ? 0.9 : 0.6;

  const strategyEligibilityFlags: Record<string, boolean> = {
    conventional_owner_occupied:
      units >= 1 &&
      units <= 4 &&
      ["single_family", "condo", "townhouse", "duplex", "triplex", "fourplex"].includes(assetType),
    cmhc_homeowner:
      units >= 1 &&
      units <= 4 &&
      ["single_family", "condo", "townhouse", "duplex", "triplex", "fourplex"].includes(assetType),
    cmhc_home_start:
      units >= 1 &&
      units <= 4 &&
      ["single_family", "condo", "townhouse", "duplex", "triplex", "fourplex"].includes(assetType),
    cmhc_improvement_owner_occupied:
      units >= 1 &&
      units <= 4 &&
      ["single_family", "townhouse", "duplex", "triplex", "fourplex"].includes(assetType),
    conventional_investor_small_bay:
      units >= 1 &&
      units <= 4 &&
      residentialUseCategory !== "non_residential" &&
      assetType !== "land" &&
      assetType !== "parking",
    cmhc_income_property: units >= 2 && units <= 4 && residentialUseCategory === "residential",
    cmhc_improvement_small_rental: units >= 2 && units <= 4 && residentialUseCategory === "residential",
    bridge_conventional_small_bay_refi:
      units >= 1 &&
      units <= 4 &&
      residentialUseCategory !== "non_residential" &&
      assetType !== "land" &&
      assetType !== "parking",
    bridge_cmhc_income_property_takeout:
      units >= 2 && units <= 4 && residentialUseCategory === "residential",
    owner_occupied_improvement_refi:
      units >= 1 &&
      units <= 4 &&
      ["single_family", "townhouse", "duplex", "triplex", "fourplex"].includes(assetType),
    conventional_multifamily_hold: units >= 5 && residentialUseCategory !== "non_residential",
    cmhc_standard_rental_existing: units >= 5 && residentialUseCategory !== "non_residential",
    mli_select_existing: units >= 5 && residentialUseCategory !== "non_residential",
    bridge_conventional_multifamily: units >= 5 && residentialUseCategory !== "non_residential",
    bridge_standard_rental_takeout: units >= 5 && residentialUseCategory !== "non_residential",
    bridge_mli_select_takeout: units >= 5 && residentialUseCategory !== "non_residential",
    conventional_construction_takeout: redevelopmentCandidate,
    cmhc_standard_rental_new_construction: redevelopmentCandidate,
    mli_select_new_construction: redevelopmentCandidate,
    aclp_construction_stabilization: redevelopmentCandidate && units >= 5,
    conventional_land_bridge_hold:
      redevelopmentCandidate || assetType === "land" || assetType === "parking",
  };

  const hasInferredFields = Object.values(prov).some((p) => p === "inferred");
  const reviewStatus = hasInferredFields ? "needs_review" : "auto";

  return {
    normalizedAssetType: assetType,
    normalizedUnits: units,
    assetTypeConfidence: atConf,
    unitsConfidence: unitsConf,
    residentialUseCategory,
    residentialShareEstimated,
    redevelopmentCandidate,
    strategyEligibilityFlags,
    normalizationNotes: hasInferredFields ? "Some fields inferred from property type and unit count." : null,
    reviewStatus,
    provenanceByField: prov,
    zoneLabel,
    zoneMatchMethod,
    zoneMatchConfidence,
    hasInferredFields,
  };
}
