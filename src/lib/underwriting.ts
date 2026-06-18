export type FinancingTrack =
  | "owner_occupied_residential"
  | "residential_investment"
  | "personal_plex_lender_exception"
  | "commercial_multifamily"
  | "land_or_non_residential";

export interface UnderwritingInputs {
  annualEmploymentIncome: number;
  annualOtherIncome: number;
  monthlyDebtPayments: number;
  monthlyTaxesHeatingCondo: number;
  maxDownPayment: number;
  closingCostReserve: number;
  creditScore: number | null;
  ownerOccupied: boolean;
  rentalIncomeOffsetPct: number;
  expectedMonthlyRentPerUnit: number;
  qualifyingRatePct: number;
  amortizationYears: number;
  targetCommercialRefinanceYears: number;
  targetCommercialLtvPct: number;
  targetCommercialDscr: number;
}

export interface BorrowerCapacity {
  grossMonthlyIncome: number;
  qualifyingMonthlyIncome: number;
  maximumMonthlyHousingCost: number;
  maximumMonthlyMortgagePayment: number;
  maximumMortgagePrincipal: number;
  maximumPurchasePrice: number;
  gdsLimitPct: number;
  tdsLimitPct: number;
}

export interface ListingCashRequirement {
  financingTrack: FinancingTrack;
  financingTrackLabel: string;
  minimumDownPaymentPct: number;
  minimumDownPayment: number;
  manualLenderReview: boolean;
  note: string;
}

export interface CommercialTakeoutInputs {
  stabilizedNoi: number;
  exitCapRatePct: number;
  currentLoanBalance: number;
  mortgageRatePct: number;
  amortizationYears: number;
  maxLtvPct: number;
  minimumDscr: number;
}

export interface CommercialTakeoutResult {
  stabilizedValue: number;
  ltvLimitedLoan: number;
  dscrLimitedLoan: number;
  maximumTakeoutLoan: number;
  estimatedDebtReplaced: number;
  estimatedExcessProceeds: number;
}

export const GDS_LIMIT_PCT = 0.39;
export const TDS_LIMIT_PCT = 0.44;

export const DEFAULT_UNDERWRITING_INPUTS: UnderwritingInputs = {
  annualEmploymentIncome: 0,
  annualOtherIncome: 0,
  monthlyDebtPayments: 0,
  monthlyTaxesHeatingCondo: 750,
  maxDownPayment: 250_000,
  closingCostReserve: 25_000,
  creditScore: null,
  ownerOccupied: false,
  rentalIncomeOffsetPct: 0.5,
  expectedMonthlyRentPerUnit: 1_500,
  qualifyingRatePct: 7,
  amortizationYears: 25,
  targetCommercialRefinanceYears: 3,
  targetCommercialLtvPct: 0.75,
  targetCommercialDscr: 1.2,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function monthlyMortgagePayment(
  principal: number,
  annualRatePct: number,
  amortizationYears: number
): number {
  if (principal <= 0 || amortizationYears <= 0) return 0;
  const periods = amortizationYears * 12;
  const monthlyRate = Math.max(0, annualRatePct) / 100 / 12;
  if (monthlyRate === 0) return principal / periods;
  const factor = Math.pow(1 + monthlyRate, periods);
  return principal * ((monthlyRate * factor) / (factor - 1));
}

export function mortgagePrincipalFromPayment(
  monthlyPayment: number,
  annualRatePct: number,
  amortizationYears: number
): number {
  if (monthlyPayment <= 0 || amortizationYears <= 0) return 0;
  const periods = amortizationYears * 12;
  const monthlyRate = Math.max(0, annualRatePct) / 100 / 12;
  if (monthlyRate === 0) return monthlyPayment * periods;
  const factor = Math.pow(1 + monthlyRate, periods);
  return monthlyPayment * ((factor - 1) / (monthlyRate * factor));
}

export function calculateBorrowerCapacity(
  inputs: UnderwritingInputs,
  subjectUnits = 0
): BorrowerCapacity {
  const grossMonthlyIncome =
    (Math.max(0, inputs.annualEmploymentIncome) + Math.max(0, inputs.annualOtherIncome)) / 12;
  const rentableUnits = Math.max(
    0,
    subjectUnits - (inputs.ownerOccupied && subjectUnits > 0 ? 1 : 0)
  );
  const subjectMonthlyRent =
    rentableUnits * Math.max(0, inputs.expectedMonthlyRentPerUnit);
  const qualifyingMonthlyIncome =
    grossMonthlyIncome + subjectMonthlyRent * clamp(inputs.rentalIncomeOffsetPct, 0, 1);
  const gdsHousingLimit = qualifyingMonthlyIncome * GDS_LIMIT_PCT;
  const tdsHousingLimit =
    qualifyingMonthlyIncome * TDS_LIMIT_PCT - Math.max(0, inputs.monthlyDebtPayments);
  const maximumMonthlyHousingCost = Math.max(0, Math.min(gdsHousingLimit, tdsHousingLimit));
  const maximumMonthlyMortgagePayment = Math.max(
    0,
    maximumMonthlyHousingCost - Math.max(0, inputs.monthlyTaxesHeatingCondo)
  );
  const maximumMortgagePrincipal = mortgagePrincipalFromPayment(
    maximumMonthlyMortgagePayment,
    inputs.qualifyingRatePct,
    inputs.amortizationYears
  );
  const deployableCash = Math.max(
    0,
    inputs.maxDownPayment - Math.max(0, inputs.closingCostReserve)
  );

  return {
    grossMonthlyIncome,
    qualifyingMonthlyIncome,
    maximumMonthlyHousingCost,
    maximumMonthlyMortgagePayment,
    maximumMortgagePrincipal,
    maximumPurchasePrice: maximumMortgagePrincipal + deployableCash,
    gdsLimitPct: GDS_LIMIT_PCT,
    tdsLimitPct: TDS_LIMIT_PCT,
  };
}

function ownerOccupiedMinimumDownPayment(price: number, units: number): number {
  if (price >= 1_500_000) return price * 0.2;
  if (units >= 3) return price * 0.1;
  return price <= 500_000 ? price * 0.05 : 25_000 + (price - 500_000) * 0.1;
}

export function getListingCashRequirement(
  price: number,
  units: number,
  ownerOccupied: boolean,
  propertyType = ""
): ListingCashRequirement {
  const normalizedPrice = Math.max(0, price);
  const normalizedUnits = Math.max(1, Math.round(units));
  const normalizedPropertyType = propertyType.trim().toLowerCase();

  if (/land|parking|commercial|industrial/.test(normalizedPropertyType)) {
    return {
      financingTrack: "land_or_non_residential",
      financingTrackLabel: "Land / non-residential",
      minimumDownPaymentPct: 0.35,
      minimumDownPayment: normalizedPrice * 0.35,
      manualLenderReview: true,
      note: "Screened with a conservative 65% LTV ceiling pending site- and lender-specific underwriting.",
    };
  }

  if (normalizedUnits >= 5 && normalizedUnits <= 8) {
    return {
      financingTrack: "personal_plex_lender_exception",
      financingTrackLabel: "Personal plex exception",
      minimumDownPaymentPct: 0.2,
      minimumDownPayment: normalizedPrice * 0.2,
      manualLenderReview: true,
      note:
        "Modeled as a 5-8 unit personal-borrower exception path with 80% LTV. This requires written lender confirmation for unit count, rental-income treatment, title/borrower structure, and whether the debt can later be replaced or moved off the personal file.",
    };
  }

  if (normalizedUnits >= 9) {
    return {
      financingTrack: "commercial_multifamily",
      financingTrackLabel: "Commercial multifamily",
      minimumDownPaymentPct: 0.25,
      minimumDownPayment: normalizedPrice * 0.25,
      manualLenderReview: false,
      note:
        "9+ units are screened on commercial property cash flow, value, and debt coverage in this model.",
    };
  }

  if (ownerOccupied) {
    const minimumDownPayment = ownerOccupiedMinimumDownPayment(
      normalizedPrice,
      normalizedUnits
    );
    return {
      financingTrack: "owner_occupied_residential",
      financingTrackLabel: "Owner-occupied residential",
      minimumDownPaymentPct:
        normalizedPrice > 0 ? minimumDownPayment / normalizedPrice : 0,
      minimumDownPayment,
      manualLenderReview: false,
      note: "Modeled with insured owner-occupied minimum down-payment rules for 1-4 units.",
    };
  }

  return {
    financingTrack: "residential_investment",
    financingTrackLabel: "Residential investment",
    minimumDownPaymentPct: 0.2,
    minimumDownPayment: normalizedPrice * 0.2,
    manualLenderReview: false,
    note: "Modeled as a non-owner-occupied 1-4 unit rental with at least 20% equity.",
  };
}

export function calculateCommercialTakeout(
  inputs: CommercialTakeoutInputs
): CommercialTakeoutResult {
  const stabilizedNoi = Math.max(0, inputs.stabilizedNoi);
  const capRate = Math.max(0, inputs.exitCapRatePct) / 100;
  const stabilizedValue = capRate > 0 ? stabilizedNoi / capRate : 0;
  const ltvLimitedLoan = stabilizedValue * clamp(inputs.maxLtvPct, 0, 1);
  const maximumAnnualDebtService =
    inputs.minimumDscr > 0 ? stabilizedNoi / inputs.minimumDscr : 0;
  const dscrLimitedLoan = mortgagePrincipalFromPayment(
    maximumAnnualDebtService / 12,
    inputs.mortgageRatePct,
    inputs.amortizationYears
  );
  const maximumTakeoutLoan = Math.max(0, Math.min(ltvLimitedLoan, dscrLimitedLoan));
  const currentLoanBalance = Math.max(0, inputs.currentLoanBalance);

  return {
    stabilizedValue,
    ltvLimitedLoan,
    dscrLimitedLoan,
    maximumTakeoutLoan,
    estimatedDebtReplaced: Math.min(currentLoanBalance, maximumTakeoutLoan),
    estimatedExcessProceeds: Math.max(0, maximumTakeoutLoan - currentLoanBalance),
  };
}
