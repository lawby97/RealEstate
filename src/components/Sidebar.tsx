"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Home,
  BarChart3,
  Calculator,
  ChevronRight,
  History,
  Landmark,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

type Stats = {
  totalListings?: number;
  topDeals?: number;
  fivePlusListings?: number;
  highScoreCount?: number;
  highScore90?: number;
  avgRoi?: number;
  latestCapturedAt?: string | null;
};

type SidebarNavItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

type SidebarNavSection = {
  label: string;
  items: SidebarNavItem[];
};

type SidebarGuidance = {
  title: string;
  detail: string;
  actionLabel: string;
  actionHref: string;
};

const NAV_SECTIONS: SidebarNavSection[] = [
  {
    label: "SCREEN DEALS",
    items: [
      { href: "/", label: "Deal Queue", description: "Filter and rank active listings", icon: LayoutDashboard },
      { href: "/underwriting", label: "Underwriting", description: "Borrower capacity and lender lanes", icon: Landmark },
      { href: "/properties", label: "Pipeline", description: "Tracked opportunity summary", icon: Home },
    ],
  },
  {
    label: "RESEARCH SIGNALS",
    items: [
      { href: "/market", label: "Market", description: "Inventory and ROI signals", icon: BarChart3 },
      { href: "/sold", label: "Retired Listings", description: "Removed, sold, and stale records", icon: History },
      { href: "/montreal", label: "Montreal", description: "5-unit source workflow", icon: Home },
    ],
  },
  {
    label: "TOOLS",
    items: [
      { href: "/calculator", label: "Calculator", description: "Stress-test one scenario", icon: Calculator },
    ],
  },
];

const NAV_ITEMS: SidebarNavItem[] = NAV_SECTIONS.flatMap((section) => section.items);

export function Sidebar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [stats, setStats] = useState<Stats | null>(null);
  const statsLoaded = stats !== null;

  useEffect(() => {
    fetch("/api/stats").then((r) => r.json()).then(setStats).catch(() => {});
  }, []);

  const activeListings = stats?.totalListings ?? 0;
  const fivePlusListings = stats?.fivePlusListings ?? 0;
  const highScoreCount = stats?.highScoreCount ?? stats?.topDeals ?? 0;
  const avgRoi = stats?.avgRoi;
  const currentNavItem = getCurrentNavItem(pathname);
  const currentGuidance = getCurrentGuidance(pathname, {
    activeListings,
    avgRoi,
    latestCapturedAt: stats?.latestCapturedAt ?? null,
    statsLoaded,
  });
  const guideMetrics = [
    { label: "Active", value: formatCount(activeListings), detail: "Listings" },
    { label: "Avg CoC", value: formatPercent(avgRoi), detail: "Queue" },
    { label: "Captured", value: formatCapturedAt(stats?.latestCapturedAt), detail: "Freshness", wide: true },
  ];

  return (
    <aside
      className="dashboard-sidebar"
      style={{
        backgroundColor: "#f8fafc",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        className="sidebar-brand"
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
          <div className="sidebar-brand-subtitle" style={{ fontSize: 12, opacity: 0.9 }}>Investment Analytics</div>
        </div>
      </div>

      <div className="sidebar-content" style={{ padding: "16px 12px" }}>
        <Link
          className="sidebar-account-link"
          href={session ? "/profile" : "/signin"}
          aria-label={session ? "Open investor profile" : "Sign in to save investor profile"}
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
          {status === "loading" ? "..." : session ? "Profile" : "Sign in"}
          <ChevronRight size={18} />
        </Link>

        <div
          className="sidebar-current-page"
          aria-label="Current page"
          style={{
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            borderRadius: 10,
            border: "1px solid #bfdbfe",
            backgroundColor: "#eff6ff",
            padding: "10px 11px",
            marginBottom: 10,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ color: "#1d4ed8", fontSize: 10, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              You are viewing
            </div>
            <div style={{ marginTop: 2, color: "#0f172a", fontSize: 14, fontWeight: 850, lineHeight: 1.15 }}>
              {currentNavItem.label}
            </div>
            <div style={{ marginTop: 3, color: "#475569", fontSize: 12, lineHeight: 1.35 }}>
              {currentNavItem.description}
            </div>
            <div style={{ marginTop: 7, display: "grid", gap: 6 }}>
              <div style={{ color: "#1d4ed8", fontSize: 12, lineHeight: 1.35, fontWeight: 750 }}>
                Next: {currentGuidance.detail}
              </div>
              <Link
                href={currentGuidance.actionHref}
                className="sidebar-current-page-action"
                style={{
                  display: "inline-flex",
                  width: "fit-content",
                  alignItems: "center",
                  gap: 5,
                  borderRadius: 999,
                  border: "1px solid #bfdbfe",
                  backgroundColor: "#fff",
                  color: "#1d4ed8",
                  padding: "6px 8px",
                  fontSize: 11,
                  fontWeight: 900,
                  textDecoration: "none",
                }}
              >
                {currentGuidance.actionLabel}
                <ChevronRight size={13} />
              </Link>
            </div>
          </div>
          <ChevronRight size={18} color="#2563eb" />
        </div>

        <section
          className="sidebar-next-guide"
          aria-label="Current page guidance"
          style={{
            marginBottom: 16,
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            backgroundColor: "#fff",
            padding: 13,
            boxShadow: "0 8px 20px rgba(15,23,42,0.04)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ color: "#64748b", fontSize: 10, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Next best move
            </div>
            <span
              style={{
                borderRadius: 999,
                border: "1px solid #e2e8f0",
                backgroundColor: "#f8fafc",
                color: "#475569",
                padding: "4px 7px",
                fontSize: 10,
                fontWeight: 900,
                lineHeight: 1,
                whiteSpace: "nowrap",
              }}
            >
              {currentNavItem.label}
            </span>
          </div>
          <div style={{ marginTop: 5, color: "#0f172a", fontSize: 14, fontWeight: 850, lineHeight: 1.2 }}>
            {currentGuidance.title}
          </div>
          <p style={{ margin: "7px 0 0", color: "#475569", fontSize: 12, lineHeight: 1.45 }}>
            {currentGuidance.detail}
          </p>
          <div
            className="sidebar-guide-metrics"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 7,
              marginTop: 10,
            }}
          >
            {guideMetrics.map((metric) => (
              <SidebarGuideMetric
                key={metric.label}
                label={metric.label}
                value={metric.value}
                detail={metric.detail}
                wide={metric.wide}
              />
            ))}
          </div>
          <Link
            href={currentGuidance.actionHref}
            style={{
              marginTop: 10,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              borderRadius: 999,
              border: "1px solid #bfdbfe",
              backgroundColor: "#eff6ff",
              color: "#1d4ed8",
              padding: "7px 9px",
              fontSize: 12,
              fontWeight: 900,
              textDecoration: "none",
            }}
          >
            {currentGuidance.actionLabel}
            <ChevronRight size={14} />
          </Link>
        </section>

        <div className="sidebar-section-label" style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 8, letterSpacing: "0.08em" }}>
          WORKFLOW
        </div>
        <nav className="sidebar-nav" aria-label="Primary dashboard navigation" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} className="sidebar-nav-section" style={{ display: "grid", gap: 2 }}>
              <div
                className="sidebar-nav-group-label"
                style={{
                  margin: "12px 8px 4px",
                  color: "#94a3b8",
                  fontSize: 10,
                  fontWeight: 900,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                {section.label}
              </div>
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`sidebar-nav-link${active ? " sidebar-nav-link-active" : ""}`}
                    aria-current={active ? "page" : undefined}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 12px",
                      borderRadius: 8,
                      backgroundColor: active ? "#eff6ff" : "transparent",
                      color: active ? "#1d4ed8" : "#475569",
                      textDecoration: "none",
                      fontWeight: active ? 600 : 400,
                      fontSize: 14,
                    }}
                  >
                    <Icon size={20} strokeWidth={2} />
                    <span className="sidebar-nav-copy" style={{ display: "grid", gap: 2, minWidth: 0 }}>
                      <span>{item.label}</span>
                      <span
                        className="sidebar-nav-description"
                        style={{
                          color: active ? "#3b82f6" : "#94a3b8",
                          fontSize: 11,
                          fontWeight: 500,
                          lineHeight: 1.25,
                          whiteSpace: "normal",
                        }}
                      >
                        {item.description}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-market-intelligence" style={{ marginTop: 24, marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.05em" }}>
            DEAL COCKPIT
          </div>
          <div
            style={{
              marginTop: 8,
              padding: 14,
              backgroundColor: "#fff",
              borderRadius: 14,
              border: "1px solid #e2e8f0",
              boxShadow: "0 10px 24px rgba(15, 23, 42, 0.05)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Active inventory
                </div>
                <div style={{ fontSize: 26, lineHeight: 1.05, fontWeight: 800, color: "#0f172a", marginTop: 4 }}>
                  {formatCount(activeListings)}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: roiToneColor(avgRoi), fontSize: 13, fontWeight: 800 }}>
                <TrendingUp size={16} strokeWidth={2.4} />
                {formatPercent(avgRoi)}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <SidebarMetric label="5+ units" value={formatCount(fivePlusListings)} detail="Plex focus" />
              <SidebarMetric label="80+ score" value={formatCount(highScoreCount)} detail="Review first" />
            </div>

            <div
              style={{
                marginTop: 12,
                paddingTop: 10,
                borderTop: "1px solid #e2e8f0",
                fontSize: 12,
                lineHeight: 1.45,
                color: "#64748b",
              }}
            >
              Captured {formatCapturedAt(stats?.latestCapturedAt)}
            </div>
          </div>
        </div>

        <div
          className="sidebar-ai-panel"
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
            <span style={{ fontWeight: 600, fontSize: 14, color: "#1e40af" }}>Underwriting lens</span>
          </div>
          <div style={{ fontSize: 12, color: "#3b82f6" }}>CoC, cash required, source status</div>
        </div>
      </div>
    </aside>
  );
}

function getCurrentNavItem(pathname: string): SidebarNavItem {
  if (pathname.startsWith("/listings/")) {
    return {
      href: pathname,
      label: "Listing Detail",
      description: "Photos, returns, and underwriting path",
      icon: Home,
    };
  }

  return (
    NAV_ITEMS.find((item) => (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href))) ??
    NAV_ITEMS[0]
  );
}

function getCurrentGuidance(
  pathname: string,
  context: { activeListings: number; avgRoi: number | null | undefined; latestCapturedAt: string | null; statsLoaded: boolean }
): SidebarGuidance {
  if (pathname.startsWith("/listings/")) {
    return {
      title: "Verify returns, then stress assumptions",
      detail: "Start with first-glance cashflow and CoC, then open the investment path before trusting the deal.",
      actionLabel: "Open underwriting",
      actionHref: "#listing-underwriting",
    };
  }

  if (pathname.startsWith("/underwriting")) {
    return {
      title: "Set the lender box before ranking",
      detail: "Borrower income, down payment, and debt limits decide which listings are truly available.",
      actionLabel: "Back to deals",
      actionHref: "/",
    };
  }

  if (pathname.startsWith("/sold")) {
    return {
      title: "Turn removals into feedback",
      detail: "Call on high-ROI removals, clean missing ROI records, and feed lender exceptions back into underwriting.",
      actionLabel: "Open audit",
      actionHref: "/sold#sold-removal-audit",
    };
  }

  if (pathname.startsWith("/properties")) {
    return {
      title: "Use the pipeline as the short list",
      detail: "Open ready deals first, then resolve lender-review and missing-ROI flags before offer work.",
      actionLabel: "Edit underwriting",
      actionHref: "/underwriting",
    };
  }

  if (pathname.startsWith("/market")) {
    return {
      title: "Read supply before chasing cards",
      detail: "Check source mix, ROI gaps, and 5+ unit depth so the deal queue is not judged from stale context.",
      actionLabel: "Open queue",
      actionHref: "/",
    };
  }

  if (pathname.startsWith("/calculator")) {
    return {
      title: "Stress one deal before underwriting",
      detail: "Move rent, debt, and down payment levers until the cashflow and DSCR story is clear.",
      actionLabel: "Borrower box",
      actionHref: "/underwriting",
    };
  }

  if (pathname.startsWith("/montreal")) {
    return {
      title: "Validate the Montréal capture lane",
      detail: "Confirm exact 5-unit freshness before moving a plex into detailed underwriting.",
      actionLabel: "Open 5-unit queue",
      actionHref: "/?minUnits=5&maxUnits=5",
    };
  }

  const hasPositiveAverageRoi = context.avgRoi != null && Number.isFinite(context.avgRoi) && context.avgRoi > 0;
  if (!context.statsLoaded) {
    return {
      title: "Reading the active queue",
      detail: "Loading active listings, source freshness, and ROI signals before recommending the next move.",
      actionLabel: "Open filters",
      actionHref: "/#dashboard-filters",
    };
  }

  return {
    title: hasPositiveAverageRoi ? "Start with the ROI-ranked queue" : "Tighten filters before underwriting",
    detail:
      context.activeListings > 0
        ? "Sort active listings by CoC, apply the cash cap, then open only the cards with real cashflow signal."
        : "Capture or ingest active listings before the dashboard can rank investable opportunities.",
    actionLabel: "Edit underwriting",
    actionHref: "/underwriting",
  };
}

function SidebarGuideMetric({
  label,
  value,
  detail,
  wide,
}: {
  label: string;
  value: string;
  detail: string;
  wide?: boolean;
}) {
  return (
    <div
      style={{
        minWidth: 0,
        gridColumn: wide ? "1 / -1" : undefined,
        borderRadius: 9,
        border: "1px solid #e2e8f0",
        backgroundColor: "#f8fafc",
        padding: "8px 9px",
      }}
    >
      <div style={{ color: "#64748b", fontSize: 10, fontWeight: 900, letterSpacing: "0.06em", textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ marginTop: 3, color: "#0f172a", fontSize: 14, fontWeight: 900, lineHeight: 1.1, overflowWrap: "anywhere" }}>
        {value}
      </div>
      <div style={{ marginTop: 2, color: "#64748b", fontSize: 10, lineHeight: 1.25 }}>
        {detail}
      </div>
    </div>
  );
}

function SidebarMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div
      style={{
        padding: "10px 9px",
        borderRadius: 10,
        backgroundColor: "#f8fafc",
        border: "1px solid #e2e8f0",
      }}
    >
      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </div>
      <div style={{ fontSize: 17, lineHeight: 1.15, fontWeight: 800, color: "#0f172a", marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{detail}</div>
    </div>
  );
}

function formatCount(value: number) {
  if (!Number.isFinite(value)) return "0";
  return Math.round(value).toLocaleString("en-CA");
}

function formatPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "ROI n/a";
  return `${value.toFixed(1)}% CoC`;
}

function formatCapturedAt(value: string | null | undefined) {
  if (!value) return "not available yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "not available yet";
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function roiToneColor(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "#64748b";
  if (value > 0) return "#047857";
  if (value < 0) return "#b91c1c";
  return "#475569";
}
