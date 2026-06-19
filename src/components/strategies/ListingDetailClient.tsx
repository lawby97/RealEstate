"use client";

import { useEffect, useMemo, useState } from "react";
import { buildInvestmentWorkspace, scenariosForBusinessPlan, selectDefaultBusinessPlan, selectDefaultScenario, type InvestmentWorkspace, type InvestmentWorkspaceInput } from "@/lib/investment-workspace";
import { projectUseLabel } from "@/lib/investor-context";
import type { BusinessPlanId, BusinessPlanApplicabilityResult, DealStage, FinancingScenarioApplicabilityResult, InvestorContext, ProjectUse, StrategyApplicabilityStatus, StrategyId } from "@/types/listing";
import type { StrategyModel } from "@/lib/strategy-modeling";
import { StrategySelector } from "./StrategySelector";
import { StrategyPlaybookView } from "./StrategyPlaybookView";

const STATUS_LABELS: Record<StrategyApplicabilityStatus, string> = {
  applicable: "Applicable",
  potentially_applicable: "Potential",
  needs_more_data: "Needs data",
  not_applicable: "Not applicable",
};

const STATUS_PILL_CLASSES: Record<StrategyApplicabilityStatus, string> = {
  applicable: "border-emerald-200 bg-emerald-50 text-emerald-800",
  potentially_applicable: "border-amber-200 bg-amber-50 text-amber-800",
  needs_more_data: "border-sky-200 bg-sky-50 text-sky-800",
  not_applicable: "border-slate-200 bg-slate-100 text-slate-600",
};

type ContextImpactTone = "green" | "amber" | "blue" | "slate";

type ContextImpactItem = {
  label: string;
  value: string;
  detail: string;
  tone: ContextImpactTone;
};

type ContextOverrideSummary = {
  changedCount: number;
  changedLabels: string[];
};

export function ListingDetailClient(props: {
  initialWorkspace: InvestmentWorkspace;
  workspaceInput: Omit<InvestmentWorkspaceInput, "investorContext">;
  investorContextDefaults: InvestorContext;
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
  const selectedModel = workspace.scenarioModels[selectedScenarioId];
  const selectedBusinessPlan =
    workspace.businessPlanResults.find((result) => result.businessPlanId === selectedBusinessPlanId) ??
    workspace.businessPlanResults[0];
  const selectedBusinessPlanMeta = selectedBusinessPlan
    ? workspace.businessPlanMeta[selectedBusinessPlan.businessPlanId]
    : null;
  const selectedScenario =
    scenarioResults.find((result) => result.scenarioId === selectedScenarioId) ?? scenarioResults[0];
  const selectedScenarioMeta = selectedScenario ? workspace.scenarioMeta[selectedScenario.scenarioId] : null;
  const showMultifamilyContext =
    props.workspaceInput.profile.normalizedUnits >= 5 ||
    props.workspaceInput.profile.redevelopmentCandidate ||
    props.workspaceInput.profile.normalizedAssetType === "land" ||
    props.workspaceInput.profile.normalizedAssetType === "parking" ||
    props.workspaceInput.profile.normalizedAssetType === "mixed_use";

  return (
    <div className="min-w-0 max-w-full space-y-8 overflow-hidden">
      <InvestmentPathAtAGlance
        businessPlan={selectedBusinessPlan}
        businessPlanName={selectedBusinessPlanMeta?.name ?? "Business plan"}
        scenario={selectedScenario}
        scenarioName={selectedScenarioMeta?.name ?? "Financing scenario"}
        model={selectedModel}
      />

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

function InvestmentPathAtAGlance(props: {
  businessPlan: BusinessPlanApplicabilityResult | undefined;
  businessPlanName: string;
  scenario: FinancingScenarioApplicabilityResult | undefined;
  scenarioName: string;
  model: StrategyModel | undefined;
}) {
  const nextAction = getPathNextAction(props.scenario, props.model);
  const status = props.scenario?.status ?? props.businessPlan?.status ?? "needs_more_data";
  const statusClass = STATUS_PILL_CLASSES[status];

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
      <div className="grid gap-0 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-5 text-white sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-100">
                Investment path at a glance
              </p>
              <h3 className="mt-2 text-xl font-semibold text-white">
                {props.businessPlanName} / {props.scenarioName}
              </h3>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-200">
                {props.scenario?.reason ?? props.businessPlan?.reason ?? "Select a path to see financing fit and return signals."}
              </p>
            </div>
            <span className={`w-fit rounded-full border px-3 py-1.5 text-xs font-semibold ${statusClass}`}>
              {STATUS_LABELS[status]}
            </span>
          </div>

          <div className="mt-5 rounded-xl border border-white/15 bg-white/10 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-100">Next best move</p>
            <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-base font-semibold text-white">{nextAction.title}</p>
                <p className="mt-1 text-sm leading-6 text-slate-200">{nextAction.detail}</p>
              </div>
              <a
                href={nextAction.href}
                className="inline-flex w-fit items-center justify-center rounded-lg border border-white/20 bg-white px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-blue-50"
              >
                {nextAction.label}
              </a>
            </div>
          </div>
        </div>

        <div className="grid gap-3 bg-slate-50 p-5 sm:grid-cols-2 sm:p-6">
          <PathMetricCard
            label="Y1 cashflow"
            value={props.model ? formatCurrency(props.model.result.annualCashflow) : "n/a"}
            detail={props.model ? `${formatCurrency(props.model.result.monthlyCashflow)}/mo after debt` : "Model not selected"}
            tone={props.model && props.model.result.annualCashflow >= 0 ? "green" : "red"}
          />
          <PathMetricCard
            label="CoC return"
            value={props.model ? formatPercent(props.model.result.cashOnCashReturn) : "n/a"}
            detail="Annual cashflow / equity required"
            tone={props.model?.result.cashOnCashReturn == null ? "slate" : props.model.result.cashOnCashReturn >= 0 ? "green" : "red"}
          />
          <PathMetricCard
            label="Y1 modeled return"
            value={props.model ? formatCurrency(props.model.returnBridge.totalYearOneReturn) : "n/a"}
            detail={props.model ? `${formatPercent(props.model.returnBridge.totalYearOneRoiPct)} modeled ROI; includes non-cash value creation` : "Return bridge unavailable"}
            tone={props.model && props.model.returnBridge.totalYearOneReturn >= 0 ? "green" : "red"}
          />
          <PathMetricCard
            label="Equity required"
            value={props.model ? formatCurrency(props.model.result.equityRequired) : "n/a"}
            detail={props.model ? `${formatNumber(props.model.result.dscr)}x DSCR · ${formatPercent(props.model.programEnvelope.maxLeveragePct * 100)} max ${props.model.programEnvelope.leverageMetric}` : "Debt envelope unavailable"}
            tone="blue"
          />
        </div>
      </div>
    </section>
  );
}

function PathMetricCard(props: {
  label: string;
  value: string;
  detail: string;
  tone: "green" | "red" | "blue" | "slate";
}) {
  const toneClass = {
    green: "text-emerald-700",
    red: "text-rose-700",
    blue: "text-blue-700",
    slate: "text-slate-700",
  }[props.tone];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{props.label}</p>
      <p className={`mt-2 text-xl font-semibold ${toneClass}`}>{props.value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{props.detail}</p>
    </div>
  );
}

function getPathNextAction(
  scenario: FinancingScenarioApplicabilityResult | undefined,
  model: StrategyModel | undefined
) {
  const missingInput = scenario?.missingInputs[0];

  if (missingInput) {
    return {
      title: `Add ${missingInput}`,
      detail: "The model can run, but this missing input is the next confidence upgrade before relying on the path.",
      label: "Open assumptions",
      href: "#playbook-assumptions",
    };
  }

  if (!scenario || !model) {
    return {
      title: "Select a business plan and financing path",
      detail: "Choose the route that matches your buyer profile before reading the underwriting model.",
      label: "Review paths",
      href: "#listing-underwriting",
    };
  }

  if (scenario.status === "not_applicable") {
    return {
      title: "Pick a financeable scenario first",
      detail: "This path is currently blocked for the listing or investor context. Compare eligible paths before underwriting deeply.",
      label: "Compare paths",
      href: "#listing-underwriting",
    };
  }

  if (scenario.status === "needs_more_data") {
    return {
      title: "Fill lender-critical assumptions",
      detail: "The path needs cleaner inputs before the platform can call it financeable with confidence.",
      label: "Open assumptions",
      href: "#playbook-assumptions",
    };
  }

  if (scenario.status === "potentially_applicable") {
    return {
      title: "Verify the lender fit before offer work",
      detail: "The path is plausible. Check DSCR, down payment, and takeout logic before treating the returns as executable.",
      label: "Review decision",
      href: "#playbook-decision",
    };
  }

  return {
    title: "Underwrite the current selected path",
    detail: "The route clears the first-pass screen. Start with return quality, then stress the assumptions and risks below.",
    label: "Review decision",
    href: "#playbook-decision",
  };
}

function InvestorDealContextBar(props: {
  investorContext: InvestorContext;
  defaults: InvestorContext;
  showMultifamilyContext: boolean;
  onChange: (next: InvestorContext) => void;
}) {
  const contextImpactItems = buildContextImpactItems(
    props.investorContext,
    props.defaults,
    props.showMultifamilyContext
  );
  const overrideSummary = getContextOverrideSummary(
    props.investorContext,
    props.defaults,
    props.showMultifamilyContext
  );

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

      <ContextImpactPanel items={contextImpactItems} overrideSummary={overrideSummary} />

      <details className="listing-context-editor-disclosure mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <summary className="listing-context-editor-summary grid cursor-pointer gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700">
              Listing-only overrides
            </p>
            <h4 className="mt-1 text-sm font-semibold text-slate-900">
              Edit borrower, project, and MLI context
            </h4>
            <p className="listing-context-editor-summary-copy mt-1 text-xs leading-5 text-slate-500">
              Open this when you want to test a different occupancy, renovation, or lender-program context for this listing without changing your saved profile.
            </p>
          </div>
          <span className="inline-flex min-h-10 items-center justify-center rounded-full border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">
            <span className="listing-context-editor-closed">Edit context</span>
            <span className="listing-context-editor-open">Hide controls</span>
          </span>
        </summary>

        <div className="listing-context-editor-body border-t border-slate-200 p-3 sm:p-4">
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
            <ToggleField
              label="Will live there"
              testId="context-toggle-live-there"
              value={props.investorContext.willLiveThere}
              trueLabel="Yes"
              falseLabel="No"
              onChange={(value) => update("willLiveThere", value)}
            />
            <ToggleField
              label="First property"
              testId="context-toggle-first-property"
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
              testId="context-toggle-renovations"
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
        </div>
      </details>
    </section>
  );
}

function ContextImpactPanel({
  items,
  overrideSummary,
}: {
  items: ContextImpactItem[];
  overrideSummary: ContextOverrideSummary;
}) {
  const changedDetail =
    overrideSummary.changedCount > 0
      ? overrideSummary.changedLabels.slice(0, 4).join(", ")
      : "Using saved profile defaults for this listing.";

  return (
    <div
      className="listing-context-impact mt-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-4"
      data-testid="listing-context-impact"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Context impact
          </p>
          <h4 className="mt-1 text-sm font-semibold text-slate-900">
            What these toggles change in the underwriting model
          </h4>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {changedDetail}
          </p>
        </div>
        <span
          className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${
            overrideSummary.changedCount > 0
              ? "border-amber-200 bg-amber-50 text-amber-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {overrideSummary.changedCount} listing override{overrideSummary.changedCount === 1 ? "" : "s"}
        </span>
      </div>

      <div className="listing-context-impact-grid mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <ContextImpactCard key={item.label} item={item} />
        ))}
      </div>
    </div>
  );
}

function ContextImpactCard({ item }: { item: ContextImpactItem }) {
  const toneClass = {
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
  }[item.tone];

  return (
    <div className={`listing-context-impact-card min-w-0 rounded-xl border p-3 ${toneClass}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.13em] opacity-80">{item.label}</p>
      <p className="mt-2 text-base font-semibold leading-tight">{item.value}</p>
      <p className="mt-1 text-xs leading-5 opacity-85">{item.detail}</p>
    </div>
  );
}

function buildContextImpactItems(
  context: InvestorContext,
  defaults: InvestorContext,
  showMultifamilyContext: boolean
): ContextImpactItem[] {
  const summary = getContextOverrideSummary(context, defaults, showMultifamilyContext);
  const projectDetail = showMultifamilyContext
    ? `${context.mliAffordabilityCommitmentYears} affordability yrs · energy ${context.mliEnergyPoints} · access ${context.mliAccessibilityPoints}`
    : "5+ unit and MLI controls are hidden for this asset.";

  return [
    {
      label: "Borrower lane",
      value: context.willLiveThere ? "Owner-occupied" : "Investor borrower",
      detail: context.willLiveThere
        ? "May change insured, small-rental, and owner-occupancy paths."
        : "Uses non-owner-occupied rental constraints first.",
      tone: context.willLiveThere ? "blue" : "slate",
    },
    {
      label: "Execution path",
      value: context.dealStage === "new_construction" ? "New construction" : context.plansRenovations ? "Renovation plan" : "Existing asset",
      detail:
        context.dealStage === "new_construction"
          ? "Construction and stabilization scenarios become more relevant."
          : context.plansRenovations
            ? "Bridge, improvement, and refinance assumptions need attention."
            : "Permanent debt and buy-and-hold paths stay in focus.",
      tone: context.dealStage === "new_construction" || context.plansRenovations ? "amber" : "green",
    },
    {
      label: showMultifamilyContext ? "Project use / MLI" : "Asset scope",
      value: showMultifamilyContext ? projectUseLabel(context.projectUse) : "Small-rental screen",
      detail: projectDetail,
      tone: showMultifamilyContext ? "blue" : "slate",
    },
    {
      label: "Profile overrides",
      value: `${summary.changedCount} changed`,
      detail:
        summary.changedCount > 0
          ? summary.changedLabels.slice(0, 3).join(", ")
          : "This listing matches your saved profile defaults.",
      tone: summary.changedCount > 0 ? "amber" : "green",
    },
  ];
}

function getContextOverrideSummary(
  context: InvestorContext,
  defaults: InvestorContext,
  showMultifamilyContext: boolean
): ContextOverrideSummary {
  const fields: Array<{ key: keyof InvestorContext; label: string; multifamilyOnly?: boolean }> = [
    { key: "willLiveThere", label: "occupancy" },
    { key: "firstPropertyBuyer", label: "first-property status" },
    { key: "preferredAssetBand", label: "asset band" },
    { key: "dealStage", label: "deal stage" },
    { key: "plansRenovations", label: "renovation plan" },
    { key: "projectUse", label: "project use", multifamilyOnly: true },
    { key: "residentialSharePct", label: "residential share", multifamilyOnly: true },
    { key: "mliAffordabilityCommitmentYears", label: "affordability years", multifamilyOnly: true },
    { key: "mliEnergyPoints", label: "energy points", multifamilyOnly: true },
    { key: "mliAccessibilityPoints", label: "accessibility points", multifamilyOnly: true },
  ];

  const changedLabels = fields
    .filter((field) => showMultifamilyContext || !field.multifamilyOnly)
    .filter((field) => !Object.is(context[field.key], defaults[field.key]))
    .map((field) => field.label);

  return {
    changedCount: changedLabels.length,
    changedLabels,
  };
}

function ToggleField(props: {
  label: string;
  testId?: string;
  value: boolean;
  trueLabel: string;
  falseLabel: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3" data-testid={props.testId}>
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

function formatCurrency(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "n/a";
  return value.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  });
}

function formatPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "n/a";
  return `${value.toFixed(1)}%`;
}

function formatNumber(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "n/a";
  return value.toFixed(2);
}
