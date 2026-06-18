"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ListingCard } from "./ListingCard";
import {
  DEFAULT_DASHBOARD_FILTERS,
  DEFAULT_DASHBOARD_MAX_DOWN_PAYMENT,
  UNFILTERED_DASHBOARD_MAX_DOWN_PAYMENT,
  dashboardFiltersToSearchParams,
  parseDashboardFilters,
  type DashboardFilterState,
  type DashboardSortValue,
} from "@/lib/dashboard-url-state";
import {
  ArrowRight,
  BarChart3,
  DollarSign,
  TrendingUp,
  Sparkles,
  ChevronRight,
  SlidersHorizontal,
  X,
  ShieldCheck,
} from "lucide-react";

type Listing = {
  id: string;
  address: string;
  city: string;
  province: string;
  price: number;
  propertyType: string;
  units: number;
  bedrooms: number | null;
  bathrooms: number | null;
  listingUrl: string | null;
  source: string;
  photoUrls: string | null;
  lastSeenAt?: string;
  createdAt?: string;
  isLinkActive?: boolean | null;
  linkCheckedAt?: string | null;
  linkStatusNote?: string | null;
  lastSyncRunAt?: string | null;
  evaluation: { combinedScore: number; cashflowScore: number; equityGrowthScore: number } | null;
  roi?: {
    cashOnCashReturn: number | null;
    annualCashflow: number;
    equityRequired: number;
    rentPerUnitMonthly: number;
    cashflowYears?: Array<{
      year: number;
      annualCashflow: number;
      monthlyCashflow: number;
      cumulativeCashflow: number;
      dscr: number;
    }>;
    yearOneRoi?: number | null;
    totalYearOneReturn?: number;
    yearOneDebtPaydown?: number;
    yearOneAppreciation?: number;
  };
  underwriting?: {
    financingTrackLabel: string;
    minimumDownPayment: number;
    minimumDownPaymentPct: number;
    manualLenderReview: boolean;
    note: string;
  };
};

const SORT_LABELS: Record<DashboardSortValue, string> = {
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
  score_desc: "Score: highest first",
  score_asc: "Score: lowest first",
  roi_desc: "Cash-on-cash ROI: highest first",
  roi_asc: "Cash-on-cash ROI: lowest first",
  newest: "Newest first",
};

const stylesReadoutPrimaryAction: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  borderRadius: 999,
  border: "1px solid #2563eb",
  backgroundColor: "#2563eb",
  color: "#fff",
  padding: "9px 12px",
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 850,
};

const stylesReadoutSecondaryAction: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: 999,
  border: "1px solid #bfdbfe",
  backgroundColor: "#eff6ff",
  color: "#1d4ed8",
  padding: "9px 12px",
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 850,
};

const stylesReadoutButton: CSSProperties = {
  ...stylesReadoutPrimaryAction,
  cursor: "pointer",
};

const stylesEmptyQueueChip: CSSProperties = {
  borderRadius: 999,
  border: "1px solid #dbeafe",
  backgroundColor: "#eff6ff",
  color: "#1e3a8a",
  padding: "6px 8px",
  fontSize: 11,
  fontWeight: 850,
  lineHeight: 1.2,
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

type ActiveFilterChip = {
  id: string;
  label: string;
  onRemove: () => void;
};

type DashboardPreset = {
  id: string;
  label: string;
  detail: string;
  actionLabel: string;
  apply: () => void;
};

type ResultStatusItem = {
  label: string;
  value: string;
  detail: string;
};

type DashboardQueueCommandProps = {
  bestListing: Listing | null;
  buyBoxSummary: string[];
  hasActiveFilters: boolean;
  latestCaptureLabel: string | null;
  listError: string | null;
  loadedListingsCount: number;
  loading: boolean;
  onClearFilters: () => void;
  onEditFilters: () => void;
  onRetry: () => void;
  screeningDecision: { label: string; title: string; detail: string; tone: ScreeningDecisionTone };
  total: number;
};

type DashboardDecisionSignal = {
  label: string;
  value: string;
  detail: string;
  tone: "green" | "amber" | "blue" | "slate";
  href: string;
  actionLabel: string;
};

type DashboardWorkflowItem = {
  step: string;
  label: string;
  value: string;
  detail: string;
  tone: "green" | "amber" | "blue" | "slate";
  href: string;
};

type EmptyQueueProps = {
  activeFilterChips: ActiveFilterChip[];
  buyBoxSummary: string[];
  hasActiveFilters: boolean;
  latestCaptureLabel: string | null;
  listError: string | null;
  onClearFilters: () => void;
  onEditFilters: () => void;
  onRetry: () => void;
  total: number;
};

export function DashboardClient() {
  const { data: session, status: sessionStatus } = useSession();
  const [listings, setListings] = useState<Listing[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");
  const [city, setCity] = useState(DEFAULT_DASHBOARD_FILTERS.city);
  const [propertyTypes, setPropertyTypes] = useState<string[]>(DEFAULT_DASHBOARD_FILTERS.propertyTypes);
  const [minPrice, setMinPrice] = useState(DEFAULT_DASHBOARD_FILTERS.minPrice);
  const [maxPrice, setMaxPrice] = useState(DEFAULT_DASHBOARD_FILTERS.maxPrice);
  const [minUnits, setMinUnits] = useState(DEFAULT_DASHBOARD_FILTERS.minUnits);
  const [maxUnits, setMaxUnits] = useState(DEFAULT_DASHBOARD_FILTERS.maxUnits);
  const [minScore, setMinScore] = useState(DEFAULT_DASHBOARD_FILTERS.minScore);
  const [maxDownPayment, setMaxDownPayment] = useState(DEFAULT_DASHBOARD_MAX_DOWN_PAYMENT);
  const [appliedMaxDownPayment, setAppliedMaxDownPayment] = useState(DEFAULT_DASHBOARD_MAX_DOWN_PAYMENT);
  const [ownerOccupied, setOwnerOccupied] = useState(false);
  const [sort, setSort] = useState<DashboardSortValue>(DEFAULT_DASHBOARD_FILTERS.sort);
  const [filterOptions, setFilterOptions] = useState<{ cities: string[]; propertyTypes: string[] }>({ cities: [], propertyTypes: [] });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filtersHydrated, setFiltersHydrated] = useState(false);
  const [loadKey, setLoadKey] = useState(0);
  const [listError, setListError] = useState<string | null>(null);
  const urlOverridesRef = useRef({ maxDownPayment: false });
  const listRequestIdRef = useRef(0);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setLastUpdated(
        new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const searchParams = new URLSearchParams(window.location.search);
    const { filters, overrides } = parseDashboardFilters(searchParams);
    urlOverridesRef.current = overrides;
    setCity(filters.city);
    setPropertyTypes(filters.propertyTypes);
    setMinPrice(filters.minPrice);
    setMaxPrice(filters.maxPrice);
    setMinUnits(filters.minUnits);
    setMaxUnits(filters.maxUnits);
    setMinScore(filters.minScore);
    setSort(filters.sort);
    setMaxDownPayment(filters.maxDownPayment);
    setAppliedMaxDownPayment(filters.maxDownPayment);
    setFiltersOpen(hasMeaningfulIncomingFilters(searchParams, filters));
    setFiltersHydrated(true);
  }, []);

  useEffect(() => {
    fetch("/api/listings/filters")
      .then((r) => (r.ok ? r.json() : { cities: [], propertyTypes: [] }))
      .then((d) => setFilterOptions({ cities: d?.cities ?? [], propertyTypes: d?.propertyTypes ?? [] }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/underwriting")
      .then((response) => response.json())
      .then((data) => {
        if (!data?.inputs) return;
        if (!urlOverridesRef.current.maxDownPayment) {
          const savedMaxDownPayment = Number(data.inputs.maxDownPayment) || DEFAULT_DASHBOARD_MAX_DOWN_PAYMENT;
          setMaxDownPayment(savedMaxDownPayment);
          setAppliedMaxDownPayment(savedMaxDownPayment);
        }
        setOwnerOccupied(data.inputs.ownerOccupied === true);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!filtersHydrated || typeof window === "undefined") return;

    const params = dashboardFiltersToSearchParams({
      city,
      propertyTypes,
      minPrice,
      maxPrice,
      minUnits,
      maxUnits,
      minScore,
      sort,
      maxDownPayment,
    });
    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl !== currentUrl) {
      window.history.replaceState(null, "", nextUrl);
    }
  }, [city, filtersHydrated, maxDownPayment, maxPrice, maxUnits, minPrice, minScore, minUnits, propertyTypes, sort]);

  useEffect(() => {
    const timeoutId = window.setTimeout(
      () => setAppliedMaxDownPayment(maxDownPayment),
      300
    );
    return () => window.clearTimeout(timeoutId);
  }, [maxDownPayment]);

  useEffect(() => {
    if (!filtersHydrated) return;

    const requestId = listRequestIdRef.current + 1;
    listRequestIdRef.current = requestId;
    setLoading(true);
    setListError(null);
    const params = new URLSearchParams();
    params.set("limit", "100");
    params.set("sort", sort);
    if (minPrice) params.set("minPrice", minPrice);
    if (maxPrice) params.set("maxPrice", maxPrice);
    if (minScore) params.set("minScore", minScore);
    if (minUnits) params.set("minUnits", minUnits);
    if (maxUnits) params.set("maxUnits", maxUnits);
    if (city) params.set("city", city);
    propertyTypes.forEach((value) => params.append("propertyTypes", value));
    params.set("maxDownPayment", String(appliedMaxDownPayment));
    if (ownerOccupied) params.set("ownerOccupied", "1");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/api/listings?${params}`
        : `/api/listings?${params}`;
    fetch(url, { signal: controller.signal })
      .then((r) => {
        if (requestId !== listRequestIdRef.current) {
          return { listings: [], total: 0, stale: true };
        }
        if (!r.ok) {
          setListError(`Server returned ${r.status}. Check the console.`);
          return { listings: [], total: 0 };
        }
        return r.json();
      })
      .then((d) => {
        if (requestId !== listRequestIdRef.current || d?.stale) return;
        setListings(Array.isArray(d?.listings) ? d.listings : []);
        setTotal(typeof d?.total === "number" ? d.total : 0);
      })
      .catch((err) => {
        if (requestId !== listRequestIdRef.current || controller.signal.aborted) return;
        setListings([]);
        setTotal(0);
        const msg =
          err?.name === "AbortError"
            ? "Request timed out. Try again."
            : err?.message || "Failed to load listings. Check your connection.";
        setListError(msg);
      })
      .finally(() => {
        clearTimeout(timeoutId);
        if (requestId === listRequestIdRef.current) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [city, filtersHydrated, propertyTypes, minPrice, maxPrice, minScore, minUnits, maxUnits, sort, appliedMaxDownPayment, ownerOccupied, loadKey]);

  const clearFilters = () => {
    setCity(DEFAULT_DASHBOARD_FILTERS.city);
    setPropertyTypes(DEFAULT_DASHBOARD_FILTERS.propertyTypes);
    setMinPrice(DEFAULT_DASHBOARD_FILTERS.minPrice);
    setMaxPrice(DEFAULT_DASHBOARD_FILTERS.maxPrice);
    setMinUnits(DEFAULT_DASHBOARD_FILTERS.minUnits);
    setMaxUnits(DEFAULT_DASHBOARD_FILTERS.maxUnits);
    setMinScore(DEFAULT_DASHBOARD_FILTERS.minScore);
    setSort(DEFAULT_DASHBOARD_FILTERS.sort);
    setMaxDownPayment(UNFILTERED_DASHBOARD_MAX_DOWN_PAYMENT);
    setAppliedMaxDownPayment(UNFILTERED_DASHBOARD_MAX_DOWN_PAYMENT);
  };

  const applyMontrealPlexPreset = () => {
    setCity("Montreal");
    setPropertyTypes(["Multi-Family"]);
    setMinPrice("600000");
    setMaxPrice("1300000");
    setMinUnits("5");
    setMaxUnits("5");
    setMinScore(DEFAULT_DASHBOARD_FILTERS.minScore);
    setSort("roi_desc");
    setMaxDownPayment(DEFAULT_DASHBOARD_MAX_DOWN_PAYMENT);
    setAppliedMaxDownPayment(DEFAULT_DASHBOARD_MAX_DOWN_PAYMENT);
    setFiltersOpen(false);
  };

  const applyRoiQueuePreset = () => {
    setCity(DEFAULT_DASHBOARD_FILTERS.city);
    setPropertyTypes(DEFAULT_DASHBOARD_FILTERS.propertyTypes);
    setMinPrice(DEFAULT_DASHBOARD_FILTERS.minPrice);
    setMaxPrice(DEFAULT_DASHBOARD_FILTERS.maxPrice);
    setMinUnits(DEFAULT_DASHBOARD_FILTERS.minUnits);
    setMaxUnits(DEFAULT_DASHBOARD_FILTERS.maxUnits);
    setMinScore(DEFAULT_DASHBOARD_FILTERS.minScore);
    setSort("roi_desc");
    setMaxDownPayment(UNFILTERED_DASHBOARD_MAX_DOWN_PAYMENT);
    setAppliedMaxDownPayment(UNFILTERED_DASHBOARD_MAX_DOWN_PAYMENT);
    setFiltersOpen(false);
  };

  const applyCapitalPreset = (value: number) => {
    setMaxDownPayment(value);
    setAppliedMaxDownPayment(value);
  };

  const hasActiveFilters =
    !!city || propertyTypes.length > 0 || !!minPrice || !!maxPrice || minUnits !== DEFAULT_DASHBOARD_FILTERS.minUnits || !!maxUnits || !!minScore || sort !== DEFAULT_DASHBOARD_FILTERS.sort || maxDownPayment < UNFILTERED_DASHBOARD_MAX_DOWN_PAYMENT;
  const activeCount = [city, propertyTypes.length > 0 ? propertyTypes.join(",") : "", minPrice, maxPrice, minUnits !== DEFAULT_DASHBOARD_FILTERS.minUnits ? minUnits : "", maxUnits, minScore, sort !== DEFAULT_DASHBOARD_FILTERS.sort ? sort : "", maxDownPayment < UNFILTERED_DASHBOARD_MAX_DOWN_PAYMENT ? maxDownPayment : ""].filter(Boolean).length;
  const isMultiFamilyType = propertyTypes.some((type) => type.toLowerCase().includes("multi"));
  const unitRangeLabel = formatUnitRange(minUnits, maxUnits);
  const buyBoxSummary = [
    city || "All cities",
    propertyTypes.length ? propertyTypes.join(", ") : "All property types",
    minPrice || maxPrice
      ? `${minPrice ? formatPlainCurrency(Number(minPrice)) : "No floor"} to ${maxPrice ? formatPlainCurrency(Number(maxPrice)) : "No cap"}`
      : "Any price",
    unitRangeLabel,
    maxDownPayment < UNFILTERED_DASHBOARD_MAX_DOWN_PAYMENT
      ? `Cash <= ${formatPlainCurrency(maxDownPayment)}`
      : "Cash unconstrained",
    SORT_LABELS[sort],
  ];
  const collapsedFilterSummary = buyBoxSummary.join(" · ");
  const dashboardPresets: DashboardPreset[] = [
    {
      id: "montreal-plex",
      label: "Montreal 5+ plex buy box",
      detail: "$600k-$1.3M, multifamily, ROI first, current cash limit.",
      actionLabel: "Apply buy box",
      apply: applyMontrealPlexPreset,
    },
    {
      id: "roi-queue",
      label: "Best ROI queue",
      detail: "All active inventory sorted by modeled cash-on-cash return.",
      actionLabel: "Sort by ROI",
      apply: applyRoiQueuePreset,
    },
    {
      id: "wide-open",
      label: "Open inventory",
      detail: "Remove optional filters and show the broad active market again.",
      actionLabel: "Clear filters",
      apply: clearFilters,
    },
  ];
  const scrollToDashboardSection = (sectionId: string) => {
    const section = document.getElementById(sectionId);
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const openFiltersFromShortcut = () => {
    setFiltersOpen(true);
    window.requestAnimationFrame(() => scrollToDashboardSection("dashboard-filters"));
  };
  const closeFiltersToResults = () => {
    setFiltersOpen(false);
    window.requestAnimationFrame(() => scrollToDashboardSection("dashboard-listings"));
  };

  const togglePropertyType = (value: string) => {
    setPropertyTypes((current) => {
      const next = current.includes(value)
        ? current.filter((type) => type !== value)
        : [...current, value];
      if (!next.some((type) => type.toLowerCase().includes("multi"))) {
        setMinUnits("1");
        setMaxUnits("");
      }
      return next;
    });
  };
  const activeFilterChips: ActiveFilterChip[] = [
    ...(city
      ? [
          {
            id: "city",
            label: `City: ${city}`,
            onRemove: () => setCity(DEFAULT_DASHBOARD_FILTERS.city),
          },
        ]
      : []),
    ...propertyTypes.map((propertyType) => ({
      id: `property-type-${propertyType}`,
      label: `Type: ${propertyType}`,
      onRemove: () => togglePropertyType(propertyType),
    })),
    ...(minPrice
      ? [
          {
            id: "min-price",
            label: `Min price: ${formatPlainCurrency(Number(minPrice))}`,
            onRemove: () => setMinPrice(DEFAULT_DASHBOARD_FILTERS.minPrice),
          },
        ]
      : []),
    ...(maxPrice
      ? [
          {
            id: "max-price",
            label: `Max price: ${formatPlainCurrency(Number(maxPrice))}`,
            onRemove: () => setMaxPrice(DEFAULT_DASHBOARD_FILTERS.maxPrice),
          },
        ]
      : []),
    ...(minUnits !== DEFAULT_DASHBOARD_FILTERS.minUnits && minUnits !== maxUnits
      ? [
          {
            id: "min-units",
            label: `${minUnits}+ units`,
            onRemove: () => setMinUnits(DEFAULT_DASHBOARD_FILTERS.minUnits),
          },
        ]
      : []),
    ...(maxUnits
      ? [
          {
            id: "max-units",
            label:
              minUnits && minUnits === maxUnits
                ? `Exact ${maxUnits} units`
                : `Max units: ${maxUnits}`,
            onRemove: () => setMaxUnits(DEFAULT_DASHBOARD_FILTERS.maxUnits),
          },
        ]
      : []),
    ...(minScore
      ? [
          {
            id: "min-score",
            label: `Score ${minScore}+`,
            onRemove: () => setMinScore(DEFAULT_DASHBOARD_FILTERS.minScore),
          },
        ]
      : []),
    ...(sort !== DEFAULT_DASHBOARD_FILTERS.sort
      ? [
          {
            id: "sort",
            label: `Sort: ${SORT_LABELS[sort]}`,
            onRemove: () => setSort(DEFAULT_DASHBOARD_FILTERS.sort),
          },
        ]
      : []),
    ...(maxDownPayment < UNFILTERED_DASHBOARD_MAX_DOWN_PAYMENT
      ? [
          {
            id: "max-down-payment",
            label: `Down payment <= ${formatPlainCurrency(maxDownPayment)}`,
            onRemove: () => {
              setMaxDownPayment(UNFILTERED_DASHBOARD_MAX_DOWN_PAYMENT);
              setAppliedMaxDownPayment(UNFILTERED_DASHBOARD_MAX_DOWN_PAYMENT);
            },
          },
        ]
      : []),
  ];
  const latestCapture = listings
    .map((listing) => listing.lastSyncRunAt)
    .filter(Boolean)
    .map((value) => new Date(value as string).getTime())
    .filter(Number.isFinite)
    .sort((a, b) => b - a)[0];
  const latestCaptureLabel = latestCapture
    ? new Date(latestCapture).toLocaleString("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  const bestListing = selectBestOpportunity(listings);
  const loadedListingsCount = listings.length;
  const positiveCashflowCount = listings.filter((listing) => (listing.roi?.annualCashflow ?? 0) > 0).length;
  const manualReviewCount = listings.filter((listing) => listing.underwriting?.manualLenderReview).length;
  const modeledRoiValues = listings
    .map((listing) => listing.roi?.cashOnCashReturn)
    .filter((value): value is number => value != null && Number.isFinite(value));
  const currentAvgRoi = average(modeledRoiValues);
  const unknownRoiCount = Math.max(0, loadedListingsCount - modeledRoiValues.length);
  const currentStrongDeals = listings.filter((listing) => (listing.evaluation?.combinedScore ?? 0) >= 80).length;
  const currentHighScore90 = listings.filter((listing) => (listing.evaluation?.combinedScore ?? 0) >= 90).length;
  const currentCashRequirements = listings
    .map((listing) => listing.roi?.equityRequired ?? listing.underwriting?.minimumDownPayment)
    .filter((value): value is number => value != null && Number.isFinite(value) && value >= 0);
  const medianCashRequired = median(currentCashRequirements);
  const bestListingScore = bestListing?.evaluation?.combinedScore ?? null;
  const bestListingRoi = bestListing?.roi?.cashOnCashReturn ?? null;
  const bestListingCashflow = bestListing?.roi?.annualCashflow ?? null;
  const bestListingThreeYearCashflow = bestListing ? threeYearCashflow(bestListing) : null;
  const bestListingRoiValue = bestListing ? yearOneRoiValue(bestListing) : null;
  const bestListingRoiFormula = bestListing ? roiValueFormula(bestListing) : "ROI value n/a";
  const bestListingCashRequired = bestListing?.roi?.equityRequired ?? bestListing?.underwriting?.minimumDownPayment ?? null;
  const cashCapActive = maxDownPayment < UNFILTERED_DASHBOARD_MAX_DOWN_PAYMENT;
  const appliedCashCapActive = appliedMaxDownPayment < UNFILTERED_DASHBOARD_MAX_DOWN_PAYMENT;
  const loadedCashFitCount = currentCashRequirements.filter((value) => !appliedCashCapActive || value <= appliedMaxDownPayment).length;
  const topDealHeadroom =
    cashCapActive && bestListingCashRequired != null ? maxDownPayment - bestListingCashRequired : null;
  const capitalPresetItems = [
    { label: "$50k", value: 50_000, detail: "Starter screen" },
    { label: "$100k", value: 100_000, detail: "Small rental" },
    { label: "$250k", value: DEFAULT_DASHBOARD_MAX_DOWN_PAYMENT, detail: "Default box" },
    { label: "$500k", value: 500_000, detail: "Larger plex" },
    { label: "No cap", value: UNFILTERED_DASHBOARD_MAX_DOWN_PAYMENT, detail: "Open inventory" },
  ];
  const capitalFitItems = [
    {
      label: "Cash cap",
      value: cashCapActive ? formatPlainCurrency(maxDownPayment) : "No cap",
      detail: ownerOccupied ? "Owner-occupied profile applied" : "Investor profile applied",
      tone: cashCapActive ? "blue" : "slate",
    },
    {
      label: "Loaded fit",
      value: loading
        ? "..."
        : currentCashRequirements.length > 0
          ? `${loadedCashFitCount}/${currentCashRequirements.length}`
          : "n/a",
      detail: appliedCashCapActive
        ? "Loaded cards with known cash need inside the cap"
        : "No cash cap is limiting the loaded queue",
      tone: !appliedCashCapActive || loadedCashFitCount > 0 ? "green" : "amber",
    },
    {
      label: "Median cash",
      value: medianCashRequired != null ? formatPlainCurrency(medianCashRequired) : "n/a",
      detail: "Middle known equity need in loaded cards",
      tone:
        medianCashRequired == null
          ? "slate"
          : !cashCapActive || medianCashRequired <= maxDownPayment
            ? "green"
            : "amber",
    },
    {
      label: "Top deal headroom",
      value:
        topDealHeadroom == null
          ? cashCapActive
            ? "n/a"
            : "No cap"
          : formatPlainCurrency(topDealHeadroom),
      detail:
        topDealHeadroom == null
          ? cashCapActive
            ? "Top deal cash need unavailable"
            : "Cash cap is not limiting the top deal"
          : topDealHeadroom >= 0
            ? "Cash left after top visible deal"
            : "Top visible deal exceeds current cap",
      tone: topDealHeadroom == null ? "slate" : topDealHeadroom >= 0 ? "green" : "amber",
    },
  ] as const;
  const positiveCashflowShare =
    loadedListingsCount > 0 ? Math.round((positiveCashflowCount / loadedListingsCount) * 100) : 0;
  const queueReadoutItems = [
    {
      label: "Positive CF",
      value: loading ? "..." : `${positiveCashflowCount}/${loadedListingsCount}`,
      detail: "Annual cashflow > $0",
    },
    {
      label: "Lender review",
      value: loading ? "..." : String(manualReviewCount),
      detail: "Manual exception path",
    },
    {
      label: "Unknown ROI",
      value: loading ? "..." : String(unknownRoiCount),
      detail: "Needs better source data",
    },
  ];
  const decisionSignals: DashboardDecisionSignal[] = [
    {
      label: "Top visible return",
      value: bestListingRoi != null ? `${bestListingRoi.toFixed(1)}%` : "n/a",
      detail: bestListing
        ? `${bestListing.address} · ${formatOptionalPlainCurrency(bestListingCashflow)} Y1 CF · ${formatOptionalPlainCurrency(bestListingThreeYearCashflow)} 3Y CF · ${formatOptionalPlainCurrency(bestListingRoiValue)} ROI value`
        : loading
          ? "Waiting for ranked cards."
          : "No ranked listing in the current screen.",
      tone: bestListingRoi != null && bestListingRoi > 0 ? "green" : bestListing ? "amber" : "slate",
      href: bestListing ? `/listings/${bestListing.id}` : "#dashboard-filters",
      actionLabel: bestListing ? "Open deal" : "Adjust screen",
    },
    {
      label: "Cashflow coverage",
      value: loading ? "..." : `${positiveCashflowCount}/${loadedListingsCount}`,
      detail:
        loadedListingsCount > 0
          ? `${positiveCashflowShare}% of loaded cards model positive annual cashflow.`
          : "No loaded cards to evaluate yet.",
      tone: positiveCashflowCount > 0 ? "green" : "amber",
      href: "#dashboard-listings",
      actionLabel: "Review cards",
    },
    {
      label: "Lender burden",
      value: loading ? "..." : String(manualReviewCount),
      detail:
        manualReviewCount > 0
          ? "Manual lender-review flags need broker confirmation before treating returns as actionable."
          : "No loaded cards are flagged for manual lender exception review.",
      tone: manualReviewCount > 0 ? "amber" : "green",
      href: "/underwriting",
      actionLabel: "Check lender box",
    },
    {
      label: "ROI data gaps",
      value: loading ? "..." : String(unknownRoiCount),
      detail:
        unknownRoiCount > 0
          ? "Missing rent, expense, or debt assumptions can hide good or bad deals."
          : "Loaded cards have modeled ROI values.",
      tone: unknownRoiCount > 0 ? "amber" : "green",
      href: "#dashboard-listings",
      actionLabel: "Audit cards",
    },
  ];
  const screeningDecision = getScreeningDecision({
    bestListingExists: Boolean(bestListing),
    bestListingRoi,
    loadedListingsCount,
    loading,
    listError,
    manualReviewCount,
    modeledRoiCount: modeledRoiValues.length,
    positiveCashflowCount,
    unknownRoiCount,
  });
  const summaryTiles = [
    {
      label: "Listings in view",
      value: total.toLocaleString("en-CA"),
      detail:
        total > loadedListingsCount
          ? `${loadedListingsCount} loaded for review`
          : "Matches the current filters",
      icon: <ShieldCheck size={18} />,
      tone: "blue" as const,
    },
    {
      label: "Strong in view",
      value: loading ? "..." : String(currentStrongDeals),
      detail: `${currentHighScore90} score 90+ in loaded queue`,
      icon: <TrendingUp size={18} />,
      tone: "green" as const,
    },
    {
      label: "Avg CoC ROI",
      value: currentAvgRoi != null ? `${currentAvgRoi.toFixed(1)}%` : "—",
      detail:
        modeledRoiValues.length > 0
          ? `${modeledRoiValues.length} modeled in current queue`
          : "No modeled ROI in view",
      icon: <BarChart3 size={18} />,
      tone: "violet" as const,
    },
    {
      label: "Median cash req.",
      value: medianCashRequired != null ? formatPlainCurrency(medianCashRequired) : "—",
      detail:
        maxDownPayment < UNFILTERED_DASHBOARD_MAX_DOWN_PAYMENT
          ? `Screen cap ${formatPlainCurrency(maxDownPayment)}`
          : "No down payment cap active",
      icon: <DollarSign size={18} />,
      tone: "slate" as const,
    },
  ];
  const resultStatusItems: ResultStatusItem[] = [
    {
      label: "Loaded queue",
      value: loading ? "..." : `${loadedListingsCount}/${total.toLocaleString("en-CA")}`,
      detail:
        total > loadedListingsCount
          ? "Cards loaded for review"
          : "All matches loaded",
    },
    {
      label: "Ranking",
      value: SORT_LABELS[sort],
      detail: "Current sort order",
    },
    {
      label: "Cash cap",
      value:
        appliedMaxDownPayment < UNFILTERED_DASHBOARD_MAX_DOWN_PAYMENT
          ? formatPlainCurrency(appliedMaxDownPayment)
          : "No cap",
      detail: ownerOccupied ? "Owner-occupied profile" : "Investor profile",
    },
    {
      label: "Captured",
      value: latestCaptureLabel ?? "Pending",
      detail: "Newest listing capture in view",
    },
  ];
  const screeningWorkflowItems: DashboardWorkflowItem[] = [
    {
      step: "1",
      label: "Set the buy box",
      value: city || propertyTypes.length > 0 || minPrice || maxPrice || maxUnits ? `${activeCount} active filters` : "Broad market",
      detail: collapsedFilterSummary,
      tone: hasActiveFilters ? "blue" : "slate",
      href: "#dashboard-filters",
    },
    {
      step: "2",
      label: "Check capital fit",
      value:
        appliedMaxDownPayment < UNFILTERED_DASHBOARD_MAX_DOWN_PAYMENT
          ? formatPlainCurrency(appliedMaxDownPayment)
          : "No cap",
      detail:
        currentCashRequirements.length > 0
          ? `${loadedCashFitCount}/${currentCashRequirements.length} loaded cards fit known cash need.`
          : "Cash requirement not available for loaded cards yet.",
      tone: !appliedCashCapActive || loadedCashFitCount > 0 ? "green" : "amber",
      href: "#dashboard-filters",
    },
    {
      step: "3",
      label: "Rank the queue",
      value: SORT_LABELS[sort],
      detail:
        modeledRoiValues.length > 0
          ? `${modeledRoiValues.length} cards have modeled CoC ROI; ${unknownRoiCount} need better data.`
          : "ROI ranking will improve as rent and expense inputs are confirmed.",
      tone: modeledRoiValues.length > 0 ? "green" : "amber",
      href: "#dashboard-listings",
    },
    {
      step: "4",
      label: "Open the next deal",
      value: bestListing ? bestListing.address : "No top deal yet",
      detail: bestListing
        ? `${formatOptionalPlainCurrency(bestListingCashflow)} Y1 cashflow · ${formatOptionalPlainCurrency(bestListingRoiValue)} ROI value.`
        : "Adjust the screen or borrower box until a financeable card appears.",
      tone: bestListingRoi != null && bestListingRoi > 0 ? "green" : bestListing ? "amber" : "slate",
      href: bestListing ? `/listings/${bestListing.id}` : "#dashboard-filters",
    },
  ];
  const dashboardHeroCopy = listError
    ? "The listing request needs attention before the acquisition queue can be trusted."
    : loading
      ? "Applying the current buy box, cash cap, source status, and ROI sorting."
      : total === 0 && hasActiveFilters
        ? "No active listings match the current investor screen. Loosen the cash cap, price, unit count, or property-type filters to rebuild the queue."
        : total === 0
          ? "No active listings are available after source cleanup. Check retired listings or run the source workflow."
          : "Active listings from the latest source captures, ranked for acquisition review and underwriting.";
  const dashboardHeroStatus = listError
    ? "Request attention needed"
    : loading
      ? "Building filtered queue"
      : total === 0 && hasActiveFilters
        ? "Filters returned 0 matches"
        : total === 0
          ? "No active listings available"
          : "Active source queue";
  const dashboardHeroCountLabel = loading
    ? "Loading matches"
    : total === 0 && hasActiveFilters
      ? "0 listings match this screen"
      : `${total} ${hasActiveFilters ? "matching" : "active"} listing${total === 1 ? "" : "s"}`;
  const isSignedIn = sessionStatus === "authenticated";
  const profileLabel = session?.user?.name || session?.user?.email || "Investor profile";

  return (
    <div className="dashboard-page" style={{ padding: 24, backgroundColor: "#f8fafc", minHeight: "100%" }}>
      <header
        className="dashboard-hero"
        style={{
          background: "linear-gradient(135deg, #ffffff 0%, #eff6ff 100%)",
          border: "1px solid #dbeafe",
          borderRadius: 20,
          padding: "20px 24px",
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>
            Investment Dashboard
          </h1>
          <p style={{ color: "#64748b", margin: "4px 0 0 0", fontSize: 14 }}>
            {dashboardHeroCopy}
          </p>
          <p style={{ color: "#64748b", margin: "4px 0 0 0", fontSize: 13 }}>
            {latestCaptureLabel ? `Latest data captured: ${latestCaptureLabel}` : "Latest data capture will appear after the next sync."}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, backgroundColor: "#fff", border: "1px solid #dbeafe", color: "#1d4ed8", padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
              <ShieldCheck size={14} />
              {dashboardHeroStatus}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, backgroundColor: "#fff", border: "1px solid #e2e8f0", color: "#475569", padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
              {dashboardHeroCountLabel}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          {isSignedIn ? (
            <div className="dashboard-account-actions" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Link
                href="/profile"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "10px 16px",
                  backgroundColor: "#2563eb",
                  color: "white",
                  borderRadius: 8,
                  textDecoration: "none",
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                Profile
                <ChevronRight size={18} />
              </Link>
              <Link
                href="/underwriting"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "10px 14px",
                  backgroundColor: "#fff",
                  color: "#1d4ed8",
                  border: "1px solid #bfdbfe",
                  borderRadius: 8,
                  textDecoration: "none",
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                Underwriting
              </Link>
            </div>
          ) : (
            <Link
              href="/signin?callbackUrl=%2F"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "10px 16px",
                backgroundColor: "#16a34a",
                color: "white",
                borderRadius: 8,
                textDecoration: "none",
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              {sessionStatus === "loading" ? "Checking profile..." : "Sign in"}
              <ChevronRight size={18} />
            </Link>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: isSignedIn ? "#2563eb" : "#22c55e", flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 210 }}>
              {isSignedIn ? `Profile: ${profileLabel}` : sessionStatus === "loading" ? "Checking profile" : "Guest screening"}
            </span>
          </div>
          <span style={{ fontSize: 13, color: "#94a3b8" }}>
            Last updated: {lastUpdated}
          </span>
        </div>
      </header>

      <MobileInvestorActionBar
        hasTopDeal={Boolean(bestListing)}
        onFilters={openFiltersFromShortcut}
        onTopDeal={() => scrollToDashboardSection("dashboard-top-opportunity")}
        onListings={() => scrollToDashboardSection("dashboard-listings")}
      />

      {!loading && bestListing && (
        <section
          id="dashboard-top-opportunity"
          className="dashboard-two-column dashboard-top-opportunity"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.35fr) minmax(280px, 0.75fr)",
            gap: 14,
            alignItems: "stretch",
            background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 62%, #2563eb 100%)",
            border: "1px solid rgba(147,197,253,0.5)",
            borderRadius: 12,
            padding: 18,
            color: "#fff",
            marginBottom: 24,
            boxShadow: "0 18px 40px rgba(30,58,138,0.18)",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, color: "#bfdbfe", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em" }}>
              BEST OPPORTUNITY IN VIEW
            </p>
            <h2 className="dashboard-top-opportunity-title" style={{ margin: "7px 0 0", color: "#fff", fontSize: 22, lineHeight: 1.2 }}>
              {bestListing.address}
            </h2>
            <p style={{ margin: "7px 0 0", color: "#dbeafe", fontSize: 13, lineHeight: 1.55 }}>
              {bestListing.city}, {bestListing.province} · {bestListing.units} units · {bestListing.underwriting?.financingTrackLabel ?? "Financing path pending"}
            </p>
            <p style={{ margin: "5px 0 0", color: "#bfdbfe", fontSize: 12, lineHeight: 1.45 }}>
              Queue-screen numbers use the dashboard cash filter and saved underwriting assumptions. Open the deal to compare selected-path underwriting.
            </p>
            <div className="dashboard-top-opportunity-metrics" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginTop: 14 }}>
              <HeroMetric
                label="Screen CoC ROI"
                value={bestListingRoi != null ? `${bestListingRoi.toFixed(1)}%` : "n/a"}
                detail="Dashboard queue model"
                toneValue={bestListingRoi}
              />
              <HeroMetric
                label="Y1 cashflow"
                value={formatOptionalPlainCurrency(bestListingCashflow)}
                detail={bestListingCashflow != null ? `${formatPlainCurrency(bestListingCashflow / 12)}/mo under queue assumptions` : "Modeled cashflow unavailable"}
                toneValue={bestListingCashflow}
              />
              <HeroMetric
                label="3Y cashflow"
                value={formatOptionalPlainCurrency(bestListingThreeYearCashflow)}
                detail="First 3 modeled years"
                toneValue={bestListingThreeYearCashflow}
              />
              <HeroMetric
                label="ROI value"
                value={formatOptionalPlainCurrency(bestListingRoiValue)}
                detail={bestListingRoiFormula}
                toneValue={bestListingRoiValue}
              />
              <HeroMetric
                label="Cash required"
                value={bestListingCashRequired != null ? formatPlainCurrency(bestListingCashRequired) : "n/a"}
                detail={bestListing.price ? `${formatPlainCurrency(bestListing.price)} ask` : "Ask unavailable"}
              />
              <HeroMetric
                label="Deal score"
                value={bestListingScore != null ? String(Math.round(bestListingScore)) : "n/a"}
                detail="Model score"
                toneValue={bestListingScore != null ? bestListingScore - 70 : null}
              />
            </div>
          </div>
          <aside
            className="dashboard-top-opportunity-aside"
            style={{
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.16)",
              backgroundColor: "rgba(15,23,42,0.22)",
              padding: 15,
              display: "grid",
              alignContent: "space-between",
              gap: 14,
            }}
          >
            <div>
              <p style={{ margin: 0, color: "#bfdbfe", fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Queue health
              </p>
              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                <MiniQueueStat label="Positive cashflow" value={`${positiveCashflowCount}/${listings.length}`} />
                <MiniQueueStat label="Needs lender review" value={`${manualReviewCount}/${listings.length}`} />
                <MiniQueueStat label="Current sort" value={SORT_LABELS[sort]} />
              </div>
            </div>
            <Link
              href={`/listings/${bestListing.id}`}
              style={{
                display: "inline-flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 8,
                borderRadius: 8,
                backgroundColor: "#fff",
                color: "#1d4ed8",
                padding: "10px 12px",
                textDecoration: "none",
                fontSize: 13,
                fontWeight: 900,
              }}
            >
              Underwrite this deal
              <ArrowRight size={16} />
            </Link>
          </aside>
        </section>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          gap: 12,
          marginBottom: 28,
        }}
      >
        {summaryTiles.map((tile) => (
          <SummaryTile key={tile.label} {...tile} />
        ))}
      </div>

      <DashboardScreeningWorkflow items={screeningWorkflowItems} />

      <section>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Sparkles size={22} color="#1d4ed8" strokeWidth={2} />
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Underwriting queue</h2>
              <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "#64748b" }}>
                Start with the strongest-looking deals, then open the ones that justify deeper work.
              </p>
            </div>
          </div>
          <span style={{ fontSize: 14, color: "#64748b" }}>{total} listings</span>
        </div>

        <div
          id="dashboard-filters"
          style={{
            backgroundColor: "#fff",
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            marginBottom: 24,
            overflow: "hidden",
          }}
        >
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            style={{
              width: "100%",
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) auto",
              alignItems: "center",
              gap: 14,
              padding: "14px 20px",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#0f172a",
              textAlign: "left",
            }}
          >
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 15, fontWeight: 700 }}>
                <SlidersHorizontal size={20} color="#64748b" />
                Filters & sort
                {hasActiveFilters && (
                  <span
                    style={{
                      backgroundColor: "#2563eb",
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 999,
                    }}
                  >
                    {activeCount}
                  </span>
                )}
              </span>
              <span style={{ display: "block", marginTop: 5, color: "#64748b", fontSize: 12, lineHeight: 1.45 }}>
                {filtersOpen
                  ? "Adjust the buy box, cash cap, property types, and ROI sorting."
                  : collapsedFilterSummary}
              </span>
            </span>
            <span
              aria-hidden="true"
              style={{
                color: "#64748b",
                transform: filtersOpen ? "rotate(180deg)" : "none",
                display: "inline-grid",
                placeItems: "center",
                width: 28,
                height: 28,
                borderRadius: 999,
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
              }}
            >
              ▼
            </span>
          </button>

          {filtersOpen && (
            <div style={{ padding: "0 20px 20px", borderTop: "1px solid #f1f5f9" }}>
              <p style={{ margin: "14px 0 0 0", fontSize: 13, color: "#64748b" }}>
                Narrow the list before underwriting. Filters apply to listings that remain in the active source queue.
              </p>
              <div
                style={{
                  marginTop: 14,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                  gap: 10,
                }}
              >
                {dashboardPresets.map((preset) => (
                  <DashboardPresetCard
                    key={preset.id}
                    label={preset.label}
                    detail={preset.detail}
                    actionLabel={preset.actionLabel}
                    onApply={preset.apply}
                  />
                ))}
              </div>
              <div
                style={{
                  marginTop: 14,
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  backgroundColor: "#f8fafc",
                  padding: 12,
                }}
              >
                <div style={{ color: "#475569", fontSize: 11, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Current screen
                </div>
                <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 9 }}>
                  {buyBoxSummary.map((item) => (
                    <span
                      key={item}
                      style={{
                        borderRadius: 999,
                        border: "1px solid #e2e8f0",
                        backgroundColor: "#fff",
                        color: "#334155",
                        padding: "6px 9px",
                        fontSize: 12,
                        fontWeight: 800,
                      }}
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                  gap: 16,
                  paddingTop: 16,
                  alignItems: "end",
                }}
              >
                <div style={{ gridColumn: "1 / -1", padding: 14, borderRadius: 12, backgroundColor: "#eff6ff", border: "1px solid #bfdbfe" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                    <div>
                      <label htmlFor="max-down-payment" style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#1e3a8a" }}>
                        Maximum down payment: ${maxDownPayment.toLocaleString()}
                      </label>
                      <p style={{ margin: "4px 0 0", fontSize: 12, color: "#475569" }}>
                        Filters by modeled minimum equity. {ownerOccupied ? "Owner-occupied 1-4 unit rules are on." : "Investment-property rules are on."}
                      </p>
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
                      <label style={{ fontSize: 12, color: "#475569", fontWeight: 700 }}>
                        Exact amount
                        <input
                          aria-label="Exact maximum down payment"
                          type="number"
                          min={0}
                          step={5_000}
                          value={maxDownPayment}
                          onChange={(event) => setMaxDownPayment(Math.max(0, Number(event.target.value) || 0))}
                          style={{ display: "block", width: 150, marginTop: 5, padding: "7px 9px", borderRadius: 8, border: "1px solid #93c5fd", backgroundColor: "#fff" }}
                        />
                      </label>
                      <Link href="/underwriting" style={{ fontSize: 13, fontWeight: 700, color: "#1d4ed8", paddingBottom: 8 }}>
                        Edit full underwriting profile
                      </Link>
                    </div>
                  </div>
                  <input
                    id="max-down-payment"
                    type="range"
                    min={25_000}
                    max={2_000_000}
                    step={5_000}
                    value={Math.min(2_000_000, Math.max(25_000, maxDownPayment))}
                    onChange={(event) => setMaxDownPayment(Number(event.target.value))}
                    style={{ width: "100%", marginTop: 12, accentColor: "#2563eb" }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b", fontSize: 11 }}>
                    <span>$25k</span><span>$2.0M</span>
                  </div>
                  <div className="dashboard-capital-presets" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                    {capitalPresetItems.map((preset) => (
                      <CapitalPresetButton
                        key={preset.label}
                        label={preset.label}
                        detail={preset.detail}
                        active={
                          preset.value === UNFILTERED_DASHBOARD_MAX_DOWN_PAYMENT
                            ? !cashCapActive
                            : maxDownPayment === preset.value
                        }
                        onClick={() => applyCapitalPreset(preset.value)}
                      />
                    ))}
                  </div>
                  <div className="dashboard-capital-fit-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 9, marginTop: 12 }}>
                    {capitalFitItems.map((item) => (
                      <CapitalFitStat key={item.label} {...item} />
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 6 }}>City</label>
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      backgroundColor: "#fff",
                      fontSize: 14,
                    }}
                  >
                    <option value="">All cities</option>
                    {filterOptions.cities.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 6 }}>Property types</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {filterOptions.propertyTypes.map((p) => {
                      const selected = propertyTypes.includes(p);
                      return (
                        <label
                          key={p}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "8px 10px",
                            borderRadius: 999,
                            border: selected ? "1px solid #2563eb" : "1px solid #e2e8f0",
                            backgroundColor: selected ? "#eff6ff" : "#fff",
                            color: selected ? "#1d4ed8" : "#475569",
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => togglePropertyType(p)}
                            style={{ accentColor: "#2563eb" }}
                          />
                          {p}
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 6 }}>Min price</label>
                  <input
                    type="number"
                    placeholder="Any"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      fontSize: 14,
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 6 }}>Max price</label>
                  <input
                    type="number"
                    placeholder="Any"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      fontSize: 14,
                    }}
                  />
                </div>
                {isMultiFamilyType && (
                  <>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 6 }}>Min units</label>
                      <select
                        value={minUnits}
                        onChange={(e) => setMinUnits(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          border: "1px solid #e2e8f0",
                          borderRadius: 8,
                          backgroundColor: "#fff",
                          fontSize: 14,
                        }}
                      >
                        <option value="1">1+</option>
                        <option value="2">2+</option>
                        <option value="3">3+</option>
                        <option value="4">4+</option>
                        <option value="5">5+</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 6 }}>Max units</label>
                      <select
                        value={maxUnits}
                        onChange={(e) => setMaxUnits(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          border: "1px solid #e2e8f0",
                          borderRadius: 8,
                          backgroundColor: "#fff",
                          fontSize: 14,
                        }}
                      >
                        <option value="">No cap</option>
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="4">4</option>
                        <option value="5">5</option>
                        <option value="6">6</option>
                        <option value="8">8</option>
                      </select>
                    </div>
                  </>
                )}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 6 }}>Min score</label>
                  <input
                    type="number"
                    placeholder="Any"
                    min={0}
                    max={100}
                    value={minScore}
                    onChange={(e) => setMinScore(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      fontSize: 14,
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 6 }}>Sort by</label>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as DashboardSortValue)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      backgroundColor: "#fff",
                      fontSize: 14,
                    }}
                  >
                    <option value="price_asc">Price: low to high</option>
                    <option value="price_desc">Price: high to low</option>
                    <option value="roi_desc">Cash-on-cash ROI: highest first</option>
                    <option value="roi_asc">Cash-on-cash ROI: lowest first</option>
                    <option value="score_desc">Score: highest first</option>
                    <option value="score_asc">Score: lowest first</option>
                    <option value="newest">Newest first</option>
                  </select>
                </div>
              </div>
              <div
                className="dashboard-filter-footer"
                style={{
                  marginTop: 16,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <span style={{ color: "#64748b", fontSize: 12, lineHeight: 1.45 }}>
                  Filters update live. Close this panel when you are ready to compare the visible queue.
                </span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "8px 14px",
                        border: "1px solid #e2e8f0",
                        borderRadius: 8,
                        backgroundColor: "#fff",
                        fontSize: 13,
                        cursor: "pointer",
                        color: "#64748b",
                      }}
                    >
                      <X size={16} />
                      Clear all
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={closeFiltersToResults}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 14px",
                      border: "1px solid #bfdbfe",
                      borderRadius: 8,
                      backgroundColor: "#eff6ff",
                      fontSize: 13,
                      fontWeight: 900,
                      cursor: "pointer",
                      color: "#1d4ed8",
                    }}
                  >
                    View results
                    <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div
          className="dashboard-results-status"
          style={{
            backgroundColor: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            padding: 14,
            marginBottom: 20,
            boxShadow: "0 1px 3px rgba(15,23,42,0.04)",
          }}
        >
          <DashboardQueueCommandPanel
            bestListing={bestListing}
            buyBoxSummary={buyBoxSummary}
            hasActiveFilters={hasActiveFilters}
            latestCaptureLabel={latestCaptureLabel}
            listError={listError}
            loadedListingsCount={loadedListingsCount}
            loading={loading}
            onClearFilters={clearFilters}
            onEditFilters={openFiltersFromShortcut}
            onRetry={() => setLoadKey((k) => k + 1)}
            screeningDecision={screeningDecision}
            total={total}
          />

          <div className="dashboard-results-status-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginTop: 12 }}>
            {resultStatusItems.map((item) => (
              <ResultStatusTile key={item.label} {...item} />
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", minWidth: 0 }}>
            {activeFilterChips.length > 0 ? (
              activeFilterChips.map((chip) => (
                <FilterChip key={chip.id} label={chip.label} onRemove={chip.onRemove} />
              ))
            ) : (
              <span style={{ color: "#64748b", fontSize: 13, padding: "7px 0" }}>
                No optional filters active
              </span>
            )}
            </div>
            {activeFilterChips.length > 1 && (
              <button
                type="button"
                onClick={clearFilters}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  border: "1px solid #cbd5e1",
                  backgroundColor: "#fff",
                  color: "#475569",
                  borderRadius: 999,
                  padding: "7px 10px",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                <X size={13} />
                Clear all
              </button>
            )}
          </div>
        </div>

        <div
          className="dashboard-two-column dashboard-investor-readout"
          style={{
            background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
            border: "1px solid #dbeafe",
            borderRadius: 12,
            padding: 16,
            marginBottom: 20,
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.2fr) minmax(260px, 0.8fr)",
            gap: 14,
            alignItems: "stretch",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <p style={{ margin: 0, color: "#2563eb", fontSize: 11, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Investor readout
              </p>
              <ScreeningDecisionBadge label={screeningDecision.label} tone={screeningDecision.tone} />
            </div>
            <h3 style={{ margin: "6px 0 0", color: "#0f172a", fontSize: 18, lineHeight: 1.25 }}>
              {screeningDecision.title}
            </h3>
            <p style={{ margin: "7px 0 0", color: listError ? "#b91c1c" : "#64748b", fontSize: 13, lineHeight: 1.55 }}>
              {screeningDecision.detail}
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
              {bestListing ? (
                <Link href={`/listings/${bestListing.id}`} style={stylesReadoutPrimaryAction}>
                  Open top deal
                  <ArrowRight size={14} />
                </Link>
              ) : hasActiveFilters ? (
                <button type="button" onClick={clearFilters} style={stylesReadoutButton}>
                  Clear filters
                  <X size={14} />
                </button>
              ) : (
                <Link href="/underwriting" style={stylesReadoutPrimaryAction}>
                  Set borrower box
                  <ArrowRight size={14} />
                </Link>
              )}
              <Link href="/underwriting" style={stylesReadoutSecondaryAction}>
                Edit underwriting
              </Link>
            </div>
          </div>
          <div className="dashboard-queue-readout-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
            {queueReadoutItems.map((item) => (
              <QueueReadoutTile key={item.label} {...item} />
            ))}
          </div>
        </div>

        <DashboardDecisionSnapshot signals={decisionSignals} />

        <div id="dashboard-listings" className="dashboard-listings-anchor">
          {loading ? (
            <p style={{ color: "#64748b" }}>Loading listings...</p>
          ) : listings.length === 0 ? (
            <EmptyQueueState
              activeFilterChips={activeFilterChips}
              buyBoxSummary={buyBoxSummary}
              hasActiveFilters={hasActiveFilters}
              latestCaptureLabel={latestCaptureLabel}
              listError={listError}
              onClearFilters={clearFilters}
              onEditFilters={openFiltersFromShortcut}
              onRetry={() => setLoadKey((k) => k + 1)}
              total={total}
            />
          ) : (
            <div
              className="dashboard-card-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                gap: 20,
              }}
            >
              {listings.map((l, i) => (
                <ListingCard
                  key={l.id}
                  listing={l}
                  rank={i + 1}
                  maxDownPayment={appliedCashCapActive ? appliedMaxDownPayment : null}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function EmptyQueueState({
  activeFilterChips,
  buyBoxSummary,
  hasActiveFilters,
  latestCaptureLabel,
  listError,
  onClearFilters,
  onEditFilters,
  onRetry,
  total,
}: EmptyQueueProps) {
  const title = listError
    ? "The active listing request failed"
    : hasActiveFilters
      ? "No active listings match this investor screen"
      : "No active listings are available after source cleanup";
  const detail = listError
    ? listError
    : hasActiveFilters
      ? "The current buy box may be too tight, or stale source links were moved out of the active queue. Clear filters first, then inspect retired listings if you expected a property to remain live."
      : "The active queue is empty because listings that disappeared from source captures were moved out of this view. Check retired listings for records that vanished, then refresh or review the Montreal source workflow.";
  const primaryAction = listError ? "Retry request" : hasActiveFilters ? "Clear filters" : "Retry active feed";
  const primaryHandler = listError ? onRetry : hasActiveFilters ? onClearFilters : onRetry;
  const visibleFilters = activeFilterChips.slice(0, 4);
  const hiddenFilterCount = Math.max(0, activeFilterChips.length - visibleFilters.length);

  return (
    <section
      className="dashboard-empty-queue"
      data-testid="dashboard-empty-queue"
      style={{
        borderRadius: 16,
        border: listError ? "1px solid #fecaca" : "1px solid #bfdbfe",
        background: listError
          ? "linear-gradient(135deg, #fff 0%, #fef2f2 100%)"
          : "linear-gradient(135deg, #ffffff 0%, #eff6ff 100%)",
        padding: 22,
        boxShadow: "0 18px 45px rgba(15,23,42,0.08)",
        color: "#0f172a",
      }}
    >
      <div
        className="dashboard-empty-queue-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.35fr) minmax(260px, 0.65fr)",
          gap: 16,
          alignItems: "stretch",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, color: listError ? "#b91c1c" : "#1d4ed8", fontSize: 11, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Empty active queue
          </p>
          <h3 style={{ margin: "7px 0 0", color: "#0f172a", fontSize: 22, lineHeight: 1.2 }}>
            {title}
          </h3>
          <p style={{ margin: "8px 0 0", color: listError ? "#991b1b" : "#475569", fontSize: 14, lineHeight: 1.6 }}>
            {detail}
          </p>

          <div className="dashboard-empty-queue-actions" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
            <button type="button" onClick={primaryHandler} style={stylesReadoutButton}>
              {primaryAction}
              <ArrowRight size={14} />
            </button>
            <button type="button" onClick={onEditFilters} style={{ ...stylesReadoutSecondaryAction, cursor: "pointer" }}>
              Edit screen
            </button>
            <Link href="/sold" style={stylesReadoutSecondaryAction}>
              View retired listings
            </Link>
            <Link href="/montreal" style={stylesReadoutSecondaryAction}>
              Montreal workflow
            </Link>
            <Link href="/underwriting" style={stylesReadoutSecondaryAction}>
              Underwriting box
            </Link>
          </div>
        </div>

        <aside
          className="dashboard-empty-queue-status"
          style={{
            borderRadius: 12,
            border: "1px solid #dbeafe",
            backgroundColor: "#fff",
            padding: 14,
            display: "grid",
            gap: 11,
            alignContent: "start",
            minWidth: 0,
          }}
        >
          <EmptyQueueFact label="Active matches" value={String(total)} detail="After current filters and source-status cleanup" />
          <EmptyQueueFact label="Latest capture" value={latestCaptureLabel ?? "Pending"} detail="Newest active listing captured in this view" />
          <div>
            <p style={{ margin: 0, color: "#64748b", fontSize: 10, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Current screen
            </p>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 7 }}>
              {visibleFilters.length > 0 ? (
                <>
                  {visibleFilters.map((chip) => (
                    <span key={chip.id} style={stylesEmptyQueueChip}>{chip.label}</span>
                  ))}
                  {hiddenFilterCount > 0 && <span style={stylesEmptyQueueChip}>+{hiddenFilterCount} more</span>}
                </>
              ) : (
                buyBoxSummary.slice(0, 3).map((item) => (
                  <span key={item} style={stylesEmptyQueueChip}>{item}</span>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

function EmptyQueueFact({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div style={{ borderRadius: 10, border: "1px solid #e2e8f0", backgroundColor: "#f8fafc", padding: 11, minWidth: 0 }}>
      <p style={{ margin: 0, color: "#64748b", fontSize: 10, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        {label}
      </p>
      <p style={{ margin: "6px 0 0", color: "#0f172a", fontSize: 18, fontWeight: 900, lineHeight: 1.15, overflowWrap: "anywhere" }}>
        {value}
      </p>
      <p style={{ margin: "5px 0 0", color: "#64748b", fontSize: 11, lineHeight: 1.35 }}>
        {detail}
      </p>
    </div>
  );
}

function MobileInvestorActionBar({
  hasTopDeal,
  onFilters,
  onTopDeal,
  onListings,
}: {
  hasTopDeal: boolean;
  onFilters: () => void;
  onTopDeal: () => void;
  onListings: () => void;
}) {
  return (
    <div className="dashboard-mobile-action-bar" aria-label="Investor shortcuts">
      <button type="button" onClick={onFilters}>
        Filters
      </button>
      <button type="button" onClick={onTopDeal} disabled={!hasTopDeal}>
        Top deal
      </button>
      <button type="button" onClick={onListings}>
        Cards
      </button>
    </div>
  );
}

function HeroMetric({
  label,
  value,
  detail,
  toneValue,
}: {
  label: string;
  value: string;
  detail: string;
  toneValue?: number | null;
}) {
  const valueColor =
    toneValue == null || !Number.isFinite(toneValue)
      ? "#fff"
      : toneValue > 0
        ? "#86efac"
        : toneValue < 0
          ? "#fecaca"
          : "#e2e8f0";

  return (
    <div
      style={{
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.16)",
        backgroundColor: "rgba(255,255,255,0.1)",
        padding: 12,
        minWidth: 0,
      }}
    >
      <p style={{ margin: 0, color: "#bfdbfe", fontSize: 11, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        {label}
      </p>
      <p style={{ margin: "7px 0 0", color: valueColor, fontSize: 22, fontWeight: 900, lineHeight: 1.08 }}>
        {value}
      </p>
      <p style={{ margin: "7px 0 0", color: "#dbeafe", fontSize: 12, lineHeight: 1.4 }}>
        {detail}
      </p>
    </div>
  );
}

function MiniQueueStat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 10,
        borderRadius: 8,
        backgroundColor: "rgba(255,255,255,0.08)",
        padding: "8px 9px",
        color: "#dbeafe",
        fontSize: 12,
      }}
    >
      <span>{label}</span>
      <strong style={{ color: "#fff", textAlign: "right" }}>{value}</strong>
    </div>
  );
}

function QueueReadoutTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div
      className="dashboard-queue-readout-tile"
      style={{
        borderRadius: 10,
        border: "1px solid #e2e8f0",
        backgroundColor: "#fff",
        padding: 12,
        minWidth: 0,
      }}
    >
      <p style={{ margin: 0, color: "#64748b", fontSize: 11, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        {label}
      </p>
      <p style={{ margin: "7px 0 0", color: "#0f172a", fontSize: 22, fontWeight: 900, lineHeight: 1.05 }}>
        {value}
      </p>
      <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 12, lineHeight: 1.4 }}>
        {detail}
      </p>
    </div>
  );
}

function DashboardScreeningWorkflow({ items }: { items: DashboardWorkflowItem[] }) {
  return (
    <section
      className="dashboard-screening-workflow"
      aria-label="Dashboard screening workflow"
      style={{
        borderRadius: 14,
        border: "1px solid #bae6fd",
        background: "linear-gradient(135deg, #ffffff 0%, #f0fdfa 100%)",
        padding: 16,
        marginBottom: 24,
        boxShadow: "0 12px 28px rgba(14,116,144,0.07)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 13 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, color: "#0f766e", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Screening workflow
          </p>
          <h2 style={{ margin: "5px 0 0", color: "#0f172a", fontSize: 19, lineHeight: 1.22 }}>
            Turn the market into an underwriting queue
          </h2>
          <p style={{ margin: "6px 0 0", color: "#475569", fontSize: 13, lineHeight: 1.55, maxWidth: 860 }}>
            Use this as the operating order: define the screen, confirm cash capacity, rank by return, then open the deal that deserves real underwriting time.
          </p>
        </div>
        <Link href="#dashboard-filters" style={{ ...stylesReadoutSecondaryAction, backgroundColor: "#fff", borderColor: "#99f6e4", color: "#0f766e" }}>
          Adjust screen
        </Link>
      </div>

      <div className="dashboard-screening-workflow-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 }}>
        {items.map((item) => (
          <DashboardWorkflowCard key={item.step} item={item} />
        ))}
      </div>
    </section>
  );
}

function DashboardWorkflowCard({ item }: { item: DashboardWorkflowItem }) {
  const palette = {
    green: { bg: "#ecfdf3", border: "#bbf7d0", accent: "#166534" },
    amber: { bg: "#fffbeb", border: "#fde68a", accent: "#92400e" },
    blue: { bg: "#eff6ff", border: "#bfdbfe", accent: "#1d4ed8" },
    slate: { bg: "#f8fafc", border: "#e2e8f0", accent: "#334155" },
  }[item.tone];

  return (
    <Link
      href={item.href}
      className="dashboard-screening-workflow-card"
      style={{
        minWidth: 0,
        display: "grid",
        gridTemplateColumns: "34px minmax(0, 1fr)",
        gap: 10,
        borderRadius: 12,
        border: `1px solid ${palette.border}`,
        backgroundColor: palette.bg,
        padding: 13,
        textDecoration: "none",
        color: "#0f172a",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 34,
          height: 34,
          borderRadius: 999,
          display: "grid",
          placeItems: "center",
          backgroundColor: "#fff",
          border: `1px solid ${palette.border}`,
          color: palette.accent,
          fontSize: 13,
          fontWeight: 900,
        }}
      >
        {item.step}
      </span>
      <span style={{ minWidth: 0, display: "grid", gap: 5 }}>
        <span style={{ color: palette.accent, fontSize: 10, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {item.label}
        </span>
        <strong style={{ color: "#0f172a", fontSize: 16, lineHeight: 1.15, overflowWrap: "anywhere" }}>
          {item.value}
        </strong>
        <span style={{ color: "#475569", fontSize: 12, lineHeight: 1.4 }}>
          {item.detail}
        </span>
      </span>
    </Link>
  );
}

function DashboardDecisionSnapshot({ signals }: { signals: DashboardDecisionSignal[] }) {
  return (
    <section
      className="dashboard-decision-snapshot"
      style={{
        borderRadius: 12,
        border: "1px solid #e2e8f0",
        background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
        padding: 16,
        marginBottom: 20,
        boxShadow: "0 1px 3px rgba(15,23,42,0.04)",
      }}
      aria-label="Dashboard decision snapshot"
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 13 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, color: "#2563eb", fontSize: 11, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Decision snapshot
          </p>
          <h3 style={{ margin: "5px 0 0", color: "#0f172a", fontSize: 18, lineHeight: 1.25 }}>
            What matters before opening the cards
          </h3>
          <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13, lineHeight: 1.55, maxWidth: 800 }}>
            A fast investor read: return quality, cashflow coverage, lender friction, and ROI data gaps in the current screen.
          </p>
        </div>
        <Link href="/underwriting" style={stylesReadoutSecondaryAction}>
          Tune borrower box
        </Link>
      </div>

      <div className="dashboard-decision-snapshot-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 }}>
        {signals.map((signal) => (
          <DashboardDecisionSignalCard key={signal.label} signal={signal} />
        ))}
      </div>
    </section>
  );
}

function DashboardDecisionSignalCard({ signal }: { signal: DashboardDecisionSignal }) {
  const palette = {
    green: { bg: "#ecfdf3", border: "#bbf7d0", accent: "#166534", label: "Actionable" },
    amber: { bg: "#fffbeb", border: "#fde68a", accent: "#92400e", label: "Verify" },
    blue: { bg: "#eff6ff", border: "#bfdbfe", accent: "#1d4ed8", label: "Review" },
    slate: { bg: "#f8fafc", border: "#e2e8f0", accent: "#334155", label: "Pending" },
  }[signal.tone];

  return (
    <article
      className="dashboard-decision-signal-card"
      style={{
        minWidth: 0,
        borderRadius: 12,
        border: `1px solid ${palette.border}`,
        backgroundColor: palette.bg,
        padding: 14,
        display: "grid",
        gap: 9,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
        <span style={{ color: "#475569", fontSize: 11, fontWeight: 900, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          {signal.label}
        </span>
        <span style={{ borderRadius: 999, border: `1px solid ${palette.border}`, backgroundColor: "#fff", color: palette.accent, padding: "4px 8px", fontSize: 11, fontWeight: 900, whiteSpace: "nowrap" }}>
          {palette.label}
        </span>
      </div>
      <strong style={{ color: palette.accent, fontSize: 23, lineHeight: 1.08, overflowWrap: "anywhere" }}>
        {signal.value}
      </strong>
      <p style={{ margin: 0, color: "#475569", fontSize: 12, lineHeight: 1.5 }}>
        {signal.detail}
      </p>
      <Link href={signal.href} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: palette.accent, fontSize: 12, fontWeight: 900, textDecoration: "none", justifySelf: "start" }}>
        {signal.actionLabel}
        <ArrowRight size={14} />
      </Link>
    </article>
  );
}

function DashboardQueueCommandPanel({
  bestListing,
  buyBoxSummary,
  hasActiveFilters,
  latestCaptureLabel,
  listError,
  loadedListingsCount,
  loading,
  onClearFilters,
  onEditFilters,
  onRetry,
  screeningDecision,
  total,
}: DashboardQueueCommandProps) {
  const palette = {
    blue: { bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8", soft: "#dbeafe" },
    green: { bg: "#ecfdf3", border: "#bbf7d0", color: "#166534", soft: "#dcfce7" },
    amber: { bg: "#fffbeb", border: "#fde68a", color: "#92400e", soft: "#fef3c7" },
    red: { bg: "#fef2f2", border: "#fecaca", color: "#b91c1c", soft: "#fee2e2" },
  } satisfies Record<ScreeningDecisionTone, { bg: string; border: string; color: string; soft: string }>;
  const colors = palette[screeningDecision.tone];
  const screenFacts = [
    {
      label: "Active matches",
      value: loading ? "..." : total.toLocaleString("en-CA"),
      detail: "After source-status cleanup",
    },
    {
      label: "Loaded cards",
      value: loading ? "..." : loadedListingsCount.toLocaleString("en-CA"),
      detail: "Visible in the review queue",
    },
    {
      label: "Latest capture",
      value: latestCaptureLabel ?? "Pending",
      detail: "Newest source capture in view",
    },
  ];
  const screenChips = buyBoxSummary.slice(0, 4);

  let primaryAction: ReactNode;
  if (listError) {
    primaryAction = (
      <button type="button" onClick={onRetry} style={stylesReadoutButton}>
        Retry request
        <ArrowRight size={14} />
      </button>
    );
  } else if (bestListing) {
    primaryAction = (
      <Link href={`/listings/${bestListing.id}`} style={stylesReadoutPrimaryAction}>
        Open top deal
        <ArrowRight size={14} />
      </Link>
    );
  } else if (hasActiveFilters) {
    primaryAction = (
      <button type="button" onClick={onClearFilters} style={stylesReadoutButton}>
        Clear filters
        <X size={14} />
      </button>
    );
  } else {
    primaryAction = (
      <button type="button" onClick={onEditFilters} style={stylesReadoutButton}>
        Edit screen
        <ArrowRight size={14} />
      </button>
    );
  }

  return (
    <section
      className="dashboard-results-command"
      aria-label="Current dashboard queue command"
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.25fr) minmax(280px, 0.75fr)",
        gap: 14,
        alignItems: "stretch",
        borderRadius: 12,
        border: `1px solid ${colors.border}`,
        background: `linear-gradient(135deg, #ffffff 0%, ${colors.bg} 100%)`,
        padding: 14,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <p style={{ margin: 0, color: colors.color, fontSize: 11, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Current queue command
          </p>
          <ScreeningDecisionBadge label={screeningDecision.label} tone={screeningDecision.tone} />
        </div>
        <h3 style={{ margin: "7px 0 0", color: "#0f172a", fontSize: 19, lineHeight: 1.22 }}>
          {screeningDecision.title}
        </h3>
        <p style={{ margin: "7px 0 0", color: listError ? "#991b1b" : "#475569", fontSize: 13, lineHeight: 1.55, maxWidth: 860 }}>
          {screeningDecision.detail}
        </p>

        <div className="dashboard-results-command-actions" style={{ display: "flex", gap: 9, flexWrap: "wrap", marginTop: 12 }}>
          {primaryAction}
          <button type="button" onClick={onEditFilters} style={{ ...stylesReadoutSecondaryAction, cursor: "pointer" }}>
            Edit filters
          </button>
          <Link href="/underwriting" style={stylesReadoutSecondaryAction}>
            Borrower box
          </Link>
        </div>

        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 12 }}>
          {screenChips.map((item) => (
            <span
              key={item}
              style={{
                borderRadius: 999,
                border: `1px solid ${colors.border}`,
                backgroundColor: "#fff",
                color: "#334155",
                padding: "6px 9px",
                fontSize: 12,
                fontWeight: 800,
                maxWidth: "100%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {item}
            </span>
          ))}
        </div>
      </div>

      <aside
        className="dashboard-results-command-screen"
        style={{
          display: "grid",
          gap: 9,
          alignContent: "start",
          borderRadius: 10,
          border: `1px solid ${colors.border}`,
          backgroundColor: "rgba(255,255,255,0.78)",
          padding: 11,
          minWidth: 0,
        }}
      >
        {screenFacts.map((fact) => (
          <div
            key={fact.label}
            style={{
              borderRadius: 9,
              border: `1px solid ${colors.soft}`,
              backgroundColor: "#fff",
              padding: 10,
              minWidth: 0,
            }}
          >
            <p style={{ margin: 0, color: "#64748b", fontSize: 10, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {fact.label}
            </p>
            <p style={{ margin: "5px 0 0", color: colors.color, fontSize: 17, fontWeight: 900, lineHeight: 1.12, overflowWrap: "anywhere" }}>
              {fact.value}
            </p>
            <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 11, lineHeight: 1.35 }}>
              {fact.detail}
            </p>
          </div>
        ))}
      </aside>
    </section>
  );
}

function ResultStatusTile({ label, value, detail }: ResultStatusItem) {
  return (
    <div
      style={{
        borderRadius: 10,
        border: "1px solid #e2e8f0",
        backgroundColor: "#f8fafc",
        padding: 11,
        minWidth: 0,
      }}
    >
      <p style={{ margin: 0, color: "#64748b", fontSize: 10, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        {label}
      </p>
      <p style={{ margin: "6px 0 0", color: "#0f172a", fontSize: 16, fontWeight: 900, lineHeight: 1.15, overflowWrap: "anywhere" }}>
        {value}
      </p>
      <p style={{ margin: "5px 0 0", color: "#64748b", fontSize: 11, lineHeight: 1.35 }}>
        {detail}
      </p>
    </div>
  );
}

type ScreeningDecisionTone = "blue" | "green" | "amber" | "red";

function ScreeningDecisionBadge({ label, tone }: { label: string; tone: ScreeningDecisionTone }) {
  const palette: Record<ScreeningDecisionTone, { bg: string; border: string; color: string }> = {
    blue: { bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" },
    green: { bg: "#ecfdf3", border: "#bbf7d0", color: "#166534" },
    amber: { bg: "#fffbeb", border: "#fde68a", color: "#92400e" },
    red: { bg: "#fef2f2", border: "#fecaca", color: "#b91c1c" },
  };
  const colors = palette[tone];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        border: `1px solid ${colors.border}`,
        backgroundColor: colors.bg,
        color: colors.color,
        padding: "4px 8px",
        fontSize: 11,
        fontWeight: 900,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
      }}
    >
      {label}
    </span>
  );
}

function DashboardPresetCard({
  label,
  detail,
  actionLabel,
  onApply,
}: {
  label: string;
  detail: string;
  actionLabel: string;
  onApply: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onApply}
      style={{
        textAlign: "left",
        border: "1px solid #bfdbfe",
        background: "linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)",
        color: "#0f172a",
        borderRadius: 12,
        padding: 13,
        cursor: "pointer",
        display: "grid",
        gap: 8,
        minHeight: 120,
      }}
    >
      <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <strong style={{ fontSize: 14, lineHeight: 1.25 }}>{label}</strong>
        <ArrowRight size={15} color="#2563eb" />
      </span>
      <span style={{ color: "#64748b", fontSize: 12, lineHeight: 1.45 }}>{detail}</span>
      <span style={{ color: "#1d4ed8", fontSize: 12, fontWeight: 900 }}>{actionLabel}</span>
    </button>
  );
}

function CapitalPresetButton({
  label,
  detail,
  active,
  onClick,
}: {
  label: string;
  detail: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="dashboard-capital-preset-button"
      style={{
        flex: "1 1 120px",
        minWidth: 110,
        borderRadius: 10,
        border: active ? "1px solid #2563eb" : "1px solid #bfdbfe",
        backgroundColor: active ? "#2563eb" : "#fff",
        color: active ? "#fff" : "#1d4ed8",
        padding: "9px 10px",
        cursor: "pointer",
        textAlign: "left",
        boxShadow: active ? "0 8px 18px rgba(37,99,235,0.16)" : "none",
      }}
      aria-pressed={active}
    >
      <span style={{ display: "block", fontSize: 13, fontWeight: 900, lineHeight: 1.15 }}>{label}</span>
      <span style={{ display: "block", marginTop: 3, color: active ? "#dbeafe" : "#64748b", fontSize: 11, lineHeight: 1.25 }}>
        {detail}
      </span>
    </button>
  );
}

function CapitalFitStat({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "green" | "amber" | "blue" | "slate";
}) {
  const palette = {
    green: { bg: "#ecfdf3", border: "#bbf7d0", color: "#166534" },
    amber: { bg: "#fffbeb", border: "#fde68a", color: "#92400e" },
    blue: { bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" },
    slate: { bg: "#f8fafc", border: "#e2e8f0", color: "#334155" },
  }[tone];

  return (
    <div
      className="dashboard-capital-fit-stat"
      style={{
        minWidth: 0,
        borderRadius: 10,
        border: `1px solid ${palette.border}`,
        backgroundColor: palette.bg,
        padding: 11,
      }}
    >
      <p style={{ margin: 0, color: "#475569", fontSize: 10, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        {label}
      </p>
      <p style={{ margin: "6px 0 0", color: palette.color, fontSize: 17, fontWeight: 900, lineHeight: 1.12, overflowWrap: "anywhere" }}>
        {value}
      </p>
      <p style={{ margin: "5px 0 0", color: "#64748b", fontSize: 11, lineHeight: 1.35 }}>
        {detail}
      </p>
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={`Remove filter: ${label}`}
      title={`Remove ${label}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        border: "1px solid #bfdbfe",
        backgroundColor: "#eff6ff",
        color: "#1d4ed8",
        borderRadius: 999,
        padding: "7px 10px",
        fontSize: 12,
        fontWeight: 800,
        cursor: "pointer",
        maxWidth: "100%",
      }}
    >
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      <X size={13} />
    </button>
  );
}

function SummaryTile({
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
  tone: "blue" | "green" | "violet" | "slate";
}) {
  const tones: Record<typeof tone, { bg: string; border: string; color: string }> = {
    blue: { bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" },
    green: { bg: "#ecfdf3", border: "#bbf7d0", color: "#166534" },
    violet: { bg: "#f5f3ff", border: "#ddd6fe", color: "#6d28d9" },
    slate: { bg: "#f8fafc", border: "#e2e8f0", color: "#334155" },
  };
  const palette = tones[tone];

  return (
    <div
      style={{
        backgroundColor: "#fff",
        borderRadius: 8,
        padding: 16,
        border: "1px solid #e2e8f0",
        boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: "#64748b", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
        <span
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            display: "grid",
            placeItems: "center",
            backgroundColor: palette.bg,
            border: `1px solid ${palette.border}`,
            color: palette.color,
            flexShrink: 0,
          }}
        >
          {icon}
        </span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", lineHeight: 1.1, overflowWrap: "anywhere" }}>{value}</div>
      <div style={{ fontSize: 12, color: "#64748b", marginTop: 6, lineHeight: 1.45 }}>{detail}</div>
    </div>
  );
}

function hasMeaningfulIncomingFilters(searchParams: URLSearchParams, filters: DashboardFilterState): boolean {
  if (!searchParams.toString()) return false;

  return (
    Boolean(filters.city) ||
    filters.propertyTypes.length > 0 ||
    Boolean(filters.minPrice) ||
    Boolean(filters.maxPrice) ||
    filters.minUnits !== DEFAULT_DASHBOARD_FILTERS.minUnits ||
    Boolean(filters.maxUnits) ||
    Boolean(filters.minScore) ||
    filters.sort !== DEFAULT_DASHBOARD_FILTERS.sort ||
    filters.maxDownPayment !== DEFAULT_DASHBOARD_FILTERS.maxDownPayment
  );
}

function selectBestOpportunity(listings: Listing[]): Listing | null {
  if (listings.length === 0) return null;
  return [...listings].sort((a, b) => {
    const aRoi = a.roi?.cashOnCashReturn;
    const bRoi = b.roi?.cashOnCashReturn;
    const aHasRoi = aRoi != null && Number.isFinite(aRoi);
    const bHasRoi = bRoi != null && Number.isFinite(bRoi);
    if (aHasRoi && bHasRoi && aRoi !== bRoi) return bRoi - aRoi;
    if (aHasRoi !== bHasRoi) return aHasRoi ? -1 : 1;

    const aScore = a.evaluation?.combinedScore ?? -Infinity;
    const bScore = b.evaluation?.combinedScore ?? -Infinity;
    if (aScore !== bScore) return bScore - aScore;

    return (b.roi?.annualCashflow ?? -Infinity) - (a.roi?.annualCashflow ?? -Infinity);
  })[0];
}

function getScreeningDecision({
  bestListingExists,
  bestListingRoi,
  loadedListingsCount,
  loading,
  listError,
  manualReviewCount,
  modeledRoiCount,
  positiveCashflowCount,
  unknownRoiCount,
}: {
  bestListingExists: boolean;
  bestListingRoi: number | null;
  loadedListingsCount: number;
  loading: boolean;
  listError: string | null;
  manualReviewCount: number;
  modeledRoiCount: number;
  positiveCashflowCount: number;
  unknownRoiCount: number;
}): { label: string; title: string; detail: string; tone: ScreeningDecisionTone } {
  if (loading) {
    return {
      label: "Loading",
      title: "Building the current acquisition screen",
      detail: "The dashboard is applying filters, borrower cash limits, and ROI sorting before recommending the next move.",
      tone: "blue",
    };
  }

  if (listError) {
    return {
      label: "Fix request",
      title: "The listing request needs attention",
      detail: listError,
      tone: "red",
    };
  }

  if (loadedListingsCount === 0) {
    return {
      label: "No matches",
      title: "No listings match this cash and filter screen",
      detail: "Loosen the down payment cap, price range, unit count, or optional filters to rebuild the queue.",
      tone: "amber",
    };
  }

  if (modeledRoiCount === 0 || unknownRoiCount === loadedListingsCount) {
    return {
      label: "Data gap",
      title: "Listings need ROI inputs before they can be ranked well",
      detail: "Source facts loaded, but cash-on-cash ROI is missing across this screen. Verify rent, expense, and financing assumptions before choosing a top deal.",
      tone: "amber",
    };
  }

  if (positiveCashflowCount > 0 && bestListingExists && (bestListingRoi ?? -Infinity) > 0) {
    const positiveLabel = `${positiveCashflowCount} loaded listing${positiveCashflowCount === 1 ? "" : "s"}`;
    return {
      label: "Underwrite first",
      title: `${positiveLabel} model positive cashflow`,
      detail: `${modeledRoiCount} of ${loadedListingsCount} loaded records have modeled CoC ROI. Open the top deal, then verify rent roll, expenses, and lender assumptions before making an offer.`,
      tone: "green",
    };
  }

  if (positiveCashflowCount > 0 && bestListingExists) {
    return {
      label: "Review carefully",
      title: "Positive cashflow exists, but the return signal is mixed",
      detail: `${positiveCashflowCount} loaded listings are cashflow-positive, ${unknownRoiCount} are missing ROI, and ${manualReviewCount} need lender review. Start with the best visible deal, then audit assumptions.`,
      tone: "amber",
    };
  }

  if (manualReviewCount > 0) {
    return {
      label: "Broker check",
      title: "Returns may depend on lender exceptions",
      detail: `${manualReviewCount} loaded listings need manual lender review. Confirm financing before treating the modeled return as actionable.`,
      tone: "amber",
    };
  }

  return {
    label: "Widen screen",
    title: "No loaded listings model positive cashflow yet",
    detail: "Try widening the cash cap, adjusting price or unit filters, or sorting by score to find deals that deserve a deeper underwriting pass.",
    tone: "amber",
  };
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function threeYearCashflow(listing: Listing): number | null {
  if (!listing.roi) return null;
  const years = listing.roi.cashflowYears?.slice(0, 3) ?? [];
  if (years.length > 0) {
    return years.reduce((sum, year) => sum + year.annualCashflow, 0);
  }
  return listing.roi.annualCashflow * 3;
}

function yearOneRoiValue(listing: Listing): number | null {
  if (!listing.roi) return null;
  if (listing.roi.totalYearOneReturn != null && Number.isFinite(listing.roi.totalYearOneReturn)) {
    return listing.roi.totalYearOneReturn;
  }
  return (
    listing.roi.annualCashflow +
    (listing.roi.yearOneDebtPaydown ?? 0) +
    (listing.roi.yearOneAppreciation ?? 0)
  );
}

function roiValueFormula(listing: Listing): string {
  if (!listing.roi) return "ROI value n/a";
  const cashflow = listing.roi.annualCashflow;
  const paydown = listing.roi.yearOneDebtPaydown ?? 0;
  const appreciation = listing.roi.yearOneAppreciation ?? 0;
  const total = yearOneRoiValue(listing);
  return `${formatPlainCurrency(cashflow)} CF + ${formatPlainCurrency(paydown)} paydown + ${formatPlainCurrency(appreciation)} appreciation = ${formatOptionalPlainCurrency(total)}`;
}

function formatOptionalPlainCurrency(value?: number | null): string {
  return value == null || !Number.isFinite(value) ? "n/a" : formatPlainCurrency(value);
}

function formatUnitRange(minUnits: string, maxUnits: string): string {
  const min = Number(minUnits);
  const max = Number(maxUnits);
  const hasMin = Number.isFinite(min) && min > 1;
  const hasMax = Number.isFinite(max) && max > 0;

  if (hasMin && hasMax && min === max) return `Exact ${min} units`;
  if (hasMin && hasMax) return `${min}-${max} units`;
  if (hasMax) return `1-${max} units`;
  if (hasMin) return `${min}+ units`;
  return "Any unit count";
}

function formatPlainCurrency(value: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}
