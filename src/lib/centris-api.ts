import { parseUnitBedroomMix } from "@/lib/quebec-unit-mix";

export type CentrisListing = Record<string, unknown>;

export interface MappedCentrisListing {
  externalId: string;
  source: "centris_ca";
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
  description: string | null;
  photoUrls: string | null;
  listingUrl: string | null;
  rawJson: string;
}

const UNIT_BY_TYPE: Array<[RegExp, number]> = [
  [/duplex/i, 2],
  [/triplex/i, 3],
  [/quadruplex|fourplex/i, 4],
  [/quintuplex|5\s*(?:unit|units|logement|logements)/i, 5],
  [/sixplex|6\s*(?:unit|units|logement|logements)/i, 6],
  [/septuplex|7\s*(?:unit|units|logement|logements)/i, 7],
  [/huitplex|8\s*(?:unit|units|logement|logements)/i, 8],
];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value.replace(/[^0-9.-]/g, ""));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function parsePrice(...values: unknown[]): number {
  return firstNumber(...values) ?? 0;
}

function flattenText(value: unknown, depth = 0): string[] {
  if (depth > 4 || value == null) return [];
  if (typeof value === "string" || typeof value === "number") return [String(value)];
  if (Array.isArray(value)) return value.flatMap((item) => flattenText(item, depth + 1));
  if (typeof value === "object") return Object.values(value).flatMap((item) => flattenText(item, depth + 1));
  return [];
}

function extractCentrisId(raw: Record<string, unknown>, text: string): string {
  const direct = firstString(
    raw.centrisId,
    raw.centris_id,
    raw.CentrisId,
    raw.CentrisID,
    raw.mlsNumber,
    raw.mls_number,
    raw.id,
    raw.Id
  );
  if (direct) return direct.replace(/\D/g, "") || direct;

  const url = firstString(raw.url, raw.listingUrl, raw.href);
  const fromUrl = url.match(/\/(\d{6,})(?:[/?#]|$)/)?.[1];
  if (fromUrl) return fromUrl;

  const fromText = text.match(/(?:No\.?\s*)?Centris\s*[:#]?\s*(\d{6,})/i)?.[1];
  if (fromText) return fromText;

  return `centris-${Math.random().toString(36).slice(2)}`;
}

function inferUnits(raw: Record<string, unknown>, text: string): number {
  const direct = firstNumber(
    raw.units,
    raw.unitCount,
    raw.unit_count,
    raw.nombreUnites,
    raw.nombre_unites,
    raw.residentialUnits,
    raw.residential_units
  );
  if (direct != null && direct > 0) return Math.round(direct);

  const residentialMatch = text.match(/R[eé]sidentiel\s*\((\d+)\)/i);
  if (residentialMatch) return Number(residentialMatch[1]);

  const parsedMix = parseUnitBedroomMix(text, 0);
  if (parsedMix?.sampleUnitCount && parsedMix.sampleUnitCount > 0) {
    return parsedMix.sampleUnitCount;
  }

  for (const [pattern, units] of UNIT_BY_TYPE) {
    if (pattern.test(text)) return units;
  }

  return 1;
}

function inferPropertyType(raw: Record<string, unknown>, units: number, text: string): string {
  const direct = firstString(raw.propertyType, raw.property_type, raw.type, raw.category, raw.title);
  const basis = `${direct} ${text}`;
  if (/duplex/i.test(basis) || units === 2) return "Duplex";
  if (/triplex/i.test(basis) || units === 3) return "Triplex";
  if (/quadruplex|fourplex/i.test(basis) || units === 4) return "Fourplex";
  if (units >= 5) return "Multi-Family";
  if (/vacant|land|terrain/i.test(basis)) return "Vacant Land";
  if (/condo|copropri/i.test(basis)) return "Condo";
  if (direct) return direct;
  return "House";
}

function cleanCentrisAddress(value: string): string {
  return value
    .replace(/^\|\s*/, "")
    .replace(/^(?:Duplex|Triplex|Quadruplex|Fourplex|Quintuplex|Income properties)\s+for sale\s+/i, "")
    .trim();
}

function parseAddress(raw: Record<string, unknown>, text: string): string {
  const addressRecord = asRecord(raw.address ?? raw.Address);
  const direct = firstString(
    raw.addressText,
    raw.address_text,
    raw.fullAddress,
    raw.full_address,
    addressRecord.address,
    addressRecord.Address,
    addressRecord.addressText,
    addressRecord.AddressText,
    raw.address,
    raw.Address
  );
  if (direct) return cleanCentrisAddress(direct);

  const fromTitle = text.match(/\b\d{1,6}\s*(?:-|–|—|a|à|to)?\s*\d{0,6}\s*,?\s+(?:Rue|Avenue|Av\.?|Boulevard|Boul\.?|Chemin|Ch\.?)\s+[^|]+/i)?.[0];
  return fromTitle ? cleanCentrisAddress(fromTitle) : "Unknown";
}

function parseCity(raw: Record<string, unknown>, address: string): string {
  const direct = firstString(raw.city, raw.City, raw.municipality, raw.Municipality);
  if (direct) {
    return direct.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  const url = firstString(raw.url, raw.listingUrl, raw.href);
  if (/~montreal/i.test(url) || /montr[eé]al/i.test(address)) return "Montreal";
  return "Montreal";
}

function collectPhotoUrls(raw: Record<string, unknown>): string[] {
  const candidates = [
    raw.photoUrls,
    raw.photo_urls,
    raw.photos,
    raw.Images,
    raw.images,
    raw.media,
    raw.medias,
  ];
  const urls = new Set<string>();
  for (const candidate of candidates) {
    for (const value of flattenText(candidate)) {
      const trimmed = value.trim();
      if (
        /^https?:\/\//i.test(trimmed) &&
        (
          /\.(?:jpe?g|png|webp)(?:[?#].*)?$/i.test(trimmed) ||
          /mspublic\.centris\.ca\/media\.ashx\?/i.test(trimmed)
        )
      ) {
        urls.add(trimmed);
      }
    }
  }
  return Array.from(urls);
}

function parseListingUrl(raw: Record<string, unknown>, externalId: string): string | null {
  const url = firstString(raw.url, raw.listingUrl, raw.href);
  if (url) return url.startsWith("http") ? url : `https://www.centris.ca${url.startsWith("/") ? "" : "/"}${url}`;
  return externalId.startsWith("centris-") ? null : `https://www.centris.ca/fr/propriete/${externalId}`;
}

export function mapCentrisListing(raw: CentrisListing): MappedCentrisListing {
  const r = asRecord(raw);
  const text = flattenText(raw).join(" ");
  const externalId = extractCentrisId(r, text);
  const address = parseAddress(r, text);
  const city = parseCity(r, address);
  const price = parsePrice(r.price, r.Price, r.listPrice, r.list_price, r.askingPrice, r.asking_price, text.match(/\d[\d\s]{4,}\s*\$/)?.[0]);
  const units = inferUnits(r, text);
  const propertyType = inferPropertyType(r, units, text);
  const bedrooms = firstNumber(r.bedrooms, r.Bedrooms);
  const bathrooms = firstNumber(r.bathrooms, r.Bathrooms, r.bathroomTotal);
  const squareFeet = firstNumber(r.squareFeet, r.square_feet, r.livingArea, r.living_area);
  const lotSizeSqFt = firstNumber(r.lotSizeSqFt, r.lot_size_sqft, r.lotSize, r.lot_size);
  const yearBuilt = firstNumber(r.yearBuilt, r.year_built, r.builtYear, r.built_year);
  const description = firstString(r.description, r.Description, r.remarks, r.publicRemarks) || null;
  const photoArr = collectPhotoUrls(r);

  return {
    externalId,
    source: "centris_ca",
    address,
    city,
    province: firstString(r.province, r.Province) || "QC",
    postalCode: firstString(r.postalCode, r.postal_code, r.PostalCode) || null,
    latitude: firstNumber(r.latitude, r.Latitude),
    longitude: firstNumber(r.longitude, r.Longitude),
    price,
    currency: "CAD",
    propertyType,
    units,
    bedrooms: bedrooms != null && !Number.isNaN(bedrooms) ? bedrooms : null,
    bathrooms: bathrooms != null && !Number.isNaN(bathrooms) ? bathrooms : null,
    squareFeet: squareFeet != null && !Number.isNaN(squareFeet) ? squareFeet : null,
    lotSizeSqFt: lotSizeSqFt != null && !Number.isNaN(lotSizeSqFt) ? lotSizeSqFt : null,
    yearBuilt: yearBuilt != null && !Number.isNaN(yearBuilt) ? Math.round(yearBuilt) : null,
    description,
    photoUrls: photoArr.length > 0 ? JSON.stringify(photoArr) : null,
    listingUrl: parseListingUrl(r, externalId),
    rawJson: JSON.stringify(raw),
  };
}
