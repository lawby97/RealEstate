import assert from "node:assert/strict";
import test from "node:test";
import { computeBuyAndHold, computeCashflowProjection } from "../src/lib/finance";

test("buy-and-hold and hold-period projection use complete unit rent schedules", () => {
  const financeInputs = {
    price: 1_000_000,
    units: 5,
    avgMonthlyRentPerUnit: 1_000,
    unitMonthlyRents: [800, 900, 1_000, 1_100, 2_500],
    vacancyRate: 0,
    operatingExpenseItems: [],
    mortgageRate: 0.05,
    amortizationYears: 30,
    ltvPct: 0.75,
    closingCostPct: 0.02,
  };

  const result = computeBuyAndHold(financeInputs);
  const projection = computeCashflowProjection({
    financeInputs,
    holdPeriodYears: 2,
    rentGrowthRateAnnual: 0.1,
  });

  assert.equal(result.grossScheduledRent, 75_600);
  assert.equal(projection.years[0]?.grossScheduledRent, 75_600);
  assert.equal(Math.round(projection.years[1]?.grossScheduledRent ?? 0), 83_160);
  assert.equal(projection.years[0]?.avgMonthlyRentPerUnit, 1_260);
});

test("unit rent schedules fall back to average rent when line count does not match units", () => {
  const result = computeBuyAndHold({
    price: 1_000_000,
    units: 5,
    avgMonthlyRentPerUnit: 1_000,
    unitMonthlyRents: [2_500, 2_500],
    vacancyRate: 0,
    operatingExpenseItems: [],
    mortgageRate: 0.05,
    amortizationYears: 30,
    ltvPct: 0.75,
    closingCostPct: 0.02,
  });

  assert.equal(result.grossScheduledRent, 60_000);
});
