/**
 * Investment strategies and default assumptions.
 */

import { resolveCmhcZone } from "./cmhc-zone";
import { getBestRentEstimate, getBestVacancyRate, getCmhcRentGrowth } from "./cmhc-data";
import { getZoneRents, getZoneVacancy } from "./cmhc-zone-data";

export type StrategyId =
  | "buy_and_hold"
  | "brrr"
  | "value_add"
  | "cmhc_standard"
  | "land_bank";

export type Strategy = {
  id: StrategyId;
  name: string;
  description: string;
};

export const STRATEGIES: Strategy[] = [
  { id: "buy_and_hold", name: "Buy & Hold", description: "Long-term hold for cashflow and appreciation." },
  { id: "brrr", name: "BRRR", description: "Buy, renovate, rent, refinance, repeat." },
  { id: "value_add", name: "Value-Add", description: "Improve property to increase NOI and value." },
  { id: "cmhc_standard", name: "CMHC Standard Rental", description: "Insured financing for 5+ unit rentals." },
  { id: "land_bank", name: "Land Bank", description: "Hold land for future development." },
];

export type Assumptions = {
  avgMonthlyRentPerUnit: number;
  vacancyRate: number;
  rentGrowthAnnual: number;
  appreciationRateAnnual: number;
  propertyTaxRate: number;
};

export function buildDefaultAssumptions(listing: {
  city: string;
  province?: string | null;
  postalCode?: string | null;
  units?: number;
}): Assumptions & { rentSource: string; vacancySource: string } {
  const { cma, zone } = resolveCmhcZone(listing.city, listing.province, listing.postalCode);
  const units = listing.units ?? 1;

  let rent = 1500;
  let rentSource = "fallback";

  if (zone) {
    const zoneRents = getZoneRents(cma, zone);
    if (zoneRents?.total != null) {
      rent = zoneRents.total;
      rentSource = `cmhc_${cma}_${zone}`;
    }
  }
  if (rentSource === "fallback") {
    const est = getBestRentEstimate(listing.city, units);
    rent = est.rents.total ?? 1500;
    rentSource = est.source;
  }

  let vacRate = 0.03;
  if (zone) {
    const zoneVac = getZoneVacancy(cma, zone);
    if (zoneVac != null) vacRate = zoneVac;
  }
  if (vacRate === 0.03) {
    vacRate = getBestVacancyRate(listing.city).rate;
  }

  const rentGrowth = getCmhcRentGrowth(listing.city);
  const appreciation = cma === "Toronto" ? 0.052 : cma === "Vancouver" ? 0.048 : 0.04;
  const taxRate = listing.province === "QC" ? 0.012 : 0.01;

  return {
    avgMonthlyRentPerUnit: Math.round(rent),
    vacancyRate: vacRate,
    rentGrowthAnnual: rentGrowth,
    appreciationRateAnnual: appreciation,
    propertyTaxRate: taxRate,
    rentSource,
    vacancySource: zone ? `cmhc_${cma}_${zone}` : `cmhc_${cma}`,
  };
}
