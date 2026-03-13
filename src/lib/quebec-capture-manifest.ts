import type { BrowserCaptureLane, BrowserCaptureSource } from "@/lib/browser-capture";

export interface QuebecCaptureManifestEntry {
  segmentKey: string;
  source: BrowserCaptureSource;
  market: string;
  regionKey: string;
  regionLabel: string;
  provinceCode: "QC";
  lane: BrowserCaptureLane;
  priceMin: number;
  priceMax: number;
  priority: number;
  cadenceHours: number;
  locationToken: string;
  searchUrl: string | null;
  operatorHint: string;
}

type RegionConfig = {
  key: string;
  label: string;
  market: string;
  cadenceHours: number;
  priorityBoost: number;
};

const SOURCES: BrowserCaptureSource[] = ["centris_ca", "realtor_ca", "duproprio_ca"];

const HIGH_VOLUME_REGIONS: RegionConfig[] = [
  { key: "montreal", label: "Montreal", market: "Montreal", cadenceHours: 24, priorityBoost: 120 },
  { key: "laval", label: "Laval", market: "Laval", cadenceHours: 24, priorityBoost: 110 },
  { key: "longueuil", label: "Longueuil / South Shore", market: "Longueuil", cadenceHours: 24, priorityBoost: 105 },
  { key: "quebec_city", label: "Quebec City", market: "Quebec City", cadenceHours: 24, priorityBoost: 100 },
  { key: "gatineau", label: "Gatineau", market: "Gatineau", cadenceHours: 24, priorityBoost: 95 },
  { key: "sherbrooke", label: "Sherbrooke", market: "Sherbrooke", cadenceHours: 24, priorityBoost: 90 },
  { key: "trois_rivieres", label: "Trois-Rivieres", market: "Trois-Rivieres", cadenceHours: 24, priorityBoost: 85 },
  { key: "saguenay", label: "Saguenay", market: "Saguenay", cadenceHours: 24, priorityBoost: 80 },
];

const REGIONAL_SWEEPS: RegionConfig[] = [
  { key: "abitibi_temiscamingue", label: "Abitibi-Temiscamingue", market: "Abitibi-Temiscamingue", cadenceHours: 72, priorityBoost: 35 },
  { key: "bas_saint_laurent", label: "Bas-Saint-Laurent", market: "Bas-Saint-Laurent", cadenceHours: 72, priorityBoost: 35 },
  { key: "centre_du_quebec", label: "Centre-du-Quebec", market: "Centre-du-Quebec", cadenceHours: 72, priorityBoost: 35 },
  { key: "chaudiere_appalaches", label: "Chaudiere-Appalaches", market: "Chaudiere-Appalaches", cadenceHours: 72, priorityBoost: 35 },
  { key: "cote_nord", label: "Cote-Nord", market: "Cote-Nord", cadenceHours: 72, priorityBoost: 35 },
  { key: "gaspesie_iles", label: "Gaspesie-Iles-de-la-Madeleine", market: "Gaspesie-Iles-de-la-Madeleine", cadenceHours: 72, priorityBoost: 35 },
  { key: "lanaudiere", label: "Lanaudiere", market: "Lanaudiere", cadenceHours: 72, priorityBoost: 35 },
  { key: "laurentides", label: "Laurentides", market: "Laurentides", cadenceHours: 72, priorityBoost: 35 },
  { key: "mauricie", label: "Mauricie", market: "Mauricie", cadenceHours: 72, priorityBoost: 35 },
  { key: "monteregie", label: "Monteregie", market: "Monteregie", cadenceHours: 72, priorityBoost: 35 },
  { key: "nord_du_quebec", label: "Nord-du-Quebec", market: "Nord-du-Quebec", cadenceHours: 72, priorityBoost: 35 },
  { key: "outaouais", label: "Outaouais", market: "Outaouais", cadenceHours: 72, priorityBoost: 35 },
];

const LANE_BANDS: Record<BrowserCaptureLane, Array<[number, number]>> = {
  broad_residential: [
    [0, 400000],
    [400000, 700000],
    [700000, 1100000],
    [1100000, 1800000],
    [1800000, 5000000],
  ],
  small_bay_2to4: [
    [0, 600000],
    [600000, 900000],
    [900000, 1300000],
    [1300000, 2000000],
    [2000000, 6000000],
  ],
  five_plus_multifamily: [
    [0, 1500000],
    [1500000, 3000000],
    [3000000, 6000000],
    [6000000, 12000000],
    [12000000, 30000000],
  ],
};

const LANE_PRIORITY: Record<BrowserCaptureLane, number> = {
  broad_residential: 100,
  small_bay_2to4: 90,
  five_plus_multifamily: 80,
};

const SOURCE_PRIORITY: Record<BrowserCaptureSource, number> = {
  centris_ca: 300,
  realtor_ca: 220,
  duproprio_ca: 180,
};

function buildOperatorHint(source: BrowserCaptureSource, regionLabel: string, lane: BrowserCaptureLane, priceMin: number, priceMax: number): string {
  const laneLabel =
    lane === "broad_residential"
      ? "broad residential sale"
      : lane === "small_bay_2to4"
        ? "2-4 unit residential sale"
        : "5+ multifamily sale";
  const sourceLabel =
    source === "centris_ca" ? "Centris" : source === "realtor_ca" ? "Realtor" : "DuProprio";
  return `${sourceLabel}: open ${regionLabel}, filter ${laneLabel}, and work the $${priceMin.toLocaleString()}-$${priceMax.toLocaleString()} band.`;
}

function buildManifestEntries(regions: RegionConfig[]): QuebecCaptureManifestEntry[] {
  const entries: QuebecCaptureManifestEntry[] = [];

  for (const region of regions) {
    for (const source of SOURCES) {
      for (const lane of Object.keys(LANE_BANDS) as BrowserCaptureLane[]) {
        for (const [priceMin, priceMax] of LANE_BANDS[lane]) {
          entries.push({
            segmentKey: `qc:${source}:${region.key}:${lane}:${priceMin}-${priceMax}`,
            source,
            market: region.market,
            regionKey: region.key,
            regionLabel: region.label,
            provinceCode: "QC",
            lane,
            priceMin,
            priceMax,
            priority: SOURCE_PRIORITY[source] + LANE_PRIORITY[lane] + region.priorityBoost,
            cadenceHours: region.cadenceHours,
            locationToken: region.label,
            searchUrl: null,
            operatorHint: buildOperatorHint(source, region.label, lane, priceMin, priceMax),
          });
        }
      }
    }
  }

  return entries;
}

export const QUEBEC_CAPTURE_MANIFEST: QuebecCaptureManifestEntry[] = [
  ...buildManifestEntries(HIGH_VOLUME_REGIONS),
  ...buildManifestEntries(REGIONAL_SWEEPS),
].sort((left, right) => right.priority - left.priority || left.segmentKey.localeCompare(right.segmentKey));

export function getQuebecCaptureManifest(source?: BrowserCaptureSource | null): QuebecCaptureManifestEntry[] {
  if (!source) return QUEBEC_CAPTURE_MANIFEST;
  return QUEBEC_CAPTURE_MANIFEST.filter((entry) => entry.source === source);
}
