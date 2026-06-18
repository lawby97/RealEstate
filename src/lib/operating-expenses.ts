import type {
  AssumptionSource,
  AssumptionValue,
  BuiltInOperatingExpenseKey,
  DealStage,
  NormalizedAssetType,
  OperatingExpenseBasis,
  OperatingExpenseInputMode,
  OperatingExpenseLineItem,
  OperatingExpenseTemplate,
  OperatingExpenseTemplateBasis,
  PropertyTaxClass,
  PropertyTaxEstimate,
} from "@/types/listing";
import {
  deriveOperatingExpenseRatio,
  resolveOperatingExpenseItemAmount,
  type FinanceOperatingExpenseItem,
} from "@/lib/finance";
import {
  propertyTaxClassLabel,
  propertyTaxMethodLabel,
  resolvePropertyTaxEstimate,
} from "@/lib/property-tax";

export type OperatingExpenseBaselineMode = "existing" | "new_construction" | "covered_land";

interface BuildOperatingExpenseScheduleInput {
  effectiveGrossIncome: number;
  purchasePrice: number;
  propertyTaxEstimate: PropertyTaxEstimate;
  normalizedAssetType: NormalizedAssetType;
  unitCount: number;
  squareFeet: number | null;
  province?: string | null;
  city?: string | null;
  propertyType?: string | null;
  descriptionText?: string | null;
  baselineMode: OperatingExpenseBaselineMode;
  template?: OperatingExpenseTemplate | null;
  sourceExpenseFacts?: Partial<Record<Exclude<BuiltInOperatingExpenseKey, "property_tax">, number>>;
}

interface ExpenseDefaultDefinition {
  basis: OperatingExpenseTemplateBasis;
  value: number;
  label: string;
  description: string;
}

interface AssetBaselineEntry {
  managementFeePct: number;
  insurance: ExpenseDefaultDefinition;
  repairs_maintenance: ExpenseDefaultDefinition;
  utilities_landlord_paid: ExpenseDefaultDefinition;
  utilities_tenant_metered: ExpenseDefaultDefinition;
  snow_landscaping: ExpenseDefaultDefinition;
}

type UtilityResponsibilityProfile = "tenant_metered" | "landlord_paid" | "unknown";

const OPERATING_EXPENSE_BASELINES = {
  small_bay_existing: {
    managementFeePct: 0,
    insurance: {
      basis: "annual_per_unit",
      value: 700,
      label: "Small-bay residential insurance baseline",
      description: "Insurance baseline for 1-4 unit residential assets.",
    },
    repairs_maintenance: {
      basis: "annual_per_unit",
      value: 1100,
      label: "Small-bay repairs baseline",
      description: "Recurring repair, maintenance, and make-ready baseline for 1-4 unit residential assets.",
    },
    utilities_landlord_paid: {
      basis: "annual_per_unit",
      value: 900,
      label: "Small-bay landlord-paid utilities baseline",
      description: "Landlord-paid utility and common-load baseline when the building is not separately metered.",
    },
    utilities_tenant_metered: {
      basis: "annual_per_unit",
      value: 300,
      label: "Small-bay common-area utilities baseline",
      description: "Reduced utility baseline used when tenants appear to pay their own in-suite utilities.",
    },
    snow_landscaping: {
      basis: "annual_per_unit",
      value: 250,
      label: "Small-bay exterior maintenance baseline",
      description: "Snow removal and exterior maintenance baseline for 1-4 unit residential assets.",
    },
  },
  multifamily_existing: {
    managementFeePct: 0,
    insurance: {
      basis: "annual_per_unit",
      value: 550,
      label: "Multifamily insurance baseline",
      description: "Insurance baseline for existing 5+ unit residential assets.",
    },
    repairs_maintenance: {
      basis: "annual_per_unit",
      value: 950,
      label: "Multifamily repairs baseline",
      description: "Recurring repairs and maintenance baseline for existing 5+ unit residential assets.",
    },
    utilities_landlord_paid: {
      basis: "annual_per_unit",
      value: 650,
      label: "Multifamily landlord-paid utilities baseline",
      description: "Landlord-paid utility and common-load baseline for existing multifamily assets.",
    },
    utilities_tenant_metered: {
      basis: "annual_per_unit",
      value: 225,
      label: "Multifamily common-area utilities baseline",
      description: "Common-area-only utility baseline used when units appear separately metered.",
    },
    snow_landscaping: {
      basis: "annual_per_unit",
      value: 180,
      label: "Multifamily exterior maintenance baseline",
      description: "Snow removal and exterior maintenance baseline for existing multifamily assets.",
    },
  },
  residential_new_construction: {
    managementFeePct: 0,
    insurance: {
      basis: "annual_per_unit",
      value: 450,
      label: "New-build insurance baseline",
      description: "Stabilized insurance baseline for new-construction residential rental.",
    },
    repairs_maintenance: {
      basis: "annual_per_unit",
      value: 450,
      label: "New-build repairs baseline",
      description: "Stabilized recurring repair baseline for newly built residential rental.",
    },
    utilities_landlord_paid: {
      basis: "annual_per_unit",
      value: 500,
      label: "New-build landlord-paid utilities baseline",
      description: "Stabilized landlord-paid utility baseline for new residential rental stock.",
    },
    utilities_tenant_metered: {
      basis: "annual_per_unit",
      value: 150,
      label: "New-build common-area utilities baseline",
      description: "Reduced utility baseline when new-construction suites appear tenant-metered.",
    },
    snow_landscaping: {
      basis: "annual_per_unit",
      value: 150,
      label: "New-build exterior maintenance baseline",
      description: "Stabilized snow and exterior maintenance baseline for new-build rental.",
    },
  },
  land_carry: {
    managementFeePct: 0,
    insurance: {
      basis: "annual_total",
      value: 1200,
      label: "Land carry insurance baseline",
      description: "Baseline site insurance while land is being carried.",
    },
    repairs_maintenance: {
      basis: "annual_total",
      value: 500,
      label: "Land carry upkeep baseline",
      description: "Minimal site repairs and upkeep while land is being carried.",
    },
    utilities_landlord_paid: {
      basis: "annual_total",
      value: 300,
      label: "Land carry utilities baseline",
      description: "Minimal utility exposure while land is being carried.",
    },
    utilities_tenant_metered: {
      basis: "annual_total",
      value: 300,
      label: "Land carry utilities baseline",
      description: "Minimal utility exposure while land is being carried.",
    },
    snow_landscaping: {
      basis: "annual_total",
      value: 1200,
      label: "Land carry exterior maintenance baseline",
      description: "Snow removal and grounds maintenance baseline during land carry.",
    },
  },
  parking_carry: {
    managementFeePct: 0,
    insurance: {
      basis: "annual_total",
      value: 1500,
      label: "Parking carry insurance baseline",
      description: "Baseline insurance while a parking asset is being carried.",
    },
    repairs_maintenance: {
      basis: "annual_total",
      value: 750,
      label: "Parking carry upkeep baseline",
      description: "Minimal paving, lighting, and upkeep baseline while parking is held.",
    },
    utilities_landlord_paid: {
      basis: "annual_total",
      value: 600,
      label: "Parking carry utilities baseline",
      description: "Utility exposure baseline while parking is held.",
    },
    utilities_tenant_metered: {
      basis: "annual_total",
      value: 600,
      label: "Parking carry utilities baseline",
      description: "Utility exposure baseline while parking is held.",
    },
    snow_landscaping: {
      basis: "annual_total",
      value: 1800,
      label: "Parking carry exterior maintenance baseline",
      description: "Snow removal and exterior maintenance baseline while parking is held.",
    },
  },
} satisfies Record<string, AssetBaselineEntry>;

const DEFAULT_OPERATING_DESCRIPTION: Record<Exclude<BuiltInOperatingExpenseKey, "property_tax" | "management">, string> = {
  insurance: "Insurance expense covering the building and liability program.",
  repairs_maintenance: "Recurring repair, maintenance, and make-ready spend outside major capex.",
  utilities_common: "Landlord-paid utilities, common-area services, and shared building loads.",
  snow_landscaping: "Grounds, snow removal, exterior cleaning, and seasonal site work.",
};

const DEFAULT_INPUT_MODE_BY_KEY: Record<BuiltInOperatingExpenseKey, OperatingExpenseInputMode> = {
  property_tax: "annual",
  management: "rate",
  insurance: "monthly",
  repairs_maintenance: "monthly",
  utilities_common: "monthly",
  snow_landscaping: "annual",
};

const DEFAULT_PERCENT_BASIS_BY_KEY: Record<BuiltInOperatingExpenseKey, Exclude<OperatingExpenseBasis, "fixed_annual">> =
  {
    property_tax: "purchase_price",
    management: "effective_gross_income",
    insurance: "effective_gross_income",
    repairs_maintenance: "effective_gross_income",
    utilities_common: "effective_gross_income",
    snow_landscaping: "effective_gross_income",
  };

function baselineEntryForContext(
  assetType: NormalizedAssetType,
  unitCount: number,
  baselineMode: OperatingExpenseBaselineMode
): AssetBaselineEntry {
  if (baselineMode === "covered_land" || assetType === "land") {
    return OPERATING_EXPENSE_BASELINES.land_carry;
  }
  if (assetType === "parking") {
    return OPERATING_EXPENSE_BASELINES.parking_carry;
  }
  if (baselineMode === "new_construction") {
    return OPERATING_EXPENSE_BASELINES.residential_new_construction;
  }
  if (assetType === "apartment" || assetType === "mixed_use" || unitCount >= 5) {
    return OPERATING_EXPENSE_BASELINES.multifamily_existing;
  }
  return OPERATING_EXPENSE_BASELINES.small_bay_existing;
}

function inferUtilityResponsibilityProfile(text: string | null | undefined): {
  profile: UtilityResponsibilityProfile;
  source: AssumptionSource | null;
  detail: string | null;
} {
  if (!text) {
    return { profile: "unknown", source: null, detail: null };
  }

  const normalized = text.toLowerCase();
  const tenantMeteredPatterns = [
    /\bseparately metered\b/,
    /\bseparate(?:ly)? meters?\b/,
    /\btenant pays (?:hydro|utilities|electricity|heat)\b/,
    /\bhydro extra\b/,
    /\butilities extra\b/,
    /\bplus utilities\b/,
  ];
  if (tenantMeteredPatterns.some((pattern) => pattern.test(normalized))) {
    return {
      profile: "tenant_metered",
      source: "description_inferred",
      detail: "Listing description indicates suites are separately metered or utilities are tenant-paid.",
    };
  }

  const landlordPaidPatterns = [
    /\ball utilities included\b/,
    /\butilities included\b/,
    /\bheat included\b/,
    /\blandlord pays utilities\b/,
    /\bowner pays utilities\b/,
  ];
  if (landlordPaidPatterns.some((pattern) => pattern.test(normalized))) {
    return {
      profile: "landlord_paid",
      source: "description_inferred",
      detail: "Listing description indicates utilities are included or landlord-paid.",
    };
  }

  return { profile: "unknown", source: null, detail: null };
}

function roundUnits(unitCount: number): number {
  return Math.max(0, Math.round(unitCount));
}

function resolveAnnualFromTemplateBasis(params: {
  basis: OperatingExpenseTemplateBasis;
  value: number;
  effectiveGrossIncome: number;
  unitCount: number;
  squareFeet: number | null;
}): { annualAmount: number; formula: string } | null {
  const sanitizedValue = Math.max(0, params.value);
  switch (params.basis) {
    case "percent_of_egi": {
      const annualAmount = roundMoney(params.effectiveGrossIncome * sanitizedValue);
      return {
        annualAmount,
        formula: `${currencyText(params.effectiveGrossIncome)} EGI x ${percentText(sanitizedValue)} = ${currencyText(annualAmount)} per year`,
      };
    }
    case "annual_total":
      return {
        annualAmount: roundMoney(sanitizedValue),
        formula: `${currencyText(sanitizedValue)} annual total`,
      };
    case "annual_per_unit": {
      const units = roundUnits(params.unitCount);
      if (units <= 0) return null;
      const annualAmount = roundMoney(units * sanitizedValue);
      return {
        annualAmount,
        formula: `${units} units x ${currencyText(sanitizedValue)} per unit = ${currencyText(annualAmount)} per year`,
      };
    }
    case "annual_per_sqft": {
      const squareFeet = params.squareFeet != null && params.squareFeet > 0 ? params.squareFeet : null;
      if (squareFeet == null) return null;
      const annualAmount = roundMoney(squareFeet * sanitizedValue);
      return {
        annualAmount,
        formula: `${squareFeet.toLocaleString("en-CA")} sq ft x ${currencyText(sanitizedValue)} per sq ft = ${currencyText(annualAmount)} per year`,
      };
    }
    default:
      return null;
  }
}

function labelForOperatingSource(source: AssumptionSource): string {
  switch (source) {
    case "actual":
      return "Source listing field";
    case "description_inferred":
      return "Description inference";
    case "profile_default":
      return "Saved profile default";
    case "asset_baseline":
      return "Asset baseline";
    case "user_override":
      return "User override";
    default:
      return "Assumption";
  }
}

function buildSourceDetail(params: {
  source: AssumptionSource;
  context: string;
  formula: string;
  extra?: string | null;
}): string {
  const detailParts = [params.context];
  if (params.extra) detailParts.push(params.extra);
  return `Source: ${labelForOperatingSource(params.source)}. ${detailParts.join(" ")} Calculation: ${params.formula}.`;
}

function resolveTemplateLine(
  basis: OperatingExpenseTemplateBasis | null | undefined,
  value: number | null | undefined,
  params: {
    effectiveGrossIncome: number;
    unitCount: number;
    squareFeet: number | null;
  }
): { annualAmount: number; formula: string; inputMode: OperatingExpenseInputMode } | null {
  if (!basis || value == null || value <= 0) return null;
  const resolved = resolveAnnualFromTemplateBasis({
    basis,
    value,
    effectiveGrossIncome: params.effectiveGrossIncome,
    unitCount: params.unitCount,
    squareFeet: params.squareFeet,
  });
  if (!resolved) return null;
  return {
    annualAmount: resolved.annualAmount,
    formula: resolved.formula,
    inputMode: basis === "percent_of_egi" ? "rate" : "annual",
  };
}

function buildRecurringExpenseLine(params: {
  key: Exclude<BuiltInOperatingExpenseKey, "property_tax" | "management">;
  label: string;
  description: string;
  effectiveGrossIncome: number;
  purchasePrice: number;
  inputMode: OperatingExpenseInputMode;
  annualAmount: number;
  source: AssumptionSource;
  sourceContext: string;
  formula: string;
}): OperatingExpenseLineItem {
  return buildLineItem({
    key: params.key,
    label: params.label,
    annualAmount: params.annualAmount,
    description: params.description,
    formula: `Annual ${params.label.toLowerCase()} expense = ${params.formula}`,
    source: params.source,
    sourceDetail: buildSourceDetail({
      source: params.source,
      context: params.sourceContext,
      formula: params.formula,
    }),
    inputMode: params.inputMode,
    percentBasis: DEFAULT_PERCENT_BASIS_BY_KEY[params.key],
    effectiveGrossIncome: params.effectiveGrossIncome,
    purchasePrice: params.purchasePrice,
  });
}

function buildManagementLine(params: {
  effectiveGrossIncome: number;
  purchasePrice: number;
  template: OperatingExpenseTemplate | null | undefined;
  baseline: AssetBaselineEntry;
}): OperatingExpenseLineItem {
  const managementRate =
    params.template?.averageManagementFeePct != null && params.template.averageManagementFeePct >= 0
      ? params.template.averageManagementFeePct
      : params.baseline.managementFeePct;
  const source =
    params.template?.averageManagementFeePct != null && params.template.averageManagementFeePct >= 0
      ? "profile_default"
      : "asset_baseline";
  const annualAmount = roundMoney(params.effectiveGrossIncome * managementRate);

  return buildLineItem({
    key: "management",
    label: "Management",
    annualAmount,
    description: "Professional management load applied to effective gross income.",
    formula: "Annual management expense = Effective gross income x Management fee rate",
    source,
    sourceDetail: buildSourceDetail({
      source,
      context:
        source === "profile_default"
          ? "Using the investor's saved average management fee."
          : managementRate > 0
            ? "Using the asset-level management baseline for this property type and deal stage."
            : "No professional management fee is included by default; add one if the asset will be third-party managed.",
      formula: `${currencyText(params.effectiveGrossIncome)} EGI x ${percentText(managementRate)} = ${currencyText(annualAmount)} per year`,
    }),
    inputMode: "rate",
    percentBasis: DEFAULT_PERCENT_BASIS_BY_KEY.management,
    effectiveGrossIncome: params.effectiveGrossIncome,
    purchasePrice: params.purchasePrice,
  });
}

function buildBaselineDrivenLine(params: {
  key: Exclude<BuiltInOperatingExpenseKey, "property_tax" | "management">;
  label: string;
  effectiveGrossIncome: number;
  purchasePrice: number;
  unitCount: number;
  squareFeet: number | null;
  baseline: ExpenseDefaultDefinition;
  source: AssumptionSource;
  sourceContext: string;
}): OperatingExpenseLineItem | null {
  const resolved = resolveAnnualFromTemplateBasis({
    basis: params.baseline.basis,
    value: params.baseline.value,
    effectiveGrossIncome: params.effectiveGrossIncome,
    unitCount: params.unitCount,
    squareFeet: params.squareFeet,
  });
  if (!resolved) return null;

  return buildRecurringExpenseLine({
    key: params.key,
    label: params.label,
    description: params.baseline.description,
    effectiveGrossIncome: params.effectiveGrossIncome,
    purchasePrice: params.purchasePrice,
    inputMode: "annual",
    annualAmount: resolved.annualAmount,
    source: params.source,
    sourceContext: params.sourceContext,
    formula: resolved.formula,
  });
}

function methodConfidenceText(estimate: PropertyTaxEstimate): string {
  const methodLabel = propertyTaxMethodLabel(estimate.method);
  const confidenceLabel =
    estimate.confidence === "high"
      ? "high confidence"
      : estimate.confidence === "medium"
        ? "medium confidence"
        : "low confidence";
  return `${methodLabel} (${confidenceLabel})`;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundRate(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function percentText(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function currencyText(value: number): string {
  return value.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  });
}

function propertyTaxSourceDetail(estimate: PropertyTaxEstimate): string {
  const sourceParts = [estimate.sourceSummary];
  if (estimate.fallbackReason) {
    sourceParts.push(estimate.fallbackReason);
  }

  return `Source: ${sourceParts.join(" ")}. Calculation: ${estimate.formulaSummary}.`;
}

function propertyTaxDescription(estimate: PropertyTaxEstimate): string {
  if (estimate.method === "exact_bill") {
    return `Annual property tax uses the source-provided tax amount. ${methodConfidenceText(estimate)}.`;
  }

  return `Annual property tax estimate built from the Canadian property tax hierarchy. ${methodConfidenceText(estimate)}.`;
}

function buildPropertyTaxLine(
  estimate: PropertyTaxEstimate
): OperatingExpenseLineItem {
  const sourceDetail = propertyTaxSourceDetail(estimate);
  const effectiveRateVsPrice = estimate.effectiveRateVsPrice ?? 0;

  return {
    key: "property_tax",
    label: "Property tax",
    basis: "fixed_annual",
    percentBasis: "purchase_price",
    inputMode: "annual",
    isCustom: false,
    rate: buildRateAssumptionValue(effectiveRateVsPrice, estimate.source, sourceDetail),
    amountAnnual: buildAssumptionValue(estimate.amountAnnual, estimate.source, sourceDetail),
    description: propertyTaxDescription(estimate),
    formula: estimate.formulaSummary,
    propertyTaxEstimate: estimate,
  };
}

function trimTrailingPeriod(value: string): string {
  return value.replace(/\.+$/, "").trim();
}

function buildAssumptionValue(
  value: number,
  source: AssumptionSource,
  label: string
): AssumptionValue<number> {
  return {
    value: roundMoney(value),
    source,
    label,
  };
}

function buildRateAssumptionValue(
  value: number,
  source: AssumptionSource,
  label: string
): AssumptionValue<number> {
  return {
    value: roundRate(value),
    source,
    label,
  };
}

function annualAmountForMode(
  mode: OperatingExpenseInputMode,
  inputValue: number,
  percentBasis: Exclude<OperatingExpenseBasis, "fixed_annual">,
  effectiveGrossIncome: number,
  purchasePrice: number
): number {
  const sanitizedValue = Math.max(0, inputValue);
  if (mode === "annual") return roundMoney(sanitizedValue);
  if (mode === "monthly") return roundMoney(sanitizedValue * 12);
  const base = percentBasis === "purchase_price" ? purchasePrice : effectiveGrossIncome;
  return roundMoney(base * sanitizedValue);
}

function basisForMode(
  mode: OperatingExpenseInputMode,
  percentBasis: Exclude<OperatingExpenseBasis, "fixed_annual">
): OperatingExpenseBasis {
  return mode === "rate" ? percentBasis : "fixed_annual";
}

function rateForMode(
  annualAmount: number,
  percentBasis: Exclude<OperatingExpenseBasis, "fixed_annual">,
  effectiveGrossIncome: number,
  purchasePrice: number
): number {
  const base = percentBasis === "purchase_price" ? purchasePrice : effectiveGrossIncome;
  return base > 0 ? roundRate(annualAmount / base) : 0;
}

function buildLineItem(params: {
  key: BuiltInOperatingExpenseKey | `custom_${string}`;
  label: string;
  annualAmount: number;
  description: string;
  formula: string;
  source: AssumptionSource;
  sourceDetail: string;
  inputMode: OperatingExpenseInputMode;
  percentBasis: Exclude<OperatingExpenseBasis, "fixed_annual">;
  effectiveGrossIncome: number;
  purchasePrice: number;
  isCustom?: boolean;
}): OperatingExpenseLineItem {
  const annualAmount = roundMoney(params.annualAmount);
  const basis = basisForMode(params.inputMode, params.percentBasis);
  const rateValue = rateForMode(
    annualAmount,
    params.percentBasis,
    params.effectiveGrossIncome,
    params.purchasePrice
  );

  return {
    key: params.key,
    label: params.label,
    basis,
    percentBasis: params.percentBasis,
    inputMode: params.inputMode,
    isCustom: params.isCustom ?? false,
    rate: buildRateAssumptionValue(rateValue, params.source, params.sourceDetail),
    amountAnnual: buildAssumptionValue(annualAmount, params.source, params.sourceDetail),
    description: params.description,
    formula: params.formula,
  };
}

function deriveScheduleSource(items: OperatingExpenseLineItem[]): AssumptionSource {
  if (items.some((item) => item.amountAnnual.source === "user_override" || item.rate.source === "user_override")) {
    return "user_override";
  }
  if (items.some((item) => item.amountAnnual.source === "profile_default" || item.rate.source === "profile_default")) {
    return "profile_default";
  }
  if (items.some((item) => item.amountAnnual.source === "description_inferred" || item.rate.source === "description_inferred")) {
    return "description_inferred";
  }
  if (items.some((item) => item.amountAnnual.source === "asset_baseline" || item.rate.source === "asset_baseline")) {
    return "asset_baseline";
  }
  if (items.some((item) => item.amountAnnual.source === "official_rate" || item.rate.source === "official_rate")) {
    return "official_rate";
  }
  if (items.some((item) => item.amountAnnual.source === "market_benchmark" || item.rate.source === "market_benchmark")) {
    return "market_benchmark";
  }
  if (items.some((item) => item.amountAnnual.source === "assumed" || item.rate.source === "assumed")) {
    return "assumed";
  }
  return "actual";
}

export function calculateOperatingExpenseLineAmount(
  item: Pick<OperatingExpenseLineItem, "basis" | "rate" | "amountAnnual">,
  effectiveGrossIncome: number,
  purchasePrice: number
): number {
  if (item.basis === "fixed_annual") return roundMoney(item.amountAnnual.value);

  return roundMoney(
    resolveOperatingExpenseItemAmount(
      {
        basis: item.basis,
        rate: item.rate.value,
      },
      effectiveGrossIncome,
      purchasePrice
    )
  );
}

export function buildOperatingExpenseSchedule(
  input: BuildOperatingExpenseScheduleInput
): OperatingExpenseLineItem[] {
  const propertyTaxLine = buildPropertyTaxLine(
    input.propertyTaxEstimate
  );
  const baseline = baselineEntryForContext(
    input.normalizedAssetType,
    input.unitCount,
    input.baselineMode
  );
  const utilityInference = inferUtilityResponsibilityProfile(input.descriptionText);
  const utilitiesBaseline =
    utilityInference.profile === "tenant_metered"
      ? baseline.utilities_tenant_metered
      : baseline.utilities_landlord_paid;
  const managementLine = buildManagementLine({
    effectiveGrossIncome: input.effectiveGrossIncome,
    purchasePrice: input.purchasePrice,
    template: input.template,
    baseline,
  });

  const buildNonTaxLine = (
    key: Exclude<BuiltInOperatingExpenseKey, "property_tax" | "management">,
    label: string,
    baselineDefinition: ExpenseDefaultDefinition
  ): OperatingExpenseLineItem => {
    const sourceAnnual = input.sourceExpenseFacts?.[key];
    if (sourceAnnual != null && sourceAnnual > 0) {
      return buildRecurringExpenseLine({
        key,
        label,
        description: DEFAULT_OPERATING_DESCRIPTION[key],
        effectiveGrossIncome: input.effectiveGrossIncome,
        purchasePrice: input.purchasePrice,
        inputMode: "annual",
        annualAmount: sourceAnnual,
        source: "actual",
        sourceContext: "Using an operating expense amount carried from the listing source.",
        formula: `${currencyText(sourceAnnual)} annual amount from the source`,
      });
    }

    const templateBasisKey =
      key === "insurance"
        ? "insuranceDefaultBasis"
        : key === "repairs_maintenance"
          ? "repairsDefaultBasis"
          : key === "utilities_common"
            ? "utilitiesDefaultBasis"
            : "snowDefaultBasis";
    const templateValueKey =
      key === "insurance"
        ? "insuranceDefaultValue"
        : key === "repairs_maintenance"
          ? "repairsDefaultValue"
          : key === "utilities_common"
            ? "utilitiesDefaultValue"
            : "snowDefaultValue";

    const templateLine = resolveTemplateLine(
      input.template?.[templateBasisKey] ?? null,
      input.template?.[templateValueKey] ?? null,
      {
        effectiveGrossIncome: input.effectiveGrossIncome,
        unitCount: input.unitCount,
        squareFeet: input.squareFeet,
      }
    );
    if (templateLine) {
      return buildRecurringExpenseLine({
        key,
        label,
        description: DEFAULT_OPERATING_DESCRIPTION[key],
        effectiveGrossIncome: input.effectiveGrossIncome,
        purchasePrice: input.purchasePrice,
        inputMode: templateLine.inputMode,
        annualAmount: templateLine.annualAmount,
        source: "profile_default",
        sourceContext: "Using the investor's saved operating-expense template.",
        formula: templateLine.formula,
      });
    }

    const inferredSource =
      key === "utilities_common" && utilityInference.source ? utilityInference.source : "asset_baseline";
    const inferredContext =
      key === "utilities_common" && utilityInference.detail
        ? `${utilityInference.detail} Falling back to the matching common-area utility baseline.`
        : "Using the asset-level operating baseline for this property type, unit count, and deal stage.";

    return (
      buildBaselineDrivenLine({
        key,
        label,
        effectiveGrossIncome: input.effectiveGrossIncome,
        purchasePrice: input.purchasePrice,
        unitCount: input.unitCount,
        squareFeet: input.squareFeet,
        baseline: baselineDefinition,
        source: inferredSource,
        sourceContext: inferredContext,
      }) ??
      buildRecurringExpenseLine({
        key,
        label,
        description: DEFAULT_OPERATING_DESCRIPTION[key],
        effectiveGrossIncome: input.effectiveGrossIncome,
        purchasePrice: input.purchasePrice,
        inputMode: "annual",
        annualAmount: 0,
        source: "assumed",
        sourceContext: "The default operating baseline could not be resolved from the available unit count or square footage.",
        formula: "No reliable baseline available, so this line defaults to $0 until the user enters a value",
      })
    );
  };

  const nonTaxLines: OperatingExpenseLineItem[] = [
    buildNonTaxLine("insurance", "Insurance", baseline.insurance),
    buildNonTaxLine("repairs_maintenance", "Repairs & maintenance", baseline.repairs_maintenance),
    buildNonTaxLine("utilities_common", "Utilities / common area", utilitiesBaseline),
    buildNonTaxLine("snow_landscaping", "Snow / landscaping", baseline.snow_landscaping),
  ];

  return [propertyTaxLine, managementLine, ...nonTaxLines];
}

export function overridePropertyTaxAmount(
  item: OperatingExpenseLineItem,
  mode: Extract<OperatingExpenseInputMode, "annual" | "monthly">,
  inputValue: number,
  purchasePrice: number
): OperatingExpenseLineItem {
  if (item.key !== "property_tax" || !item.propertyTaxEstimate) {
    return item;
  }

  const annualAmount = mode === "monthly" ? roundMoney(Math.max(0, inputValue) * 12) : roundMoney(Math.max(0, inputValue));
  const nextEstimate: PropertyTaxEstimate = {
    ...item.propertyTaxEstimate,
    amountAnnual: annualAmount,
    method: "user_override",
    confidence: "high",
    source: "user_override",
    assessedValueSource:
      item.propertyTaxEstimate.assessedValue != null ? item.propertyTaxEstimate.assessedValueSource : "not_available",
    effectiveRateVsPrice: purchasePrice > 0 ? roundRate(annualAmount / purchasePrice) : null,
    effectiveRateVsAssessment:
      item.propertyTaxEstimate.assessedValue != null && item.propertyTaxEstimate.assessedValue > 0
        ? roundRate(annualAmount / item.propertyTaxEstimate.assessedValue)
        : null,
    sourceLabel: item.propertyTaxEstimate.sourceLabel,
    sourceSummary: "Annual property tax manually overridden by the user.",
    formulaSummary: `Annual property tax = ${mode === "monthly" ? `${currencyText(Math.max(0, inputValue))} monthly × 12` : `${currencyText(annualAmount)} manual annual entry`} = ${currencyText(annualAmount)} per year`,
    fallbackReason: null,
  };

  const rebuilt = buildPropertyTaxLine(nextEstimate);
  return {
    ...rebuilt,
    inputMode: mode,
    amountAnnual: {
      ...rebuilt.amountAnnual,
      source: "user_override",
      label: propertyTaxSourceDetail(nextEstimate),
    },
    rate: {
      ...rebuilt.rate,
      source: "user_override",
      label: propertyTaxSourceDetail(nextEstimate),
    },
  };
}

export function overridePropertyTaxClass(
  item: OperatingExpenseLineItem,
  taxClass: PropertyTaxClass,
  purchasePrice: number
): OperatingExpenseLineItem {
  if (item.key !== "property_tax" || !item.propertyTaxEstimate) {
    return item;
  }

  const nextEstimate = resolvePropertyTaxEstimate({
    city: item.propertyTaxEstimate.jurisdiction ?? "",
    province: item.propertyTaxEstimate.province ?? "ON",
    purchasePrice,
    normalizedAssetType: inferAssetTypeFromTaxClass(taxClass),
    normalizedUnits: taxClass === "multi_residential" || taxClass === "new_multi_residential" ? 6 : 1,
    residentialShareEstimated: taxClass === "mixed_use" ? 0.7 : 1,
    assessedValue: item.propertyTaxEstimate.assessedValue,
  });

  const remappedEstimate: PropertyTaxEstimate = {
    ...nextEstimate,
    taxClass,
    source: "user_override",
    method: nextEstimate.method === "exact_bill" ? "user_override" : nextEstimate.method,
    sourceSummary: `${nextEstimate.sourceSummary} Tax class manually overridden to ${propertyTaxClassLabel(taxClass)}.`,
  };

  const rebuilt = buildPropertyTaxLine(remappedEstimate);
  return {
    ...rebuilt,
    amountAnnual: {
      ...rebuilt.amountAnnual,
      source: "user_override",
      label: propertyTaxSourceDetail(remappedEstimate),
    },
    rate: {
      ...rebuilt.rate,
      source: "user_override",
      label: propertyTaxSourceDetail(remappedEstimate),
    },
  };
}

function inferAssetTypeFromTaxClass(taxClass: PropertyTaxClass): "single_family" | "apartment" | "mixed_use" | "land" | "parking" {
  if (taxClass === "vacant_land") return "land";
  if (taxClass === "mixed_use") return "mixed_use";
  if (taxClass === "non_residential") return "parking";
  if (taxClass === "multi_residential" || taxClass === "new_multi_residential") return "apartment";
  return "single_family";
}

export function deriveOperatingExpenseRatioAssumption(
  items: OperatingExpenseLineItem[],
  effectiveGrossIncome: number,
  purchasePrice: number
): AssumptionValue<number> {
  const total = items.reduce(
    (sum, item) => sum + calculateOperatingExpenseLineAmount(item, effectiveGrossIncome, purchasePrice),
    0
  );
  const ratio = deriveOperatingExpenseRatio(total, effectiveGrossIncome);
  if (effectiveGrossIncome <= 0) {
    return {
      value: 0,
      source: deriveScheduleSource(items),
      label:
        "Source: Calculated from the operating-expense schedule below. Calculation: Effective gross income is zero or negative, so the operating expense ratio is not meaningful for this path.",
    };
  }

  return {
    value: ratio,
    source: deriveScheduleSource(items),
    label: `Source: Calculated from the operating-expense schedule below. Calculation: ${currencyText(total)} / ${currencyText(effectiveGrossIncome)} EGI = ${percentText(ratio)}.`,
  };
}

export function toFinanceOperatingExpenseItems(
  items: OperatingExpenseLineItem[]
): FinanceOperatingExpenseItem[] {
  return items.map((item) => ({
    key: item.key,
    label: item.label,
    basis: item.basis,
    rate: item.basis === "fixed_annual" ? item.amountAnnual.value : item.rate.value,
  }));
}

export function getOperatingExpenseInputValue(
  item: OperatingExpenseLineItem,
  mode: OperatingExpenseInputMode,
  effectiveGrossIncome: number,
  purchasePrice: number
): number {
  const annualAmount = calculateOperatingExpenseLineAmount(item, effectiveGrossIncome, purchasePrice);

  if (mode === "annual") return roundMoney(annualAmount);
  if (mode === "monthly") return roundMoney(annualAmount / 12);

  const base = item.percentBasis === "purchase_price" ? purchasePrice : effectiveGrossIncome;
  return base > 0 ? roundRate(annualAmount / base) : 0;
}

export function overrideOperatingExpenseInput(
  item: OperatingExpenseLineItem,
  mode: OperatingExpenseInputMode,
  inputValue: number,
  effectiveGrossIncome: number,
  purchasePrice: number
): OperatingExpenseLineItem {
  if (item.key === "property_tax") {
    const taxMode = mode === "monthly" ? "monthly" : "annual";
    return overridePropertyTaxAmount(item, taxMode, inputValue, purchasePrice);
  }

  const annualAmount = annualAmountForMode(
    mode,
    inputValue,
    item.percentBasis,
    effectiveGrossIncome,
    purchasePrice
  );
  const basis = basisForMode(mode, item.percentBasis);
  const rateValue = rateForMode(
    annualAmount,
    item.percentBasis,
    effectiveGrossIncome,
    purchasePrice
  );

  return {
    ...item,
    basis,
    inputMode: mode,
    rate: {
      ...item.rate,
      value: roundRate(rateValue),
      source: "user_override",
      label: `Source: User override. Calculation: ${item.label} entered as ${operatingExpenseInputModeLabel(mode).toLowerCase()} and converted into the underwriting basis.`,
    },
    amountAnnual: {
      ...item.amountAnnual,
      value: annualAmount,
      source: "user_override",
      label: `Source: User override. Calculation: ${item.label} normalized to ${currencyText(annualAmount)} per year from the selected input mode.`,
    },
  };
}

export function switchOperatingExpenseInputMode(
  item: OperatingExpenseLineItem,
  mode: OperatingExpenseInputMode,
  effectiveGrossIncome: number,
  purchasePrice: number
): OperatingExpenseLineItem {
  if (item.key === "property_tax") {
    const taxMode = mode === "monthly" ? "monthly" : "annual";
    return {
      ...item,
      inputMode: taxMode,
    };
  }
  const currentValue = getOperatingExpenseInputValue(item, mode, effectiveGrossIncome, purchasePrice);
  return overrideOperatingExpenseInput(item, mode, currentValue, effectiveGrossIncome, purchasePrice);
}

export function createCustomOperatingExpense(params: {
  label: string;
  inputMode: OperatingExpenseInputMode;
  effectiveGrossIncome: number;
  purchasePrice: number;
}): OperatingExpenseLineItem {
  const slug = params.label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const key = `custom_${slug || "expense"}_${Date.now()}` as const;

  return buildLineItem({
    key,
    label: params.label.trim(),
    annualAmount: 0,
    description: "Custom operating expense added by the user for this underwriting case.",
    formula: "Annual custom expense = User-entered annual, monthly, or percent-based amount",
    source: "user_override",
    sourceDetail: "Source: User override. Calculation: Custom operating expense added manually.",
    inputMode: params.inputMode,
    percentBasis: "effective_gross_income",
    effectiveGrossIncome: params.effectiveGrossIncome,
    purchasePrice: params.purchasePrice,
    isCustom: true,
  });
}

export function operatingExpenseBasisLabel(basis: OperatingExpenseBasis): string {
  if (basis === "effective_gross_income") return "% of EGI";
  if (basis === "purchase_price") return "% of purchase price";
  return "Fixed annual";
}

export function operatingExpenseInputModeLabel(mode: OperatingExpenseInputMode): string {
  if (mode === "annual") return "Annual";
  if (mode === "monthly") return "Monthly";
  return "Percent";
}

export function operatingExpensePercentBasisLabel(
  percentBasis: Exclude<OperatingExpenseBasis, "fixed_annual">
): string {
  return percentBasis === "purchase_price" ? "% of purchase price" : "% of EGI";
}
