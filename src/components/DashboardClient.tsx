"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ListingCard } from "./ListingCard";
import {
  BarChart3,
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
  evaluation: { combinedScore: number; cashflowScore: number; equityGrowthScore: number } | null;
};

type Stats = {
  totalListings: number;
  topDeals: number;
  highScoreCount: number;
  highScore90: number;
  avgScore: number;
  avgRoi: number;
  totalPortfolioValue?: number;
};

type SortValue = "price_asc" | "price_desc" | "score_desc" | "score_asc" | "newest";

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
  const [sort, setSort] = useState<SortValue>("price_asc");
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
  }, [city, propertyType, minPrice, maxPrice, minScore, minUnits, sort, loadKey]);

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
    setSort("price_asc");
  };

  const hasActiveFilters =
    !!city || !!propertyType || !!minPrice || !!maxPrice || minUnits !== "1" || !!minScore || sort !== "price_asc";
  const activeCount = [city, propertyType, minPrice, maxPrice, minUnits !== "1" ? minUnits : "", minScore, sort !== "price_asc" ? sort : ""].filter(Boolean).length;
  const isMultiFamilyType = propertyType.toLowerCase().includes("multi");

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
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>
            Investment Dashboard
          </h1>
          <p style={{ color: "#64748b", margin: "4px 0 0 0", fontSize: 14 }}>
            Listings whose source pages still resolve, ranked for acquisition review and underwriting.
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
          <span style={{ fontSize: 13, color: "#94a3b8" }}>
            Last updated: {lastUpdated}
          </span>
        </div>
      </header>

      <div style={{ marginBottom: 28 }}>
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
            <span style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>High-score deals</span>
            <BarChart3 size={20} color="#64748b" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#0f172a" }}>{stats?.topDeals ?? 0}</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Listings scoring 80+ in the verified-active set</div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8, fontSize: 12, color: "#0f172a", fontWeight: 500 }}>
            <TrendingUp size={14} /> {stats?.highScore90 ?? 0} score 90+
          </div>
        </div>
      </div>

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
                Narrow the list before underwriting. Filters apply to listings whose source pages still resolve.
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
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 6 }}>Property type</label>
                  <select
                    value={propertyType}
                    onChange={(e) => {
                      const value = e.target.value;
                      setPropertyType(value);
                      if (!value.toLowerCase().includes("multi")) {
                        setMinUnits("1");
                      }
                    }}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      backgroundColor: "#fff",
                      fontSize: 14,
                    }}
                  >
                    <option value="">All types</option>
                    {filterOptions.propertyTypes.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
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
                    onChange={(e) => setSort(e.target.value as SortValue)}
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
                    <option value="score_desc">Score: highest first</option>
                    <option value="score_asc">Score: lowest first</option>
                    <option value="newest">Newest first</option>
                  </select>
                </div>
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
