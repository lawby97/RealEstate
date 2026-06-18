import type {
  AssumptionSource,
  NormalizedAssetType,
  PropertyTaxAssessedValueSource,
  PropertyTaxClass,
  PropertyTaxConfidence,
  PropertyTaxEstimate,
  PropertyTaxMethod,
} from "@/types/listing";

interface PropertyTaxRateEntry {
  city: string;
  province: string;
  year: number;
  areaLabel?: string | null;
  sourceLabel: string;
  sourceUrl?: string | null;
  rates: Partial<Record<PropertyTaxClass, number>>;
  notes?: string;
}

interface EffectiveTaxBackupEntry {
  province: string;
  taxClass: PropertyTaxClass;
  rate: number;
  sourceLabel: string;
  sourceUrl?: string | null;
  notes?: string;
}

interface PropertyTaxEstimateInput {
  city: string;
  province: string;
  postalCode?: string | null;
  marketCity?: string | null;
  normalizedAssetType: NormalizedAssetType;
  normalizedUnits: number;
  purchasePrice: number;
  residentialShareEstimated?: number | null;
  exactAnnualTax?: number | null;
  exactAnnualTaxYear?: number | null;
  exactAnnualTaxSourceLabel?: string | null;
  exactAnnualTaxSourceSummary?: string | null;
  exactAnnualTaxFormulaSummary?: string | null;
  assessedValue?: number | null;
}

const PROPERTY_TAX_RATE_TABLE: PropertyTaxRateEntry[] = [
  {
    city: "Calgary",
    province: "AB",
    year: 2025,
    sourceLabel: "Official 2025 City of Calgary property tax calculator",
    rates: {
      residential: 0.0064846,
      non_residential: 0.0147611,
      vacant_land: 0.0147611,
    },
  },
  {
    city: "Edmonton",
    province: "AB",
    year: 2025,
    sourceLabel: "Official 2025 City of Edmonton property tax rates",
    rates: {
      residential: 0.009152,
      multi_residential: 0.011763,
      non_residential: 0.017286,
      vacant_land: 0.017286,
    },
    notes: "Other Residential rate used for apartment-style rental assets.",
  },
  {
    city: "Vancouver",
    province: "BC",
    year: 2025,
    sourceLabel: "Official 2025 City of Vancouver residential property tax rates",
    rates: {
      residential: 0.0029299,
      non_residential: 0.0093497,
      vacant_land: 0.0093497,
    },
    notes: "Rates published per $1,000 of taxable value.",
  },
  {
    city: "Victoria",
    province: "BC",
    year: 2025,
    sourceLabel: "Official 2025 City of Victoria property tax rates",
    rates: {
      residential: 0.0026446,
      non_residential: 0.0086028,
      vacant_land: 0.0086028,
    },
    notes: "Residential Class 1 rate published per $1,000 of taxable value.",
  },
  {
    city: "Winnipeg",
    province: "MB",
    year: 2025,
    sourceLabel: "Official 2025 City of Winnipeg Residential 1 mill rate and portioning factor",
    rates: {
      residential: 0.0066195,
      multi_residential: 0.0066195,
    },
    notes: "Effective rate derived from 14.710 mills x 45% residential portioning.",
  },
  {
    city: "Halifax",
    province: "NS",
    year: 2025,
    areaLabel: "Urban",
    sourceLabel: "Official 2025 Halifax Regional Municipality urban tax rate",
    rates: {
      residential: 0.010881,
      multi_residential: 0.010881,
    },
    notes: "Urban residential rate used as the current default; suburban and rural overlays are approximated from postal area only when better rate rows are unavailable.",
  },
  {
    city: "Hamilton",
    province: "ON",
    year: 2025,
    sourceLabel: "Official 2025 City of Hamilton residential tax rate",
    rates: {
      residential: 0.01309176,
      multi_residential: 0.01768412,
    },
  },
  {
    city: "Kitchener",
    province: "ON",
    year: 2025,
    sourceLabel: "Official 2025 City of Kitchener residential tax rate",
    rates: {
      residential: 0.00996294,
      multi_residential: 0.01303334,
    },
  },
  {
    city: "London",
    province: "ON",
    year: 2025,
    sourceLabel: "Official 2025 City of London residential tax rate",
    rates: {
      residential: 0.0129308,
      multi_residential: 0.0166276,
    },
  },
  {
    city: "Ottawa",
    province: "ON",
    year: 2025,
    sourceLabel: "Official 2025 City of Ottawa tax rates",
    rates: {
      residential: 0.0100448,
      multi_residential: 0.0117053,
      new_multi_residential: 0.0084127,
    },
  },
  {
    city: "St. Catharines",
    province: "ON",
    year: 2025,
    sourceLabel: "Official 2025 City of St. Catharines residential final tax rate",
    rates: {
      residential: 0.01149742,
      multi_residential: 0.01449668,
    },
  },
  {
    city: "Toronto",
    province: "ON",
    year: 2025,
    sourceLabel: "Official 2025 City of Toronto property tax rates",
    rates: {
      residential: 0.00754087,
      multi_residential: 0.01197305,
      new_multi_residential: 0.00844714,
      non_residential: 0.02275478,
      vacant_land: 0.02275478,
    },
  },
  {
    city: "Windsor",
    province: "ON",
    year: 2025,
    sourceLabel: "Official 2025 City of Windsor residential tax rate",
    rates: {
      residential: 0.01141183,
      multi_residential: 0.01558618,
    },
  },
  {
    city: "Gatineau",
    province: "QC",
    year: 2026,
    sourceLabel: "Official 2026 Ville de Gatineau tax rates",
    rates: {
      residential: 0.009504,
      multi_residential: 0.018184,
      non_residential: 0.033539,
      vacant_land: 0.025698,
    },
    notes: "Rates published per $100 of taxable value.",
  },
  {
    city: "Montreal",
    province: "QC",
    year: 2026,
    sourceLabel: "Official 2026 Ville de Montreal tax rates",
    rates: {
      residential: 0.007177,
      multi_residential: 0.01026,
      non_residential: 0.038259,
      vacant_land: 0.033692,
    },
    notes: "Montreal arrondissement-specific overlays are not yet modeled in the estimate engine.",
  },
  {
    city: "Quebec City",
    province: "QC",
    year: 2026,
    sourceLabel: "Official 2026 Ville de Quebec tax rates",
    rates: {
      residential: 0.00751,
      multi_residential: 0.008813,
      non_residential: 0.02709,
      vacant_land: 0.01544,
    },
    notes: "Rates published per $100 of taxable value.",
  },
  {
    city: "Regina",
    province: "SK",
    year: 2025,
    sourceLabel: "Official 2025 City of Regina property tax rates",
    rates: {
      residential: 0.010509,
      multi_residential: 0.010509,
      non_residential: 0.023376,
      vacant_land: 0.023376,
    },
    notes: "Residential and multi-family totals align under the current property tax factor schedule.",
  },
  {
    city: "Saskatoon",
    province: "SK",
    year: 2025,
    sourceLabel: "Official 2025 City of Saskatoon residential property tax rate",
    rates: {
      residential: 0.01216428,
      multi_residential: 0.01216428,
      non_residential: 0.02919572,
      vacant_land: 0.02919572,
    },
    notes: "Residential and multifamily totals align under the current property tax factor schedule.",
  },
];

const CITY_ALIASES: Record<string, string> = {
  montreal: "Montreal",
  montréal: "Montreal",
  mtl: "Montreal",
  "quebec city": "Quebec City",
  québec: "Quebec City",
  quebec: "Quebec City",
  "ville de quebec": "Quebec City",
  "st catharines": "St. Catharines",
  "st. catharines": "St. Catharines",
  "saint catharines": "St. Catharines",
};

const CITY_PROXY_BASE: Record<string, number> = {
  Calgary: 0.87,
  Edmonton: 0.83,
  Vancouver: 0.79,
  Victoria: 0.8,
  Winnipeg: 0.71,
  Halifax: 0.82,
  Hamilton: 0.77,
  Kitchener: 0.78,
  London: 0.76,
  Ottawa: 0.78,
  "St. Catharines": 0.76,
  Toronto: 0.74,
  Windsor: 0.75,
  Gatineau: 0.66,
  Montreal: 0.61,
  "Quebec City": 0.67,
  Regina: 0.75,
  Saskatoon: 0.76,
};

const PROVINCE_PROXY_BASE: Record<string, number> = {
  QC: 0.64,
  ON: 0.76,
  AB: 0.85,
  BC: 0.8,
  MB: 0.71,
  NS: 0.81,
  SK: 0.75,
};

const CLASS_PROXY_ADJUSTMENT: Record<PropertyTaxClass, number> = {
  residential: 0,
  multi_residential: 0.03,
  new_multi_residential: 0.06,
  non_residential: 0.08,
  mixed_use: 0.05,
  vacant_land: -0.08,
};

const EFFECTIVE_TAX_BACKUP_RATES: EffectiveTaxBackupEntry[] = [
  { province: "QC", taxClass: "residential", rate: 0.0046, sourceLabel: "Internal QC residential backup effective tax burden" },
  { province: "QC", taxClass: "multi_residential", rate: 0.0063, sourceLabel: "Internal QC multi-residential backup effective tax burden" },
  { province: "QC", taxClass: "non_residential", rate: 0.014, sourceLabel: "Internal QC non-residential backup effective tax burden" },
  { province: "QC", taxClass: "vacant_land", rate: 0.0092, sourceLabel: "Internal QC vacant-land backup effective tax burden" },
  { province: "ON", taxClass: "residential", rate: 0.0077, sourceLabel: "Internal ON residential backup effective tax burden" },
  { province: "ON", taxClass: "multi_residential", rate: 0.0093, sourceLabel: "Internal ON multi-residential backup effective tax burden" },
  { province: "ON", taxClass: "new_multi_residential", rate: 0.0067, sourceLabel: "Internal ON new multi-residential backup effective tax burden" },
  { province: "ON", taxClass: "non_residential", rate: 0.0178, sourceLabel: "Internal ON non-residential backup effective tax burden" },
  { province: "ON", taxClass: "vacant_land", rate: 0.0134, sourceLabel: "Internal ON vacant-land backup effective tax burden" },
  { province: "AB", taxClass: "residential", rate: 0.0076, sourceLabel: "Internal AB residential backup effective tax burden" },
  { province: "AB", taxClass: "multi_residential", rate: 0.0094, sourceLabel: "Internal AB multi-residential backup effective tax burden" },
  { province: "AB", taxClass: "non_residential", rate: 0.0156, sourceLabel: "Internal AB non-residential backup effective tax burden" },
  { province: "AB", taxClass: "vacant_land", rate: 0.0116, sourceLabel: "Internal AB vacant-land backup effective tax burden" },
  { province: "BC", taxClass: "residential", rate: 0.0023, sourceLabel: "Internal BC residential backup effective tax burden" },
  { province: "BC", taxClass: "multi_residential", rate: 0.0031, sourceLabel: "Internal BC multi-residential backup effective tax burden" },
  { province: "BC", taxClass: "non_residential", rate: 0.0084, sourceLabel: "Internal BC non-residential backup effective tax burden" },
  { province: "BC", taxClass: "vacant_land", rate: 0.0067, sourceLabel: "Internal BC vacant-land backup effective tax burden" },
  { province: "MB", taxClass: "residential", rate: 0.0047, sourceLabel: "Internal MB residential backup effective tax burden" },
  { province: "MB", taxClass: "multi_residential", rate: 0.005, sourceLabel: "Internal MB multi-residential backup effective tax burden" },
  { province: "NS", taxClass: "residential", rate: 0.0088, sourceLabel: "Internal NS residential backup effective tax burden" },
  { province: "NS", taxClass: "multi_residential", rate: 0.0093, sourceLabel: "Internal NS multi-residential backup effective tax burden" },
  { province: "SK", taxClass: "residential", rate: 0.0092, sourceLabel: "Internal SK residential backup effective tax burden" },
  { province: "SK", taxClass: "multi_residential", rate: 0.0095, sourceLabel: "Internal SK multi-residential backup effective tax burden" },
  { province: "SK", taxClass: "non_residential", rate: 0.0184, sourceLabel: "Internal SK non-residential backup effective tax burden" },
  { province: "SK", taxClass: "vacant_land", rate: 0.0144, sourceLabel: "Internal SK vacant-land backup effective tax burden" },
];

function normalizeCityName(city: string | null | undefined): string | null {
  if (!city) return null;
  const normalized = city
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  if (!normalized) return null;
  return CITY_ALIASES[normalized] ??
    normalized
      .split(" ")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundRate(value: number | null): number | null {
  if (value == null || Number.isNaN(value)) return null;
  return Math.round(value * 1_000_000) / 1_000_000;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  });
}

function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(2)}%`;
}

function halifaxAreaLabel(postalCode?: string | null): string | null {
  const normalized = postalCode?.replace(/\s+/g, "").toUpperCase() ?? "";
  if (!normalized.startsWith("B")) return null;
  if (normalized.startsWith("B3")) return "Urban";
  if (normalized.startsWith("B2") || normalized.startsWith("B4")) return "Suburban";
  return "Rural";
}

function inferPropertyTaxClass(
  normalizedAssetType: NormalizedAssetType,
  normalizedUnits: number,
  province: string,
  residentialShareEstimated?: number | null
): PropertyTaxClass {
  if (normalizedAssetType === "land") return "vacant_land";
  if (normalizedAssetType === "parking") return "non_residential";

  if (normalizedAssetType === "mixed_use") {
    if (residentialShareEstimated != null && residentialShareEstimated < 0.7) {
      return "non_residential";
    }
    return "mixed_use";
  }

  if (province === "QC") {
    return normalizedAssetType === "apartment" || normalizedUnits >= 6
      ? "multi_residential"
      : "residential";
  }

  if (province === "ON") {
    return normalizedAssetType === "apartment" || normalizedUnits >= 5
      ? "multi_residential"
      : "residential";
  }

  if (province === "AB") {
    return normalizedAssetType === "apartment" || normalizedUnits >= 5
      ? "multi_residential"
      : "residential";
  }

  return normalizedAssetType === "apartment" || normalizedUnits >= 5
    ? "multi_residential"
    : "residential";
}

function classFallbackOrder(
  taxClass: PropertyTaxClass,
  residentialShareEstimated?: number | null
): PropertyTaxClass[] {
  if (taxClass === "mixed_use") {
    if (residentialShareEstimated != null && residentialShareEstimated >= 0.7) {
      return ["multi_residential", "residential", "non_residential"];
    }
    return ["non_residential", "multi_residential", "residential"];
  }

  if (taxClass === "new_multi_residential") {
    return ["new_multi_residential", "multi_residential", "residential"];
  }

  if (taxClass === "vacant_land") {
    return ["vacant_land", "non_residential", "residential"];
  }

  if (taxClass === "multi_residential") {
    return ["multi_residential", "residential"];
  }

  if (taxClass === "non_residential") {
    return ["non_residential", "vacant_land", "residential"];
  }

  return [taxClass];
}

function findRateEntry(
  province: string,
  directCity: string | null,
  marketCity: string | null
): { entry: PropertyTaxRateEntry; cityMatchType: "direct" | "market" } | null {
  const directEntry = directCity
    ? PROPERTY_TAX_RATE_TABLE.find((entry) => entry.province === province && entry.city === directCity)
    : null;
  if (directEntry) return { entry: directEntry, cityMatchType: "direct" };

  const marketEntry = marketCity
    ? PROPERTY_TAX_RATE_TABLE.find((entry) => entry.province === province && entry.city === marketCity)
    : null;
  if (marketEntry) return { entry: marketEntry, cityMatchType: "market" };

  return null;
}

function resolveAppliedRate(
  entry: PropertyTaxRateEntry,
  taxClass: PropertyTaxClass,
  residentialShareEstimated?: number | null
): { rate: number | null; appliedClass: PropertyTaxClass | null } {
  for (const candidate of classFallbackOrder(taxClass, residentialShareEstimated)) {
    const rate = entry.rates[candidate];
    if (rate != null) return { rate, appliedClass: candidate };
  }
  return { rate: null, appliedClass: null };
}

function cityProxyRatio(city: string | null, taxClass: PropertyTaxClass): number | null {
  if (!city) return null;
  const base = CITY_PROXY_BASE[city];
  if (base == null) return null;
  return clampRatio(base + CLASS_PROXY_ADJUSTMENT[taxClass]);
}

function provinceProxyRatio(province: string, taxClass: PropertyTaxClass): number | null {
  const base = PROVINCE_PROXY_BASE[province];
  if (base == null) return null;
  return clampRatio(base + CLASS_PROXY_ADJUSTMENT[taxClass]);
}

function clampRatio(value: number): number {
  return Math.min(Math.max(value, 0.35), 0.98);
}

function effectiveTaxBackupRate(province: string, taxClass: PropertyTaxClass): EffectiveTaxBackupEntry | null {
  return (
    EFFECTIVE_TAX_BACKUP_RATES.find((entry) => entry.province === province && entry.taxClass === taxClass) ??
    EFFECTIVE_TAX_BACKUP_RATES.find((entry) => entry.province === province && entry.taxClass === "residential") ??
    null
  );
}

function buildEstimate(params: {
  amountAnnual: number;
  purchasePrice: number;
  assessedValue: number | null;
  taxClass: PropertyTaxClass;
  method: PropertyTaxMethod;
  confidence: PropertyTaxConfidence;
  source: AssumptionSource;
  province: string;
  taxYear: number | null;
  jurisdiction: string | null;
  areaLabel: string | null;
  assessedValueSource: PropertyTaxAssessedValueSource;
  assessmentProxyRatio: number | null;
  appliedRate: number | null;
  sourceLabel: string | null;
  sourceUrl?: string | null;
  sourceSummary: string;
  formulaSummary: string;
  fallbackReason?: string | null;
}): PropertyTaxEstimate {
  const effectiveRateVsPrice =
    params.purchasePrice > 0 ? roundRate(params.amountAnnual / params.purchasePrice) : null;
  const effectiveRateVsAssessment =
    params.assessedValue != null && params.assessedValue > 0
      ? roundRate(params.amountAnnual / params.assessedValue)
      : null;

  return {
    amountAnnual: roundMoney(params.amountAnnual),
    effectiveRateVsPrice,
    effectiveRateVsAssessment,
    method: params.method,
    confidence: params.confidence,
    province: params.province,
    taxYear: params.taxYear,
    jurisdiction: params.jurisdiction,
    areaLabel: params.areaLabel,
    taxClass: params.taxClass,
    assessedValue: params.assessedValue != null ? roundMoney(params.assessedValue) : null,
    assessedValueSource: params.assessedValueSource,
    assessmentProxyRatio: roundRate(params.assessmentProxyRatio),
    appliedRate: roundRate(params.appliedRate),
    source: params.source,
    sourceLabel: params.sourceLabel,
    sourceUrl: params.sourceUrl ?? null,
    sourceSummary: params.sourceSummary,
    formulaSummary: params.formulaSummary,
    fallbackReason: params.fallbackReason ?? null,
  };
}

export function propertyTaxMethodLabel(method: PropertyTaxMethod): string {
  switch (method) {
    case "exact_bill":
      return "Source annual tax";
    case "assessed_value_x_official_rate":
      return "Official tax-rate estimate";
    case "jurisdiction_proxy_x_official_rate":
      return "Official rate + local tax-base proxy";
    case "province_proxy_x_official_rate":
      return "Official rate + provincial tax-base proxy";
    case "effective_tax_backup":
      return "Backup estimate";
    case "user_override":
      return "User override";
  }
}

export function propertyTaxClassLabel(taxClass: PropertyTaxClass): string {
  switch (taxClass) {
    case "residential":
      return "Residential";
    case "multi_residential":
      return "Multi-residential";
    case "new_multi_residential":
      return "New multi-residential";
    case "non_residential":
      return "Non-residential";
    case "mixed_use":
      return "Mixed-use";
    case "vacant_land":
      return "Vacant land";
  }
}

export function resolvePropertyTaxEstimate(input: PropertyTaxEstimateInput): PropertyTaxEstimate {
  const directCity = normalizeCityName(input.city);
  const marketCity = normalizeCityName(input.marketCity ?? null);
  const requestedTaxClass = inferPropertyTaxClass(
    input.normalizedAssetType,
    input.normalizedUnits,
    input.province,
    input.residentialShareEstimated
  );
  const areaLabel =
    (directCity === "Halifax" || marketCity === "Halifax") ? halifaxAreaLabel(input.postalCode) : null;

  if (input.exactAnnualTax != null && input.exactAnnualTax > 0) {
    return buildEstimate({
      amountAnnual: input.exactAnnualTax,
      purchasePrice: input.purchasePrice,
      assessedValue: input.assessedValue ?? null,
      taxClass: requestedTaxClass,
      method: "exact_bill",
      confidence: "high",
      source: "actual",
      province: input.province,
      taxYear: input.exactAnnualTaxYear ?? null,
      jurisdiction: directCity ?? marketCity,
      areaLabel,
      assessedValueSource: input.assessedValue != null ? "exact" : "not_available",
      assessmentProxyRatio: null,
      appliedRate: null,
      sourceLabel: input.exactAnnualTaxSourceLabel ?? "Exact annual property tax bill",
      sourceSummary: input.exactAnnualTaxSourceSummary ?? "Exact annual property tax bill or source-provided annual tax amount.",
      formulaSummary: input.exactAnnualTaxFormulaSummary ?? `Annual property tax = ${formatCurrency(input.exactAnnualTax)} exact bill amount`,
    });
  }

  const rateMatch = findRateEntry(input.province, directCity, marketCity);
  const rateEntry = rateMatch?.entry ?? null;
  const resolvedRate = rateEntry
    ? resolveAppliedRate(rateEntry, requestedTaxClass, input.residentialShareEstimated)
    : { rate: null, appliedClass: null as PropertyTaxClass | null };
  const appliedTaxClass = resolvedRate.appliedClass ?? requestedTaxClass;

  if (rateEntry && input.assessedValue != null && input.assessedValue > 0 && resolvedRate.rate != null) {
    const amountAnnual = input.assessedValue * resolvedRate.rate;
    return buildEstimate({
      amountAnnual,
      purchasePrice: input.purchasePrice,
      assessedValue: input.assessedValue,
      taxClass: appliedTaxClass,
      method: "assessed_value_x_official_rate",
      confidence: "high",
      source: "official_rate",
      province: input.province,
      taxYear: rateEntry.year,
      jurisdiction: rateEntry.city,
      areaLabel: areaLabel ?? rateEntry.areaLabel ?? null,
      assessedValueSource: "exact",
      assessmentProxyRatio: null,
      appliedRate: resolvedRate.rate,
      sourceLabel: rateEntry.sourceLabel,
      sourceUrl: rateEntry.sourceUrl,
      sourceSummary: `${rateEntry.sourceLabel}${rateMatch?.cityMatchType === "market" ? ` using ${rateEntry.city} market-city fallback.` : "."}${rateEntry.notes ? ` ${rateEntry.notes}` : ""}`,
      formulaSummary: `${formatCurrency(input.assessedValue)} tax value × ${formatPercent(resolvedRate.rate)} official ${propertyTaxClassLabel(appliedTaxClass).toLowerCase()} rate = ${formatCurrency(amountAnnual)} per year`,
      fallbackReason: rateMatch?.cityMatchType === "market"
        ? `Direct municipal rate was unavailable; used ${rateEntry.city} market-city fallback rate.`
        : null,
    });
  }

  if (rateEntry && resolvedRate.rate != null) {
    const localProxyRatio = cityProxyRatio(rateEntry.city, appliedTaxClass);
    if (localProxyRatio != null) {
      const assessedValue = input.purchasePrice * localProxyRatio;
      const amountAnnual = assessedValue * resolvedRate.rate;
      return buildEstimate({
        amountAnnual,
        purchasePrice: input.purchasePrice,
        assessedValue,
        taxClass: appliedTaxClass,
        method: "jurisdiction_proxy_x_official_rate",
        confidence: "medium",
        source: "official_rate",
        province: input.province,
        taxYear: rateEntry.year,
        jurisdiction: rateEntry.city,
        areaLabel: areaLabel ?? rateEntry.areaLabel ?? null,
        assessedValueSource: "jurisdiction_proxy",
        assessmentProxyRatio: localProxyRatio,
        appliedRate: resolvedRate.rate,
        sourceLabel: rateEntry.sourceLabel,
        sourceUrl: rateEntry.sourceUrl,
        sourceSummary: `${rateEntry.sourceLabel}. Taxable value is estimated from an internal ${rateEntry.city} ${propertyTaxClassLabel(appliedTaxClass).toLowerCase()} tax-base proxy ratio of ${formatPercent(localProxyRatio)}.${rateEntry.notes ? ` ${rateEntry.notes}` : ""}`,
        formulaSummary: `${formatCurrency(input.purchasePrice)} purchase price × ${formatPercent(localProxyRatio)} local tax-base proxy = ${formatCurrency(assessedValue)} tax-base estimate; ${formatCurrency(assessedValue)} × ${formatPercent(resolvedRate.rate)} official rate = ${formatCurrency(amountAnnual)} per year`,
        fallbackReason: "Source annual tax dollars were not available, so the estimate uses a jurisdiction-level tax-base proxy ratio.",
      });
    }

    const provincialProxyRatio = provinceProxyRatio(input.province, appliedTaxClass);
    if (provincialProxyRatio != null) {
      const assessedValue = input.purchasePrice * provincialProxyRatio;
      const amountAnnual = assessedValue * resolvedRate.rate;
      return buildEstimate({
        amountAnnual,
        purchasePrice: input.purchasePrice,
        assessedValue,
        taxClass: appliedTaxClass,
        method: "province_proxy_x_official_rate",
        confidence: "low",
        source: "official_rate",
        province: input.province,
        taxYear: rateEntry.year,
        jurisdiction: rateEntry.city,
        areaLabel: areaLabel ?? rateEntry.areaLabel ?? null,
        assessedValueSource: "province_proxy",
        assessmentProxyRatio: provincialProxyRatio,
        appliedRate: resolvedRate.rate,
        sourceLabel: rateEntry.sourceLabel,
        sourceUrl: rateEntry.sourceUrl,
        sourceSummary: `${rateEntry.sourceLabel}. Taxable value is estimated from an internal ${input.province} ${propertyTaxClassLabel(appliedTaxClass).toLowerCase()} provincial tax-base proxy ratio of ${formatPercent(provincialProxyRatio)}.${rateEntry.notes ? ` ${rateEntry.notes}` : ""}`,
        formulaSummary: `${formatCurrency(input.purchasePrice)} purchase price × ${formatPercent(provincialProxyRatio)} provincial tax-base proxy = ${formatCurrency(assessedValue)} tax-base estimate; ${formatCurrency(assessedValue)} × ${formatPercent(resolvedRate.rate)} official rate = ${formatCurrency(amountAnnual)} per year`,
        fallbackReason: "Source annual tax dollars and jurisdiction-level proxy were unavailable, so the estimate uses a province-level tax-base proxy ratio.",
      });
    }
  }

  const backupRate = effectiveTaxBackupRate(input.province, appliedTaxClass);
  if (backupRate) {
    const amountAnnual = input.purchasePrice * backupRate.rate;
    return buildEstimate({
      amountAnnual,
      purchasePrice: input.purchasePrice,
      assessedValue: null,
      taxClass: appliedTaxClass,
      method: "effective_tax_backup",
      confidence: "low",
      source: "assumed",
      province: input.province,
      taxYear: rateEntry?.year ?? null,
      jurisdiction: directCity ?? marketCity,
      areaLabel,
      assessedValueSource: "effective_tax_backup",
      assessmentProxyRatio: null,
      appliedRate: backupRate.rate,
      sourceLabel: backupRate.sourceLabel,
      sourceUrl: backupRate.sourceUrl,
      sourceSummary: `${backupRate.sourceLabel}. This is a low-confidence backup burden estimate because source annual tax dollars or a tax-base proxy could not be fully resolved.${backupRate.notes ? ` ${backupRate.notes}` : ""}`,
      formulaSummary: `${formatCurrency(input.purchasePrice)} purchase price × ${formatPercent(backupRate.rate)} backup effective tax burden = ${formatCurrency(amountAnnual)} per year`,
      fallbackReason: rateEntry == null
        ? "No official municipal rate row was available for the current municipality or market-city fallback."
        : "The official-rate path could not be paired with source annual tax dollars or a tax-base proxy.",
    });
  }

  const emergencyRate = 0.0065;
  const emergencyAmount = input.purchasePrice * emergencyRate;
  return buildEstimate({
    amountAnnual: emergencyAmount,
    purchasePrice: input.purchasePrice,
    assessedValue: null,
    taxClass: appliedTaxClass,
    method: "effective_tax_backup",
    confidence: "low",
    source: "assumed",
    province: input.province,
    taxYear: null,
    jurisdiction: directCity ?? marketCity,
    areaLabel,
    assessedValueSource: "effective_tax_backup",
    assessmentProxyRatio: null,
    appliedRate: emergencyRate,
    sourceLabel: "Emergency Canadian fallback effective tax burden",
    sourceSummary: "Emergency low-confidence tax backup used because the municipality, class, and province backup layers were all unavailable.",
    formulaSummary: `${formatCurrency(input.purchasePrice)} purchase price × ${formatPercent(emergencyRate)} emergency fallback burden = ${formatCurrency(emergencyAmount)} per year`,
    fallbackReason: "This is the last-resort estimate when the normal municipal and provincial backup layers are unavailable.",
  });
}
