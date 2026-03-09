"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ListingCard } from "./ListingCard";
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Sparkles,
  MapPin,
  Calendar,
  ChevronRight,
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
  photoUrls: string | null;
  lastSeenAt?: string;
  createdAt?: string;
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

export function DashboardClient() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [city, setCity] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minUnits, setMinUnits] = useState("1");
  const [minScore, setMinScore] = useState("");

  const base = typeof window !== "undefined" ? window.location.origin : "";
  const lastUpdated = typeof window !== "undefined" ? new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }) : "";

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("limit", "100");
    if (minPrice) params.set("minPrice", minPrice);
    if (maxPrice) params.set("maxPrice", maxPrice);
    if (minScore) params.set("minScore", minScore);
    if (minUnits) params.set("minUnits", minUnits);
    if (city) params.set("city", city);
    fetch(`${base}/api/listings?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setListings(d.listings ?? []);
        setTotal(d.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, [base, city, minPrice, maxPrice, minScore, minUnits]);

  useEffect(() => {
    fetch(`${base}/api/stats`)
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, [base]);

  const clearFilters = () => {
    setCity("");
    setMinPrice("");
    setMaxPrice("");
    setMinUnits("1");
    setMinScore("");
  };

  const portfolioValue = stats?.totalPortfolioValue ?? 0;
  const portfolioStr = portfolioValue >= 1e6
    ? `$${(portfolioValue / 1e6).toFixed(1)}M`
    : portfolioValue >= 1e3
      ? `$${(portfolioValue / 1e3).toFixed(0)}K`
      : `$${portfolioValue}`;

  return (
    <div style={{ padding: 24, backgroundColor: "#f8fafc", minHeight: "100%" }}>
      <header
        style={{
          backgroundColor: "#fff",
          borderBottom: "1px solid #e2e8f0",
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
            AI-powered real estate deal analysis and market intelligence
          </p>
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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 28,
        }}
      >
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
            <span style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>Top Investment Deals</span>
            <BarChart3 size={20} color="#64748b" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#0f172a" }}>{stats?.topDeals ?? 0}</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Score 80+</div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8, fontSize: 12, color: "#16a34a", fontWeight: 500 }}>
            <TrendingUp size={14} /> +12% this week
          </div>
        </div>
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
            <span style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>Average ROI</span>
            <TrendingUp size={20} color="#64748b" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#0f172a" }}>{stats?.avgRoi != null ? `${stats.avgRoi}%` : "0%"}</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Annual return</div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8, fontSize: 12, color: "#16a34a", fontWeight: 500 }}>
            <TrendingUp size={14} /> +2.3% vs last month
          </div>
        </div>
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
            <span style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>Portfolio Value</span>
            <DollarSign size={20} color="#64748b" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#0f172a" }}>{portfolioStr}</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{total} properties</div>
        </div>
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
            <span style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>Avg Deal Score</span>
            <Sparkles size={20} color="#64748b" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#0f172a" }}>
            {(stats?.avgScore ?? 0).toFixed(1)}
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>AI confidence</div>
          <div style={{ fontSize: 12, marginTop: 8 }}>
            <span style={{ color: "#2563eb", fontWeight: 500 }}>Powered by AI</span>
          </div>
        </div>
      </div>

      <section>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Sparkles size={22} color="#1d4ed8" strokeWidth={2} />
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Top Investment Opportunities</h2>
          </div>
          <span style={{ fontSize: 14, color: "#64748b" }}>{total} listings</span>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            marginBottom: 20,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            style={{
              padding: "8px 12px",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              backgroundColor: "#fff",
              fontSize: 14,
              minWidth: 120,
            }}
          >
            <option value="">All</option>
            <option value="Toronto">Toronto</option>
            <option value="Montreal">Montreal</option>
            <option value="Vancouver">Vancouver</option>
          </select>
          <input
            type="number"
            placeholder="Min price"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            style={{
              padding: "8px 12px",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              width: 110,
              fontSize: 14,
            }}
          />
          <input
            type="number"
            placeholder="Max price"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            style={{
              padding: "8px 12px",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              width: 110,
              fontSize: 14,
            }}
          />
          <input
            type="number"
            placeholder="Min units"
            value={minUnits}
            onChange={(e) => setMinUnits(e.target.value)}
            style={{
              padding: "8px 12px",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              width: 90,
              fontSize: 14,
            }}
          />
          <input
            type="number"
            placeholder="Min score"
            value={minScore}
            onChange={(e) => setMinScore(e.target.value)}
            style={{
              padding: "8px 12px",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              width: 90,
              fontSize: 14,
            }}
          />
          <button
            type="button"
            onClick={clearFilters}
            style={{
              padding: "8px 16px",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              backgroundColor: "#fff",
              fontSize: 14,
              cursor: "pointer",
              color: "#475569",
            }}
          >
            Clear
          </button>
        </div>

        {loading ? (
          <p style={{ color: "#64748b" }}>Loading listings...</p>
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
