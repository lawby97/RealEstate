/**
 * Resolve CMA and sub-zone from address (city, province, postal code).
 * Used for more accurate CMHC data lookup (zone-level rent/vacancy when available).
 */

const CMA_KEYS = [
  "Vancouver", "Victoria", "Calgary", "Edmonton", "Regina", "Saskatoon",
  "Winnipeg", "Toronto", "Hamilton", "Kitchener", "London", "Ottawa",
  "St. Catharines", "Windsor", "Gatineau", "Montreal", "Quebec City", "Halifax",
];

const CITY_TO_CMA: Record<string, string> = {
  Laval: "Montreal", Longueuil: "Montreal",
  Mississauga: "Toronto", Brampton: "Toronto", Vaughan: "Toronto",
  Markham: "Toronto", "Richmond Hill": "Toronto", Oakville: "Toronto",
  Burnaby: "Vancouver", Surrey: "Vancouver", Richmond: "Vancouver", Coquitlam: "Vancouver",
};

/** FSA (first 3 chars of postal code) → CMA. Suburbs map to their metro. */
const FSA_TO_CMA: Record<string, string> = {
  v6a: "Vancouver", v6b: "Vancouver", v6c: "Vancouver", v5v: "Vancouver", v6z: "Vancouver",
  v5a: "Vancouver", v5b: "Vancouver", v5c: "Vancouver", v7a: "Vancouver",
  m5v: "Toronto", m4y: "Toronto", m5a: "Toronto", m4v: "Toronto", m6g: "Toronto",
  l5b: "Toronto", l4y: "Toronto", l3r: "Toronto", l4t: "Toronto",
  h1w: "Montreal", h2h: "Montreal", h2k: "Montreal", h2r: "Montreal",
  h2y: "Montreal", h3a: "Montreal", h3b: "Montreal", h2x: "Montreal", h3z: "Montreal", h4a: "Montreal",
  j8y: "Gatineau", j8x: "Gatineau",
  t2p: "Calgary", t2r: "Calgary", t3g: "Calgary", t2a: "Calgary",
  t5j: "Edmonton", t5k: "Edmonton", t6e: "Edmonton", t6a: "Edmonton",
  v8v: "Victoria", v8r: "Victoria", v8t: "Victoria", v8p: "Victoria", v9a: "Victoria",
  k1n: "Ottawa", k1p: "Ottawa", k2p: "Ottawa", k1s: "Ottawa", k1y: "Ottawa", k2a: "Ottawa",
};

/** FSA → zone label within CMA. Only CMAs with zone-level data in the survey. */
const FSA_TO_ZONE: Record<string, Record<string, string>> = {
  Victoria: {
    v8v: "Zone 1 - Cook St. Area", v8r: "Zone 8 - Oak Bay", v8s: "Zone 8 - Oak Bay",
    v8t: "Zone 4 - Remainder of City of Victoria", v8p: "Zone 4 - Remainder of City of Victoria",
    v8n: "Zone 5 - Saanich/Central Saanich", v9a: "Zone 6 - Esquimalt",
    v9b: "Zone 7 - Langford/View Royal/Colwood/Sooke", v9c: "Zone 7 - Langford/View Royal/Colwood/Sooke",
  },
  Vancouver: {
    v6b: "Zone 3 - Downtown", v6c: "Zone 3 - Downtown", v5v: "Zone 1 - West End/Stanley Park",
    v6a: "Zone 1 - West End/Stanley Park", v6z: "Zone 3 - Downtown",
  },
  Montreal: {
    h3a: "Zone 1 - Downtown Montréal/Îles-des-Soeurs",
    h2k: "Zone 1 - Downtown Montréal/Îles-des-Soeurs",
    h2h: "Zone 6 - Plateau-Mont-Royal",
    h1w: "Zone 8 - Hochelaga-Maisonneuve",
    h2r: "Zone 7 - Villeray/St-Michel/Pc-Extension",
    h2y: "Zone 1 - Downtown Montréal/Îles-des-Soeurs", h3b: "Zone 1 - Downtown Montréal/Îles-des-Soeurs",
    h2x: "Zone 1 - Downtown Montréal/Îles-des-Soeurs", h3z: "Zone 5 - Ct-des-Neiges/Mt-Royal/Outremont",
    h3n: "Zone 7 - Villeray/St-Michel/Pc-Extension",
  },
  Toronto: {
    m5v: "Zone 3 - Downtown", m4y: "Zone 3 - Downtown", m5a: "Zone 3 - Downtown",
  },
  Calgary: {
    t2p: "Zone 1 - Downtown", t2r: "Zone 2 - Beltline", t3g: "Zone 4 - North",
  },
  Ottawa: {
    k1n: "Zone 1 - Downtown",
    k1p: "Zone 1 - Downtown",
    k2p: "Zone 2 - Sandy Hill/Lowertown",
    k1s: "Zone 3 - Glebe/Old Ottawa South",
  },
};

/** For seeding MarketCity / MarketZone / MarketPostalZoneMap. */
export const CMA_PROVINCES: Record<string, string> = {
  Vancouver: "BC", Victoria: "BC", Calgary: "AB", Edmonton: "AB", Regina: "SK", Saskatoon: "SK",
  Winnipeg: "MB", Toronto: "ON", Hamilton: "ON", Kitchener: "ON", London: "ON", Ottawa: "ON",
  "St. Catharines": "ON", Windsor: "ON", Gatineau: "QC", Montreal: "QC", "Quebec City": "QC", Halifax: "NS",
};
export const FSA_TO_ZONE_FOR_SEED = FSA_TO_ZONE;

function extractFsa(postalCode: string | null | undefined): string | null {
  if (!postalCode || typeof postalCode !== "string") return null;
  const s = postalCode.replace(/\s/g, "").toLowerCase();
  if (s.length < 3) return null;
  return s.slice(0, 3);
}

export type ResolvedCmhcZone = { cma: string; zone: string | null };

export function resolveCmhcCma(
  city: string,
  _province?: string | null,
  postalCode?: string | null
): string {
  const norm = city.trim();
  const byCity = CITY_TO_CMA[norm];
  if (byCity) return byCity;
  const fsa = extractFsa(postalCode);
  if (fsa && FSA_TO_CMA[fsa]) return FSA_TO_CMA[fsa];
  const match = CMA_KEYS.find((c) => c.toLowerCase() === norm.toLowerCase());
  return match ?? norm;
}

export function resolveCmhcZone(
  city: string,
  province?: string | null,
  postalCode?: string | null
): ResolvedCmhcZone {
  const cma = resolveCmhcCma(city, province, postalCode);
  const fsa = extractFsa(postalCode);
  const zoneMap = FSA_TO_ZONE[cma];
  const zone = fsa && zoneMap ? (zoneMap[fsa] ?? null) : null;
  return { cma, zone };
}
