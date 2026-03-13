"use client";

import { useEffect, useState } from "react";
import { DollarSign, Sparkles, TrendingUp } from "lucide-react";

type Stats = {
  avgDealScore: number;
  avgBestViableMonthlyCashflow: number;
  totalPortfolioValue?: number;
  totalListings: number;
};

export default function PropertiesPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  const portfolioValue = stats?.totalPortfolioValue ?? 0;
  const portfolioStr =
    portfolioValue >= 1e6
      ? `$${(portfolioValue / 1e6).toFixed(1)}M`
      : portfolioValue >= 1e3
        ? `$${(portfolioValue / 1e3).toFixed(0)}K`
        : `$${portfolioValue.toLocaleString()}`;
  const avgCashflowDisplay = stats?.avgBestViableMonthlyCashflow != null ? `$${Math.round(stats.avgBestViableMonthlyCashflow).toLocaleString()}/mo` : "—";
  const avgScore = stats?.avgDealScore != null ? stats.avgDealScore.toFixed(1) : "—";

  return (
    <div style={{ padding: 24, backgroundColor: "#f8fafc", minHeight: "100%" }}>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>My properties</h1>
        <p style={{ color: "#64748b", marginTop: 8 }}>
          Portfolio-level rollup of the listings currently tracked in your workspace.
        </p>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 16,
        }}
      >
        <MetricCard
          title="Avg Best Cashflow"
          value={avgCashflowDisplay}
          icon={<TrendingUp size={20} color="#64748b" />}
          detail="Average best viable monthly cashflow across tracked listings."
        />
        <MetricCard
          title="Portfolio Value"
          value={portfolioStr}
          icon={<DollarSign size={20} color="#64748b" />}
          detail={`${stats?.totalListings ?? 0} properties in scope.`}
        />
        <MetricCard
          title="Avg Deal Score"
          value={avgScore}
          icon={<Sparkles size={20} color="#64748b" />}
          detail="Blended cashflow and equity-growth ranking."
        />
      </div>
    </div>
  );
}

function MetricCard({
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
