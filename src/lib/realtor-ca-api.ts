/**
 * Realtor.ca backend API client.
 * Uses the same API as the realtor.ca website (api37.realtor.ca).
 *
 * Note: Realtor.ca may block server-side requests (Incapsula). If direct
 * fetch fails, use POST /api/scrape/realtor-ca/ingest with JSON body from
 * a browser-based scraper or a service like Apify.
 */

const BASE_URL = "https://api37.realtor.ca/Listing.svc";

export type RealtorCaSearchParams = {
  /** Province code: ON, BC, QC, AB, etc. */
  provinceCode?: string;
  /** City name, e.g. "Toronto", "Montreal" */
  city?: string;
  /** Max results per request (API may cap at 200). */
  recordsPerPage?: number;
  /** 1 = For Sale, 2 = For Rent, etc. */
  transactionTypeId?: number;
  /** Starting record index for pagination. */
  offset?: number;
  /** Minimum price (CAD). */
  minPrice?: number;
  /** Maximum price (CAD). */
  maxPrice?: number;
  /** Minimum bedrooms (e.g. 2). */
  minBedrooms?: number;
  /** Maximum bedrooms (e.g. 5). */
  maxBedrooms?: number;
  /** Building/property type ID if API supports (e.g. 1=House, 2=Condo). */
  buildingTypeId?: number;
};

export type RealtorCaListing = {
  Id: string;
  Address?: { StreetAddress?: string; AddressText?: string };
  City?: string;
  Province?: string;
  PostalCode?: string;
  Latitude?: number;
  Longitude?: number;
  Price?: number;
  Property?: {
    Type?: string;
    Bedrooms?: number;
    BathroomTotal?: number;
    SizeInterior?: number;
    SizeExterior?: number;
    YearBuilt?: number;
  };
  Building?: {
    BathroomTotal?: number;
    Bedrooms?: number;
    SizeInterior?: number;
    ConstructedDate?: string;
    Type?: string;
  };
  PublicRemarks?: string;
  Listing?: { Photo?: Array<{ Medias?: Array<{ Url?: string }> }> };
  RelativeDetailsURL?: string;
  [key: string]: unknown;
};

export type RealtorCaSearchResult = {
  Results?: RealtorCaListing[];
  Paging?: { TotalRecords?: number; RecordsPerPage?: number; CurrentPage?: number };
  [key: string]: unknown;
};

/**
 * Build form body for PropertySearch_Post.
 * Parameters based on realtor.ca frontend / reverse-engineered usage.
 */
function buildSearchBody(params: RealtorCaSearchParams): string {
  const form: Record<string, string> = {
    CultureId: "1",
    ApplicationId: "37",
    PropertySearchTypeId: "1",
    TransactionTypeId: String(params.transactionTypeId ?? 1), // 1 = For Sale
    RecordsPerPage: String(params.recordsPerPage ?? 100),
    MaximumResults: String(params.recordsPerPage ?? 100),
    LongitudeMin: "",
    LongitudeMax: "",
    LatitudeMin: "",
    LatitudeMax: "",
    SortOrder: "A",
    SortBy: "1",
    viewState: "m",
    Longitude: "",
    Latitude: "",
    CurrentPage: String(params.offset ? Math.floor(params.offset / (params.recordsPerPage ?? 100)) + 1 : 1),
  };
  if (params.provinceCode) form.ProvinceCode = params.provinceCode;
  if (params.city) form.CityName = params.city;
  if (params.minPrice != null && params.minPrice > 0) form.PriceMin = String(params.minPrice);
  if (params.maxPrice != null && params.maxPrice > 0) form.PriceMax = String(params.maxPrice);
  if (params.minBedrooms != null || params.maxBedrooms != null) {
    const lo = params.minBedrooms ?? 0;
    const hi = params.maxBedrooms ?? 20;
    form.BedRange = `${lo}-${hi}`;
  }
  if (params.buildingTypeId != null) form.BuildingTypeId = String(params.buildingTypeId);

  return new URLSearchParams(form).toString();
}

/**
 * Fetch listings from Realtor.ca PropertySearch_Post.
 * Returns raw API result; map to your DB shape with mapRealtorCaListing.
 */
export async function searchRealtorCaListings(
  params: RealtorCaSearchParams
): Promise<RealtorCaSearchResult> {
  const url = `${BASE_URL}/PropertySearch_Post`;
  const body = buildSearchBody(params);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "User-Agent":
        "Mozilla/5.0 (compatible; InvestorListings/1.0; +https://github.com/real-estate-investor)",
  },
    body,
  });
  if (!res.ok) throw new Error(`Realtor.ca API ${res.status}: ${res.statusText}`);
  const data = await res.json().catch(() => ({}));
  return data as RealtorCaSearchResult;
}

/**
 * Map a Realtor.ca API listing to our Listing create/update shape.
 * Accepts both PascalCase (realtor.ca API) and camelCase (Apify-style) fields.
 */
export function mapRealtorCaListing(raw: RealtorCaListing | Record<string, unknown>): {
  externalId: string;
  source: string;
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
} {
  const r = raw as Record<string, unknown>;
  const prop = (r.Property ?? r.property ?? {}) as Record<string, unknown>;
  const building = (r.Building ?? r.building ?? {}) as Record<string, unknown>;
  const propAddr = (prop.address ?? r.address) as Record<string, unknown> | string | undefined;
  const addrObj = (r.Address ?? r.address) as Record<string, unknown> | string | undefined;
  const addrStr =
    typeof propAddr === "object" && propAddr?.address_text
      ? String(propAddr.address_text)
      : typeof addrObj === "string"
        ? addrObj
        : addrObj
          ? (addrObj.AddressText ?? addrObj.StreetAddress ?? addrObj.address) as string
          : "";
  const id = String(r.Id ?? r.id ?? r.mls_number ?? r.mlsNumber ?? r.propertyId ?? "").trim() || `realtor-${Math.random().toString(36).slice(2)}`;
  let city = String(r.City ?? r.city ?? "").trim();
  if (!city && addrStr) {
    const parts = addrStr.split("|");
    const last = parts[parts.length - 1]?.trim() ?? "";
    const match = last.match(/^([^,]+),/);
    city = match ? match[1].trim() : last.split(/\s+[A-Z]{2}\s+/)[0]?.trim() ?? "Unknown";
  }
  if (!city) city = "Unknown";
  const provRaw = String(r.Province ?? r.province ?? r.province_name ?? r.state ?? "").trim();
  const provinceMap: Record<string, string> = { Quebec: "QC", Ontario: "ON", "British Columbia": "BC", Alberta: "AB", Manitoba: "MB", Saskatchewan: "SK", "Nova Scotia": "NS", "New Brunswick": "NB", "Newfoundland and Labrador": "NL", PEI: "PE", "Prince Edward Island": "PE" };
  const province = provinceMap[provRaw] ?? (provRaw || "ON");
  const postalCode = (r.PostalCode ?? r.postalCode ?? r.postal_code ?? ""); const postal = (postalCode != null && postalCode !== "") ? String(postalCode).trim() : null;
  const latRaw = r.Latitude ?? r.latitude ?? propAddr && typeof propAddr === "object" ? (propAddr as Record<string, unknown>).latitude : null;
  const lngRaw = r.Longitude ?? r.longitude ?? propAddr && typeof propAddr === "object" ? (propAddr as Record<string, unknown>).longitude : null;
  const lat = latRaw != null ? (typeof latRaw === "number" ? latRaw : parseFloat(String(latRaw))) : null;
  const lng = lngRaw != null ? (typeof lngRaw === "number" ? lngRaw : parseFloat(String(lngRaw))) : null;
  let price = Number(r.Price ?? r.price ?? r.listPrice ?? 0);
  if ((!price || Number.isNaN(price)) && prop) {
    const pv = (prop as Record<string, unknown>).price_unformatted_value ?? (prop as Record<string, unknown>).price;
    if (typeof pv === "number") price = pv;
    else if (typeof pv === "string") price = parseInt(pv.replace(/\D/g, ""), 10) || 0;
  }
  if (!price || Number.isNaN(price)) price = 0;
  const bedrooms =
    prop.Bedrooms != null ? Number(prop.Bedrooms) : prop.bedrooms != null ? Number(prop.bedrooms)
      : building.Bedrooms != null ? Number(building.Bedrooms) : building.bedrooms != null ? Number(building.bedrooms)
      : (r.bedrooms != null ? Number(r.bedrooms) : null);
  const bathrooms =
    prop.BathroomTotal != null ? Number(prop.BathroomTotal) : prop.bathroomTotal != null ? Number(prop.bathroomTotal)
      : building.BathroomTotal != null ? Number(building.BathroomTotal) : building.bathroom_total != null ? Number(building.bathroom_total) : (r.bathrooms != null ? Number(r.bathrooms) : null);
  let sqRaw = prop.SizeInterior ?? prop.sizeInterior ?? building.SizeInterior ?? building.size_interior ?? r.squareFeet ?? r.sqft;
  if (typeof sqRaw === "string" && /sqft|sq\.?\s*ft/i.test(sqRaw)) sqRaw = parseFloat(sqRaw.replace(/[^0-9.]/g, "")) || null;
  const sq = sqRaw != null ? Number(sqRaw) : null;
  const lotSizeSqFt = (prop.SizeExterior != null ? Number(prop.SizeExterior) : (r.lotSizeSqFt ?? r.lotSize) != null ? Number(r.lotSizeSqFt ?? r.lotSize) : null);
  const yearBuilt = prop.YearBuilt != null ? Number(prop.YearBuilt) : building.ConstructedDate ? parseInt(String(building.ConstructedDate).slice(0, 4), 10) : (r.yearBuilt != null ? Number(r.yearBuilt) : null);
  const propertyType = String(prop.Type ?? prop.type ?? building.Type ?? building.type ?? r.propertyType ?? r.type ?? "Unknown").trim() || "Unknown";
  const description = (r.PublicRemarks ?? r.public_remarks ?? r.publicRemarks ?? r.description ?? r.remarks ?? ""); const desc = (description != null && description !== "") ? String(description).trim() : null;
  let photoArr: string[] = [];
  const listingPhoto = r.Listing as Record<string, unknown> | undefined;
  if (listingPhoto?.Photo) {
    const photos = listingPhoto.Photo as Array<{ Medias?: Array<{ Url?: string }> }>;
    photoArr = photos?.flatMap((p) => p.Medias ?? []).map((m) => m.Url).filter(Boolean) as string[] ?? [];
  }
  if (photoArr.length === 0 && Array.isArray(prop.photo)) {
    photoArr = (prop.photo as Array<{ high_res_path?: string; low_res_path?: string; Url?: string }>).map((p) => p.high_res_path ?? p.low_res_path ?? p.Url).filter(Boolean) as string[];
  }
  if (photoArr.length === 0 && Array.isArray(r.photos)) photoArr = r.photos.map(String).filter(Boolean);
  if (photoArr.length === 0 && r.image) photoArr = [String(r.image)];
  const photoUrls = photoArr.length > 0 ? JSON.stringify(photoArr) : null;
  const relUrl = (r.RelativeDetailsURL ?? r.relative_details_url ?? r.relativeDetailsURL ?? r.relative_url_en ?? r.relative_url_fr ?? r.url ?? r.listingUrl ?? r.detailUrl ?? ""); const rel = (relUrl != null && relUrl !== "") ? String(relUrl).trim() : "";
  const listingUrl = rel ? (rel.startsWith("http") ? rel : `https://www.realtor.ca${rel.startsWith("/") ? "" : "/"}${rel}`) : null;

  return {
    externalId: id,
    source: "realtor_ca",
    address: (addrStr && String(addrStr).trim()) || "Unknown",
    city,
    province,
    postalCode: postal,
    latitude: typeof lat === "number" && !Number.isNaN(lat) ? lat : null,
    longitude: typeof lng === "number" && !Number.isNaN(lng) ? lng : null,
    price,
    currency: "CAD",
    propertyType,
    units: 1,
    bedrooms: bedrooms != null && !Number.isNaN(bedrooms) ? bedrooms : null,
    bathrooms: bathrooms != null && !Number.isNaN(bathrooms) ? bathrooms : null,
    squareFeet: sq != null && !Number.isNaN(sq) ? sq : null,
    lotSizeSqFt: lotSizeSqFt != null && !Number.isNaN(Number(lotSizeSqFt)) ? Number(lotSizeSqFt) : null,
    yearBuilt: yearBuilt != null && !Number.isNaN(yearBuilt) ? yearBuilt : null,
    description: desc,
    photoUrls,
    listingUrl,
    rawJson: JSON.stringify(raw),
  };
}

/**
 * Fetch multiple pages of results (respects typical API caps).
 */
export async function fetchAllRealtorCaListings(params: {
  provinceCode?: string;
  city?: string;
  maxResults?: number;
  recordsPerPage?: number;
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  maxBedrooms?: number;
  buildingTypeId?: number;
}): Promise<RealtorCaListing[]> {
  const max = Math.min(params.maxResults ?? 500, 1000);
  const perPage = Math.min(params.recordsPerPage ?? 100, 200);
  const all: RealtorCaListing[] = [];
  let offset = 0;

  while (all.length < max) {
    const result = await searchRealtorCaListings({
      provinceCode: params.provinceCode,
      city: params.city,
      recordsPerPage: perPage,
      offset,
      minPrice: params.minPrice,
      maxPrice: params.maxPrice,
      minBedrooms: params.minBedrooms,
      maxBedrooms: params.maxBedrooms,
      buildingTypeId: params.buildingTypeId,
    });
    const results = result.Results ?? [];
    if (results.length === 0) break;
    for (const r of results) {
      if (all.length >= max) break;
      all.push(r);
    }
    offset += results.length;
    if (results.length < perPage) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  return all.slice(0, max);
}
