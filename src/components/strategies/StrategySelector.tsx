"use client";

import type {
  BusinessPlanApplicabilityResult,
  BusinessPlanId,
  FinancingScenarioApplicabilityResult,
  StrategyApplicabilityStatus,
  StrategyId,
} from "@/types/listing";
import type { BusinessPlanMeta, StrategyMeta } from "@/lib/strategy-applicability";

const STATUS_STYLES: Record<StrategyApplicabilityStatus, string> = {
  applicable: "border-emerald-200 bg-emerald-50 text-emerald-800",
  potentially_applicable: "border-amber-200 bg-amber-50 text-amber-800",
  needs_more_data: "border-sky-200 bg-sky-50 text-sky-800",
  not_applicable: "border-slate-200 bg-slate-100 text-slate-500",
};

const STATUS_LABELS: Record<StrategyApplicabilityStatus, string> = {
  applicable: "Applicable",
  potentially_applicable: "Potential",
  needs_more_data: "Needs data",
  not_applicable: "Not applicable",
};

const BRIDGE_USAGE_LABELS = {
  not_needed: "Bridge usually not needed",
  optional: "Bridge optional",
  common: "Bridge commonly required",
  core: "Bridge / construction financing core",
} as const;

export function StrategySelector(props: {
  businessPlanResults: BusinessPlanApplicabilityResult[];
  businessPlanMeta: Record<BusinessPlanId, BusinessPlanMeta>;
  selectedBusinessPlanId: BusinessPlanId;
  onSelectBusinessPlan: (businessPlanId: BusinessPlanId) => void;
  scenarioResults: FinancingScenarioApplicabilityResult[];
  scenarioMeta: Record<StrategyId, StrategyMeta>;
  selectedScenarioId: StrategyId;
  onSelectScenario: (scenarioId: StrategyId) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Business plans</h3>
          <p className="mt-1 text-sm text-slate-600">
            Start with the business plan, then compare financing scenarios inside it.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {props.businessPlanResults.map((result) => {
            const meta = props.businessPlanMeta[result.businessPlanId];
            const isSelected = props.selectedBusinessPlanId === result.businessPlanId;
            return (
              <button
                key={result.businessPlanId}
                type="button"
                onClick={() => props.onSelectBusinessPlan(result.businessPlanId)}
                className={`rounded-xl border p-4 text-left transition ${
                  isSelected
                    ? "border-slate-900 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.08)] ring-2 ring-slate-900/5"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{meta.name}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{meta.shortDescription}</p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-semibold ${STATUS_STYLES[result.status]}`}>
                    {STATUS_LABELS[result.status]}
                  </span>
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-500">{result.reason}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Financing scenarios</h3>
          <p className="mt-1 text-sm text-slate-600">
            All scenarios stay visible. Eligible ones surface first, but non-eligible paths keep their exact reason.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {props.scenarioResults.map((result) => {
            const meta = props.scenarioMeta[result.scenarioId];
            const isSelected = props.selectedScenarioId === result.scenarioId;
            return (
              <button
                key={result.scenarioId}
                type="button"
                onClick={() => props.onSelectScenario(result.scenarioId)}
                className={`rounded-xl border p-4 text-left transition ${
                  isSelected
                    ? "border-blue-500 bg-white shadow-[0_1px_3px_rgba(37,99,235,0.12)] ring-2 ring-blue-500/10"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{meta.name}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{meta.shortDescription}</p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-semibold ${STATUS_STYLES[result.status]}`}>
                    {STATUS_LABELS[result.status]}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-medium text-slate-600">
                  {result.maxLeveragePct != null && (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
                      Max {result.leverageMetric} {(result.maxLeveragePct * 100).toFixed(0)}%
                    </span>
                  )}
                  {result.maxAmortizationYears != null && (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
                      {result.maxAmortizationYears} yr max
                    </span>
                  )}
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
                    {BRIDGE_USAGE_LABELS[result.bridgeUsage]}
                  </span>
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-500">{meta.fitSummary}</p>
                <p className="mt-2 text-xs leading-5 text-slate-600">{result.reason}</p>
                {result.missingInputs.length > 0 && (
                  <p className="mt-2 text-[11px] leading-5 text-sky-700">
                    Missing: {result.missingInputs.join(", ")}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
