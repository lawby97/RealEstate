"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Home,
  BarChart3,
  Calculator,
  ChevronRight,
  Sparkles,
} from "lucide-react";

type Stats = {
  totalListings?: number;
  positiveCarryViableDeals?: number;
  bridgeFreeViableDeals?: number;
  avgBestViableMonthlyCashflow?: number;
  avgDealScore?: number;
};

export function Sidebar() {
  const { data: session, status } = useSession();
  const [stats, setStats] = useState<Stats | null>(null);
  const base = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    fetch(`${base}/api/stats`).then((r) => r.json()).then(setStats).catch(() => {});
  }, [base]);

  return (
    <aside
      style={{
        width: 260,
        minWidth: 260,
        backgroundColor: "#f8fafc",
        borderRight: "1px solid #e2e8f0",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          background: "linear-gradient(180deg, #1e3a8a 0%, #1e40af 50%, #2563eb 100%)",
          color: "white",
          padding: "20px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            backgroundColor: "rgba(255,255,255,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 18,
          }}
        >
          P
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Investor Listings</div>
          <div style={{ fontSize: 12, opacity: 0.9 }}>Investment Analytics</div>
        </div>
      </div>

      <div style={{ padding: "16px 12px" }}>
        <Link
          href={session ? "/profile" : "/signin"}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "12px 16px",
            backgroundColor: "#16a34a",
            color: "white",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: 600,
            fontSize: 14,
            marginBottom: 24,
          }}
        >
          {status === "loading" ? "..." : session ? "Account" : "Sign in"}
          <ChevronRight size={18} />
        </Link>

        <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 8, letterSpacing: "0.05em" }}>
          ANALYTICS
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Link
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 8,
              backgroundColor: "#eff6ff",
              color: "#1d4ed8",
              textDecoration: "none",
              fontWeight: 500,
              fontSize: 14,
            }}
          >
            <LayoutDashboard size={20} strokeWidth={2} />
            Dashboard
          </Link>
          <Link
            href="/properties"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 8,
              color: "#475569",
              textDecoration: "none",
              fontSize: 14,
            }}
          >
            <Home size={20} strokeWidth={2} />
            My properties
          </Link>
          <Link
            href="/market"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 8,
              color: "#475569",
              textDecoration: "none",
              fontSize: 14,
            }}
          >
            <BarChart3 size={20} strokeWidth={2} />
            Market Analysis
          </Link>
          <Link
            href="/calculator"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 8,
              color: "#475569",
              textDecoration: "none",
              fontSize: 14,
            }}
          >
            <Calculator size={20} strokeWidth={2} />
            Investment Calculator
          </Link>
          <Link
            href="/montreal"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 8,
              color: "#475569",
              textDecoration: "none",
              fontSize: 14,
            }}
          >
            <Home size={20} strokeWidth={2} />
            Montreal listings
          </Link>
        </nav>

        <div style={{ marginTop: 24, marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", letterSpacing: "0.05em" }}>
            MARKET INTELLIGENCE
          </div>
          <div
            style={{
              marginTop: 8,
              padding: "12px 14px",
              backgroundColor: "#fff",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              fontSize: 13,
              color: "#475569",
            }}
          >
            <div style={{ marginBottom: 6 }}>Positive Carry {stats?.positiveCarryViableDeals ?? 0}</div>
            <div style={{ marginBottom: 6 }}>Bridge-free {stats?.bridgeFreeViableDeals ?? 0}</div>
            <div>Avg. Best CF {stats?.avgBestViableMonthlyCashflow != null ? `$${Math.round(stats.avgBestViableMonthlyCashflow).toLocaleString()}/mo` : "$0/mo"}</div>
          </div>
        </div>

        <div
          style={{
            marginTop: 16,
            padding: "14px",
            backgroundColor: "#eff6ff",
            borderRadius: 8,
            border: "1px solid #bfdbfe",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Sparkles size={18} color="#1d4ed8" strokeWidth={2} />
            <span style={{ fontWeight: 600, fontSize: 14, color: "#1e40af" }}>AI-Powered Analysis</span>
          </div>
          <div style={{ fontSize: 12, color: "#3b82f6" }}>Real-time deal scoring</div>
        </div>
      </div>
    </aside>
  );
}
