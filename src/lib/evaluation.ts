/**
 * Investor evaluation: cashflow + equity growth scores.
 * Uses zone-level CMHC data when postal code resolves to a sub-zone.
 */

import { getBestRentEstimate, getBestVacancyRate } from "./cmhc-data";
import { resolveCmhcZone } from "./cmhc-zone";
import { getZoneRents, getZoneVacancy } from "./cmhc-zone-data";

const EQUITY_GROWTH: Record<string, number> = {
  Vancouver: 0.048,
  Victoria: 0.045,
  Toronto: 0.052,
  Montreal: 0.04,
  Calgary: 0.03,
  Edmonton: 0.025,
  Ottawa: 0.04,
  Hamilton: 0.045,
  Winnipeg: 0.03,
  Halifax: 0.04,
  "Quebec City": 0.035,
  Kitchener: 0.045,
  London: 0.04,
  Windsor: 0.035,
  "St. Catharines": 0.04,
  Regina: 0.025,
  Saskatoon: 0.025,
  Gatineau: 0.04,
};

function findCma(city: string): string {
  const cma = EQUITY_GROWTH[city] != null ? city : Object.keys(EQUITY_GROWTH)[0];
  return cma ?? city;
}

export function evaluateListing(input: {
  price: number;
  city: string;
  province?: string | null;
  postalCode?: string | null;
  units?: number;
  bedrooms?: number | null;
  rent?: number | null;
}): {
  cashflowScore: number;
  equityGrowthScore: number;
  combinedScore: number;
  cashflowNotes: string;
  equityNotes: string;
} {
  const { price, city, province, postalCode, units = 1, rent: inputRent } = input;
  const { cma, zone } = resolveCmhcZone(city, province, postalCode);

  let rent = inputRent;
  let rentSource = "fallback";
  if (rent == null) {
    if (zone) {
      const zoneRents = getZoneRents(cma, zone);
      if (zoneRents?.total != null) {
        rent = zoneRents.total;
        rentSource = `cmhc_${cma}_${zone}`;
      }
    }
    if (rent == null) {
      const est = getBestRentEstimate(city, units);
      rent = est.rents.total ?? 1500;
      rentSource = est.source;
    }
  }

  let vacRate = 0.03;
  if (zone) {
    const zoneVac = getZoneVacancy(cma, zone);
    if (zoneVac != null) vacRate = zoneVac;
  }
  if (vacRate === 0.03) {
    vacRate = getBestVacancyRate(city).rate;
  }

  const grossRent = (rent ?? 1500) * units;
  const noi = grossRent * (1 - vacRate) * 0.6;
  const grossYield = grossRent / price;
  const cashflowScore = Math.min(100, Math.max(0, grossYield * 1500));

  const growth = EQUITY_GROWTH[cma] ?? 0.04;
  const equityScore = Math.min(100, Math.max(0, growth * 1200));

  const combined = cashflowScore * 0.5 + equityScore * 0.5;

  return {
    cashflowScore: Math.round(cashflowScore * 10) / 10,
    equityGrowthScore: Math.round(equityScore * 10) / 10,
    combinedScore: Math.round(combined * 10) / 10,
    cashflowNotes: `Gross yield ${(grossYield * 100).toFixed(2)}%, rent from ${rentSource}${zone ? ` (zone: ${zone})` : ""}`,
    equityNotes: `Appreciation ~${(growth * 100).toFixed(1)}%/yr (${cma})`,
  };
}
