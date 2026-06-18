"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Building2, CheckCircle2, CircleDollarSign, Gauge, Home, Landmark, ShieldAlert } from "lucide-react";
import {
  DEFAULT_UNDERWRITING_INPUTS,
  calculateBorrowerCapacity,
  calculateCommercialTakeout,
  getListingCashRequirement,
  type UnderwritingInputs,
} from "@/lib/underwriting";

const CARD: React.CSSProperties = {
  backgroundColor: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
};

type WorkPlanStatus = "ready" | "check" | "blocked";

type WorkPlanItem = {
  step: string;
  title: string;
  status: WorkPlanStatus;
  value: string;
  detail: string;
  href: string;
  action: string;
};

type AssumptionConfidenceItem = {
  label: string;
  status: WorkPlanStatus;
  value: string;
  detail: string;
  href: string;
  action: string;
};

type LenderChecklistItem = {
  label: string;
  status: WorkPlanStatus;
  value: string;
  proof: string;
  risk: string;
  href: string;
  action: string;
};

type InputGuideItem = {
  step: string;
  title: string;
  value: string;
  detail: string;
  status: WorkPlanStatus;
};

type NextUnderwritingAction = {
  status: WorkPlanStatus;
  eyebrow: string;
  title: string;
  value: string;
  detail: string;
  href: string;
  action: string;
  secondaryHref?: string;
  secondaryAction?: string;
};

type UnitLaneStatus = "ready" | "check" | "blocked";

type HeroMetricItem = {
  label: string;
  value: string;
  detail: string;
  status: WorkPlanStatus;
};

type UnderwritingFormulaStep = {
  label: string;
  value: string;
  detail: string;
  status: WorkPlanStatus;
};

type UnderwritingCommandMetric = {
  label: string;
  value: string;
  detail: string;
  status: WorkPlanStatus;
  href: string;
};

type UnitLaneComparison = {
  units: number;
  title: string;
  status: UnitLaneStatus;
  statusLabel: string;
  financingTrack: string;
  minimumDownPayment: number;
  cashAfterReserve: number;
  cashGap: number;
  note: string;
  href: string;
  action: string;
};

function currency(value: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function numberValue(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function serializeUnderwritingInputs(inputs: UnderwritingInputs): string {
  return JSON.stringify({
    annualEmploymentIncome: inputs.annualEmploymentIncome,
    annualOtherIncome: inputs.annualOtherIncome,
    monthlyDebtPayments: inputs.monthlyDebtPayments,
    monthlyTaxesHeatingCondo: inputs.monthlyTaxesHeatingCondo,
    maxDownPayment: inputs.maxDownPayment,
    closingCostReserve: inputs.closingCostReserve,
    creditScore: inputs.creditScore,
    ownerOccupied: inputs.ownerOccupied,
    rentalIncomeOffsetPct: inputs.rentalIncomeOffsetPct,
    expectedMonthlyRentPerUnit: inputs.expectedMonthlyRentPerUnit,
    qualifyingRatePct: inputs.qualifyingRatePct,
    amortizationYears: inputs.amortizationYears,
    targetCommercialRefinanceYears: inputs.targetCommercialRefinanceYears,
    targetCommercialLtvPct: inputs.targetCommercialLtvPct,
    targetCommercialDscr: inputs.targetCommercialDscr,
  });
}

export function UnderwritingClient() {
  const [inputs, setInputs] = useState<UnderwritingInputs>(DEFAULT_UNDERWRITING_INPUTS);
  const [savedInputs, setSavedInputs] = useState<UnderwritingInputs>(DEFAULT_UNDERWRITING_INPUTS);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [screeningUnits, setScreeningUnits] = useState(4);
  const [stabilizedNoi, setStabilizedNoi] = useState(120_000);
  const [exitCapRatePct, setExitCapRatePct] = useState(5.25);
  const [currentLoanBalance, setCurrentLoanBalance] = useState(1_200_000);
  const [takeoutRatePct, setTakeoutRatePct] = useState(5.25);

  useEffect(() => {
    fetch("/api/underwriting")
      .then((response) => response.json())
      .then((data) => {
        setAuthenticated(data.authenticated === true);
        if (data.inputs) {
          setInputs(data.inputs);
          setSavedInputs(data.inputs);
        }
      })
      .catch(() => setMessage("Could not load saved underwriting inputs."))
      .finally(() => setLoading(false));
  }, []);

  const capacity = useMemo(
    () => calculateBorrowerCapacity(inputs, screeningUnits <= 4 ? screeningUnits : 0),
    [inputs, screeningUnits]
  );
  const sampleCash = useMemo(
    () =>
      getListingCashRequirement(
        Math.max(0, capacity.maximumPurchasePrice),
        screeningUnits,
        inputs.ownerOccupied
      ),
    [capacity.maximumPurchasePrice, inputs.ownerOccupied, screeningUnits]
  );
  const unitLaneComparisons = useMemo<UnitLaneComparison[]>(() => {
    const comparisonPrice = Math.max(0, capacity.maximumPurchasePrice);
    return [4, 5, 8].map((units) => {
      const cashRequirement = getListingCashRequirement(comparisonPrice, units, inputs.ownerOccupied);
      const cashAfterReserve = Math.max(0, inputs.maxDownPayment - inputs.closingCostReserve);
      const cashGap = cashAfterReserve - cashRequirement.minimumDownPayment;
      const cashClears = cashGap >= 0;
      const status: UnitLaneStatus = !cashClears ? "blocked" : cashRequirement.manualLenderReview ? "check" : "ready";
      const unitLabel = `${units} unit${units === 1 ? "" : "s"}`;

      return {
        units,
        title:
          cashRequirement.financingTrack === "personal_plex_lender_exception"
            ? `${unitLabel} personal exception lane`
            : units <= 4
              ? `${unitLabel} residential lane`
              : `${unitLabel} multifamily lane`,
        status,
        statusLabel: !cashClears ? "Cash gap" : cashRequirement.manualLenderReview ? "Confirm exception" : "Screenable",
        financingTrack: cashRequirement.financingTrackLabel,
        minimumDownPayment: cashRequirement.minimumDownPayment,
        cashAfterReserve,
        cashGap,
        note: cashRequirement.note,
        href: !cashClears ? "#cash-filter" : cashRequirement.manualLenderReview ? "#policy-review" : "#borrower-inputs",
        action: !cashClears ? "Adjust cash" : cashRequirement.manualLenderReview ? "Review policy" : "Check borrower inputs",
      };
    });
  }, [capacity.maximumPurchasePrice, inputs.closingCostReserve, inputs.maxDownPayment, inputs.ownerOccupied]);
  const takeout = useMemo(
    () =>
      calculateCommercialTakeout({
        stabilizedNoi,
        exitCapRatePct,
        currentLoanBalance,
        mortgageRatePct: takeoutRatePct,
        amortizationYears: Math.max(25, inputs.amortizationYears),
        maxLtvPct: inputs.targetCommercialLtvPct,
        minimumDscr: inputs.targetCommercialDscr,
      }),
    [
      currentLoanBalance,
      exitCapRatePct,
      inputs.amortizationYears,
      inputs.targetCommercialDscr,
      inputs.targetCommercialLtvPct,
      stabilizedNoi,
      takeoutRatePct,
    ]
  );
  const deployableCash = Math.max(0, inputs.maxDownPayment - inputs.closingCostReserve);
  const cashGapToModeledMinimum = deployableCash - sampleCash.minimumDownPayment;
  const hasUnsavedChanges = useMemo(
    () => serializeUnderwritingInputs(inputs) !== serializeUnderwritingInputs(savedInputs),
    [inputs, savedInputs]
  );
  const gdsHousingLimit = capacity.qualifyingMonthlyIncome * capacity.gdsLimitPct;
  const tdsHousingLimit =
    capacity.qualifyingMonthlyIncome * capacity.tdsLimitPct - Math.max(0, inputs.monthlyDebtPayments);
  const bindingDebtServiceConstraint = gdsHousingLimit <= tdsHousingLimit ? "GDS" : "TDS";
  const rentSupportingUnits = Math.max(0, screeningUnits - (inputs.ownerOccupied && screeningUnits > 0 ? 1 : 0));
  const includedMonthlyRentalIncome =
    rentSupportingUnits *
    Math.max(0, inputs.expectedMonthlyRentPerUnit) *
    Math.max(0, inputs.rentalIncomeOffsetPct);
  const rentalIncomePresetOptions = [
    {
      label: "No rent credit",
      pct: 0,
      detail: "Stress test if the lender ignores projected rent.",
    },
    {
      label: "50% conservative",
      pct: 0.5,
      detail: "Useful before a lender-specific policy is confirmed.",
    },
    {
      label: "80% offset",
      pct: 0.8,
      detail: "Use when a broker or bank confirms this treatment.",
    },
    {
      label: "100% exception",
      pct: 1,
      detail: "Aggressive screen for files with written exception support.",
    },
  ].map((preset) => ({
    ...preset,
    includedMonthlyRent: rentSupportingUnits * Math.max(0, inputs.expectedMonthlyRentPerUnit) * preset.pct,
  }));
  const takeoutConstraint =
    takeout.ltvLimitedLoan <= takeout.dscrLimitedLoan ? "LTV" : "DSCR";
  const takeoutCoversDebt = takeout.maximumTakeoutLoan >= currentLoanBalance;
  const takeoutSurplus = takeout.maximumTakeoutLoan - currentLoanBalance;
  const takeoutShortfall = Math.max(0, -takeoutSurplus);
  const takeoutExcess = Math.max(0, takeoutSurplus);
  const borrowerIncomeEntered = inputs.annualEmploymentIncome + inputs.annualOtherIncome > 0;
  const smallRentalBoundary = screeningUnits <= 4;
  const primaryConstraint =
    !borrowerIncomeEntered
      ? "Borrower income is missing"
      : capacity.maximumMortgagePrincipal <= 0
        ? `${bindingDebtServiceConstraint} is blocking mortgage capacity`
        : deployableCash <= 0
          ? "Cash reserve leaves no deployable equity"
          : !takeoutCoversDebt
            ? "Commercial takeout has a debt-replacement shortfall"
            : sampleCash.manualLenderReview
              ? "Lender exception must be confirmed in writing"
              : "Ready to screen matching listings";
  const nextAction: NextUnderwritingAction = !borrowerIncomeEntered
    ? {
        status: "blocked",
        eyebrow: "NEXT BEST ACTION",
        title: "Enter provable borrower income first",
        value: "Borrower income missing",
        detail:
          "Employment and other provable income are currently $0, so this screen is leaning on rental income. Add borrower income before trusting purchase ceiling, GDS/TDS room, or lender-lane results.",
        href: "#borrower-inputs",
        action: "Edit income and debt",
        secondaryHref: "#cash-filter",
        secondaryAction: "Review cash limit",
      }
    : capacity.maximumMortgagePrincipal <= 0
      ? {
          status: "blocked",
          eyebrow: "NEXT BEST ACTION",
          title: "Fix the debt-service constraint",
          value: `${bindingDebtServiceConstraint} is binding`,
          detail: `${currency(capacity.maximumMonthlyHousingCost)} is the maximum monthly housing cost after income, rent inclusion, and existing debt. Adjust income, debts, rental-income treatment, or qualifying rate.`,
          href: "#borrower-inputs",
          action: "Edit borrower inputs",
          secondaryHref: "#cash-filter",
          secondaryAction: "Check cash filter",
        }
      : deployableCash <= 0
        ? {
            status: "blocked",
            eyebrow: "NEXT BEST ACTION",
            title: "Free up deployable cash",
            value: "No cash after reserve",
            detail: `${currency(inputs.maxDownPayment)} gross cash minus ${currency(inputs.closingCostReserve)} reserve leaves no deployable equity for the dashboard filter.`,
            href: "#cash-filter",
            action: "Adjust cash limit",
            secondaryHref: "#borrower-inputs",
            secondaryAction: "Review income",
          }
        : !takeoutCoversDebt
          ? {
              status: "check",
              eyebrow: "NEXT BEST ACTION",
              title: "Stress the commercial takeout",
              value: `${currency(takeoutShortfall)} short`,
              detail: `The modeled takeout is limited by ${takeoutConstraint} and does not fully replace ${currency(currentLoanBalance)} of debt. Fix NOI, cap rate, DSCR, LTV, or acquisition leverage before relying on the debt wipe.`,
              href: "#commercial-takeout",
              action: "Stress refi",
              secondaryHref: "#policy-review",
              secondaryAction: "Review policy",
            }
          : sampleCash.manualLenderReview
            ? {
                status: "check",
                eyebrow: "NEXT BEST ACTION",
                title: "Confirm the lender exception in writing",
                value: sampleCash.financingTrackLabel,
                detail:
                  "The current screen relies on a manual lender path. Ask the bank or broker for written treatment of the unit count, rental income inclusion, personal debt reporting, and any guarantee release.",
                href: "#policy-review",
                action: "Review policy notes",
                secondaryHref: "/",
                secondaryAction: "View matching listings",
              }
            : {
                status: "ready",
                eyebrow: "NEXT BEST ACTION",
                title: "Screen the matching listing queue",
                value: "Ready to screen",
                detail:
                  "The borrower box, cash filter, and takeout test are currently passable for a first-pass screen. Open the dashboard and underwrite individual listings against source rents and expenses.",
                href: "/",
                action: "View matching listings",
                secondaryHref: "#borrower-inputs",
                secondaryAction: "Fine-tune inputs",
              };
  const summaryTiles = [
    {
      label: "Dashboard cash filter",
      value: currency(inputs.maxDownPayment),
      detail: `${currency(deployableCash)} after reserve`,
      icon: <CircleDollarSign size={18} />,
      tone: "blue" as const,
    },
    {
      label: "Rental income used",
      value: `${Math.round(inputs.rentalIncomeOffsetPct * 100)}%`,
      detail: "Lender-specific, adjustable assumption",
      icon: <Gauge size={18} />,
      tone: "amber" as const,
    },
    {
      label: "Purchase ceiling",
      value: currency(capacity.maximumPurchasePrice),
      detail: `${screeningUnits}-unit screen with current inputs`,
      icon: <Home size={18} />,
      tone: "green" as const,
    },
    {
      label: "Financing lane",
      value: sampleCash.financingTrackLabel,
      detail: sampleCash.manualLenderReview ? "Manual lender review likely" : "Standard screen",
      icon: <Landmark size={18} />,
      tone: "slate" as const,
    },
  ];
  const workPlanItems: WorkPlanItem[] = [
    {
      step: "1",
      title: "Borrower capacity",
      status: borrowerIncomeEntered && capacity.maximumMortgagePrincipal > 0 ? "ready" : "blocked",
      value: currency(capacity.maximumPurchasePrice),
      detail: `${bindingDebtServiceConstraint} is binding; ${currency(includedMonthlyRentalIncome)} monthly rent is included.`,
      href: "#borrower-inputs",
      action: "Edit income and debt",
    },
    {
      step: "2",
      title: "Cash box",
      status: deployableCash > 0 ? "ready" : "blocked",
      value: currency(deployableCash),
      detail: `${currency(inputs.maxDownPayment)} gross cash less ${currency(inputs.closingCostReserve)} reserve.`,
      href: "#cash-filter",
      action: "Adjust cash limit",
    },
    {
      step: "3",
      title: "Commercial takeout",
      status: takeoutCoversDebt ? "ready" : "check",
      value: takeoutCoversDebt ? `${currency(takeoutExcess)} surplus` : `${currency(takeoutShortfall)} short`,
      detail: `Maximum takeout is limited by ${takeoutConstraint}; debt to replace is ${currency(currentLoanBalance)}.`,
      href: "#commercial-takeout",
      action: "Stress refi",
    },
    {
      step: "4",
      title: "Policy exception check",
      status: sampleCash.manualLenderReview || !smallRentalBoundary ? "check" : "ready",
      value: sampleCash.financingTrackLabel,
      detail: sampleCash.manualLenderReview
        ? "5-8 unit personal-channel exceptions need written lender confirmation."
        : "Fits the standard screen currently selected.",
      href: "#policy-review",
      action: "Review policy notes",
    },
  ];
  const assumptionConfidenceItems: AssumptionConfidenceItem[] = [
    {
      label: "Borrower income",
      status: borrowerIncomeEntered ? "ready" : "blocked",
      value: currency(inputs.annualEmploymentIncome + inputs.annualOtherIncome),
      detail: borrowerIncomeEntered
        ? "Provable annual income is included in GDS/TDS capacity."
        : "Missing borrower income makes purchase ceiling and debt room unreliable.",
      href: "#borrower-inputs",
      action: "Edit income",
    },
    {
      label: "Rental-income policy",
      status: inputs.rentalIncomeOffsetPct > 0.5 ? "check" : "ready",
      value: `${Math.round(inputs.rentalIncomeOffsetPct * 100)}% included`,
      detail:
        inputs.rentalIncomeOffsetPct > 0.5
          ? "Above the conservative preset. Confirm the bank, insurer, and file-specific treatment in writing."
          : "Conservative enough for first-pass screening, but still lender-specific.",
      href: "#borrower-inputs",
      action: "Set rent policy",
    },
    {
      label: "Deployable cash",
      status: deployableCash > 0 ? "ready" : "blocked",
      value: currency(deployableCash),
      detail: `${currency(inputs.maxDownPayment)} gross cash minus ${currency(inputs.closingCostReserve)} reserve drives the dashboard filter.`,
      href: "#cash-filter",
      action: "Adjust cash",
    },
    {
      label: "Debt wipe / takeout",
      status: takeoutCoversDebt ? "ready" : "check",
      value: takeoutCoversDebt ? `${currency(takeoutExcess)} surplus` : `${currency(takeoutShortfall)} short`,
      detail: `Commercial takeout is currently limited by ${takeoutConstraint}; personal guarantees still need lender release confirmation.`,
      href: "#commercial-takeout",
      action: "Stress refi",
    },
  ];
  const lenderChecklistItems: LenderChecklistItem[] = [
    {
      label: "Borrower income file",
      status: borrowerIncomeEntered ? "ready" : "blocked",
      value: currency(inputs.annualEmploymentIncome + inputs.annualOtherIncome),
      proof: "NOA, pay stubs, T4/T1, business financials, and debt schedule.",
      risk: borrowerIncomeEntered
        ? `${bindingDebtServiceConstraint} is the current debt-service limiter.`
        : "No provable income means the personal mortgage lane cannot be trusted.",
      href: "#borrower-inputs",
      action: "Edit income",
    },
    {
      label: "Rental-income treatment",
      status: inputs.rentalIncomeOffsetPct > 0.5 ? "check" : "ready",
      value: `${Math.round(inputs.rentalIncomeOffsetPct * 100)}% included`,
      proof: "Written lender or insurer rule for subject rents, leases, vacancy, and add-back method.",
      risk:
        inputs.rentalIncomeOffsetPct > 0.5
          ? "Above conservative screening; get bank-specific confirmation before ranking deals."
          : "Conservative first-pass assumption, still lender-specific.",
      href: "#borrower-inputs",
      action: "Set rent policy",
    },
    {
      label: "Unit-count lane",
      status: sampleCash.manualLenderReview || !smallRentalBoundary ? "check" : "ready",
      value: sampleCash.financingTrackLabel,
      proof: "Written treatment for 4 units, 5+ units, personal borrower, entity borrower, and guarantees.",
      risk:
        sampleCash.manualLenderReview || !smallRentalBoundary
          ? "This file is in exception or commercial territory until a lender confirms the path."
          : "Currently inside the small-rental screen selected.",
      href: "#policy-review",
      action: "Review policy",
    },
    {
      label: "Cash and reserve",
      status: deployableCash >= sampleCash.minimumDownPayment ? "ready" : "blocked",
      value:
        deployableCash >= sampleCash.minimumDownPayment
          ? `${currency(deployableCash - sampleCash.minimumDownPayment)} room`
          : `${currency(sampleCash.minimumDownPayment - deployableCash)} short`,
      proof: "Bank statements, gifted funds documentation, closing-cost reserve, and liquidity buffer.",
      risk: `${currency(sampleCash.minimumDownPayment)} modeled minimum down payment for this unit screen.`,
      href: "#cash-filter",
      action: "Adjust cash",
    },
    {
      label: "Debt wipe / takeout",
      status: takeoutCoversDebt ? "ready" : "check",
      value: takeoutCoversDebt ? `${currency(takeoutExcess)} surplus` : `${currency(takeoutShortfall)} short`,
      proof: "Stabilized NOI support, cap-rate support, DSCR/LTV quote, borrower/entity approval, guarantee release.",
      risk: `Takeout is limited by ${takeoutConstraint}; guarantee release is never automatic.`,
      href: "#commercial-takeout",
      action: "Stress refi",
    },
  ];
  const underwritingJumpLinks = [
    {
      href: "#borrower-inputs",
      label: "Borrower inputs",
      value: currency(capacity.maximumPurchasePrice),
      detail: `${bindingDebtServiceConstraint} is binding in this screen.`,
    },
    {
      href: "#cash-filter",
      label: "Cash filter",
      value: currency(inputs.maxDownPayment),
      detail: "Max down payment used by dashboard matches.",
    },
    {
      href: "#commercial-takeout",
      label: "Commercial takeout",
      value: takeoutCoversDebt ? `${currency(takeoutExcess)} surplus` : `${currency(takeoutShortfall)} short`,
      detail: `Refi sized by ${takeoutConstraint}.`,
    },
    {
      href: "#policy-review",
      label: "Policy notes",
      value: sampleCash.manualLenderReview || !smallRentalBoundary ? "Confirm" : "Screenable",
      detail: "RBC, Desjardins, CMHC boundary notes.",
    },
  ];
  const quickCashCapOptions = [100_000, 250_000, 500_000, 1_000_000];
  const heroMetricItems: HeroMetricItem[] = [
    {
      label: "Purchase ceiling",
      value: currency(capacity.maximumPurchasePrice),
      detail: `${screeningUnits}-unit screen; ${bindingDebtServiceConstraint} is binding`,
      status: capacity.maximumPurchasePrice > 0 ? "ready" : "blocked",
    },
    {
      label: "Deployable cash",
      value: currency(deployableCash),
      detail: `${currency(inputs.maxDownPayment)} cap less ${currency(inputs.closingCostReserve)} reserve`,
      status: deployableCash > 0 ? "ready" : "blocked",
    },
    {
      label: "Debt wipe test",
      value: takeoutCoversDebt ? "Refi clears" : "Refi gap",
      detail: takeoutCoversDebt ? `${currency(takeoutExcess)} excess by ${takeoutConstraint}` : `${currency(takeoutShortfall)} short by ${takeoutConstraint}`,
      status: takeoutCoversDebt ? "ready" : "check",
    },
    {
      label: "First fix",
      value: nextAction.value,
      detail: nextAction.title,
      status: nextAction.status,
    },
  ];
  const commandMetrics: UnderwritingCommandMetric[] = [
    {
      label: "Purchase ceiling",
      value: currency(capacity.maximumPurchasePrice),
      detail: `${screeningUnits}-unit screen; ${bindingDebtServiceConstraint} binds`,
      status: capacity.maximumPurchasePrice > 0 ? "ready" : "blocked",
      href: "#borrower-inputs",
    },
    {
      label: "Deployable cash",
      value: currency(deployableCash),
      detail:
        cashGapToModeledMinimum >= 0
          ? `${currency(cashGapToModeledMinimum)} above modeled minimum down`
          : `${currency(Math.abs(cashGapToModeledMinimum))} below modeled minimum down`,
      status: cashGapToModeledMinimum >= 0 ? "ready" : "blocked",
      href: "#cash-filter",
    },
    {
      label: "Debt wipe",
      value: takeoutCoversDebt ? `${currency(takeoutExcess)} surplus` : `${currency(takeoutShortfall)} short`,
      detail: `Commercial takeout limited by ${takeoutConstraint}`,
      status: takeoutCoversDebt ? "ready" : "check",
      href: "#commercial-takeout",
    },
    {
      label: "Lender lane",
      value: sampleCash.manualLenderReview ? "Confirm" : "Screenable",
      detail: sampleCash.financingTrackLabel,
      status: sampleCash.manualLenderReview ? "check" : "ready",
      href: "#policy-review",
    },
  ];
  const underwritingFormulaSteps: UnderwritingFormulaStep[] = [
    {
      label: "Income base",
      value: `${currency(capacity.qualifyingMonthlyIncome)}/mo`,
      detail: `${currency(capacity.grossMonthlyIncome)} borrower income + ${currency(includedMonthlyRentalIncome)} rent credit`,
      status: borrowerIncomeEntered ? "ready" : "blocked",
    },
    {
      label: "Debt room",
      value: `${currency(capacity.maximumMonthlyHousingCost)}/mo`,
      detail: `${bindingDebtServiceConstraint} binds after ${currency(inputs.monthlyDebtPayments)} existing monthly debt`,
      status: capacity.maximumMonthlyHousingCost > 0 ? "ready" : "blocked",
    },
    {
      label: "Mortgage capacity",
      value: currency(capacity.maximumMortgagePrincipal),
      detail: `${inputs.qualifyingRatePct.toFixed(2)}% qualifying rate over ${inputs.amortizationYears} years`,
      status: capacity.maximumMortgagePrincipal > 0 ? "ready" : "blocked",
    },
    {
      label: "Cash filter",
      value: currency(inputs.maxDownPayment),
      detail: `${currency(deployableCash)} deployable after reserve; ${currency(sampleCash.minimumDownPayment)} modeled minimum down`,
      status: cashGapToModeledMinimum >= 0 ? "ready" : "blocked",
    },
    {
      label: "Queue result",
      value: currency(capacity.maximumPurchasePrice),
      detail: `${sampleCash.financingTrackLabel}${sampleCash.manualLenderReview ? "; written lender confirmation needed" : "; standard screen"}`,
      status: sampleCash.manualLenderReview ? "check" : "ready",
    },
    {
      label: "Takeout check",
      value: currency(takeout.maximumTakeoutLoan),
      detail: takeoutCoversDebt
        ? `${currency(takeoutExcess)} surplus versus target debt; limited by ${takeoutConstraint}`
        : `${currency(takeoutShortfall)} short versus target debt; limited by ${takeoutConstraint}`,
      status: takeoutCoversDebt ? "ready" : "check",
    },
  ];
  const inputGuideItems: InputGuideItem[] = [
    {
      step: "1",
      title: "Income and debts",
      value: `${bindingDebtServiceConstraint} binds`,
      detail: "Sets mortgage capacity before the property type matters.",
      status: borrowerIncomeEntered && capacity.maximumMortgagePrincipal > 0 ? "ready" : "blocked",
    },
    {
      step: "2",
      title: "Rental income policy",
      value: `${Math.round(inputs.rentalIncomeOffsetPct * 100)}% included`,
      detail: `${currency(includedMonthlyRentalIncome)}/mo is currently added to qualifying income.`,
      status: inputs.rentalIncomeOffsetPct > 0.5 ? "check" : "ready",
    },
    {
      step: "3",
      title: "Cash cap and reserve",
      value: currency(deployableCash),
      detail: "This becomes the dashboard cash-equity filter.",
      status: deployableCash > 0 ? "ready" : "blocked",
    },
    {
      step: "4",
      title: "Takeout / debt wipe",
      value: takeoutCoversDebt ? `${currency(takeoutExcess)} surplus` : `${currency(takeoutShortfall)} short`,
      detail: `Commercial refinance is limited by ${takeoutConstraint}; guarantee release still needs confirmation.`,
      status: takeoutCoversDebt ? "ready" : "check",
    },
  ];

  function update<K extends keyof UnderwritingInputs>(key: K, value: UnderwritingInputs[K]) {
    setInputs((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/underwriting", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inputs),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save underwriting inputs.");
      if (data.inputs) {
        setInputs(data.inputs);
        setSavedInputs(data.inputs);
      } else {
        setSavedInputs(inputs);
      }
      setMessage("Underwriting profile saved. The dashboard will use this cash limit.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save underwriting inputs.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="dashboard-page" style={{ padding: 32, color: "#64748b" }}>Loading underwriting workspace...</div>;
  }

  return (
    <div className="dashboard-page" style={{ padding: 24, maxWidth: 1380, margin: "0 auto" }}>
      <header
        className="dashboard-hero dashboard-two-column underwriting-hero"
        style={{
          ...CARD,
          padding: 24,
          background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
          color: "#fff",
          marginBottom: 20,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.35fr) minmax(280px, 0.65fr)",
          gap: 18,
          alignItems: "stretch",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 800, letterSpacing: "0.12em" }}>
            BORROWER + PROPERTY UNDERWRITING
          </p>
          <h1 style={{ margin: "8px 0 0", fontSize: 32 }}>Know the financing lane before chasing the deal</h1>
          <p className="underwriting-hero-copy" style={{ margin: "10px 0 0", maxWidth: 850, lineHeight: 1.7, color: "#dbeafe" }}>
            This is a screening model, not a commitment. It combines borrower debt-service capacity,
            available cash, documented rental-income assumptions, and a separate commercial takeout test.
          </p>
          <HeroMetricStrip items={heroMetricItems} />
        </div>
        <aside
          className="underwriting-hero-actions"
          style={{
            borderRadius: 14,
            border: "1px solid rgba(191,219,254,0.35)",
            backgroundColor: "rgba(15,23,42,0.32)",
            padding: 16,
            display: "grid",
            gap: 12,
            alignContent: "start",
          }}
          aria-label="Underwriting profile actions"
        >
          <div>
            <p style={{ margin: 0, color: "#bfdbfe", fontSize: 11, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Profile status
            </p>
            <h2 style={{ margin: "5px 0 0", color: "#fff", fontSize: 18, lineHeight: 1.25 }}>
              {authenticated ? "Save this borrower box" : "Guest screen: save before relying on it"}
            </h2>
            <p style={{ margin: "7px 0 0", color: "#dbeafe", fontSize: 12, lineHeight: 1.5 }}>
              Dashboard cash filter: {currency(inputs.maxDownPayment)}. Current bottleneck: {primaryConstraint}.
            </p>
          </div>
          {authenticated ? (
            <button
              type="button"
              aria-label="Save underwriting profile"
              onClick={save}
              disabled={saving}
              style={{ ...PRIMARY_BUTTON, backgroundColor: "#fff", color: "#1d4ed8" }}
            >
              {saving ? "Saving..." : "Save profile"}
            </button>
          ) : (
            <Link
              href="/signin?callbackUrl=/underwriting"
              aria-label="Sign in to save underwriting profile"
              style={{ ...PRIMARY_BUTTON, backgroundColor: "#fff", color: "#1d4ed8", textDecoration: "none", boxSizing: "border-box" }}
            >
              Sign in to save profile
            </Link>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Link href="/" aria-label="View dashboard matches from underwriting profile" style={HERO_SECONDARY_ACTION}>
              View matches
            </Link>
            <a href="#borrower-inputs" aria-label="Jump to borrower inputs" style={HERO_SECONDARY_ACTION}>
              Edit inputs
            </a>
          </div>
          {message ? <p style={{ margin: 0, color: "#dbeafe", fontSize: 12, lineHeight: 1.45 }}>{message}</p> : null}
        </aside>
      </header>

      <UnderwritingCommandBar
        action={nextAction}
        primaryConstraint={primaryConstraint}
        metrics={commandMetrics}
      />

      <UnderwritingScenarioQuickSwitch
        screeningUnits={screeningUnits}
        ownerOccupied={inputs.ownerOccupied}
        rentalIncomeOffsetPct={inputs.rentalIncomeOffsetPct}
        lanes={unitLaneComparisons}
        rentPresets={rentalIncomePresetOptions}
        onUnitsChange={setScreeningUnits}
        onOwnerOccupiedChange={(value) => update("ownerOccupied", value)}
        onRentalIncomeOffsetChange={(value) => update("rentalIncomeOffsetPct", value)}
      />

      <UnderwritingSaveStatusBar
        authenticated={authenticated}
        saving={saving}
        hasUnsavedChanges={hasUnsavedChanges}
        message={message}
        maxDownPayment={inputs.maxDownPayment}
        deployableCash={deployableCash}
        purchaseCeiling={capacity.maximumPurchasePrice}
        primaryConstraint={primaryConstraint}
        nextAction={nextAction}
        onSave={save}
      />

      <UnderwritingFormulaBridge steps={underwritingFormulaSteps} primaryConstraint={primaryConstraint} />

      <FinancingLaneSnapshot
        lanes={unitLaneComparisons}
        takeoutCoversDebt={takeoutCoversDebt}
        takeoutExcess={takeoutExcess}
        takeoutShortfall={takeoutShortfall}
        takeoutConstraint={takeoutConstraint}
        surface="light"
      />

      <nav className="underwriting-jump-nav" aria-label="Underwriting quick navigation" style={JUMP_NAV}>
        <div style={JUMP_NAV_HEADER}>
          <div>
            <p style={JUMP_NAV_EYEBROW}>QUICK UNDERWRITING MAP</p>
            <h2 style={JUMP_NAV_TITLE}>Jump to the input that changes the screen</h2>
          </div>
          <span style={JUMP_NAV_STATUS}>{primaryConstraint}</span>
        </div>
        <div className="underwriting-jump-grid" style={JUMP_NAV_GRID}>
          {underwritingJumpLinks.map((link) => {
            const isPrimary = link.href === nextAction.href;
            return (
              <a
                key={link.href}
                href={link.href}
                aria-label={`${isPrimary ? "Fix first" : "Jump to"}: ${link.label} (${link.value})`}
                className="underwriting-jump-link"
                style={isPrimary ? { ...JUMP_NAV_LINK, ...JUMP_NAV_LINK_PRIMARY } : JUMP_NAV_LINK}
              >
                <span style={isPrimary ? { ...JUMP_NAV_LINK_LABEL, ...JUMP_NAV_LINK_LABEL_PRIMARY } : JUMP_NAV_LINK_LABEL}>
                  {isPrimary ? "Fix first" : link.label}
                </span>
                <strong style={isPrimary ? { ...JUMP_NAV_LINK_VALUE, ...JUMP_NAV_LINK_VALUE_PRIMARY } : JUMP_NAV_LINK_VALUE}>
                  {link.value}
                </strong>
                <span style={isPrimary ? { ...JUMP_NAV_LINK_DETAIL, ...JUMP_NAV_LINK_DETAIL_PRIMARY } : JUMP_NAV_LINK_DETAIL}>
                  {link.detail}
                </span>
              </a>
            );
          })}
        </div>
      </nav>

      <BrokerReviewDetails
        checklistItems={lenderChecklistItems}
        confidenceItems={assumptionConfidenceItems}
        primaryConstraint={primaryConstraint}
      />

      <section style={{ ...CARD, padding: 18, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
          <div>
            <p style={{ margin: 0, color: "#1d4ed8", fontSize: 11, fontWeight: 900, letterSpacing: "0.1em" }}>
              PROFILE IMPACT
            </p>
            <h2 style={{ margin: "4px 0 0", color: "#0f172a", fontSize: 20 }}>
              The dashboard filters listings from these assumptions
            </h2>
            <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13, lineHeight: 1.55, maxWidth: 760 }}>
              Change the cash limit, rental-income inclusion, owner-occupancy status, or debt load here, then return to the dashboard to see the eligible properties.
            </p>
          </div>
          <Link href="/" style={{ color: "#2563eb", fontSize: 13, fontWeight: 800, textDecoration: "none", alignSelf: "flex-start" }}>
            View matching listings
          </Link>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12 }}>
          {summaryTiles.map((tile) => (
            <ProfileImpactTile key={tile.label} {...tile} />
          ))}
        </div>
      </section>

      <section style={{ ...CARD, padding: 18, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
          <div>
            <p style={{ margin: 0, color: "#1d4ed8", fontSize: 11, fontWeight: 900, letterSpacing: "0.1em" }}>
              UNIT LANE COMPARISON
            </p>
            <h2 style={{ margin: "4px 0 0", color: "#0f172a", fontSize: 20 }}>
              See the financing path before opening listings
            </h2>
            <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13, lineHeight: 1.55, maxWidth: 800 }}>
              The same cash profile can behave very differently at 4, 5, and 8 units. Use this as the first-pass screen for personal-lane, exception, and commercial-lane deals.
            </p>
          </div>
          <Link href="/?minUnits=5" style={{ color: "#2563eb", fontSize: 13, fontWeight: 800, textDecoration: "none", alignSelf: "flex-start" }}>
            Open 5+ unit queue
          </Link>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12 }}>
          {unitLaneComparisons.map((lane) => (
            <UnitLaneCard key={lane.units} lane={lane} />
          ))}
        </div>
      </section>

      <section style={{ ...CARD, padding: 18, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
          <div>
            <p style={{ margin: 0, color: "#1d4ed8", fontSize: 11, fontWeight: 900, letterSpacing: "0.1em" }}>
              UNDERWRITING VERDICT
            </p>
            <h2 style={{ margin: "4px 0 0", color: "#0f172a", fontSize: 20 }}>
              What the model is saying right now
            </h2>
            <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13, lineHeight: 1.55, maxWidth: 780 }}>
              Start here before editing numbers. These cards show whether income, cash, or the refinance takeout is driving the current screen.
            </p>
          </div>
          <div style={{ alignSelf: "flex-start", borderRadius: 999, backgroundColor: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8", padding: "7px 11px", fontSize: 12, fontWeight: 900 }}>
            {authenticated ? "Saved profile available" : "Unsaved guest screen"}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12 }}>
          <VerdictCard
            tone={bindingDebtServiceConstraint === "GDS" ? "blue" : "amber"}
            title={`${bindingDebtServiceConstraint} is binding`}
            value={currency(capacity.maximumMonthlyHousingCost)}
            label="Max monthly housing cost"
            detail={`${currency(capacity.maximumMonthlyMortgagePayment)} left for mortgage payment after taxes/heat/condo allowance.`}
            formula={`${currency(capacity.qualifyingMonthlyIncome)} qualifying monthly income; ${currency(includedMonthlyRentalIncome)} comes from rent inclusion.`}
          />
          <VerdictCard
            tone={deployableCash > 0 ? "green" : "amber"}
            title="Cash available for deal"
            value={currency(deployableCash)}
            label="After closing reserve"
            detail={`${currency(inputs.maxDownPayment)} gross cash limit minus ${currency(inputs.closingCostReserve)} reserved for closing costs and liquidity.`}
            formula={`Dashboard filter uses ${currency(inputs.maxDownPayment)} maximum modeled cash required.`}
          />
          <VerdictCard
            tone={takeoutCoversDebt ? "green" : "red"}
            title={takeoutCoversDebt ? "Takeout covers target debt" : "Takeout shortfall"}
            value={currency(takeout.maximumTakeoutLoan)}
            label={`Limited by ${takeoutConstraint}`}
            detail={
              takeoutCoversDebt
                ? `${currency(takeoutExcess)} estimated excess proceeds after replacing debt.`
                : `${currency(takeoutShortfall)} short of replacing the modeled debt.`
            }
            formula={`Lower of ${currency(takeout.ltvLimitedLoan)} by LTV and ${currency(takeout.dscrLimitedLoan)} by DSCR.`}
          />
        </div>
      </section>

      <section style={{ ...CARD, padding: 18, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
          <div>
            <p style={{ margin: 0, color: "#1d4ed8", fontSize: 11, fontWeight: 900, letterSpacing: "0.1em" }}>
              BROKER WORKPLAN
            </p>
            <h2 style={{ margin: "4px 0 0", color: "#0f172a", fontSize: 20 }}>
              Fix the binding item before chasing listings
            </h2>
            <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13, lineHeight: 1.55, maxWidth: 780 }}>
              Current bottleneck: <strong style={{ color: "#0f172a" }}>{primaryConstraint}</strong>. Use this sequence like an underwriting checklist, then jump straight to the section that needs work.
            </p>
          </div>
          <Link href="/" style={{ color: "#2563eb", fontSize: 13, fontWeight: 800, textDecoration: "none", alignSelf: "flex-start" }}>
            Open filtered dashboard
          </Link>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
          {workPlanItems.map((item) => (
            <WorkPlanCard key={item.step} item={item} />
          ))}
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))", gap: 20 }}>
        <section id="borrower-inputs" style={{ ...CARD, padding: 22, scrollMarginTop: 90 }}>
          <SectionTitle title="Borrower inputs" subtitle="Use gross annual income and recurring monthly debt obligations." />
          <UnderwritingInputGuide items={inputGuideItems} />
          <div className="underwriting-input-section-stack" style={{ display: "grid", gap: 14 }}>
            <UnderwritingInputSection
              eyebrow="1A. Borrower capacity"
              title="Start with provable income and existing obligations"
              detail="These fields drive GDS/TDS room before the property-specific upside matters. If this section is weak, the rest of the screen should be treated as directional."
              status={borrowerIncomeEntered && capacity.maximumMortgagePrincipal > 0 ? "ready" : "blocked"}
              statusLabel={borrowerIncomeEntered ? `${bindingDebtServiceConstraint} binds` : "Income missing"}
            >
              <div className="underwriting-input-section-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 14 }}>
                <MoneyInput label="Employment income / year" value={inputs.annualEmploymentIncome} onChange={(value) => update("annualEmploymentIncome", value)} />
                <MoneyInput label="Other provable income / year" value={inputs.annualOtherIncome} onChange={(value) => update("annualOtherIncome", value)} />
                <MoneyInput label="Monthly debt payments" value={inputs.monthlyDebtPayments} onChange={(value) => update("monthlyDebtPayments", value)} />
                <MoneyInput label="Monthly taxes, heat and condo allowance" value={inputs.monthlyTaxesHeatingCondo} onChange={(value) => update("monthlyTaxesHeatingCondo", value)} />
                <NumberInput label="Credit score" value={inputs.creditScore ?? ""} min={300} max={900} onChange={(value) => update("creditScore", value === "" ? null : Number(value))} />
              </div>
            </UnderwritingInputSection>

            <UnderwritingInputSection
              eyebrow="1B. Lender rent and debt terms"
              title="Then set the policy assumptions the bank will care about"
              detail="Rental-income inclusion differs by lender, product, insurer, and file strength. Use a conservative setting until the bank or broker confirms the treatment in writing."
              status={inputs.rentalIncomeOffsetPct > 0.5 ? "check" : "ready"}
              statusLabel={`${Math.round(inputs.rentalIncomeOffsetPct * 100)}% rent included`}
            >
              <div className="underwriting-input-section-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 14 }}>
                <NumberInput label="Qualifying rate" value={inputs.qualifyingRatePct} suffix="%" step={0.05} onChange={(value) => update("qualifyingRatePct", numberValue(String(value)))} />
                <NumberInput label="Amortization" value={inputs.amortizationYears} suffix="years" min={1} max={50} onChange={(value) => update("amortizationYears", Math.round(numberValue(String(value))))} />
                <NumberInput
                  label="Rental income included"
                  value={inputs.rentalIncomeOffsetPct * 100}
                  suffix="%"
                  min={0}
                  max={100}
                  hint="This varies by lender, insurer, file strength, and product. Use the bank's written policy or a conservative broker-confirmed percentage."
                  onChange={(value) => update("rentalIncomeOffsetPct", numberValue(String(value)) / 100)}
                />
                <MoneyInput label="Expected monthly rent / unit" value={inputs.expectedMonthlyRentPerUnit} onChange={(value) => update("expectedMonthlyRentPerUnit", value)} />
              </div>
            </UnderwritingInputSection>
          </div>

          <div style={{ marginTop: 18, borderRadius: 12, border: "1px solid #dbeafe", backgroundColor: "#eff6ff", padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div>
                <p style={{ margin: 0, color: "#1d4ed8", fontSize: 11, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Rental-income treatment
                </p>
                <h3 style={{ margin: "5px 0 0", color: "#0f172a", fontSize: 16 }}>
                  Pick a screening assumption, then confirm the lender rule
                </h3>
                <p style={{ margin: "5px 0 0", color: "#475569", fontSize: 12, lineHeight: 1.5, maxWidth: 760 }}>
                  The percentage below controls how much rent is added to qualifying income. This typically varies by lender, product, insurer, and file strength.
                </p>
              </div>
              <span style={{ borderRadius: 999, border: "1px solid #bfdbfe", backgroundColor: "#fff", color: "#1d4ed8", padding: "6px 9px", fontSize: 12, fontWeight: 900 }}>
                {rentSupportingUnits} rent-supporting unit{rentSupportingUnits === 1 ? "" : "s"}
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10, marginTop: 12 }}>
              {rentalIncomePresetOptions.map((preset) => (
                <RentalIncomePresetButton
                  key={preset.label}
                  label={preset.label}
                  detail={preset.detail}
                  includedMonthlyRent={preset.includedMonthlyRent}
                  active={Math.abs(inputs.rentalIncomeOffsetPct - preset.pct) < 0.001}
                  onClick={() => update("rentalIncomeOffsetPct", preset.pct)}
                />
              ))}
            </div>
          </div>

          <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
            <SelectInput
              label="Will you occupy a unit?"
              value={inputs.ownerOccupied ? "yes" : "no"}
              onChange={(value) => update("ownerOccupied", value === "yes")}
              options={[{ value: "no", label: "No, investment property" }, { value: "yes", label: "Yes, owner occupied" }]}
            />
            <SelectInput
              label="Units in screening example"
              value={String(screeningUnits)}
              onChange={(value) => setScreeningUnits(Number(value))}
              options={[1, 2, 3, 4, 5, 6, 8, 10].map((units) => ({ value: String(units), label: `${units} unit${units === 1 ? "" : "s"}` }))}
            />
          </div>

          <div id="cash-filter" style={{ marginTop: 24, borderTop: "1px solid #e2e8f0", paddingTop: 22, scrollMarginTop: 90 }}>
            <SectionTitle title="Maximum down payment" subtitle="The dashboard uses this amount as the hard cash-equity filter." />
            <div className="underwriting-cash-filter-header" style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <span style={{ display: "block", color: "#64748b", fontSize: 11, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Current dashboard cap
                </span>
                <strong style={{ display: "block", marginTop: 3, fontSize: 28, lineHeight: 1.05, color: "#0f172a", overflowWrap: "anywhere" }}>
                  {currency(inputs.maxDownPayment)}
                </strong>
              </div>
              <MoneyInput compact label="Exact amount" value={inputs.maxDownPayment} onChange={(value) => update("maxDownPayment", value)} />
            </div>
            <input
              aria-label="Maximum down payment"
              type="range"
              min={25_000}
              max={2_000_000}
              step={5_000}
              value={Math.min(2_000_000, Math.max(25_000, inputs.maxDownPayment))}
              onChange={(event) => update("maxDownPayment", Number(event.target.value))}
              style={{ width: "100%", marginTop: 14, accentColor: "#2563eb" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b" }}>
              <span>$25k</span><span>$2.0M</span>
            </div>
            <div className="underwriting-cash-preset-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8, marginTop: 12 }}>
              {quickCashCapOptions.map((amount) => (
                <QuickCashCapButton
                  key={amount}
                  amount={amount}
                  active={Math.abs(inputs.maxDownPayment - amount) < 1}
                  onClick={() => update("maxDownPayment", amount)}
                />
              ))}
            </div>
            <div style={{ marginTop: 14 }}>
              <MoneyInput label="Keep aside for closing costs and reserves" value={inputs.closingCostReserve} onChange={(value) => update("closingCostReserve", value)} />
            </div>
            <div className="underwriting-cash-impact-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginTop: 14 }}>
              <CashImpactTile
                label="Deployable cash"
                value={currency(deployableCash)}
                detail="Cap minus closing reserve"
                tone={deployableCash > 0 ? "green" : "red"}
              />
              <CashImpactTile
                label="Modeled min down"
                value={currency(sampleCash.minimumDownPayment)}
                detail={`${screeningUnits}-unit example`}
                tone="slate"
              />
              <CashImpactTile
                label={cashGapToModeledMinimum >= 0 ? "Cash room" : "Cash shortfall"}
                value={currency(Math.abs(cashGapToModeledMinimum))}
                detail="Against modeled minimum down"
                tone={cashGapToModeledMinimum >= 0 ? "green" : "red"}
              />
              <CashImpactTile
                label="Dashboard action"
                value="Filter"
                detail={`Cards with cash required over ${currency(inputs.maxDownPayment)} are hidden.`}
                tone="blue"
              />
            </div>
          </div>
        </section>

        <aside style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <div style={{ ...CARD, padding: 20 }}>
            <SectionTitle title="Borrower screen" subtitle={`${screeningUnits}-unit example using your rental-income assumption.`} />
            <Metric label="Maximum mortgage principal" value={currency(capacity.maximumMortgagePrincipal)} />
            <Metric label="Cash + debt purchase ceiling" value={currency(capacity.maximumPurchasePrice)} />
            <Metric label="Maximum monthly housing cost" value={currency(capacity.maximumMonthlyHousingCost)} />
            <Metric label="Modeled minimum down payment" value={currency(sampleCash.minimumDownPayment)} />
            <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
              <FormulaRow
                label="Qualifying monthly income"
                value={currency(capacity.qualifyingMonthlyIncome)}
                detail={`${currency(capacity.grossMonthlyIncome)} borrower income + ${currency(includedMonthlyRentalIncome)} included rent`}
              />
              <FormulaRow
                label={`${bindingDebtServiceConstraint} room`}
                value={currency(bindingDebtServiceConstraint === "GDS" ? gdsHousingLimit : Math.max(0, tdsHousingLimit))}
                detail={`GDS ${currency(gdsHousingLimit)} vs TDS ${currency(Math.max(0, tdsHousingLimit))}`}
              />
            </div>
            <div style={{ marginTop: 14, padding: 12, borderRadius: 8, backgroundColor: "#eff6ff", color: "#1e3a8a", fontSize: 13, lineHeight: 1.6 }}>
              <strong>{sampleCash.financingTrackLabel}.</strong> {sampleCash.note}
            </div>
          </div>

          <div style={{ ...CARD, padding: 20 }}>
            <SectionTitle title="Decision flags" subtitle="Items a broker or credit adjudicator will still verify." />
            <Flag ok={inputs.annualEmploymentIncome + inputs.annualOtherIncome > 0} text="Provable borrower income entered" />
            <Flag ok={inputs.maxDownPayment > inputs.closingCostReserve} text="Cash remains after closing reserve" />
            <Flag ok={(inputs.creditScore ?? 0) >= 680} text="Credit score entered at 680 or above" />
            <Flag ok={screeningUnits <= 4} text="Property fits published residential small-rental boundary" />
          </div>

          <div style={{ ...CARD, padding: 20 }}>
            <SectionTitle title="Save and filter" subtitle="Saved inputs flow back to the listing dashboard." />
            {authenticated ? (
              <button type="button" aria-label="Save underwriting profile" onClick={save} disabled={saving} style={PRIMARY_BUTTON}>
                {saving ? "Saving..." : "Save underwriting profile"}
              </button>
            ) : (
              <Link href="/signin?callbackUrl=/underwriting" aria-label="Sign in to save underwriting profile" style={{ ...PRIMARY_BUTTON, textDecoration: "none", boxSizing: "border-box" }}>
                Sign in to save
              </Link>
            )}
            <Link href="/" aria-label="View matching listings from underwriting profile" style={{ display: "block", marginTop: 10, textAlign: "center", color: "#2563eb", fontWeight: 700, fontSize: 14 }}>
              View matching listings
            </Link>
            {message ? <p style={{ margin: "12px 0 0", fontSize: 13, color: "#475569", lineHeight: 1.5 }}>{message}</p> : null}
          </div>
        </aside>
      </div>

      <section id="commercial-takeout" style={{ ...CARD, padding: 22, marginTop: 20, scrollMarginTop: 90 }}>
        <SectionTitle title="Commercial takeout test" subtitle={`Model the refinance targeted in year ${inputs.targetCommercialRefinanceYears}. This sizes the new loan by the lower of LTV and DSCR.`} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 14 }}>
          <MoneyInput label="Stabilized annual NOI" value={stabilizedNoi} onChange={setStabilizedNoi} />
          <NumberInput label="Exit cap rate" value={exitCapRatePct} suffix="%" step={0.05} onChange={(value) => setExitCapRatePct(numberValue(String(value)))} />
          <MoneyInput label="Debt to replace" value={currentLoanBalance} onChange={setCurrentLoanBalance} />
          <NumberInput label="Takeout interest rate" value={takeoutRatePct} suffix="%" step={0.05} onChange={(value) => setTakeoutRatePct(numberValue(String(value)))} />
          <NumberInput label="Maximum takeout LTV" value={inputs.targetCommercialLtvPct * 100} suffix="%" min={0} max={100} onChange={(value) => update("targetCommercialLtvPct", numberValue(String(value)) / 100)} />
          <NumberInput label="Minimum DSCR" value={inputs.targetCommercialDscr} suffix="x" step={0.05} onChange={(value) => update("targetCommercialDscr", numberValue(String(value)))} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginTop: 18 }}>
          <SummaryTile label="Stabilized value" value={currency(takeout.stabilizedValue)} />
          <SummaryTile label="LTV-limited loan" value={currency(takeout.ltvLimitedLoan)} />
          <SummaryTile label="DSCR-limited loan" value={currency(takeout.dscrLimitedLoan)} />
          <SummaryTile label="Maximum takeout" value={currency(takeout.maximumTakeoutLoan)} strong />
          <SummaryTile label="Debt replaced" value={currency(takeout.estimatedDebtReplaced)} />
          <SummaryTile label={takeoutCoversDebt ? "Excess proceeds" : "Takeout shortfall"} value={takeoutCoversDebt ? currency(takeoutExcess) : currency(takeoutShortfall)} />
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 16, padding: 14, borderRadius: 8, backgroundColor: "#fff7ed", color: "#9a3412", lineHeight: 1.6, fontSize: 13 }}>
          <ShieldAlert size={20} style={{ flex: "0 0 auto" }} />
          <span>
            A commercial refinance can repay the acquisition mortgage, but it does not automatically remove personal guarantees,
            bureau exposure, transfer taxes, or lender recourse. Confirm title, borrower entity, guarantee release, and tax treatment before acquisition.
          </span>
        </div>
      </section>

      <section id="policy-review" style={{ ...CARD, padding: 22, marginTop: 20, scrollMarginTop: 90 }}>
        <SectionTitle title="RBC, Desjardins and CMHC policy review" subtitle="Public-source review completed June 15, 2026. Lender exceptions still require written confirmation." />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14 }}>
          <PolicyCard icon={<Landmark size={20} />} title="RBC Royal Bank" body="RBC's public Investment Property Mortgage states up to 80% of appraised value and expressly describes one-to-four-unit investment properties with at least 20% down. It also requires sufficient non-rental income." href="https://www.rbcroyalbank.com/mortgages/investment-property-mortgage.html" />
          <PolicyCard icon={<Building2 size={20} />} title="Desjardins" body="Desjardins publicly offers personal mortgages and separate business mortgage financing. Its public pages do not establish a universal 5-8 unit personal-mortgage rule, so the platform now treats that route as a personal lender exception until documented by the lender." href="https://www.desjardins.com/en/business/financing-loans.html" />
          <PolicyCard icon={<CheckCircle2 size={20} />} title="CMHC boundary" body="CMHC Income Property covers non-owner-occupied 2-4 unit rentals with 20% minimum equity and 39%/44% GDS/TDS caps. For insured financing, CMHC Standard Rental starts at 5 units and sizes the file as multi-unit rental housing. Uninsured 5+ unit lending can still be lender-specific, including personal-borrower exceptions that must be confirmed in writing." href="https://www.cmhc-schl.gc.ca/professionals/project-funding-and-mortgage-financing/mortgage-loan-insurance/multi-unit-insurance/standard-rental-housing" />
        </div>
      </section>
    </div>
  );
}

const PRIMARY_BUTTON: React.CSSProperties = {
  width: "100%",
  display: "block",
  border: 0,
  borderRadius: 8,
  padding: "11px 14px",
  backgroundColor: "#2563eb",
  color: "#fff",
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
  textAlign: "center",
};

const HERO_SECONDARY_ACTION: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 8,
  border: "1px solid rgba(191,219,254,0.45)",
  backgroundColor: "rgba(255,255,255,0.08)",
  color: "#dbeafe",
  padding: "9px 10px",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 900,
  textAlign: "center",
};

const JUMP_NAV: React.CSSProperties = {
  ...CARD,
  padding: 16,
  marginBottom: 20,
  background: "linear-gradient(135deg, #ffffff 0%, #eff6ff 100%)",
};

const JUMP_NAV_HEADER: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 14,
  alignItems: "flex-start",
  flexWrap: "wrap",
  marginBottom: 12,
};

const JUMP_NAV_EYEBROW: React.CSSProperties = {
  margin: 0,
  color: "#2563eb",
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: "0.1em",
};

const JUMP_NAV_TITLE: React.CSSProperties = {
  margin: "4px 0 0",
  color: "#0f172a",
  fontSize: 18,
  lineHeight: 1.25,
};

const JUMP_NAV_STATUS: React.CSSProperties = {
  borderRadius: 999,
  border: "1px solid #bfdbfe",
  backgroundColor: "#fff",
  color: "#1d4ed8",
  padding: "7px 10px",
  fontSize: 12,
  fontWeight: 900,
  maxWidth: 360,
};

const JUMP_NAV_GRID: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 10,
};

const JUMP_NAV_LINK: React.CSSProperties = {
  display: "grid",
  gap: 5,
  minWidth: 0,
  borderRadius: 12,
  border: "1px solid #bfdbfe",
  backgroundColor: "#fff",
  color: "#0f172a",
  padding: 12,
  textDecoration: "none",
};

const JUMP_NAV_LINK_PRIMARY: React.CSSProperties = {
  borderColor: "#93c5fd",
  background: "linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)",
  boxShadow: "0 10px 24px rgba(37,99,235,0.12)",
};

const JUMP_NAV_LINK_LABEL: React.CSSProperties = {
  color: "#2563eb",
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};

const JUMP_NAV_LINK_LABEL_PRIMARY: React.CSSProperties = {
  color: "#1e40af",
};

const JUMP_NAV_LINK_VALUE: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 18,
  lineHeight: 1.18,
  overflowWrap: "anywhere",
};

const JUMP_NAV_LINK_VALUE_PRIMARY: React.CSSProperties = {
  color: "#1d4ed8",
};

const JUMP_NAV_LINK_DETAIL: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  lineHeight: 1.35,
};

const JUMP_NAV_LINK_DETAIL_PRIMARY: React.CSSProperties = {
  color: "#334155",
};

function UnderwritingSaveStatusBar({
  authenticated,
  saving,
  hasUnsavedChanges,
  message,
  maxDownPayment,
  deployableCash,
  purchaseCeiling,
  primaryConstraint,
  nextAction,
  onSave,
}: {
  authenticated: boolean;
  saving: boolean;
  hasUnsavedChanges: boolean;
  message: string;
  maxDownPayment: number;
  deployableCash: number;
  purchaseCeiling: number;
  primaryConstraint: string;
  nextAction: NextUnderwritingAction;
  onSave: () => void;
}) {
  const statusPalette = hasUnsavedChanges
    ? { bg: "#fffbeb", border: "#fde68a", accent: "#b45309", label: "Unsaved changes" }
    : { bg: "#ecfdf3", border: "#bbf7d0", accent: "#166534", label: authenticated ? "Saved profile" : "Guest defaults" };
  const metrics = [
    { label: "Cash cap", value: currency(maxDownPayment), detail: `${currency(deployableCash)} deployable` },
    { label: "Purchase ceiling", value: currency(purchaseCeiling), detail: "Current borrower screen" },
    { label: "Next action", value: nextAction.value, detail: nextAction.title },
  ];

  return (
    <section
      className="underwriting-save-status-bar"
      aria-label="Underwriting save status and quick actions"
      style={{
        position: "sticky",
        top: 10,
        zIndex: 28,
        marginBottom: 20,
        borderRadius: 14,
        border: `1px solid ${statusPalette.border}`,
        background: `linear-gradient(135deg, ${statusPalette.bg} 0%, rgba(255,255,255,0.96) 100%)`,
        boxShadow: "0 16px 38px rgba(15,23,42,0.12)",
        padding: 12,
        display: "grid",
        gridTemplateColumns: "minmax(230px, 0.74fr) minmax(0, 1.12fr) minmax(190px, auto)",
        gap: 10,
        alignItems: "stretch",
        backdropFilter: "blur(14px)",
      }}
    >
      <div className="underwriting-save-status-lead" style={{ minWidth: 0, display: "grid", alignContent: "center", gap: 5 }}>
        <span
          style={{
            width: "fit-content",
            borderRadius: 999,
            border: `1px solid ${statusPalette.border}`,
            backgroundColor: "#fff",
            color: statusPalette.accent,
            padding: "5px 8px",
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {statusPalette.label}
        </span>
        <strong style={{ color: "#0f172a", fontSize: 16, lineHeight: 1.18, overflowWrap: "anywhere" }}>
          {primaryConstraint}
        </strong>
        <span style={{ color: "#475569", fontSize: 11, lineHeight: 1.35 }}>
          {message || (hasUnsavedChanges ? "Save before relying on dashboard matches." : "Dashboard filters reflect the saved borrower box.")}
        </span>
      </div>

      <div className="underwriting-save-status-metrics" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="underwriting-save-status-metric"
            style={{
              minWidth: 0,
              borderRadius: 11,
              border: "1px solid rgba(148,163,184,0.36)",
              backgroundColor: "rgba(255,255,255,0.74)",
              padding: 10,
            }}
          >
            <span style={{ display: "block", color: "#64748b", fontSize: 10, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {metric.label}
            </span>
            <strong style={{ display: "block", marginTop: 4, color: "#0f172a", fontSize: 15, lineHeight: 1.14, overflowWrap: "anywhere" }}>
              {metric.value}
            </strong>
            <span style={{ display: "block", marginTop: 4, color: "#64748b", fontSize: 11, lineHeight: 1.3, overflowWrap: "anywhere" }}>
              {metric.detail}
            </span>
          </div>
        ))}
      </div>

      <div className="underwriting-save-status-actions" style={{ display: "grid", gap: 7, alignContent: "center", minWidth: 0 }}>
        {authenticated ? (
          <button
            type="button"
            aria-label={hasUnsavedChanges ? "Save underwriting changes" : "Underwriting profile already saved"}
            onClick={onSave}
            disabled={saving || !hasUnsavedChanges}
            style={{
              ...PRIMARY_BUTTON,
              minHeight: 40,
              opacity: saving || !hasUnsavedChanges ? 0.72 : 1,
              cursor: saving || !hasUnsavedChanges ? "default" : "pointer",
            }}
          >
            {saving ? "Saving..." : hasUnsavedChanges ? "Save changes" : "Saved"}
          </button>
        ) : (
          <Link
            href="/signin?callbackUrl=/underwriting"
            aria-label="Sign in to save underwriting changes"
            style={{ ...PRIMARY_BUTTON, minHeight: 40, textDecoration: "none", boxSizing: "border-box" }}
          >
            Sign in to save
          </Link>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
          <a href={nextAction.href} style={SAVE_STATUS_SECONDARY_ACTION}>
            {nextAction.action}
          </a>
          <Link href="/" style={SAVE_STATUS_SECONDARY_ACTION}>
            View matches
          </Link>
        </div>
      </div>
    </section>
  );
}

const SAVE_STATUS_SECONDARY_ACTION: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 36,
  borderRadius: 999,
  border: "1px solid #cbd5e1",
  backgroundColor: "#fff",
  color: "#334155",
  padding: "8px 9px",
  textAlign: "center",
  textDecoration: "none",
  fontSize: 11,
  fontWeight: 900,
  lineHeight: 1.2,
};

function UnderwritingCommandBar({
  action,
  primaryConstraint,
  metrics,
}: {
  action: NextUnderwritingAction;
  primaryConstraint: string;
  metrics: UnderwritingCommandMetric[];
}) {
  const palette = {
    ready: { bg: "#ecfdf3", border: "#bbf7d0", accent: "#166534", soft: "#dcfce7", label: "Ready" },
    check: { bg: "#fffbeb", border: "#fde68a", accent: "#b45309", soft: "#fef3c7", label: "Check" },
    blocked: { bg: "#fef2f2", border: "#fecaca", accent: "#b91c1c", soft: "#fee2e2", label: "Blocked" },
  }[action.status];

  return (
    <section
      className="underwriting-command-bar"
      style={{
        borderRadius: 14,
        border: `1px solid ${palette.border}`,
        background: `linear-gradient(135deg, ${palette.bg} 0%, #ffffff 100%)`,
        padding: 15,
        marginBottom: 20,
        display: "grid",
        gridTemplateColumns: "minmax(260px, 0.88fr) minmax(420px, 1.1fr) minmax(210px, auto)",
        gap: 12,
        alignItems: "stretch",
        boxShadow: "0 12px 30px rgba(15,23,42,0.06)",
      }}
      aria-label="Next underwriting action"
    >
      <div style={{ minWidth: 0, display: "grid", alignContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
          <span
            style={{
              borderRadius: 999,
              backgroundColor: palette.soft,
              border: `1px solid ${palette.border}`,
              color: palette.accent,
              padding: "5px 8px",
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {palette.label}
          </span>
          <span style={{ color: palette.accent, fontSize: 11, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            {action.eyebrow}
          </span>
        </div>
        <h2 style={{ margin: "8px 0 0", color: "#0f172a", fontSize: 21, lineHeight: 1.2 }}>
          {action.title}
        </h2>
        <p style={{ margin: "7px 0 0", color: "#475569", fontSize: 12, lineHeight: 1.5 }}>
          Current bottleneck: <strong style={{ color: "#0f172a" }}>{primaryConstraint}</strong>. {action.detail}
        </p>
      </div>

      <div className="underwriting-command-metric-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
        {metrics.map((metric) => (
          <UnderwritingCommandMetricCard key={metric.label} metric={metric} />
        ))}
      </div>

      <div className="underwriting-command-actions" style={{ display: "grid", gap: 8, alignContent: "center", minWidth: 0 }}>
        <a
          href={action.href}
          aria-label={`${action.action}: ${action.title}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
            borderRadius: 999,
            backgroundColor: palette.accent,
            color: "#fff",
            padding: "10px 13px",
            textDecoration: "none",
            fontSize: 13,
            fontWeight: 900,
            whiteSpace: "nowrap",
          }}
        >
          {action.action}
          <ArrowRight size={14} />
        </a>
        {action.secondaryHref && action.secondaryAction ? (
          <a
            href={action.secondaryHref}
            aria-label={`${action.secondaryAction}: ${action.title}`}
            style={{
              color: palette.accent,
              textAlign: "center",
              textDecoration: "none",
              fontSize: 12,
              fontWeight: 900,
            }}
          >
            {action.secondaryAction}
          </a>
        ) : null}
      </div>
    </section>
  );
}

function UnderwritingCommandMetricCard({ metric }: { metric: UnderwritingCommandMetric }) {
  const palette = {
    ready: { bg: "#ecfdf3", border: "#bbf7d0", accent: "#166534", label: "Ready" },
    check: { bg: "#fffbeb", border: "#fde68a", accent: "#b45309", label: "Verify" },
    blocked: { bg: "#fef2f2", border: "#fecaca", accent: "#b91c1c", label: "Fix" },
  }[metric.status];

  return (
    <a
      href={metric.href}
      aria-label={`Review ${metric.label}: ${metric.value}`}
      className="underwriting-command-metric-card"
      style={{
        minWidth: 0,
        borderRadius: 11,
        border: `1px solid ${palette.border}`,
        backgroundColor: palette.bg,
        padding: 10,
        display: "grid",
        gap: 5,
        color: "#0f172a",
        textDecoration: "none",
      }}
    >
      <span style={{ display: "flex", justifyContent: "space-between", gap: 7, alignItems: "center" }}>
        <span style={{ color: "#64748b", fontSize: 10, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {metric.label}
        </span>
        <span style={{ color: palette.accent, fontSize: 10, fontWeight: 900, whiteSpace: "nowrap" }}>
          {palette.label}
        </span>
      </span>
      <strong style={{ color: palette.accent, fontSize: 16, lineHeight: 1.12, overflowWrap: "anywhere" }}>
        {metric.value}
      </strong>
      <span style={{ color: "#475569", fontSize: 11, lineHeight: 1.35 }}>
        {metric.detail}
      </span>
    </a>
  );
}

function UnderwritingScenarioQuickSwitch({
  screeningUnits,
  ownerOccupied,
  rentalIncomeOffsetPct,
  lanes,
  rentPresets,
  onUnitsChange,
  onOwnerOccupiedChange,
  onRentalIncomeOffsetChange,
}: {
  screeningUnits: number;
  ownerOccupied: boolean;
  rentalIncomeOffsetPct: number;
  lanes: UnitLaneComparison[];
  rentPresets: Array<{
    label: string;
    pct: number;
    detail: string;
    includedMonthlyRent: number;
  }>;
  onUnitsChange: (units: number) => void;
  onOwnerOccupiedChange: (ownerOccupied: boolean) => void;
  onRentalIncomeOffsetChange: (pct: number) => void;
}) {
  const activeLane = lanes.find((lane) => lane.units === screeningUnits);
  const activeStatus = activeLane?.status ?? "check";
  const palette = {
    ready: { bg: "#ecfdf3", border: "#bbf7d0", accent: "#166534", soft: "#dcfce7", label: "Screenable" },
    check: { bg: "#fffbeb", border: "#fde68a", accent: "#b45309", soft: "#fef3c7", label: "Verify" },
    blocked: { bg: "#fef2f2", border: "#fecaca", accent: "#b91c1c", soft: "#fee2e2", label: "Blocked" },
  }[activeStatus];
  const activeLaneSummary = activeLane
    ? activeLane.cashGap >= 0
      ? `${currency(activeLane.cashGap)} cash room`
      : `${currency(Math.abs(activeLane.cashGap))} cash gap`
    : "Custom unit count; see borrower inputs";

  return (
    <section
      className="underwriting-scenario-switch"
      aria-label="Quick underwriting scenario switch"
      style={{
        ...CARD,
        padding: 16,
        marginBottom: 20,
        borderColor: palette.border,
        background: `linear-gradient(135deg, ${palette.bg} 0%, #ffffff 100%)`,
        boxShadow: "0 12px 30px rgba(15,23,42,0.06)",
      }}
    >
      <div className="underwriting-scenario-switch-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap", marginBottom: 13 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, color: palette.accent, fontSize: 11, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Scenario quick switch
          </p>
          <h2 style={{ margin: "5px 0 0", color: "#0f172a", fontSize: 20, lineHeight: 1.2 }}>
            Make the top verdict match the file you are testing
          </h2>
          <p style={{ margin: "6px 0 0", color: "#475569", fontSize: 13, lineHeight: 1.55, maxWidth: 880 }}>
            Unit count, occupancy, and rental-income policy drive the purchase ceiling and lender lane. Change them here before reading the rest of the page.
          </p>
        </div>
        <div
          style={{
            minWidth: 220,
            borderRadius: 12,
            border: `1px solid ${palette.border}`,
            backgroundColor: "#fff",
            padding: 11,
          }}
        >
          <span style={{ display: "block", color: palette.accent, fontSize: 10, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Current lane
          </span>
          <strong style={{ display: "block", marginTop: 4, color: "#0f172a", fontSize: 17, lineHeight: 1.15 }}>
            {screeningUnits} units · {ownerOccupied ? "owner-occupied" : "investor"}
          </strong>
          <span style={{ display: "block", marginTop: 5, color: "#475569", fontSize: 12, lineHeight: 1.35 }}>
            {activeLane?.financingTrack ?? "Custom screen"} · {activeLaneSummary}
          </span>
        </div>
      </div>

      <div className="underwriting-scenario-switch-grid" style={{ display: "grid", gridTemplateColumns: "minmax(260px, 0.82fr) minmax(240px, 0.7fr) minmax(320px, 1fr)", gap: 12, alignItems: "stretch" }}>
        <div className="underwriting-scenario-switch-card" style={SCENARIO_SWITCH_CARD}>
          <span style={SCENARIO_SWITCH_LABEL}>Unit count lane</span>
          <div className="underwriting-scenario-button-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginTop: 10 }}>
            {lanes.map((lane) => {
              const active = lane.units === screeningUnits;
              const lanePalette = {
                ready: { border: "#bbf7d0", bg: "#ecfdf3", accent: "#166534" },
                check: { border: "#fde68a", bg: "#fffbeb", accent: "#b45309" },
                blocked: { border: "#fecaca", bg: "#fef2f2", accent: "#b91c1c" },
              }[lane.status];

              return (
                <button
                  key={lane.units}
                  type="button"
                  data-scenario-units={lane.units}
                  onClick={() => onUnitsChange(lane.units)}
                  aria-pressed={active}
                  className="underwriting-scenario-button"
                  style={{
                    ...SCENARIO_SWITCH_BUTTON,
                    borderColor: active ? lanePalette.accent : lanePalette.border,
                    backgroundColor: active ? lanePalette.bg : "#fff",
                    color: active ? lanePalette.accent : "#334155",
                    boxShadow: active ? "inset 0 0 0 1px currentColor" : "none",
                  }}
                >
                  <strong>{lane.units}</strong>
                  <span>{lane.statusLabel}</span>
                </button>
              );
            })}
          </div>
          <p style={SCENARIO_SWITCH_HELP}>
            Use 5 or 8 units to test the personal-lender exception lane before opening individual listings.
          </p>
        </div>

        <div className="underwriting-scenario-switch-card" style={SCENARIO_SWITCH_CARD}>
          <span style={SCENARIO_SWITCH_LABEL}>Occupancy</span>
          <div className="underwriting-scenario-button-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginTop: 10 }}>
            {[
              { label: "Investor", value: false, detail: "No occupied unit" },
              { label: "Owner-use", value: true, detail: "One unit excluded" },
            ].map((option) => {
              const active = ownerOccupied === option.value;
              return (
                <button
                  key={option.label}
                  type="button"
                  data-scenario-occupancy={option.value ? "owner" : "investor"}
                  onClick={() => onOwnerOccupiedChange(option.value)}
                  aria-pressed={active}
                  className="underwriting-scenario-button"
                  style={{
                    ...SCENARIO_SWITCH_BUTTON,
                    borderColor: active ? "#2563eb" : "#dbeafe",
                    backgroundColor: active ? "#eff6ff" : "#fff",
                    color: active ? "#1d4ed8" : "#334155",
                    boxShadow: active ? "inset 0 0 0 1px #2563eb" : "none",
                  }}
                >
                  <strong>{option.label}</strong>
                  <span>{option.detail}</span>
                </button>
              );
            })}
          </div>
          <p style={SCENARIO_SWITCH_HELP}>
            Owner-occupancy changes rental-income support and can move the financing path.
          </p>
        </div>

        <div className="underwriting-scenario-switch-card" style={SCENARIO_SWITCH_CARD}>
          <span style={SCENARIO_SWITCH_LABEL}>Rental-income inclusion</span>
          <div className="underwriting-scenario-rent-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8, marginTop: 10 }}>
            {rentPresets.map((preset) => {
              const active = Math.abs(rentalIncomeOffsetPct - preset.pct) < 0.001;
              return (
                <button
                  key={preset.label}
                  type="button"
                  data-rent-preset={String(preset.pct)}
                  onClick={() => onRentalIncomeOffsetChange(preset.pct)}
                  aria-pressed={active}
                  className="underwriting-scenario-button"
                  style={{
                    ...SCENARIO_SWITCH_BUTTON,
                    borderColor: active ? "#b45309" : "#fde68a",
                    backgroundColor: active ? "#fffbeb" : "#fff",
                    color: active ? "#92400e" : "#334155",
                    boxShadow: active ? "inset 0 0 0 1px #b45309" : "none",
                  }}
                >
                  <strong>{Math.round(preset.pct * 100)}%</strong>
                  <span>{currency(preset.includedMonthlyRent)}/mo</span>
                </button>
              );
            })}
          </div>
          <p style={SCENARIO_SWITCH_HELP}>
            This is lender-specific. Use 50% until RBC, Desjardins, insurer, or broker treatment is confirmed.
          </p>
        </div>
      </div>
    </section>
  );
}

const SCENARIO_SWITCH_CARD: React.CSSProperties = {
  minWidth: 0,
  borderRadius: 13,
  border: "1px solid #dbeafe",
  backgroundColor: "rgba(255,255,255,0.82)",
  padding: 12,
};

const SCENARIO_SWITCH_LABEL: React.CSSProperties = {
  display: "block",
  color: "#475569",
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const SCENARIO_SWITCH_BUTTON: React.CSSProperties = {
  minWidth: 0,
  minHeight: 74,
  display: "grid",
  gap: 4,
  alignContent: "center",
  justifyItems: "center",
  borderRadius: 11,
  border: "1px solid #dbeafe",
  backgroundColor: "#fff",
  padding: "9px 8px",
  cursor: "pointer",
  textAlign: "center",
  fontSize: 12,
  lineHeight: 1.2,
};

const SCENARIO_SWITCH_HELP: React.CSSProperties = {
  margin: "9px 0 0",
  color: "#64748b",
  fontSize: 12,
  lineHeight: 1.45,
};

function UnderwritingInputGuide({ items }: { items: InputGuideItem[] }) {
  return (
    <section
      className="underwriting-input-guide"
      aria-label="Recommended underwriting input order"
      style={{
        borderRadius: 14,
        border: "1px solid #dbeafe",
        background: "linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)",
        padding: 14,
        margin: "0 0 16px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <p style={{ margin: 0, color: "#1d4ed8", fontSize: 10, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Edit in this order
          </p>
          <h3 style={{ margin: "4px 0 0", color: "#0f172a", fontSize: 16, lineHeight: 1.2 }}>
            Start with the inputs that move eligibility
          </h3>
          <p style={{ margin: "5px 0 0", color: "#475569", fontSize: 12, lineHeight: 1.5, maxWidth: 720 }}>
            This keeps the page from becoming a spreadsheet hunt: borrower capacity first, lender rent treatment second, cash filter third, takeout last.
          </p>
        </div>
        <span style={{ borderRadius: 999, border: "1px solid #bfdbfe", backgroundColor: "#fff", color: "#1d4ed8", padding: "6px 9px", fontSize: 11, fontWeight: 900 }}>
          Drives listing availability
        </span>
      </div>
      <div className="underwriting-input-guide-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 9, marginTop: 12 }}>
        {items.map((item) => {
          const palette = {
            ready: { bg: "#ecfdf3", border: "#bbf7d0", accent: "#166534", label: "Ready" },
            check: { bg: "#fffbeb", border: "#fde68a", accent: "#b45309", label: "Verify" },
            blocked: { bg: "#fef2f2", border: "#fecaca", accent: "#b91c1c", label: "Fix" },
          }[item.status];

          return (
            <article
              key={item.step}
              className="underwriting-input-guide-card"
              style={{
                minWidth: 0,
                borderRadius: 11,
                border: `1px solid ${palette.border}`,
                backgroundColor: palette.bg,
                padding: 11,
                display: "grid",
                gap: 6,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                <span style={{ width: 24, height: 24, borderRadius: 999, backgroundColor: "#fff", border: `1px solid ${palette.border}`, color: palette.accent, display: "grid", placeItems: "center", fontSize: 11, fontWeight: 900 }}>
                  {item.step}
                </span>
                <span style={{ color: palette.accent, fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {palette.label}
                </span>
              </div>
              <strong style={{ color: "#0f172a", fontSize: 14, lineHeight: 1.2 }}>{item.title}</strong>
              <span style={{ color: palette.accent, fontSize: 15, fontWeight: 900, lineHeight: 1.15, overflowWrap: "anywhere" }}>{item.value}</span>
              <span style={{ color: "#475569", fontSize: 11, lineHeight: 1.4 }}>{item.detail}</span>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function UnderwritingInputSection({
  eyebrow,
  title,
  detail,
  status,
  statusLabel,
  children,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  status: WorkPlanStatus;
  statusLabel: string;
  children: React.ReactNode;
}) {
  const palette = {
    ready: { bg: "#ecfdf3", border: "#bbf7d0", accent: "#166534", label: "Ready" },
    check: { bg: "#fffbeb", border: "#fde68a", accent: "#b45309", label: "Verify" },
    blocked: { bg: "#fef2f2", border: "#fecaca", accent: "#b91c1c", label: "Fix first" },
  }[status];

  return (
    <section
      className="underwriting-input-section"
      style={{
        borderRadius: 14,
        border: `1px solid ${palette.border}`,
        background: `linear-gradient(135deg, ${palette.bg} 0%, #ffffff 100%)`,
        padding: 15,
        display: "grid",
        gap: 13,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, color: palette.accent, fontSize: 10, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase" }}>
            {eyebrow}
          </p>
          <h3 style={{ margin: "5px 0 0", color: "#0f172a", fontSize: 17, lineHeight: 1.25 }}>
            {title}
          </h3>
          <p style={{ margin: "6px 0 0", color: "#475569", fontSize: 13, lineHeight: 1.55, maxWidth: 780 }}>
            {detail}
          </p>
        </div>
        <span
          style={{
            borderRadius: 999,
            border: `1px solid ${palette.border}`,
            backgroundColor: "#fff",
            color: palette.accent,
            padding: "6px 9px",
            fontSize: 11,
            fontWeight: 900,
            whiteSpace: "nowrap",
          }}
        >
          {palette.label}: {statusLabel}
        </span>
      </div>
      {children}
    </section>
  );
}

function UnderwritingFormulaBridge({
  steps,
  primaryConstraint,
}: {
  steps: UnderwritingFormulaStep[];
  primaryConstraint: string;
}) {
  return (
    <details
      className="underwriting-formula-bridge underwriting-formula-disclosure"
      data-testid="underwriting-formula-bridge"
      style={{
        ...CARD,
        padding: 0,
        marginBottom: 20,
        overflow: "hidden",
        background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 58%, #eff6ff 100%)",
      }}
      aria-label="Underwriting formula bridge"
    >
      <summary
        className="underwriting-formula-summary"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          gap: 14,
          alignItems: "center",
          padding: 18,
          cursor: "pointer",
          listStyle: "none",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, color: "#1d4ed8", fontSize: 11, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            SCREENING FORMULA - OPTIONAL
          </p>
          <h2 style={{ margin: "5px 0 0", color: "#0f172a", fontSize: 20, lineHeight: 1.2 }}>
            Show how this page decides what listings you can chase
          </h2>
          <p style={{ margin: "7px 0 0", color: "#64748b", fontSize: 13, lineHeight: 1.55, maxWidth: 850 }}>
            Open this when you want the calculation chain. The main page now keeps the decision and input edits first.
          </p>
        </div>
        <span
          style={{
            borderRadius: 999,
            border: "1px solid #bfdbfe",
            backgroundColor: "#eff6ff",
            color: "#1d4ed8",
            padding: "7px 10px",
            fontSize: 12,
            fontWeight: 900,
            maxWidth: 360,
            lineHeight: 1.35,
          }}
        >
          Current bottleneck: {primaryConstraint}
        </span>
      </summary>

      <div style={{ padding: "0 18px 18px" }}>
        <p style={{ margin: "0 0 12px", color: "#64748b", fontSize: 13, lineHeight: 1.55, maxWidth: 900 }}>
          Read this left to right. The dashboard queue is driven by borrower income, lender rent credit,
          debt-service room, available cash, and whether the future takeout can replace the personal debt.
        </p>
        <div className="underwriting-formula-grid" style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 9 }}>
          {steps.map((step, index) => (
            <UnderwritingFormulaCard key={step.label} step={step} index={index} />
          ))}
        </div>
      </div>
    </details>
  );
}

function UnderwritingFormulaCard({
  step,
  index,
}: {
  step: UnderwritingFormulaStep;
  index: number;
}) {
  const palette = {
    ready: { bg: "#ecfdf3", border: "#bbf7d0", accent: "#166534", label: "Ready" },
    check: { bg: "#fffbeb", border: "#fde68a", accent: "#b45309", label: "Verify" },
    blocked: { bg: "#fef2f2", border: "#fecaca", accent: "#b91c1c", label: "Blocked" },
  }[step.status];

  return (
    <article
      className="underwriting-formula-card"
      style={{
        minWidth: 0,
        borderRadius: 12,
        border: `1px solid ${palette.border}`,
        backgroundColor: palette.bg,
        padding: 12,
        display: "grid",
        gap: 8,
        position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: 999,
            border: `1px solid ${palette.border}`,
            backgroundColor: "#fff",
            color: palette.accent,
            display: "grid",
            placeItems: "center",
            fontSize: 11,
            fontWeight: 900,
            flexShrink: 0,
          }}
        >
          {index + 1}
        </span>
        <span
          style={{
            borderRadius: 999,
            border: `1px solid ${palette.border}`,
            backgroundColor: "#fff",
            color: palette.accent,
            padding: "3px 7px",
            fontSize: 10,
            fontWeight: 900,
            whiteSpace: "nowrap",
          }}
        >
          {palette.label}
        </span>
      </div>
      <p style={{ margin: 0, color: "#475569", fontSize: 10, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        {step.label}
      </p>
      <strong style={{ color: palette.accent, fontSize: 18, lineHeight: 1.12, overflowWrap: "anywhere" }}>
        {step.value}
      </strong>
      <p style={{ margin: 0, color: "#475569", fontSize: 11, lineHeight: 1.4 }}>
        {step.detail}
      </p>
    </article>
  );
}

function BrokerReviewDetails({
  checklistItems,
  confidenceItems,
  primaryConstraint,
}: {
  checklistItems: LenderChecklistItem[];
  confidenceItems: AssumptionConfidenceItem[];
  primaryConstraint: string;
}) {
  const allItems = [...checklistItems, ...confidenceItems];
  const readyCount = allItems.filter((item) => item.status === "ready").length;
  const checkCount = allItems.filter((item) => item.status === "check").length;
  const blockedCount = allItems.filter((item) => item.status === "blocked").length;

  return (
    <details
      className="underwriting-broker-review"
      style={{
        ...CARD,
        padding: 0,
        marginBottom: 20,
        overflow: "hidden",
        background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
      }}
    >
      <summary
        className="underwriting-broker-review-summary"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          gap: 16,
          alignItems: "center",
          padding: 18,
          cursor: "pointer",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, color: "#475569", fontSize: 11, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Broker review details
          </p>
          <h2 style={{ margin: "4px 0 0", color: "#0f172a", fontSize: 20, lineHeight: 1.2 }}>
            Open this when you need the proof checklist
          </h2>
          <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13, lineHeight: 1.55, maxWidth: 840 }}>
            The main page now reads as a decision flow first. This section holds the lender file readiness and assumption-confidence audit behind the current bottleneck: <strong style={{ color: "#0f172a" }}>{primaryConstraint}</strong>.
          </p>
        </div>
        <div className="underwriting-broker-review-counts" style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <ReadinessPill label="Ready" value={readyCount} tone="ready" />
          <ReadinessPill label="Verify" value={checkCount} tone="check" />
          <ReadinessPill label="Blocked" value={blockedCount} tone="blocked" />
        </div>
      </summary>

      <div className="underwriting-broker-review-body" style={{ padding: "0 18px 18px" }}>
        <LenderReadinessChecklist items={checklistItems} primaryConstraint={primaryConstraint} />
        <AssumptionConfidenceStrip items={confidenceItems} />
      </div>
    </details>
  );
}

function LenderReadinessChecklist({
  items,
  primaryConstraint,
}: {
  items: LenderChecklistItem[];
  primaryConstraint: string;
}) {
  const readyCount = items.filter((item) => item.status === "ready").length;
  const checkCount = items.filter((item) => item.status === "check").length;
  const blockedCount = items.filter((item) => item.status === "blocked").length;

  return (
    <section
      className="underwriting-readiness-strip"
      style={{
        ...CARD,
        padding: 18,
        marginBottom: 20,
        background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
      }}
      aria-label="Lender file readiness checklist"
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, color: "#475569", fontSize: 11, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            LENDER FILE READINESS
          </p>
          <h2 style={{ margin: "4px 0 0", color: "#0f172a", fontSize: 20 }}>
            What a broker still needs before this deal is financeable
          </h2>
          <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13, lineHeight: 1.55, maxWidth: 850 }}>
            Current bottleneck: <strong style={{ color: "#0f172a" }}>{primaryConstraint}</strong>. These cards translate the borrower box into proof requirements, not just model outputs.
          </p>
        </div>
        <div className="underwriting-readiness-summary" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignSelf: "flex-start" }}>
          <ReadinessPill label="Ready" value={readyCount} tone="ready" />
          <ReadinessPill label="Verify" value={checkCount} tone="check" />
          <ReadinessPill label="Blocked" value={blockedCount} tone="blocked" />
        </div>
      </div>

      <div className="underwriting-readiness-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
        {items.map((item) => (
          <LenderReadinessCard key={item.label} item={item} />
        ))}
      </div>
    </section>
  );
}

function ReadinessPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: WorkPlanStatus;
}) {
  const palette = {
    ready: { border: "#bbf7d0", bg: "#ecfdf3", color: "#166534" },
    check: { border: "#fde68a", bg: "#fffbeb", color: "#b45309" },
    blocked: { border: "#fecaca", bg: "#fef2f2", color: "#b91c1c" },
  }[tone];

  return (
    <span
      style={{
        borderRadius: 999,
        border: `1px solid ${palette.border}`,
        backgroundColor: palette.bg,
        color: palette.color,
        padding: "7px 10px",
        fontSize: 12,
        fontWeight: 900,
        whiteSpace: "nowrap",
      }}
    >
      {value} {label}
    </span>
  );
}

function LenderReadinessCard({ item }: { item: LenderChecklistItem }) {
  const palette = {
    ready: { bg: "#ecfdf3", border: "#bbf7d0", accent: "#166534", label: "Ready" },
    check: { bg: "#fffbeb", border: "#fde68a", accent: "#b45309", label: "Verify" },
    blocked: { bg: "#fef2f2", border: "#fecaca", accent: "#b91c1c", label: "Blocked" },
  }[item.status];

  return (
    <article
      className="underwriting-readiness-card"
      style={{
        minWidth: 0,
        borderRadius: 12,
        border: `1px solid ${palette.border}`,
        backgroundColor: palette.bg,
        padding: 14,
        display: "grid",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
        <span style={{ color: "#475569", fontSize: 11, fontWeight: 900, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          {item.label}
        </span>
        <span style={{ borderRadius: 999, border: `1px solid ${palette.border}`, backgroundColor: "#fff", color: palette.accent, padding: "4px 8px", fontSize: 11, fontWeight: 900, whiteSpace: "nowrap" }}>
          {palette.label}
        </span>
      </div>
      <strong style={{ color: palette.accent, fontSize: 21, lineHeight: 1.1, overflowWrap: "anywhere" }}>
        {item.value}
      </strong>
      <div style={{ display: "grid", gap: 7 }}>
        <p style={{ margin: 0, color: "#334155", fontSize: 12, lineHeight: 1.5 }}>
          <strong>Proof:</strong> {item.proof}
        </p>
        <p style={{ margin: 0, color: "#64748b", fontSize: 12, lineHeight: 1.5 }}>
          <strong>Risk:</strong> {item.risk}
        </p>
      </div>
      <a
        href={item.href}
        aria-label={`${item.action}: ${item.label}`}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, color: palette.accent, fontSize: 12, fontWeight: 900, textDecoration: "none", justifySelf: "start" }}
      >
        {item.action}
        <ArrowRight size={14} />
      </a>
    </article>
  );
}

function ProfileImpactTile({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  tone: "blue" | "amber" | "green" | "slate";
}) {
  const palette = {
    blue: { bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" },
    amber: { bg: "#fffbeb", border: "#fde68a", color: "#b45309" },
    green: { bg: "#ecfdf3", border: "#bbf7d0", color: "#166534" },
    slate: { bg: "#f8fafc", border: "#e2e8f0", color: "#334155" },
  }[tone];

  return (
    <div style={{ borderRadius: 8, border: "1px solid #e2e8f0", backgroundColor: "#fff", padding: 15, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={{ color: "#64748b", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          {label}
        </span>
        <span style={{ width: 34, height: 34, borderRadius: 8, display: "grid", placeItems: "center", backgroundColor: palette.bg, border: `1px solid ${palette.border}`, color: palette.color, flexShrink: 0 }}>
          {icon}
        </span>
      </div>
      <div style={{ marginTop: 10, color: "#0f172a", fontSize: 24, fontWeight: 850, lineHeight: 1.12, overflowWrap: "anywhere" }}>
        {value}
      </div>
      <div style={{ marginTop: 6, color: "#64748b", fontSize: 12, lineHeight: 1.45 }}>
        {detail}
      </div>
    </div>
  );
}

function VerdictCard({
  tone,
  title,
  value,
  label,
  detail,
  formula,
}: {
  tone: "blue" | "green" | "amber" | "red";
  title: string;
  value: string;
  label: string;
  detail: string;
  formula: string;
}) {
  const palette = {
    blue: { bg: "#eff6ff", border: "#bfdbfe", accent: "#1d4ed8", soft: "#dbeafe" },
    green: { bg: "#ecfdf3", border: "#bbf7d0", accent: "#166534", soft: "#dcfce7" },
    amber: { bg: "#fffbeb", border: "#fde68a", accent: "#b45309", soft: "#fef3c7" },
    red: { bg: "#fef2f2", border: "#fecaca", accent: "#b91c1c", soft: "#fee2e2" },
  }[tone];

  return (
    <article style={{ borderRadius: 12, border: `1px solid ${palette.border}`, backgroundColor: palette.bg, padding: 16, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <p style={{ margin: 0, color: palette.accent, fontSize: 12, fontWeight: 900, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            {title}
          </p>
          <div style={{ margin: "7px 0 0", color: "#0f172a", fontSize: 28, lineHeight: 1.05, overflowWrap: "anywhere", fontWeight: 900 }}>
            {value}
          </div>
          <p style={{ margin: "5px 0 0", color: "#475569", fontSize: 12, fontWeight: 800 }}>
            {label}
          </p>
        </div>
        <span style={{ width: 38, height: 38, borderRadius: 12, display: "grid", placeItems: "center", backgroundColor: palette.soft, color: palette.accent, flexShrink: 0 }}>
          <Gauge size={19} />
        </span>
      </div>
      <p style={{ margin: "12px 0 0", color: "#334155", fontSize: 13, lineHeight: 1.55 }}>
        {detail}
      </p>
      <p style={{ margin: "10px 0 0", padding: "9px 10px", borderRadius: 8, backgroundColor: "rgba(255,255,255,0.64)", color: "#475569", fontSize: 12, lineHeight: 1.45 }}>
        {formula}
      </p>
    </article>
  );
}

function WorkPlanCard({ item }: { item: WorkPlanItem }) {
  const palette = {
    ready: { bg: "#ecfdf3", border: "#bbf7d0", accent: "#166534", label: "Ready" },
    check: { bg: "#fffbeb", border: "#fde68a", accent: "#b45309", label: "Check" },
    blocked: { bg: "#fef2f2", border: "#fecaca", accent: "#b91c1c", label: "Blocked" },
  }[item.status];

  return (
    <article
      style={{
        borderRadius: 12,
        border: `1px solid ${palette.border}`,
        backgroundColor: palette.bg,
        padding: 15,
        minWidth: 0,
        display: "grid",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
        <div style={{ display: "flex", gap: 9, alignItems: "center", minWidth: 0 }}>
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              backgroundColor: "#fff",
              color: palette.accent,
              display: "grid",
              placeItems: "center",
              fontSize: 12,
              fontWeight: 900,
              border: `1px solid ${palette.border}`,
              flexShrink: 0,
            }}
          >
            {item.step}
          </span>
          <h3 style={{ margin: 0, color: "#0f172a", fontSize: 15, lineHeight: 1.25 }}>
            {item.title}
          </h3>
        </div>
        <span
          style={{
            borderRadius: 999,
            backgroundColor: "#fff",
            border: `1px solid ${palette.border}`,
            color: palette.accent,
            padding: "4px 8px",
            fontSize: 11,
            fontWeight: 900,
            whiteSpace: "nowrap",
          }}
        >
          {palette.label}
        </span>
      </div>
      <div style={{ color: palette.accent, fontSize: 22, fontWeight: 900, lineHeight: 1.1, overflowWrap: "anywhere" }}>
        {item.value}
      </div>
      <p style={{ margin: 0, color: "#475569", fontSize: 12, lineHeight: 1.5 }}>
        {item.detail}
      </p>
      <a
        href={item.href}
        aria-label={`${item.action}: ${item.title}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          justifySelf: "start",
          color: palette.accent,
          fontSize: 12,
          fontWeight: 900,
          textDecoration: "none",
        }}
      >
        {item.action}
        <ArrowRight size={14} />
      </a>
    </article>
  );
}

function AssumptionConfidenceStrip({ items }: { items: AssumptionConfidenceItem[] }) {
  return (
    <section
      className="underwriting-confidence-strip"
      style={{
        ...CARD,
        padding: 18,
        marginBottom: 20,
        background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
      }}
      aria-label="Underwriting assumption confidence"
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <p style={{ margin: 0, color: "#475569", fontSize: 11, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            ASSUMPTION CONFIDENCE
          </p>
          <h2 style={{ margin: "4px 0 0", color: "#0f172a", fontSize: 20 }}>
            Know which inputs are solid before trusting the result
          </h2>
          <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13, lineHeight: 1.55, maxWidth: 820 }}>
            These are the four assumptions most likely to change which listings are available: income, rental-income treatment, cash, and the future commercial takeout.
          </p>
        </div>
        <Link href="/" style={{ color: "#2563eb", fontSize: 13, fontWeight: 800, textDecoration: "none", alignSelf: "flex-start" }}>
          View filtered deals
        </Link>
      </div>

      <div className="underwriting-confidence-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 10 }}>
        {items.map((item) => (
          <AssumptionConfidenceCard key={item.label} item={item} />
        ))}
      </div>
    </section>
  );
}

function AssumptionConfidenceCard({ item }: { item: AssumptionConfidenceItem }) {
  const palette = {
    ready: { bg: "#ecfdf3", border: "#bbf7d0", accent: "#166534", label: "Ready" },
    check: { bg: "#fffbeb", border: "#fde68a", accent: "#b45309", label: "Verify" },
    blocked: { bg: "#fef2f2", border: "#fecaca", accent: "#b91c1c", label: "Missing" },
  }[item.status];

  return (
    <article
      className="underwriting-confidence-card"
      style={{
        minWidth: 0,
        borderRadius: 12,
        border: `1px solid ${palette.border}`,
        backgroundColor: palette.bg,
        padding: 14,
        display: "grid",
        gap: 9,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
        <span style={{ color: "#475569", fontSize: 11, fontWeight: 900, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          {item.label}
        </span>
        <span style={{ borderRadius: 999, border: `1px solid ${palette.border}`, backgroundColor: "#fff", color: palette.accent, padding: "4px 8px", fontSize: 11, fontWeight: 900, whiteSpace: "nowrap" }}>
          {palette.label}
        </span>
      </div>
      <strong style={{ color: palette.accent, fontSize: 21, lineHeight: 1.1, overflowWrap: "anywhere" }}>
        {item.value}
      </strong>
      <p style={{ margin: 0, color: "#475569", fontSize: 12, lineHeight: 1.5 }}>
        {item.detail}
      </p>
      <a
        href={item.href}
        aria-label={`${item.action}: ${item.label}`}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, color: palette.accent, fontSize: 12, fontWeight: 900, textDecoration: "none", justifySelf: "start" }}
      >
        {item.action}
        <ArrowRight size={14} />
      </a>
    </article>
  );
}

function UnitLaneCard({ lane }: { lane: UnitLaneComparison }) {
  const palette = {
    ready: { bg: "#ecfdf3", border: "#bbf7d0", accent: "#166534", labelBg: "#dcfce7" },
    check: { bg: "#fffbeb", border: "#fde68a", accent: "#b45309", labelBg: "#fef3c7" },
    blocked: { bg: "#fef2f2", border: "#fecaca", accent: "#b91c1c", labelBg: "#fee2e2" },
  }[lane.status];

  return (
    <article style={{ borderRadius: 12, border: `1px solid ${palette.border}`, backgroundColor: palette.bg, padding: 16, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <p style={{ margin: 0, color: palette.accent, fontSize: 12, fontWeight: 900, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            {lane.financingTrack}
          </p>
          <h3 style={{ margin: "6px 0 0", color: "#0f172a", fontSize: 17, lineHeight: 1.25 }}>
            {lane.title}
          </h3>
        </div>
        <span style={{ borderRadius: 999, backgroundColor: palette.labelBg, color: palette.accent, border: `1px solid ${palette.border}`, padding: "5px 8px", fontSize: 11, fontWeight: 900, whiteSpace: "nowrap" }}>
          {lane.statusLabel}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
        <MiniMetric label="Min equity" value={currency(lane.minimumDownPayment)} />
        <MiniMetric
          label={lane.cashGap >= 0 ? "Cash surplus" : "Cash shortfall"}
          value={currency(Math.abs(lane.cashGap))}
          tone={lane.cashGap >= 0 ? "green" : "red"}
        />
      </div>

      <p style={{ margin: "12px 0 0", color: "#475569", fontSize: 12, lineHeight: 1.5 }}>
        {lane.note}
      </p>
      <a
        href={lane.href}
        aria-label={`${lane.action}: ${lane.title}`}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 12, color: palette.accent, fontSize: 12, fontWeight: 900, textDecoration: "none" }}
      >
        {lane.action}
        <ArrowRight size={14} />
      </a>
    </article>
  );
}

function FinancingLaneSnapshot({
  lanes,
  takeoutCoversDebt,
  takeoutExcess,
  takeoutShortfall,
  takeoutConstraint,
  surface = "dark",
}: {
  lanes: UnitLaneComparison[];
  takeoutCoversDebt: boolean;
  takeoutExcess: number;
  takeoutShortfall: number;
  takeoutConstraint: string;
  surface?: "dark" | "light";
}) {
  const lightSurface = surface === "light";

  return (
    <div
      className="underwriting-lane-snapshot"
      data-testid="underwriting-lane-snapshot"
      style={
        lightSurface
          ? {
              ...CARD,
              padding: 16,
              marginBottom: 20,
              background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
            }
          : { marginTop: 18 }
      }
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <p style={{ margin: 0, color: lightSurface ? "#1d4ed8" : "#bfdbfe", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase" }}>
          Financing lane snapshot
        </p>
        <a
          href="#policy-review"
          aria-label="Confirm lender policy notes"
          style={{ color: lightSurface ? "#2563eb" : "#dbeafe", fontSize: 12, fontWeight: 900, textDecoration: "none" }}
        >
          Confirm lender policy
        </a>
      </div>

      <div className="underwriting-lane-snapshot-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 9, marginTop: 10 }}>
        {lanes.map((lane) => (
          <HeroLaneCard
            key={lane.units}
            href={lane.href}
            status={lane.status}
            label={`${lane.units} unit${lane.units === 1 ? "" : "s"}`}
            value={lane.statusLabel}
            detail={lane.cashGap >= 0 ? `${currency(lane.cashGap)} cash room` : `${currency(Math.abs(lane.cashGap))} cash gap`}
            subdetail={lane.financingTrack}
            surface={surface}
          />
        ))}
        <HeroLaneCard
          href="#commercial-takeout"
          status={takeoutCoversDebt ? "ready" : "blocked"}
          label="Year 3 takeout"
          value={takeoutCoversDebt ? "Refi clears" : "Refi gap"}
          detail={takeoutCoversDebt ? `${currency(takeoutExcess)} excess` : `${currency(takeoutShortfall)} short`}
          subdetail={`Limited by ${takeoutConstraint}`}
          surface={surface}
        />
      </div>
    </div>
  );
}

function HeroMetricStrip({ items }: { items: HeroMetricItem[] }) {
  return (
    <div className="underwriting-hero-metrics" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(155px,1fr))", gap: 9, marginTop: 18 }}>
      {items.map((item) => {
        const palette = {
          ready: { border: "rgba(134,239,172,0.42)", bg: "rgba(20,83,45,0.28)", accent: "#bbf7d0" },
          check: { border: "rgba(253,230,138,0.48)", bg: "rgba(120,53,15,0.22)", accent: "#fde68a" },
          blocked: { border: "rgba(252,165,165,0.48)", bg: "rgba(127,29,29,0.24)", accent: "#fecaca" },
        }[item.status];

        return (
          <div
            key={item.label}
            style={{
              minWidth: 0,
              borderRadius: 12,
              border: `1px solid ${palette.border}`,
              backgroundColor: palette.bg,
              padding: 12,
            }}
          >
            <p style={{ margin: 0, color: "#bfdbfe", fontSize: 10, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {item.label}
            </p>
            <strong style={{ display: "block", marginTop: 6, color: palette.accent, fontSize: 17, lineHeight: 1.12, overflowWrap: "anywhere" }}>
              {item.value}
            </strong>
            <p style={{ margin: "6px 0 0", color: "#dbeafe", fontSize: 11, lineHeight: 1.35 }}>
              {item.detail}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function HeroLaneCard({
  href,
  status,
  label,
  value,
  detail,
  subdetail,
  surface = "dark",
}: {
  href: string;
  status: UnitLaneStatus;
  label: string;
  value: string;
  detail: string;
  subdetail: string;
  surface?: "dark" | "light";
}) {
  const lightSurface = surface === "light";
  const palette = lightSurface
    ? {
        ready: { border: "#bbf7d0", bg: "#ecfdf3", accent: "#166534", muted: "#475569", label: "#166534" },
        check: { border: "#fde68a", bg: "#fffbeb", accent: "#b45309", muted: "#475569", label: "#b45309" },
        blocked: { border: "#fecaca", bg: "#fef2f2", accent: "#b91c1c", muted: "#475569", label: "#b91c1c" },
      }[status]
    : {
        ready: { border: "rgba(134,239,172,0.42)", bg: "rgba(20,83,45,0.28)", accent: "#bbf7d0", muted: "#dbeafe", label: "#bfdbfe" },
        check: { border: "rgba(253,230,138,0.48)", bg: "rgba(120,53,15,0.22)", accent: "#fde68a", muted: "#dbeafe", label: "#bfdbfe" },
        blocked: { border: "rgba(252,165,165,0.48)", bg: "rgba(127,29,29,0.24)", accent: "#fecaca", muted: "#dbeafe", label: "#bfdbfe" },
      }[status];

  return (
    <a
      className="underwriting-hero-lane-card"
      href={href}
      aria-label={`Open ${label}: ${value}`}
      style={{
        minWidth: 0,
        borderRadius: 12,
        border: `1px solid ${palette.border}`,
        backgroundColor: palette.bg,
        color: lightSurface ? "#0f172a" : "#fff",
        padding: 11,
        display: "grid",
        gap: 5,
        textDecoration: "none",
      }}
    >
      <span style={{ color: palette.label, fontSize: 10, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        {label}
      </span>
      <strong style={{ color: palette.accent, fontSize: 15, lineHeight: 1.15, overflowWrap: "anywhere" }}>
        {value}
      </strong>
      <span style={{ color: lightSurface ? "#0f172a" : "#fff", fontSize: 13, fontWeight: 850, lineHeight: 1.2, overflowWrap: "anywhere" }}>
        {detail}
      </span>
      <span className="underwriting-hero-lane-subdetail" style={{ color: palette.muted, fontSize: 11, lineHeight: 1.25, overflowWrap: "anywhere" }}>
        {subdetail}
      </span>
    </a>
  );
}

function RentalIncomePresetButton({
  label,
  detail,
  includedMonthlyRent,
  active,
  onClick,
}: {
  label: string;
  detail: string;
  includedMonthlyRent: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={`${active ? "Selected" : "Apply"} rental income preset: ${label}. Includes ${currency(includedMonthlyRent)} per month`}
      onClick={onClick}
      style={{
        textAlign: "left",
        borderRadius: 10,
        border: active ? "1px solid #2563eb" : "1px solid #bfdbfe",
        backgroundColor: active ? "#fff" : "rgba(255,255,255,0.72)",
        padding: 12,
        cursor: "pointer",
        display: "grid",
        gap: 7,
        boxShadow: active ? "0 8px 20px rgba(37,99,235,0.12)" : "none",
      }}
    >
      <span style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <strong style={{ color: active ? "#1d4ed8" : "#0f172a", fontSize: 13 }}>{label}</strong>
        <span style={{ color: active ? "#1d4ed8" : "#64748b", fontSize: 11, fontWeight: 900 }}>
          {active ? "Selected" : "Apply"}
        </span>
      </span>
      <span style={{ color: "#0f172a", fontSize: 20, fontWeight: 900, lineHeight: 1.05 }}>
        {currency(includedMonthlyRent)}/mo
      </span>
      <span style={{ color: "#64748b", fontSize: 12, lineHeight: 1.45 }}>
        {detail}
      </span>
    </button>
  );
}

function QuickCashCapButton({
  amount,
  active,
  onClick,
}: {
  amount: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={`${active ? "Selected" : "Set"} maximum down payment to ${currency(amount)}`}
      onClick={onClick}
      style={{
        borderRadius: 999,
        border: active ? "1px solid #2563eb" : "1px solid #cbd5e1",
        backgroundColor: active ? "#eff6ff" : "#fff",
        color: active ? "#1d4ed8" : "#334155",
        padding: "8px 10px",
        fontSize: 12,
        fontWeight: 900,
        cursor: "pointer",
        boxShadow: active ? "0 8px 18px rgba(37,99,235,0.12)" : "none",
      }}
    >
      {currency(amount)}
    </button>
  );
}

function CashImpactTile({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "green" | "red" | "blue" | "slate";
}) {
  const palette = {
    green: { bg: "#ecfdf3", border: "#bbf7d0", accent: "#166534" },
    red: { bg: "#fef2f2", border: "#fecaca", accent: "#b91c1c" },
    blue: { bg: "#eff6ff", border: "#bfdbfe", accent: "#1d4ed8" },
    slate: { bg: "#f8fafc", border: "#e2e8f0", accent: "#334155" },
  }[tone];

  return (
    <div
      style={{
        minWidth: 0,
        borderRadius: 10,
        border: `1px solid ${palette.border}`,
        backgroundColor: palette.bg,
        padding: 11,
      }}
    >
      <div style={{ color: "#64748b", fontSize: 10, fontWeight: 900, letterSpacing: "0.06em", textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ marginTop: 5, color: palette.accent, fontSize: 18, fontWeight: 900, lineHeight: 1.1, overflowWrap: "anywhere" }}>
        {value}
      </div>
      <div style={{ marginTop: 5, color: "#475569", fontSize: 11, lineHeight: 1.35 }}>
        {detail}
      </div>
    </div>
  );
}

function MiniMetric({ label, value, tone = "slate" }: { label: string; value: string; tone?: "green" | "red" | "slate" }) {
  const color = tone === "green" ? "#166534" : tone === "red" ? "#b91c1c" : "#0f172a";
  return (
    <div style={{ borderRadius: 8, border: "1px solid rgba(148,163,184,0.45)", backgroundColor: "rgba(255,255,255,0.72)", padding: 10, minWidth: 0 }}>
      <div style={{ color: "#64748b", fontSize: 10, fontWeight: 900, letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ marginTop: 5, color, fontSize: 17, fontWeight: 900, lineHeight: 1.1, overflowWrap: "anywhere" }}>{value}</div>
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return <div style={{ marginBottom: 16 }}><h2 style={{ margin: 0, fontSize: 18, color: "#0f172a" }}>{title}</h2><p style={{ margin: "5px 0 0", color: "#64748b", fontSize: 13, lineHeight: 1.6 }}>{subtitle}</p></div>;
}

function FieldShell({
  label,
  children,
  compact = false,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  compact?: boolean;
  hint?: string;
}) {
  return (
    <label style={{ display: "block", minWidth: compact ? 170 : undefined }}>
      <span style={{ display: "block", marginBottom: 6, fontSize: 12, color: "#475569", fontWeight: 700 }}>{label}</span>
      {children}
      {hint ? <span style={{ display: "block", marginTop: 6, color: "#64748b", fontSize: 12, lineHeight: 1.45 }}>{hint}</span> : null}
    </label>
  );
}

function MoneyInput({ label, value, onChange, compact = false, hint }: { label: string; value: number; onChange: (value: number) => void; compact?: boolean; hint?: string }) {
  return <FieldShell label={label} compact={compact} hint={hint}><div style={{ position: "relative" }}><span style={{ position: "absolute", left: 11, top: 10, color: "#64748b" }}>$</span><input type="number" min={0} value={value} onChange={(event) => onChange(numberValue(event.target.value))} style={{ ...INPUT, paddingLeft: 25 }} /></div></FieldShell>;
}

function NumberInput({ label, value, onChange, suffix, min, max, step, hint }: { label: string; value: number | string; onChange: (value: number | string) => void; suffix?: string; min?: number; max?: number; step?: number; hint?: string }) {
  return <FieldShell label={label} hint={hint}><div style={{ position: "relative" }}><input type="number" value={value} min={min} max={max} step={step} onChange={(event) => onChange(event.target.value === "" ? "" : Number(event.target.value))} style={{ ...INPUT, paddingRight: suffix ? 52 : 11 }} />{suffix ? <span style={{ position: "absolute", right: 10, top: 10, color: "#64748b", fontSize: 13 }}>{suffix}</span> : null}</div></FieldShell>;
}

function SelectInput({ label, value, onChange, options, hint }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; hint?: string }) {
  return <FieldShell label={label} hint={hint}><select value={value} onChange={(event) => onChange(event.target.value)} style={{ ...INPUT, backgroundColor: "#fff" }}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></FieldShell>;
}

const INPUT: React.CSSProperties = { width: "100%", boxSizing: "border-box", border: "1px solid #cbd5e1", borderRadius: 8, padding: "9px 11px", color: "#0f172a", fontSize: 14 };

function Metric({ label, value }: { label: string; value: string }) {
  return <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}><span style={{ fontSize: 13, color: "#64748b" }}>{label}</span><strong style={{ color: "#0f172a", textAlign: "right" }}>{value}</strong></div>;
}

function FormulaRow({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div style={{ borderRadius: 8, border: "1px solid #e2e8f0", backgroundColor: "#f8fafc", padding: "10px 11px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <span style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>{label}</span>
        <strong style={{ color: "#0f172a", fontSize: 13, textAlign: "right" }}>{value}</strong>
      </div>
      <div style={{ marginTop: 5, color: "#64748b", fontSize: 12, lineHeight: 1.45 }}>{detail}</div>
    </div>
  );
}

function Flag({ ok, text }: { ok: boolean; text: string }) {
  return <div style={{ display: "flex", gap: 9, alignItems: "flex-start", marginTop: 11, fontSize: 13, color: "#475569" }}><span style={{ color: ok ? "#16a34a" : "#d97706", fontWeight: 900 }}>{ok ? "PASS" : "CHECK"}</span><span>{text}</span></div>;
}

function SummaryTile({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div style={{ padding: 14, borderRadius: 8, backgroundColor: strong ? "#dbeafe" : "#f8fafc", border: strong ? "1px solid #93c5fd" : "1px solid #e2e8f0" }}><div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>{label}</div><div style={{ marginTop: 5, fontSize: 20, fontWeight: 800, color: "#0f172a" }}>{value}</div></div>;
}

function PolicyCard({ icon, title, body, href }: { icon: React.ReactNode; title: string; body: string; href: string }) {
  return <article style={{ padding: 16, borderRadius: 8, border: "1px solid #e2e8f0", backgroundColor: "#f8fafc" }}><div style={{ display: "flex", alignItems: "center", gap: 8, color: "#1d4ed8" }}>{icon}<strong>{title}</strong></div><p style={{ margin: "10px 0", fontSize: 13, lineHeight: 1.65, color: "#475569" }}>{body}</p><a href={href} aria-label={`Open official source for ${title}`} target="_blank" rel="noreferrer" style={{ color: "#2563eb", fontSize: 13, fontWeight: 700 }}>Official source</a></article>;
}
