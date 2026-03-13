import { parseUnitBedroomMix } from "@/lib/quebec-unit-mix";
import type { MappedListingInput } from "@/lib/listing-sync";

const CENTRIS_PIPELINE_URL = process.env.CENTRIS_PIPELINE_URL ?? "";
const CENTRIS_PIPELINE_TOKEN = process.env.CENTRIS_PIPELINE_TOKEN ?? "";

export type CentrisSearchParams = {
  city?: string;
  provinceCode?: string;
  market?: string;
  lane?: string;
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  maxBedrooms?: number;
  maxResults?: number;
  offset?: number;
};

export type CentrisListing = Record<string, unknown>;

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

function extractPhotos(raw: Record<string, unknown>): { urls: string[]; descriptions: string[] } {
  const photoCandidates = [
    raw.photos,
    raw.Photos,
    raw.media,
    raw.Media,
    raw.images,
    raw.Images,
  ].filter(Boolean);
  const urls: string[] = [];
  const descriptions: string[] = [];

  for (const candidate of photoCandidates) {
    if (!Array.isArray(candidate)) continue;
    for (const item of candidate) {
      if (!item || typeof item !== "object") continue;
      const media = item as Record<string, unknown>;
      const url = normalizeString(
        media.url ?? media.Url ?? media.href ?? media.Href ?? media.highRes ?? media.HighResPath ?? media.src
      );
      const description = normalizeString(media.description ?? media.Description ?? media.caption ?? media.Caption);
      if (url) urls.push(url);
      if (description) descriptions.push(description);
    }
  }

  return { urls, descriptions };
}

function resolveAddress(raw: Record<string, unknown>): string {
  const address = normalizeString(
    raw.address ??
      raw.Address ??
      raw.unparsedAddress ??
      raw.UnparsedAddress ??
      raw.streetAddress ??
      raw.StreetAddress
  );
  if (address) return address;

  const parts = [
    normalizeString(raw.streetNumber ?? raw.StreetNumber),
    normalizeString(raw.streetName ?? raw.StreetName),
    normalizeString(raw.unitNumber ?? raw.UnitNumber),
    normalizeString(raw.city ?? raw.City),
    normalizeString(raw.province ?? raw.Province),
    normalizeString(raw.postalCode ?? raw.PostalCode),
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" ") : "Unknown";
}

function resolveProvince(raw: Record<string, unknown>): string {
  const province = normalizeString(raw.province ?? raw.Province ?? raw.provinceCode ?? raw.ProvinceCode);
  if (!province) return "QC";
  const mapped: Record<string, string> = {
    Quebec: "QC",
    QC: "QC",
    Ontario: "ON",
    ON: "ON",
    "British Columbia": "BC",
    BC: "BC",
    Alberta: "AB",
    AB: "AB",
  };
  return mapped[province] ?? province;
}

export function mapCentrisListing(raw: CentrisListing): MappedListingInput {
  const record = raw as Record<string, unknown>;
  const id =
    normalizeString(record.id ?? record.Id ?? record.propertyId ?? record.PropertyId ?? record.listingId ?? record.ListingId) ??
    normalizeString(record.mlsNumber ?? record.MlsNumber ?? record.numeroMls ?? record.NumeroMLS) ??
    `centris-${Math.random().toString(36).slice(2)}`;
  const mlsNumber =
    normalizeString(record.mlsNumber ?? record.MlsNumber ?? record.numeroMls ?? record.NumeroMLS ?? record.noMls ?? record.NoMLS);
  const address = resolveAddress(record);
  const city = normalizeString(record.city ?? record.City ?? record.municipality ?? record.Municipality) ?? "Unknown";
  const province = resolveProvince(record);
  const postalCode = normalizeString(record.postalCode ?? record.PostalCode ?? record.zip ?? record.ZipCode);
  const latitude = parseNumber(record.latitude ?? record.Latitude);
  const longitude = parseNumber(record.longitude ?? record.Longitude);
  const price = parseNumber(record.price ?? record.Price ?? record.listPrice ?? record.ListPrice) ?? 0;
  const propertyType =
    normalizeString(record.propertyType ?? record.PropertyType ?? record.category ?? record.Category ?? record.buildingType ?? record.BuildingType) ??
    "Unknown";
  const description =
    normalizeString(record.description ?? record.Description ?? record.remarks ?? record.Remarks ?? record.addendum ?? record.Addendum);
  const units = inferUnits(
    propertyType,
    description,
    parseNumber(record.units ?? record.Units ?? record.numberOfUnits ?? record.NumberOfUnits)
  );
  const parsedMix = parseUnitBedroomMix([description, JSON.stringify(raw)].filter(Boolean).join(" "), units);
  const bedrooms = parseNumber(record.bedrooms ?? record.Bedrooms) ?? parsedMix?.totalBedrooms ?? null;
  const bathrooms = parseNumber(record.bathrooms ?? record.Bathrooms);
  const squareFeet =
    parseNumber(record.squareFeet ?? record.SquareFeet ?? record.sizeInterior ?? record.SizeInterior ?? record.livingArea ?? record.LivingArea);
  const lotSizeSqFt = parseNumber(record.lotSizeSqFt ?? record.LotSizeSqFt ?? record.landArea ?? record.LandArea);
  const yearBuilt = parseNumber(record.yearBuilt ?? record.YearBuilt ?? record.builtYear ?? record.BuiltYear);
  const ownershipType = normalizeString(record.ownershipType ?? record.OwnershipType);
  const zoningType = normalizeString(record.zoningType ?? record.ZoningType);
  const timeOnSourceDays = parseNumber(record.daysOnMarket ?? record.DaysOnMarket ?? record.dom ?? record.DOM);
  const { urls, descriptions } = extractPhotos(record);
  const listingUrl = normalizeString(record.listingUrl ?? record.ListingUrl ?? record.url ?? record.Url ?? record.relativeUrl ?? record.RelativeURL);

  return {
    externalId: `centris:${id}`,
    source: "centris_ca",
    mlsNumber,
    address,
    city: city.normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
    province,
    postalCode,
    latitude,
    longitude,
    price,
    currency: "CAD",
    propertyType,
    units,
    bedrooms,
    bathrooms,
    squareFeet,
    lotSizeSqFt,
    yearBuilt,
    ownershipType,
    zoningType,
    timeOnSourceDays: timeOnSourceDays != null ? Math.round(timeOnSourceDays) : null,
    mediaDescriptionText: descriptions.length > 0 ? descriptions.join(" | ") : null,
    description,
    photoUrls: urls.length > 0 ? JSON.stringify(urls) : null,
    listingUrl,
    rawJson: JSON.stringify(raw),
  };
}

export async function searchCentrisListings(params: CentrisSearchParams): Promise<CentrisListing[]> {
  if (!CENTRIS_PIPELINE_URL) {
    throw new Error("CENTRIS_PIPELINE_URL is not configured");
  }

  const response = await fetch(CENTRIS_PIPELINE_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(CENTRIS_PIPELINE_TOKEN ? { authorization: `Bearer ${CENTRIS_PIPELINE_TOKEN}` } : {}),
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error(`Centris pipeline ${response.status}: ${response.statusText}`);
  }

  const data = await response.json().catch(() => ({}));
  if (Array.isArray(data)) return data as CentrisListing[];
  if (Array.isArray(data.items)) return data.items as CentrisListing[];
  if (Array.isArray(data.listings)) return data.listings as CentrisListing[];
  if (Array.isArray(data.results)) return data.results as CentrisListing[];
  return [];
}

export async function fetchAllCentrisListings(params: CentrisSearchParams): Promise<CentrisListing[]> {
  const maxResults = Math.min(Math.max(1, params.maxResults ?? 200), 1000);
  const all: CentrisListing[] = [];
  let offset = params.offset ?? 0;

  while (all.length < maxResults) {
    const batch = await searchCentrisListings({ ...params, maxResults: Math.min(200, maxResults - all.length), offset });
    if (batch.length === 0) break;
    all.push(...batch.slice(0, maxResults - all.length));
    if (batch.length < Math.min(200, maxResults - all.length)) break;
    offset += batch.length;
  }

  return all.slice(0, maxResults);
}
