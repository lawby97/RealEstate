"use client";

import { useEffect, useMemo, useState } from "react";
import { buildInvestmentWorkspace, scenariosForBusinessPlan, selectDefaultBusinessPlan, selectDefaultScenario, type InvestmentWorkspace, type InvestmentWorkspaceInput } from "@/lib/investment-workspace";
import { projectUseLabel } from "@/lib/investor-context";
import { deriveQuickDecisionConstraint, summarizeInvestmentWorkspace } from "@/lib/quick-decision";
import { STRATEGY_META } from "@/lib/strategy-applicability";
import type { BusinessPlanId, DataConfidence, DealStage, InvestorContext, ProjectUse, StrategyId } from "@/types/listing";
import { StrategySelector } from "./StrategySelector";
import { StrategyPlaybookView } from "./StrategyPlaybookView";

export function ListingDetailClient(props: {
  initialWorkspace: InvestmentWorkspace;
  workspaceInput: Omit<InvestmentWorkspaceInput, "investorContext">;
  investorContextDefaults: InvestorContext;
  dataConfidence: DataConfidence;
}) {
  const [investorContext, setInvestorContext] = useState<InvestorContext>(props.investorContextDefaults);
  const workspace = useMemo(
    () =>
      buildInvestmentWorkspace({
        ...props.workspaceInput,
        investorContext,
      }),
    [investorContext, props.workspaceInput]
  );
  const [selectedBusinessPlanId, setSelectedBusinessPlanId] = useState<BusinessPlanId>(() => selectDefaultBusinessPlan(props.initialWorkspace));
  const [selectedScenarioId, setSelectedScenarioId] = useState<StrategyId>(() =>
    selectDefaultScenario(props.initialWorkspace, selectDefaultBusinessPlan(props.initialWorkspace))
  );

  useEffect(() => {
    const availableBusinessPlanIds = new Set(workspace.businessPlanResults.map((result) => result.businessPlanId));
    const nextBusinessPlanId = availableBusinessPlanIds.has(selectedBusinessPlanId)
      ? selectedBusinessPlanId
      : selectDefaultBusinessPlan(workspace);
    const scenarios = scenariosForBusinessPlan(workspace, nextBusinessPlanId);
    const availableScenarioIds = new Set(scenarios.map((result) => result.scenarioId));
    const nextScenarioId = availableScenarioIds.has(selectedScenarioId)
      ? selectedScenarioId
      : selectDefaultScenario(workspace, nextBusinessPlanId);

    if (nextBusinessPlanId !== selectedBusinessPlanId) {
      setSelectedBusinessPlanId(nextBusinessPlanId);
    }
    if (nextScenarioId !== selectedScenarioId) {
      setSelectedScenarioId(nextScenarioId);
    }
  }, [selectedBusinessPlanId, selectedScenarioId, workspace]);

  const scenarioResults = useMemo(
    () => scenariosForBusinessPlan(workspace, selectedBusinessPlanId),
    [workspace, selectedBusinessPlanId]
  );
  const quickSummary = useMemo(
    () => summarizeInvestmentWorkspace(workspace, props.dataConfidence),
    [props.dataConfidence, workspace]
  );
  const quickConstraint = useMemo(
    () => deriveQuickDecisionConstraint(quickSummary),
    [quickSummary]
  );
  const selectedModel = workspace.scenarioModels[selectedScenarioId];
  const showMultifamilyContext =
    props.workspaceInput.profile.normalizedUnits >= 5 ||
    props.workspaceInput.profile.redevelopmentCandidate ||
    props.workspaceInput.profile.normalizedAssetType === "land" ||
    props.workspaceInput.profile.normalizedAssetType === "parking" ||
    props.workspaceInput.profile.normalizedAssetType === "mixed_use";

  return (
    <div className="space-y-8">
      <QuickDecisionBar summary={quickSummary} constraint={quickConstraint} />

      <InvestorDealContextBar
        investorContext={investorContext}
        defaults={props.investorContextDefaults}
        showMultifamilyContext={showMultifamilyContext}
        onChange={setInvestorContext}
      />

      <StrategySelector
        businessPlanResults={workspace.businessPlanResults}
        businessPlanMeta={workspace.businessPlanMeta}
        selectedBusinessPlanId={selectedBusinessPlanId}
        onSelectBusinessPlan={(businessPlanId) => {
          setSelectedBusinessPlanId(businessPlanId);
          setSelectedScenarioId(selectDefaultScenario(workspace, businessPlanId));
        }}
        scenarioResults={scenarioResults}
        scenarioMeta={workspace.scenarioMeta}
        selectedScenarioId={selectedScenarioId}
        onSelectScenario={setSelectedScenarioId}
      />

      {selectedModel && <StrategyPlaybookView key={`${selectedBusinessPlanId}:${selectedScenarioId}`} model={selectedModel} />}
    </div>
  );
}

function QuickDecisionBar(props: {
  summary: ReturnType<typeof summarizeInvestmentWorkspace>;
  constraint: ReturnType<typeof deriveQuickDecisionConstraint>;
}) {
  const bestPathLabel = props.summary.primaryScenarioId
    ? STRATEGY_META[props.summary.primaryScenarioId].name
    : "No viable path yet";
  const baseHoldLabel = props.summary.baseHoldScenarioId
    ? STRATEGY_META[props.summary.baseHoldScenarioId].name
    : "Development / land carry only";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Your current context</p>
          <h3 className="mt-1 text-base font-semibold text-slate-900">Fast decision read</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            This summary updates as you change investor context, so the header quick read stays distinct from the market-default cache above.
          </p>
        </div>
        {props.constraint ? (
          <div
            className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
              props.constraint.tone === "emerald"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : props.constraint.tone === "amber"
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : props.constraint.tone === "rose"
                    ? "border-rose-200 bg-rose-50 text-rose-800"
                    : "border-slate-200 bg-slate-50 text-slate-700"
            }`}
          >
            {props.constraint.label}: {typeof props.constraint.value === "number" ? formatMonthlyNumber(props.constraint.value, false) : props.constraint.value}
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <QuickSummaryCard
          label="Best viable cashflow"
          value={props.summary.primaryMonthlyCashflow != null ? formatMonthlyNumber(props.summary.primaryMonthlyCashflow) : "No viable path yet"}
          detail={props.summary.quickVerdict}
        />
        <QuickSummaryCard
          label="Best path"
          value={bestPathLabel}
          detail={props.summary.primaryScenarioStatus ? props.summary.primaryScenarioStatus.replaceAll("_", " ") : "No viable scenario"}
        />
        <QuickSummaryCard
          label="Base hold cashflow"
          value={props.summary.baseHoldMonthlyCashflow != null ? formatMonthlyNumber(props.summary.baseHoldMonthlyCashflow) : "—"}
          detail={baseHoldLabel}
        />
      </div>
    </section>
  );
}

function InvestorDealContextBar(props: {
  investorContext: InvestorContext;
  defaults: InvestorContext;
  showMultifamilyContext: boolean;
  onChange: (next: InvestorContext) => void;
}) {
  const update = <K extends keyof InvestorContext>(key: K, value: InvestorContext[K]) => {
    props.onChange({ ...props.investorContext, [key]: value });
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Investor + deal context</p>
          <h3 className="mt-1 text-sm font-semibold text-slate-900">Use saved profile defaults, then override them for this listing only.</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            These toggles change which financing scenarios are shown as applicable and how the underwriting assumptions are sized. They do not save back to the profile page unless you update the profile separately.
          </p>
        </div>
        <button
          type="button"
          onClick={() => props.onChange(props.defaults)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Reset to profile defaults
        </button>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
        <ToggleField
          label="Will live there"
          value={props.investorContext.willLiveThere}
          trueLabel="Yes"
          falseLabel="No"
          onChange={(value) => update("willLiveThere", value)}
        />
        <ToggleField
          label="First property"
          value={props.investorContext.firstPropertyBuyer}
          trueLabel="Yes"
          falseLabel="No"
          onChange={(value) => update("firstPropertyBuyer", value)}
        />
        <SelectField
          label="Deal stage"
          value={props.investorContext.dealStage}
          onChange={(value) => update("dealStage", value as DealStage)}
          options={[
            { value: "existing", label: "Existing" },
            { value: "new_construction", label: "New construction" },
          ]}
        />
        <ToggleField
          label="Planning improvements now"
          value={props.investorContext.plansRenovations}
          trueLabel="Yes"
          falseLabel="No"
          onChange={(value) => update("plansRenovations", value)}
        />
        {props.showMultifamilyContext && (
          <>
            <SelectField
              label="Project use"
              value={props.investorContext.projectUse}
              onChange={(value) => update("projectUse", value as ProjectUse)}
              options={[
                { value: "standard_rental", label: projectUseLabel("standard_rental") },
                { value: "student", label: projectUseLabel("student") },
                { value: "seniors", label: projectUseLabel("seniors") },
                { value: "supportive_sro", label: projectUseLabel("supportive_sro") },
              ]}
            />
            <NumberField
              label="Residential share override"
              value={props.investorContext.residentialSharePct}
              suffix="%"
              min={0}
              max={100}
              step={1}
              emptyAllowed
              onChange={(value) => update("residentialSharePct", value === null ? null : Math.max(0, Math.min(100, value)))}
            />
            <NumberField
              label="MLI affordability years"
              value={props.investorContext.mliAffordabilityCommitmentYears}
              suffix="yr"
              min={0}
              max={40}
              step={1}
              onChange={(value) => update("mliAffordabilityCommitmentYears", Math.max(0, Math.min(40, value ?? 0)))}
            />
            <SelectField
              label="MLI energy points"
              value={String(props.investorContext.mliEnergyPoints)}
              onChange={(value) => update("mliEnergyPoints", Number(value) as InvestorContext["mliEnergyPoints"])}
              options={[
                { value: "0", label: "0" },
                { value: "20", label: "20" },
                { value: "35", label: "35" },
                { value: "50", label: "50" },
              ]}
            />
            <SelectField
              label="MLI accessibility points"
              value={String(props.investorContext.mliAccessibilityPoints)}
              onChange={(value) => update("mliAccessibilityPoints", Number(value) as InvestorContext["mliAccessibilityPoints"])}
              options={[
                { value: "0", label: "0" },
                { value: "20", label: "20" },
                { value: "30", label: "30" },
              ]}
            />
          </>
        )}
      </div>
    </section>
  );
}

function ToggleField(props: {
  label: string;
  value: boolean;
  trueLabel: string;
  falseLabel: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{props.label}</p>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => props.onChange(true)}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium ${props.value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-600"}`}
        >
          {props.trueLabel}
        </button>
        <button
          type="button"
          onClick={() => props.onChange(false)}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium ${!props.value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-600"}`}
        >
          {props.falseLabel}
        </button>
      </div>
    </div>
  );
}

function SelectField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="rounded-xl border border-slate-200 bg-white p-3">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{props.label}</span>
      <select
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className="mt-3 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-900 outline-none"
      >
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberField(props: {
  label: string;
  value: number | null;
  suffix: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number | null) => void;
  emptyAllowed?: boolean;
}) {
  return (
    <label className="rounded-xl border border-slate-200 bg-white p-3">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{props.label}</span>
      <div className="mt-3 flex items-center rounded-lg border border-slate-300 bg-slate-50 px-3">
        <input
          type="number"
          value={props.value ?? ""}
          min={props.min}
          max={props.max}
          step={props.step}
          onChange={(event) => {
            if (props.emptyAllowed && event.target.value === "") {
              props.onChange(null);
              return;
            }
            const parsed = Number(event.target.value);
            if (!Number.isFinite(parsed)) return;
            props.onChange(parsed);
          }}
          className="w-full appearance-none border-none bg-transparent py-2 text-sm font-medium text-slate-900 outline-none"
        />
        <span className="text-xs font-medium text-slate-500">{props.suffix}</span>
      </div>
    </label>
  );
}

function QuickSummaryCard(props: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{props.label}</p>
      <p className="mt-3 text-xl font-semibold tracking-[-0.02em] text-slate-950">{props.value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{props.detail}</p>
    </div>
  );
}

function formatMonthlyNumber(value: number, withPerMonth = true): string {
  const sign = value < 0 ? "-" : "";
  const formatted = `${sign}$${Math.abs(Math.round(value)).toLocaleString("en-CA")}`;
  return withPerMonth ? `${formatted}/mo` : formatted;
}
