/**
 * Centralized finance engine for listing scenarios.
 * All formulas in one place; no duplicated logic.
 */

import type { OperatingExpenseBasis } from "@/types/listing";

export interface FinanceOperatingExpenseItem {
  key?: string;
  label?: string;
  basis: OperatingExpenseBasis;
  rate: number;
}

export interface FinanceInputs {
  price: number;
  units: number;
  avgMonthlyRentPerUnit: number;
  vacancyRate: number; // 0–1
  managementFeeRate?: number; // 0–1
  operatingExpenseRatio?: number; // legacy fallback if explicit line items are not provided
  operatingExpenseItems?: FinanceOperatingExpenseItem[];
  propertyTaxAnnual?: number; // legacy compatibility path; live scenarios should pass tax through operatingExpenseItems
  mortgageRate: number; // annual, e.g. 0.055
  amortizationYears: number;
  ltvPct: number; // 0–1, e.g. 0.8 = 80%
  closingCostPct?: number; // 0–1, e.g. 0.02
  capitalBudget?: number;
  otherIncomeMonthly?: number;
}

export interface FinanceResult {
  basisPrice: number;
  capitalBudget: number;
  closingCosts: number;
  grossScheduledRent: number;
  effectiveGrossIncome: number;
  operatingExpenses: number;
  operatingExpenseRatio: number;
  noi: number;
  loanAmount: number;
  annualDebtService: number;
  annualCashflow: number;
  monthlyCashflow: number;
  dscr: number;
  capRate: number;
  cashOnCashReturn: number | null;
  equityRequired: number;
  totalCost: number;
}

export interface CashflowProjectionYear extends FinanceResult {
  year: number;
  avgMonthlyRentPerUnit: number;
  cumulativeCashflow: number;
  loanBalanceEnd: number;
  principalPaidYear: number;
  bridgeCarry: number;
  permanentDebtService: number;
  bridgeMonthsActive: number;
  takeoutMonthsActive: number;
  financingPhase: "permanent_debt" | "bridge_only" | "bridge_to_takeout";
}

export interface CashflowProjectionResult {
  years: CashflowProjectionYear[];
  totalCashflow: number;
}

export interface CashflowBridgeInputs {
  enabled: boolean;
  bridgeMonthlyCarry: number;
  bridgeTermMonths: number;
  takeoutLoanAmount: number;
  takeoutMortgageRate: number;
  takeoutAmortizationYears: number;
}

/**
 * Gross Scheduled Rent = units × avg monthly rent × 12
 */
export function grossScheduledRent(units: number, avgMonthlyRent: number): number {
  return units * avgMonthlyRent * 12;
}

/**
 * Effective Gross Income = GSR × (1 - vacancy) + other income
 */
export function effectiveGrossIncome(
  gsr: number,
  vacancyRate: number,
  otherIncomeAnnual = 0
): number {
  return gsr * (1 - vacancyRate) + otherIncomeAnnual;
}

/**
 * Operating expenses: either explicit line items or fallback ratio plus optional fixed annual tax.
 */
export function resolveOperatingExpenseItemAmount(
  item: FinanceOperatingExpenseItem,
  egi: number,
  price: number
): number {
  if (item.basis === "effective_gross_income") return Math.max(0, egi * item.rate);
  if (item.basis === "purchase_price") return Math.max(0, price * item.rate);
  return Math.max(0, item.rate);
}

export function operatingExpenses(
  egi: number,
  expenseRatio: number,
  price: number,
  propertyTaxAnnual?: number,
  managementFeeRate = 0,
  operatingExpenseItems?: FinanceOperatingExpenseItem[]
): number {
  if (operatingExpenseItems?.length) {
    return operatingExpenseItems.reduce(
      (sum, item) => sum + resolveOperatingExpenseItemAmount(item, egi, price),
      0
    );
  }

  const management = egi * managementFeeRate;
  if (propertyTaxAnnual != null && propertyTaxAnnual > 0) {
    const tax = propertyTaxAnnual;
    const other = egi * expenseRatio;
    return tax + other + management;
  }
  return egi * expenseRatio + management;
}

/**
 * NOI = EGI - operating expenses
 */
export function noi(egi: number, operatingExpensesAmount: number): number {
  return egi - operatingExpensesAmount;
}

export function deriveOperatingExpenseRatio(
  operatingExpensesAmount: number,
  effectiveGrossIncomeAmount: number
): number {
  if (effectiveGrossIncomeAmount <= 0) return 0;
  return operatingExpensesAmount / effectiveGrossIncomeAmount;
}

/**
 * Annual debt service from loan amount, rate, amortization (monthly payment × 12)
 */
export function annualDebtService(
  loanAmount: number,
  annualRate: number,
  amortizationYears: number
): number {
  if (amortizationYears <= 0 || loanAmount <= 0) return 0;
  const monthlyRate = annualRate / 12;
  const n = amortizationYears * 12;
  const payment =
    monthlyRate === 0
      ? loanAmount / n
      : (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, n)) /
        (Math.pow(1 + monthlyRate, n) - 1);
  return payment * 12;
}

/**
 * DSCR = NOI / annual debt service
 */
export function dscr(noiAmount: number, annualDebtServiceAmount: number): number {
  if (annualDebtServiceAmount <= 0) return 0;
  return noiAmount / annualDebtServiceAmount;
}

/**
 * Cap rate = NOI / price
 */
export function capRate(noiAmount: number, price: number): number {
  if (price <= 0) return 0;
  return noiAmount / price;
}

/**
 * Full conventional buy-and-hold scenario from inputs.
 */
export function computeBuyAndHold(inputs: FinanceInputs): FinanceResult {
  const capitalBudget = inputs.capitalBudget ?? 0;
  const basisPrice = inputs.price + capitalBudget;
  const gsr = grossScheduledRent(inputs.units, inputs.avgMonthlyRentPerUnit);
  const otherIncomeAnnual = (inputs.otherIncomeMonthly ?? 0) * 12;
  const egi = effectiveGrossIncome(gsr, inputs.vacancyRate, otherIncomeAnnual);

  const expenseRatio = inputs.operatingExpenseRatio ?? 0.35;
  const opEx = operatingExpenses(
    egi,
    expenseRatio,
    inputs.price,
    inputs.propertyTaxAnnual,
    inputs.managementFeeRate ?? 0,
    inputs.operatingExpenseItems
  );
  const opExRatio = deriveOperatingExpenseRatio(opEx, egi);
  const noiAmount = noi(egi, opEx);

  const loanAmount = basisPrice * inputs.ltvPct;
  const ads = annualDebtService(
    loanAmount,
    inputs.mortgageRate,
    inputs.amortizationYears
  );
  const annualCf = noiAmount - ads;
  const closingCosts = inputs.price * (inputs.closingCostPct ?? 0);
  const totalCost = basisPrice + closingCosts;
  const equityRequired = totalCost - loanAmount;
  const coc =
    equityRequired > 0 ? (annualCf / equityRequired) * 100 : null;

  return {
    basisPrice,
    capitalBudget,
    closingCosts,
    grossScheduledRent: gsr,
    effectiveGrossIncome: egi,
    operatingExpenses: opEx,
    operatingExpenseRatio: opExRatio,
    noi: noiAmount,
    loanAmount,
    annualDebtService: ads,
    annualCashflow: annualCf,
    monthlyCashflow: annualCf / 12,
    dscr: dscr(noiAmount, ads),
    capRate: capRate(noiAmount, basisPrice),
    cashOnCashReturn: coc,
    equityRequired,
    totalCost,
  };
}

/**
 * Stabilized value for 5+ multifamily: NOI / exit cap rate
 */
export function stabilizedValue(stabilizedNoi: number, exitCapRate: number): number {
  if (exitCapRate <= 0) return 0;
  return stabilizedNoi / exitCapRate;
}

export function remainingLoanBalance(
  loanAmount: number,
  annualRate: number,
  amortizationYears: number,
  yearsElapsed: number
): number {
  if (loanAmount <= 0 || amortizationYears <= 0) return 0;
  const monthlyRate = annualRate / 12;
  const periods = amortizationYears * 12;
  const paymentsMade = Math.max(0, Math.min(periods, Math.round(yearsElapsed * 12)));

  if (monthlyRate === 0) {
    return Math.max(0, loanAmount * (1 - paymentsMade / periods));
  }

  const factor = Math.pow(1 + monthlyRate, periods);
  const paidFactor = Math.pow(1 + monthlyRate, paymentsMade);
  return loanAmount * ((factor - paidFactor) / (factor - 1));
}

export function principalPaidAfterYears(
  loanAmount: number,
  annualRate: number,
  amortizationYears: number,
  yearsElapsed: number
): number {
  return Math.max(
    0,
    loanAmount - remainingLoanBalance(loanAmount, annualRate, amortizationYears, yearsElapsed)
  );
}

export function projectedValue(
  startingValue: number,
  appreciationRateAnnual: number,
  years: number
): number {
  if (startingValue <= 0) return 0;
  return startingValue * Math.pow(1 + appreciationRateAnnual, years);
}

export function computeCashflowProjection(inputs: {
  financeInputs: FinanceInputs;
  holdPeriodYears: number;
  rentGrowthRateAnnual: number;
  bridge?: CashflowBridgeInputs | null;
}): CashflowProjectionResult {
  const holdPeriodYears = Math.max(1, Math.round(inputs.holdPeriodYears));
  const rentGrowthRateAnnual = inputs.rentGrowthRateAnnual;
  const years: CashflowProjectionYear[] = [];
  let cumulativeCashflow = 0;

  for (let year = 1; year <= holdPeriodYears; year += 1) {
    const avgMonthlyRentPerUnit =
      inputs.financeInputs.avgMonthlyRentPerUnit * Math.pow(1 + rentGrowthRateAnnual, year - 1);
    const baseResult = computeBuyAndHold({
      ...inputs.financeInputs,
      avgMonthlyRentPerUnit,
    });

    let annualDebtServiceAmount = baseResult.annualDebtService;
    let bridgeCarry = 0;
    let permanentDebtService = baseResult.annualDebtService;
    let bridgeMonthsActive = 0;
    let takeoutMonthsActive = 12;
    let financingPhase: CashflowProjectionYear["financingPhase"] = "permanent_debt";
    let loanBalanceEnd = remainingLoanBalance(
      baseResult.loanAmount,
      inputs.financeInputs.mortgageRate,
      inputs.financeInputs.amortizationYears,
      year
    );
    let principalPaidYear =
      year === 1
        ? baseResult.loanAmount - loanBalanceEnd
        : Math.max(
            0,
            remainingLoanBalance(
              baseResult.loanAmount,
              inputs.financeInputs.mortgageRate,
              inputs.financeInputs.amortizationYears,
              year - 1
            ) - loanBalanceEnd
          );

    if (inputs.bridge?.enabled) {
      const yearStartMonth = (year - 1) * 12;
      const yearEndMonth = year * 12;
      bridgeMonthsActive = overlapMonths(
        yearStartMonth,
        yearEndMonth,
        0,
        Math.max(0, Math.round(inputs.bridge.bridgeTermMonths))
      );
      takeoutMonthsActive = Math.max(0, 12 - bridgeMonthsActive);
      const takeoutMonthlyPayment =
        annualDebtService(
          inputs.bridge.takeoutLoanAmount,
          inputs.bridge.takeoutMortgageRate,
          inputs.bridge.takeoutAmortizationYears
        ) / 12;
      bridgeCarry = roundCurrency(inputs.bridge.bridgeMonthlyCarry * bridgeMonthsActive);
      permanentDebtService = roundCurrency(takeoutMonthlyPayment * takeoutMonthsActive);
      annualDebtServiceAmount = roundCurrency(bridgeCarry + permanentDebtService);
      financingPhase =
        bridgeMonthsActive === 12
          ? "bridge_only"
          : bridgeMonthsActive > 0
            ? "bridge_to_takeout"
            : "permanent_debt";

      const takeoutMonthsElapsedStart = Math.max(
        0,
        yearStartMonth - Math.max(0, Math.round(inputs.bridge.bridgeTermMonths))
      );
      const takeoutMonthsElapsedEnd = Math.max(
        0,
        yearEndMonth - Math.max(0, Math.round(inputs.bridge.bridgeTermMonths))
      );
      const loanBalanceStart =
        takeoutMonthsElapsedStart > 0
          ? remainingLoanBalance(
              inputs.bridge.takeoutLoanAmount,
              inputs.bridge.takeoutMortgageRate,
              inputs.bridge.takeoutAmortizationYears,
              takeoutMonthsElapsedStart / 12
            )
          : takeoutMonthsActive > 0
            ? inputs.bridge.takeoutLoanAmount
            : 0;
      loanBalanceEnd =
        takeoutMonthsElapsedEnd > 0
          ? remainingLoanBalance(
              inputs.bridge.takeoutLoanAmount,
              inputs.bridge.takeoutMortgageRate,
              inputs.bridge.takeoutAmortizationYears,
              takeoutMonthsElapsedEnd / 12
            )
          : 0;
      principalPaidYear =
        takeoutMonthsElapsedEnd > 0 ? Math.max(0, loanBalanceStart - loanBalanceEnd) : 0;
    }

    const annualCashflow = baseResult.noi - annualDebtServiceAmount;
    cumulativeCashflow += annualCashflow;

    const result: FinanceResult = {
      ...baseResult,
      annualDebtService: annualDebtServiceAmount,
      annualCashflow,
      monthlyCashflow: annualCashflow / 12,
      dscr: dscr(baseResult.noi, annualDebtServiceAmount),
      cashOnCashReturn:
        baseResult.equityRequired > 0 ? (annualCashflow / baseResult.equityRequired) * 100 : null,
    };

    years.push({
      year,
      avgMonthlyRentPerUnit,
      cumulativeCashflow,
      loanBalanceEnd,
      principalPaidYear,
      bridgeCarry,
      permanentDebtService,
      bridgeMonthsActive,
      takeoutMonthsActive,
      financingPhase,
      ...result,
    });
  }

  return {
    years,
    totalCashflow: cumulativeCashflow,
  };
}

function overlapMonths(startA: number, endA: number, startB: number, endB: number): number {
  return Math.max(0, Math.min(endA, endB) - Math.max(startA, startB));
}

export interface ReturnBridgeInputs {
  result: FinanceResult;
  price: number;
  appreciationRateAnnual: number;
  mortgageRate: number;
  amortizationYears: number;
  holdPeriodYears: number;
  yearOneCashflowOverride?: number | null;
  yearOneDebtPaydownOverride?: number | null;
  exitLoanBalanceOverride?: number | null;
  holdPeriodCashflow?: number | null;
  stabilizationLift?: number | null;
  projectionStartValue?: number | null;
}

export interface ReturnBridgeResult {
  yearOneCashflow: number;
  yearOneDebtPaydown: number;
  yearOneAppreciation: number;
  stabilizationLift: number | null;
  totalYearOneReturn: number;
  totalYearOneRoiPct: number | null;
  holdPeriodCashflow: number;
  holdPeriodProjectedEquity: number;
  holdPeriodTotalReturn: number;
  holdPeriodRoiPct: number | null;
  projectedValueAtExit: number;
  exitLoanBalance: number;
}

export interface BridgeFacilityInputs {
  purchasePrice: number;
  closingCosts: number;
  capitalBudget: number;
  bridgePrincipalAdvance: number;
  takeoutProceeds: number;
  bridgeRateAnnual: number;
  bridgeTermMonths: number;
  bridgeFeePct: number;
  bridgeInterestReserveMonths: number;
}

export interface BridgeFacilityResult {
  purchaseAndClosingUses: number;
  totalProjectUses: number;
  bridgePrincipalAdvance: number;
  requiredFacility: number;
  dayOneFunding: number;
  futureCapexHoldback: number;
  unfundedCapex: number;
  bridgeRateAnnual: number;
  bridgeTermMonths: number;
  bridgeFee: number;
  interestReserve: number;
  monthlyInterestCarry: number;
  totalBridgeInterest: number;
  bridgePayoff: number;
  takeoutProceeds: number;
  refiSurplusShortfall: number;
  sponsorCashRequired: number;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeReturnBridge(inputs: ReturnBridgeInputs): ReturnBridgeResult {
  const yearOneDebtPaydown =
    inputs.yearOneDebtPaydownOverride ??
    principalPaidAfterYears(
      inputs.result.loanAmount,
      inputs.mortgageRate,
      inputs.amortizationYears,
      1
    );
  const yearOneCashflow = inputs.yearOneCashflowOverride ?? inputs.result.annualCashflow;
  const yearOneAppreciation = projectedValue(inputs.price, inputs.appreciationRateAnnual, 1) - inputs.price;
  const stabilizationLift =
    inputs.stabilizationLift != null && inputs.stabilizationLift > 0
      ? inputs.stabilizationLift
      : null;
  const totalYearOneReturn =
    yearOneCashflow +
    yearOneDebtPaydown +
    yearOneAppreciation +
    (stabilizationLift ?? 0);
  const totalYearOneRoiPct =
    inputs.result.equityRequired > 0
      ? (totalYearOneReturn / inputs.result.equityRequired) * 100
      : null;

  const projectionStartValue = Math.max(inputs.projectionStartValue ?? inputs.price, inputs.price);
  const projectedValueAtExit = projectedValue(
    projectionStartValue,
    inputs.appreciationRateAnnual,
    inputs.holdPeriodYears
  );
  const exitLoanBalance =
    inputs.exitLoanBalanceOverride ??
    remainingLoanBalance(
      inputs.result.loanAmount,
      inputs.mortgageRate,
      inputs.amortizationYears,
      inputs.holdPeriodYears
    );
  const holdPeriodProjectedEquity = projectedValueAtExit - exitLoanBalance;
  const holdPeriodCashflow =
    inputs.holdPeriodCashflow != null
      ? inputs.holdPeriodCashflow
      : inputs.result.annualCashflow * inputs.holdPeriodYears;
  const holdPeriodTotalReturn =
    holdPeriodCashflow + (holdPeriodProjectedEquity - inputs.result.equityRequired);
  const holdPeriodRoiPct =
    inputs.result.equityRequired > 0
      ? (holdPeriodTotalReturn / inputs.result.equityRequired) * 100
      : null;

  return {
    yearOneCashflow,
    yearOneDebtPaydown,
    yearOneAppreciation,
    stabilizationLift,
    totalYearOneReturn,
    totalYearOneRoiPct,
    holdPeriodCashflow,
    holdPeriodProjectedEquity,
    holdPeriodTotalReturn,
    holdPeriodRoiPct,
    projectedValueAtExit,
    exitLoanBalance,
  };
}

export function computeBridgeFacility(inputs: BridgeFacilityInputs): BridgeFacilityResult {
  const purchaseAndClosingUses = Math.max(0, inputs.purchasePrice + inputs.closingCosts);
  const bridgePrincipalAdvance = Math.max(0, inputs.bridgePrincipalAdvance);
  const dayOneFunding = Math.min(bridgePrincipalAdvance, purchaseAndClosingUses);
  const futureCapexHoldback = Math.max(
    0,
    Math.min(inputs.capitalBudget, bridgePrincipalAdvance - dayOneFunding)
  );
  const unfundedCapex = Math.max(0, inputs.capitalBudget - futureCapexHoldback);
  const averageOutstandingBalance = Math.max(0, dayOneFunding + futureCapexHoldback / 2);
  const monthlyInterestCarry = roundCurrency(
    averageOutstandingBalance * Math.max(0, inputs.bridgeRateAnnual) / 12
  );
  const totalBridgeInterest = roundCurrency(
    monthlyInterestCarry * Math.max(0, inputs.bridgeTermMonths)
  );
  const interestReserveMonths = Math.max(
    0,
    Math.min(inputs.bridgeTermMonths, inputs.bridgeInterestReserveMonths)
  );
  const interestReserve = roundCurrency(monthlyInterestCarry * interestReserveMonths);
  const bridgeFee = roundCurrency(bridgePrincipalAdvance * Math.max(0, inputs.bridgeFeePct));
  const totalProjectUses = roundCurrency(
    purchaseAndClosingUses + Math.max(0, inputs.capitalBudget) + bridgeFee + interestReserve
  );
  const requiredFacility = roundCurrency(bridgePrincipalAdvance + bridgeFee + interestReserve);
  const bridgePayoff = roundCurrency(
    bridgePrincipalAdvance + bridgeFee + Math.max(0, totalBridgeInterest - interestReserve)
  );
  const takeoutProceeds = roundCurrency(Math.max(0, inputs.takeoutProceeds));
  const refiSurplusShortfall = roundCurrency(takeoutProceeds - bridgePayoff);
  const sponsorCashRequired = roundCurrency(
    Math.max(0, totalProjectUses - bridgePrincipalAdvance)
  );

  return {
    purchaseAndClosingUses: roundCurrency(purchaseAndClosingUses),
    totalProjectUses,
    bridgePrincipalAdvance: roundCurrency(bridgePrincipalAdvance),
    requiredFacility,
    dayOneFunding: roundCurrency(dayOneFunding),
    futureCapexHoldback: roundCurrency(futureCapexHoldback),
    unfundedCapex: roundCurrency(unfundedCapex),
    bridgeRateAnnual: Math.max(0, inputs.bridgeRateAnnual),
    bridgeTermMonths: Math.max(0, Math.round(inputs.bridgeTermMonths)),
    bridgeFee,
    interestReserve,
    monthlyInterestCarry,
    totalBridgeInterest,
    bridgePayoff,
    takeoutProceeds,
    refiSurplusShortfall,
    sponsorCashRequired,
  };
}
