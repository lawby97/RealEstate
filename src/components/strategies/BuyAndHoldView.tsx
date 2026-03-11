"use client";

import { useState } from "react";
import type { StrategyId } from "@/types/listing";
import type { StrategyMeta } from "@/lib/strategy-applicability";
import type { ScenarioAssumptions } from "@/types/listing";
import type { FinanceResult } from "@/lib/finance";
import { StrategySelector } from "@/components/strategies/StrategySelector";
import { AssumptionRow } from "@/components/assumptions/AssumptionRow";
import type { StrategyApplicabilityResult } from "@/types/listing";

export function BuyAndHoldView({
  assumptions,
  result,
  listingUnits,
}: {
  assumptions: ScenarioAssumptions;
  result: FinanceResult;
  listingUnits: number;
}) {
  return (
    <div className="space-y-8">
      <section>
        <h4 className="mb-3 text-sm font-semibold text-slate-700">Assumptions used</h4>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <AssumptionRow label="Current market rent (per unit)" assumption={assumptions.currentMarketRent} format="currency" />
          <AssumptionRow label="Vacancy rate" assumption={assumptions.vacancyRate} format="percent" />
          <AssumptionRow label="Operating expense ratio" assumption={assumptions.operatingExpenseRatio} format="percent" />
          <AssumptionRow label="Mortgage rate" assumption={assumptions.mortgageRate} format="percent" />
          <AssumptionRow label="Amortization" assumption={assumptions.amortizationYears} format="years" />
          <AssumptionRow label="LTV" assumption={assumptions.ltvPct} format="percent" />
        </div>
      </section>
      <section>
        <h4 className="mb-3 text-sm font-semibold text-slate-700">Current state</h4>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Gross scheduled rent" value={`$${result.grossScheduledRent.toLocaleString("en-CA", { maximumFractionDigits: 0 })}/yr`} />
          <MetricCard label="Effective gross income" value={`$${result.effectiveGrossIncome.toLocaleString("en-CA", { maximumFractionDigits: 0 })}/yr`} />
          <MetricCard label="NOI" value={`$${result.noi.toLocaleString("en-CA", { maximumFractionDigits: 0 })}/yr`} />
          <MetricCard label="Annual debt service" value={`$${result.annualDebtService.toLocaleString("en-CA", { maximumFractionDigits: 0 })}/yr`} />
        </div>
      </section>
      <section>
        <h4 className="mb-3 text-sm font-semibold text-slate-700">Outcome</h4>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Annual cashflow" value={`$${result.annualCashflow.toLocaleString("en-CA", { maximumFractionDigits: 0 })}`} />
          <MetricCard label="Monthly cashflow" value={`$${result.monthlyCashflow.toLocaleString("en-CA", { maximumFractionDigits: 0 })}`} />
          <MetricCard label="DSCR" value={result.dscr.toFixed(2)} />
          <MetricCard label="Cap rate" value={`${(result.capRate * 100).toFixed(2)}%`} />
          {result.cashOnCashReturn != null && (
            <MetricCard label="Cash-on-cash return" value={`${result.cashOnCashReturn.toFixed(1)}%`} />
          )}
          <MetricCard label="Equity required" value={`$${result.equityRequired.toLocaleString("en-CA", { maximumFractionDigits: 0 })}`} />
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 font-semibold text-slate-900">{value}</p>
    </div>
  );
}
