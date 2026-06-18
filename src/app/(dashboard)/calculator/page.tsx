"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  AlertTriangle,
  Banknote,
  Calculator,
  CheckCircle2,
  CircleDollarSign,
  Gauge,
  Percent,
  Target,
  Wallet,
} from "lucide-react";
import {
  computeBuyAndHold,
  computeCashflowProjection,
  computeReturnBridge,
  type FinanceInputs,
} from "@/lib/finance";

type CalculatorInputs = {
  price: number;
  units: number;
  rentPerUnit: number;
  vacancyPct: number;
  operatingExpensePct: number;
  downPaymentPct: number;
  mortgageRatePct: number;
  amortizationYears: number;
  closingCostPct: number;
  capitalBudget: number;
  otherIncomeMonthly: number;
};

type ScenarioPreset = {
  key: string;
  title: string;
  badge: string;
  description: string;
  values: CalculatorInputs;
};

type LeverActionTone = "blue" | "strong" | "watch" | "weak";

type LeverAction = {
  label: string;
  value: string;
  detail: string;
  tone: LeverActionTone;
  actionLabel: string;
  onApply: () => void;
};

type AppliedScenarioChange = {
  label: string;
  value: string;
  detail: string;
  cashflow: number;
  dscr: number;
  cashOnCashReturn: number | null;
  cashRequired: number;
};

const DEFAULT_INPUTS: CalculatorInputs = {
  price: 1_000_000,
  units: 5,
  rentPerUnit: 1_500,
  vacancyPct: 3,
  operatingExpensePct: 40,
  downPaymentPct: 25,
  mortgageRatePct: 4.95,
  amortizationYears: 25,
  closingCostPct: 2,
  capitalBudget: 0,
  otherIncomeMonthly: 0,
};

const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    key: "baseline",
    title: "5-plex baseline",
    badge: "Base",
    description: "Balanced first-pass assumptions for a small multifamily screen.",
    values: DEFAULT_INPUTS,
  },
  {
    key: "stress",
    title: "Lender stress",
    badge: "Risk",
    description: "Higher rate, vacancy, and expenses to test whether the deal still carries.",
    values: {
      ...DEFAULT_INPUTS,
      vacancyPct: 5,
      operatingExpensePct: 45,
      mortgageRatePct: 5.75,
    },
  },
  {
    key: "equity",
    title: "Higher equity",
    badge: "Cash",
    description: "More down payment to see whether DSCR and cashflow become financeable.",
    values: {
      ...DEFAULT_INPUTS,
      downPaymentPct: 35,
      mortgageRatePct: 4.75,
    },
  },
];

const CALCULATOR_HOLD_PERIOD_YEARS = 3;
const CALCULATOR_RENT_GROWTH_RATE_ANNUAL = 0.03;
const CALCULATOR_APPRECIATION_RATE_ANNUAL = 0.04;

export default function CalculatorPage() {
  const [inputs, setInputs] = useState<CalculatorInputs>(DEFAULT_INPUTS);
  const [lastScenarioChange, setLastScenarioChange] = useState<AppliedScenarioChange | null>(null);
  const financeInputs = useMemo<FinanceInputs>(() => toFinanceInputs(inputs), [inputs]);
  const result = useMemo(() => computeBuyAndHold(financeInputs), [financeInputs]);
  const cashflowProjection = useMemo(
    () =>
      computeCashflowProjection({
        financeInputs,
        holdPeriodYears: CALCULATOR_HOLD_PERIOD_YEARS,
        rentGrowthRateAnnual: CALCULATOR_RENT_GROWTH_RATE_ANNUAL,
      }),
    [financeInputs]
  );
  const yearOneProjection = cashflowProjection.years[0];
  const finalProjectionYear = cashflowProjection.years[cashflowProjection.years.length - 1];
  const returnBridge = useMemo(
    () =>
      computeReturnBridge({
        result,
        price: inputs.price,
        appreciationRateAnnual: CALCULATOR_APPRECIATION_RATE_ANNUAL,
        mortgageRate: financeInputs.mortgageRate,
        amortizationYears: financeInputs.amortizationYears,
        holdPeriodYears: CALCULATOR_HOLD_PERIOD_YEARS,
        yearOneCashflowOverride: yearOneProjection?.annualCashflow,
        yearOneDebtPaydownOverride: yearOneProjection?.principalPaidYear,
        holdPeriodCashflow: cashflowProjection.totalCashflow,
        exitLoanBalanceOverride: finalProjectionYear?.loanBalanceEnd,
      }),
    [
      cashflowProjection.totalCashflow,
      finalProjectionYear?.loanBalanceEnd,
      financeInputs.amortizationYears,
      financeInputs.mortgageRate,
      inputs.price,
      result,
      yearOneProjection?.annualCashflow,
      yearOneProjection?.principalPaidYear,
    ]
  );
  const verdict = buildInvestmentVerdict(result.annualCashflow, result.dscr, result.cashOnCashReturn);
  const verdictExplanationTitle = buildVerdictExplanationTitle(verdict.tone);
  const breakEvenRentPerUnit = requiredRentPerUnitForDscr(inputs, result.annualDebtService, 1);
  const dscrTargetRentPerUnit = requiredRentPerUnitForDscr(inputs, result.annualDebtService, 1.25);
  const breakEvenRentGap =
    breakEvenRentPerUnit == null ? null : breakEvenRentPerUnit - inputs.rentPerUnit;
  const dscrTargetRentGap =
    dscrTargetRentPerUnit == null ? null : dscrTargetRentPerUnit - inputs.rentPerUnit;
  const targetRentGap =
    dscrTargetRentGap != null && dscrTargetRentGap > 0
      ? dscrTargetRentGap
      : breakEvenRentGap != null && breakEvenRentGap > 0
        ? breakEvenRentGap
        : null;
  const rentNudge = targetRentGap != null ? roundUpToNearest(Math.min(Math.max(targetRentGap, 50), 300), 25) : 50;
  const nextLeverActions: LeverAction[] = [
    {
      label: targetRentGap != null ? "Rent gap" : "Rent cushion",
      value:
        targetRentGap != null
          ? `+${formatCurrency(targetRentGap)}/unit`
          : `${formatCurrency(Math.abs(dscrTargetRentGap ?? breakEvenRentGap ?? 0))}/unit room`,
      detail:
        targetRentGap != null
          ? "Rent is the cleanest first lever because it improves cashflow, CoC, and DSCR at the same time."
          : "Current rent clears the selected lender coverage target. Stress expenses or price next.",
      tone: targetRentGap != null ? "watch" : "strong",
      actionLabel: `Add ${formatCurrency(rentNudge)}/unit`,
      onApply: () =>
        applyScenarioChange({
          label: "Rent lever applied",
          value: `+${formatCurrency(rentNudge)}/unit`,
          detail: `Average monthly rent is now ${formatCurrency(inputs.rentPerUnit + rentNudge)} per unit.`,
          nextInputs: { ...inputs, rentPerUnit: inputs.rentPerUnit + rentNudge },
        }),
    },
    {
      label: "Equity lever",
      value: `${Math.min(50, inputs.downPaymentPct + 5).toFixed(1)}% down`,
      detail: "More equity lowers debt service and can push DSCR over the line, but it can dilute CoC.",
      tone: result.dscr >= 1.25 ? "strong" : "blue",
      actionLabel: "+5% down",
      onApply: () => {
        const nextDownPaymentPct = Math.min(50, inputs.downPaymentPct + 5);
        applyScenarioChange({
          label: "Equity lever applied",
          value: `${nextDownPaymentPct.toFixed(1)}% down`,
          detail: `Down payment moved from ${inputs.downPaymentPct.toFixed(1)}% to ${nextDownPaymentPct.toFixed(1)}%.`,
          nextInputs: { ...inputs, downPaymentPct: nextDownPaymentPct },
        });
      },
    },
    {
      label: "Price discipline",
      value: formatCurrency(Math.max(0, inputs.price * 0.95)),
      detail: "A lower basis improves cash required, loan size, cap rate, DSCR, and downside protection.",
      tone: result.annualCashflow >= 0 ? "blue" : "watch",
      actionLabel: "-5% price",
      onApply: () => {
        const nextPrice = roundToNearest(inputs.price * 0.95, 1_000);
        applyScenarioChange({
          label: "Price lever applied",
          value: formatCurrency(nextPrice),
          detail: `Purchase price moved from ${formatCurrency(inputs.price)} to ${formatCurrency(nextPrice)}.`,
          nextInputs: { ...inputs, price: nextPrice },
        });
      },
    },
    {
      label: "Expense stress",
      value: `${Math.min(70, inputs.operatingExpensePct + 5).toFixed(1)}% OpEx`,
      detail: "Use this to check whether the deal still works after taxes, insurance, repairs, and utilities come in heavier.",
      tone: "weak",
      actionLabel: "+5% OpEx",
      onApply: () => {
        const nextOperatingExpensePct = Math.min(70, inputs.operatingExpensePct + 5);
        applyScenarioChange({
          label: "Expense stress applied",
          value: `${nextOperatingExpensePct.toFixed(1)}% OpEx`,
          detail: `Operating expense ratio moved from ${inputs.operatingExpensePct.toFixed(1)}% to ${nextOperatingExpensePct.toFixed(1)}%.`,
          nextInputs: { ...inputs, operatingExpensePct: nextOperatingExpensePct },
        });
      },
    },
  ];

  function update<K extends keyof CalculatorInputs>(key: K, value: CalculatorInputs[K]) {
    setLastScenarioChange(null);
    setInputs((current) => ({ ...current, [key]: value }));
  }

  function applyPreset(preset: ScenarioPreset) {
    const nextResult = computeBuyAndHold(toFinanceInputs(preset.values));
    setInputs(preset.values);
    setLastScenarioChange({
      label: "Preset applied",
      value: preset.title,
      detail: preset.description,
      cashflow: nextResult.annualCashflow,
      dscr: nextResult.dscr,
      cashOnCashReturn: nextResult.cashOnCashReturn,
      cashRequired: nextResult.equityRequired,
    });
  }

  function resetScenario() {
    setInputs(DEFAULT_INPUTS);
    setLastScenarioChange(null);
  }

  function applyScenarioChange({
    label,
    value,
    detail,
    nextInputs,
  }: {
    label: string;
    value: string;
    detail: string;
    nextInputs: CalculatorInputs;
  }) {
    const nextResult = computeBuyAndHold(toFinanceInputs(nextInputs));
    setInputs(nextInputs);
    setLastScenarioChange({
      label,
      value,
      detail,
      cashflow: nextResult.annualCashflow,
      dscr: nextResult.dscr,
      cashOnCashReturn: nextResult.cashOnCashReturn,
      cashRequired: nextResult.equityRequired,
    });
  }

  return (
    <div className="dashboard-page" style={styles.page}>
      <header className="dashboard-hero" style={styles.hero}>
        <div>
          <p style={styles.eyebrow}>INVESTMENT CALCULATOR</p>
          <h1 style={styles.title}>Stress-test a deal before it reaches underwriting</h1>
          <p style={styles.heroCopy}>
            Use this quick model for first-pass buy-and-hold math. It shares the same core finance engine as listing analysis, so the outputs are directionally consistent with the dashboard.
          </p>
          <div style={styles.heroActions}>
            <Link href="/" style={styles.primaryLink}>Back to dashboard</Link>
            <Link href="/underwriting" style={styles.secondaryLink}>Borrower underwriting</Link>
          </div>
        </div>
        <div style={styles.heroBadge}>
          <Calculator size={22} />
          Live scenario
        </div>
      </header>

      <CalculatorDecisionStrip
        verdict={verdict}
        primaryAction={nextLeverActions[0]}
        dscr={result.dscr}
        annualCashflow={result.annualCashflow}
        cashRequired={result.equityRequired}
        threeYearCashflow={cashflowProjection.totalCashflow}
        cashOnCashReturn={yearOneProjection?.cashOnCashReturn ?? result.cashOnCashReturn}
        yearOneRoiValue={returnBridge.totalYearOneReturn}
        cocCalculation={`${formatCurrency(yearOneProjection?.annualCashflow ?? result.annualCashflow)} / ${formatCurrency(result.equityRequired)} = ${formatPercent(yearOneProjection?.cashOnCashReturn ?? result.cashOnCashReturn)}`}
        roiValueCalculation={`${formatCurrency(returnBridge.yearOneCashflow)} CF + ${formatCurrency(returnBridge.yearOneDebtPaydown)} paydown + ${formatCurrency(returnBridge.yearOneAppreciation)} appreciation = ${formatCurrency(returnBridge.totalYearOneReturn)}`}
        dscrTargetRentPerUnit={dscrTargetRentPerUnit}
        dscrTargetRentGap={dscrTargetRentGap}
      />

      <CalculatorScenarioQuickControls
        inputs={inputs}
        result={result}
        dscrTargetRentPerUnit={dscrTargetRentPerUnit}
        onApply={applyScenarioChange}
      />

      <CalculatorScenarioStatus
        inputs={inputs}
        result={result}
        lastScenarioChange={lastScenarioChange}
        onReset={resetScenario}
      />

      <section id="calculator-returns" style={styles.investorBridgePanel}>
        <div style={styles.bridgeHeader}>
          <div>
            <p style={styles.bridgeEyebrow}>3-YEAR INVESTOR READ</p>
            <h2 style={styles.bridgeTitle}>Cashflow, CoC, and ROI value creation</h2>
            <p style={styles.bridgeCopy}>
              This is the first-pass return stack using your current inputs, {formatPercent(CALCULATOR_RENT_GROWTH_RATE_ANNUAL * 100)} annual rent growth, and {formatPercent(CALCULATOR_APPRECIATION_RATE_ANNUAL * 100)} annual appreciation.
            </p>
          </div>
          <span style={styles.bridgeBadge}>
            {CALCULATOR_HOLD_PERIOD_YEARS}-year hold
          </span>
        </div>

        <div className="calculator-bridge-metric-grid" style={styles.bridgeMetricGrid}>
          <BridgeMetric
            label="3-year cashflow"
            value={formatCurrency(cashflowProjection.totalCashflow)}
            detail="Cumulative after debt service"
            tone={toneForReturn(cashflowProjection.totalCashflow)}
          />
          <BridgeMetric
            label="Year 1 CoC"
            value={formatPercent(yearOneProjection?.cashOnCashReturn ?? result.cashOnCashReturn)}
            detail={`${formatCurrency(yearOneProjection?.annualCashflow ?? result.annualCashflow)} / ${formatCurrency(result.equityRequired)}`}
            tone={toneForReturn(yearOneProjection?.cashOnCashReturn ?? result.cashOnCashReturn, 6)}
          />
          <BridgeMetric
            label="Year 1 ROI"
            value={formatPercent(returnBridge.totalYearOneRoiPct)}
            detail="Cashflow + paydown + appreciation"
            tone={toneForReturn(returnBridge.totalYearOneRoiPct)}
          />
          <BridgeMetric
            label="3-year ROI"
            value={formatPercent(returnBridge.holdPeriodRoiPct)}
            detail={`${formatCurrency(returnBridge.holdPeriodTotalReturn)} total return`}
            tone={toneForReturn(returnBridge.holdPeriodRoiPct)}
          />
        </div>

        <div className="calculator-year-grid" style={styles.yearGrid}>
          {cashflowProjection.years.map((year) => (
            <CashflowYearCard
              key={year.year}
              year={year.year}
              annualCashflow={year.annualCashflow}
              monthlyCashflow={year.monthlyCashflow}
              dscr={year.dscr}
            />
          ))}
        </div>

        <details className="calculator-bridge-formula-disclosure" style={styles.bridgeFormulaDisclosure}>
          <summary className="calculator-bridge-formula-summary" style={styles.bridgeFormulaSummary}>
            <span>
              <strong style={styles.bridgeFormulaSummaryTitle}>Show return calculations</strong>
              <span style={styles.bridgeFormulaSummaryCopy}>CoC, Year 1 ROI value, and 3-year ROI bridge</span>
            </span>
            <span style={styles.bridgeFormulaSummaryBadge}>Audit math</span>
          </summary>
          <div className="calculator-bridge-formula-grid" style={styles.bridgeFormulaGrid}>
            <BridgeFormulaCard
              label="CoC calculation"
              value={`${formatCurrency(yearOneProjection?.annualCashflow ?? result.annualCashflow)} / ${formatCurrency(result.equityRequired)} = ${formatPercent(yearOneProjection?.cashOnCashReturn ?? result.cashOnCashReturn)}`}
            />
            <BridgeFormulaCard
              label="Year 1 ROI value"
              value={`${formatCurrency(returnBridge.yearOneCashflow)} CF + ${formatCurrency(returnBridge.yearOneDebtPaydown)} paydown + ${formatCurrency(returnBridge.yearOneAppreciation)} appreciation = ${formatCurrency(returnBridge.totalYearOneReturn)}`}
            />
            <BridgeFormulaCard
              label="3-year ROI value"
              value={`${formatCurrency(returnBridge.holdPeriodCashflow)} CF + ${formatCurrency(returnBridge.holdPeriodProjectedEquity - result.equityRequired)} equity growth = ${formatCurrency(returnBridge.holdPeriodTotalReturn)}`}
            />
          </div>
        </details>
      </section>

      <section id="calculator-verdict" style={{ ...styles.panel, ...styles.verdictPanel }}>
        <div style={styles.verdictHeader}>
          <div>
            <p style={styles.verdictEyebrow}>INVESTOR VERDICT</p>
            <h2 style={styles.verdictTitle}>{verdictExplanationTitle}</h2>
            <p style={styles.verdictCopy}>{verdict.copy}</p>
          </div>
          <span style={{ ...styles.verdictBadge, ...verdictBadgeStyle(verdict.tone) }}>
            {verdict.tone === "strong" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            {verdict.label}
          </span>
        </div>

        <div style={styles.verdictMetricGrid}>
          <VerdictMetric
            icon={<Target size={18} />}
            label="Break-even rent"
            value={breakEvenRentPerUnit == null ? "n/a" : `${formatCurrency(breakEvenRentPerUnit)} / unit`}
            detail={rentGapLabel(breakEvenRentGap, "break even")}
            tone={breakEvenRentGap != null && breakEvenRentGap <= 0 ? "strong" : "watch"}
          />
          <VerdictMetric
            icon={<Gauge size={18} />}
            label="1.25x DSCR rent"
            value={dscrTargetRentPerUnit == null ? "n/a" : `${formatCurrency(dscrTargetRentPerUnit)} / unit`}
            detail={rentGapLabel(dscrTargetRentGap, "clear 1.25x DSCR")}
            tone={dscrTargetRentGap != null && dscrTargetRentGap <= 0 ? "strong" : "watch"}
          />
          <VerdictMetric
            icon={<Wallet size={18} />}
            label="Cash required"
            value={formatCurrency(result.equityRequired)}
            detail={`${formatCurrency(result.closingCosts)} closing costs + ${formatCurrency(result.capitalBudget)} capital budget`}
            tone="blue"
          />
        </div>

        <div style={styles.formulaGrid}>
          <FormulaCard
            icon={<CircleDollarSign size={16} />}
            label="Cashflow formula"
            value={`${formatCurrency(result.noi)} NOI - ${formatCurrency(result.annualDebtService)} debt service = ${formatCurrency(result.annualCashflow)}`}
          />
          <FormulaCard
            icon={<Percent size={16} />}
            label="CoC formula"
            value={`${formatCurrency(result.annualCashflow)} / ${formatCurrency(result.equityRequired)} = ${formatPercent(result.cashOnCashReturn)}`}
          />
          <FormulaCard
            icon={<Gauge size={16} />}
            label="DSCR formula"
            value={`${formatCurrency(result.noi)} / ${formatCurrency(result.annualDebtService)} = ${result.dscr.toFixed(2)}x`}
          />
        </div>
      </section>

      <section id="calculator-levers" style={styles.leverPanel}>
        <div style={styles.leverHeader}>
          <div>
            <p style={styles.leverEyebrow}>NEXT LEVER</p>
            <h2 style={styles.leverTitle}>What to change first</h2>
            <p style={styles.leverCopy}>
              These buttons move the assumptions that usually change lender coverage and investor return fastest. Use them to explore, then fine-tune the inputs below.
            </p>
          </div>
          <span style={styles.leverBadge}>
            {verdict.label}
          </span>
        </div>
        <div className="calculator-lever-grid" style={styles.leverGrid}>
          {nextLeverActions.map((action) => (
            <LeverActionCard key={action.label} action={action} />
          ))}
        </div>
      </section>

      <div className="dashboard-two-column" style={styles.layout}>
        <section id="calculator-inputs" style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h2 style={styles.panelTitle}>Scenario inputs</h2>
              <p style={styles.panelSubtitle}>Start with a preset, then adjust the property, rent, debt, and expense assumptions.</p>
            </div>
            <button type="button" onClick={resetScenario} style={styles.resetButton}>
              Reset
            </button>
          </div>

          <div style={styles.presetPanel}>
            <div style={styles.presetHeader}>
              <strong style={styles.presetTitle}>Scenario starter</strong>
              <span style={styles.presetHint}>Use these to move the big assumptions first.</span>
            </div>
            <div className="calculator-preset-grid" style={styles.presetGrid}>
              {SCENARIO_PRESETS.map((preset) => {
                const active = isPresetActive(inputs, preset.values);
                return (
                  <button
                    key={preset.key}
                    type="button"
                    className="calculator-preset-button"
                    onClick={() => applyPreset(preset)}
                    style={{
                      ...styles.presetButton,
                      ...(active ? styles.presetButtonActive : {}),
                    }}
                    aria-label={`${active ? "Current preset" : "Apply preset"}: ${preset.title}`}
                    aria-pressed={active}
                  >
                    <span style={styles.presetButtonTop}>
                      <strong>{preset.title}</strong>
                      <span style={active ? styles.presetBadgeActive : styles.presetBadge}>{preset.badge}</span>
                    </span>
                    <span style={styles.presetDescription}>{preset.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="calculator-input-guide" style={styles.inputGuide} aria-label="Scenario input edit order">
            <div style={styles.inputGuideHeader}>
              <strong style={styles.inputGuideTitle}>Edit in this order</strong>
              <span style={styles.inputGuideHint}>Fastest path to a cleaner read before touching every field.</span>
            </div>
            <div className="calculator-input-guide-grid" style={styles.inputGuideGrid}>
              <InputGuideStep
                step="1"
                title="Price and units"
                value={`${formatCurrency(inputs.price)} · ${inputs.units} units`}
                detail="Sets basis, loan size, and per-unit economics."
              />
              <InputGuideStep
                step="2"
                title="Rent and vacancy"
                value={`${formatCurrency(inputs.rentPerUnit)}/unit · ${inputs.vacancyPct.toFixed(1)}% vacancy`}
                detail="Usually the biggest swing in cashflow and DSCR."
              />
              <InputGuideStep
                step="3"
                title="Debt and cash"
                value={`${inputs.downPaymentPct.toFixed(1)}% down · ${inputs.mortgageRatePct.toFixed(2)}% rate`}
                detail={`${formatCurrency(result.equityRequired)} modeled cash in.`}
              />
            </div>
          </div>

          <div className="calculator-input-sections" style={styles.inputSections}>
            <CalculatorInputSection
              eyebrow="1. Property and rent roll"
              title="Start with the asset and income shape"
              detail="These fields set the basis, gross scheduled rent, and per-unit economics before risk and debt are layered in."
            >
              <MoneyInput label="Purchase price" value={inputs.price} onChange={(value) => update("price", value)} />
              <NumberInput label="Units" value={inputs.units} min={1} step={1} onChange={(value) => update("units", Math.max(1, Math.round(value)))} />
              <MoneyInput label="Average monthly rent / unit" value={inputs.rentPerUnit} onChange={(value) => update("rentPerUnit", value)} />
              <MoneyInput label="Other income / month" value={inputs.otherIncomeMonthly} onChange={(value) => update("otherIncomeMonthly", value)} />
            </CalculatorInputSection>

            <CalculatorInputSection
              eyebrow="2. Operating risk"
              title="Stress the income before debt"
              detail="Vacancy and operating costs move NOI directly. Tighten these before trusting cashflow or DSCR."
            >
              <PercentInput label="Vacancy" value={inputs.vacancyPct} onChange={(value) => update("vacancyPct", value)} />
              <PercentInput label="Operating expense ratio" value={inputs.operatingExpensePct} onChange={(value) => update("operatingExpensePct", value)} />
            </CalculatorInputSection>

            <CalculatorInputSection
              eyebrow="3. Debt and capital stack"
              title="Size cash, loan terms, and capital budget"
              detail="These fields determine required equity, annual debt service, and whether the scenario survives lender coverage."
            >
              <PercentInput label="Down payment" value={inputs.downPaymentPct} onChange={(value) => update("downPaymentPct", value)} />
              <PercentInput label="Mortgage rate" value={inputs.mortgageRatePct} step={0.05} onChange={(value) => update("mortgageRatePct", value)} />
              <NumberInput label="Amortization" value={inputs.amortizationYears} min={1} max={50} suffix="years" onChange={(value) => update("amortizationYears", Math.round(value))} />
              <PercentInput label="Closing costs" value={inputs.closingCostPct} onChange={(value) => update("closingCostPct", value)} />
              <MoneyInput label="Renovation / capital budget" value={inputs.capitalBudget} onChange={(value) => update("capitalBudget", value)} />
            </CalculatorInputSection>
          </div>
          <div style={styles.sliderPanel}>
            <div style={styles.sliderHeader}>
              <div>
                <strong style={styles.sliderTitle}>Down payment sensitivity</strong>
                <p style={styles.sliderCopy}>Slide this first to see how cash required, DSCR, and CoC move together.</p>
              </div>
              <span style={styles.sliderValue}>{inputs.downPaymentPct.toFixed(1)}%</span>
            </div>
            <input
              aria-label="Down payment percentage"
              type="range"
              min={5}
              max={50}
              step={0.5}
              value={inputs.downPaymentPct}
              onInput={(event) => update("downPaymentPct", Number(event.currentTarget.value))}
              onChange={(event) => update("downPaymentPct", Number(event.target.value))}
              style={styles.rangeInput}
            />
            <div style={styles.sliderScale}>
              <span>5%</span>
              <span>25% commercial baseline</span>
              <span>50%</span>
            </div>
            <div className="calculator-downpayment-impact-grid" style={styles.downPaymentImpactGrid}>
              <DownPaymentImpactMetric
                label="Down payment"
                value={formatCurrency(inputs.price * (inputs.downPaymentPct / 100))}
                detail={`${inputs.downPaymentPct.toFixed(1)}% of ${formatCurrency(inputs.price)}`}
              />
              <DownPaymentImpactMetric
                label="Closing + capital"
                value={formatCurrency(result.closingCosts + result.capitalBudget)}
                detail={`${formatCurrency(result.closingCosts)} closing · ${formatCurrency(result.capitalBudget)} capex`}
              />
              <DownPaymentImpactMetric
                label="Total cash in"
                value={formatCurrency(result.equityRequired)}
                detail="Down payment + closing + capital budget"
                tone={result.equityRequired <= inputs.price * 0.3 ? "strong" : "watch"}
              />
              <DownPaymentImpactMetric
                label="Loan amount"
                value={formatCurrency(result.loanAmount)}
                detail={`${formatPercent((1 - inputs.downPaymentPct / 100) * 100)} loan-to-price`}
              />
            </div>
          </div>
        </section>

        <aside id="calculator-deal-read" style={styles.panel}>
          <h2 style={styles.panelTitle}>Deal read</h2>
          <p style={styles.panelSubtitle}>A quick lender-style bridge from income to cashflow.</p>
          <div style={styles.resultList}>
            <ResultRow label="Gross scheduled rent" value={formatCurrency(result.grossScheduledRent)} />
            <ResultRow label="Effective gross income" value={formatCurrency(result.effectiveGrossIncome)} />
            <ResultRow label="Operating expenses" value={formatCurrency(result.operatingExpenses)} />
            <ResultRow label="NOI" value={formatCurrency(result.noi)} strong />
            <ResultRow label="Loan amount" value={formatCurrency(result.loanAmount)} />
            <ResultRow label="Annual debt service" value={formatCurrency(result.annualDebtService)} />
            <ResultRow label="Cap rate" value={`${(result.capRate * 100).toFixed(2)}%`} strong />
          </div>
          <div style={styles.noteBox}>
            <Banknote size={18} />
            <span>
              This is a screening calculator. Taxes, insurance, utilities, repairs, rent roll quality, lender stress tests, and CMHC/commercial underwriting can materially change the final answer.
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}

function CalculatorScenarioQuickControls({
  inputs,
  result,
  dscrTargetRentPerUnit,
  onApply,
}: {
  inputs: CalculatorInputs;
  result: ReturnType<typeof computeBuyAndHold>;
  dscrTargetRentPerUnit: number | null;
  onApply: (change: {
    label: string;
    value: string;
    detail: string;
    nextInputs: CalculatorInputs;
  }) => void;
}) {
  const unitOptions = [4, 5, 8];
  const rentActions = [
    {
      label: "-$100",
      detail: "Stress current rents",
      nextRent: Math.max(0, inputs.rentPerUnit - 100),
    },
    {
      label: "+$100",
      detail: "Light rent lift",
      nextRent: inputs.rentPerUnit + 100,
    },
    {
      label: "+$250",
      detail: "Turnover upside",
      nextRent: inputs.rentPerUnit + 250,
    },
  ];
  const targetRentAction =
    dscrTargetRentPerUnit != null && Number.isFinite(dscrTargetRentPerUnit)
      ? {
          label: "1.25x",
          detail: "Set DSCR rent",
          nextRent: Math.max(0, Math.ceil(dscrTargetRentPerUnit / 25) * 25),
        }
      : null;
  const downPaymentOptions = [20, 25, 35];
  const activeTone = result.annualCashflow >= 0 && result.dscr >= 1.25 ? "strong" : result.annualCashflow >= 0 || result.dscr >= 1.1 ? "watch" : "weak";
  const palette = metricPalette(activeTone);

  return (
    <section className="calculator-scenario-quick-controls" style={styles.quickControlsPanel} aria-label="Calculator scenario quick controls">
      <div className="calculator-scenario-quick-header" style={styles.quickControlsHeader}>
        <div style={{ minWidth: 0 }}>
          <p style={{ ...styles.scenarioStatusEyebrow, color: palette.color }}>Scenario quick switch</p>
          <h2 style={styles.quickControlsTitle}>Change the deal shape before reading the math</h2>
          <p style={styles.quickControlsCopy}>
            These are the fastest investor levers: unit count, rent per unit, and cash/debt terms. Use them first, then fine-tune the full form below.
          </p>
        </div>
        <div style={{ ...styles.quickControlsStatus, borderColor: palette.border, backgroundColor: palette.bg }}>
          <span style={{ ...styles.quickControlsStatusLabel, color: palette.color }}>Current model</span>
          <strong style={styles.quickControlsStatusValue}>{formatCurrency(inputs.rentPerUnit)}/unit · {inputs.units} units</strong>
          <span style={styles.quickControlsStatusDetail}>
            {formatCurrency(result.annualCashflow)} Y1 CF · {result.dscr.toFixed(2)}x DSCR
          </span>
        </div>
      </div>

      <div className="calculator-scenario-quick-grid" style={styles.quickControlsGrid}>
        <div className="calculator-scenario-quick-card" style={styles.quickControlsCard}>
          <span style={styles.quickControlsLabel}>Unit count</span>
          <div className="calculator-scenario-quick-button-grid" style={styles.quickControlsButtonGrid}>
            {unitOptions.map((units) => {
              const active = Math.round(inputs.units) === units;
              return (
                <button
                  key={units}
                  type="button"
                  data-calculator-units={units}
                  aria-pressed={active}
                  className="calculator-scenario-quick-button"
                  onClick={() =>
                    onApply({
                      label: "Unit count changed",
                      value: `${units} units`,
                      detail: `Modeled unit count changed from ${inputs.units} to ${units}.`,
                      nextInputs: { ...inputs, units },
                    })
                  }
                  style={active ? { ...styles.quickControlsButton, ...styles.quickControlsButtonActive } : styles.quickControlsButton}
                >
                  <strong>{units}</strong>
                  <span>{units >= 5 ? "Plex lane" : "Small rental"}</span>
                </button>
              );
            })}
          </div>
          <p style={styles.quickControlsHelp}>Use 5 or 8 units when testing the personal-lender exception path.</p>
        </div>

        <div className="calculator-scenario-quick-card" style={styles.quickControlsCard}>
          <span style={styles.quickControlsLabel}>Rent lever</span>
          <div className="calculator-scenario-quick-button-grid" style={styles.quickControlsButtonGrid}>
            {[...rentActions, ...(targetRentAction ? [targetRentAction] : [])].map((action) => (
              <button
                key={`${action.label}:${action.nextRent}`}
                type="button"
                data-calculator-rent-action={action.label}
                className="calculator-scenario-quick-button"
                onClick={() =>
                  onApply({
                    label: "Rent lever applied",
                    value: `${formatCurrency(action.nextRent)}/unit`,
                    detail: `${action.detail}; rent changed from ${formatCurrency(inputs.rentPerUnit)} to ${formatCurrency(action.nextRent)} per unit.`,
                    nextInputs: { ...inputs, rentPerUnit: action.nextRent },
                  })
                }
                style={styles.quickControlsButton}
              >
                <strong>{action.label}</strong>
                <span>{formatCurrency(action.nextRent)}</span>
              </button>
            ))}
          </div>
          <p style={styles.quickControlsHelp}>Rent moves cashflow, CoC, and DSCR at the same time.</p>
        </div>

        <div className="calculator-scenario-quick-card" style={styles.quickControlsCard}>
          <span style={styles.quickControlsLabel}>Cash and debt</span>
          <div className="calculator-scenario-quick-button-grid" style={styles.quickControlsButtonGrid}>
            {downPaymentOptions.map((downPaymentPct) => {
              const active = Math.abs(inputs.downPaymentPct - downPaymentPct) < 0.01;
              return (
                <button
                  key={downPaymentPct}
                  type="button"
                  data-calculator-down-payment={downPaymentPct}
                  aria-pressed={active}
                  className="calculator-scenario-quick-button"
                  onClick={() =>
                    onApply({
                      label: "Down payment changed",
                      value: `${downPaymentPct}% down`,
                      detail: `Down payment changed from ${inputs.downPaymentPct.toFixed(1)}% to ${downPaymentPct.toFixed(1)}%.`,
                      nextInputs: { ...inputs, downPaymentPct },
                    })
                  }
                  style={active ? { ...styles.quickControlsButton, ...styles.quickControlsButtonActive } : styles.quickControlsButton}
                >
                  <strong>{downPaymentPct}%</strong>
                  <span>{formatCurrency(inputs.price * (downPaymentPct / 100))}</span>
                </button>
              );
            })}
            <button
              type="button"
              data-calculator-rate-stress="0.5"
              className="calculator-scenario-quick-button"
              onClick={() => {
                const nextRate = Math.round((inputs.mortgageRatePct + 0.5) * 100) / 100;
                onApply({
                  label: "Rate stress applied",
                  value: `${nextRate.toFixed(2)}% rate`,
                  detail: `Mortgage rate changed from ${inputs.mortgageRatePct.toFixed(2)}% to ${nextRate.toFixed(2)}%.`,
                  nextInputs: { ...inputs, mortgageRatePct: nextRate },
                });
              }}
              style={styles.quickControlsButton}
            >
              <strong>+0.50%</strong>
              <span>Rate stress</span>
            </button>
          </div>
          <p style={styles.quickControlsHelp}>Higher cash can help DSCR, but may dilute cash-on-cash return.</p>
        </div>
      </div>
    </section>
  );
}

function CalculatorScenarioStatus({
  inputs,
  result,
  lastScenarioChange,
  onReset,
}: {
  inputs: CalculatorInputs;
  result: ReturnType<typeof computeBuyAndHold>;
  lastScenarioChange: AppliedScenarioChange | null;
  onReset: () => void;
}) {
  return (
    <section className="calculator-scenario-status" style={styles.scenarioStatusPanel} aria-label="Current calculator scenario">
      <div className="calculator-scenario-status-header" style={styles.scenarioStatusHeader}>
        <div>
          <p style={styles.scenarioStatusEyebrow}>Current scenario drivers</p>
          <h2 style={styles.scenarioStatusTitle}>
            {lastScenarioChange ? `${lastScenarioChange.label}: ${lastScenarioChange.value}` : "Know what is driving the numbers"}
          </h2>
          <p style={styles.scenarioStatusCopy}>
            {lastScenarioChange
              ? lastScenarioChange.detail
              : "These are the big assumptions currently driving cashflow, CoC, DSCR, and required cash."}
          </p>
        </div>
        <button type="button" onClick={onReset} style={styles.scenarioResetButton}>
          Reset scenario
        </button>
      </div>

      {lastScenarioChange && (
        <div className="calculator-scenario-change-grid" style={styles.scenarioChangeGrid}>
          <ScenarioChangeMetric label="Cashflow" value={formatCurrency(lastScenarioChange.cashflow)} tone={lastScenarioChange.cashflow >= 0 ? "strong" : "weak"} />
          <ScenarioChangeMetric label="DSCR" value={`${lastScenarioChange.dscr.toFixed(2)}x`} tone={lastScenarioChange.dscr >= 1.25 ? "strong" : lastScenarioChange.dscr >= 1.1 ? "watch" : "weak"} />
          <ScenarioChangeMetric
            label="CoC"
            value={formatPercent(lastScenarioChange.cashOnCashReturn)}
            tone={
              lastScenarioChange.cashOnCashReturn == null
                ? "weak"
                : lastScenarioChange.cashOnCashReturn >= 0
                  ? "strong"
                  : "weak"
            }
          />
          <ScenarioChangeMetric label="Cash required" value={formatCurrency(lastScenarioChange.cashRequired)} tone="blue" />
        </div>
      )}

      <div className="calculator-driver-grid" style={styles.scenarioDriverGrid}>
        <ScenarioDriver label="Price / unit" value={formatCurrency(inputs.price / Math.max(1, inputs.units))} detail={`${formatCurrency(inputs.price)} total`} />
        <ScenarioDriver label="Rent / unit" value={`${formatCurrency(inputs.rentPerUnit)}/mo`} detail={`${Math.round(inputs.units)} modeled units`} />
        <ScenarioDriver label="Down payment" value={`${inputs.downPaymentPct.toFixed(1)}%`} detail={`${formatCurrency(result.equityRequired)} cash required`} />
        <ScenarioDriver label="Debt terms" value={`${inputs.mortgageRatePct.toFixed(2)}%`} detail={`${inputs.amortizationYears} yr amortization`} />
        <ScenarioDriver label="Risk load" value={`${inputs.operatingExpensePct.toFixed(1)}% OpEx`} detail={`${inputs.vacancyPct.toFixed(1)}% vacancy`} />
      </div>
    </section>
  );
}

function ScenarioChangeMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "blue" | "strong" | "watch" | "weak";
}) {
  const palette = metricPalette(tone);
  return (
    <div style={{ ...styles.scenarioChangeMetric, borderColor: palette.border, backgroundColor: palette.bg }}>
      <span style={styles.scenarioChangeLabel}>{label}</span>
      <strong style={{ ...styles.scenarioChangeValue, color: palette.color }}>{value}</strong>
    </div>
  );
}

function ScenarioDriver({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div style={styles.scenarioDriver}>
      <span style={styles.scenarioDriverLabel}>{label}</span>
      <strong style={styles.scenarioDriverValue}>{value}</strong>
      <span style={styles.scenarioDriverDetail}>{detail}</span>
    </div>
  );
}

function CalculatorDecisionStrip({
  verdict,
  primaryAction,
  dscr,
  annualCashflow,
  cashRequired,
  threeYearCashflow,
  cashOnCashReturn,
  yearOneRoiValue,
  cocCalculation,
  roiValueCalculation,
  dscrTargetRentPerUnit,
  dscrTargetRentGap,
}: {
  verdict: { tone: "strong" | "watch" | "weak"; label: string; title: string; copy: string };
  primaryAction: LeverAction;
  dscr: number;
  annualCashflow: number;
  cashRequired: number;
  threeYearCashflow: number;
  cashOnCashReturn: number | null;
  yearOneRoiValue: number;
  cocCalculation: string;
  roiValueCalculation: string;
  dscrTargetRentPerUnit: number | null;
  dscrTargetRentGap: number | null;
}) {
  const palette = metricPalette(verdict.tone);
  const primaryButtonLabel = decisionLeverButtonLabel(primaryAction.label);
  const targetRentDetail =
    dscrTargetRentGap == null
      ? "Coverage target unavailable with current expense assumptions."
      : dscrTargetRentGap <= 0
        ? `Current rent clears 1.25x DSCR by ${formatCurrency(Math.abs(dscrTargetRentGap))}/unit.`
        : `Needs about ${formatCurrency(dscrTargetRentGap)}/unit more.`;

  return (
    <section className="calculator-decision-strip" style={styles.decisionStrip} aria-label="Calculator decision summary">
      <div className="calculator-decision-grid" style={styles.decisionGrid}>
        <div className="calculator-decision-copy">
          <p style={styles.decisionEyebrow}>Investor first glance</p>
          <h2 style={styles.decisionTitle}>{verdict.title}</h2>
          <p style={styles.decisionCopy}>{verdict.copy}</p>
          <div className="calculator-decision-links" style={styles.decisionLinks}>
            <a href="#calculator-returns" style={styles.decisionLink}>Returns</a>
            <a href="#calculator-levers" style={styles.decisionLink}>Levers</a>
            <a href="#calculator-inputs" style={styles.decisionLink}>Inputs</a>
            <a href="#calculator-deal-read" style={styles.decisionLink}>Deal read</a>
          </div>
        </div>

        <div
          className="calculator-decision-return-card"
          style={{ ...styles.decisionStatusCard, borderColor: palette.border, backgroundColor: palette.bg }}
        >
          <span style={{ ...styles.decisionBadge, color: palette.color, borderColor: palette.border }}>
            First-glance returns
          </span>
          <div style={styles.decisionStatusGrid}>
            <DecisionMiniMetric label="Y1 cashflow" value={formatCurrency(annualCashflow)} />
            <DecisionMiniMetric label="3Y cashflow" value={formatCurrency(threeYearCashflow)} />
            <DecisionMiniMetric label="CoC" value={formatPercent(cashOnCashReturn)} />
            <DecisionMiniMetric label="ROI value" value={formatCurrency(yearOneRoiValue)} />
            <DecisionMiniMetric label="DSCR" value={`${dscr.toFixed(2)}x`} />
          </div>
          <div className="calculator-decision-formula-stack" style={styles.decisionFormulaStack}>
            <DecisionFormulaLine label="CoC" value={cocCalculation} />
            <DecisionFormulaLine label="ROI value" value={roiValueCalculation} />
            <DecisionFormulaLine label="Cash in" value={formatCurrency(cashRequired)} />
          </div>
        </div>

        <div className="calculator-decision-action-stack" style={styles.decisionActionStack}>
          <div style={styles.decisionActionCard}>
            <p style={styles.decisionActionLabel}>Next best lever</p>
            <strong style={styles.decisionActionValue}>{primaryAction.value}</strong>
            <p style={styles.decisionActionDetail}>{primaryAction.detail}</p>
            <div className="calculator-decision-actions" style={styles.decisionActions}>
              <button
                type="button"
                aria-label={`${primaryButtonLabel}: ${primaryAction.actionLabel}`}
                onClick={primaryAction.onApply}
                style={styles.decisionPrimaryButton}
              >
                {primaryButtonLabel}
              </button>
              <a href="#calculator-inputs" style={styles.decisionSecondaryButton}>
                Fine-tune inputs
              </a>
            </div>
          </div>

          <div style={styles.decisionTargetCard}>
            <p style={styles.decisionActionLabel}>1.25x DSCR rent</p>
            <strong style={styles.decisionActionValue}>
              {dscrTargetRentPerUnit == null ? "n/a" : `${formatCurrency(dscrTargetRentPerUnit)} / unit`}
            </strong>
            <p style={styles.decisionActionDetail}>{targetRentDetail}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function DecisionMiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.decisionMiniMetric}>
      <span style={styles.decisionMiniLabel}>{label}</span>
      <strong style={styles.decisionMiniValue}>{value}</strong>
    </div>
  );
}

function DecisionFormulaLine({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.decisionFormulaLine}>
      <span style={styles.decisionFormulaLabel}>{label}</span>
      <strong style={styles.decisionFormulaValue}>{value}</strong>
    </div>
  );
}

function InputGuideStep({
  step,
  title,
  value,
  detail,
}: {
  step: string;
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <div style={styles.inputGuideStep}>
      <span style={styles.inputGuideStepNumber}>{step}</span>
      <span style={styles.inputGuideStepBody}>
        <strong style={styles.inputGuideStepTitle}>{title}</strong>
        <span style={styles.inputGuideStepValue}>{value}</span>
        <span style={styles.inputGuideStepDetail}>{detail}</span>
      </span>
    </div>
  );
}

function CalculatorInputSection({
  eyebrow,
  title,
  detail,
  children,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  children: ReactNode;
}) {
  return (
    <section className="calculator-input-section" style={styles.inputSection}>
      <div style={styles.inputSectionHeader}>
        <div style={{ minWidth: 0 }}>
          <p style={styles.inputSectionEyebrow}>{eyebrow}</p>
          <h3 style={styles.inputSectionTitle}>{title}</h3>
          <p style={styles.inputSectionDetail}>{detail}</p>
        </div>
      </div>
      <div className="calculator-input-section-grid" style={styles.inputSectionGrid}>
        {children}
      </div>
    </section>
  );
}

function DownPaymentImpactMetric({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "default" | "strong" | "watch";
}) {
  const color = tone === "strong" ? "#166534" : tone === "watch" ? "#92400e" : "#0f172a";
  return (
    <div className="calculator-downpayment-impact-card" style={styles.downPaymentImpactCard}>
      <span style={styles.downPaymentImpactLabel}>{label}</span>
      <strong style={{ ...styles.downPaymentImpactValue, color }}>{value}</strong>
      <span style={styles.downPaymentImpactDetail}>{detail}</span>
    </div>
  );
}

function VerdictMetric({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  tone: "blue" | "strong" | "watch" | "weak";
}) {
  const palette = metricPalette(tone);

  return (
    <div style={styles.verdictMetric}>
      <span style={{ ...styles.verdictMetricIcon, backgroundColor: palette.bg, borderColor: palette.border, color: palette.color }}>
        {icon}
      </span>
      <div>
        <p style={styles.verdictMetricLabel}>{label}</p>
        <p style={styles.verdictMetricValue}>{value}</p>
        <p style={styles.verdictMetricDetail}>{detail}</p>
      </div>
    </div>
  );
}

function FormulaCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div style={styles.formulaCard}>
      <div style={styles.formulaLabel}>
        {icon}
        {label}
      </div>
      <div style={styles.formulaValue}>{value}</div>
    </div>
  );
}

function BridgeMetric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "strong" | "watch" | "weak";
}) {
  const palette = metricPalette(tone);

  return (
    <div className="calculator-bridge-metric" style={{ ...styles.bridgeMetric, borderColor: palette.border, backgroundColor: palette.bg }}>
      <p style={styles.bridgeMetricLabel}>{label}</p>
      <p style={{ ...styles.bridgeMetricValue, color: palette.color }}>{value}</p>
      <p style={styles.bridgeMetricDetail}>{detail}</p>
    </div>
  );
}

function CashflowYearCard({
  year,
  annualCashflow,
  monthlyCashflow,
  dscr,
}: {
  year: number;
  annualCashflow: number;
  monthlyCashflow: number;
  dscr: number;
}) {
  const tone = annualCashflow >= 0 ? "strong" : "weak";
  const palette = metricPalette(tone);

  return (
    <div className="calculator-year-card" style={styles.yearCard}>
      <div style={styles.yearCardTop}>
        <span style={styles.yearPill}>Y{year}</span>
        <span style={{ ...styles.dscrPill, color: palette.color, backgroundColor: palette.bg, borderColor: palette.border }}>
          {dscr.toFixed(2)}x DSCR
        </span>
      </div>
      <div style={{ ...styles.yearCashflow, color: palette.color }}>{formatCurrency(annualCashflow)}</div>
      <div style={styles.yearDetail}>{formatCurrency(monthlyCashflow)} / month</div>
    </div>
  );
}

function BridgeFormulaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="calculator-bridge-formula-card" style={styles.bridgeFormulaCard}>
      <div style={styles.bridgeFormulaLabel}>{label}</div>
      <div style={styles.bridgeFormulaValue}>{value}</div>
    </div>
  );
}

function LeverActionCard({ action }: { action: LeverAction }) {
  const palette = metricPalette(action.tone);

  return (
    <article className="calculator-lever-card" style={{ ...styles.leverCard, borderColor: palette.border, backgroundColor: palette.bg }}>
      <div style={styles.leverCardHeader}>
        <div>
          <p style={{ ...styles.leverCardLabel, color: palette.color }}>{action.label}</p>
          <p style={styles.leverCardValue}>{action.value}</p>
        </div>
        <span style={{ ...styles.leverCardIcon, color: palette.color, borderColor: palette.border }}>
          <Target size={17} />
        </span>
      </div>
      <p style={styles.leverCardDetail}>{action.detail}</p>
      <button
        type="button"
        aria-label={`Apply ${action.label}: ${action.actionLabel}`}
        onClick={action.onApply}
        style={{ ...styles.leverButton, color: palette.color, borderColor: palette.border }}
      >
        {action.actionLabel}
      </button>
    </article>
  );
}

function MoneyInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <FieldShell label={label}>
      <div style={styles.inputWrap}>
        <span style={styles.inputPrefix}>$</span>
        <input
          type="number"
          min={0}
          value={value}
          onChange={(event) => onChange(numberValue(event.target.value))}
          style={{ ...styles.input, paddingLeft: 26 }}
        />
      </div>
    </FieldShell>
  );
}

function PercentInput({
  label,
  value,
  onChange,
  step = 0.25,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
}) {
  return (
    <FieldShell label={label}>
      <div style={styles.inputWrap}>
        <input
          type="number"
          min={0}
          max={100}
          step={step}
          value={value}
          onChange={(event) => onChange(numberValue(event.target.value))}
          style={{ ...styles.input, paddingRight: 34 }}
        />
        <span style={styles.inputSuffix}>%</span>
      </div>
    </FieldShell>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <FieldShell label={label}>
      <div style={styles.inputWrap}>
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(numberValue(event.target.value))}
          style={{ ...styles.input, paddingRight: suffix ? 58 : 11 }}
        />
        {suffix ? <span style={styles.inputSuffix}>{suffix}</span> : null}
      </div>
    </FieldShell>
  );
}

function FieldShell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={styles.field}>
      <span style={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

function ResultRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={styles.resultRow}>
      <span>{label}</span>
      <strong style={{ color: strong ? "#0f172a" : "#334155" }}>{value}</strong>
    </div>
  );
}

function toFinanceInputs(inputs: CalculatorInputs): FinanceInputs {
  return {
    price: inputs.price,
    units: Math.max(1, Math.round(inputs.units)),
    avgMonthlyRentPerUnit: inputs.rentPerUnit,
    vacancyRate: inputs.vacancyPct / 100,
    operatingExpenseRatio: inputs.operatingExpensePct / 100,
    mortgageRate: inputs.mortgageRatePct / 100,
    amortizationYears: inputs.amortizationYears,
    ltvPct: Math.max(0, Math.min(1, 1 - inputs.downPaymentPct / 100)),
    closingCostPct: inputs.closingCostPct / 100,
    capitalBudget: inputs.capitalBudget,
    otherIncomeMonthly: inputs.otherIncomeMonthly,
  };
}

function numberValue(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundToNearest(value: number, nearest: number): number {
  if (!Number.isFinite(value) || nearest <= 0) return 0;
  return Math.round(value / nearest) * nearest;
}

function roundUpToNearest(value: number, nearest: number): number {
  if (!Number.isFinite(value) || nearest <= 0) return 0;
  return Math.ceil(value / nearest) * nearest;
}

function buildInvestmentVerdict(
  annualCashflow: number,
  dscr: number,
  cashOnCashReturn: number | null
): { tone: "strong" | "watch" | "weak"; label: string; title: string; copy: string } {
  if (annualCashflow >= 0 && dscr >= 1.25 && (cashOnCashReturn ?? -Infinity) >= 0) {
    return {
      tone: "strong",
      label: "Carry clears",
      title: "This scenario carries on first pass",
      copy: "Cashflow is positive, DSCR clears the common 1.25x screen, and the cash-on-cash return is not negative.",
    };
  }

  if (annualCashflow >= 0 || dscr >= 1.1) {
    return {
      tone: "watch",
      label: "Needs review",
      title: "There is a deal shape, but the margin is thin",
      copy: "One core metric is close enough to keep underwriting, but rent roll quality, taxes, insurance, and financing terms need a tighter check.",
    };
  }

  return {
    tone: "weak",
    label: "Does not carry",
    title: "The current assumptions do not support the deal yet",
    copy: "Cashflow and lender coverage are below screen. Use the rent targets and formula bridge before spending time on a deeper review.",
  };
}

function buildVerdictExplanationTitle(tone: "strong" | "watch" | "weak"): string {
  if (tone === "strong") return "Why this scenario is worth underwriting";
  if (tone === "watch") return "What to confirm before underwriting";
  return "Why the model is blocked";
}

function decisionLeverButtonLabel(label: string): string {
  const normalized = label.toLowerCase();
  if (normalized.includes("rent")) return "Apply rent lever";
  if (normalized.includes("equity")) return "Apply equity lever";
  if (normalized.includes("price")) return "Apply price lever";
  if (normalized.includes("expense")) return "Apply expense stress";
  return "Apply next lever";
}

function requiredRentPerUnitForDscr(
  inputs: CalculatorInputs,
  annualDebtServiceAmount: number,
  targetDscr: number
): number | null {
  const units = Math.max(1, Math.round(inputs.units));
  const vacancyRate = Math.max(0, inputs.vacancyPct / 100);
  const expenseRatio = Math.max(0, inputs.operatingExpensePct / 100);
  if (vacancyRate >= 1 || expenseRatio >= 1) return null;

  const requiredNoi = annualDebtServiceAmount * targetDscr;
  const requiredEgi = requiredNoi / (1 - expenseRatio);
  const rentDrivenEgi = Math.max(0, requiredEgi - inputs.otherIncomeMonthly * 12);
  return rentDrivenEgi / (1 - vacancyRate) / units / 12;
}

function rentGapLabel(gap: number | null, target: string): string {
  if (gap == null || !Number.isFinite(gap)) return "Target unavailable with current expense assumptions.";
  if (gap <= 0) return `Current rent clears ${target} by ${formatCurrency(Math.abs(gap))}/unit/month.`;
  return `Needs about ${formatCurrency(gap)}/unit/month more to ${target}.`;
}

function metricPalette(tone: "blue" | "strong" | "watch" | "weak") {
  return {
    blue: { bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" },
    strong: { bg: "#ecfdf3", border: "#bbf7d0", color: "#166534" },
    watch: { bg: "#fffbeb", border: "#fde68a", color: "#b45309" },
    weak: { bg: "#fef2f2", border: "#fecaca", color: "#b91c1c" },
  }[tone];
}

function verdictBadgeStyle(tone: "strong" | "watch" | "weak"): CSSProperties {
  if (tone === "strong") {
    return { backgroundColor: "#dcfce7", borderColor: "#86efac", color: "#166534" };
  }
  if (tone === "watch") {
    return { backgroundColor: "#fef3c7", borderColor: "#fcd34d", color: "#92400e" };
  }
  return { backgroundColor: "#fee2e2", borderColor: "#fca5a5", color: "#991b1b" };
}

function toneForReturn(value: number | null | undefined, strongAt = 0): "strong" | "watch" | "weak" {
  if (value == null || !Number.isFinite(value)) return "weak";
  if (value >= strongAt) return "strong";
  if (value >= 0) return "watch";
  return "weak";
}

function isPresetActive(inputs: CalculatorInputs, presetValues: CalculatorInputs): boolean {
  return (Object.keys(presetValues) as Array<keyof CalculatorInputs>).every((key) => inputs[key] === presetValues[key]);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatPercent(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "n/a";
  return `${value.toFixed(1)}%`;
}

const styles: Record<string, CSSProperties> = {
  page: {
    padding: 24,
    backgroundColor: "#f8fafc",
    minHeight: "100%",
  },
  hero: {
    display: "flex",
    justifyContent: "space-between",
    gap: 20,
    flexWrap: "wrap",
    background: "linear-gradient(135deg, #ffffff 0%, #eff6ff 100%)",
    border: "1px solid #dbeafe",
    borderRadius: 8,
    padding: 22,
    marginBottom: 20,
  },
  eyebrow: {
    margin: 0,
    fontSize: 11,
    color: "#2563eb",
    fontWeight: 900,
    letterSpacing: "0.1em",
  },
  title: {
    margin: "6px 0 0",
    color: "#0f172a",
    fontSize: 30,
    lineHeight: 1.15,
  },
  heroCopy: {
    margin: "8px 0 0",
    maxWidth: 820,
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.65,
  },
  heroActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
  },
  primaryLink: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: "#2563eb",
    color: "#fff",
    padding: "10px 13px",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 800,
  },
  secondaryLink: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: "#fff",
    border: "1px solid #bfdbfe",
    color: "#1d4ed8",
    padding: "10px 13px",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 800,
  },
  heroBadge: {
    alignSelf: "flex-start",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    backgroundColor: "#fff",
    border: "1px solid #dbeafe",
    color: "#1e3a8a",
    padding: "11px 12px",
    fontSize: 13,
    fontWeight: 800,
  },
  decisionStrip: {
    borderRadius: 14,
    border: "1px solid #bfdbfe",
    background: "linear-gradient(135deg, #ffffff 0%, #eff6ff 62%, #f8fafc 100%)",
    boxShadow: "0 14px 34px rgba(37, 99, 235, 0.08)",
    padding: 18,
    marginBottom: 20,
  },
  decisionGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 0.95fr) minmax(360px, 1.18fr) minmax(240px, 0.72fr)",
    gap: 12,
    alignItems: "stretch",
  },
  decisionEyebrow: {
    margin: 0,
    color: "#2563eb",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  decisionTitle: {
    margin: "6px 0 0",
    color: "#0f172a",
    fontSize: 22,
    lineHeight: 1.18,
  },
  decisionCopy: {
    margin: "8px 0 0",
    color: "#475569",
    fontSize: 13,
    lineHeight: 1.6,
    maxWidth: 760,
  },
  decisionLinks: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  decisionLink: {
    borderRadius: 999,
    border: "1px solid #bfdbfe",
    backgroundColor: "#fff",
    color: "#1d4ed8",
    padding: "6px 9px",
    textDecoration: "none",
    fontSize: 12,
    fontWeight: 850,
  },
  decisionStatusCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "solid",
    padding: 13,
    minWidth: 0,
  },
  decisionBadge: {
    display: "inline-flex",
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "solid",
    backgroundColor: "#fff",
    padding: "5px 8px",
    fontSize: 11,
    fontWeight: 900,
  },
  decisionStatusGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))",
    gap: 8,
    marginTop: 10,
  },
  decisionMiniMetric: {
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.24)",
    backgroundColor: "rgba(255,255,255,0.68)",
    padding: 8,
    minWidth: 0,
  },
  decisionMiniLabel: {
    display: "block",
    color: "#64748b",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },
  decisionMiniValue: {
    display: "block",
    marginTop: 4,
    color: "#0f172a",
    fontSize: 17,
    lineHeight: 1.15,
    overflowWrap: "anywhere",
  },
  decisionFormulaStack: {
    display: "grid",
    gap: 7,
    marginTop: 10,
    paddingTop: 10,
    borderTop: "1px solid rgba(148,163,184,0.28)",
  },
  decisionFormulaLine: {
    display: "grid",
    gap: 3,
    minWidth: 0,
  },
  decisionFormulaLabel: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },
  decisionFormulaValue: {
    color: "#0f172a",
    fontSize: 12,
    lineHeight: 1.35,
    overflowWrap: "anywhere",
  },
  decisionActionCard: {
    borderRadius: 12,
    border: "1px solid #dbeafe",
    backgroundColor: "#fff",
    padding: 13,
    minWidth: 0,
    display: "grid",
    alignContent: "start",
    gap: 7,
  },
  decisionActionStack: {
    display: "grid",
    gap: 12,
    minWidth: 0,
  },
  decisionTargetCard: {
    borderRadius: 12,
    border: "1px solid #bae6fd",
    backgroundColor: "#ecfeff",
    padding: 13,
    minWidth: 0,
    display: "grid",
    alignContent: "start",
    gap: 7,
  },
  scenarioStatusPanel: {
    marginBottom: 20,
    borderRadius: 14,
    border: "1px solid #dbeafe",
    background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
    padding: 16,
    boxShadow: "0 12px 30px rgba(15,23,42,0.06)",
  },
  quickControlsPanel: {
    marginBottom: 20,
    borderRadius: 14,
    border: "1px solid #dbeafe",
    background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 52%, #eff6ff 100%)",
    padding: 16,
    boxShadow: "0 12px 30px rgba(15,23,42,0.06)",
  },
  quickControlsHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
    flexWrap: "wrap",
    marginBottom: 12,
  },
  quickControlsTitle: {
    margin: "5px 0 0",
    color: "#0f172a",
    fontSize: 20,
    lineHeight: 1.2,
  },
  quickControlsCopy: {
    margin: "6px 0 0",
    color: "#475569",
    fontSize: 13,
    lineHeight: 1.55,
    maxWidth: 860,
  },
  quickControlsStatus: {
    minWidth: 230,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "solid",
    padding: 11,
  },
  quickControlsStatusLabel: {
    display: "block",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  quickControlsStatusValue: {
    display: "block",
    marginTop: 4,
    color: "#0f172a",
    fontSize: 17,
    lineHeight: 1.15,
  },
  quickControlsStatusDetail: {
    display: "block",
    marginTop: 5,
    color: "#475569",
    fontSize: 12,
    lineHeight: 1.35,
  },
  quickControlsGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(220px, 0.7fr) minmax(300px, 1fr) minmax(300px, 1fr)",
    gap: 12,
  },
  quickControlsCard: {
    minWidth: 0,
    borderRadius: 13,
    border: "1px solid #dbeafe",
    backgroundColor: "rgba(255,255,255,0.84)",
    padding: 12,
  },
  quickControlsLabel: {
    display: "block",
    color: "#475569",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  quickControlsButtonGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 8,
    marginTop: 10,
  },
  quickControlsButton: {
    minWidth: 0,
    minHeight: 68,
    display: "grid",
    gap: 4,
    alignContent: "center",
    justifyItems: "center",
    borderRadius: 11,
    border: "1px solid #dbeafe",
    backgroundColor: "#fff",
    color: "#334155",
    padding: "8px 7px",
    cursor: "pointer",
    textAlign: "center",
    fontSize: 12,
    lineHeight: 1.2,
  },
  quickControlsButtonActive: {
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff",
    color: "#1d4ed8",
    boxShadow: "inset 0 0 0 1px #2563eb",
  },
  quickControlsHelp: {
    margin: "9px 0 0",
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.45,
  },
  scenarioStatusHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
    marginBottom: 12,
  },
  scenarioStatusEyebrow: {
    margin: 0,
    color: "#2563eb",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  scenarioStatusTitle: {
    margin: "5px 0 0",
    color: "#0f172a",
    fontSize: 20,
    lineHeight: 1.2,
  },
  scenarioStatusCopy: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.55,
    maxWidth: 780,
  },
  scenarioResetButton: {
    borderRadius: 999,
    border: "1px solid #bfdbfe",
    backgroundColor: "#fff",
    color: "#1d4ed8",
    padding: "8px 11px",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
  scenarioChangeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: 9,
    marginBottom: 12,
  },
  scenarioChangeMetric: {
    borderRadius: 11,
    borderWidth: 1,
    borderStyle: "solid",
    padding: 11,
    minWidth: 0,
  },
  scenarioChangeLabel: {
    display: "block",
    color: "#64748b",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  scenarioChangeValue: {
    display: "block",
    marginTop: 5,
    fontSize: 18,
    lineHeight: 1.15,
    overflowWrap: "anywhere",
  },
  scenarioDriverGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 9,
  },
  scenarioDriver: {
    minWidth: 0,
    borderRadius: 11,
    border: "1px solid #e2e8f0",
    backgroundColor: "#fff",
    padding: 11,
  },
  scenarioDriverLabel: {
    display: "block",
    color: "#64748b",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  scenarioDriverValue: {
    display: "block",
    marginTop: 5,
    color: "#0f172a",
    fontSize: 17,
    lineHeight: 1.16,
    overflowWrap: "anywhere",
  },
  scenarioDriverDetail: {
    display: "block",
    marginTop: 5,
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.35,
  },
  decisionActionLabel: {
    margin: 0,
    color: "#64748b",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },
  decisionActionValue: {
    color: "#0f172a",
    fontSize: 20,
    lineHeight: 1.12,
    overflowWrap: "anywhere",
  },
  decisionActionDetail: {
    margin: 0,
    color: "#475569",
    fontSize: 12,
    lineHeight: 1.45,
  },
  decisionActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  decisionPrimaryButton: {
    border: 0,
    borderRadius: 999,
    backgroundColor: "#2563eb",
    color: "#fff",
    padding: "8px 10px",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
  decisionSecondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    border: "1px solid #bfdbfe",
    backgroundColor: "#fff",
    color: "#1d4ed8",
    padding: "8px 10px",
    textDecoration: "none",
    fontSize: 12,
    fontWeight: 900,
  },
  investorBridgePanel: {
    background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 52%, #ecfeff 100%)",
    border: "1px solid #bae6fd",
    borderRadius: 14,
    padding: 18,
    marginBottom: 20,
    boxShadow: "0 16px 34px rgba(14, 116, 144, 0.08)",
  },
  bridgeHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 16,
  },
  bridgeEyebrow: {
    margin: 0,
    color: "#0891b2",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.11em",
  },
  bridgeTitle: {
    margin: "6px 0 0",
    color: "#0f172a",
    fontSize: 23,
    lineHeight: 1.18,
  },
  bridgeCopy: {
    margin: "8px 0 0",
    maxWidth: 900,
    color: "#475569",
    fontSize: 13,
    lineHeight: 1.6,
  },
  bridgeBadge: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    border: "1px solid #67e8f9",
    backgroundColor: "#ecfeff",
    color: "#0e7490",
    padding: "8px 11px",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  bridgeMetricGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
  },
  bridgeMetric: {
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#e2e8f0",
    padding: 14,
    minWidth: 0,
  },
  bridgeMetricLabel: {
    margin: 0,
    color: "#64748b",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },
  bridgeMetricValue: {
    margin: "7px 0 0",
    fontSize: 24,
    fontWeight: 900,
    lineHeight: 1.1,
    overflowWrap: "anywhere",
  },
  bridgeMetricDetail: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.45,
  },
  yearGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: 12,
    marginTop: 12,
  },
  yearCard: {
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    backgroundColor: "#fff",
    padding: 14,
    minWidth: 0,
  },
  yearCardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  yearPill: {
    borderRadius: 999,
    backgroundColor: "#0f172a",
    color: "#fff",
    padding: "5px 8px",
    fontSize: 11,
    fontWeight: 900,
  },
  dscrPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#e2e8f0",
    padding: "5px 8px",
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  yearCashflow: {
    fontSize: 23,
    fontWeight: 900,
    lineHeight: 1.1,
    overflowWrap: "anywhere",
  },
  yearDetail: {
    marginTop: 5,
    color: "#64748b",
    fontSize: 12,
  },
  bridgeFormulaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 12,
    marginTop: 12,
  },
  bridgeFormulaDisclosure: {
    marginTop: 14,
    borderRadius: 14,
    border: "1px solid #dbeafe",
    backgroundColor: "#f8fafc",
    padding: 12,
  },
  bridgeFormulaSummary: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 12,
    alignItems: "center",
    cursor: "pointer",
    listStyle: "none",
  },
  bridgeFormulaSummaryTitle: {
    display: "block",
    color: "#0f172a",
    fontSize: 13,
    fontWeight: 900,
  },
  bridgeFormulaSummaryCopy: {
    display: "block",
    marginTop: 3,
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.35,
  },
  bridgeFormulaSummaryBadge: {
    borderRadius: 999,
    border: "1px solid #bfdbfe",
    backgroundColor: "#eff6ff",
    color: "#1d4ed8",
    padding: "6px 9px",
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  bridgeFormulaCard: {
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    backgroundColor: "#f8fafc",
    padding: 13,
    minWidth: 0,
  },
  bridgeFormulaLabel: {
    color: "#0f766e",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.07em",
    textTransform: "uppercase",
  },
  bridgeFormulaValue: {
    marginTop: 7,
    color: "#0f172a",
    fontSize: 13,
    lineHeight: 1.45,
    fontWeight: 800,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    overflowWrap: "anywhere",
  },
  verdictPanel: {
    marginBottom: 20,
    background: "linear-gradient(135deg, #0f172a 0%, #172554 58%, #1d4ed8 100%)",
    borderColor: "rgba(147,197,253,0.45)",
    color: "#fff",
    boxShadow: "0 18px 40px rgba(30,58,138,0.2)",
  },
  verdictHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 18,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  verdictEyebrow: {
    margin: 0,
    color: "#bfdbfe",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.12em",
  },
  verdictTitle: {
    margin: "6px 0 0",
    color: "#fff",
    fontSize: 24,
    lineHeight: 1.2,
  },
  verdictCopy: {
    margin: "8px 0 0",
    maxWidth: 860,
    color: "#dbeafe",
    fontSize: 14,
    lineHeight: 1.65,
  },
  verdictBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#e2e8f0",
    padding: "8px 11px",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  verdictMetricGrid: {
    marginTop: 18,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
  },
  verdictMetric: {
    display: "flex",
    gap: 12,
    minWidth: 0,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.1)",
    padding: 14,
  },
  verdictMetricIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#e2e8f0",
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
  },
  verdictMetricLabel: {
    margin: 0,
    color: "#bfdbfe",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  verdictMetricValue: {
    margin: "6px 0 0",
    color: "#fff",
    fontSize: 21,
    fontWeight: 900,
    lineHeight: 1.12,
    overflowWrap: "anywhere",
  },
  verdictMetricDetail: {
    margin: "6px 0 0",
    color: "#dbeafe",
    fontSize: 12,
    lineHeight: 1.45,
  },
  formulaGrid: {
    marginTop: 12,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 12,
  },
  formulaCard: {
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.15)",
    backgroundColor: "rgba(15,23,42,0.25)",
    padding: 14,
    minWidth: 0,
  },
  formulaLabel: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    color: "#bfdbfe",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  formulaValue: {
    marginTop: 8,
    color: "#fff",
    fontSize: 14,
    fontWeight: 800,
    lineHeight: 1.45,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    overflowWrap: "anywhere",
  },
  leverPanel: {
    borderRadius: 14,
    border: "1px solid #dbeafe",
    background: "linear-gradient(135deg, #ffffff 0%, #eff6ff 100%)",
    padding: 18,
    marginBottom: 20,
    boxShadow: "0 10px 28px rgba(37,99,235,0.08)",
  },
  leverHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 14,
  },
  leverEyebrow: {
    margin: 0,
    color: "#2563eb",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.1em",
  },
  leverTitle: {
    margin: "5px 0 0",
    color: "#0f172a",
    fontSize: 21,
    lineHeight: 1.2,
  },
  leverCopy: {
    margin: "6px 0 0",
    maxWidth: 820,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.55,
  },
  leverBadge: {
    borderRadius: 999,
    border: "1px solid #bfdbfe",
    backgroundColor: "#fff",
    color: "#1d4ed8",
    padding: "7px 10px",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  leverGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: 12,
  },
  leverCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#e2e8f0",
    padding: 14,
    minWidth: 0,
    display: "grid",
    gap: 10,
  },
  leverCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },
  leverCardLabel: {
    margin: 0,
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  leverCardValue: {
    margin: "6px 0 0",
    color: "#0f172a",
    fontSize: 22,
    fontWeight: 900,
    lineHeight: 1.1,
    overflowWrap: "anywhere",
  },
  leverCardIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#e2e8f0",
    backgroundColor: "rgba(255,255,255,0.72)",
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
  },
  leverCardDetail: {
    margin: 0,
    color: "#475569",
    fontSize: 12,
    lineHeight: 1.5,
  },
  leverButton: {
    justifySelf: "start",
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
    padding: "8px 10px",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
  layout: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.45fr) minmax(300px, 0.8fr)",
    gap: 18,
    alignItems: "start",
  },
  panel: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 18,
    boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 16,
  },
  panelTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 20,
  },
  panelSubtitle: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.55,
  },
  resetButton: {
    alignSelf: "flex-start",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    backgroundColor: "#fff",
    color: "#334155",
    padding: "8px 11px",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
  },
  presetPanel: {
    borderRadius: 14,
    border: "1px solid #dbeafe",
    background: "linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)",
    padding: 14,
    marginBottom: 16,
  },
  presetHeader: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 10,
  },
  presetTitle: {
    color: "#0f172a",
    fontSize: 14,
  },
  presetHint: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.4,
  },
  presetGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: 10,
  },
  presetButton: {
    display: "grid",
    gap: 8,
    minWidth: 0,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#bfdbfe",
    backgroundColor: "#fff",
    color: "#0f172a",
    padding: 12,
    textAlign: "left",
    cursor: "pointer",
    boxShadow: "0 1px 3px rgba(15,23,42,0.05)",
  },
  presetButtonActive: {
    borderColor: "#2563eb",
    backgroundColor: "#dbeafe",
    boxShadow: "0 10px 24px rgba(37, 99, 235, 0.14)",
  },
  presetButtonTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    fontSize: 13,
  },
  presetBadge: {
    borderRadius: 999,
    border: "1px solid #dbeafe",
    backgroundColor: "#eff6ff",
    color: "#1d4ed8",
    padding: "3px 7px",
    fontSize: 11,
    fontWeight: 900,
  },
  presetBadgeActive: {
    borderRadius: 999,
    border: "1px solid #1d4ed8",
    backgroundColor: "#2563eb",
    color: "#fff",
    padding: "3px 7px",
    fontSize: 11,
    fontWeight: 900,
  },
  presetDescription: {
    color: "#475569",
    fontSize: 12,
    lineHeight: 1.45,
  },
  inputGuide: {
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    background: "linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)",
    padding: 14,
    marginBottom: 16,
  },
  inputGuideHeader: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 10,
  },
  inputGuideTitle: {
    color: "#0f172a",
    fontSize: 14,
  },
  inputGuideHint: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.4,
  },
  inputGuideGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: 10,
  },
  inputGuideStep: {
    minWidth: 0,
    display: "grid",
    gridTemplateColumns: "32px minmax(0, 1fr)",
    gap: 10,
    alignItems: "start",
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    backgroundColor: "#fff",
    padding: 11,
  },
  inputGuideStepNumber: {
    width: 32,
    height: 32,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    backgroundColor: "#0f172a",
    color: "#fff",
    fontSize: 12,
    fontWeight: 900,
  },
  inputGuideStepBody: {
    minWidth: 0,
    display: "grid",
    gap: 4,
  },
  inputGuideStepTitle: {
    color: "#0f172a",
    fontSize: 13,
    lineHeight: 1.2,
  },
  inputGuideStepValue: {
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: 900,
    lineHeight: 1.25,
    overflowWrap: "anywhere",
  },
  inputGuideStepDetail: {
    color: "#64748b",
    fontSize: 11,
    lineHeight: 1.35,
  },
  inputGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: 14,
  },
  inputSections: {
    display: "grid",
    gap: 12,
  },
  inputSection: {
    borderRadius: 14,
    border: "1px solid #e2e8f0",
    background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
    padding: 14,
    display: "grid",
    gap: 12,
  },
  inputSectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  inputSectionEyebrow: {
    margin: 0,
    color: "#2563eb",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  },
  inputSectionTitle: {
    margin: "4px 0 0",
    color: "#0f172a",
    fontSize: 16,
    lineHeight: 1.22,
  },
  inputSectionDetail: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.5,
  },
  inputSectionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 10,
  },
  sliderPanel: {
    marginTop: 18,
    borderRadius: 8,
    border: "1px solid #dbeafe",
    backgroundColor: "#eff6ff",
    padding: 15,
  },
  sliderHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
  },
  sliderTitle: {
    display: "block",
    color: "#1e3a8a",
    fontSize: 14,
  },
  sliderCopy: {
    margin: "5px 0 0",
    color: "#475569",
    fontSize: 12,
    lineHeight: 1.45,
  },
  sliderValue: {
    borderRadius: 999,
    backgroundColor: "#fff",
    border: "1px solid #bfdbfe",
    color: "#1d4ed8",
    padding: "6px 9px",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  rangeInput: {
    width: "100%",
    marginTop: 14,
    accentColor: "#2563eb",
  },
  sliderScale: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 6,
    color: "#64748b",
    fontSize: 11,
    fontWeight: 700,
  },
  downPaymentImpactGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 8,
    marginTop: 12,
  },
  downPaymentImpactCard: {
    minWidth: 0,
    borderRadius: 10,
    border: "1px solid #bfdbfe",
    backgroundColor: "#fff",
    padding: 10,
    display: "grid",
    gap: 5,
  },
  downPaymentImpactLabel: {
    color: "#475569",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  downPaymentImpactValue: {
    fontSize: 16,
    lineHeight: 1.1,
    fontWeight: 900,
    overflowWrap: "anywhere",
    fontVariantNumeric: "tabular-nums",
  },
  downPaymentImpactDetail: {
    color: "#64748b",
    fontSize: 11,
    lineHeight: 1.35,
  },
  field: {
    display: "block",
  },
  fieldLabel: {
    display: "block",
    marginBottom: 6,
    color: "#475569",
    fontSize: 12,
    fontWeight: 800,
  },
  inputWrap: {
    position: "relative",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    padding: "9px 11px",
    color: "#0f172a",
    fontSize: 14,
  },
  inputPrefix: {
    position: "absolute",
    left: 11,
    top: 10,
    color: "#64748b",
  },
  inputSuffix: {
    position: "absolute",
    right: 10,
    top: 10,
    color: "#64748b",
    fontSize: 13,
  },
  resultList: {
    display: "grid",
    gap: 0,
    marginTop: 14,
  },
  resultRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    padding: "11px 0",
    borderBottom: "1px solid #f1f5f9",
    color: "#64748b",
    fontSize: 13,
  },
  noteBox: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 16,
    borderRadius: 8,
    backgroundColor: "#fff7ed",
    border: "1px solid #fed7aa",
    color: "#9a3412",
    padding: 12,
    fontSize: 13,
    lineHeight: 1.55,
  },
};
