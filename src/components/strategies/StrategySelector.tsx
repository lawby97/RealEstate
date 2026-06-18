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
  const selectedBusinessPlan =
    props.businessPlanResults.find((result) => result.businessPlanId === props.selectedBusinessPlanId) ??
    props.businessPlanResults[0];
  const selectedBusinessPlanMeta = selectedBusinessPlan
    ? props.businessPlanMeta[selectedBusinessPlan.businessPlanId]
    : null;
  const selectedScenario =
    props.scenarioResults.find((result) => result.scenarioId === props.selectedScenarioId) ??
    props.scenarioResults[0];
  const selectedScenarioMeta = selectedScenario ? props.scenarioMeta[selectedScenario.scenarioId] : null;
  const businessPlanStatusCounts = countStatuses(props.businessPlanResults);
  const scenarioStatusCounts = countStatuses(props.scenarioResults);
  const reviewableBusinessPlans =
    businessPlanStatusCounts.applicable + businessPlanStatusCounts.potentially_applicable;
  const reviewableScenarios = scenarioStatusCounts.applicable + scenarioStatusCounts.potentially_applicable;
  const nextMissingInput = selectedScenario?.missingInputs[0] ?? null;

  return (
    <div className="space-y-5">
      <section
        aria-label="Strategy routing summary"
        className="overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 p-4 text-white shadow-[0_16px_40px_rgba(15,23,42,0.16)] sm:p-5"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-100">
              Strategy routing
            </p>
            <h3 className="mt-2 text-lg font-semibold text-white">
              Selected path: {selectedBusinessPlanMeta?.name ?? "Business plan"} /{" "}
              {selectedScenarioMeta?.name ?? "Financing scenario"}
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-blue-50">
              Use this as the underwriting route before reading the detailed model. The buttons below still
              show every path, but this is the one currently driving the playbook.
            </p>
          </div>
          {selectedScenario && (
            <span className="w-fit rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white">
              {STATUS_LABELS[selectedScenario.status]}
            </span>
          )}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StrategyBriefCard
            label="Business plan"
            value={selectedBusinessPlanMeta?.name ?? "No plan selected"}
            detail={selectedBusinessPlan?.reason ?? "Select a plan to focus the model."}
          />
          <StrategyBriefCard
            label="Financing scenario"
            value={selectedScenarioMeta?.name ?? "No scenario selected"}
            detail={selectedScenario ? formatScenarioEnvelope(selectedScenario) : "Choose a financing path."}
          />
          <StrategyBriefCard
            label="Available paths"
            value={`${reviewableScenarios} financing ${reviewableScenarios === 1 ? "path" : "paths"}`}
            detail={`${reviewableBusinessPlans} business ${
              reviewableBusinessPlans === 1 ? "plan" : "plans"
            } reviewable · ${formatStatusCounts(scenarioStatusCounts)}`}
          />
          <StrategyBriefCard
            label="Next missing input"
            value={nextMissingInput ?? (selectedScenario?.status === "not_applicable" ? "Path blocked" : "Ready to model")}
            detail={
              nextMissingInput
                ? "Add this to improve underwriting confidence."
                : selectedScenario?.reason ?? "Detailed assumptions are below."
            }
          />
        </div>
      </section>

      <details className="strategy-selector-compare-disclosure overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
        <summary className="strategy-selector-compare-summary grid cursor-pointer gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700">
              Compare or change paths
            </p>
            <h3 className="mt-1 text-base font-semibold text-slate-900">
              Review alternate business plans and financing scenarios
            </h3>
            <p className="strategy-selector-compare-summary-copy mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              The selected path above keeps driving the playbook. Open this only when you want to switch routes or
              audit why another lender path is blocked.
            </p>
          </div>
          <span className="inline-flex min-h-10 items-center justify-center rounded-full border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">
            <span className="strategy-selector-compare-closed">Show path cards</span>
            <span className="strategy-selector-compare-open">Hide path cards</span>
          </span>
        </summary>

        <div className="strategy-selector-compare-body space-y-5 border-t border-slate-200 p-4 sm:p-5">
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
                    aria-pressed={isSelected}
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
                All scenarios stay available. Eligible ones surface first, but non-eligible paths keep their exact reason.
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
                    aria-pressed={isSelected}
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
      </details>
    </div>
  );
}

function StrategyBriefCard(props: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/10 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-100">{props.label}</p>
      <p className="mt-2 text-base font-semibold text-white">{props.value}</p>
      <p className="mt-2 line-clamp-3 text-xs leading-5 text-blue-50">{props.detail}</p>
    </div>
  );
}

function countStatuses<T extends { status: StrategyApplicabilityStatus }>(results: T[]) {
  return results.reduce<Record<StrategyApplicabilityStatus, number>>(
    (counts, result) => {
      counts[result.status] += 1;
      return counts;
    },
    {
      applicable: 0,
      potentially_applicable: 0,
      needs_more_data: 0,
      not_applicable: 0,
    }
  );
}

function formatStatusCounts(counts: Record<StrategyApplicabilityStatus, number>) {
  const parts = [
    `${counts.applicable} applicable`,
    `${counts.potentially_applicable} potential`,
    `${counts.needs_more_data} needs data`,
  ];

  if (counts.not_applicable > 0) {
    parts.push(`${counts.not_applicable} blocked`);
  }

  return parts.join(" · ");
}

function formatScenarioEnvelope(result: FinancingScenarioApplicabilityResult) {
  const parts = [];

  if (result.maxLeveragePct != null) {
    parts.push(`Max ${result.leverageMetric} ${(result.maxLeveragePct * 100).toFixed(0)}%`);
  }

  if (result.maxAmortizationYears != null) {
    parts.push(`${result.maxAmortizationYears} yr amortization`);
  }

  parts.push(BRIDGE_USAGE_LABELS[result.bridgeUsage]);

  return parts.join(" · ");
}
