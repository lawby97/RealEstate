"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import {
  ArrowRight,
  AlertTriangle,
  CircleDollarSign,
  ExternalLink,
  MapPinned,
  RefreshCcw,
  ShieldCheck,
  Target,
} from "lucide-react";
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
  listingStatus?: string;
  soldAt?: string | null;
  unavailableSince?: string | null;
  lastSyncRunAt?: string | null;
  lastSeenAt?: string;
  createdAt?: string;
  isLinkActive?: boolean | null;
  linkCheckedAt?: string | null;
  linkStatusNote?: string | null;
  evaluation: { combinedScore: number; cashflowScore?: number; equityGrowthScore?: number } | null;
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

type MontrealInventoryFocus = "buy_box" | "positive_cashflow" | "five_plus" | "missing_roi" | "all";

const MONTREAL_BUY_BOX_MIN_PRICE = 600_000;
const MONTREAL_BUY_BOX_MAX_PRICE = 1_300_000;
const MONTREAL_BUY_BOX_UNITS = 5;
const TARGETED_CENTRIS_SYNC_SCOPE = "montreal_core_west_multiplex_500k_1300k";
const INITIAL_MONTREAL_INVENTORY_LIMIT = 24;

export default function MontrealPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadKey, setLoadKey] = useState(0);
  const [previewListings, setPreviewListings] = useState<PreviewListing[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [inventoryFocus, setInventoryFocus] = useState<MontrealInventoryFocus>("buy_box");
  const [showAllFocusedListings, setShowAllFocusedListings] = useState(false);

  const base = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    params.set("market", "Montreal");
    params.set("syncScope", TARGETED_CENTRIS_SYNC_SCOPE);
    params.set("limit", "500");
    setLoading(true);
    setLoadError(null);
    fetch(`/api/listings?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Server returned ${r.status}`);
        return r.json();
      })
      .then((d) => {
        const list = d.listings ?? [];
        const tot = d.total ?? 0;
        if (!cancelled) {
          setListings(Array.isArray(list) ? list : []);
          setTotal(typeof tot === "number" ? tot : 0);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setListings([]);
          setTotal(0);
          setLoadError(error instanceof Error ? error.message : "Could not load Montréal listings.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadKey]);

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

  const fivePlusCount = listings.filter((listing) => listing.units >= 5).length;
  const medianAsk = median(listings.map((listing) => listing.price).sort((a, b) => a - b));
  const avgRoiValues = listings
    .map((listing) => listing.roi?.cashOnCashReturn)
    .filter((value): value is number => value != null && Number.isFinite(value));
  const avgRoi = avgRoiValues.length ? avgRoiValues.reduce((sum, value) => sum + value, 0) / avgRoiValues.length : null;
  const buyBoxListings = listings.filter(
    (listing) =>
      listing.units === MONTREAL_BUY_BOX_UNITS &&
      listing.price >= MONTREAL_BUY_BOX_MIN_PRICE &&
      listing.price <= MONTREAL_BUY_BOX_MAX_PRICE
  );
  const buyBoxPositiveCashflow = buyBoxListings.filter((listing) => (listing.roi?.annualCashflow ?? 0) > 0).length;
  const buyBoxRoiValues = buyBoxListings
    .map((listing) => listing.roi?.cashOnCashReturn)
    .filter((value): value is number => value != null && Number.isFinite(value));
  const buyBoxAvgRoi = buyBoxRoiValues.length
    ? buyBoxRoiValues.reduce((sum, value) => sum + value, 0) / buyBoxRoiValues.length
    : null;
  const bestBuyBoxListing = selectBestListing(buyBoxListings);
  const bestBuyBoxMetrics = bestBuyBoxListing
    ? [
        { label: "Ask", value: formatCurrency(bestBuyBoxListing.price) },
        { label: "CoC", value: formatPercent(finiteValue(bestBuyBoxListing.roi?.cashOnCashReturn)) },
        { label: "Y1 CF", value: formatOptionalCurrency(bestBuyBoxListing.roi?.annualCashflow) },
        { label: "3Y CF", value: formatOptionalCurrency(threeYearCashflow(bestBuyBoxListing)) },
        { label: "ROI value", value: formatOptionalCurrency(yearOneRoiValue(bestBuyBoxListing)) },
        { label: "Cash in", value: formatOptionalCurrency(bestBuyBoxListing.roi?.equityRequired) },
      ]
    : [];
  const latestCapture = listings
    .map((listing) => listing.lastSyncRunAt ?? listing.lastSeenAt ?? listing.createdAt)
    .filter(Boolean)
    .map((value) => new Date(value as string).getTime())
    .filter(Number.isFinite)
    .sort((a, b) => b - a)[0];
  const latestCaptureLabel = latestCapture ? formatDateTime(new Date(latestCapture).toISOString()) : "Pending";
  const sourceRows = buildSourceRows(listings);
  const sourceCoverageLabel =
    sourceRows.length > 1
      ? `${sourceRows.length} sources`
      : sourceRows[0]?.label ?? "Pending";
  const activeSourceCount = listings.filter((listing) => listing.isLinkActive !== false).length;
  const inactiveSourceCount = listings.filter((listing) => listing.isLinkActive === false).length;
  const missingRoiCount = listings.filter(
    (listing) => listing.roi?.cashOnCashReturn == null || !Number.isFinite(listing.roi.cashOnCashReturn)
  ).length;
  const buyBoxMissingRoiCount = buyBoxListings.filter(
    (listing) => listing.roi?.cashOnCashReturn == null || !Number.isFinite(listing.roi.cashOnCashReturn)
  ).length;
  const inventoryFocusOptions = useMemo(
    () => buildMontrealInventoryFocusOptions(listings, buyBoxListings),
    [buyBoxListings, listings]
  );
  const activeInventoryFocus =
    inventoryFocusOptions.find((option) => option.key === inventoryFocus) ?? inventoryFocusOptions[0];
  const focusedListings = useMemo(
    () => selectMontrealInventoryListings(listings, inventoryFocus),
    [inventoryFocus, listings]
  );
  const visibleFocusedListings = showAllFocusedListings
    ? focusedListings
    : focusedListings.slice(0, INITIAL_MONTREAL_INVENTORY_LIMIT);
  const hiddenFocusedListingsCount = Math.max(0, focusedListings.length - visibleFocusedListings.length);
  const canToggleFocusedListings = focusedListings.length > INITIAL_MONTREAL_INVENTORY_LIMIT;
  const dataHealthItems = [
    {
      label: "Capture freshness",
      value: latestCapture ? latestCaptureLabel : "Pending",
      detail: latestCapture ? "Latest saved timestamp available on the page." : "Run the nightly capture before relying on this feed.",
      tone: latestCapture ? "green" : "amber",
    },
    {
      label: "Source-link health",
      value: loading ? "..." : `${activeSourceCount}/${listings.length || 0}`,
      detail: inactiveSourceCount > 0 ? `${inactiveSourceCount} saved records have failed or inactive source status.` : "No failed source links in this saved sample.",
      tone: inactiveSourceCount > 0 ? "amber" : "green",
    },
    {
      label: "ROI completeness",
      value: loading ? "..." : `${Math.max(0, listings.length - missingRoiCount)}/${listings.length || 0}`,
      detail: missingRoiCount > 0 ? `${missingRoiCount} listings need rent/debt assumptions before ranking.` : "Saved Montréal records have modeled ROI.",
      tone: missingRoiCount > 0 ? "amber" : "green",
    },
    {
      label: "Exact buy-box readiness",
      value: loading ? "..." : `${buyBoxListings.length.toLocaleString("en-CA")} matches`,
      detail:
        buyBoxListings.length === 0
          ? "No exact 5-unit / $600k-$1.3M saved matches right now."
          : buyBoxMissingRoiCount > 0
            ? `${buyBoxMissingRoiCount} exact matches still need ROI assumptions.`
            : "Exact buy-box matches are ready for ROI review.",
      tone: buyBoxListings.length > 0 && buyBoxMissingRoiCount === 0 ? "green" : "amber",
    },
  ] as const;
  const buyBoxDashboardHref = `/?${new URLSearchParams({
    city: "Montreal",
    propertyTypes: "Multi-Family",
    minUnits: String(MONTREAL_BUY_BOX_UNITS),
    maxUnits: String(MONTREAL_BUY_BOX_UNITS),
    minPrice: String(MONTREAL_BUY_BOX_MIN_PRICE),
    maxPrice: String(MONTREAL_BUY_BOX_MAX_PRICE),
    sort: "roi_desc",
  }).toString()}`;

  return (
    <div className="dashboard-page" style={styles.page}>
      <header className="dashboard-hero" style={styles.hero}>
        <div>
          <p style={styles.eyebrow}>MONTREAL MARKET</p>
          <h1 style={styles.title}>Island and nearby-market listing workspace</h1>
          <p style={styles.heroCopy}>
            This page keeps the Montreal feed separate from the broader dashboard so you can compare saved active listings, preview live REALTOR.ca data, and jump into filtered underwriting queues.
          </p>
          <div style={styles.heroActions}>
            <Link href="/?city=Montreal" style={styles.primaryLink}>
              Open dashboard
            </Link>
            <Link href="/market" style={styles.secondaryLink}>
              Market analysis
            </Link>
          </div>
        </div>
        <div style={styles.heroBadge}>
          <MapPinned size={22} />
          Latest capture {latestCaptureLabel}
        </div>
      </header>

      <section style={styles.workflowPanel}>
        <div style={styles.workflowHeader}>
          <div>
            <p style={styles.workflowEyebrow}>DATA WORKFLOW</p>
            <h2 style={styles.workflowTitle}>Know what is saved, previewed, and actionable</h2>
            <p style={styles.workflowCopy}>
              This separates the nightly database from temporary source previews so the Montréal page is easier to trust while screening the 5-unit buy box.
            </p>
          </div>
          <span style={styles.workflowBadge}>Captured {latestCaptureLabel}</span>
        </div>
        <div style={styles.workflowGrid}>
          <WorkflowCard
            label="Saved database"
            value={loading ? "..." : `${total.toLocaleString("en-CA")} active records`}
            detail={`${activeSourceCount.toLocaleString("en-CA")} still have an active or unfailed source status.`}
            href="/?city=Montreal"
            action="Open saved feed"
          />
          <WorkflowCard
            label="Exact buy box"
            value={loading ? "..." : `${buyBoxListings.length.toLocaleString("en-CA")} matches`}
            detail={`${formatCurrency(MONTREAL_BUY_BOX_MIN_PRICE)}-${formatCurrency(MONTREAL_BUY_BOX_MAX_PRICE)} · exact ${MONTREAL_BUY_BOX_UNITS} units · ${buyBoxPositiveCashflow} positive cashflow.`}
            href={buyBoxDashboardHref}
            action="Review buy box"
          />
          <WorkflowCard
            label="5+ lending queue"
            value={loading ? "..." : `${fivePlusCount.toLocaleString("en-CA")} candidates`}
            detail="Use this slice for RBC/Desjardins exception checks, CMHC paths, and commercial takeout review."
            href={`/?${new URLSearchParams({
              city: "Montreal",
              minUnits: "5",
              propertyTypes: "Multi-Family",
              sort: "roi_desc",
            }).toString()}`}
            action="Open 5+ queue"
          />
          <WorkflowCard
            label="Market signal"
            value={loading ? "..." : listings.length > 0 ? formatCurrency(medianAsk) : "n/a"}
            detail={`Median saved ask. Avg modeled CoC ${
              avgRoi != null ? `${avgRoi.toFixed(1)}%` : "n/a"
            } across records with known ROI.`}
            href="/market"
            action="Open market page"
          />
          <WorkflowCard
            label="Source coverage"
            value={sourceCoverageLabel}
            detail={sourceRows.length ? sourceRows.map((row) => `${row.label}: ${row.count}`).join(" · ") : "Source mix appears after listings load."}
            href="/market"
            action="See market mix"
          />
          <WorkflowCard
            label="Temporary preview"
            value={previewListings.length > 0 ? `${previewListings.length} previewed` : "Not saved"}
            detail="The REALTOR.ca preview below is a live comparison sample only; it does not replace nightly capture."
            href="#live-source-check"
            action="Preview source"
          />
        </div>
      </section>

      <section style={styles.healthPanel}>
        <div style={styles.healthHeader}>
          <div>
            <p style={styles.healthEyebrow}>DATA HEALTH</p>
            <h2 style={styles.healthTitle}>Can I trust this feed today?</h2>
            <p style={styles.healthCopy}>
              Use this before underwriting. It shows whether the Montréal data is fresh, source-backed, ROI-ranked, and ready for the exact 5-unit buy box.
            </p>
          </div>
          <Link href="/sold" style={styles.healthAction}>
            Review removed records
            <ArrowRight size={14} />
          </Link>
        </div>
        <div style={styles.healthGrid}>
          {dataHealthItems.map((item) => (
            <HealthCard key={item.label} {...item} />
          ))}
        </div>
        <div style={styles.healthFootnote}>
          <AlertTriangle size={17} />
          <span>
            REALTOR.ca preview results are temporary. Only saved database records appear in dashboard filters, sold cleanup, and underwriting queues.
          </span>
        </div>
      </section>

      <section className="dashboard-two-column" style={styles.buyBoxPanel}>
        <div style={{ minWidth: 0 }}>
          <p style={styles.buyBoxEyebrow}>INVESTOR BUY BOX</p>
          <h2 style={styles.buyBoxTitle}>Exact 5-unit Montréal plexes from $600k to $1.3M</h2>
          <p style={styles.buyBoxCopy}>
            This is the current acquisition lane you asked for. Counts below use saved active Montréal inventory and exact 5-unit matches; the dashboard link opens the closest 5+ multifamily filter for deeper review.
          </p>
          <div style={styles.buyBoxMetrics}>
            <BuyBoxMetric
              icon={<Target size={18} />}
              label="Exact matches"
              value={loading ? "..." : buyBoxListings.length.toLocaleString("en-CA")}
              detail={`${formatCurrency(MONTREAL_BUY_BOX_MIN_PRICE)}-${formatCurrency(MONTREAL_BUY_BOX_MAX_PRICE)} · ${MONTREAL_BUY_BOX_UNITS} units`}
              tone="blue"
            />
            <BuyBoxMetric
              icon={<ShieldCheck size={18} />}
              label="Positive cashflow"
              value={loading ? "..." : `${buyBoxPositiveCashflow}/${buyBoxListings.length}`}
              detail="Annual modeled cashflow above zero"
              tone={buyBoxPositiveCashflow > 0 ? "green" : "amber"}
            />
            <BuyBoxMetric
              icon={<CircleDollarSign size={18} />}
              label="Avg CoC"
              value={loading ? "..." : formatPercent(buyBoxAvgRoi)}
              detail="Known cash-on-cash ROI only"
              tone={buyBoxAvgRoi != null && buyBoxAvgRoi >= 0 ? "green" : "amber"}
            />
          </div>
        </div>
        <aside style={styles.buyBoxAside}>
          <p style={styles.buyBoxAsideLabel}>Best saved match</p>
          {bestBuyBoxListing ? (
            <>
              <Link href={`/listings/${bestBuyBoxListing.id}`} style={styles.buyBoxListingLink}>
                {bestBuyBoxListing.address}
              </Link>
              <div style={styles.buyBoxFacts}>
                {bestBuyBoxMetrics.map((metric) => (
                  <span key={metric.label} style={styles.buyBoxFactCard}>
                    <span style={styles.buyBoxFactLabel}>{metric.label}</span>
                    <strong style={styles.buyBoxFactValue}>{metric.value}</strong>
                  </span>
                ))}
              </div>
              <p style={styles.buyBoxFormula}>
                <span style={styles.buyBoxFormulaLabel}>ROI value</span>
                {roiValueFormula(bestBuyBoxListing)}
              </p>
            </>
          ) : (
            <p style={styles.buyBoxEmpty}>No saved active listing currently matches the exact 5-unit / $600k-$1.3M buy box.</p>
          )}
          <div style={styles.buyBoxActions}>
            <Link href={buyBoxDashboardHref} style={styles.buyBoxPrimaryAction}>
              Open buy-box dashboard
              <ArrowRight size={15} />
            </Link>
            <Link href="/underwriting" style={styles.buyBoxSecondaryAction}>
              Tune borrowing limits
            </Link>
          </div>
        </aside>
      </section>

      <details
        id="live-source-check"
        className="montreal-source-preview-disclosure"
        style={{ ...styles.panel, ...styles.sourcePreviewDisclosure, scrollMarginTop: 90 }}
      >
        <summary className="montreal-source-preview-summary" style={styles.sourcePreviewSummary}>
          <div style={{ minWidth: 0 }}>
            <p style={styles.eyebrow}>LIVE SOURCE CHECK</p>
            <h2 style={styles.panelTitle}>Preview REALTOR.ca Montreal data</h2>
            <p style={styles.panelCopy}>
              Fetches a temporary sample for comparison only. It does not save records or replace the nightly capture.
            </p>
          </div>
          <span style={styles.sourcePreviewBadge}>
            <RefreshCcw size={15} />
            Optional preview
          </span>
        </summary>
        <div className="montreal-source-preview-body" style={styles.sourcePreviewBody}>
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
              ...styles.primaryButton,
              backgroundColor: previewLoading ? "#93c5fd" : "#2563eb",
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
                className="dashboard-card-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                  gap: 16,
                }}
              >
                {previewListings.map((p) => (
                  <article
                    key={p.externalId}
                    style={styles.previewCard}
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
                        style={styles.previewLink}
                      >
                        View on Realtor.ca
                        <ExternalLink size={13} />
                      </a>
                    )}
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>
      </details>

      <section style={styles.listingsSection}>
        <div style={styles.panelHeader}>
          <div>
            <p style={styles.eyebrow}>SAVED INVENTORY</p>
            <h2 style={styles.panelTitle}>{activeInventoryFocus.label} in your Montréal database</h2>
            <p style={styles.panelCopy}>
              {activeInventoryFocus.description}. Cards use the same active-source and ROI model as the dashboard.
            </p>
          </div>
          <Link href="/" style={styles.secondaryLink}>Use full filters</Link>
        </div>
        {loading ? (
          <MontrealInventoryState
            mode="loading"
            buyBoxHref={buyBoxDashboardHref}
            onRetry={() => setLoadKey((key) => key + 1)}
          />
        ) : loadError ? (
          <MontrealInventoryState
            mode="error"
            message={loadError}
            buyBoxHref={buyBoxDashboardHref}
            onRetry={() => setLoadKey((key) => key + 1)}
          />
        ) : (
          <>
            <div style={styles.inventoryFocusPanel} data-testid="montreal-inventory-focus">
              <div style={styles.inventoryFocusHeader}>
                <div>
                  <p style={styles.inventoryFocusEyebrow}>Review focus</p>
                  <h3 style={styles.inventoryFocusTitle}>{activeInventoryFocus.label}</h3>
                  <p style={styles.inventoryFocusCopy}>{activeInventoryFocus.description}</p>
                </div>
                <span style={styles.inventoryFocusBadge}>
                  {visibleFocusedListings.length.toLocaleString("en-CA")} shown from {focusedListings.length.toLocaleString("en-CA")} focused
                </span>
              </div>
              <div style={styles.inventoryFocusGrid}>
                {inventoryFocusOptions.map((option) => {
                  const active = option.key === inventoryFocus;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        setInventoryFocus(option.key);
                        setShowAllFocusedListings(false);
                      }}
                      style={{
                        ...styles.inventoryFocusButton,
                        ...(active ? styles.inventoryFocusButtonActive : {}),
                      }}
                    >
                      <span style={styles.inventoryFocusButtonTop}>
                        <strong>{option.label}</strong>
                        <span style={{ ...styles.inventoryFocusCount, ...(active ? styles.inventoryFocusCountActive : {}) }}>
                          {option.count.toLocaleString("en-CA")}
                        </span>
                      </span>
                      <span style={styles.inventoryFocusButtonCopy}>{option.short}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <p style={{ color: "#64748b", marginBottom: 16 }}>
              <strong>{visibleFocusedListings.length}</strong> card{visibleFocusedListings.length !== 1 ? "s" : ""} shown from{" "}
              <strong>{focusedListings.length}</strong> focused Montréal record{focusedListings.length !== 1 ? "s" : ""} and{" "}
              <strong>{listings.length}</strong> loaded Montréal record{listings.length !== 1 ? "s" : ""}. Database total:{" "}
              <strong>{total}</strong>.
            </p>
            {listings.length === 0 ? (
              <MontrealInventoryState
                mode="empty"
                buyBoxHref={buyBoxDashboardHref}
                onRetry={() => setLoadKey((key) => key + 1)}
              />
            ) : focusedListings.length === 0 ? (
              <MontrealInventoryState
                mode="focus_empty"
                focusLabel={activeInventoryFocus.label}
                buyBoxHref={buyBoxDashboardHref}
                onRetry={() => setLoadKey((key) => key + 1)}
                onShowAll={() => {
                  setInventoryFocus("all");
                  setShowAllFocusedListings(false);
                }}
              />
            ) : (
              <>
                {canToggleFocusedListings && (
                  <div style={styles.inventoryLimitPanel}>
                    <div style={{ minWidth: 0 }}>
                      <p style={styles.inventoryLimitLabel}>Ranked preview</p>
                      <p style={styles.inventoryLimitCopy}>
                        {showAllFocusedListings
                          ? `Showing all ${focusedListings.length.toLocaleString("en-CA")} focused records. Collapse this list when you want the page to stay quick to scan.`
                          : `Showing the first ${INITIAL_MONTREAL_INVENTORY_LIMIT} ranked records so the Montréal page stays readable. Use the dashboard filters before opening every saved card.`}
                      </p>
                    </div>
                    <div style={styles.inventoryLimitActions}>
                      <button
                        type="button"
                        onClick={() => setShowAllFocusedListings((current) => !current)}
                        style={styles.inventoryLimitButton}
                      >
                        {showAllFocusedListings
                          ? `Show first ${INITIAL_MONTREAL_INVENTORY_LIMIT}`
                          : `Show all ${focusedListings.length.toLocaleString("en-CA")}`}
                      </button>
                      {!showAllFocusedListings && hiddenFocusedListingsCount > 0 && (
                        <span style={styles.inventoryLimitHint}>
                          {hiddenFocusedListingsCount.toLocaleString("en-CA")} hidden below this preview
                        </span>
                      )}
                    </div>
                  </div>
                )}
                <div
                  className="dashboard-card-grid"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                    gap: 16,
                  }}
                >
                  {visibleFocusedListings.map((l) => (
                    <ListingCard key={l.id} listing={l} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function BuyBoxMetric({
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
  tone: "blue" | "green" | "amber";
}) {
  const palette = {
    blue: { bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" },
    green: { bg: "#dcfce7", border: "#86efac", color: "#166534" },
    amber: { bg: "#fef3c7", border: "#fcd34d", color: "#92400e" },
  }[tone];

  return (
    <div style={styles.buyBoxMetric}>
      <span style={{ ...styles.buyBoxMetricIcon, backgroundColor: palette.bg, borderColor: palette.border, color: palette.color }}>
        {icon}
      </span>
      <div style={{ minWidth: 0 }}>
        <p style={styles.buyBoxMetricLabel}>{label}</p>
        <p style={styles.buyBoxMetricValue}>{value}</p>
        <p style={styles.buyBoxMetricDetail}>{detail}</p>
      </div>
    </div>
  );
}

function WorkflowCard({
  label,
  value,
  detail,
  href,
  action,
}: {
  label: string;
  value: string;
  detail: string;
  href: string;
  action: string;
}) {
  return (
    <Link href={href} style={styles.workflowCard}>
      <span style={styles.workflowCardLabel}>{label}</span>
      <strong style={styles.workflowCardValue}>{value}</strong>
      <span style={styles.workflowCardDetail}>{detail}</span>
      <span style={styles.workflowAction}>
        {action}
        <ArrowRight size={14} />
      </span>
    </Link>
  );
}

function HealthCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "green" | "amber";
}) {
  const palette = {
    green: { bg: "#ecfdf3", border: "#bbf7d0", color: "#166534" },
    amber: { bg: "#fffbeb", border: "#fde68a", color: "#b45309" },
  }[tone];

  return (
    <article style={{ ...styles.healthCard, backgroundColor: palette.bg, borderColor: palette.border }}>
      <span style={{ ...styles.healthStatus, color: palette.color, borderColor: palette.border }}>
        {tone === "green" ? "Good" : "Check"}
      </span>
      <p style={styles.healthCardLabel}>{label}</p>
      <strong style={{ ...styles.healthCardValue, color: palette.color }}>{value}</strong>
      <p style={styles.healthCardDetail}>{detail}</p>
    </article>
  );
}

type MontrealInventoryStateMode = "loading" | "error" | "empty" | "focus_empty";

function MontrealInventoryState({
  mode,
  message,
  focusLabel,
  buyBoxHref,
  onRetry,
  onShowAll,
}: {
  mode: MontrealInventoryStateMode;
  message?: string;
  focusLabel?: string;
  buyBoxHref: string;
  onRetry: () => void;
  onShowAll?: () => void;
}) {
  const copy: Record<MontrealInventoryStateMode, { eyebrow: string; title: string; detail: string; badge: string }> = {
    loading: {
      eyebrow: "Saved feed loading",
      title: "Reading Montréal inventory",
      detail: "Applying the Montréal market filter, source status, ROI payloads, and the exact 5-unit buy-box screen before showing saved cards.",
      badge: "Loading saved feed",
    },
    error: {
      eyebrow: "Saved feed unavailable",
      title: "Could not load Montréal inventory",
      detail: message ?? "The saved listing API did not respond. Retry the feed before treating this page as empty.",
      badge: "Needs retry",
    },
    empty: {
      eyebrow: "No saved Montréal records",
      title: "The Montréal database is empty",
      detail: "Run the nightly capture or ingest a source snapshot. Preview results are temporary; only saved records can appear in dashboard filters, sold cleanup, and underwriting queues.",
      badge: "No saved data",
    },
    focus_empty: {
      eyebrow: "Review focus empty",
      title: `${focusLabel ?? "This review focus"} has no saved matches`,
      detail: "The saved Montréal feed loaded, but this slice has no matching cards. Switch to all loaded records, retry the feed, or broaden the buy-box screen.",
      badge: "Change focus",
    },
  };
  const active = copy[mode];

  return (
    <div className="montreal-state-panel" data-testid={`montreal-state-${mode}`} style={styles.montrealStatePanel}>
      <div className="montreal-state-grid" style={styles.montrealStateGrid}>
        <div>
          <p style={styles.inventoryFocusEyebrow}>{active.eyebrow}</p>
          <h3 style={styles.montrealStateTitle}>{active.title}</h3>
          <p style={styles.montrealStateCopy}>{active.detail}</p>
          <div className="montreal-state-actions" style={styles.montrealStateActions}>
            {mode === "loading" ? (
              <span style={styles.montrealStateDisabledAction}>Loading saved feed...</span>
            ) : (
              <button type="button" onClick={onRetry} style={styles.montrealStatePrimaryAction}>
                Retry saved feed
              </button>
            )}
            {mode === "focus_empty" && onShowAll ? (
              <button type="button" onClick={onShowAll} style={styles.montrealStateSecondaryButton}>
                Show all loaded
              </button>
            ) : (
              <Link href={buyBoxHref} style={styles.montrealStateSecondaryAction}>
                Open buy-box dashboard
              </Link>
            )}
            <Link href="#live-source-check" style={styles.montrealStateSecondaryAction}>
              Preview source
            </Link>
          </div>
        </div>

        <aside style={styles.montrealStateAside}>
          <span style={styles.montrealStateBadge}>{active.badge}</span>
          <MontrealStateFact label="Saved scope" value="Montréal active records from the database" />
          <MontrealStateFact label="Exact buy box" value="$600k-$1.3M, exact 5 units" />
          <MontrealStateFact label="Trust rule" value="Use saved records for underwriting; preview is temporary" />
        </aside>
      </div>
    </div>
  );
}

function MontrealStateFact({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.montrealStateFact}>
      <span style={styles.montrealStateFactLabel}>{label}</span>
      <strong style={styles.montrealStateFactValue}>{value}</strong>
    </div>
  );
}

function buildMontrealInventoryFocusOptions(
  listings: Listing[],
  buyBoxListings: Listing[]
): Array<{
  key: MontrealInventoryFocus;
  label: string;
  count: number;
  short: string;
  description: string;
}> {
  const positiveCashflow = listings.filter((listing) => (listing.roi?.annualCashflow ?? Number.NEGATIVE_INFINITY) > 0);
  const fivePlus = listings.filter((listing) => listing.units >= 5);
  const missingRoi = listings.filter(
    (listing) => listing.roi?.cashOnCashReturn == null || !Number.isFinite(listing.roi.cashOnCashReturn)
  );

  return [
    {
      key: "buy_box",
      label: "Exact buy box",
      count: buyBoxListings.length,
      short: "Exact 5 units, $600k-$1.3M",
      description: "Exact 5-unit Montréal plexes between $600k and $1.3M, sorted by modeled return",
    },
    {
      key: "positive_cashflow",
      label: "Positive CF",
      count: positiveCashflow.length,
      short: "Annual cashflow above zero",
      description: "Loaded Montréal records with positive modeled annual cashflow",
    },
    {
      key: "five_plus",
      label: "5+ unit review",
      count: fivePlus.length,
      short: "Multifamily lending path first",
      description: "Loaded Montréal records at 5+ units that may need commercial, CMHC, or lender-exception review",
    },
    {
      key: "missing_roi",
      label: "Missing ROI",
      count: missingRoi.length,
      short: "Needs rent/debt assumptions",
      description: "Loaded Montréal records that need assumptions before ROI ranking can be trusted",
    },
    {
      key: "all",
      label: "All loaded",
      count: listings.length,
      short: "Full loaded Montréal sample",
      description: "All loaded Montréal records from the saved database sample",
    },
  ];
}

function selectMontrealInventoryListings(listings: Listing[], focus: MontrealInventoryFocus): Listing[] {
  const scoped =
    focus === "buy_box"
      ? listings.filter(
          (listing) =>
            listing.units === MONTREAL_BUY_BOX_UNITS &&
            listing.price >= MONTREAL_BUY_BOX_MIN_PRICE &&
            listing.price <= MONTREAL_BUY_BOX_MAX_PRICE
        )
      : focus === "positive_cashflow"
        ? listings.filter((listing) => (listing.roi?.annualCashflow ?? Number.NEGATIVE_INFINITY) > 0)
        : focus === "five_plus"
          ? listings.filter((listing) => listing.units >= 5)
          : focus === "missing_roi"
            ? listings.filter(
                (listing) => listing.roi?.cashOnCashReturn == null || !Number.isFinite(listing.roi.cashOnCashReturn)
              )
            : listings;

  if (focus === "missing_roi") return [...scoped].sort(sortByScoreThenNewest);
  return [...scoped].sort(sortByRoiThenCashflow);
}

function sortByRoiThenCashflow(a: Listing, b: Listing): number {
  const aRoi = finiteValue(a.roi?.cashOnCashReturn);
  const bRoi = finiteValue(b.roi?.cashOnCashReturn);
  if (aRoi != null && bRoi != null && aRoi !== bRoi) return bRoi - aRoi;
  if (aRoi != null !== (bRoi != null)) return aRoi != null ? -1 : 1;

  const aCashflow = finiteValue(a.roi?.annualCashflow) ?? Number.NEGATIVE_INFINITY;
  const bCashflow = finiteValue(b.roi?.annualCashflow) ?? Number.NEGATIVE_INFINITY;
  if (aCashflow !== bCashflow) return bCashflow - aCashflow;

  return (b.evaluation?.combinedScore ?? 0) - (a.evaluation?.combinedScore ?? 0);
}

function sortByScoreThenNewest(a: Listing, b: Listing): number {
  const scoreDelta = (b.evaluation?.combinedScore ?? 0) - (a.evaluation?.combinedScore ?? 0);
  if (scoreDelta !== 0) return scoreDelta;
  return dateValue(b.lastSeenAt ?? b.createdAt) - dateValue(a.lastSeenAt ?? a.createdAt);
}

function finiteValue(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) ? value : null;
}

function dateValue(value: string | null | undefined): number {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function buildSourceRows(listings: Listing[]): Array<{ label: string; count: number }> {
  return Object.entries(
    listings.reduce<Record<string, number>>((counts, listing) => {
      const label = sourceName(listing.source);
      counts[label] = (counts[label] ?? 0) + 1;
      return counts;
    }, {})
  )
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function sourceName(source: string): string {
  const normalized = source.toLowerCase();
  if (normalized.includes("centris")) return "Centris";
  if (normalized.includes("multi")) return "Multi-source";
  if (normalized.includes("realtor")) return "Realtor.ca";
  return "Source";
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 === 0 ? (values[middle - 1] + values[middle]) / 2 : values[middle];
}

function selectBestListing(listings: Listing[]): Listing | null {
  if (listings.length === 0) return null;
  return [...listings].sort((a, b) => {
    const aRoi = a.roi?.cashOnCashReturn;
    const bRoi = b.roi?.cashOnCashReturn;
    const aHasRoi = aRoi != null && Number.isFinite(aRoi);
    const bHasRoi = bRoi != null && Number.isFinite(bRoi);
    if (aHasRoi && bHasRoi && aRoi !== bRoi) return bRoi - aRoi;
    if (aHasRoi !== bHasRoi) return aHasRoi ? -1 : 1;

    const aCashflow = a.roi?.annualCashflow ?? Number.NEGATIVE_INFINITY;
    const bCashflow = b.roi?.annualCashflow ?? Number.NEGATIVE_INFINITY;
    if (aCashflow !== bCashflow) return bCashflow - aCashflow;

    return (b.evaluation?.combinedScore ?? 0) - (a.evaluation?.combinedScore ?? 0);
  })[0];
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
  return `${formatCurrency(cashflow)} CF + ${formatCurrency(paydown)} paydown + ${formatCurrency(appreciation)} appreciation = ${formatOptionalCurrency(total)}`;
}

function formatOptionalCurrency(value?: number | null): string {
  return value == null || !Number.isFinite(value) ? "n/a" : formatCurrency(value);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "n/a";
  return `${value.toFixed(1)}%`;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Pending";
  return date.toLocaleString("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const styles: Record<string, CSSProperties> = {
  page: {
    padding: 24,
    backgroundColor: "#f8fafc",
    minHeight: "100%",
  },
  hero: {
    display: "flex",
    justifyContent: "space-between",
    gap: 20,
    flexWrap: "wrap",
    background: "linear-gradient(135deg, #ffffff 0%, #eff6ff 100%)",
    border: "1px solid #dbeafe",
    borderRadius: 8,
    padding: 22,
    marginBottom: 20,
  },
  eyebrow: {
    margin: 0,
    fontSize: 11,
    color: "#2563eb",
    fontWeight: 900,
    letterSpacing: "0.1em",
  },
  title: {
    margin: "6px 0 0",
    color: "#0f172a",
    fontSize: 30,
    lineHeight: 1.15,
  },
  heroCopy: {
    margin: "8px 0 0",
    maxWidth: 820,
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.65,
  },
  heroActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 14,
  },
  primaryLink: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: "#2563eb",
    color: "#fff",
    padding: "10px 13px",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 800,
  },
  secondaryLink: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: "#fff",
    border: "1px solid #bfdbfe",
    color: "#1d4ed8",
    padding: "10px 13px",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 800,
    alignSelf: "flex-start",
  },
  heroBadge: {
    alignSelf: "flex-start",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    backgroundColor: "#fff",
    border: "1px solid #dbeafe",
    color: "#1e3a8a",
    padding: "11px 12px",
    fontSize: 13,
    fontWeight: 800,
  },
  workflowPanel: {
    marginBottom: 20,
    borderRadius: 14,
    border: "1px solid #bae6fd",
    background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 52%, #ecfeff 100%)",
    padding: 18,
    boxShadow: "0 16px 34px rgba(14,116,144,0.08)",
  },
  workflowHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 15,
  },
  workflowEyebrow: {
    margin: 0,
    color: "#0891b2",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.11em",
  },
  workflowTitle: {
    margin: "6px 0 0",
    color: "#0f172a",
    fontSize: 22,
    lineHeight: 1.2,
  },
  workflowCopy: {
    margin: "7px 0 0",
    color: "#475569",
    fontSize: 13,
    lineHeight: 1.6,
    maxWidth: 860,
  },
  workflowBadge: {
    borderRadius: 999,
    border: "1px solid #67e8f9",
    backgroundColor: "#ecfeff",
    color: "#0e7490",
    padding: "8px 11px",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  workflowGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: 12,
  },
  workflowCard: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
    minWidth: 0,
    minHeight: 142,
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    backgroundColor: "#fff",
    padding: 14,
    textDecoration: "none",
    color: "#0f172a",
    boxShadow: "0 1px 3px rgba(15,23,42,0.05)",
  },
  workflowCardLabel: {
    color: "#0f766e",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.07em",
    textTransform: "uppercase",
  },
  workflowCardValue: {
    color: "#0f172a",
    fontSize: 18,
    lineHeight: 1.25,
    overflowWrap: "anywhere",
  },
  workflowCardDetail: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.45,
  },
  workflowAction: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    marginTop: "auto",
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 900,
  },
  healthPanel: {
    borderRadius: 14,
    border: "1px solid #bfdbfe",
    background: "linear-gradient(135deg, #ffffff 0%, #eff6ff 100%)",
    padding: 18,
    marginBottom: 22,
    boxShadow: "0 14px 34px rgba(37, 99, 235, 0.08)",
  },
  healthHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 14,
  },
  healthEyebrow: {
    margin: 0,
    color: "#1d4ed8",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.12em",
  },
  healthTitle: {
    margin: "6px 0 0",
    color: "#0f172a",
    fontSize: 22,
    lineHeight: 1.2,
  },
  healthCopy: {
    margin: "7px 0 0",
    color: "#475569",
    fontSize: 13,
    lineHeight: 1.6,
    maxWidth: 820,
  },
  healthAction: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    border: "1px solid #bfdbfe",
    backgroundColor: "#fff",
    color: "#1d4ed8",
    padding: "9px 12px",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 850,
    whiteSpace: "nowrap",
  },
  healthGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: 10,
  },
  healthCard: {
    position: "relative",
    minWidth: 0,
    borderRadius: 12,
    border: "1px solid",
    padding: 14,
  },
  healthStatus: {
    display: "inline-flex",
    borderRadius: 999,
    border: "1px solid",
    backgroundColor: "#fff",
    padding: "4px 8px",
    fontSize: 11,
    fontWeight: 900,
  },
  healthCardLabel: {
    margin: "10px 0 0",
    color: "#64748b",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },
  healthCardValue: {
    display: "block",
    marginTop: 6,
    fontSize: 22,
    lineHeight: 1.1,
    fontWeight: 900,
    overflowWrap: "anywhere",
  },
  healthCardDetail: {
    margin: "7px 0 0",
    color: "#475569",
    fontSize: 12,
    lineHeight: 1.45,
  },
  healthFootnote: {
    display: "flex",
    gap: 8,
    alignItems: "flex-start",
    marginTop: 12,
    borderTop: "1px solid #dbeafe",
    paddingTop: 12,
    color: "#1e40af",
    fontSize: 12,
    lineHeight: 1.5,
  },
  buyBoxPanel: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.35fr) minmax(280px, 0.72fr)",
    gap: 14,
    alignItems: "stretch",
    background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 62%, #2563eb 100%)",
    border: "1px solid rgba(147,197,253,0.5)",
    borderRadius: 12,
    padding: 18,
    color: "#fff",
    marginBottom: 20,
    boxShadow: "0 18px 40px rgba(30,58,138,0.18)",
  },
  buyBoxEyebrow: {
    margin: 0,
    color: "#bfdbfe",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.12em",
  },
  buyBoxTitle: {
    margin: "7px 0 0",
    color: "#fff",
    fontSize: 24,
    lineHeight: 1.2,
  },
  buyBoxCopy: {
    margin: "8px 0 0",
    color: "#dbeafe",
    fontSize: 14,
    lineHeight: 1.65,
    maxWidth: 900,
  },
  buyBoxMetrics: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 10,
    marginTop: 16,
  },
  buyBoxMetric: {
    display: "flex",
    gap: 10,
    minWidth: 0,
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.1)",
    padding: 12,
  },
  buyBoxMetricIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    border: "1px solid",
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
  },
  buyBoxMetricLabel: {
    margin: 0,
    color: "#bfdbfe",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  buyBoxMetricValue: {
    margin: "6px 0 0",
    color: "#fff",
    fontSize: 22,
    fontWeight: 900,
    lineHeight: 1.08,
    overflowWrap: "anywhere",
  },
  buyBoxMetricDetail: {
    margin: "6px 0 0",
    color: "#dbeafe",
    fontSize: 12,
    lineHeight: 1.4,
  },
  buyBoxAside: {
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.16)",
    backgroundColor: "rgba(15,23,42,0.22)",
    padding: 15,
    display: "grid",
    alignContent: "space-between",
    gap: 14,
    minWidth: 0,
  },
  buyBoxAsideLabel: {
    margin: 0,
    color: "#bfdbfe",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  buyBoxListingLink: {
    marginTop: 7,
    display: "block",
    color: "#fff",
    fontSize: 18,
    fontWeight: 900,
    lineHeight: 1.25,
    textDecoration: "none",
  },
  buyBoxFacts: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 8,
    marginTop: 10,
  },
  buyBoxFactCard: {
    minWidth: 0,
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.1)",
    padding: "9px 10px",
  },
  buyBoxFactLabel: {
    display: "block",
    color: "#bfdbfe",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  buyBoxFactValue: {
    display: "block",
    marginTop: 4,
    color: "#fff",
    fontSize: 14,
    lineHeight: 1.18,
    overflowWrap: "anywhere",
  },
  buyBoxFormula: {
    display: "grid",
    gap: 5,
    margin: "10px 0 0",
    borderRadius: 8,
    border: "1px solid rgba(191,219,254,0.22)",
    backgroundColor: "rgba(15,23,42,0.24)",
    padding: "9px 10px",
    color: "#dbeafe",
    fontSize: 12,
    lineHeight: 1.45,
  },
  buyBoxFormulaLabel: {
    color: "#bfdbfe",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  buyBoxEmpty: {
    margin: "8px 0 0",
    color: "#dbeafe",
    fontSize: 13,
    lineHeight: 1.55,
  },
  buyBoxActions: {
    display: "grid",
    gap: 8,
  },
  buyBoxPrimaryAction: {
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
  },
  buyBoxSecondaryAction: {
    display: "inline-flex",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.24)",
    backgroundColor: "rgba(255,255,255,0.08)",
    color: "#eff6ff",
    padding: "9px 12px",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 850,
  },
  panel: {
    backgroundColor: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: 18,
    marginBottom: 20,
    boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
  },
  sourcePreviewDisclosure: {
    background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
  },
  sourcePreviewSummary: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    flexWrap: "wrap",
    cursor: "pointer",
    listStyle: "none",
  },
  sourcePreviewBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    border: "1px solid #bfdbfe",
    backgroundColor: "#eff6ff",
    color: "#1d4ed8",
    padding: "7px 10px",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  sourcePreviewBody: {
    marginTop: 14,
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 14,
  },
  panelTitle: {
    margin: "4px 0 0",
    color: "#0f172a",
    fontSize: 20,
  },
  panelCopy: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.55,
  },
  primaryButton: {
    padding: "10px 14px",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontWeight: 800,
    fontSize: 13,
  },
  previewCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: 16,
    backgroundColor: "#f8fafc",
  },
  previewLink: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 13,
    color: "#2563eb",
    marginTop: 8,
    fontWeight: 800,
    textDecoration: "none",
  },
  listingsSection: {
    backgroundColor: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: 18,
    boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
  },
  inventoryFocusPanel: {
    borderRadius: 14,
    border: "1px solid #bfdbfe",
    background: "linear-gradient(135deg, #eff6ff 0%, #ffffff 70%)",
    padding: 14,
    marginBottom: 16,
  },
  inventoryFocusHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 12,
  },
  inventoryFocusEyebrow: {
    margin: 0,
    color: "#1d4ed8",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  inventoryFocusTitle: {
    margin: "5px 0 0",
    color: "#0f172a",
    fontSize: 18,
    lineHeight: 1.2,
  },
  inventoryFocusCopy: {
    margin: "5px 0 0",
    color: "#475569",
    fontSize: 13,
    lineHeight: 1.5,
    maxWidth: 820,
  },
  inventoryFocusBadge: {
    borderRadius: 999,
    border: "1px solid #bfdbfe",
    backgroundColor: "#fff",
    color: "#1d4ed8",
    padding: "7px 10px",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  inventoryFocusGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: 10,
  },
  inventoryFocusButton: {
    borderRadius: 12,
    border: "1px solid #dbeafe",
    backgroundColor: "rgba(255,255,255,0.78)",
    padding: 12,
    cursor: "pointer",
    textAlign: "left",
    display: "grid",
    gap: 7,
    color: "#0f172a",
  },
  inventoryFocusButtonActive: {
    borderColor: "#2563eb",
    backgroundColor: "#fff",
    boxShadow: "0 10px 22px rgba(37,99,235,0.12)",
  },
  inventoryFocusButtonTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    lineHeight: 1.25,
  },
  inventoryFocusCount: {
    borderRadius: 999,
    backgroundColor: "#eff6ff",
    color: "#2563eb",
    padding: "4px 7px",
    fontSize: 11,
    fontWeight: 900,
    flexShrink: 0,
  },
  inventoryFocusCountActive: {
    backgroundColor: "#2563eb",
    color: "#fff",
  },
  inventoryFocusButtonCopy: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.35,
  },
  inventoryLimitPanel: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    backgroundColor: "#f8fafc",
    padding: 13,
    marginBottom: 16,
  },
  inventoryLimitLabel: {
    margin: 0,
    color: "#1d4ed8",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  },
  inventoryLimitCopy: {
    margin: "5px 0 0",
    color: "#475569",
    fontSize: 13,
    lineHeight: 1.45,
    maxWidth: 820,
  },
  inventoryLimitActions: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    flexWrap: "wrap",
  },
  inventoryLimitButton: {
    border: "1px solid #2563eb",
    borderRadius: 999,
    backgroundColor: "#2563eb",
    color: "#fff",
    padding: "9px 12px",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 900,
  },
  inventoryLimitHint: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 800,
  },
  montrealStatePanel: {
    borderRadius: 14,
    border: "1px solid #bae6fd",
    background: "linear-gradient(135deg, #ffffff 0%, #eff6ff 58%, #ecfeff 100%)",
    boxShadow: "0 14px 34px rgba(14,116,144,0.08)",
    padding: 18,
  },
  montrealStateGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.45fr) minmax(260px, 0.72fr)",
    gap: 16,
    alignItems: "stretch",
  },
  montrealStateTitle: {
    margin: "6px 0 0",
    color: "#0f172a",
    fontSize: 22,
    lineHeight: 1.2,
  },
  montrealStateCopy: {
    margin: "8px 0 0",
    color: "#475569",
    fontSize: 14,
    lineHeight: 1.65,
    maxWidth: 820,
  },
  montrealStateActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 16,
  },
  montrealStatePrimaryAction: {
    border: 0,
    borderRadius: 8,
    backgroundColor: "#2563eb",
    color: "#fff",
    padding: "10px 13px",
    fontSize: 13,
    fontWeight: 850,
    cursor: "pointer",
  },
  montrealStateSecondaryAction: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#fff",
    border: "1px solid #bfdbfe",
    color: "#1d4ed8",
    padding: "10px 13px",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 850,
  },
  montrealStateSecondaryButton: {
    borderRadius: 8,
    backgroundColor: "#fff",
    border: "1px solid #bfdbfe",
    color: "#1d4ed8",
    padding: "10px 13px",
    fontSize: 13,
    fontWeight: 850,
    cursor: "pointer",
  },
  montrealStateDisabledAction: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#dbeafe",
    color: "#1e40af",
    padding: "10px 13px",
    fontSize: 13,
    fontWeight: 850,
  },
  montrealStateAside: {
    borderRadius: 12,
    border: "1px solid #bfdbfe",
    backgroundColor: "rgba(255,255,255,0.76)",
    padding: 14,
    display: "grid",
    gap: 10,
  },
  montrealStateBadge: {
    justifySelf: "start",
    borderRadius: 999,
    backgroundColor: "#cffafe",
    color: "#0e7490",
    padding: "6px 9px",
    fontSize: 11,
    fontWeight: 900,
  },
  montrealStateFact: {
    borderTop: "1px solid #dbeafe",
    paddingTop: 10,
  },
  montrealStateFactLabel: {
    display: "block",
    color: "#64748b",
    fontSize: 11,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  montrealStateFactValue: {
    display: "block",
    marginTop: 4,
    color: "#0f172a",
    fontSize: 13,
    lineHeight: 1.4,
  },
  emptyState: {
    padding: 24,
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
  },
};
