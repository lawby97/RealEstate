export interface ListingMatchInput {
  address: string;
  city: string;
  price: number;
  units: number;
}

export interface ListingMatchCandidate extends ListingMatchInput {
  id: string;
}

const COMMON_ADDRESS_TOKENS = new Set([
  "avenue",
  "ave",
  "boulevard",
  "boul",
  "chemin",
  "ch",
  "montreal",
  "montréal",
  "qc",
  "quebec",
  "rue",
  "street",
  "st",
  "suite",
  "unit",
]);

export function normalizeListingText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\bsaint\b/g, "st")
    .replace(/\bsainte\b/g, "ste")
    .replace(/\bouest\b|\bwest\b|\bw\b/g, "o")
    .replace(/\best\b|\beast\b|\be\b/g, "e")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function civicTokens(address: string): string[] {
  const normalized = normalizeListingText(address);
  const firstSegment = normalized.split(/\b(?:rue|avenue|ave|boulevard|boul|chemin|ch)\b/)[0] ?? normalized;
  const matches = firstSegment.match(/\b\d{2,6}\b/g);
  return matches ?? [];
}

function streetTokens(address: string): Set<string> {
  const civic = new Set(civicTokens(address));
  return new Set(
    normalizeListingText(address)
      .split(" ")
      .filter((token) => token.length > 1)
      .filter((token) => !civic.has(token))
      .filter((token) => !COMMON_ADDRESS_TOKENS.has(token))
      .filter((token) => !/^[a-z]\d[a-z]\d[a-z]\d$/.test(token))
  );
}

function intersectionSize(left: Set<string>, right: Set<string>): number {
  let count = 0;
  for (const token of Array.from(left)) {
    if (right.has(token)) count++;
  }
  return count;
}

export function listingAddressMatchScore(
  listing: ListingMatchInput,
  candidate: ListingMatchInput
): number {
  if (listing.units !== candidate.units) return 0;

  const tolerance = Math.max(25_000, listing.price * 0.03);
  if (listing.price > 0 && candidate.price > 0 && Math.abs(listing.price - candidate.price) > tolerance) {
    return 0;
  }

  const leftCivic = new Set(civicTokens(listing.address));
  const rightCivic = new Set(civicTokens(candidate.address));
  const civicOverlap = intersectionSize(leftCivic, rightCivic);
  if (leftCivic.size > 0 && rightCivic.size > 0 && civicOverlap === 0) return 0;

  const leftStreet = streetTokens(listing.address);
  const rightStreet = streetTokens(candidate.address);
  const streetOverlap = intersectionSize(leftStreet, rightStreet);
  const streetDenominator = Math.max(1, Math.min(leftStreet.size, rightStreet.size));
  const streetScore = streetOverlap / streetDenominator;

  const cityScore =
    normalizeListingText(listing.city) === normalizeListingText(candidate.city) ||
    normalizeListingText(listing.address).includes(normalizeListingText(candidate.city)) ||
    normalizeListingText(candidate.address).includes(normalizeListingText(listing.city))
      ? 0.2
      : 0;

  const civicScore = civicOverlap > 0 ? 0.45 : 0;
  const priceScore =
    listing.price > 0 && candidate.price > 0
      ? Math.max(0, 0.2 - Math.abs(listing.price - candidate.price) / tolerance * 0.2)
      : 0.1;

  return Math.min(1, civicScore + streetScore * 0.35 + cityScore + priceScore);
}

export function findBestListingMatch<T extends ListingMatchCandidate>(
  listing: ListingMatchInput,
  candidates: T[],
  minimumScore = 0.65
): T | null {
  let best: { candidate: T; score: number } | null = null;
  for (const candidate of candidates) {
    const score = listingAddressMatchScore(listing, candidate);
    if (score >= minimumScore && (!best || score > best.score)) {
      best = { candidate, score };
    }
  }
  return best?.candidate ?? null;
}
