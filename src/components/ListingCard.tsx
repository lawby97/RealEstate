"use client";

import Link from "next/link";
import { MapPin, Calendar } from "lucide-react";

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
  evaluation: { combinedScore: number } | null;
};

export function ListingCard({ listing, rank = 0 }: { listing: Listing; rank?: number }) {
  const score = listing.evaluation?.combinedScore ?? 0;
  const listedDate = listing.lastSeenAt || listing.createdAt;
  const listedStr = listedDate
    ? new Date(listedDate).toLocaleDateString("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/-/g, "-")
    : "—";
  const estRoi = score > 0 ? Math.round((score / 100) * 12 * 10) / 10 : 0;

  return (
    <div
      style={{
        backgroundColor: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: 20,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        {rank > 0 ? <span style={{ fontSize: 14, color: "#64748b", fontWeight: 500 }}>#{rank}</span> : <span />}
        <span
          style={{
            backgroundColor: "#dbeafe",
            color: "#1d4ed8",
            padding: "4px 12px",
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Score {Math.round(score)}
        </span>
      </div>
      <div style={{ fontWeight: 600, fontSize: 15, color: "#0f172a" }}>{listing.address}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#64748b" }}>
        <MapPin size={14} />
        {listing.city}, {listing.province}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>
        ${listing.price.toLocaleString()}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#64748b" }}>
        <Calendar size={14} />
        Listed {listedStr}
      </div>
      <div style={{ fontSize: 13, color: "#16a34a", fontWeight: 600 }}>
        Est. ROI {estRoi}%
      </div>
      <Link
        href={`/listings/${listing.id}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          marginTop: 4,
          padding: "8px 14px",
          backgroundColor: "#2563eb",
          color: "white",
          borderRadius: 8,
          textDecoration: "none",
          fontSize: 14,
          fontWeight: 500,
        }}
      >
        View Details
        <span style={{ marginLeft: 2 }}>→</span>
      </Link>
    </div>
  );
}
