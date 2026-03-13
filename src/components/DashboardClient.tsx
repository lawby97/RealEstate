"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ListingCard } from "./ListingCard";
import {
  BarChart3,
  Sparkles,
  ChevronRight,
  SlidersHorizontal,
  X,
  ShieldCheck,
  Wallet,
  TrendingUp,
} from "lucide-react";

type Listing = {
  id: string;
  address: string;
  city: string;
  province: string;
  price: number;
  propertyType: string;
  normalizedAssetLabel?: string;
  classificationReasons?: string[];
  sourceTypeConflict?: boolean;
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
  evaluation: {
    combinedScore: number;
    primaryScenarioId: string | null;
    primaryScenarioStatus: string | null;
    primaryBridgeUsage: string | null;
    primaryAnnualCashflow: number | null;
    primaryMonthlyCashflow: number | null;
    baseHoldScenarioId: string | null;
    baseHoldAnnualCashflow: number | null;
    baseHoldMonthlyCashflow: number | null;
    quickVerdict: string | null;
  } | null;
};

type Stats = {
  totalListings: number;
  positiveCarryViableDeals: number;
  bridgeFreeViableDeals: number;
  avgBestViableMonthlyCashflow: number;
  avgDealScore: number;
  totalPortfolioValue?: number;
};

type SortValue =
  | "deal_score_desc"
  | "best_case_cashflow_desc"
  | "base_hold_cashflow_desc"
  | "price_asc"
  | "price_desc"
  | "newest";

export function DashboardClient() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");
  const [city, setCity] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minUnits, setMinUnits] = useState("1");
  const [minScore, setMinScore] = useState("");
  const [sort, setSort] = useState<SortValue>("deal_score_desc");
  const [positiveCashflowOnly, setPositiveCashflowOnly] = useState(false);
  const [bridgeFreeOnly, setBridgeFreeOnly] = useState(false);
  const [viableOnly, setViableOnly] = useState(false);
  const [filterOptions, setFilterOptions] = useState<{ cities: string[]; propertyTypes: string[] }>({ cities: [], propertyTypes: [] });
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [loadKey, setLoadKey] = useState(0);
  const [listError, setListError] = useState<string | null>(null);

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
    fetch("/api/listings/filters")
      .then((r) => (r.ok ? r.json() : { cities: [], propertyTypes: [] }))
      .then((d) => setFilterOptions({ cities: d?.cities ?? [], propertyTypes: d?.propertyTypes ?? [] }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setListError(null);
    const params = new URLSearchParams();
    params.set("limit", "100");
    params.set("sort", sort);
    if (minPrice) params.set("minPrice", minPrice);
    if (maxPrice) params.set("maxPrice", maxPrice);
    if (minScore) params.set("minScore", minScore);
    if (minUnits) params.set("minUnits", minUnits);
    if (city) params.set("city", city);
    if (propertyType) params.set("propertyType", propertyType);
    if (positiveCashflowOnly) params.set("positiveCashflowOnly", "1");
    if (bridgeFreeOnly) params.set("bridgeFreeOnly", "1");
    if (viableOnly) params.set("viableOnly", "1");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/api/listings?${params}`
        : `/api/listings?${params}`;
    fetch(url, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) {
          setListError(`Server returned ${r.status}. Check the console.`);
          return { listings: [], total: 0 };
        }
        return r.json();
      })
      .then((d) => {
        setListings(Array.isArray(d?.listings) ? d.listings : []);
        setTotal(typeof d?.total === "number" ? d.total : 0);
      })
      .catch((err) => {
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
        setLoading(false);
      });
  }, [
    city,
    propertyType,
    minPrice,
    maxPrice,
    minScore,
    minUnits,
    sort,
    positiveCashflowOnly,
    bridgeFreeOnly,
    viableOnly,
    loadKey,
  ]);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  const clearFilters = () => {
    setCity("");
    setPropertyType("");
    setMinPrice("");
    setMaxPrice("");
    setMinUnits("1");
    setMinScore("");
    setSort("deal_score_desc");
    setPositiveCashflowOnly(false);
    setBridgeFreeOnly(false);
    setViableOnly(false);
  };

  const hasActiveFilters =
    !!city ||
    !!propertyType ||
    !!minPrice ||
    !!maxPrice ||
    minUnits !== "1" ||
    !!minScore ||
    sort !== "deal_score_desc" ||
    positiveCashflowOnly ||
    bridgeFreeOnly ||
    viableOnly;
  const activeCount = [
    city,
    propertyType,
    minPrice,
    maxPrice,
    minUnits !== "1" ? minUnits : "",
    minScore,
    sort !== "deal_score_desc" ? sort : "",
    positiveCashflowOnly ? "positiveCashflowOnly" : "",
    bridgeFreeOnly ? "bridgeFreeOnly" : "",
    viableOnly ? "viableOnly" : "",
  ].filter(Boolean).length;
  const isMultiFamilyType = /(apartment|multi|duplex|triplex|fourplex)/i.test(propertyType);

  return (
    <div style={{ padding: 24, backgroundColor: "#f8fafc", minHeight: "100%" }}>
      <header
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
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>Investment Dashboard</h1>
          <p style={{ color: "#64748b", margin: "4px 0 0 0", fontSize: 14 }}>
            Listings whose source pages still resolve, ranked by scenario-derived underwriting signal.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, backgroundColor: "#fff", border: "1px solid #dbeafe", color: "#1d4ed8", padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
              <ShieldCheck size={14} />
              Source-link verified
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, backgroundColor: "#fff", border: "1px solid #e2e8f0", color: "#475569", padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
              {total} listings in view
            </span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <Link
            href="/signin"
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
            Sign in
            <ChevronRight size={18} />
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#22c55e" }} />
            <span style={{ fontSize: 13, color: "#64748b" }}>Live Data Feed</span>
          </div>
          <span style={{ fontSize: 13, color: "#94a3b8" }}>Last updated: {lastUpdated}</span>
        </div>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 28,
        }}
      >
        <DashboardMetricCard
          title="Positive-carry viable deals"
          value={String(stats?.positiveCarryViableDeals ?? 0)}
          detail="Listings whose best viable path is cashflow-positive."
          icon={<Wallet size={20} color="#64748b" />}
        />
        <DashboardMetricCard
          title="Bridge-free viable deals"
          value={String(stats?.bridgeFreeViableDeals ?? 0)}
          detail="Viable paths that do not rely on bridge financing."
          icon={<ShieldCheck size={20} color="#64748b" />}
        />
        <DashboardMetricCard
          title="Avg best viable monthly cashflow"
          value={formatCurrency(stats?.avgBestViableMonthlyCashflow ?? 0)}
          detail="Average top-line monthly carry across viable paths."
          icon={<TrendingUp size={20} color="#64748b" />}
        />
        <DashboardMetricCard
          title="Avg deal score"
          value={stats?.avgDealScore != null ? stats.avgDealScore.toFixed(1) : "—"}
          detail="Scenario-based carry, execution, upside, and confidence score."
          icon={<Sparkles size={20} color="#64748b" />}
        />
      </div>

      <section>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Sparkles size={22} color="#1d4ed8" strokeWidth={2} />
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Underwriting queue</h2>
              <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "#64748b" }}>
                Start with the strongest scenario-derived opportunities, then open the ones that justify deeper work.
              </p>
            </div>
          </div>
          <span style={{ fontSize: 14, color: "#64748b" }}>{total} listings</span>
        </div>

        <div
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
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 20px",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 15,
              fontWeight: 600,
              color: "#0f172a",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <SlidersHorizontal size={20} color="#64748b" />
              Filters & sort
              {hasActiveFilters && (
                <span
                  style={{
                    backgroundColor: "#2563eb",
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 999,
                  }}
                >
                  {activeCount}
                </span>
              )}
            </span>
            <span style={{ color: "#64748b", transform: filtersOpen ? "rotate(180deg)" : "none", display: "inline-block" }}>▼</span>
          </button>

          {filtersOpen && (
            <div style={{ padding: "0 20px 20px", borderTop: "1px solid #f1f5f9" }}>
              <p style={{ margin: "14px 0 0 0", fontSize: 13, color: "#64748b" }}>
                Filter by what makes a deal actionable: viable paths, carry, bridge reliance, price, and score.
              </p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                  gap: 16,
                  paddingTop: 16,
                  alignItems: "end",
                }}
              >
                <InputSelect label="City" value={city} onChange={setCity} options={[{ value: "", label: "All cities" }, ...filterOptions.cities.map((c) => ({ value: c, label: c }))]} />
                <InputSelect
                  label="Property type"
                  value={propertyType}
                  onChange={(value) => {
                    setPropertyType(value);
                    if (!value.toLowerCase().includes("multi")) setMinUnits("1");
                  }}
                  options={[{ value: "", label: "All types" }, ...filterOptions.propertyTypes.map((p) => ({ value: p, label: p }))]}
                />
                <InputNumber label="Min price" value={minPrice} onChange={setMinPrice} placeholder="Any" />
                <InputNumber label="Max price" value={maxPrice} onChange={setMaxPrice} placeholder="Any" />
                {isMultiFamilyType && (
                  <InputSelect
                    label="Min units"
                    value={minUnits}
                    onChange={setMinUnits}
                    options={[
                      { value: "1", label: "1+" },
                      { value: "2", label: "2+" },
                      { value: "3", label: "3+" },
                      { value: "4", label: "4+" },
                      { value: "5", label: "5+" },
                    ]}
                  />
                )}
                <InputNumber label="Min deal score" value={minScore} onChange={setMinScore} placeholder="Any" min={0} max={100} />
                <InputSelect
                  label="Sort by"
                  value={sort}
                  onChange={(value) => setSort(value as SortValue)}
                  options={[
                    { value: "deal_score_desc", label: "Deal score: highest first" },
                    { value: "best_case_cashflow_desc", label: "Best viable cashflow" },
                    { value: "base_hold_cashflow_desc", label: "Base hold cashflow" },
                    { value: "price_asc", label: "Price: low to high" },
                    { value: "price_desc", label: "Price: high to low" },
                    { value: "newest", label: "Newest first" },
                  ]}
                />
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
                <FilterToggle label="Positive cashflow only" active={positiveCashflowOnly} onToggle={() => setPositiveCashflowOnly((v) => !v)} />
                <FilterToggle label="Bridge-free only" active={bridgeFreeOnly} onToggle={() => setBridgeFreeOnly((v) => !v)} />
                <FilterToggle label="Viable scenarios only" active={viableOnly} onToggle={() => setViableOnly((v) => !v)} />
              </div>

              {hasActiveFilters && (
                <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
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
                </div>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <p style={{ color: "#64748b" }}>Loading listings...</p>
        ) : listings.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "#64748b" }}>
            {listError ? (
              <p style={{ margin: "0 0 12px 0", color: "#b91c1c" }}>{listError}</p>
            ) : (
              <p style={{ margin: "0 0 12px 0" }}>No listings match your filters.</p>
            )}
            <button
              type="button"
              onClick={() => setLoadKey((k) => k + 1)}
              style={{
                padding: "10px 20px",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                backgroundColor: "#fff",
                fontSize: 14,
                cursor: "pointer",
                color: "#2563eb",
                fontWeight: 500,
              }}
            >
              Retry
            </button>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: 20,
            }}
          >
            {listings.map((l, i) => (
              <ListingCard key={l.id} listing={l} rank={i + 1} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function formatCurrency(value: number): string {
  return value.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  });
}

function DashboardMetricCard({
  title,
  value,
  detail,
  icon,
}: {
  title: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      style={{
        backgroundColor: "#fff",
        borderRadius: 12,
        padding: 20,
        border: "1px solid #e2e8f0",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>{title}</span>
        {icon}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: "#0f172a" }}>{value}</div>
      <div style={{ fontSize: 12, color: "#64748b", marginTop: 8 }}>{detail}</div>
    </div>
  );
}

function InputSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 6 }}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, backgroundColor: "#fff", fontSize: 14 }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function InputNumber({
  label,
  value,
  onChange,
  placeholder,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  min?: number;
  max?: number;
}) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 6 }}>{label}</label>
      <input
        type="number"
        placeholder={placeholder}
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14 }}
      />
    </div>
  );
}

function FilterToggle({ label, active, onToggle }: { label: string; active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        borderRadius: 999,
        border: active ? "1px solid #1d4ed8" : "1px solid #cbd5e1",
        backgroundColor: active ? "#eff6ff" : "#fff",
        color: active ? "#1d4ed8" : "#475569",
        padding: "8px 12px",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          backgroundColor: active ? "#2563eb" : "#cbd5e1",
        }}
      />
      {label}
    </button>
  );
}
