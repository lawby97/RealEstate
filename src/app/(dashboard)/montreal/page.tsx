"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ListingCard } from "@/components/ListingCard";

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
  evaluation: { combinedScore: number; cashflowScore: number; equityGrowthScore: number } | null;
};

type PreviewListing = {
  externalId: string;
  address: string;
  city: string;
  province: string;
  price: number;
  propertyType: string;
  bedrooms: number | null;
  bathrooms: number | null;
  listingUrl: string | null;
};

export default function MontrealPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [previewListings, setPreviewListings] = useState<PreviewListing[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const base = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("market", "Montreal");
    params.set("limit", "100");
    fetch(`${base}/api/listings?${params}`)
      .then((r) => r.json())
      .then((d) => {
        const list = d.listings ?? [];
        const tot = d.total ?? 0;
        setListings(Array.isArray(list) ? list : []);
        setTotal(typeof tot === "number" ? tot : 0);
      })
      .catch(() => {
        setListings([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [base]);

  function loadRealtorPreview() {
    setPreviewError(null);
    setPreviewLoading(true);
    const params = new URLSearchParams();
    params.set("preview", "1");
    params.set("city", "Montreal");
    params.set("provinceCode", "QC");
    params.set("maxResults", "30");
    const url = `${base}/api/scrape/realtor-ca?${params.toString()}`;
    fetch(url, { method: "GET" })
      .then(async (r) => {
        const text = await r.text();
        try {
          return { ok: r.ok, data: JSON.parse(text) };
        } catch {
          return { ok: false, data: { error: r.status === 200 ? "Invalid response" : `HTTP ${r.status}` } };
        }
      })
      .then(({ ok, data: d }) => {
        if (!ok) {
          const msg = d?.error || "Preview failed";
          const hint = d?.hint ? ` ${d.hint}` : "";
          setPreviewError(msg + hint);
          return;
        }
        if (!d?.ok) {
          setPreviewError(d?.error || "Preview failed");
          return;
        }
        setPreviewListings(Array.isArray(d.listings) ? d.listings : []);
      })
      .catch((e) => {
        setPreviewError(e?.message || "Request failed");
      })
      .finally(() => {
        setPreviewLoading(false);
      });
  }

  return (
    <div style={{ padding: 24, backgroundColor: "#f8fafc", minHeight: "100%" }}>
      <header
        style={{
          backgroundColor: "#fff",
          borderBottom: "1px solid #e2e8f0",
          padding: "20px 24px",
          marginBottom: 24,
        }}
      >
        <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>
          Montreal market listings
        </h1>
        <p style={{ color: "#64748b", margin: "4px 0 0 0" }}>
          Saved listings in the Montreal market, including nearby municipalities returned by the live feed
        </p>
      </header>

      {/* Realtor.ca preview */}
      <section
        style={{
          backgroundColor: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          padding: 20,
          marginBottom: 24,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 12px 0" }}>
          Data preview from Realtor.ca
        </h2>
        <p style={{ color: "#64748b", fontSize: 14, marginBottom: 16 }}>
          Fetch a sample of Montreal listings from Realtor.ca (preview only, not saved to database).
        </p>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            loadRealtorPreview();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              loadRealtorPreview();
            }
          }}
          disabled={previewLoading}
          aria-busy={previewLoading}
          style={{
            padding: "10px 20px",
            backgroundColor: previewLoading ? "#93c5fd" : "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontWeight: 500,
            cursor: previewLoading ? "not-allowed" : "pointer",
          }}
        >
          {previewLoading ? "Loading…" : "Load Realtor.ca preview (Montreal, QC)"}
        </button>
        {previewError && (
          <p style={{ color: "#dc2626", marginTop: 12, fontSize: 14 }}>{previewError}</p>
        )}
        {previewListings.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <p style={{ color: "#64748b", marginBottom: 12 }}>
              {previewListings.length} listings (preview)
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: 16,
              }}
            >
              {previewListings.map((p) => (
                <div
                  key={p.externalId}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: 16,
                    backgroundColor: "#f8fafc",
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{p.address || "—"}</div>
                  <div style={{ fontSize: 14, color: "#64748b", marginBottom: 4 }}>
                    {p.city}, {p.province}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "#1e40af", marginBottom: 4 }}>
                    ${(p.price / 1000).toFixed(0)}K
                  </div>
                  <div style={{ fontSize: 13, color: "#475569" }}>
                    {p.propertyType}
                    {p.bedrooms != null && ` · ${p.bedrooms} bed`}
                    {p.bathrooms != null && ` · ${p.bathrooms} bath`}
                  </div>
                  {p.listingUrl && (
                    <a
                      href={p.listingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 13, color: "#2563eb", marginTop: 8, display: "inline-block" }}
                    >
                      View on Realtor.ca →
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Saved Montreal listings from DB */}
      <section>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 12px 0" }}>
          Montreal market listings in your database
        </h2>
        {loading ? (
          <p style={{ color: "#64748b" }}>Loading…</p>
        ) : (
          <>
            <p style={{ color: "#64748b", marginBottom: 16 }}>
              <strong>{total}</strong> listing{total !== 1 ? "s" : ""} found.
            </p>
            {listings.length === 0 ? (
              <div style={{ padding: 24, backgroundColor: "#f1f5f9", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <p style={{ color: "#475569", margin: 0 }}>
                  No Montreal listings in the database yet.
                </p>
                <p style={{ color: "#64748b", marginTop: 8, fontSize: 14 }}>
                  Run <code style={{ backgroundColor: "#e2e8f0", padding: "2px 6px", borderRadius: 4 }}>npm run ingest:realtor -- --file=your-realtor-export.json</code> with an Apify Realtor.ca export, or use the main Dashboard and filter by city.
                </p>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                  gap: 16,
                }}
              >
                {listings.map((l) => (
                  <ListingCard key={l.id} listing={l} />
                ))}
              </div>
            )}
          </>
        )}
      </section>

      <p style={{ marginTop: 24 }}>
        <Link href="/" style={{ color: "#2563eb", textDecoration: "none" }}>
          ← Back to Dashboard
        </Link>
      </p>
    </div>
  );
}
