import { parseUnitBedroomMix } from "@/lib/quebec-unit-mix";
import type { MappedListingInput } from "@/lib/listing-sync";

type DuProprioListing = Record<string, unknown>;

function normalizeString(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function parseNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number.parseFloat(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function inferUnits(propertyType: string, description: string | null, explicitUnits: number | null): number {
  if (explicitUnits && explicitUnits > 0) return explicitUnits;
  const value = propertyType.toLowerCase();
  if (value.includes("duplex")) return 2;
  if (value.includes("triplex")) return 3;
  if (value.includes("fourplex") || value.includes("quad")) return 4;
  const parsedMix = parseUnitBedroomMix([description].filter(Boolean).join(" "), 1);
  if (parsedMix?.sampleUnitCount && parsedMix.sampleUnitCount > 1) return parsedMix.sampleUnitCount;
  return 1;
}

function resolveAddress(raw: DuProprioListing): string {
  const direct = normalizeString(raw.address ?? raw.Address ?? raw.unparsedAddress ?? raw.UnparsedAddress);
  if (direct) return direct;
  const parts = [
    normalizeString(raw.streetNumber ?? raw.StreetNumber),
    normalizeString(raw.streetName ?? raw.StreetName),
    normalizeString(raw.city ?? raw.City),
    normalizeString(raw.province ?? raw.Province),
    normalizeString(raw.postalCode ?? raw.PostalCode),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Unknown";
}

function extractPhotoUrls(raw: DuProprioListing): string[] {
  const candidates = [raw.photos, raw.Photos, raw.images, raw.Images, raw.media, raw.Media].filter(Boolean);
  const urls: string[] = [];
  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;
    for (const item of candidate) {
      if (typeof item === "string") {
        urls.push(item);
        continue;
      }
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      const url = normalizeString(record.url ?? record.Url ?? record.src ?? record.Src ?? record.href ?? record.Href);
      if (url) urls.push(url);
    }
  }
  return urls;
}

export function mapDuProprioListing(raw: DuProprioListing): MappedListingInput {
  const id =
    normalizeString(
      raw.id ??
        raw.Id ??
        raw.listingId ??
        raw.ListingId ??
        raw.listingNumber ??
        raw.ListingNumber ??
        raw.propertyId ??
        raw.PropertyId
    ) ?? `duproprio-${Math.random().toString(36).slice(2)}`;
  const listingUrl =
    normalizeString(raw.listingUrl ?? raw.ListingUrl ?? raw.url ?? raw.Url) ??
    null;
  const description =
    normalizeString(raw.description ?? raw.Description ?? raw.remarks ?? raw.Remarks ?? raw.summary ?? raw.Summary);
  const propertyType =
    normalizeString(raw.propertyType ?? raw.PropertyType ?? raw.category ?? raw.Category ?? raw.buildingType ?? raw.BuildingType) ??
    "Unknown";
  const units = inferUnits(
    propertyType,
    description,
    parseNumber(raw.units ?? raw.Units ?? raw.numberOfUnits ?? raw.NumberOfUnits)
  );
  const parsedMix = parseUnitBedroomMix([description, JSON.stringify(raw)].filter(Boolean).join(" "), units);
  const photos = extractPhotoUrls(raw);
  const price = parseNumber(raw.price ?? raw.Price ?? raw.askingPrice ?? raw.AskingPrice) ?? 0;

  return {
    externalId: `duproprio:${id}`,
    source: "duproprio_ca",
    mlsNumber: null,
    address: resolveAddress(raw),
    city: normalizeString(raw.city ?? raw.City ?? raw.municipality ?? raw.Municipality)?.normalize("NFD").replace(/[\u0300-\u036f]/g, "") ?? "Unknown",
    province: normalizeString(raw.province ?? raw.Province ?? raw.provinceCode ?? raw.ProvinceCode) ?? "QC",
    postalCode: normalizeString(raw.postalCode ?? raw.PostalCode ?? raw.zip ?? raw.ZipCode),
    latitude: parseNumber(raw.latitude ?? raw.Latitude),
    longitude: parseNumber(raw.longitude ?? raw.Longitude),
    price,
    currency: "CAD",
    propertyType,
    units,
    bedrooms: parseNumber(raw.bedrooms ?? raw.Bedrooms) ?? parsedMix?.totalBedrooms ?? null,
    bathrooms: parseNumber(raw.bathrooms ?? raw.Bathrooms),
    squareFeet:
      parseNumber(raw.squareFeet ?? raw.SquareFeet ?? raw.sizeInterior ?? raw.SizeInterior ?? raw.livingArea ?? raw.LivingArea),
    lotSizeSqFt: parseNumber(raw.lotSizeSqFt ?? raw.LotSizeSqFt ?? raw.landArea ?? raw.LandArea),
    yearBuilt: parseNumber(raw.yearBuilt ?? raw.YearBuilt ?? raw.builtYear ?? raw.BuiltYear),
    ownershipType: normalizeString(raw.ownershipType ?? raw.OwnershipType) ?? "freehold",
    zoningType: normalizeString(raw.zoningType ?? raw.ZoningType),
    timeOnSourceDays: parseNumber(raw.daysOnMarket ?? raw.DaysOnMarket ?? raw.timeOnMarketDays ?? raw.TimeOnMarketDays),
    mediaDescriptionText: null,
    description,
    photoUrls: photos.length > 0 ? JSON.stringify(photos) : null,
    listingUrl,
    rawJson: JSON.stringify(raw),
  };
}
