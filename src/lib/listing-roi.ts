import { getBestRentEstimate, getBestVacancyRate } from "@/lib/cmhc-data";
import {
  computeBuyAndHold,
  computeCashflowProjection,
  computeReturnBridge,
} from "@/lib/finance";
import { getListingCashRequirement } from "@/lib/underwriting";

export interface ListingRoiInput {
  price: number;
  city: string;
  units: number;
  propertyType: string;
  ownerOccupied?: boolean;
}

export interface ListingRoiCashflowYear {
  year: number;
  annualCashflow: number;
  monthlyCashflow: number;
  cumulativeCashflow: number;
  dscr: number;
}

export interface ListingRoiResult {
  cashOnCashReturn: number | null;
  annualCashflow: number;
  equityRequired: number;
  rentPerUnitMonthly: number;
  cashflowYears: ListingRoiCashflowYear[];
  yearOneRoi: number | null;
  totalYearOneReturn: number;
  yearOneDebtPaydown: number;
  yearOneAppreciation: number;
}

const CARD_RENT_GROWTH_RATE_ANNUAL = 0.03;
const CARD_APPRECIATION_RATE_ANNUAL = 0.04;
const CARD_HOLD_PERIOD_YEARS = 3;
const CARD_PERSONAL_RENTAL_MORTGAGE_RATE = 0.0495;
const CARD_COMMERCIAL_MULTIFAMILY_MORTGAGE_RATE = 0.0525;

export function computeListingCashOnCashRoi(input: ListingRoiInput): ListingRoiResult {
  const price = Math.max(0, input.price);
  const units = Math.max(1, Math.round(input.units || 1));
  if (price <= 0) {
    return {
      cashOnCashReturn: null,
      annualCashflow: 0,
      equityRequired: 0,
      rentPerUnitMonthly: 0,
      cashflowYears: [],
      yearOneRoi: null,
      totalYearOneReturn: 0,
      yearOneDebtPaydown: 0,
      yearOneAppreciation: 0,
    };
  }

  const rentEstimate = getBestRentEstimate(input.city, units);
  const vacancyRate = getBestVacancyRate(input.city).rate;
  const cashRequirement = getListingCashRequirement(
    price,
    units,
    input.ownerOccupied === true,
    input.propertyType
  );
  if (cashRequirement.financingTrack === "land_or_non_residential") {
    return {
      cashOnCashReturn: null,
      annualCashflow: 0,
      equityRequired: Math.round(cashRequirement.minimumDownPayment + price * 0.02),
      rentPerUnitMonthly: 0,
      cashflowYears: [],
      yearOneRoi: null,
      totalYearOneReturn: 0,
      yearOneDebtPaydown: 0,
      yearOneAppreciation: 0,
    };
  }
  const ltvPct = Math.max(0, Math.min(0.95, 1 - cashRequirement.minimumDownPaymentPct));
  const financeInputs = {
    price,
    units,
    avgMonthlyRentPerUnit: rentEstimate.rents.total ?? 1500,
    vacancyRate,
    operatingExpenseRatio: units >= 5 ? 0.4 : 0.35,
    mortgageRate:
      cashRequirement.financingTrack === "commercial_multifamily"
        ? CARD_COMMERCIAL_MULTIFAMILY_MORTGAGE_RATE
        : CARD_PERSONAL_RENTAL_MORTGAGE_RATE,
    amortizationYears:
      cashRequirement.financingTrack === "commercial_multifamily" ? 25 : 30,
    ltvPct,
    closingCostPct: 0.02,
  };
  const result = computeBuyAndHold(financeInputs);
  const cashflowProjection = computeCashflowProjection({
    financeInputs,
    holdPeriodYears: CARD_HOLD_PERIOD_YEARS,
    rentGrowthRateAnnual: CARD_RENT_GROWTH_RATE_ANNUAL,
  });
  const yearOneProjection = cashflowProjection.years[0];
  const returnBridge = computeReturnBridge({
    result,
    price,
    appreciationRateAnnual: CARD_APPRECIATION_RATE_ANNUAL,
    mortgageRate: financeInputs.mortgageRate,
    amortizationYears: financeInputs.amortizationYears,
    holdPeriodYears: CARD_HOLD_PERIOD_YEARS,
    yearOneCashflowOverride: yearOneProjection?.annualCashflow,
    yearOneDebtPaydownOverride: yearOneProjection?.principalPaidYear,
    holdPeriodCashflow: cashflowProjection.totalCashflow,
  });
  const yearOneCashflow = yearOneProjection?.annualCashflow ?? result.annualCashflow;
  const cashOnCashReturn =
    result.equityRequired > 0 && Number.isFinite(yearOneCashflow)
      ? (yearOneCashflow / result.equityRequired) * 100
      : null;

  return {
    cashOnCashReturn:
      cashOnCashReturn != null && Number.isFinite(cashOnCashReturn)
        ? roundPercent(cashOnCashReturn)
        : null,
    annualCashflow: Math.round(yearOneCashflow),
    equityRequired: Math.round(result.equityRequired),
    rentPerUnitMonthly: Math.round(rentEstimate.rents.total ?? 1500),
    cashflowYears: cashflowProjection.years.slice(0, 3).map((year) => ({
      year: year.year,
      annualCashflow: Math.round(year.annualCashflow),
      monthlyCashflow: Math.round(year.monthlyCashflow),
      cumulativeCashflow: Math.round(year.cumulativeCashflow),
      dscr: roundRatio(year.dscr),
    })),
    yearOneRoi:
      returnBridge.totalYearOneRoiPct != null && Number.isFinite(returnBridge.totalYearOneRoiPct)
        ? roundPercent(returnBridge.totalYearOneRoiPct)
        : null,
    totalYearOneReturn: Math.round(returnBridge.totalYearOneReturn),
    yearOneDebtPaydown: Math.round(returnBridge.yearOneDebtPaydown),
    yearOneAppreciation: Math.round(returnBridge.yearOneAppreciation),
  };
}

export function sortByCashOnCashRoi<T extends { roi?: { cashOnCashReturn: number | null } }>(
  rows: T[],
  direction: "asc" | "desc"
): T[] {
  const multiplier = direction === "desc" ? -1 : 1;
  return rows.sort((a, b) => {
    const left = a.roi?.cashOnCashReturn;
    const right = b.roi?.cashOnCashReturn;
    if (left == null && right == null) return 0;
    if (left == null) return 1;
    if (right == null) return -1;
    return (left - right) * multiplier;
  });
}

function roundPercent(value: number): number {
  return Math.round(value * 10) / 10;
}

function roundRatio(value: number): number {
  return Math.round(value * 100) / 100;
}
