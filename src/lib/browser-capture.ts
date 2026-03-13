import { createHash } from "node:crypto";

export type BrowserCaptureSource = "realtor_ca" | "centris_ca" | "duproprio_ca";
export type BrowserCaptureType = "search_results" | "listing_detail";
export type BrowserCapturePayloadFormat = "json" | "html";
export type BrowserCaptureLane = "broad_residential" | "small_bay_2to4" | "five_plus_multifamily";

export interface BrowserCaptureEnvelope {
  source: BrowserCaptureSource;
  captureType: BrowserCaptureType;
  payloadFormat: BrowserCapturePayloadFormat;
  pageUrl: string;
  capturedAt: string;
  segmentKey: string;
  pageNumber: number;
  payload: unknown;
  market?: string | null;
  region?: string | null;
  lane?: BrowserCaptureLane | null;
  isTerminalPage?: boolean | null;
  totalResults?: number | null;
}

function normalizeString(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function parseJsonMaybe(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function isBrowserCaptureEnvelope(value: unknown): value is BrowserCaptureEnvelope {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    normalizeString(record.source) != null &&
    normalizeString(record.captureType) != null &&
    normalizeString(record.payloadFormat) != null &&
    normalizeString(record.pageUrl) != null &&
    normalizeString(record.segmentKey) != null &&
    Number.isFinite(Number(record.pageNumber)) &&
    Object.prototype.hasOwnProperty.call(record, "payload")
  );
}

export function normalizeBrowserCaptureEnvelope(
  value: unknown,
  expectedSource?: BrowserCaptureSource
): BrowserCaptureEnvelope | null {
  if (!isBrowserCaptureEnvelope(value)) return null;
  const record = value as unknown as Record<string, unknown>;
  const source = normalizeString(record.source) as BrowserCaptureSource | null;
  if (!source) return null;
  if (expectedSource && source !== expectedSource) return null;
  const captureType = normalizeString(record.captureType) as BrowserCaptureType | null;
  const payloadFormat = normalizeString(record.payloadFormat) as BrowserCapturePayloadFormat | null;
  if (!captureType || !payloadFormat) return null;

  return {
    source,
    captureType,
    payloadFormat,
    pageUrl: String(record.pageUrl),
    capturedAt: normalizeString(record.capturedAt) ?? new Date().toISOString(),
    segmentKey: String(record.segmentKey),
    pageNumber: Math.max(1, Number(record.pageNumber)),
    payload: record.payload,
    market: normalizeString(record.market),
    region: normalizeString(record.region),
    lane: (normalizeString(record.lane) as BrowserCaptureLane | null) ?? null,
    isTerminalPage:
      typeof record.isTerminalPage === "boolean" ? record.isTerminalPage : null,
    totalResults:
      record.totalResults == null || record.totalResults === ""
        ? null
        : Number.isFinite(Number(record.totalResults))
          ? Number(record.totalResults)
          : null,
  };
}

export function computeBrowserCapturePayloadHash(envelope: Pick<BrowserCaptureEnvelope, "payloadFormat" | "payload">): string {
  const payloadString =
    envelope.payloadFormat === "json"
      ? JSON.stringify(parseJsonMaybe(envelope.payload))
      : String(envelope.payload ?? "");
  return createHash("sha256").update(payloadString).digest("hex");
}

function unwrapPayloadItems(payload: unknown): Record<string, unknown>[] {
  const parsed = parseJsonMaybe(payload);
  if (Array.isArray(parsed)) {
    return parsed.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
  }
  if (!parsed || typeof parsed !== "object") return [];
  const record = parsed as Record<string, unknown>;
  const knownContainers = [
    record.Results,
    record.results,
    record.listings,
    record.Listings,
    record.items,
    record.Items,
    record.data,
    record.Data,
    record.properties,
    record.Properties,
  ];

  for (const container of knownContainers) {
    if (Array.isArray(container)) {
      return container.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
    }
  }

  const singletons = [record.listing, record.Listing, record.item, record.Item, record.property, record.Property];
  for (const singleton of singletons) {
    if (singleton && typeof singleton === "object" && !Array.isArray(singleton)) {
      return [singleton as Record<string, unknown>];
    }
  }

  return [record];
}

function extractJsonScripts(html: string): unknown[] {
  const payloads: unknown[] = [];
  const scriptPatterns = [
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/gi,
  ];

  for (const pattern of scriptPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
      const candidate = match[1]?.trim();
      if (!candidate) continue;
      try {
        payloads.push(JSON.parse(candidate));
      } catch {
        // ignore
      }
    }
  }

  const assignmentPatterns = [
    /window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});/i,
    /window\.__PRELOADED_STATE__\s*=\s*({[\s\S]*?});/i,
    /window\.__NUXT__\s*=\s*({[\s\S]*?});/i,
  ];
  for (const pattern of assignmentPatterns) {
    const match = html.match(pattern);
    if (!match?.[1]) continue;
    try {
      payloads.push(JSON.parse(match[1]));
    } catch {
      // ignore
    }
  }

  return payloads;
}

function collectLikelyListingObjects(value: unknown, collected: Record<string, unknown>[], depth = 0): void {
  if (depth > 6 || collected.length >= 20 || value == null) return;
  if (Array.isArray(value)) {
    for (const item of value) collectLikelyListingObjects(item, collected, depth + 1);
    return;
  }
  if (typeof value !== "object") return;
  const record = value as Record<string, unknown>;

  const hasListingSignal =
    normalizeString(record.price ?? record.Price ?? record.listPrice ?? record.ListPrice) != null ||
    normalizeString(record.address ?? record.Address ?? record.streetAddress ?? record.StreetAddress) != null ||
    normalizeString(record.description ?? record.Description) != null ||
    normalizeString(record.url ?? record.Url) != null ||
    normalizeString(record["@type"]) != null;

  if (hasListingSignal) {
    collected.push(record);
    return;
  }

  for (const nested of Object.values(record)) {
    collectLikelyListingObjects(nested, collected, depth + 1);
    if (collected.length >= 20) return;
  }
}

function normalizeHtmlListingCandidate(candidate: Record<string, unknown>, pageUrl: string): Record<string, unknown> {
  const addressValue = candidate.address;
  const addressObject =
    addressValue && typeof addressValue === "object" && !Array.isArray(addressValue)
      ? (addressValue as Record<string, unknown>)
      : null;
  const streetAddress = normalizeString(addressObject?.streetAddress ?? candidate.streetAddress ?? candidate.StreetAddress);
  const city = normalizeString(addressObject?.addressLocality ?? candidate.city ?? candidate.City);
  const province = normalizeString(addressObject?.addressRegion ?? candidate.province ?? candidate.Province) ?? "QC";
  const postalCode = normalizeString(addressObject?.postalCode ?? candidate.postalCode ?? candidate.PostalCode);
  const priceCandidate =
    candidate.offers && typeof candidate.offers === "object" && !Array.isArray(candidate.offers)
      ? (candidate.offers as Record<string, unknown>).price
      : candidate.price ?? candidate.Price ?? candidate.listPrice ?? candidate.ListPrice;
  const imageValue = candidate.image ?? candidate.images ?? candidate.Images;
  const images = Array.isArray(imageValue)
    ? imageValue.filter((entry): entry is string => typeof entry === "string")
    : typeof imageValue === "string"
      ? [imageValue]
      : [];

  return {
    id: normalizeString(candidate.identifier ?? candidate.sku ?? candidate.url ?? candidate.Url) ?? pageUrl,
    listingUrl: normalizeString(candidate.url ?? candidate.Url) ?? pageUrl,
    address: [streetAddress, city, province, postalCode].filter(Boolean).join(", "),
    city,
    province,
    postalCode,
    price: priceCandidate,
    propertyType: normalizeString(candidate.additionalType ?? candidate["@type"] ?? candidate.propertyType) ?? "Unknown",
    description: normalizeString(candidate.description),
    photos: images.map((url) => ({ url })),
  };
}

function extractHtmlItems(html: string, pageUrl: string): Record<string, unknown>[] {
  const payloads = extractJsonScripts(html);
  const collected: Record<string, unknown>[] = [];
  for (const payload of payloads) {
    collectLikelyListingObjects(payload, collected);
  }

  if (collected.length > 0) {
    return collected.map((candidate) => normalizeHtmlListingCandidate(candidate, pageUrl));
  }

  return [];
}

export function extractBrowserCaptureItems(envelope: BrowserCaptureEnvelope): Record<string, unknown>[] {
  if (envelope.payloadFormat === "json") {
    return unwrapPayloadItems(envelope.payload);
  }
  return extractHtmlItems(String(envelope.payload ?? ""), envelope.pageUrl);
}
