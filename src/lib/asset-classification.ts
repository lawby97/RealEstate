import type { Listing } from "@prisma/client";
import type {
  AssetClassificationProvenance,
  DataConfidence,
  NormalizedAssetSubtype,
  NormalizedAssetType,
} from "@/types/listing";

type AssetClassificationInput = Pick<
  Listing,
  | "propertyType"
  | "units"
  | "bedrooms"
  | "bathrooms"
  | "squareFeet"
  | "lotSizeSqFt"
  | "description"
  | "rawJson"
  | "price"
  | "address"
>;

export interface AssetClassificationResult {
  normalizedAssetType: NormalizedAssetType;
  normalizedAssetSubtype: NormalizedAssetSubtype;
  classificationConfidence: DataConfidence;
  classificationProvenance: AssetClassificationProvenance;
  classificationReasons: string[];
  sourceTypeConflict: boolean;
}

const PROPERTY_TYPE_TO_ASSET: Record<string, NormalizedAssetType> = {
  "single family": "single_family",
  "single-family": "single_family",
  "multi-family": "apartment",
  multifamily: "apartment",
  "multi family": "apartment",
  apartment: "apartment",
  condo: "condo",
  condominium: "condo",
  townhouse: "townhouse",
  "town house": "townhouse",
  duplex: "duplex",
  triplex: "triplex",
  fourplex: "fourplex",
  land: "land",
  parking: "parking",
  "parking lot": "parking",
  "vacant land": "land",
  "mixed use": "mixed_use",
  "mixed-use": "mixed_use",
};

const PARKING_SOURCE_RE = /\b(parking|parking lot|stationnement|garage)\b/i;
const PARKING_SPACE_RE =
  /\b(indoor parking|outdoor parking|parking space|parking spot|parking stall|garage space|garage stall|space #\d+|stall #\d+|stationnement|espace de stationnement|place de garage|garage #\d+)\b/i;
const PARKING_SPACE_NUMBER_RE = /\b(?:space|stall|spot|stationnement|garage)\s*#?\s*\d+\b/i;
const PARKING_LOT_RE =
  /\b(parking lot|surface parking|surface lot|terrain de stationnement|stationnement exterieur|stationnement extérieur|commercial parking|pay parking)\b/i;
const LAND_SOURCE_RE = /\b(vacant land|land|lot|terrain)\b/i;
const COVERED_LAND_RE =
  /\b(development|redevelopment|builder|buildable|build-to-rent|construct|construction|assemblage|assemblage de terrains|densit|zoning|site plan|investor|development site|future project|projet|developpement|développement)\b/i;
const RESIDENTIAL_SOURCE_RE =
  /\b(single family|house|residential|apartment|condo|condominium|townhouse|duplex|triplex|fourplex|multi-family|multifamily)\b/i;
const RESIDENTIAL_TEXT_RE =
  /\b(bedroom|bedrooms|bathroom|bathrooms|kitchen|living room|maison|house|condo|condominium|apartment|loft|studio|chambre|salle de bain|cuisine|salon)\b/i;

function parseRawJson(rawJson: string | null): Record<string, unknown> | null {
  if (!rawJson) return null;
  try {
    const parsed = JSON.parse(rawJson);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function toStringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function extractSourceTypes(input: AssetClassificationInput, raw: Record<string, unknown> | null): string[] {
  const property = raw && typeof raw.Property === "object" ? (raw.Property as Record<string, unknown>) : null;
  const building = raw && typeof raw.Building === "object" ? (raw.Building as Record<string, unknown>) : null;
  return [
    input.propertyType,
    toStringValue(property?.Type),
    toStringValue(building?.Type),
    toStringValue(property?.ZoningType),
    toStringValue(raw?.OwnershipType),
    toStringValue(raw?.propertyType),
    toStringValue(raw?.type),
  ].filter(Boolean);
}

function extractTextFragments(input: AssetClassificationInput, raw: Record<string, unknown> | null): string[] {
  const property = raw && typeof raw.Property === "object" ? (raw.Property as Record<string, unknown>) : null;
  const media = Array.isArray(raw?.Media) ? (raw?.Media as Array<Record<string, unknown>>) : [];
  const photos = Array.isArray(property?.Photo) ? (property?.Photo as Array<Record<string, unknown>>) : [];
  return [
    input.address,
    input.description,
    toStringValue(raw?.PublicRemarks),
    ...media.map((item) => toStringValue(item?.Description)),
    ...photos.map((item) => toStringValue(item?.Description)),
  ].filter(Boolean) as string[];
}

function extractLotSizeSqFt(input: AssetClassificationInput, raw: Record<string, unknown> | null): number | null {
  if (input.lotSizeSqFt != null && Number.isFinite(input.lotSizeSqFt)) {
    return input.lotSizeSqFt;
  }
  const land = raw && typeof raw.Land === "object" ? (raw.Land as Record<string, unknown>) : null;
  const total = toStringValue(land?.SizeTotal);
  if (!total) return null;

  const metricMatch = total.match(/([\d.]+)\s*m2/i);
  if (metricMatch) {
    const value = Number(metricMatch[1]);
    return Number.isFinite(value) ? value * 10.7639 : null;
  }

  const imperialMatch = total.match(/([\d.]+)\s*(sq\.?\s*ft|sqft|ft2)/i);
  if (imperialMatch) {
    const value = Number(imperialMatch[1]);
    return Number.isFinite(value) ? value : null;
  }

  return null;
}

function uniqueReasons(reasons: string[]): string[] {
  return Array.from(new Set(reasons.filter(Boolean)));
}

function subtypeLabel(subtype: NormalizedAssetSubtype, assetType: NormalizedAssetType): string {
  switch (subtype) {
    case "parking_space":
      return "Parking space";
    case "parking_lot":
      return "Parking lot";
    case "vacant_land":
      return "Vacant land";
    case "covered_land":
      return "Covered land";
    default:
      switch (assetType) {
        case "single_family":
          return "Single-family";
        case "duplex":
          return "Duplex";
        case "triplex":
          return "Triplex";
        case "fourplex":
          return "Fourplex";
        case "townhouse":
          return "Townhouse";
        case "condo":
          return "Condo";
        case "mixed_use":
          return "Mixed-use";
        case "apartment":
          return "Apartment";
        case "land":
          return "Land";
        case "parking":
          return "Parking";
        default:
          return "Property";
      }
  }
}

function fallbackAssetType(propertyType: string, units: number): {
  assetType: NormalizedAssetType;
  confidence: DataConfidence;
  provenance: AssetClassificationProvenance;
} {
  const key = propertyType?.toLowerCase().trim() ?? "";
  const fromMap = PROPERTY_TYPE_TO_ASSET[key];
  if (fromMap) {
    if (fromMap === "land" || fromMap === "parking") {
      return { assetType: fromMap, confidence: "high", provenance: "source" };
    }
    if (
      units >= 5 &&
      (fromMap === "apartment" || fromMap === "duplex" || fromMap === "triplex" || fromMap === "fourplex")
    ) {
      return { assetType: "apartment", confidence: "high", provenance: "source" };
    }
    if (units === 2 && fromMap === "duplex") return { assetType: "duplex", confidence: "high", provenance: "source" };
    if (units === 3 && fromMap === "triplex") return { assetType: "triplex", confidence: "high", provenance: "source" };
    if (units === 4 && fromMap === "fourplex") return { assetType: "fourplex", confidence: "high", provenance: "source" };
    return { assetType: fromMap, confidence: "medium", provenance: "source" };
  }
  if (units >= 5) return { assetType: "apartment", confidence: "medium", provenance: "structural_inferred" };
  if (units === 4) return { assetType: "fourplex", confidence: "low", provenance: "structural_inferred" };
  if (units === 3) return { assetType: "triplex", confidence: "low", provenance: "structural_inferred" };
  if (units === 2) return { assetType: "duplex", confidence: "low", provenance: "structural_inferred" };
  if (units === 1) return { assetType: "single_family", confidence: "low", provenance: "structural_inferred" };
  return { assetType: "apartment", confidence: "low", provenance: "structural_inferred" };
}

export function formatNormalizedAssetLabel(
  assetType: NormalizedAssetType,
  subtype: NormalizedAssetSubtype = "unknown"
): string {
  return subtypeLabel(subtype, assetType);
}

export function classifyAsset(input: AssetClassificationInput): AssetClassificationResult {
  const raw = parseRawJson(input.rawJson);
  const units = input.units ?? 1;
  const sourceTypes = extractSourceTypes(input, raw);
  const textFragments = extractTextFragments(input, raw);
  const sourceText = sourceTypes.join(" ");
  const fullText = textFragments.join(" ");
  const normalizedText = `${sourceText} ${fullText}`.toLowerCase();
  const lotSizeSqFt = extractLotSizeSqFt(input, raw);

  const explicitParkingSource = PARKING_SOURCE_RE.test(sourceText);
  const explicitLandSource = LAND_SOURCE_RE.test(sourceText);
  const strongParkingText = PARKING_SPACE_RE.test(fullText) || PARKING_LOT_RE.test(fullText);
  const parkingLotText = PARKING_LOT_RE.test(fullText);
  const numberedParkingSpace = PARKING_SPACE_NUMBER_RE.test(fullText);
  const hasResidentialSource = RESIDENTIAL_SOURCE_RE.test(sourceText);
  const hasResidentialText = RESIDENTIAL_TEXT_RE.test(fullText);
  const hasResidentialShape =
    (input.bedrooms ?? 0) > 0 || (input.bathrooms ?? 0) > 0 || (input.squareFeet ?? 0) >= 350;
  const residentialSignals = hasResidentialSource || hasResidentialText || hasResidentialShape;
  const nonDwellingShape =
    input.bedrooms == null &&
    input.bathrooms == null &&
    (input.squareFeet == null || input.squareFeet < 250) &&
    units <= 1;
  const tinyLot = lotSizeSqFt != null && lotSizeSqFt <= 400;
  const lowPrice = input.price != null && input.price <= 250000;
  const strongParkingSupport = nonDwellingShape || tinyLot || lowPrice;
  const coveredLandSignals = COVERED_LAND_RE.test(normalizedText);

  if (explicitParkingSource) {
    const subtype: NormalizedAssetSubtype =
      parkingLotText || (!numberedParkingSpace && lotSizeSqFt != null && lotSizeSqFt > 1200)
        ? "parking_lot"
        : "parking_space";
    return {
      normalizedAssetType: "parking",
      normalizedAssetSubtype: subtype,
      classificationConfidence: "high",
      classificationProvenance: "source",
      classificationReasons: uniqueReasons([
        `Source fields indicate ${subtypeLabel(subtype, "parking").toLowerCase()}.`,
      ]),
      sourceTypeConflict: !PARKING_SOURCE_RE.test(input.propertyType),
    };
  }

  if (!residentialSignals && strongParkingText && strongParkingSupport) {
    const subtype: NormalizedAssetSubtype =
      parkingLotText || (!numberedParkingSpace && lotSizeSqFt != null && lotSizeSqFt > 1200)
        ? "parking_lot"
        : "parking_space";
    const reasons = uniqueReasons([
      explicitLandSource ? `Raw source type is ${input.propertyType}, but remarks indicate a parking asset.` : "",
      strongParkingText ? "Listing remarks/media explicitly describe parking or garage use." : "",
      nonDwellingShape ? "No dwelling fields are present, which matches a parking asset." : "",
      tinyLot ? "The listed area is small enough to fit a parking space rather than a land parcel." : "",
      lowPrice ? "Price band is consistent with a parking asset rather than developable land." : "",
    ]);

    return {
      normalizedAssetType: "parking",
      normalizedAssetSubtype: subtype,
      classificationConfidence:
        explicitLandSource && (nonDwellingShape || tinyLot) ? "high" : "medium",
      classificationProvenance: explicitLandSource ? "mixed_signal" : "description_inferred",
      classificationReasons: reasons,
      sourceTypeConflict: true,
    };
  }

  if (explicitLandSource || PROPERTY_TYPE_TO_ASSET[input.propertyType?.toLowerCase().trim() ?? ""] === "land") {
    const subtype: NormalizedAssetSubtype = coveredLandSignals ? "covered_land" : "vacant_land";
    const reasons = uniqueReasons([
      `Source type indicates ${subtype === "covered_land" ? "land with redevelopment cues" : "vacant land"}.`,
      coveredLandSignals ? "Description or zoning language suggests redevelopment or covered-land potential." : "",
    ]);

    return {
      normalizedAssetType: "land",
      normalizedAssetSubtype: subtype,
      classificationConfidence: coveredLandSignals ? "medium" : "high",
      classificationProvenance: "source",
      classificationReasons: reasons,
      sourceTypeConflict: false,
    };
  }

  const fallback = fallbackAssetType(input.propertyType, units);
  return {
    normalizedAssetType: fallback.assetType,
    normalizedAssetSubtype: "unknown",
    classificationConfidence: fallback.confidence,
    classificationProvenance: fallback.provenance,
    classificationReasons: uniqueReasons([
      fallback.provenance === "source"
        ? "Normalized from the source property type."
        : "Normalized from unit count because source property type was too generic.",
    ]),
    sourceTypeConflict: false,
  };
}
