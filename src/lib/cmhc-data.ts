/**
 * CMHC 2025 Rental Market Survey — CMA-level lookup.
 * Uses apt_rents_by_size and apt_vacancy_by_size from cmhc-2025-raw.json.
 */

export type BedroomRents = {
  studio?: number;
  oneBed?: number;
  twoBed?: number;
  threeBedPlus?: number;
  total?: number;
};

import rawData from "@/data/cmhc-2025-raw.json";

const data = rawData as Record<
  string,
  {
    apt_rents_by_size?: Array<{ label: string; total_25?: number; raw?: number[] }>;
    apt_vacancy_by_size?: Array<{ label: string; total_25?: number; raw?: number[] }>;
    apt_vacant_vs_occupied?: Array<{ label: string; total_25?: number; raw?: number[] }>;
  }
>;

const CMA_KEYS = Object.keys(data);

/** City/borough → CMA for suburbs (e.g. Laval → Montreal) */
const CITY_TO_CMA: Record<string, string> = {
  Laval: "Montreal",
  Longueuil: "Montreal",
  Mississauga: "Toronto",
  Brampton: "Toronto",
  Vaughan: "Toronto",
  Markham: "Toronto",
  "Richmond Hill": "Toronto",
  Oakville: "Toronto",
  Burnaby: "Vancouver",
  Surrey: "Vancouver",
  Richmond: "Vancouver",
  Coquitlam: "Vancouver",
};

function findCma(city: string): string {
  const norm = city.trim();
  return CITY_TO_CMA[norm] ?? CMA_KEYS.find((c) => c.toLowerCase() === norm.toLowerCase()) ?? norm;
}

function getRentFromArray(arr: Array<{ label: string; total_25?: number; raw?: number[] }>): number | null {
  const total = arr.find((e) => e.label === "Total");
  if (total?.total_25 != null) return total.total_25;
  if (total?.raw && total.raw.length > 0) return total.raw[total.raw.length - 1];
  const cma = arr.find((e) => e.label?.includes("CMA"));
  if (cma?.total_25 != null) return cma.total_25;
  if (cma?.raw && cma.raw.length > 0) return cma.raw[cma.raw.length - 1];
  return null;
}

function getVacancyFromArray(arr: Array<{ label: string; total_25?: number; raw?: number[] }>): number | null {
  const total = arr.find((e) => e.label === "Total");
  if (total?.total_25 != null) return total.total_25 / 100;
  if (total?.raw && total.raw.length > 0) return total.raw[total.raw.length - 1] / 100;
  const cma = arr.find((e) => e.label?.includes("CMA"));
  if (cma?.total_25 != null) return cma.total_25 / 100;
  if (cma?.raw && cma.raw.length > 0) return cma.raw[cma.raw.length - 1] / 100;
  return null;
}

/** Rent growth YoY by CMA (from survey; Montreal ~7.4%, Toronto ~5%, etc.) */
const RENT_GROWTH: Record<string, number> = {
  Vancouver: 0.068,
  Victoria: 0.05,
  Calgary: 0.04,
  Edmonton: 0.035,
  Regina: 0.03,
  Saskatoon: 0.03,
  Winnipeg: 0.04,
  Toronto: 0.05,
  Hamilton: 0.05,
  Kitchener: 0.05,
  London: 0.045,
  Ottawa: 0.05,
  "St. Catharines": 0.04,
  Windsor: 0.04,
  Gatineau: 0.05,
  Montreal: 0.074,
  "Quebec City": 0.05,
  Halifax: 0.06,
};

export function getBestRentEstimate(city: string, _units?: number): { rents: BedroomRents; source: string } {
  const cma = findCma(city);
  const cmaData = data[cma];
  if (!cmaData?.apt_rents_by_size) {
    return { rents: { total: 1500 }, source: `fallback_${cma}` };
  }
  const total = getRentFromArray(cmaData.apt_rents_by_size);
  if (total == null) return { rents: { total: 1500 }, source: `fallback_${cma}` };
  return {
    rents: { total: Math.round(total) },
    source: `cmhc_${cma}`,
  };
}

export function getBestVacancyRate(city: string): { rate: number; source: string } {
  const cma = findCma(city);
  const cmaData = data[cma];
  if (!cmaData?.apt_vacancy_by_size) {
    return { rate: 0.03, source: `fallback_${cma}` };
  }
  const rate = getVacancyFromArray(cmaData.apt_vacancy_by_size);
  return { rate: rate ?? 0.03, source: `cmhc_${cma}` };
}

export function getCmhcRentGrowth(city: string): number {
  const cma = findCma(city);
  return RENT_GROWTH[cma] ?? 0.04;
}

export function getAllCities(): string[] {
  return CMA_KEYS;
}
