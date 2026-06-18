"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { ProvenanceBadge } from "@/components/listing/ProvenanceBadge";
import {
  type CashflowProjectionYear,
  computeBuyAndHold,
  computeBridgeFacility,
  computeCashflowProjection,
  computeReturnBridge,
} from "@/lib/finance";
import {
  calculateOperatingExpenseLineAmount,
  createCustomOperatingExpense,
  deriveOperatingExpenseRatioAssumption,
  operatingExpenseInputModeLabel,
  operatingExpensePercentBasisLabel,
  overrideOperatingExpenseInput,
  getOperatingExpenseInputValue,
  switchOperatingExpenseInputMode,
  toFinanceOperatingExpenseItems,
} from "@/lib/operating-expenses";
import {
  propertyTaxClassLabel,
  propertyTaxMethodLabel,
} from "@/lib/property-tax";
import { resolveMinimumDownPaymentRule } from "@/lib/program-rules";
import type { StrategyModel } from "@/lib/strategy-modeling";
import type {
  AssumptionSource,
  AssumptionValue,
  OperatingExpenseInputMode,
  OperatingExpenseLineItem,
  ScenarioAssumptions,
  StrategyUnitRentLineItem,
} from "@/types/listing";

type DownPaymentInputMode = "percent" | "amount";
type BridgeAdvanceInputMode = "percent" | "amount";
type DecisionTone = "green" | "amber" | "red" | "blue" | "slate";
type PlaybookReviewMapItem = {
  href: string;
  label: string;
  detail: string;
};
type ModelControlItem = {
  label: string;
  value: string;
  detail: string;
  href: string;
  action: string;
  tone: DecisionTone;
};
type AssumptionEditGuideItem = {
  label: string;
  value: string;
  detail: string;
  href: string;
  tone: DecisionTone;
};
type ModelOverrideSummary = {
  count: number;
  labels: string[];
};
type CashflowBridgeStep = {
  label: string;
  value: string;
  detail: string;
};

const UNDERWRITING_LABELS: Record<StrategyModel["underwritingMode"], string> = {
  current_income: "Current income underwriting",
  stabilized_income: "Stabilized underwriting",
  covered_land: "Land carry underwriting",
};

const HIDE_MODELED_UNITS_FOR_ASSET_TYPES = new Set([
  "single_family",
  "condo",
  "land",
  "parking",
]);

const SURFACE_CARD_CLASS =
  "rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]";
const SUBTLE_PANEL_CLASS = "rounded-xl border border-slate-200 bg-slate-50/70 p-4";
const INPUT_SHELL_CLASS =
  "flex items-center rounded-lg border border-slate-300 bg-slate-50 px-3 shadow-inner shadow-slate-100/70";

const BRIDGE_USAGE_META = {
  not_needed: {
    tagLabel: "Bridge usually not needed",
    description: "This path is typically executed with permanent financing from day one rather than a separate bridge facility.",
  },
  optional: {
    tagLabel: "Bridge optional",
    description: "This path can be financed directly, but a bridge can make sense if the asset needs lease-up, cleanup, or a delayed CMHC takeout.",
  },
  common: {
    tagLabel: "Bridge commonly required",
    description: "This path is usually easier to execute with short-term bridge debt first, then refinance once rents, occupancy, or NOI are proven.",
  },
  core: {
    tagLabel: "Bridge / construction financing core",
    description: "This path is fundamentally transitional. Short-term bridge or construction financing is a core part of the execution plan before permanent takeout.",
  },
} as const;

export function StrategyPlaybookView({ model }: { model: StrategyModel }) {
  const [modeledRentPerUnit, setModeledRentPerUnit] = useState<AssumptionValue<number>>(model.modeledRentPerUnit);
  const [assumptions, setAssumptions] = useState<ScenarioAssumptions>(model.assumptions);
  const [unitRentSchedule, setUnitRentSchedule] = useState<StrategyUnitRentLineItem[]>(model.unitRentSchedule);
  const [operatingExpensesExpanded, setOperatingExpensesExpanded] = useState(true);
  const [outcomeDetailsOpen, setOutcomeDetailsOpen] = useState(false);
  const [newExpenseLabel, setNewExpenseLabel] = useState("");
  const [newExpenseMode, setNewExpenseMode] = useState<OperatingExpenseInputMode>("annual");
  const [downPaymentInputMode, setDownPaymentInputMode] = useState<DownPaymentInputMode>("percent");
  const [bridgeAdvanceInputMode, setBridgeAdvanceInputMode] = useState<BridgeAdvanceInputMode>("percent");
  const [bridgeEnabled, setBridgeEnabled] = useState(model.requiresBridgeLoan);
  const currentRentDrivesProjection = usesCurrentRentForProjection(model);
  const showModeledUnits =
    model.modeledUnits.value > 1 &&
    !HIDE_MODELED_UNITS_FOR_ASSET_TYPES.has(model.assetType);

  const basePrice = model.result.basisPrice - model.result.capitalBudget;
  const targetAreaSqFt = model.capitalPlan.targetAreaSqFt;
  const capexBudget =
    targetAreaSqFt != null && targetAreaSqFt > 0
      ? Math.max(0, targetAreaSqFt * assumptions.renoCostPerSqFt.value)
      : model.capitalPlan.budget;
  const showRenoCostPerSqFt = assumptions.renoCostPerSqFt.value > 0 || model.capitalPlan.budget > 0;
  const showCapexMetrics = showRenoCostPerSqFt;
  const financedBasis = Math.max(0, basePrice + capexBudget);
  const downPaymentRule = resolveMinimumDownPaymentRule(model.programId, {
    price: basePrice,
    assetType: model.assetType,
    units: model.modeledUnits.value,
    ownerOccupiedPrimaryHome: model.ownerOccupied,
  });
  const maxAllowedLtv = downPaymentRule.maxLtvPct;
  const requestedLtv = clamp(assumptions.ltvPct.value, 0, 1);
  const constrainedTakeoutLtv = clamp(assumptions.takeoutLtvPct.value, 0, maxAllowedLtv);
  const effectivePermanentLtv = bridgeEnabled ? constrainedTakeoutLtv : requestedLtv;
  const downPaymentAmount = roundTo(financedBasis * (1 - requestedLtv), 2);
  const downPaymentPct = basePrice > 0 ? clamp(downPaymentAmount / basePrice, 0, 1) : 0;
  const takeoutEquityAmount = roundTo(financedBasis * (1 - constrainedTakeoutLtv), 2);
  const minimumDownPaymentAmount = roundTo(
    downPaymentRule.minDownPaymentAmount ?? basePrice * downPaymentRule.minDownPaymentPct,
    2
  );
  const effectiveMinimumDownPaymentAmount = Math.max(
    minimumDownPaymentAmount,
    roundTo(financedBasis * (1 - maxAllowedLtv), 2)
  );
  const downPaymentBelowModeledMinimum =
    !bridgeEnabled && downPaymentAmount + 0.01 < effectiveMinimumDownPaymentAmount;
  const modeledRentAverage =
    unitRentSchedule.length > 0
      ? averageUnitRent(unitRentSchedule, "modeledRent")
      : modeledRentPerUnit.value;
  const unitMonthlyRentsForProjection = projectionUnitMonthlyRents(
    unitRentSchedule,
    model.modeledUnits.value
  );
  const financeOperatingExpenses = toFinanceOperatingExpenseItems(assumptions.operatingExpenses);

  const modeledResult = computeBuyAndHold({
    price: basePrice,
    units: Math.max(0, Math.round(model.modeledUnits.value)),
    avgMonthlyRentPerUnit: Math.max(0, modeledRentAverage),
    unitMonthlyRents: unitMonthlyRentsForProjection,
    vacancyRate: clamp(assumptions.vacancyRate.value, 0, 0.25),
    operatingExpenseItems: financeOperatingExpenses,
    mortgageRate: clamp(assumptions.mortgageRate.value, 0, 0.2),
    amortizationYears: Math.max(1, Math.round(assumptions.amortizationYears.value)),
    ltvPct: effectivePermanentLtv,
    closingCostPct: clamp(assumptions.closingCostPct.value, 0, 0.15),
    capitalBudget: capexBudget,
  });
  const operatingExpenseRatioAssumption = deriveOperatingExpenseRatioAssumption(
    assumptions.operatingExpenses,
    modeledResult.effectiveGrossIncome,
    basePrice
  );
  const operatingExpenseTotal = assumptions.operatingExpenses.reduce(
    (sum, item) =>
      sum + calculateOperatingExpenseLineAmount(item, modeledResult.effectiveGrossIncome, basePrice),
    0
  );

  const modeledStabilizedValue =
    model.stabilizedValue != null && modeledResult.noi > 0
      ? basePrice
      : null;
  const modeledStabilizationLift =
    modeledStabilizedValue != null
      ? Math.max(0, modeledStabilizedValue - modeledResult.basisPrice)
      : null;
  const bridgeToggleAvailable = model.bridgeUsage !== "not_needed";
  const bridgeCategory = BRIDGE_USAGE_META[model.bridgeUsage];
  const bridgeFacility = bridgeEnabled
    ? computeBridgeFacility({
        purchasePrice: basePrice,
        closingCosts: modeledResult.closingCosts,
        capitalBudget: capexBudget,
        bridgePrincipalAdvance: financedBasis * assumptions.bridgeAdvancePct.value,
        takeoutProceeds: modeledResult.loanAmount,
        bridgeRateAnnual: assumptions.bridgeRateAnnual.value,
        bridgeTermMonths: assumptions.bridgeTermMonths.value,
        bridgeFeePct: assumptions.bridgeFeePct.value,
        bridgeInterestReserveMonths: assumptions.bridgeInterestReserveMonths.value,
      })
    : null;

  const cashflowProjection = computeCashflowProjection({
    financeInputs: {
      price: basePrice,
      units: Math.max(0, Math.round(model.modeledUnits.value)),
      avgMonthlyRentPerUnit: Math.max(0, modeledRentAverage),
      unitMonthlyRents: unitMonthlyRentsForProjection,
      vacancyRate: clamp(assumptions.vacancyRate.value, 0, 0.25),
      operatingExpenseItems: financeOperatingExpenses,
      mortgageRate: clamp(assumptions.mortgageRate.value, 0, 0.2),
      amortizationYears: Math.max(1, Math.round(assumptions.amortizationYears.value)),
      ltvPct: effectivePermanentLtv,
      closingCostPct: clamp(assumptions.closingCostPct.value, 0, 0.15),
      capitalBudget: capexBudget,
    },
    holdPeriodYears: Math.max(1, Math.round(assumptions.holdPeriodYears.value)),
    rentGrowthRateAnnual: assumptions.rentGrowthRateAnnual.value,
    bridge:
      bridgeEnabled && bridgeFacility
        ? {
            enabled: true,
            bridgeMonthlyCarry: bridgeFacility.monthlyInterestCarry,
            bridgeTermMonths: assumptions.bridgeTermMonths.value,
            takeoutLoanAmount: modeledResult.loanAmount,
            takeoutMortgageRate: clamp(assumptions.mortgageRate.value, 0, 0.2),
            takeoutAmortizationYears: Math.max(1, Math.round(assumptions.amortizationYears.value)),
          }
        : null,
  });

  const yearOneProjection = cashflowProjection.years[0];
  const exitProjection = cashflowProjection.years[cashflowProjection.years.length - 1];
  const returnBridge = computeReturnBridge({
    result: modeledResult,
    price: basePrice,
    appreciationRateAnnual: clamp(assumptions.appreciationRateAnnual.value, 0, 0.2),
    mortgageRate: clamp(assumptions.mortgageRate.value, 0, 0.2),
    amortizationYears: Math.max(1, Math.round(assumptions.amortizationYears.value)),
    holdPeriodYears: Math.max(1, Math.round(assumptions.holdPeriodYears.value)),
    yearOneCashflowOverride: yearOneProjection?.annualCashflow,
    yearOneDebtPaydownOverride: yearOneProjection?.principalPaidYear,
    exitLoanBalanceOverride: exitProjection?.loanBalanceEnd,
    holdPeriodCashflow: cashflowProjection.totalCashflow,
    stabilizationLift: modeledStabilizationLift,
    projectionStartValue: modeledStabilizedValue ?? modeledResult.basisPrice,
  });
  const cashflowHighlights = projectionHighlights(cashflowProjection.years);
  const yearOneAnnualCashflow = yearOneProjection?.annualCashflow ?? modeledResult.annualCashflow;
  const yearOneMonthlyCashflow = yearOneAnnualCashflow / 12;
  const yearOneDebtService = yearOneProjection?.annualDebtService ?? modeledResult.annualDebtService;
  const modeledUnitCount = Math.max(0, Math.round(model.modeledUnits.value));
  const vacancyImpact = modeledResult.grossScheduledRent - modeledResult.effectiveGrossIncome;
  const rentRollStepValue =
    unitMonthlyRentsForProjection && unitMonthlyRentsForProjection.length > 0
      ? `${unitMonthlyRentsForProjection.length} unit rents summed`
      : `${modeledUnitCount} units x ${currency(modeledRentAverage)}/mo`;
  const rentToCashflowSteps: CashflowBridgeStep[] = [
    {
      label: "Rent roll",
      value: rentRollStepValue,
      detail: `${currency(modeledResult.grossScheduledRent)}/yr gross scheduled rent`,
    },
    {
      label: "Vacancy",
      value: `${percent(assumptions.vacancyRate.value * 100)} vacancy`,
      detail: `${currency(vacancyImpact)} vacancy impact -> ${currency(modeledResult.effectiveGrossIncome)} EGI`,
    },
    {
      label: "Operating costs",
      value: `-${currency(modeledResult.operatingExpenses)}`,
      detail: `${percent(operatingExpenseRatioAssumption.value * 100)} of EGI -> ${currency(modeledResult.noi)} NOI`,
    },
    {
      label: "Debt service",
      value: `-${currency(yearOneDebtService)}`,
      detail: bridgeEnabled
        ? `${yearOneProjection ? cashflowPhaseLabel(yearOneProjection) : "Year 1 debt"}: ${currency(yearOneAnnualCashflow)} Y1 cashflow`
        : `${currency(modeledResult.loanAmount)} loan @ ${percent(assumptions.mortgageRate.value * 100)} -> ${currency(yearOneAnnualCashflow)} Y1 cashflow`,
    },
  ];
  const firstThreeCashflowYears = cashflowProjection.years.slice(0, 3);
  const firstThreeCashflow = firstThreeCashflowYears.reduce(
    (sum, year) => sum + year.annualCashflow,
    0
  );
  const exitCashflowYear = cashflowProjection.years[cashflowProjection.years.length - 1];
  const mobileCashflowYears =
    exitCashflowYear && exitCashflowYear.year > 3
      ? [...firstThreeCashflowYears, exitCashflowYear]
      : cashflowProjection.years;
  const rentRollBasis = buildRentRollBasis({
    unitRentSchedule,
    modeledUnitCount,
    modeledRentAverage,
    grossScheduledRentAnnual: yearOneProjection?.grossScheduledRent ?? modeledResult.grossScheduledRent,
  });
  const hasStabilizationBridge = returnBridge.stabilizationLift != null;
  const showBridgeFacility = bridgeToggleAvailable;
  const refiSurplusShortfall = bridgeEnabled && bridgeFacility ? bridgeFacility.refiSurplusShortfall : null;
  const decisionConcerns = [
    yearOneAnnualCashflow < 0
      ? `Year 1 cashflow is negative by ${currency(Math.abs(yearOneAnnualCashflow))}.`
      : null,
    modeledResult.dscr > 0 && modeledResult.dscr < 1.25
      ? `DSCR is ${number(modeledResult.dscr)}, below a common 1.25x lender screen.`
      : null,
    modeledResult.cashOnCashReturn != null && modeledResult.cashOnCashReturn < 0
      ? `Cash-on-cash return is ${percent(modeledResult.cashOnCashReturn)}.`
      : null,
    refiSurplusShortfall != null && refiSurplusShortfall < 0
      ? `Takeout shortfall is ${currency(Math.abs(refiSurplusShortfall))}.`
      : null,
    model.mliSelectAnalysis && !model.mliSelectAnalysis.qualified
      ? `MLI Select is below the 50-point qualifying tier.`
      : null,
  ].filter((concern): concern is string => Boolean(concern));
  const hasHardConcern =
    yearOneAnnualCashflow < 0 ||
    modeledResult.dscr < 1 ||
    (refiSurplusShortfall != null && refiSurplusShortfall < 0);
  const decisionTone: DecisionTone = hasHardConcern
    ? "red"
    : decisionConcerns.length > 0
      ? "amber"
      : "green";
  const decisionHeadline =
    decisionTone === "green"
      ? "Looks ready for deeper underwriting"
      : decisionTone === "amber"
        ? "Promising, but verify the weak point"
        : "Needs repair before offer-level underwriting";
  const decisionCopy =
    decisionConcerns[0] ??
    "The model clears the first-pass cashflow, coverage, and capital-stack checks. Stress rents, expenses, and lender terms below before treating it as investable.";
  const yearOneRoiFormula = hasStabilizationBridge
    ? "Year 1 ROI = (Cash profit + Debt paydown + Appreciation + Stabilization lift) / Equity required"
    : "Year 1 ROI = (Cash profit + Debt paydown + Appreciation) / Equity required";
  const totalYearOneFormula = hasStabilizationBridge
    ? "Total Year 1 return = Cash profit + Debt paydown + Appreciation + Stabilization lift"
    : "Total Year 1 return = Cash profit + Debt paydown + Appreciation";
  const reviewMapItems: PlaybookReviewMapItem[] = [
    {
      href: "#playbook-decision",
      label: "Decision",
      detail:
        decisionConcerns.length === 0
          ? "No first-pass flags"
          : `${decisionConcerns.length} ${decisionConcerns.length === 1 ? "flag" : "flags"} to verify`,
    },
    {
      href: "#playbook-assumptions",
      label: "Assumptions",
      detail: "Rents, debt, expenses",
    },
    {
      href: "#playbook-outcome",
      label: "Outcome",
      detail: `NOI ${currency(modeledResult.noi)} / DSCR ${number(modeledResult.dscr)}`,
    },
    ...(showBridgeFacility
      ? [
          {
            href: "#playbook-bridge",
            label: "Bridge/takeout",
            detail:
              refiSurplusShortfall != null
                ? `Takeout gap ${currency(refiSurplusShortfall)}`
                : bridgeEnabled
                  ? "Bridge enabled"
                  : "Bridge off",
          },
        ]
      : []),
    ...(bridgeEnabled
      ? [
          {
            href: "#playbook-y1-return",
            label: "Y1 return",
            detail: `${currency(returnBridge.totalYearOneReturn)} / ${percent(returnBridge.totalYearOneRoiPct)}`,
          },
        ]
      : []),
    {
      href: "#playbook-cashflow",
      label: "Cashflow",
      detail: `Y1 ${currency(yearOneAnnualCashflow)} / 3Y ${currency(firstThreeCashflow)}`,
    },
    {
      href: "#playbook-hold-return",
      label: "Hold return",
      detail: percent(returnBridge.holdPeriodRoiPct),
    },
    ...(model.mliSelectAnalysis
      ? [
          {
            href: "#playbook-mli",
            label: "MLI Select",
            detail: `${number(model.mliSelectAnalysis.totalPoints)} points`,
          },
        ]
      : []),
    {
      href: "#playbook-risks",
      label: "Risks",
      detail: "Basis, execution, financing",
    },
  ];
  const overrideSummary = getModelOverrideSummary({
    assumptions,
    originalAssumptions: model.assumptions,
    modeledRentPerUnit,
    originalModeledRentPerUnit: model.modeledRentPerUnit,
    unitRentSchedule,
    originalUnitRentSchedule: model.unitRentSchedule,
    bridgeEnabled,
    originalBridgeEnabled: model.requiresBridgeLoan,
  });
  const firstModelLever = getFirstModelLever({
    decisionTone,
    yearOneAnnualCashflow,
    modeledResult,
    refiSurplusShortfall,
    decisionConcerns,
    bridgeEnabled,
  });
  const modelControlItems: ModelControlItem[] = [
    {
      label: "First lever",
      value: firstModelLever.value,
      detail: firstModelLever.detail,
      href: firstModelLever.href,
      action: firstModelLever.action,
      tone: firstModelLever.tone,
    },
    {
      label: "Changed inputs",
      value: `${overrideSummary.count} override${overrideSummary.count === 1 ? "" : "s"}`,
      detail:
        overrideSummary.count > 0
          ? overrideSummary.labels.slice(0, 4).join(", ")
          : "Model is using source/profile assumptions.",
      href: "#playbook-assumptions",
      action: overrideSummary.count > 0 ? "Review overrides" : "Edit assumptions",
      tone: overrideSummary.count > 0 ? "amber" : "green",
    },
    {
      label: "Lender screen",
      value: `${number(modeledResult.dscr)}x DSCR`,
      detail:
        modeledResult.dscr >= 1.25
          ? `${percent(effectivePermanentLtv * 100)} LTV clears the common 1.25x DSCR read.`
          : `Below the common 1.25x DSCR screen; check rent, expenses, rate, and leverage.`,
      href: "#playbook-assumptions",
      action: "Tune debt terms",
      tone: modeledResult.dscr >= 1.25 ? "green" : modeledResult.dscr >= 1 ? "amber" : "red",
    },
    {
      label: "Return read",
      value: modeledResult.cashOnCashReturn != null ? percent(modeledResult.cashOnCashReturn) : "n/a",
      detail: `${currency(yearOneAnnualCashflow)} Y1 cashflow · ${currency(firstThreeCashflow)} 3Y cashflow`,
      href: "#playbook-cashflow",
      action: "View cashflow",
      tone:
        yearOneAnnualCashflow >= 0 && (modeledResult.cashOnCashReturn ?? 0) >= 0
          ? "green"
          : "red",
    },
    {
      label: bridgeEnabled ? "Takeout path" : "Debt path",
      value:
        refiSurplusShortfall != null
          ? currency(refiSurplusShortfall)
          : bridgeEnabled
            ? "Bridge active"
            : "Permanent debt",
      detail:
        refiSurplusShortfall != null
          ? "Positive means modeled takeout surplus; negative means the refi does not repay the bridge."
          : bridgeEnabled
            ? "Bridge terms are active; verify carry and takeout proceeds."
            : "Permanent debt is modeled from day one.",
      href: bridgeEnabled ? "#playbook-bridge" : "#playbook-assumptions",
      action: bridgeEnabled ? "Check bridge" : "Check leverage",
      tone:
        refiSurplusShortfall == null
          ? "blue"
          : refiSurplusShortfall >= 0
            ? "green"
            : "red",
    },
  ];
  const assumptionGuideItems: AssumptionEditGuideItem[] = [
    {
      label: "1. Debt and cash",
      value: `${currency(downPaymentAmount)} down`,
      detail: `${percent(effectivePermanentLtv * 100)} modeled LTV · ${percent(assumptions.mortgageRate.value * 100)} rate. Start here when DSCR or cash required is the blocker.`,
      href: "#playbook-financing",
      tone: downPaymentBelowModeledMinimum ? "amber" : modeledResult.dscr >= 1.25 ? "green" : "red",
    },
    {
      label: "2. Rent roll",
      value: `${currency(modeledRentPerUnit.value)}/unit`,
      detail:
        unitRentSchedule.length > 0
          ? `${unitRentSchedule.length} unit rents feed gross rent, NOI, and the hold-period table.`
          : "This rent input drives gross rent, NOI, cashflow, and CoC.",
      href: "#playbook-rent-inputs",
      tone: yearOneAnnualCashflow >= 0 ? "green" : "amber",
    },
    {
      label: "3. Operating costs",
      value: `${currency(operatingExpenseTotal)}/yr`,
      detail: `${percent(operatingExpenseRatioAssumption.value * 100)} of effective gross income. Property tax and management sit in this schedule.`,
      href: "#playbook-expenses",
      tone: operatingExpenseRatioAssumption.value <= 0.45 ? "green" : "amber",
    },
    {
      label: "4. Hold and exit",
      value: `${Math.round(assumptions.holdPeriodYears.value)} yr hold`,
      detail: `${percent(assumptions.appreciationRateAnnual.value * 100)} appreciation · ${percent(assumptions.closingCostPct.value * 100)} closing costs.`,
      href: "#playbook-exit",
      tone: "blue",
    },
  ];

  const currentMarketRentSection =
    unitRentSchedule.length > 0 ? (
      <UnitRentScheduleRow
        label="Current market rent by unit"
        averageAssumption={assumptions.currentMarketRent}
        unitRents={unitRentSchedule}
        rentKey="currentMarketRent"
        description="Unit-by-unit current market benchmark matched to the inferred bedroom count for each suite, preferring occupied-unit or average-rent data before turnover proxies."
        sourceDetail={assumptions.currentMarketRent.label}
        formula="Average current market rent = Sum of unit market rents / Number of units"
        onChange={(unitIndex, value) => {
          setUnitRentSchedule((prev) => {
            const next = prev.map((unit, index) =>
              {
                if (index !== unitIndex) return unit;
                const nextRent = {
                  ...unit.currentMarketRent,
                  value: Math.max(0, value),
                  source: "user_override" as const,
                  label: "User override",
                };

                return {
                  ...unit,
                  currentMarketRent: nextRent,
                  modeledRent: currentRentDrivesProjection
                    ? {
                        ...unit.modeledRent,
                        value: nextRent.value,
                        source: "user_override" as const,
                        label: "User override",
                      }
                    : unit.modeledRent,
                };
              }
            );
            onOverrideAssumption("currentMarketRent", averageUnitRent(next, "currentMarketRent"));
            if (currentRentDrivesProjection) {
              setModeledRentPerUnit({
                ...modeledRentPerUnit,
                value: averageUnitRent(next, "modeledRent"),
                source: "user_override",
                label: "User override",
              });
            }
            return next;
          });
        }}
        onReset={() => {
          setUnitRentSchedule((prev) => {
            const next = prev.map((unit, index) => ({
              ...unit,
              currentMarketRent: model.unitRentSchedule[index]?.currentMarketRent ?? unit.currentMarketRent,
              modeledRent:
                currentRentDrivesProjection
                  ? model.unitRentSchedule[index]?.modeledRent ?? unit.modeledRent
                  : unit.modeledRent,
            }));
            if (currentRentDrivesProjection) setModeledRentPerUnit(model.modeledRentPerUnit);
            return next;
          });
          setAssumptions((prev) => ({ ...prev, currentMarketRent: model.assumptions.currentMarketRent }));
        }}
      />
    ) : (
      <EditableAssumptionRow
        label="Current market rent"
        assumption={assumptions.currentMarketRent}
        description="Reference current rent benchmark used for context and underwriting calibration."
        sourceDetail={assumptions.currentMarketRent.label}
        formula="Benchmark input from listing or market data (no direct formula)"
        format="currency"
        min={0}
        step={25}
        onChange={(value) => {
          const nextRent = Math.max(0, value);
          onOverrideAssumption("currentMarketRent", nextRent);
          if (currentRentDrivesProjection) {
            setModeledRentPerUnit({
              ...modeledRentPerUnit,
              value: nextRent,
              source: "user_override",
              label: "User override",
            });
          }
        }}
        onReset={() => {
          setAssumptions((prev) => ({ ...prev, currentMarketRent: model.assumptions.currentMarketRent }));
          if (currentRentDrivesProjection) setModeledRentPerUnit(model.modeledRentPerUnit);
        }}
      />
    );

  const turnoverMarketRentSection =
    unitRentSchedule.length > 0 ? (
      <UnitRentScheduleRow
        label={currentRentDrivesProjection ? "Underwriting rent by unit" : "Market rent on turnover"}
        averageAssumption={modeledRentPerUnit}
        unitRents={unitRentSchedule}
        rentKey="modeledRent"
        description={modeledRentDescription(model)}
        sourceDetail={modeledRentSourceDetail(model, modeledRentPerUnit, assumptions)}
        formula={
          currentRentDrivesProjection
            ? "Underwriting rent = Sum of current unit rents / Number of units"
            : "Market rent on turnover = Sum of unit turnover rents / Number of units"
        }
        onChange={(unitIndex, value) => {
          setUnitRentSchedule((prev) => {
            const next = prev.map((unit, index) =>
              index === unitIndex
                ? {
                    ...unit,
                    modeledRent: {
                      ...unit.modeledRent,
                      value: Math.max(0, value),
                      source: "user_override" as const,
                      label: "User override",
                    },
                  }
                : unit
            );
            setModeledRentPerUnit({
              ...modeledRentPerUnit,
              value: averageUnitRent(next, "modeledRent"),
              source: "user_override",
              label: "User override",
            });
            return next;
          });
        }}
        onReset={() => {
          setUnitRentSchedule((prev) =>
            prev.map((unit, index) => ({
              ...unit,
              modeledRent: model.unitRentSchedule[index]?.modeledRent ?? unit.modeledRent,
            }))
          );
          setModeledRentPerUnit(model.modeledRentPerUnit);
        }}
      />
    ) : (
      <EditableAssumptionRow
        label={currentRentDrivesProjection ? "Underwriting rent" : "Market rent on turnover"}
        assumption={modeledRentPerUnit}
        description={modeledRentDescription(model)}
        sourceDetail={modeledRentSourceDetail(model, modeledRentPerUnit, assumptions)}
        formula="No direct calculation. This is the underwriting rent input used in projections."
        format="currency"
        min={0}
        step={25}
        onChange={(value) =>
          setModeledRentPerUnit({
            ...modeledRentPerUnit,
            value: Math.max(0, value),
            source: "user_override",
            label: "User override",
          })
        }
        onReset={() => setModeledRentPerUnit(model.modeledRentPerUnit)}
      />
    );

  const onOverrideAssumption = (
    key: Exclude<keyof ScenarioAssumptions, "operatingExpenses">,
    value: number
  ) => {
    setAssumptions((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        value,
        source: "user_override",
        label: "User override",
      },
    }));
  };

  const onOverrideOperatingExpense = (
    itemKey: OperatingExpenseLineItem["key"],
    mode: OperatingExpenseInputMode,
    inputValue: number
  ) => {
    setAssumptions((prev) => ({
      ...prev,
      operatingExpenses: prev.operatingExpenses.map((item) =>
        item.key === itemKey
          ? overrideOperatingExpenseInput(
              item,
              mode,
              inputValue,
              modeledResult.effectiveGrossIncome,
              basePrice
            )
          : item
      ),
    }));
  };

  const onChangeOperatingExpenseMode = (
    itemKey: OperatingExpenseLineItem["key"],
    mode: OperatingExpenseInputMode
  ) => {
    setAssumptions((prev) => ({
      ...prev,
      operatingExpenses: prev.operatingExpenses.map((item) =>
        item.key === itemKey
          ? switchOperatingExpenseInputMode(
              item,
              mode,
              modeledResult.effectiveGrossIncome,
              basePrice
            )
          : item
      ),
    }));
  };

  const onAddOperatingExpense = () => {
    const trimmedLabel = newExpenseLabel.trim();
    if (!trimmedLabel) return;

    setAssumptions((prev) => ({
      ...prev,
      operatingExpenses: [
        ...prev.operatingExpenses,
        createCustomOperatingExpense({
          label: trimmedLabel,
          inputMode: newExpenseMode,
          effectiveGrossIncome: modeledResult.effectiveGrossIncome,
          purchasePrice: basePrice,
        }),
      ],
    }));
    setNewExpenseLabel("");
    setNewExpenseMode("annual");
    setOperatingExpensesExpanded(true);
  };

  const onChangeDownPayment = (mode: DownPaymentInputMode, inputValue: number) => {
    const sanitizedValue = Math.max(0, inputValue);
    const requestedDownPaymentAmount =
      mode === "amount"
        ? sanitizedValue
        : basePrice * sanitizedValue;
    const nextDownPaymentAmount = roundTo(
      clamp(requestedDownPaymentAmount, 0, financedBasis),
      2
    );
    const nextDownPaymentPct = basePrice > 0 ? clamp(nextDownPaymentAmount / basePrice, 0, 1) : 0;
    const nextLtvPct = financedBasis > 0 ? clamp(1 - nextDownPaymentAmount / financedBasis, 0, 1) : 0;
    const belowModeledMinimum = nextDownPaymentAmount + 0.01 < effectiveMinimumDownPaymentAmount;

    setAssumptions((prev) => ({
      ...prev,
      ltvPct: {
        ...prev.ltvPct,
        value: nextLtvPct,
        source: "user_override",
        label: `Source: User override. Calculation: ${currency(nextDownPaymentAmount)} cash equity on ${currency(basePrice)} purchase price = ${percent(nextDownPaymentPct * 100)} down payment, which implies ${percent(nextLtvPct * 100)} LTV on ${currency(financedBasis)} debt sizing basis. Modeled program minimum = ${currency(effectiveMinimumDownPaymentAmount)} under ${downPaymentRule.programName}.${belowModeledMinimum ? " This is below the modeled rule and should be treated as a lender-exception scenario." : ""}`,
      },
    }));
  };

  const onChangeTakeoutLtv = (value: number) => {
    const nextTakeoutLtv = clamp(value, 0, maxAllowedLtv);
    const nextTakeoutProceeds = roundTo(financedBasis * nextTakeoutLtv, 2);

    setAssumptions((prev) => ({
      ...prev,
      takeoutLtvPct: {
        ...prev.takeoutLtvPct,
        value: nextTakeoutLtv,
        source: "user_override",
        label: `Source: User override. Calculation: ${currency(financedBasis)} debt sizing basis × ${percent(nextTakeoutLtv * 100)} takeout LTV = ${currency(nextTakeoutProceeds)} takeout proceeds.`,
      },
    }));
  };

  const onChangeBridgeAdvance = (mode: BridgeAdvanceInputMode, inputValue: number) => {
    const sanitizedValue = Math.max(0, inputValue);
    const rawAdvancePct =
      mode === "amount"
        ? financedBasis > 0
          ? sanitizedValue / financedBasis
          : 0
        : sanitizedValue;
    const nextAdvancePct = clamp(rawAdvancePct, 0, 0.95);
    const nextAdvanceAmount = roundTo(financedBasis * nextAdvancePct, 2);

    setAssumptions((prev) => ({
      ...prev,
      bridgeAdvancePct: {
        ...prev.bridgeAdvancePct,
        value: nextAdvancePct,
        source: "user_override",
        label: `Source: User override. Calculation: ${currency(financedBasis)} bridge basis × ${percent(nextAdvancePct * 100)} advance = ${currency(nextAdvanceAmount)} bridge principal advance.`,
      },
    }));
  };

  return (
    <div className="min-w-0 max-w-full space-y-8">
      <PlaybookReviewMap items={reviewMapItems} />

      <section id="playbook-decision" className="scroll-mt-24 rounded-xl border border-slate-200 bg-slate-50/60 p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 max-w-3xl">
            <p className="text-sm leading-6 text-slate-700">{model.overview}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Tag>{UNDERWRITING_LABELS[model.underwritingMode]}</Tag>
              {showModeledUnits && <Tag>{model.modeledUnits.value} modeled units</Tag>}
              <Tag>{model.modeledRentBasisLabel}</Tag>
              <Tag>{bridgeCategory.tagLabel}</Tag>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[260px] xl:grid-cols-1">
            <MetricCard
              label="Total capitalization"
              value={currency(modeledResult.totalCost)}
              description={
                showCapexMetrics
                  ? "All-in basis required to close and execute the strategy."
                  : "Total cash basis required to close the acquisition."
              }
              formula={
                showCapexMetrics
                  ? "Total capitalization = Purchase price + Capex budget + Closing costs"
                  : "Total capitalization = Purchase price + Closing costs"
              }
            />
            <MetricCard
              label="Equity required"
              value={currency(modeledResult.equityRequired)}
              description="Cash equity needed from the investor after debt proceeds."
              formula="Equity required = Total capitalization - Loan amount"
            />
            <MetricCard
              label="Year 1 ROI"
              value={percent(returnBridge.totalYearOneRoiPct)}
              description="Year-one return on invested equity, including carry and equity creation."
              formula={yearOneRoiFormula}
            />
          </div>
        </div>
        <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-700">
                Investor decision snapshot
              </p>
              <h4 className="mt-1 text-lg font-semibold text-slate-950">{decisionHeadline}</h4>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{decisionCopy}</p>
            </div>
            <span className={`w-fit rounded-full border px-3 py-1.5 text-xs font-semibold ${decisionBadgeClass(decisionTone)}`}>
              {decisionConcerns.length === 0
                ? "No first-pass flags"
                : `${decisionConcerns.length} ${decisionConcerns.length === 1 ? "flag" : "flags"}`}
            </span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <DecisionSnapshotCard
              label="Year 1 cashflow"
              value={currency(yearOneAnnualCashflow)}
              detail={`${currency(yearOneMonthlyCashflow)}/mo after debt`}
              tone={yearOneAnnualCashflow >= 0 ? "green" : "red"}
            />
            <DecisionSnapshotCard
              label="DSCR"
              value={number(modeledResult.dscr)}
              detail={modeledResult.dscr >= 1.25 ? "Above common 1.25x screen" : "Below common 1.25x screen"}
              tone={modeledResult.dscr >= 1.25 ? "green" : modeledResult.dscr >= 1 ? "amber" : "red"}
            />
            <DecisionSnapshotCard
              label="CoC return"
              value={modeledResult.cashOnCashReturn != null ? percent(modeledResult.cashOnCashReturn) : "n/a"}
              detail="Annual cashflow / equity required"
              tone={
                modeledResult.cashOnCashReturn == null
                  ? "slate"
                  : modeledResult.cashOnCashReturn >= 0
                    ? "green"
                    : "red"
              }
            />
            <DecisionSnapshotCard
              label={`${firstThreeCashflowYears.length}-year cashflow`}
              value={currency(firstThreeCashflow)}
              detail="Cumulative operating carry"
              tone={firstThreeCashflow >= 0 ? "green" : "red"}
            />
            <DecisionSnapshotCard
              label={refiSurplusShortfall != null ? "Takeout gap" : "Debt path"}
              value={
                refiSurplusShortfall != null
                  ? currency(refiSurplusShortfall)
                  : `${percent(effectivePermanentLtv * 100)} LTV`
              }
              detail={
                refiSurplusShortfall != null
                  ? "Positive means modeled takeout surplus"
                  : bridgeEnabled
                    ? "Bridge off or takeout not sized"
                    : "Permanent debt from day one"
              }
              tone={
                refiSurplusShortfall == null
                  ? "blue"
                  : refiSurplusShortfall >= 0
                    ? "green"
                    : "red"
              }
            />
          </div>
        </div>
        <div className="mt-5">
          <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Best-fit listing types
          </h4>
          <div className="mt-3 flex flex-wrap gap-2">
            {model.targetPropertyTypes.map((propertyType) => (
              <Tag key={propertyType}>{propertyType}</Tag>
            ))}
          </div>
        </div>
      </section>

      <section id="playbook-path" className="scroll-mt-24">
        <h4 className="mb-3 text-sm font-semibold text-slate-700">Playbook for this path</h4>
        <div className="grid gap-3 lg:grid-cols-3">
          {model.strategyVariants.map((variant) => (
            <div key={variant.name} className={SURFACE_CARD_CLASS}>
              <p className="font-medium text-slate-900">{variant.name}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{variant.description}</p>
              <p className="mt-3 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                Property types
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {variant.propertyTypes.map((propertyType) => (
                  <Tag key={propertyType}>{propertyType}</Tag>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="playbook-assumptions" className="scroll-mt-24">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h4 className="text-sm font-semibold text-slate-700">Modeled assumptions</h4>
          <button
            type="button"
            onClick={() => {
              setModeledRentPerUnit(model.modeledRentPerUnit);
              setAssumptions(model.assumptions);
              setUnitRentSchedule(model.unitRentSchedule);
              setNewExpenseLabel("");
              setNewExpenseMode("annual");
              setDownPaymentInputMode("percent");
              setBridgeAdvanceInputMode("percent");
              setBridgeEnabled(model.requiresBridgeLoan);
            }}
            className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Reset all assumptions
          </button>
        </div>
        <ModelControlSummary items={modelControlItems} overrideSummary={overrideSummary} />
        <AssumptionEditGuide items={assumptionGuideItems} />
        <div className="space-y-5 rounded-xl border border-slate-200 bg-slate-50/60 p-5">
          {showModeledUnits && (
            <StaticAssumptionRow
              label="Modeled units"
              assumption={model.modeledUnits}
              description="Total rentable units used in the underwriting math."
              sourceDetail={model.modeledUnits.label}
              formula="Modeled units = Inferred or listed rentable unit count used in underwriting"
            />
          )}
          <div id="playbook-financing" className="scroll-mt-24 grid min-w-0 items-stretch gap-5 2xl:grid-cols-[minmax(0,1.08fr)_minmax(0,1.2fr)]">
            <div className="flex h-full flex-col gap-4">
              <SectionEyebrow>Financing structure</SectionEyebrow>
              {bridgeEnabled ? (
                <TakeoutLeverageAssumptionRow
                  className="flex-1"
                  assumption={{
                    ...assumptions.takeoutLtvPct,
                    value: constrainedTakeoutLtv,
                  }}
                  totalBasis={financedBasis}
                  takeoutProceeds={modeledResult.loanAmount}
                  equitySlice={takeoutEquityAmount}
                  maxTakeoutLtvPct={maxAllowedLtv}
                  ruleLabel={downPaymentRule.label}
                  onChange={onChangeTakeoutLtv}
                  onReset={() => {
                    setAssumptions((prev) => ({ ...prev, takeoutLtvPct: model.assumptions.takeoutLtvPct }));
                  }}
                />
              ) : (
                <DownPaymentAssumptionRow
                  className="flex-1"
                  assumption={{
                    ...assumptions.ltvPct,
                    value: requestedLtv,
                  }}
                  totalBasis={financedBasis}
                  purchasePrice={basePrice}
                  downPaymentPct={downPaymentPct}
                  downPaymentAmount={downPaymentAmount}
                  minDownPaymentPct={downPaymentRule.minDownPaymentPct}
                  minDownPaymentAmount={effectiveMinimumDownPaymentAmount}
                  belowModeledMinimum={downPaymentBelowModeledMinimum}
                  inputMode={downPaymentInputMode}
                  ruleLabel={downPaymentRule.label}
                  onChangeMode={setDownPaymentInputMode}
                  onChange={onChangeDownPayment}
                  onReset={() => {
                    setAssumptions((prev) => ({ ...prev, ltvPct: model.assumptions.ltvPct }));
                    setDownPaymentInputMode("percent");
                  }}
                />
              )}
            </div>
            <div className="flex h-full flex-col gap-4">
              <SectionEyebrow>Debt and market outlook</SectionEyebrow>
              <div className={`${SUBTLE_PANEL_CLASS} flex flex-1 flex-col gap-4`}>
                <div className="space-y-3">
                  <SubsectionLabel>Debt terms</SubsectionLabel>
                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="min-w-0 xl:min-w-[280px]">
                      <EditableAssumptionRow
                        label="Mortgage rate"
                        testId="assumption-row-mortgage-rate"
                        assumption={assumptions.mortgageRate}
                        description="Annual interest rate used for annual debt service and amortization curve."
                        sourceDetail={assumptions.mortgageRate.label}
                        formula="No direct calculation. This is the lender-pricing or underwriting rate assumption."
                        format="percent"
                        min={0}
                        max={20}
                        step={0.1}
                        onChange={(value) => onOverrideAssumption("mortgageRate", clamp(value, 0, 0.2))}
                        onReset={() => setAssumptions((prev) => ({ ...prev, mortgageRate: model.assumptions.mortgageRate }))}
                      />
                    </div>
                    <div className="min-w-0 xl:min-w-[280px]">
                      <EditableAssumptionRow
                        label="Amortization"
                        assumption={assumptions.amortizationYears}
                        description="Years used to amortize loan principal."
                        sourceDetail={assumptions.amortizationYears.label}
                        formula="No direct calculation. This is the financing-term assumption capped by program rules."
                        format="years"
                        min={1}
                        max={60}
                        step={1}
                        onChange={(value) => onOverrideAssumption("amortizationYears", Math.max(1, Math.round(value)))}
                        onReset={() => setAssumptions((prev) => ({ ...prev, amortizationYears: model.assumptions.amortizationYears }))}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <SubsectionLabel>Market outlook</SubsectionLabel>
                  <div className="grid gap-4 xl:grid-cols-2">
                    <EditableAssumptionRow
                      label="Rent growth (YoY)"
                      assumption={assumptions.rentGrowthRateAnnual}
                      description="Annual market rent growth applied to the year-by-year cashflow outlook after the year-one underwriting rent is set."
                      sourceDetail={assumptions.rentGrowthRateAnnual.label}
                      formula="No direct calculation. This is the annual rent-growth assumption applied to projected rents."
                      format="percent"
                      min={-5}
                      max={20}
                      step={0.1}
                      onChange={(value) => onOverrideAssumption("rentGrowthRateAnnual", clamp(value, -0.05, 0.2))}
                      onReset={() => setAssumptions((prev) => ({ ...prev, rentGrowthRateAnnual: model.assumptions.rentGrowthRateAnnual }))}
                    />
                    <EditableAssumptionRow
                      label="Appreciation rate"
                      assumption={assumptions.appreciationRateAnnual}
                      description="Annual market growth used for value projection."
                      sourceDetail={assumptions.appreciationRateAnnual.label}
                      formula="No direct calculation. This is the annual appreciation assumption applied to projected value."
                      format="percent"
                      min={0}
                      max={20}
                      step={0.1}
                      onChange={(value) => onOverrideAssumption("appreciationRateAnnual", clamp(value, 0, 0.2))}
                      onReset={() => setAssumptions((prev) => ({ ...prev, appreciationRateAnnual: model.assumptions.appreciationRateAnnual }))}
                    />
                  </div>
                  <EditableAssumptionRow
                    label="Vacancy rate"
                    assumption={assumptions.vacancyRate}
                    description="Base market vacancy from CMHC for this listing. It stays tied to the market benchmark; strategy execution risk should be modeled separately."
                    sourceDetail={assumptions.vacancyRate.label}
                    formula="No direct calculation. This is the market-vacancy assumption applied to gross scheduled rent."
                    format="percent"
                    min={0}
                    max={25}
                    step={0.1}
                    onChange={(value) => onOverrideAssumption("vacancyRate", clamp(value, 0, 0.25))}
                    onReset={() => setAssumptions((prev) => ({ ...prev, vacancyRate: model.assumptions.vacancyRate }))}
                  />
                </div>
              </div>
            </div>
          </div>

          <div id="playbook-rent-inputs" className="scroll-mt-24">
            <AssumptionCluster title="Rent benchmarks">
              <div className="grid gap-4 xl:grid-cols-2">
                {currentMarketRentSection}
                {turnoverMarketRentSection}
              </div>
            </AssumptionCluster>
          </div>

          <div id="playbook-expenses" className="scroll-mt-24 space-y-3">
            <SectionEyebrow>Operating costs</SectionEyebrow>
            <OperatingExpenseSection
              ratioAssumption={operatingExpenseRatioAssumption}
              operatingExpenseTotal={operatingExpenseTotal}
              items={assumptions.operatingExpenses}
              effectiveGrossIncome={modeledResult.effectiveGrossIncome}
              purchasePrice={basePrice}
              expanded={operatingExpensesExpanded}
              newExpenseLabel={newExpenseLabel}
              newExpenseMode={newExpenseMode}
              onNewExpenseLabelChange={setNewExpenseLabel}
              onNewExpenseModeChange={setNewExpenseMode}
              onAddExpense={onAddOperatingExpense}
              onToggleExpanded={() => setOperatingExpensesExpanded((prev) => !prev)}
              onChange={onOverrideOperatingExpense}
              onChangeMode={onChangeOperatingExpenseMode}
              onRemoveItem={(itemKey) =>
                setAssumptions((prev) => ({
                  ...prev,
                  operatingExpenses: prev.operatingExpenses.filter((item) => item.key !== itemKey),
                }))
              }
              onResetItem={(itemKey) =>
                setAssumptions((prev) => ({
                  ...prev,
                  operatingExpenses: prev.operatingExpenses.map((item) =>
                    item.key === itemKey
                      ? model.assumptions.operatingExpenses.find((original) => original.key === itemKey) ?? item
                      : item
                  ),
                }))
              }
              onResetAll={() => {
                setAssumptions((prev) => ({
                  ...prev,
                  operatingExpenses: model.assumptions.operatingExpenses,
                }));
                setNewExpenseLabel("");
                setNewExpenseMode("annual");
              }}
            />
          </div>

          <div id="playbook-exit" className="scroll-mt-24 space-y-3">
            <SectionEyebrow>Risk and exit assumptions</SectionEyebrow>
            <div className="grid gap-5 xl:grid-cols-2">
              <AssumptionCluster title="Hold and exit timing">
                <div className="grid gap-4 xl:grid-cols-2">
                  <EditableAssumptionRow
                    label="Hold period"
                    assumption={assumptions.holdPeriodYears}
                    description="Duration used for projected equity and total ROI."
                    sourceDetail={assumptions.holdPeriodYears.label}
                    formula="No direct calculation. This is the ownership-duration assumption used in projections."
                    format="years"
                    min={1}
                    max={30}
                    step={1}
                    onChange={(value) => onOverrideAssumption("holdPeriodYears", Math.max(1, Math.round(value)))}
                    onReset={() => setAssumptions((prev) => ({ ...prev, holdPeriodYears: model.assumptions.holdPeriodYears }))}
                  />
                  <StaticAssumptionRow
                    label="Exit cap rate"
                    assumption={assumptions.exitCapRate}
                    description="Derived implied cap rate based on modeled stabilized NOI and purchase price proxy."
                    sourceDetail={assumptions.exitCapRate.label}
                    formula="Exit cap rate = Stabilized NOI / Purchase price proxy"
                    format="percent"
                  />
                </div>
              </AssumptionCluster>
              <AssumptionCluster title="Transaction costs">
                <div className="grid gap-4 xl:grid-cols-2">
                  <EditableAssumptionRow
                    label="Closing cost %"
                    assumption={assumptions.closingCostPct}
                    description="Transaction cost loading applied on purchase price."
                    sourceDetail={assumptions.closingCostPct.label}
                    formula="Closing cost % = Closing costs / Purchase price"
                    format="percent"
                    min={0}
                    max={15}
                    step={0.1}
                    onChange={(value) => onOverrideAssumption("closingCostPct", clamp(value, 0, 0.15))}
                    onReset={() => setAssumptions((prev) => ({ ...prev, closingCostPct: model.assumptions.closingCostPct }))}
                  />
                </div>
              </AssumptionCluster>
            </div>
            {showRenoCostPerSqFt && (
              <AssumptionCluster title="Execution budget">
                <div className="grid gap-4 xl:grid-cols-2">
                  <EditableAssumptionRow
                    label="Reno / construction cost per sq ft"
                    assumption={assumptions.renoCostPerSqFt}
                    description="Capex intensity used to size budget from the modeled area."
                    sourceDetail={assumptions.renoCostPerSqFt.label}
                    formula={`Reno / construction cost per sq ft = Capex budget / ${targetAreaSqFt?.toLocaleString("en-CA") ?? "Target area"}`}
                    format="currency"
                    min={0}
                    step={5}
                    onChange={(value) => onOverrideAssumption("renoCostPerSqFt", Math.max(0, value))}
                    onReset={() => setAssumptions((prev) => ({ ...prev, renoCostPerSqFt: model.assumptions.renoCostPerSqFt }))}
                  />
                </div>
              </AssumptionCluster>
            )}
          </div>
        </div>
      </section>

      <section id="playbook-outcome" className="scroll-mt-24">
        <h4 className="mb-3 text-sm font-semibold text-slate-700">Modeled outcome</h4>
        <CashflowFormulaBridge
          steps={rentToCashflowSteps}
          annualCashflow={yearOneAnnualCashflow}
          monthlyCashflow={yearOneMonthlyCashflow}
          dscr={modeledResult.dscr}
          cashOnCashReturn={modeledResult.cashOnCashReturn}
        />
        <div className="playbook-outcome-priority-grid grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            label="Gross scheduled rent"
            value={`${currency(modeledResult.grossScheduledRent)}/yr`}
            description="Total scheduled annual rent before vacancy and bad debt."
            formula="Gross scheduled rent = Units × Rent per unit × 12"
          />
          <MetricCard
            label="NOI"
            value={`${currency(modeledResult.noi)}/yr`}
            description="Net operating income before debt service."
            formula="NOI = EGI - Operating expenses"
          />
          <MetricCard
            label="Annual debt service"
            value={`${currency(modeledResult.annualDebtService)}/yr`}
            description="Total annual principal and interest payment."
            formula="Debt service = Annualized mortgage payment from loan amount, rate, and amortization"
          />
          <MetricCard
            label="Annual cashflow"
            value={currency(modeledResult.annualCashflow)}
            description="Pre-tax cashflow after operating costs and debt service."
            formula="Annual cashflow = NOI - Annual debt service"
          />
          <MetricCard
            label="Monthly cashflow"
            value={currency(modeledResult.monthlyCashflow)}
            description="Average monthly carry based on annual cashflow."
            formula="Monthly cashflow = Annual cashflow / 12"
          />
          <MetricCard
            label="DSCR"
            value={number(modeledResult.dscr)}
            description="Debt coverage ratio used by lenders for credit risk."
            formula="DSCR = NOI / Annual debt service"
          />
          <MetricCard
            label="Cash-on-cash return"
            value={modeledResult.cashOnCashReturn != null ? percent(modeledResult.cashOnCashReturn) : "n/a"}
            description="Year-one cash return relative to equity invested."
            formula="Cash-on-cash = Annual cashflow / Equity required"
          />
        </div>

        <section
          className="playbook-outcome-detail-disclosure mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white"
          aria-label="Detailed outcome audit"
          data-open={outcomeDetailsOpen ? "true" : "false"}
        >
          <button
            type="button"
            className="playbook-outcome-detail-summary flex w-full cursor-pointer flex-col gap-3 p-4 text-left md:flex-row md:items-center md:justify-between"
            aria-expanded={outcomeDetailsOpen}
            aria-controls="playbook-outcome-detail-grid"
            onClick={() => setOutcomeDetailsOpen((open) => !open)}
          >
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Detailed outcome audit
              </p>
              <h5 className="mt-1 text-sm font-semibold text-slate-950">
                Show valuation, basis, expense, and exit math
              </h5>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                Keep the operating decision readable, then open this when you want the full underwriting trace behind cap rate, basis, closing costs, and exit ROI.
              </p>
            </div>
            <span className="w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
              {outcomeDetailsOpen ? "Hide detail metrics" : "Show detail metrics"}
            </span>
          </button>
          {outcomeDetailsOpen && (
          <div
            id="playbook-outcome-detail-grid"
            className="playbook-outcome-detail-grid grid gap-3 border-t border-slate-200 bg-slate-50/60 p-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            <MetricCard
              label="Effective gross income"
              value={`${currency(modeledResult.effectiveGrossIncome)}/yr`}
              description="Revenue after vacancy assumptions and plus other income."
              formula="Effective gross income = Gross scheduled rent × (1 - Vacancy rate) + Other income"
            />
            <MetricCard
              label="Operating expenses"
              value={`${currency(modeledResult.operatingExpenses)}/yr`}
              description="Total annual operating expenses from the schedule below, including property tax and management."
              formula="Operating expenses = Sum of all annual operating expense line items"
            />
            <MetricCard
              label="Monthly cashflow"
              value={currency(modeledResult.monthlyCashflow)}
              description="Average monthly carry based on annual cashflow."
              formula="Monthly cashflow = Annual cashflow / 12"
            />
            <MetricCard
              label="Cap rate"
              value={percent(modeledResult.capRate * 100)}
              description={
                showCapexMetrics
                  ? "Unlevered operating yield on all-in basis."
                  : "Unlevered operating yield on purchase price."
              }
              formula={showCapexMetrics ? "Cap rate = NOI / All-in basis" : "Cap rate = NOI / Purchase price"}
            />
            {showCapexMetrics && (
              <MetricCard
                label="All-in basis"
                value={currency(modeledResult.basisPrice)}
                description="Total basis before closing costs."
                formula="All-in basis = Purchase price + Capex budget"
              />
            )}
            {showCapexMetrics && (
              <MetricCard
                label="Capex budget"
                value={currency(capexBudget)}
                description="Execution budget required for repositioning or development."
                formula={targetAreaSqFt != null ? `Capex budget = ${targetAreaSqFt.toLocaleString("en-CA")} sq ft × Reno cost per sq ft` : "Capex budget = Strategy capital plan assumption"}
              />
            )}
            <MetricCard
              label="Closing costs"
              value={currency(modeledResult.closingCosts)}
              description="Acquisition transaction cost estimate."
              formula="Closing costs = Purchase price × Closing cost %"
            />
            <MetricCard
              label="Projected exit value"
              value={currency(returnBridge.projectedValueAtExit)}
              description="Projected value at exit from compounded appreciation."
              formula="Projected exit value = Projection start value × (1 + Appreciation rate)^Hold years"
            />
            <MetricCard
              label="Exit loan balance"
              value={currency(returnBridge.exitLoanBalance)}
              description="Estimated remaining principal at exit."
              formula="Exit loan balance = Mortgage amortization balance after hold period"
            />
            <MetricCard
              label="Hold-period ROI"
              value={percent(returnBridge.holdPeriodRoiPct)}
              description="Total hold-period return on invested equity."
              formula="Hold-period ROI = Hold-period total return / Equity required"
            />
            {modeledStabilizedValue != null && (
              <MetricCard
                label="Stabilized value"
                value={currency(modeledStabilizedValue)}
                description="Purchase price proxy used as the stabilized-value anchor for the implied exit cap calculation."
                formula="Stabilized value = Purchase price proxy"
              />
            )}
          </div>
          )}
        </section>
        {targetAreaSqFt != null && (
          <p className="mt-3 text-xs text-slate-500">
            Capital budget basis: {targetAreaSqFt.toLocaleString("en-CA")} sq ft. {model.capitalPlan.label}
          </p>
        )}
        {targetAreaSqFt == null && model.capitalPlan.label && (
          <p className="mt-3 text-xs text-slate-500">{model.capitalPlan.label}</p>
        )}
      </section>

      {showBridgeFacility && (
        <section id="playbook-bridge" className="scroll-mt-24">
          <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h4 className="text-sm font-semibold text-slate-700">Bridge facility</h4>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {bridgeCategory.description}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <BridgeUsageBadge usage={model.bridgeUsage} />
              <button
                type="button"
                onClick={() => setBridgeEnabled((prev) => !prev)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  bridgeEnabled
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {bridgeEnabled ? "Bridge on" : "Bridge off"}
              </button>
            </div>
          </div>
          {!bridgeEnabled ? (
            <div className={SURFACE_CARD_CLASS}>
              <p className="text-sm font-medium text-slate-900">Bridge financing is currently turned off.</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Year 1–2 cashflow is being modeled with permanent debt from day one. Turn bridge back on if you want the model to use short-term bridge carry first and refinance into permanent debt after the bridge term.
              </p>
            </div>
          ) : bridgeFacility ? (
          <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-5">
            <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.18fr)_minmax(340px,0.82fr)]">
              <AssumptionCluster title="Bridge sizing">
                <div className="space-y-4">
                  <BridgeAdvanceAssumptionRow
                    assumption={assumptions.bridgeAdvancePct}
                    totalBasis={financedBasis}
                    bridgeAmount={bridgeFacility.bridgePrincipalAdvance}
                    inputMode={bridgeAdvanceInputMode}
                    onChangeMode={setBridgeAdvanceInputMode}
                    onChange={onChangeBridgeAdvance}
                    onReset={() => {
                      setAssumptions((prev) => ({ ...prev, bridgeAdvancePct: model.assumptions.bridgeAdvancePct }));
                      setBridgeAdvanceInputMode("percent");
                    }}
                  />
                  <div className="grid gap-4 xl:grid-cols-2">
                    <EditableAssumptionRow
                      label="Bridge rate"
                      assumption={assumptions.bridgeRateAnnual}
                      description="Short-term bridge coupon used to size monthly carry, reserve, and total interest through the bridge term."
                      sourceDetail={assumptions.bridgeRateAnnual.label}
                      formula="No direct calculation. This is the bridge coupon assumption."
                      format="percent"
                      min={0}
                      max={20}
                      step={0.1}
                      onChange={(value) => onOverrideAssumption("bridgeRateAnnual", clamp(value, 0, 0.2))}
                      onReset={() => setAssumptions((prev) => ({ ...prev, bridgeRateAnnual: model.assumptions.bridgeRateAnnual }))}
                    />
                    <EditableAssumptionRow
                      label="Bridge term"
                      assumption={assumptions.bridgeTermMonths}
                      description="Expected months between acquisition funding and refinance or exit payoff."
                      sourceDetail={assumptions.bridgeTermMonths.label}
                      formula="No direct calculation. This is the modeled bridge duration."
                      format="months"
                      min={1}
                      max={36}
                      step={1}
                      onChange={(value) => onOverrideAssumption("bridgeTermMonths", Math.max(1, Math.round(value)))}
                      onReset={() => setAssumptions((prev) => ({ ...prev, bridgeTermMonths: model.assumptions.bridgeTermMonths }))}
                    />
                    <EditableAssumptionRow
                      label="Bridge fee"
                      assumption={assumptions.bridgeFeePct}
                      description="Upfront lender fee applied to the bridge principal advance."
                      sourceDetail={assumptions.bridgeFeePct.label}
                      formula="Bridge fee = Bridge principal advance × Bridge fee %"
                      format="percent"
                      min={0}
                      max={5}
                      step={0.1}
                      onChange={(value) => onOverrideAssumption("bridgeFeePct", clamp(value, 0, 0.05))}
                      onReset={() => setAssumptions((prev) => ({ ...prev, bridgeFeePct: model.assumptions.bridgeFeePct }))}
                    />
                    <EditableAssumptionRow
                      label="Interest reserve"
                      assumption={assumptions.bridgeInterestReserveMonths}
                      description="Months of bridge carry reserved inside the facility sizing to protect early-period cash needs."
                      sourceDetail={assumptions.bridgeInterestReserveMonths.label}
                      formula="Interest reserve = Monthly bridge carry × Reserved months"
                      format="months"
                      min={0}
                      max={24}
                      step={1}
                      onChange={(value) => onOverrideAssumption("bridgeInterestReserveMonths", Math.max(0, Math.round(value)))}
                      onReset={() => setAssumptions((prev) => ({ ...prev, bridgeInterestReserveMonths: model.assumptions.bridgeInterestReserveMonths }))}
                    />
                  </div>
                </div>
              </AssumptionCluster>

              <AssumptionCluster title="Refi decision">
                <div className="space-y-3">
                  <BridgeDecisionCard
                    value={bridgeFacility.refiSurplusShortfall}
                    takeoutProceeds={bridgeFacility.takeoutProceeds}
                    bridgePayoff={bridgeFacility.bridgePayoff}
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <BridgeHeadlineStat
                      label="Takeout proceeds"
                      value={currency(bridgeFacility.takeoutProceeds)}
                      caption="Permanent refinance proceeds sized from the takeout leverage path."
                    />
                    <BridgeHeadlineStat
                      label="Sponsor cash to close"
                      value={currency(bridgeFacility.sponsorCashRequired)}
                      caption="Cash still needed after modeled bridge proceeds."
                    />
                    <BridgeHeadlineStat
                      label="Required facility"
                      value={currency(bridgeFacility.requiredFacility)}
                      caption="Principal advance plus lender fee and reserved carry."
                    />
                    <BridgeHeadlineStat
                      label="Bridge payoff"
                      value={currency(bridgeFacility.bridgePayoff)}
                      caption="Estimated payoff at refinance or sale."
                    />
                  </div>
                </div>
              </AssumptionCluster>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <AssumptionCluster title="Funding map">
                <div className="grid gap-3 sm:grid-cols-2">
                  <BridgeDetailMetric
                    label="Total project uses"
                    value={currency(bridgeFacility.totalProjectUses)}
                    helper="Purchase, closing, capex, fee, and reserve."
                  />
                  <BridgeDetailMetric
                    label="Bridge principal advance"
                    value={currency(bridgeFacility.bridgePrincipalAdvance)}
                    helper="Advance applied against purchase plus capex basis."
                  />
                  <BridgeDetailMetric
                    label="Day-one funding"
                    value={currency(bridgeFacility.dayOneFunding)}
                    helper="Initial draw available at closing."
                  />
                  <BridgeDetailMetric
                    label="Future capex holdback"
                    value={currency(bridgeFacility.futureCapexHoldback)}
                    helper="Held back for later renovation draws."
                  />
                  {bridgeFacility.unfundedCapex > 0 && (
                    <BridgeDetailMetric
                      label="Unfunded capex"
                      value={currency(bridgeFacility.unfundedCapex)}
                      helper="Capex still funded by sponsor equity."
                    />
                  )}
                </div>
              </AssumptionCluster>

              <AssumptionCluster title="Carry and payoff">
                <div className="grid gap-3 sm:grid-cols-2">
                  <BridgeDetailMetric
                    label="Bridge rate"
                    value={percent(bridgeFacility.bridgeRateAnnual * 100)}
                    helper="All-in annual bridge coupon."
                  />
                  <BridgeDetailMetric
                    label="Bridge term"
                    value={`${Math.round(bridgeFacility.bridgeTermMonths)} mo`}
                    helper="Modeled duration to payoff."
                  />
                  <BridgeDetailMetric
                    label="Lender fee"
                    value={currency(bridgeFacility.bridgeFee)}
                    helper="Upfront fee on principal advance."
                  />
                  <BridgeDetailMetric
                    label="Interest reserve"
                    value={currency(bridgeFacility.interestReserve)}
                    helper="Carry reserved inside the facility."
                  />
                  <BridgeDetailMetric
                    label="Monthly bridge carry"
                    value={currency(bridgeFacility.monthlyInterestCarry)}
                    helper="Average monthly interest cost."
                  />
                  <BridgeDetailMetric
                    label="Total bridge interest"
                    value={currency(bridgeFacility.totalBridgeInterest)}
                    helper="Total modeled interest over the term."
                  />
                </div>
              </AssumptionCluster>
            </div>
          </div>
          ) : null}
        </section>
      )}

      {bridgeEnabled && (
        <section id="playbook-y1-return" className="scroll-mt-24">
          <h4 className="mb-3 text-sm font-semibold text-slate-700">Year 1 return stack</h4>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Cash profit"
              value={currency(returnBridge.yearOneCashflow)}
              description="Year-one operating cashflow after debt service."
              formula="Cash profit = Annual cashflow"
            />
            <MetricCard
              label="Debt paydown"
              value={currency(returnBridge.yearOneDebtPaydown)}
              description="Principal repaid in year one."
              formula="Debt paydown = Initial loan balance - Loan balance after year one"
            />
            <MetricCard
              label="Appreciation"
              value={currency(returnBridge.yearOneAppreciation)}
              description="Estimated value growth in year one."
              formula="Year-one appreciation = Value year one - Purchase price"
            />
            {returnBridge.stabilizationLift != null && (
              <MetricCard
                label="Stabilization lift"
                value={currency(returnBridge.stabilizationLift)}
                description="Value creation from improving NOI/cap structure."
                formula="Stabilization lift = Stabilized value - All-in basis"
              />
            )}
            <MetricCard
              label="Total Year 1 return"
              value={currency(returnBridge.totalYearOneReturn)}
              description="Combined year-one return stack."
              formula={totalYearOneFormula}
            />
          </div>
        </section>
      )}

      <section id="playbook-hold-return" className="scroll-mt-24">
        <h4 className="mb-3 text-sm font-semibold text-slate-700">Hold-period return</h4>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            label="Hold-period cashflow"
            value={currency(returnBridge.holdPeriodCashflow)}
            description="Cumulative cashflow generated during hold period."
            formula="Hold-period cashflow = Sum of annual cashflows across the hold period"
          />
          <MetricCard
            label="Projected equity at exit"
            value={currency(returnBridge.holdPeriodProjectedEquity)}
            description="Exit value minus remaining debt."
            formula="Projected equity at exit = Projected exit value - Exit loan balance"
          />
          <MetricCard
            label="Hold-period total return"
            value={currency(returnBridge.holdPeriodTotalReturn)}
            description="Total return including carry and exit equity delta."
            formula="Hold-period total return = Hold-period cashflow + (Projected equity at exit - Equity required)"
          />
        </div>
      </section>

      <section id="playbook-cashflow" className="scroll-mt-24">
        <div className="mb-3">
          <div>
            <h4 className="text-sm font-semibold text-slate-700">Cashflow outlook</h4>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {bridgeEnabled
                ? "Projects annual carry using bridge interest during the bridge term, then switches into permanent debt once the modeled takeout closes."
                : "Projects annual carry using the year-one underwriting rent, then grows rent by the CMHC market growth assumption each year."}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cashflowHighlights.map((year) => (
            <MetricCard
              key={`cashflow-highlight-${year.year}`}
              label={`Year ${year.year} annual cashflow`}
              value={currency(year.annualCashflow)}
              description={`Projected annual cashflow in year ${year.year} after applying the modeled rent-growth path.`}
              formula={
                bridgeEnabled
                  ? `Year ${year.year} annual cashflow = NOI - Bridge carry - Permanent debt service`
                  : `Year ${year.year} annual cashflow = NOI - Annual debt service`
              }
            />
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/70 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-700">
                Rent roll used by this table
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{rentRollBasis.headline}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">{rentRollBasis.detail}</p>
            </div>
            <div className="grid shrink-0 grid-cols-2 gap-2 text-right sm:min-w-[320px]">
              <div className="rounded-lg border border-blue-100 bg-white px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Monthly roll</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{currency(rentRollBasis.monthlyRentRoll)}</p>
              </div>
              <div className="rounded-lg border border-blue-100 bg-white px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Annual gross</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{currency(rentRollBasis.grossScheduledRentAnnual)}</p>
              </div>
            </div>
          </div>
          {rentRollBasis.unitLine && (
            <p className="mt-3 break-words rounded-lg border border-blue-100 bg-white px-3 py-2 font-mono text-[11px] leading-5 text-slate-600">
              {rentRollBasis.unitLine}
            </p>
          )}
        </div>

        <div className="playbook-cashflow-mobile-grid mt-4 grid gap-3 md:hidden">
          {mobileCashflowYears.map((year) => {
            const cashflowTone =
              year.annualCashflow > 0
                ? "border-emerald-200 bg-emerald-50/80 text-emerald-900"
                : year.annualCashflow < 0
                  ? "border-rose-200 bg-rose-50/80 text-rose-900"
                  : "border-slate-200 bg-slate-50 text-slate-900";
            const dscrTone =
              year.dscr >= 1.25
                ? "text-emerald-700"
                : year.dscr >= 1
                  ? "text-amber-700"
                  : "text-rose-700";

            return (
              <article
                key={`cashflow-mobile-year-${year.year}`}
                className={`rounded-xl border p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${cashflowTone}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] opacity-80">
                      Year {year.year} · {cashflowPhaseLabel(year)}
                    </p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">
                      {currency(year.annualCashflow)}
                    </p>
                    <p className="mt-1 text-xs font-semibold opacity-80">
                      {currency(year.monthlyCashflow)}/mo · {currency(year.cumulativeCashflow)} cumulative
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full border border-white/70 bg-white/75 px-2.5 py-1 text-xs font-semibold ${dscrTone}`}>
                    DSCR {number(year.dscr)}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <CashflowMobileStat label="Monthly rent roll" value={currency(year.grossScheduledRent / 12)} />
                  <CashflowMobileStat label="NOI" value={currency(year.noi)} />
                  <CashflowMobileStat label="Bridge carry" value={currency(year.bridgeCarry)} />
                  <CashflowMobileStat label="Permanent debt" value={currency(year.permanentDebtService)} />
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-4 hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.08em] text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Year</th>
                <th className="px-4 py-3 font-semibold">Financing phase</th>
                <th className="px-4 py-3 font-semibold">Avg rent / unit / mo</th>
                <th className="px-4 py-3 font-semibold">Monthly rent roll</th>
                <th className="px-4 py-3 font-semibold">Annual gross rent</th>
                <th className="px-4 py-3 font-semibold">NOI</th>
                <th className="px-4 py-3 font-semibold">Bridge carry</th>
                <th className="px-4 py-3 font-semibold">Permanent debt</th>
                <th className="px-4 py-3 font-semibold">Total debt service</th>
                <th className="px-4 py-3 font-semibold">Annual cashflow</th>
                <th className="px-4 py-3 font-semibold">Cumulative cashflow</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cashflowProjection.years.map((year) => (
                <tr key={`cashflow-year-${year.year}`} className="align-top text-slate-700">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">Year {year.year}</td>
                  <td className="whitespace-nowrap px-4 py-3">{cashflowPhaseLabel(year)}</td>
                  <td className="whitespace-nowrap px-4 py-3">{currency(year.avgMonthlyRentPerUnit)}</td>
                  <td className="whitespace-nowrap px-4 py-3">{currency(year.grossScheduledRent / 12)}</td>
                  <td className="whitespace-nowrap px-4 py-3">{currency(year.grossScheduledRent)}</td>
                  <td className="whitespace-nowrap px-4 py-3">{currency(year.noi)}</td>
                  <td className="whitespace-nowrap px-4 py-3">{currency(year.bridgeCarry)}</td>
                  <td className="whitespace-nowrap px-4 py-3">{currency(year.permanentDebtService)}</td>
                  <td className="whitespace-nowrap px-4 py-3">{currency(year.annualDebtService)}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">{currency(year.annualCashflow)}</td>
                  <td className="whitespace-nowrap px-4 py-3">{currency(year.cumulativeCashflow)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {model.mliSelectAnalysis && (
        <section id="playbook-mli" className="scroll-mt-24">
          <div className="mb-3">
            <h4 className="text-sm font-semibold text-slate-700">MLI Select scoring</h4>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Affordability is auto-scored from a CMHC-style threshold estimate based on median renter household income for the mapped market. Energy and accessibility points come from the listing-level context bar above.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Estimated max affordable rent"
              value={`${currency(model.mliSelectAnalysis.maxAffordableMonthlyRent)}/mo`}
              description={`StatsCan-based renter household income estimate for ${model.mliSelectAnalysis.marketCity ?? "the mapped market"} (${model.mliSelectAnalysis.sourceVintageYear} vintage).`}
              formula="Affordable rent threshold = Median renter income × 30% / 12"
            />
            <MetricCard
              label="Median renter income"
              value={currency(model.mliSelectAnalysis.medianRenterIncomeAnnual)}
              description={model.mliSelectAnalysis.sourceLabel}
              formula="Market median renter household income estimate"
            />
            <MetricCard
              label="Affordable unit share"
              value={percent(model.mliSelectAnalysis.affordableUnitSharePct)}
              description={`${model.mliSelectAnalysis.affordableUnitCount} of ${model.mliSelectAnalysis.totalUnitsScored} modeled units are at or below the affordability threshold.`}
              formula="Affordable unit share = Affordable units / Total units scored"
            />
            <MetricCard
              label="MLI tier"
              value={
                model.mliSelectAnalysis.achievedTier > 0
                  ? `${model.mliSelectAnalysis.achievedTier}+`
                  : "Below 50"
              }
              description={
                model.mliSelectAnalysis.qualified
                  ? `Current modeled total is ${model.mliSelectAnalysis.totalPoints} points.`
                  : `Current modeled total is ${model.mliSelectAnalysis.totalPoints} points, below the 50-point qualifying tier.`
              }
              formula="MLI tier is set by total points across affordability, energy, and accessibility"
            />
            <MetricCard
              label="Affordability points"
              value={number(model.mliSelectAnalysis.affordabilityPoints + model.mliSelectAnalysis.affordabilityBonusPoints)}
              description={
                model.mliSelectAnalysis.affordabilityBonusPoints > 0
                  ? `${model.mliSelectAnalysis.affordabilityPoints} base + ${model.mliSelectAnalysis.affordabilityBonusPoints} bonus from a 20-year affordability commitment.`
                  : `${model.mliSelectAnalysis.affordabilityPoints} points from the modeled affordable unit share.`
              }
              formula="Affordability points are set by the share of units priced at or below the affordability threshold"
            />
            <MetricCard
              label="Energy points"
              value={number(model.mliSelectAnalysis.energyPoints)}
              description="Manual context override from the deal setup bar."
              formula="Manual input from the MLI Select energy bucket"
            />
            <MetricCard
              label="Accessibility points"
              value={number(model.mliSelectAnalysis.accessibilityPoints)}
              description="Manual context override from the deal setup bar."
              formula="Manual input from the MLI Select accessibility bucket"
            />
            <MetricCard
              label="Current total points"
              value={number(model.mliSelectAnalysis.totalPoints)}
              description={
                model.programEnvelope.note ??
                "Tier controls the modeled MLI leverage and amortization envelope."
              }
              formula="Total points = Affordability + bonus + Energy + Accessibility"
            />
          </div>
          {model.mliSelectAnalysis.missingForNextTier.length > 0 && (
            <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-sky-700">What is missing for the next tier</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                {model.mliSelectAnalysis.missingForNextTier.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <section id="playbook-risks" className="scroll-mt-24 grid gap-4 lg:grid-cols-2">
        <ListCard title="Model basis" items={model.modelBasis} />
        <ListCard title="Execution focus" items={model.executionPlan} />
        <ListCard title="Financing plan" items={model.financingPlan} />
        <ListCard title="Key risks" items={model.keyRisks} />
      </section>
    </div>
  );
}

function PlaybookReviewMap({ items }: { items: PlaybookReviewMapItem[] }) {
  return (
    <nav
      aria-label="Investment path review map"
      className="rounded-xl border border-blue-200 bg-blue-50/70 p-4"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-700">
            Review map
          </p>
          <h4 className="mt-1 text-sm font-semibold text-slate-950">
            Jump to the underwriting section you need.
          </h4>
        </div>
        <p className="text-xs leading-5 text-slate-600">
          Built for investor review: decision, assumptions, returns, cashflow, and risks.
        </p>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="rounded-lg border border-blue-100 bg-white px-3 py-2 text-left no-underline shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-blue-300 hover:bg-blue-50"
          >
            <span className="block text-xs font-semibold text-blue-700">{item.label}</span>
            <span className="mt-1 block truncate text-[11px] font-medium text-slate-600">{item.detail}</span>
          </a>
        ))}
      </div>
    </nav>
  );
}

function CashflowFormulaBridge({
  steps,
  annualCashflow,
  monthlyCashflow,
  dscr,
  cashOnCashReturn,
}: {
  steps: CashflowBridgeStep[];
  annualCashflow: number;
  monthlyCashflow: number;
  dscr: number;
  cashOnCashReturn: number | null;
}) {
  const cashflowIsPositive = annualCashflow >= 0;

  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Rent-to-cashflow bridge
          </p>
          <h5 className="mt-1 text-sm font-semibold text-slate-950">
            The exact chain driving the year-one investor read.
          </h5>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            Start with the unit rent roll, then subtract vacancy, operating costs, and debt service. These are the same live assumptions used by the table below.
          </p>
        </div>
        <div className={`rounded-xl border px-4 py-3 text-right ${
          cashflowIsPositive
            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
            : "border-rose-200 bg-rose-50 text-rose-900"
        }`}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">Y1 cashflow</p>
          <p className="mt-1 text-lg font-black">{currency(annualCashflow)}</p>
          <p className="text-xs font-semibold">{currency(monthlyCashflow)}/mo</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-4">
        {steps.map((step) => (
          <div key={step.label} className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">{step.label}</p>
            <p className="mt-1 text-sm font-bold text-slate-950">{step.value}</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">{step.detail}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <CashflowBridgeFact label="DSCR" value={`${number(dscr)}x`} tone={dscr >= 1.25 ? "green" : dscr >= 1 ? "amber" : "red"} />
        <CashflowBridgeFact
          label="Cash-on-cash"
          value={cashOnCashReturn != null ? percent(cashOnCashReturn) : "n/a"}
          tone={cashOnCashReturn == null ? "slate" : cashOnCashReturn >= 0 ? "green" : "red"}
        />
        <CashflowBridgeFact
          label="Monthly carry"
          value={currency(monthlyCashflow)}
          tone={cashflowIsPositive ? "green" : "red"}
        />
      </div>
    </div>
  );
}

function CashflowBridgeFact({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "amber" | "red" | "slate";
}) {
  const toneClass =
    tone === "green"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : tone === "red"
          ? "border-rose-200 bg-rose-50 text-rose-900"
          : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <div className={`rounded-lg border px-3 py-2 ${toneClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] opacity-75">{label}</p>
      <p className="mt-1 text-sm font-black">{value}</p>
    </div>
  );
}

function CashflowMobileStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/70 bg-white/70 px-2.5 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</p>
      <p className="mt-1 font-semibold tabular-nums text-slate-950">{value}</p>
    </div>
  );
}

function EditableAssumptionRow(props: {
  label: string;
  testId?: string;
  assumption: AssumptionValue<number>;
  description: string;
  sourceDetail: string;
  formula: string;
  format: "currency" | "percent" | "number" | "years" | "months";
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  onReset: () => void;
}) {
  const displayValue = toDisplayValue(props.assumption.value, props.format);

  return (
    <div className={SURFACE_CARD_CLASS} data-testid={props.testId}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-800">{props.label}</p>
          <InfoTip description={props.description} formula={props.formula} sourceDetail={props.sourceDetail} />
        </div>
        <AssumptionMeta source={props.assumption.source} detail={props.sourceDetail} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 sm:justify-between">
        <div className={`${INPUT_SHELL_CLASS} min-w-0 flex-1 sm:min-w-[170px] sm:max-w-[220px]`}>
          {props.format === "currency" && <span className="text-sm text-slate-500">$</span>}
          <input
            type="number"
            value={Number.isFinite(displayValue) ? displayValue : 0}
            min={props.min}
            max={props.max}
            step={props.step ?? 1}
            onChange={(event) => {
              const parsed = Number(event.target.value);
              if (!Number.isFinite(parsed)) return;
              props.onChange(roundTo(fromDisplayValue(parsed, props.format), 2));
            }}
            className="w-full appearance-none border-none bg-transparent px-1 py-2 text-right text-sm font-semibold text-slate-900 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
            {(props.format === "percent" || props.format === "years" || props.format === "months") && (
              <span className="text-sm text-slate-500">
                {props.format === "percent" ? "%" : props.format === "years" ? "yr" : "mo"}
              </span>
            )}
        </div>
        <button
          type="button"
          onClick={props.onReset}
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

function TakeoutLeverageAssumptionRow(props: {
  className?: string;
  assumption: AssumptionValue<number>;
  totalBasis: number;
  takeoutProceeds: number;
  equitySlice: number;
  maxTakeoutLtvPct: number;
  ruleLabel: string;
  onChange: (value: number) => void;
  onReset: () => void;
}) {
  return (
    <div className={`${SURFACE_CARD_CLASS} ${props.className ?? ""}`}>
      <div className="flex h-full flex-col gap-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-slate-800">Takeout leverage</p>
              <InfoTip
                description="Permanent refinance leverage used to size takeout proceeds after stabilization. This is distinct from the short-term bridge advance."
                formula="Takeout proceeds = Debt sizing basis × Takeout LTV"
                sourceDetail={props.assumption.label}
              />
            </div>
            <AssumptionMeta source={props.assumption.source} detail={props.assumption.label} showSecondary={false} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:min-w-[300px]">
            <DownPaymentStat label="Implied proceeds" value={currency(props.takeoutProceeds)} />
            <DownPaymentStat label="Equity slice" value={currency(props.equitySlice)} />
          </div>
        </div>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(220px,1.1fr)]">
          <div className={SUBTLE_PANEL_CLASS}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              Enter takeout LTV
            </p>
            <div className={`${INPUT_SHELL_CLASS} mt-3 py-1`}>
              <input
                type="number"
                value={toDisplayValue(props.assumption.value, "percent")}
                min={0}
                max={props.maxTakeoutLtvPct * 100}
                step={0.5}
                onChange={(event) => {
                  const parsed = Number(event.target.value);
                  if (!Number.isFinite(parsed)) return;
                  props.onChange(fromDisplayValue(parsed, "percent"));
                }}
                className="w-full appearance-none border-none bg-transparent px-1 py-2 text-right text-lg font-semibold text-slate-900 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span className="text-sm text-slate-500">%</span>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={props.onReset}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Reset
              </button>
            </div>
          </div>

          <div className={SUBTLE_PANEL_CLASS}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Takeout summary</p>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <div className="flex items-center justify-between gap-3">
                <span>Takeout LTV</span>
                <span className="font-medium text-slate-900">{percent(props.assumption.value * 100)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Debt sizing basis</span>
                <span className="font-medium text-slate-900">{currency(props.totalBasis)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Takeout proceeds</span>
                <span className="font-medium text-slate-900">{currency(props.takeoutProceeds)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Equity slice</span>
                <span className="font-medium text-slate-900">{currency(props.equitySlice)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className={SUBTLE_PANEL_CLASS}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Program rule</p>
          <p className="mt-2 text-xs leading-5 text-slate-600">{props.ruleLabel}</p>
        </div>
      </div>
    </div>
  );
}

function DownPaymentAssumptionRow(props: {
  className?: string;
  assumption: AssumptionValue<number>;
  totalBasis: number;
  purchasePrice: number;
  downPaymentPct: number;
  downPaymentAmount: number;
  minDownPaymentPct: number;
  minDownPaymentAmount: number;
  belowModeledMinimum: boolean;
  inputMode: DownPaymentInputMode;
  ruleLabel: string;
  onChangeMode: (mode: DownPaymentInputMode) => void;
  onChange: (mode: DownPaymentInputMode, value: number) => void;
  onReset: () => void;
}) {
  const committedDisplayValue =
    props.inputMode === "percent"
      ? toDisplayValue(props.downPaymentPct, "percent")
      : toDisplayValue(props.downPaymentAmount, "currency");
  const [draftValue, setDraftValue] = useState(formatNumberInputDraft(committedDisplayValue));
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setDraftValue(formatNumberInputDraft(committedDisplayValue));
    }
  }, [committedDisplayValue, isEditing, props.inputMode]);

  function commitDraft(rawValue: string) {
    if (rawValue.trim() === "") return;
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) return;
    const nextValue =
      props.inputMode === "percent"
        ? fromDisplayValue(parsed, "percent")
        : roundTo(parsed, 2);
    props.onChange(props.inputMode, nextValue);
  }

  return (
    <div className={`${SURFACE_CARD_CLASS} ${props.className ?? ""}`}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-slate-800">Down payment</p>
              <InfoTip
                description="Cash equity contributed on purchase price. The model then converts that amount into the resulting LTV on financed basis and enforces the minimum down-payment rule for the selected financing path."
                formula="Down payment % = Down payment / Purchase price"
                sourceDetail={props.assumption.label}
              />
            </div>
            <AssumptionMeta
              source={props.assumption.source}
              detail={props.assumption.label}
              showSecondary={false}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:min-w-[300px]">
            <DownPaymentStat label="Resulting LTV" value={percent(props.assumption.value * 100)} />
            <DownPaymentStat
              label="Minimum allowed"
              value={`${percent(props.minDownPaymentPct * 100)} · ${currency(props.minDownPaymentAmount)}`}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              Entry mode
            </span>
            {(["percent", "amount"] as DownPaymentInputMode[]).map((mode) => (
              <button
                key={`down-payment-${mode}`}
                type="button"
                onClick={() => props.onChangeMode(mode)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                  props.inputMode === mode
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {mode === "percent" ? "% of price" : "$ amount"}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={props.onReset}
            className="ml-auto rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Reset
          </button>
        </div>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.05fr)_minmax(260px,0.95fr)]">
          <div className={SUBTLE_PANEL_CLASS}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              {props.inputMode === "percent" ? "Enter down payment %" : "Enter down payment amount"}
            </p>
            <div className={`${INPUT_SHELL_CLASS} mt-3 w-full min-w-0 max-w-full overflow-hidden py-1`}>
              {props.inputMode === "amount" && <span className="text-sm text-slate-500">$</span>}
              <input
                type="number"
                value={draftValue}
                min={0}
                max={props.inputMode === "percent" ? 100 : Math.max(props.totalBasis, props.minDownPaymentAmount)}
                step={props.inputMode === "percent" ? 0.5 : 1000}
                onFocus={() => setIsEditing(true)}
                onChange={(event) => {
                  const nextDraft = event.target.value;
                  setIsEditing(true);
                  setDraftValue(nextDraft);
                  commitDraft(nextDraft);
                }}
                onBlur={() => {
                  setIsEditing(false);
                  setDraftValue(formatNumberInputDraft(committedDisplayValue));
                }}
                className="w-full appearance-none border-none bg-transparent px-1 py-2 text-right text-lg font-semibold text-slate-900 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              {props.inputMode === "percent" && <span className="text-sm text-slate-500">%</span>}
            </div>
          </div>

          <div className={SUBTLE_PANEL_CLASS}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Deal summary</p>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <div className="flex items-center justify-between gap-3">
                <span>Down payment</span>
                <span className="font-medium text-slate-900">{currency(props.downPaymentAmount)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Purchase price</span>
                <span className="font-medium text-slate-900">{currency(props.purchasePrice)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Down payment %</span>
                <span className="font-medium text-slate-900">{percent(props.downPaymentPct * 100)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Debt sizing basis</span>
                <span className="font-medium text-slate-900">{currency(props.totalBasis)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className={SUBTLE_PANEL_CLASS}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Program rule</p>
          <p className="mt-2 text-xs leading-5 text-slate-600">{props.ruleLabel}</p>
          {props.belowModeledMinimum ? (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-800">
              This entry is below the modeled program minimum. Treat it as an exception test only until RBC, Desjardins, or another lender confirms the exact down payment, borrower treatment, and personal-debt reporting in writing.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function BridgeAdvanceAssumptionRow(props: {
  assumption: AssumptionValue<number>;
  totalBasis: number;
  bridgeAmount: number;
  inputMode: BridgeAdvanceInputMode;
  onChangeMode: (mode: BridgeAdvanceInputMode) => void;
  onChange: (mode: BridgeAdvanceInputMode, value: number) => void;
  onReset: () => void;
}) {
  const displayValue =
    props.inputMode === "percent"
      ? toDisplayValue(props.assumption.value, "percent")
      : toDisplayValue(props.bridgeAmount, "currency");

  return (
    <div className={SURFACE_CARD_CLASS}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-slate-800">Bridge amount</p>
              <InfoTip
                description="Short-term principal advance used to fund purchase and a portion of the capex program before refinance."
                formula="Bridge principal advance = Bridge basis × Bridge advance %"
                sourceDetail={props.assumption.label}
              />
            </div>
            <AssumptionMeta source={props.assumption.source} detail={props.assumption.label} showSecondary={false} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:min-w-[300px]">
            <DownPaymentStat label="Principal advance" value={currency(props.bridgeAmount)} />
            <DownPaymentStat label="Advance rate" value={percent(props.assumption.value * 100)} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              Entry mode
            </span>
            {(["percent", "amount"] as BridgeAdvanceInputMode[]).map((mode) => (
              <button
                key={`bridge-advance-${mode}`}
                type="button"
                onClick={() => props.onChangeMode(mode)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                  props.inputMode === mode
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {mode === "percent" ? "% of basis" : "$ amount"}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={props.onReset}
            className="ml-auto rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Reset
          </button>
        </div>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(220px,1.1fr)]">
          <div className={SUBTLE_PANEL_CLASS}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              {props.inputMode === "percent" ? "Enter bridge advance %" : "Enter bridge amount"}
            </p>
            <div className={`${INPUT_SHELL_CLASS} mt-3 py-1`}>
              {props.inputMode === "amount" && <span className="text-sm text-slate-500">$</span>}
              <input
                type="number"
                value={Number.isFinite(displayValue) ? displayValue : 0}
                min={0}
                max={props.inputMode === "percent" ? 95 : props.totalBasis * 0.95}
                step={props.inputMode === "percent" ? 0.5 : 1000}
                onChange={(event) => {
                  const parsed = Number(event.target.value);
                  if (!Number.isFinite(parsed)) return;
                  const nextValue =
                    props.inputMode === "percent"
                      ? fromDisplayValue(parsed, "percent")
                      : roundTo(parsed, 2);
                  props.onChange(props.inputMode, nextValue);
                }}
                className="w-full appearance-none border-none bg-transparent px-1 py-2 text-right text-lg font-semibold text-slate-900 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              {props.inputMode === "percent" && <span className="text-sm text-slate-500">%</span>}
            </div>
          </div>

          <div className={SUBTLE_PANEL_CLASS}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Bridge summary</p>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <div className="flex items-center justify-between gap-3">
                <span>Bridge basis</span>
                <span className="font-medium text-slate-900">{currency(props.totalBasis)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Advance rate</span>
                <span className="font-medium text-slate-900">{percent(props.assumption.value * 100)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Principal advance</span>
                <span className="font-medium text-slate-900">{currency(props.bridgeAmount)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DownPaymentStat({ label, value }: { label: string; value: string }) {
  return (
    <div className={SUBTLE_PANEL_CLASS}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function BridgeDecisionCard({
  value,
  takeoutProceeds,
  bridgePayoff,
}: {
  value: number;
  takeoutProceeds: number;
  bridgePayoff: number;
}) {
  const isPositive = value >= 0;

  return (
    <div
      className={`rounded-xl border p-4 ${
        isPositive
          ? "border-emerald-200 bg-emerald-50/70"
          : "border-rose-200 bg-rose-50/70"
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
        Refi proceeds vs bridge payoff
      </p>
      <p className={`mt-2 text-2xl font-semibold tracking-tight ${isPositive ? "text-emerald-700" : "text-rose-700"}`}>
        {isPositive ? "+" : "-"}
        {currency(Math.abs(value))}
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        {isPositive
          ? "Modeled takeout proceeds clear the bridge payoff and leave surplus before taxes and refinance leakage."
          : "Modeled takeout proceeds do not fully clear the bridge payoff. The shortfall would need sponsor cash, a lower payoff, or a larger refinance."}
      </p>
      <p className="mt-3 text-xs text-slate-500">
        {currency(takeoutProceeds)} takeout proceeds - {currency(bridgePayoff)} bridge payoff
      </p>
    </div>
  );
}

function UnitRentScheduleRow(props: {
  label: string;
  averageAssumption: AssumptionValue<number>;
  unitRents: StrategyUnitRentLineItem[];
  rentKey: "currentMarketRent" | "modeledRent";
  description: string;
  sourceDetail: string;
  formula: string;
  onChange: (unitIndex: number, value: number) => void;
  onReset: () => void;
}) {
  const averageValue = averageUnitRent(props.unitRents, props.rentKey);

  return (
    <div className={SURFACE_CARD_CLASS}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-800">{props.label}</p>
            <InfoTip description={props.description} formula={props.formula} sourceDetail={props.sourceDetail} />
          </div>
          <AssumptionMeta source={props.averageAssumption.source} detail={props.sourceDetail} />
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:justify-end">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">
            Avg {currency(averageValue)}
          </div>
          <button
            type="button"
            onClick={props.onReset}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-2 lg:grid-cols-2 2xl:grid-cols-3">
        {props.unitRents.map((unit, index) => {
          const assumption = unit[props.rentKey];

          return (
            <div key={`${props.rentKey}-${unit.unitNumber}`} className={SUBTLE_PANEL_CLASS}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">{unit.unitLabel}</p>
                  <p className="text-xs text-slate-500">{unit.bedroomLabel}</p>
                </div>
                <ProvenanceBadge source={assumption.source} detail={assumption.label} />
              </div>
              <div className={`${INPUT_SHELL_CLASS} mt-3`}>
                <span className="text-sm text-slate-500">$</span>
                <input
                  type="number"
                  value={toDisplayValue(assumption.value, "currency")}
                  min={0}
                  step={25}
                  onChange={(event) => {
                    const parsed = Number(event.target.value);
                    if (!Number.isFinite(parsed)) return;
                    props.onChange(index, roundTo(parsed, 2));
                  }}
                  className="w-full appearance-none border-none bg-transparent px-1 py-2 text-right text-sm font-semibold text-slate-900 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PropertyTaxExpenseCard(props: {
  item: OperatingExpenseLineItem;
  onChange: (
    itemKey: OperatingExpenseLineItem["key"],
    mode: OperatingExpenseInputMode,
    inputValue: number
  ) => void;
  onReset: () => void;
}) {
  const estimate = props.item.propertyTaxEstimate;
  if (!estimate) return null;

  const currentInputValue = roundTo(props.item.amountAnnual.value, 2);
  const isSourceAnnualTax = estimate.method === "exact_bill";
  const cardTitle = isSourceAnnualTax ? "Property tax (Centris source)" : "Property tax estimate";
  const taxBasisLabel = isSourceAnnualTax ? "Municipal + school" : "Fallback estimate";
  const helperCopy = isSourceAnnualTax
    ? "Using the annual municipal plus school tax captured from the source. This is treated as a fixed operating expense, not a tax-rate estimate."
    : "Replace this fallback with the actual annual municipal plus school tax when the source amount is available.";
  const annualTaxLabel = isSourceAnnualTax ? "Annual municipal + school tax" : "Annual property tax";

  return (
    <div className={SUBTLE_PANEL_CLASS}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-slate-800">{cardTitle}</p>
            <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500">
              {taxBasisLabel}
            </span>
            <PropertyTaxInfoTip description={props.item.description} estimate={estimate} sourceDetail={props.item.amountAnnual.label} />
          </div>
          <AssumptionMeta
            source={props.item.amountAnnual.source}
            detail={props.item.amountAnnual.label}
            showSecondary={false}
          />
        </div>
        <button
          type="button"
          onClick={props.onReset}
          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          Reset
        </button>
      </div>

      <div className="mt-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">{annualTaxLabel}</p>
          <div className={`${INPUT_SHELL_CLASS} mt-3 py-1`}>
            <span className="text-sm text-slate-500">$</span>
            <input
              type="number"
              value={Number.isFinite(currentInputValue) ? currentInputValue : 0}
              min={0}
              step={100}
              onChange={(event) => {
                const parsed = Number(event.target.value);
                if (!Number.isFinite(parsed)) return;
                props.onChange(props.item.key, "annual", roundTo(parsed, 2));
              }}
              className="w-full appearance-none border-none bg-transparent px-1 py-2 text-right text-lg font-semibold text-slate-900 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span className="text-sm text-slate-500">/yr</span>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">{helperCopy}</p>
        </div>
      </div>
    </div>
  );
}

function OperatingExpenseSection(props: {
  ratioAssumption: AssumptionValue<number>;
  operatingExpenseTotal: number;
  items: OperatingExpenseLineItem[];
  effectiveGrossIncome: number;
  purchasePrice: number;
  expanded: boolean;
  newExpenseLabel: string;
  newExpenseMode: OperatingExpenseInputMode;
  onNewExpenseLabelChange: (value: string) => void;
  onNewExpenseModeChange: (value: OperatingExpenseInputMode) => void;
  onAddExpense: () => void;
  onToggleExpanded: () => void;
  onChange: (
    itemKey: OperatingExpenseLineItem["key"],
    mode: OperatingExpenseInputMode,
    inputValue: number
  ) => void;
  onChangeMode: (itemKey: OperatingExpenseLineItem["key"], mode: OperatingExpenseInputMode) => void;
  onRemoveItem: (itemKey: OperatingExpenseLineItem["key"]) => void;
  onResetItem: (itemKey: OperatingExpenseLineItem["key"]) => void;
  onResetAll: () => void;
}) {
  return (
    <div className={SURFACE_CARD_CLASS}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-800">Operating expense ratio</p>
            <InfoTip
              description="Calculated from the annual operating-expense schedule below, including property tax, management, and the other recurring operating cost buckets."
              formula="Operating expense ratio = Total annual operating expenses / Effective gross income"
              sourceDetail={props.ratioAssumption.label}
            />
          </div>
          <AssumptionMeta
            source={props.ratioAssumption.source}
            detail={props.ratioAssumption.label}
            showSecondary={false}
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row xl:items-center">
          <div className="flex items-center gap-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">
              {percent(props.ratioAssumption.value * 100)}
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">
              {currency(props.operatingExpenseTotal)}/yr
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={props.onToggleExpanded}
              className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              {props.expanded ? "Hide schedule" : "Show schedule"}
            </button>
            <button
              type="button"
              onClick={props.onResetAll}
              className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Reset schedule
            </button>
          </div>
        </div>
      </div>

      {props.expanded && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {props.items.map((item) => {
              if (item.key === "property_tax" && item.propertyTaxEstimate) {
                return (
                  <PropertyTaxExpenseCard
                    key={item.key}
                    item={item}
                    onChange={props.onChange}
                    onReset={() => props.onResetItem(item.key)}
                  />
                );
              }

              const annualAmount = calculateOperatingExpenseLineAmount(
                item,
                props.effectiveGrossIncome,
                props.purchasePrice
              );
              const currentInputValue = getOperatingExpenseInputValue(
                item,
                item.inputMode,
                props.effectiveGrossIncome,
                props.purchasePrice
              );
              const inputFormat = item.inputMode === "rate" ? "percent" : "currency";
              const displayValue = toDisplayValue(currentInputValue, inputFormat);

              return (
                <div key={item.key} className={SUBTLE_PANEL_CLASS}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-slate-800">{item.label}</p>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                          {item.inputMode === "rate"
                            ? operatingExpensePercentBasisLabel(item.percentBasis)
                            : `${operatingExpenseInputModeLabel(item.inputMode)} entry`}
                        </span>
                        <InfoTip
                          description={item.description}
                          formula={item.formula}
                          sourceDetail={item.amountAnnual.label}
                        />
                      </div>
                      <AssumptionMeta
                        source={item.amountAnnual.source}
                        detail={item.amountAnnual.label}
                        showSecondary={false}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {(["annual", "monthly", "rate"] as OperatingExpenseInputMode[]).map((mode) => (
                      <button
                        key={`${item.key}-${mode}`}
                        type="button"
                        onClick={() => props.onChangeMode(item.key, mode)}
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                          item.inputMode === mode
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {mode === "rate"
                          ? operatingExpensePercentBasisLabel(item.percentBasis)
                          : operatingExpenseInputModeLabel(mode)}
                      </button>
                    ))}
                    <div className="ml-auto">
                      {item.isCustom ? (
                        <button
                          type="button"
                          onClick={() => props.onRemoveItem(item.key)}
                          className="rounded border border-rose-200 bg-white px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
                        >
                          Remove
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => props.onResetItem(item.key)}
                          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className={`${INPUT_SHELL_CLASS} min-w-[180px]`}>
                      {item.inputMode !== "rate" && <span className="text-sm text-slate-500">$</span>}
                      <input
                        type="number"
                        value={Number.isFinite(displayValue) ? displayValue : 0}
                        min={0}
                        step={item.inputMode === "rate" ? 0.1 : 25}
                        onChange={(event) => {
                          const parsed = Number(event.target.value);
                          if (!Number.isFinite(parsed)) return;
                          const nextValue =
                            item.inputMode === "rate"
                              ? fromDisplayValue(parsed, "percent")
                              : roundTo(parsed, 2);
                          props.onChange(item.key, item.inputMode, nextValue);
                        }}
                        className="w-full appearance-none border-none bg-transparent px-1 py-2 text-right text-sm font-semibold text-slate-900 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      {item.inputMode === "rate" && <span className="text-sm text-slate-500">%</span>}
                      {item.inputMode === "monthly" && <span className="text-sm text-slate-500">/mo</span>}
                      {item.inputMode === "annual" && <span className="text-sm text-slate-500">/yr</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800">Add operating expense</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Add a custom operating-expense line if this property has a recurring cost that is not already in the default schedule.
                </p>
              </div>
              <button
                type="button"
                onClick={props.onAddExpense}
                disabled={!props.newExpenseLabel.trim()}
                className="rounded border border-slate-900 bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-500"
              >
                Add expense
              </button>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <input
                type="text"
                value={props.newExpenseLabel}
                onChange={(event) => props.onNewExpenseLabelChange(event.target.value)}
                placeholder="Expense type, for example security, elevator maintenance, or waste removal"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-400"
              />
              <div className="flex flex-wrap gap-2">
                {(["annual", "monthly", "rate"] as OperatingExpenseInputMode[]).map((mode) => (
                  <button
                    key={`new-expense-${mode}`}
                    type="button"
                    onClick={() => props.onNewExpenseModeChange(mode)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                      props.newExpenseMode === mode
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {mode === "rate" ? "% of EGI" : operatingExpenseInputModeLabel(mode)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StaticAssumptionRow(props: {
  label: string;
  assumption: AssumptionValue<number>;
  description: string;
  sourceDetail: string;
  formula: string;
  format?: "currency" | "percent" | "number" | "years" | "months";
}) {
  const format = props.format ?? "number";

  return (
    <div className={SURFACE_CARD_CLASS}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-800">{props.label}</p>
            <InfoTip description={props.description} formula={props.formula} sourceDetail={props.sourceDetail} />
          </div>
          <AssumptionMeta source={props.assumption.source} detail={props.sourceDetail} />
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">
          {formatStaticValue(props.assumption.value, format)}
        </div>
      </div>
    </div>
  );
}

function AssumptionMeta({
  source,
  detail,
  showSecondary = true,
}: {
  source: AssumptionSource;
  detail: string;
  showSecondary?: boolean;
}) {
  const summary = summarizeSourceDetail(detail);

  return (
    <div className="mt-2 min-w-0 space-y-1 text-xs text-slate-500">
      <div className="flex flex-wrap items-center gap-2">
        <ProvenanceBadge source={source} detail={detail} />
      </div>
      {showSecondary && summary.secondary && (
        <p className="break-words leading-5 text-slate-500">{summary.secondary}</p>
      )}
    </div>
  );
}

function InfoTip({
  description,
  formula,
  sourceDetail,
}: {
  description: string;
  formula: string;
  sourceDetail?: string;
}) {
  const formatted = formatFormula(formula);
  const sourceSummary = sourceDetail ? summarizeSourceDetail(sourceDetail) : null;

  return (
    <div className="group relative">
      <button
        type="button"
        aria-label="Information"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white text-[11px] font-bold text-slate-600 hover:border-slate-400"
      >
        i
      </button>
      <div className="pointer-events-none invisible absolute right-0 top-6 z-20 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-slate-200 bg-white p-3 text-left text-xs text-slate-600 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 sm:left-1/2 sm:right-auto sm:-translate-x-1/2">
        <p className="font-medium text-slate-800">{description}</p>
        {sourceSummary && (
          <div className="mt-2 rounded-md border border-slate-200 bg-white p-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Source</p>
            <p className="mt-1 leading-5 text-slate-700">{sourceSummary.primary.replace(/^Source:\s*/i, "")}</p>
            {sourceSummary.secondary && !/^Calculation:/i.test(sourceSummary.secondary) && (
              <p className="mt-1 leading-5 text-slate-500">{sourceSummary.secondary}</p>
            )}
          </div>
        )}
        <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Calculation</p>
          {formatted.lhs && formatted.rhs ? (
            <div className="mt-1 space-y-1 font-mono">
              <p className="text-[11px] leading-5 text-slate-500">{formatted.lhs}</p>
              <p className="text-[12px] font-semibold leading-5 text-slate-800">= {formatted.rhs}</p>
            </div>
          ) : (
            <p className="mt-1 font-mono text-[12px] leading-5 text-slate-700">{formatted.full}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function PropertyTaxInfoTip({
  description,
  estimate,
  sourceDetail,
}: {
  description: string;
  estimate: NonNullable<OperatingExpenseLineItem["propertyTaxEstimate"]>;
  sourceDetail: string;
}) {
  const sourceSummary = summarizeSourceDetail(sourceDetail);
  const isSourceAnnualTax = estimate.method === "exact_bill";
  const effectiveRate = estimate.effectiveRateVsPrice != null ? percent(estimate.effectiveRateVsPrice * 100) : "n/a";

  return (
    <div className="group relative">
      <button
        type="button"
        aria-label="Property tax information"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white text-[11px] font-bold text-slate-600 hover:border-slate-400"
      >
        i
      </button>
      <div className="pointer-events-none invisible absolute right-0 top-6 z-20 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-slate-200 bg-white p-3 text-left text-xs text-slate-600 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 sm:left-1/2 sm:right-auto sm:-translate-x-1/2">
        <p className="font-medium text-slate-800">{description}</p>

        <div className="mt-3 rounded-md border border-slate-200 bg-white p-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Source</p>
          <p className="mt-1 leading-5 text-slate-700">{sourceSummary.primary.replace(/^Source:\s*/i, "")}</p>
        </div>

        <div className="mt-3 grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-2">
          <PropertyTaxTooltipRow label="Method" value={propertyTaxMethodLabel(estimate.method)} />
          {!isSourceAnnualTax && (
            <>
              <PropertyTaxTooltipRow label="Jurisdiction" value={estimate.jurisdiction ?? "n/a"} />
              <PropertyTaxTooltipRow label="Tax class" value={propertyTaxClassLabel(estimate.taxClass)} />
              <PropertyTaxTooltipRow label="Area" value={estimate.areaLabel ?? "Citywide default"} />
            </>
          )}
          <PropertyTaxTooltipRow label="Tax year" value={estimate.taxYear != null ? String(estimate.taxYear) : "n/a"} />
          <PropertyTaxTooltipRow label="Confidence" value={estimate.confidence} />
          <PropertyTaxTooltipRow label={isSourceAnnualTax ? "Cost vs ask" : "Effective vs price"} value={effectiveRate} />
        </div>

        {estimate.fallbackReason && (
          <div className="mt-3 rounded-md border border-slate-200 bg-white p-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Why this fallback was used</p>
            <p className="mt-1 leading-5 text-slate-700">{estimate.fallbackReason}</p>
          </div>
        )}

        <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
            {isSourceAnnualTax ? "Source calculation" : "Calculation"}
          </p>
          <p className="mt-1 font-mono text-[12px] leading-5 text-slate-700">{estimate.formulaSummary}</p>
        </div>
      </div>
    </div>
  );
}

function PropertyTaxTooltipRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800">{value}</span>
    </div>
  );
}

function ListCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className={SURFACE_CARD_CLASS}>
      <h4 className="text-sm font-semibold text-slate-700">{title}</h4>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="max-w-full break-words rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
      {children}
    </span>
  );
}

function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
      {children}
    </p>
  );
}

function AssumptionCluster({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className={`${SUBTLE_PANEL_CLASS} space-y-3`}>
      <SubsectionLabel>{title}</SubsectionLabel>
      {children}
    </div>
  );
}

function SubsectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-xs font-semibold text-slate-600">{children}</p>;
}

function BridgeHeadlineStat({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{caption}</p>
    </div>
  );
}

function BridgeDetailMetric({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className="mt-1 text-base font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{helper}</p>
    </div>
  );
}

function BridgeUsageBadge({
  usage,
}: {
  usage: StrategyModel["bridgeUsage"];
}) {
  const tone =
    usage === "core"
      ? "border-amber-300 bg-amber-50 text-amber-800"
      : usage === "common"
        ? "border-blue-300 bg-blue-50 text-blue-800"
        : usage === "optional"
          ? "border-slate-300 bg-white text-slate-700"
          : "border-emerald-300 bg-emerald-50 text-emerald-800";

  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {BRIDGE_USAGE_META[usage].tagLabel}
    </span>
  );
}

function ModelControlSummary({
  items,
  overrideSummary,
}: {
  items: ModelControlItem[];
  overrideSummary: ModelOverrideSummary;
}) {
  return (
    <section
      className="playbook-model-control mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)]"
      data-testid="playbook-model-control"
      aria-label="Live model controls"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700">
            Live model controls
          </p>
          <h4 className="mt-1 text-base font-semibold text-slate-950">
            What to change before reading the full assumption table
          </h4>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            This summary reacts to your edits below. It separates source/profile assumptions from listing-level overrides and points to the first lever that can change financeability.
          </p>
        </div>
        <span
          className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${
            overrideSummary.count > 0
              ? "border-amber-200 bg-amber-50 text-amber-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {overrideSummary.count} override{overrideSummary.count === 1 ? "" : "s"} active
        </span>
      </div>

      <div className="playbook-model-control-grid mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {items.map((item) => (
          <a
            key={item.label}
            href={item.href}
            className={`playbook-model-control-card rounded-xl border p-3 no-underline transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)] ${decisionCardClass(item.tone)}`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.13em] opacity-80">{item.label}</p>
            <p className="mt-2 text-base font-semibold leading-tight">{item.value}</p>
            <p className="mt-2 text-xs leading-5 opacity-85">{item.detail}</p>
            <span className="mt-3 inline-flex text-xs font-semibold">
              {item.action}
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

function AssumptionEditGuide({ items }: { items: AssumptionEditGuideItem[] }) {
  return (
    <section
      className="playbook-assumption-guide mb-4 rounded-2xl border border-teal-200 bg-teal-50/60 p-4"
      data-testid="playbook-assumption-guide"
      aria-label="Recommended assumption edit order"
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-700">
            Edit order
          </p>
          <h4 className="mt-1 text-base font-semibold text-slate-950">
            Change the inputs in the order an underwriter would test them
          </h4>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            Start with lender constraints, then rent, then operating costs, then exit timing. The detailed rows below still show every source and formula.
          </p>
        </div>
        <span className="w-fit rounded-full border border-teal-200 bg-white px-3 py-1 text-xs font-semibold text-teal-800">
          Assumption workflow
        </span>
      </div>

      <div className="playbook-assumption-guide-grid mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className={`playbook-assumption-guide-card rounded-xl border p-3 no-underline transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)] ${decisionCardClass(item.tone)}`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.13em] opacity-80">{item.label}</p>
            <p className="mt-2 text-base font-semibold leading-tight">{item.value}</p>
            <p className="mt-2 text-xs leading-5 opacity-85">{item.detail}</p>
            <span className="mt-3 inline-flex text-xs font-semibold">Jump to inputs</span>
          </a>
        ))}
      </div>
    </section>
  );
}

function DecisionSnapshotCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: DecisionTone;
}) {
  const toneClass = decisionCardClass(tone);

  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] opacity-80">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
      <p className="mt-2 text-xs leading-5 opacity-80">{detail}</p>
    </div>
  );
}

function decisionBadgeClass(tone: DecisionTone): string {
  const classes: Record<DecisionTone, string> = {
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    red: "border-rose-200 bg-rose-50 text-rose-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
  };

  return classes[tone];
}

function decisionCardClass(tone: DecisionTone): string {
  const classes: Record<DecisionTone, string> = {
    green: "border-emerald-200 bg-emerald-50 text-emerald-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    red: "border-rose-200 bg-rose-50 text-rose-900",
    blue: "border-blue-200 bg-blue-50 text-blue-900",
    slate: "border-slate-200 bg-slate-50 text-slate-800",
  };

  return classes[tone];
}

function getFirstModelLever({
  decisionTone,
  yearOneAnnualCashflow,
  modeledResult,
  refiSurplusShortfall,
  decisionConcerns,
  bridgeEnabled,
}: {
  decisionTone: DecisionTone;
  yearOneAnnualCashflow: number;
  modeledResult: { dscr: number; cashOnCashReturn: number | null };
  refiSurplusShortfall: number | null;
  decisionConcerns: string[];
  bridgeEnabled: boolean;
}): ModelControlItem {
  if (yearOneAnnualCashflow < 0) {
    return {
      label: "First lever",
      value: "Repair cashflow",
      detail: "Start with rent, vacancy, operating costs, mortgage rate, and leverage before touching upside assumptions.",
      href: "#playbook-assumptions",
      action: "Edit cashflow inputs",
      tone: "red",
    };
  }

  if (modeledResult.dscr > 0 && modeledResult.dscr < 1.25) {
    return {
      label: "First lever",
      value: "Lift DSCR",
      detail: "Lender coverage is the constraint. Test lower leverage, better NOI, or longer amortization.",
      href: "#playbook-assumptions",
      action: "Tune debt terms",
      tone: modeledResult.dscr >= 1 ? "amber" : "red",
    };
  }

  if (refiSurplusShortfall != null && refiSurplusShortfall < 0) {
    return {
      label: "First lever",
      value: "Fix takeout",
      detail: "The refinance is short. Stress takeout LTV, bridge advance, NOI, and carry before relying on the debt wipe.",
      href: "#playbook-bridge",
      action: "Open bridge",
      tone: "red",
    };
  }

  if (modeledResult.cashOnCashReturn != null && modeledResult.cashOnCashReturn < 0) {
    return {
      label: "First lever",
      value: "Improve CoC",
      detail: "The cash return is negative. Review equity required, debt terms, rent, and expense assumptions.",
      href: "#playbook-assumptions",
      action: "Edit assumptions",
      tone: "red",
    };
  }

  if (decisionTone === "amber") {
    return {
      label: "First lever",
      value: "Verify weak point",
      detail: decisionConcerns[0] ?? "This path is plausible but still needs a lender or assumption check.",
      href: bridgeEnabled ? "#playbook-bridge" : "#playbook-assumptions",
      action: bridgeEnabled ? "Check bridge" : "Review inputs",
      tone: "amber",
    };
  }

  return {
    label: "First lever",
    value: "Stress test next",
    detail: "The first-pass read is clean. Stress vacancy, rate, rent, expenses, and takeout before relying on it.",
    href: "#playbook-assumptions",
    action: "Stress assumptions",
    tone: "green",
  };
}

function getModelOverrideSummary({
  assumptions,
  originalAssumptions,
  modeledRentPerUnit,
  originalModeledRentPerUnit,
  unitRentSchedule,
  originalUnitRentSchedule,
  bridgeEnabled,
  originalBridgeEnabled,
}: {
  assumptions: ScenarioAssumptions;
  originalAssumptions: ScenarioAssumptions;
  modeledRentPerUnit: AssumptionValue<number>;
  originalModeledRentPerUnit: AssumptionValue<number>;
  unitRentSchedule: StrategyUnitRentLineItem[];
  originalUnitRentSchedule: StrategyUnitRentLineItem[];
  bridgeEnabled: boolean;
  originalBridgeEnabled: boolean;
}): ModelOverrideSummary {
  const labels: string[] = [];
  const trackedAssumptions: Array<{
    label: string;
    current: AssumptionValue<number>;
    original: AssumptionValue<number>;
  }> = [
    { label: "vacancy", current: assumptions.vacancyRate, original: originalAssumptions.vacancyRate },
    { label: "current market rent", current: assumptions.currentMarketRent, original: originalAssumptions.currentMarketRent },
    { label: "rent growth", current: assumptions.rentGrowthRateAnnual, original: originalAssumptions.rentGrowthRateAnnual },
    { label: "appreciation", current: assumptions.appreciationRateAnnual, original: originalAssumptions.appreciationRateAnnual },
    { label: "capex", current: assumptions.renoCostPerSqFt, original: originalAssumptions.renoCostPerSqFt },
    { label: "closing costs", current: assumptions.closingCostPct, original: originalAssumptions.closingCostPct },
    { label: "mortgage rate", current: assumptions.mortgageRate, original: originalAssumptions.mortgageRate },
    { label: "amortization", current: assumptions.amortizationYears, original: originalAssumptions.amortizationYears },
    { label: "leverage", current: assumptions.ltvPct, original: originalAssumptions.ltvPct },
    { label: "takeout leverage", current: assumptions.takeoutLtvPct, original: originalAssumptions.takeoutLtvPct },
    { label: "bridge advance", current: assumptions.bridgeAdvancePct, original: originalAssumptions.bridgeAdvancePct },
    { label: "bridge rate", current: assumptions.bridgeRateAnnual, original: originalAssumptions.bridgeRateAnnual },
    { label: "bridge term", current: assumptions.bridgeTermMonths, original: originalAssumptions.bridgeTermMonths },
    { label: "bridge fee", current: assumptions.bridgeFeePct, original: originalAssumptions.bridgeFeePct },
    { label: "interest reserve", current: assumptions.bridgeInterestReserveMonths, original: originalAssumptions.bridgeInterestReserveMonths },
    { label: "hold period", current: assumptions.holdPeriodYears, original: originalAssumptions.holdPeriodYears },
  ];

  for (const item of trackedAssumptions) {
    if (assumptionChanged(item.current, item.original)) labels.push(item.label);
  }

  if (assumptionChanged(modeledRentPerUnit, originalModeledRentPerUnit)) {
    labels.push("turnover rent");
  }

  if (bridgeEnabled !== originalBridgeEnabled) {
    labels.push("bridge toggle");
  }

  const hasUnitRentOverride = unitRentSchedule.some((unit, index) => {
    const original = originalUnitRentSchedule[index];
    if (!original) return true;
    return (
      assumptionChanged(unit.currentMarketRent, original.currentMarketRent) ||
      assumptionChanged(unit.modeledRent, original.modeledRent)
    );
  });
  if (hasUnitRentOverride) labels.push("unit rent schedule");

  const hasExpenseOverride =
    assumptions.operatingExpenses.length !== originalAssumptions.operatingExpenses.length ||
    assumptions.operatingExpenses.some((item) => {
      const original = originalAssumptions.operatingExpenses.find((originalItem) => originalItem.key === item.key);
      return (
        !original ||
        item.isCustom ||
        assumptionChanged(item.rate, original.rate) ||
        assumptionChanged(item.amountAnnual, original.amountAnnual)
      );
    });
  if (hasExpenseOverride) labels.push("operating expenses");

  const uniqueLabels = Array.from(new Set(labels));
  return {
    count: uniqueLabels.length,
    labels: uniqueLabels,
  };
}

function assumptionChanged(
  current: AssumptionValue<number>,
  original: AssumptionValue<number>
): boolean {
  return current.source === "user_override" || Math.abs(current.value - original.value) > 0.000001;
}

function MetricCard(props: {
  label: string;
  value: string;
  description: string;
  formula: string;
}) {
  return (
    <div className={SURFACE_CARD_CLASS}>
      <div className="flex items-center gap-1.5">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">{props.label}</p>
        <InfoTip description={props.description} formula={props.formula} />
      </div>
      <p className="mt-1 text-lg font-semibold tracking-tight text-slate-900">{props.value}</p>
    </div>
  );
}

function toDisplayValue(value: number, format: "currency" | "percent" | "number" | "years" | "months"): number {
  if (format === "percent") return roundTo(value * 100, 2);
  return roundTo(value, 2);
}

function formatNumberInputDraft(value: number): string {
  if (!Number.isFinite(value)) return "";
  return String(value);
}

function formatStaticValue(value: number, format: "currency" | "percent" | "number" | "years" | "months"): string {
  if (format === "currency") return currency(value);
  if (format === "percent") return percent(value * 100);
  if (format === "years") return `${Math.round(value)} yr`;
  if (format === "months") return `${Math.round(value)} mo`;
  return value.toLocaleString("en-CA", { maximumFractionDigits: 2 });
}

function fromDisplayValue(value: number, format: "currency" | "percent" | "number" | "years" | "months"): number {
  if (format === "percent") return value / 100;
  return value;
}

function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function buildRentRollBasis(input: {
  unitRentSchedule: StrategyUnitRentLineItem[];
  modeledUnitCount: number;
  modeledRentAverage: number;
  grossScheduledRentAnnual: number;
}): {
  headline: string;
  detail: string;
  monthlyRentRoll: number;
  grossScheduledRentAnnual: number;
  unitLine: string | null;
} {
  const modeledUnitCount = Math.max(0, input.modeledUnitCount);
  const monthlyRentRoll = Math.max(0, input.modeledRentAverage) * modeledUnitCount;
  const roundedMonthlyRentRoll = roundTo(monthlyRentRoll, 2);
  const roundedAnnualGross = roundTo(input.grossScheduledRentAnnual, 2);

  if (input.unitRentSchedule.length === 0) {
    return {
      headline: `${modeledUnitCount} units x ${currency(input.modeledRentAverage)}/mo average underwriting rent`,
      detail: "No unit-by-unit rent schedule is available, so the table uses the scalar underwriting rent input.",
      monthlyRentRoll: roundedMonthlyRentRoll,
      grossScheduledRentAnnual: roundedAnnualGross,
      unitLine: null,
    };
  }

  const unitValues = input.unitRentSchedule.map((unit) => ({
    label: unit.unitLabel,
    rent: Math.max(0, unit.modeledRent.value),
  }));
  const scheduleMonthlyTotal = unitValues.reduce((sum, unit) => sum + unit.rent, 0);
  const scheduleMatchesModeledUnits = input.unitRentSchedule.length === modeledUnitCount;
  const unitLine = unitValues
    .map((unit) => `${unit.label}: ${currency(unit.rent)}`)
    .join(" + ");

  if (scheduleMatchesModeledUnits) {
    return {
      headline: `${input.unitRentSchedule.length} unit rents sum to ${currency(scheduleMonthlyTotal)}/mo`,
      detail: "The hold table starts from the unit-by-unit underwriting rents, then applies vacancy, expenses, debt service, and annual rent growth.",
      monthlyRentRoll: roundTo(scheduleMonthlyTotal, 2),
      grossScheduledRentAnnual: roundedAnnualGross,
      unitLine: `${unitLine} = ${currency(scheduleMonthlyTotal)}/mo`,
    };
  }

  return {
    headline: `${currency(input.modeledRentAverage)}/mo average underwriting rent applied to ${modeledUnitCount} modeled units`,
    detail: `The unit schedule has ${input.unitRentSchedule.length} rent lines, while this path models ${modeledUnitCount} units. The table uses the average unit rent until the unit schedule matches the modeled count.`,
    monthlyRentRoll: roundedMonthlyRentRoll,
    grossScheduledRentAnnual: roundedAnnualGross,
    unitLine: `${unitLine}; average ${currency(input.modeledRentAverage)}/mo`,
  };
}

function averageUnitRent(
  unitRents: StrategyUnitRentLineItem[],
  rentKey: "currentMarketRent" | "modeledRent"
): number {
  if (unitRents.length === 0) return 0;
  return roundTo(
    unitRents.reduce((sum, unit) => sum + unit[rentKey].value, 0) / unitRents.length,
    2
  );
}

function projectionUnitMonthlyRents(
  unitRents: StrategyUnitRentLineItem[],
  modeledUnits: number
): number[] | undefined {
  const modeledUnitCount = Math.max(0, Math.round(modeledUnits));
  if (modeledUnitCount <= 0 || unitRents.length !== modeledUnitCount) return undefined;
  return unitRents.map((unit) => Math.max(0, unit.modeledRent.value));
}

function cashflowPhaseLabel(year: CashflowProjectionYear): string {
  if (year.financingPhase === "bridge_only") return `Bridge (${year.bridgeMonthsActive} mo)`;
  if (year.financingPhase === "bridge_to_takeout") {
    return `Bridge ${year.bridgeMonthsActive} mo / Takeout ${year.takeoutMonthsActive} mo`;
  }
  return "Permanent debt";
}

function projectionHighlights(
  years: Array<{ year: number; annualCashflow: number }>
): Array<{ year: number; annualCashflow: number }> {
  if (years.length === 0) return [];
  const yearMap = new Map(years.map((year) => [year.year, year]));
  const preferred = [1, 3, 5, years[years.length - 1]?.year ?? 1];
  return Array.from(new Set(preferred))
    .map((yearNumber) => yearMap.get(yearNumber))
    .filter((year): year is { year: number; annualCashflow: number } => Boolean(year));
}

function modeledRentDescription(model: StrategyModel): string {
  if (model.modeledRentBasis === "current" || model.modeledRentBasis === "affordable") {
    return "Monthly underwriting rent used for projections. Current-income strategies start from the current unit-rent schedule, so individual unit edits flow into gross rent, NOI, and the hold-period table.";
  }
  if (model.modeledRentBasis === "renovated" || model.modeledRentBasis === "new_build") {
    return "Monthly underwriting rent used for projections. Market rent on turnover uses the same newer-stock or renovated proxy hierarchy for this listing.";
  }
  return "Monthly underwriting rent used for projections.";
}

function usesCurrentRentForProjection(model: StrategyModel): boolean {
  return model.modeledRentBasis === "current" || model.modeledRentBasis === "affordable" || model.modeledRentBasis === "interim";
}

function modeledRentSourceDetail(
  model: StrategyModel,
  modeledRentPerUnit: AssumptionValue<number>,
  assumptions: ScenarioAssumptions
): string {
  if (model.modeledRentBasis === "current" || model.modeledRentBasis === "affordable") {
    return modeledRentPerUnit.label;
  }
  return `${modeledRentPerUnit.label} Reference proxy: ${assumptions.renovatedRentProxy.label}`;
}

function summarizeSourceDetail(detail: string): { primary: string; secondary?: string } {
  const normalized = detail.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return { primary: "Source: not available" };
  }

  const explicitSourceMatch = normalized.match(/^Source:\s*(.*?)(?:\.\s*)Calculation:\s*(.*)$/);
  if (explicitSourceMatch) {
    return {
      primary: `Source: ${trimTrailingPeriod(explicitSourceMatch[1])}`,
      secondary: `Calculation: ${trimTrailingPeriod(explicitSourceMatch[2])}`,
    };
  }

  const noAdjustmentMatch = normalized.match(/^(.*?)(?:\.\s*)No strategy adjustment \(([^)]+)\)\.?$/);
  if (noAdjustmentMatch) {
    return {
      primary: `Source: ${trimTrailingPeriod(noAdjustmentMatch[1])}`,
      secondary: `Calculation: ${noAdjustmentMatch[2]}`,
    };
  }

  const adjustmentMatch = normalized.match(/^(.*?)(?:\.\s*)Strategy adjustment [^(]+\(([^)]+)\)\.?$/);
  if (adjustmentMatch) {
    return {
      primary: `Source: ${trimTrailingPeriod(adjustmentMatch[1])}`,
      secondary: `Calculation: ${adjustmentMatch[2]}`,
    };
  }

  const proxyMatch = normalized.match(/^(.*?)(?:\.\s*)Reference proxy:\s*(.*)$/);
  if (proxyMatch) {
    return {
      primary: `Source: ${trimTrailingPeriod(proxyMatch[1])}`,
      secondary: `Reference proxy: ${trimTrailingPeriod(proxyMatch[2])}`,
    };
  }

  return { primary: `Source: ${trimTrailingPeriod(normalized)}` };
}

function trimTrailingPeriod(value: string): string {
  return value.replace(/\.+$/, "").trim();
}

function formatFormula(formula: string): { lhs: string | null; rhs: string | null; full: string } {
  const cleaned = formula
    .replace(/\s*[xX]\s*/g, " × ")
    .replace(/\s*\/\s*/g, " / ")
    .replace(/\s*=\s*/g, " = ")
    .replace(/\s+/g, " ")
    .trim();

  const parts = cleaned.split(" = ");
  if (parts.length >= 2) {
    const lhs = parts.shift()?.trim() ?? "";
    const rhs = parts.join(" = ").trim();
    return { lhs, rhs, full: cleaned };
  }

  return { lhs: null, rhs: null, full: cleaned };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function currency(value: number): string {
  return value.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  });
}

function percent(value: number | null): string {
  if (value == null || Number.isNaN(value)) return "n/a";
  return `${value.toFixed(1)}%`;
}

function number(value: number): string {
  return value.toFixed(2);
}
