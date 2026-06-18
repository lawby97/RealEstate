import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_UNDERWRITING_INPUTS,
  calculateBorrowerCapacity,
  calculateCommercialTakeout,
  getListingCashRequirement,
  mortgagePrincipalFromPayment,
  monthlyMortgagePayment,
} from "../src/lib/underwriting";

test("mortgage payment and principal conversions round trip", () => {
  const payment = monthlyMortgagePayment(500_000, 6.5, 25);
  const principal = mortgagePrincipalFromPayment(payment, 6.5, 25);
  assert.ok(Math.abs(principal - 500_000) < 1);
});

test("owner-occupied down payment uses insured tiers for one to two units", () => {
  const requirement = getListingCashRequirement(800_000, 2, true);
  assert.equal(requirement.minimumDownPayment, 55_000);
  assert.equal(requirement.financingTrack, "owner_occupied_residential");
});

test("non-owner-occupied one to four unit rentals require twenty percent", () => {
  const requirement = getListingCashRequirement(900_000, 4, false);
  assert.equal(requirement.minimumDownPayment, 180_000);
  assert.equal(requirement.manualLenderReview, false);
});

test("five to eight unit plexes can use a personal lender exception path", () => {
  const requirement = getListingCashRequirement(1_200_000, 6, false);
  assert.equal(requirement.minimumDownPayment, 240_000);
  assert.equal(requirement.financingTrack, "personal_plex_lender_exception");
  assert.equal(requirement.manualLenderReview, true);
});

test("nine plus unit buildings stay on the commercial review path", () => {
  const requirement = getListingCashRequirement(1_200_000, 9, false);
  assert.equal(requirement.minimumDownPayment, 300_000);
  assert.equal(requirement.financingTrack, "commercial_multifamily");
  assert.equal(requirement.manualLenderReview, false);
});

test("borrower capacity is constrained by TDS after monthly debt", () => {
  const capacity = calculateBorrowerCapacity({
    ...DEFAULT_UNDERWRITING_INPUTS,
    annualEmploymentIncome: 120_000,
    monthlyDebtPayments: 1_500,
    monthlyTaxesHeatingCondo: 500,
  });

  assert.equal(capacity.grossMonthlyIncome, 10_000);
  assert.equal(capacity.maximumMonthlyHousingCost, 2_900);
  assert.equal(capacity.maximumMonthlyMortgagePayment, 2_400);
});

test("owner-occupied capacity excludes the occupied unit from rental income", () => {
  const capacity = calculateBorrowerCapacity(
    {
      ...DEFAULT_UNDERWRITING_INPUTS,
      ownerOccupied: true,
      monthlyTaxesHeatingCondo: 0,
    },
    2
  );

  assert.equal(capacity.qualifyingMonthlyIncome, 750);
});

test("vacant land is not labeled as a residential mortgage", () => {
  const requirement = getListingCashRequirement(500_000, 1, false, "Vacant Land");
  assert.equal(requirement.financingTrack, "land_or_non_residential");
  assert.equal(requirement.minimumDownPayment, 175_000);
});

test("commercial takeout uses the lower of LTV and DSCR sizing", () => {
  const result = calculateCommercialTakeout({
    stabilizedNoi: 120_000,
    exitCapRatePct: 5,
    currentLoanBalance: 1_200_000,
    mortgageRatePct: 5.5,
    amortizationYears: 30,
    maxLtvPct: 0.75,
    minimumDscr: 1.2,
  });

  assert.equal(result.stabilizedValue, 2_400_000);
  assert.equal(result.ltvLimitedLoan, 1_800_000);
  assert.ok(result.maximumTakeoutLoan <= result.ltvLimitedLoan);
  assert.equal(result.estimatedDebtReplaced, 1_200_000);
});
