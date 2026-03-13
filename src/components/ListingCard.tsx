"use client";

import Link from "next/link";
import { ArrowUpRight, Bath, BedDouble, Building2, Calendar, MapPin } from "lucide-react";
import { STRATEGY_META } from "@/lib/strategy-applicability";

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
    primaryMonthlyCashflow: number | null;
    baseHoldScenarioId: string | null;
    baseHoldMonthlyCashflow: number | null;
    quickVerdict: string | null;
  } | null;
};

const BRIDGE_BADGE: Record<string, { label: string; tone: { bg: string; fg: string } }> = {
  not_needed: { label: "Bridge-free", tone: { bg: "#ecfdf3", fg: "#166534" } },
  optional: { label: "Bridge optional", tone: { bg: "#eff6ff", fg: "#1d4ed8" } },
  common: { label: "Bridge likely", tone: { bg: "#fff7ed", fg: "#9a3412" } },
  core: { label: "Bridge required", tone: { bg: "#fef2f2", fg: "#b91c1c" } },
};

export function ListingCard({ listing, rank = 0 }: { listing: Listing; rank?: number }) {
  const score = listing.evaluation?.combinedScore ?? 0;
  const checkDate = listing.linkCheckedAt || listing.lastSeenAt || listing.createdAt;
  const checkStr = checkDate
    ? new Date(checkDate).toLocaleDateString("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" })
    : "—";
  const pricePerUnit = listing.units > 0 ? Math.round(listing.price / listing.units) : null;
  const sourceLabel = listing.source.toLowerCase().includes("centris")
    ? "Centris"
    : listing.source.toLowerCase().includes("realtor")
      ? "Realtor.ca"
      : "Source";
  const scoreTone =
    score >= 85
      ? { bg: "#dcfce7", fg: "#166534", label: "High conviction" }
      : score >= 70
        ? { bg: "#dbeafe", fg: "#1d4ed8", label: "Worth underwriting" }
        : { bg: "#f1f5f9", fg: "#475569", label: "Needs review" };
  const bestPath = listing.evaluation?.primaryScenarioId ? STRATEGY_META[listing.evaluation.primaryScenarioId as keyof typeof STRATEGY_META]?.name ?? "Scenario pending" : "No viable path yet";
  const baseHoldPath = listing.evaluation?.baseHoldScenarioId ? STRATEGY_META[listing.evaluation.baseHoldScenarioId as keyof typeof STRATEGY_META]?.name ?? "Base hold" : null;
  const bridgeBadge = listing.evaluation?.primaryBridgeUsage ? BRIDGE_BADGE[listing.evaluation.primaryBridgeUsage] : null;
  const bestCashflow = listing.evaluation?.primaryMonthlyCashflow;
  const baseHoldCashflow = listing.evaluation?.baseHoldMonthlyCashflow;
  const isPotential = listing.evaluation?.primaryScenarioStatus === "potentially_applicable";

  const assetLabel = listing.normalizedAssetLabel || listing.propertyType;
  const assetLabelDetail =
    listing.sourceTypeConflict && listing.classificationReasons?.length
      ? `Source type: ${listing.propertyType}. ${listing.classificationReasons.join(" ")}`
      : undefined;

  return (
    <div
      style={{
        backgroundColor: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 16,
        padding: 20,
        boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {rank > 0 ? <span style={{ fontSize: 13, color: "#64748b", fontWeight: 700 }}>Top #{rank}</span> : null}
          <span
            title={assetLabelDetail}
            style={{
              border: "1px solid #e2e8f0",
              color: "#475569",
              padding: "4px 10px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {assetLabel}
          </span>
        </div>
        <div
          style={{
            backgroundColor: scoreTone.bg,
            color: scoreTone.fg,
            padding: "6px 10px",
            borderRadius: 12,
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          Deal score {Math.round(score)}
        </div>
      </div>

      <div>
        <div style={{ fontWeight: 700, fontSize: 16, color: "#0f172a", lineHeight: 1.35 }}>{listing.address}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#64748b", marginTop: 6 }}>
          <MapPin size={14} />
          {listing.city}, {listing.province}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        <div style={{ borderRadius: 12, backgroundColor: "#f8fafc", padding: 12 }}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>Asking price</div>
          <div style={{ fontSize: 21, fontWeight: 700, color: "#0f172a", marginTop: 3 }}>
            ${listing.price.toLocaleString()}
          </div>
        </div>
        <div style={{ borderRadius: 12, backgroundColor: "#f8fafc", padding: 12 }}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>Price per unit</div>
          <div style={{ fontSize: 21, fontWeight: 700, color: "#0f172a", marginTop: 3 }}>
            {pricePerUnit ? `$${pricePerUnit.toLocaleString()}` : "—"}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, fontSize: 13, color: "#475569" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Building2 size={14} />
          <span>{listing.units} {listing.units === 1 ? "unit" : "units"}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Calendar size={14} />
          <span>Link checked {checkStr}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <BedDouble size={14} />
          <span>{listing.bedrooms != null ? `${listing.bedrooms} bed` : "Beds n/a"}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Bath size={14} />
          <span>{listing.bathrooms != null ? `${listing.bathrooms} bath` : "Baths n/a"}</span>
        </div>
      </div>

      <div
        style={{
          borderRadius: 12,
          backgroundColor: "#f8fafc",
          padding: "12px 14px",
          display: "grid",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>Best viable cashflow</div>
            <div style={{ fontSize: 22, color: bestCashflow != null && bestCashflow > 0 ? "#166534" : "#0f172a", fontWeight: 700, marginTop: 3 }}>
              {bestCashflow != null ? formatCurrency(bestCashflow) : "No viable path yet"}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {bridgeBadge ? (
              <span style={{ backgroundColor: bridgeBadge.tone.bg, color: bridgeBadge.tone.fg, padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
                {bridgeBadge.label}
              </span>
            ) : null}
            {isPotential ? (
              <span style={{ backgroundColor: "#fffbeb", color: "#92400e", padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
                Potential
              </span>
            ) : null}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>Best path</div>
            <div style={{ fontSize: 14, color: "#0f172a", fontWeight: 700, marginTop: 4 }}>{bestPath}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>Base hold cashflow</div>
            <div style={{ fontSize: 14, color: "#0f172a", fontWeight: 700, marginTop: 4 }}>
              {baseHoldCashflow != null ? formatCurrency(baseHoldCashflow) : baseHoldPath ? "—" : "Development / land carry only"}
            </div>
            {baseHoldPath ? <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>{baseHoldPath}</div> : null}
          </div>
        </div>
        <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>
          {listing.evaluation?.quickVerdict ?? scoreTone.label}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        <Link
          href={`/listings/${listing.id}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: "10px 14px",
            backgroundColor: "#2563eb",
            color: "white",
            borderRadius: 10,
            textDecoration: "none",
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          Underwrite deal
        </Link>
        {listing.listingUrl ? (
          <a
            href={listing.listingUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "10px 14px",
              backgroundColor: "#fff",
              color: "#0f172a",
              borderRadius: 10,
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 700,
              border: "1px solid #cbd5e1",
            }}
          >
            Open on {sourceLabel}
            <ArrowUpRight size={14} />
          </a>
        ) : (
          <button
            type="button"
            disabled
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "10px 14px",
              backgroundColor: "#e2e8f0",
              color: "#64748b",
              borderRadius: 10,
              border: "none",
              fontSize: 14,
              fontWeight: 700,
              cursor: "not-allowed",
            }}
          >
            Source unavailable
          </button>
        )}
      </div>
    </div>
  );
}

function formatCurrency(value: number): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(Math.round(value)).toLocaleString("en-CA")}/mo`;
}
