import { parsePropertyTypeParams } from "@/lib/property-type-filters";

export const DASHBOARD_SORT_VALUES = [
  "price_asc",
  "price_desc",
  "score_desc",
  "score_asc",
  "roi_desc",
  "roi_asc",
  "newest",
] as const;

export type DashboardSortValue = (typeof DASHBOARD_SORT_VALUES)[number];

export const DEFAULT_DASHBOARD_MAX_DOWN_PAYMENT = 250_000;
export const UNFILTERED_DASHBOARD_MAX_DOWN_PAYMENT = 2_000_000;

export type DashboardFilterState = {
  city: string;
  propertyTypes: string[];
  minPrice: string;
  maxPrice: string;
  minUnits: string;
  maxUnits: string;
  minScore: string;
  sort: DashboardSortValue;
  maxDownPayment: number;
};

export type DashboardUrlOverrides = {
  maxDownPayment: boolean;
};

export const DEFAULT_DASHBOARD_FILTERS: DashboardFilterState = {
  city: "",
  propertyTypes: [],
  minPrice: "",
  maxPrice: "",
  minUnits: "1",
  maxUnits: "",
  minScore: "",
  sort: "roi_desc",
  maxDownPayment: DEFAULT_DASHBOARD_MAX_DOWN_PAYMENT,
};

function textParam(value: string | null): string {
  return value?.trim() ?? "";
}

function numberTextParam(value: string | null): string {
  const trimmed = textParam(value);
  if (!trimmed) return "";
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? String(parsed) : "";
}

function positiveIntegerTextParam(value: string | null, fallback: string): string {
  const trimmed = numberTextParam(value);
  if (!trimmed) return fallback;
  const parsed = Math.max(1, Math.round(Number(trimmed)));
  return String(parsed);
}

function sortParam(value: string | null): DashboardSortValue {
  return DASHBOARD_SORT_VALUES.includes(value as DashboardSortValue)
    ? (value as DashboardSortValue)
    : DEFAULT_DASHBOARD_FILTERS.sort;
}

function cityFromParams(searchParams: URLSearchParams): string {
  const city = textParam(searchParams.get("city"));
  if (city) return city;

  const market = textParam(searchParams.get("market"));
  if (market.toLowerCase() === "montreal") return "Montreal";
  return market;
}

export function parseDashboardFilters(
  searchParams: URLSearchParams,
  defaults: DashboardFilterState = DEFAULT_DASHBOARD_FILTERS
): { filters: DashboardFilterState; overrides: DashboardUrlOverrides } {
  const maxDownPaymentRaw = searchParams.get("maxDownPayment");
  const maxDownPayment =
    maxDownPaymentRaw != null && maxDownPaymentRaw.trim() !== ""
      ? Number(maxDownPaymentRaw)
      : NaN;
  const hasMaxDownPayment = Number.isFinite(maxDownPayment) && maxDownPayment >= 0;

  return {
    filters: {
      city: cityFromParams(searchParams) || defaults.city,
      propertyTypes: parsePropertyTypeParams(searchParams),
      minPrice: numberTextParam(searchParams.get("minPrice")) || defaults.minPrice,
      maxPrice: numberTextParam(searchParams.get("maxPrice")) || defaults.maxPrice,
      minUnits: positiveIntegerTextParam(searchParams.get("minUnits"), defaults.minUnits),
      maxUnits: positiveIntegerTextParam(searchParams.get("maxUnits"), defaults.maxUnits),
      minScore: numberTextParam(searchParams.get("minScore")) || defaults.minScore,
      sort: sortParam(searchParams.get("sort")) || defaults.sort,
      maxDownPayment: hasMaxDownPayment ? maxDownPayment : defaults.maxDownPayment,
    },
    overrides: {
      maxDownPayment: hasMaxDownPayment,
    },
  };
}

export function dashboardFiltersToSearchParams(filters: DashboardFilterState): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.city) params.set("city", filters.city);
  filters.propertyTypes.forEach((propertyType) => params.append("propertyTypes", propertyType));
  if (filters.minPrice) params.set("minPrice", filters.minPrice);
  if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
  if (filters.minUnits && filters.minUnits !== DEFAULT_DASHBOARD_FILTERS.minUnits) {
    params.set("minUnits", filters.minUnits);
  }
  if (filters.maxUnits) params.set("maxUnits", filters.maxUnits);
  if (filters.minScore) params.set("minScore", filters.minScore);
  if (filters.sort !== DEFAULT_DASHBOARD_FILTERS.sort) params.set("sort", filters.sort);
  if (filters.maxDownPayment < UNFILTERED_DASHBOARD_MAX_DOWN_PAYMENT) {
    params.set("maxDownPayment", String(Math.max(0, Math.round(filters.maxDownPayment))));
  }

  return params;
}
