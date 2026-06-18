"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { formatCompactCurrency } from "@/lib/display-format";
import {
  ArrowRight,
  ArchiveX,
  CalendarClock,
  CircleDollarSign,
  ExternalLink,
  ListChecks,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import { ListingCard } from "@/components/ListingCard";

type ReviewFocus = "all" | "follow_up" | "recent" | "lender_review" | "missing_roi" | "verified_inactive";

export type SoldListing = {
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
  linkStatusCode?: number | null;
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

type SoldActionPlanItem = {
  label: string;
  value: string;
  detail: string;
  actionLabel: string;
  focus: ReviewFocus;
  icon: ReactNode;
  tone: "green" | "amber" | "blue" | "slate";
};

type SoldLessonTone = "green" | "amber" | "blue" | "red" | "slate";

type SoldLessonItem = {
  label: string;
  value: string;
  detail: string;
  actionLabel: string;
  tone: SoldLessonTone;
  href?: string;
  focus?: ReviewFocus;
};

type RemovalEvidenceItem = {
  label: string;
  value: string;
  detail: string;
  tone: "green" | "amber" | "blue" | "slate";
};

export function SoldListingsClient({
  initialListings = [],
  initialTotal = initialListings.length,
}: {
  initialListings?: SoldListing[];
  initialTotal?: number;
}) {
  const hasInitialSnapshot = initialListings.length > 0 || initialTotal > 0;
  const [listings, setListings] = useState<SoldListing[]>(initialListings);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(!hasInitialSnapshot);
  const [error, setError] = useState<string | null>(null);
  const [reviewFocus, setReviewFocus] = useState<ReviewFocus>("all");
  const [loadKey, setLoadKey] = useState(0);

  useEffect(() => {
    if (loadKey === 0 && hasInitialSnapshot) return;

    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      status: "sold",
      includeInactive: "1",
      sort: "sold_newest",
      limit: "100",
    });

    fetch(`/api/listings?${params}`)
      .then((response) => {
        if (!response.ok) throw new Error(`Server returned ${response.status}`);
        return response.json();
      })
      .then((data) => {
        setListings(Array.isArray(data?.listings) ? data.listings : []);
        setTotal(typeof data?.total === "number" ? data.total : 0);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not load sold listings.");
        setListings([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [hasInitialSnapshot, loadKey]);

  const latestCapture = listings
    .map((listing) => listing.lastSyncRunAt)
    .filter(Boolean)
    .map((value) => new Date(value as string).getTime())
    .filter(Number.isFinite)
    .sort((a, b) => b - a)[0];
  const latestCaptureLabel = latestCapture
    ? new Date(latestCapture).toLocaleString("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  const latestRemoval = listings
    .map((listing) => listing.soldAt ?? listing.unavailableSince)
    .filter(Boolean)
    .map((value) => new Date(value as string).getTime())
    .filter(Number.isFinite)
    .sort((a, b) => b - a)[0];
  const latestRemovalLabel = latestRemoval ? formatDateTime(new Date(latestRemoval).toISOString()) : null;
  const retiredValue = listings.reduce((sum, listing) => sum + listing.price, 0);
  const verifiedInactiveCount = listings.filter((listing) => listing.isLinkActive === false).length;
  const positiveCashflowCount = listings.filter((listing) => (listing.roi?.annualCashflow ?? 0) > 0).length;
  const retiredRoiValues = listings
    .map((listing) => listing.roi?.cashOnCashReturn)
    .filter((value): value is number => value != null && Number.isFinite(value));
  const avgRetiredRoi =
    retiredRoiValues.length > 0
      ? retiredRoiValues.reduce((sum, value) => sum + value, 0) / retiredRoiValues.length
      : null;
  const missingRoiCount = listings.length - retiredRoiValues.length;
  const followUpNowCount = listings.filter(
    (listing) =>
      (listing.roi?.cashOnCashReturn ?? Number.NEGATIVE_INFINITY) >= 5 &&
      (listing.roi?.annualCashflow ?? Number.NEGATIVE_INFINITY) > 0
  ).length;
  const lenderReviewCount = listings.filter((listing) => listing.underwriting?.manualLenderReview).length;
  const recentRemovalAnchor = latestRemoval ?? Date.now();
  const recentRemovalCount = listings.filter((listing) => {
    const removedAt = new Date((listing.soldAt ?? listing.unavailableSince) || "").getTime();
    if (!Number.isFinite(removedAt)) return false;
    const daysFromAnchor = (recentRemovalAnchor - removedAt) / (1000 * 60 * 60 * 24);
    return daysFromAnchor >= 0 && daysFromAnchor <= 14;
  }).length;
  const sourceMix = listings.reduce<Record<string, number>>((counts, listing) => {
    const key = sourceName(listing.source);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
  const filteredListings = useMemo(
    () => listings.filter((listing) => matchesReviewFocus(listing, reviewFocus, recentRemovalAnchor)),
    [listings, recentRemovalAnchor, reviewFocus]
  );
  const activeFocus = reviewFocusOptions({
    listings,
    followUpNowCount,
    recentRemovalCount,
    lenderReviewCount,
    missingRoiCount,
    verifiedInactiveCount,
  }).find((option) => option.key === reviewFocus);
  const reviewOptions = reviewFocusOptions({
    listings,
    followUpNowCount,
    recentRemovalCount,
    lenderReviewCount,
    missingRoiCount,
    verifiedInactiveCount,
  });
  const missedOpportunities = [...filteredListings]
    .filter((listing) => listing.roi?.cashOnCashReturn != null)
    .sort((a, b) => {
      const roiDelta = (b.roi?.cashOnCashReturn ?? Number.NEGATIVE_INFINITY) - (a.roi?.cashOnCashReturn ?? Number.NEGATIVE_INFINITY);
      if (roiDelta !== 0) return roiDelta;
      return (b.roi?.annualCashflow ?? Number.NEGATIVE_INFINITY) - (a.roi?.annualCashflow ?? Number.NEGATIVE_INFINITY);
    })
    .slice(0, 3);
  const bestRetiredLead = [...listings]
    .filter((listing) => listing.roi?.cashOnCashReturn != null)
    .sort((a, b) => {
      const roiDelta = (b.roi?.cashOnCashReturn ?? Number.NEGATIVE_INFINITY) - (a.roi?.cashOnCashReturn ?? Number.NEGATIVE_INFINITY);
      if (roiDelta !== 0) return roiDelta;
      return (b.roi?.annualCashflow ?? Number.NEGATIVE_INFINITY) - (a.roi?.annualCashflow ?? Number.NEGATIVE_INFINITY);
    })[0] ?? null;
  const cleanupBottleneck =
    missingRoiCount > 0
      ? {
          value: `${missingRoiCount.toLocaleString("en-CA")} missing ROI`,
          detail: "Fill rent/debt assumptions before using these removals as comps.",
          actionLabel: "Show ROI cleanup",
          focus: "missing_roi" as const,
          tone: "red" as const,
        }
      : lenderReviewCount > 0
        ? {
            value: `${lenderReviewCount.toLocaleString("en-CA")} lender flags`,
            detail: "Use removed 5+ unit files to refine lender-path assumptions.",
            actionLabel: "Show lender flags",
            focus: "lender_review" as const,
            tone: "amber" as const,
          }
        : {
            value: "No cleanup backlog",
            detail: "Retired records in this sample have modeled ROI and no lender cleanup queue.",
            actionLabel: "Review all retired",
            focus: "all" as const,
            tone: "green" as const,
          };
  const firstGlanceItems: SoldLessonItem[] = [
    {
      label: "Best miss",
      value: bestRetiredLead?.roi?.cashOnCashReturn != null
        ? `${bestRetiredLead.roi.cashOnCashReturn.toFixed(1)}% CoC`
        : "No ROI lead",
      detail: bestRetiredLead
        ? `${bestRetiredLead.address} · ${formatCompactCurrency(bestRetiredLead.price)} ask · ${formatOptionalCurrency(threeYearCashflow(bestRetiredLead))} 3Y CF · ${formatOptionalCurrency(bestRetiredLead.roi?.totalYearOneReturn)} ROI value`
        : "No retired record has enough ROI data to identify a missed opportunity yet.",
      actionLabel: bestRetiredLead ? "Open retired deal" : "Show all retired",
      href: bestRetiredLead ? `/listings/${bestRetiredLead.id}` : undefined,
      focus: bestRetiredLead ? undefined : "all",
      tone: bestRetiredLead ? "green" : "slate",
    },
    {
      label: "Follow-up queue",
      value: `${followUpNowCount.toLocaleString("en-CA")} ready`,
      detail:
        followUpNowCount > 0
          ? "These removals had positive cashflow and 5%+ modeled CoC before they disappeared."
          : "No retired deal currently clears the follow-up cashflow and CoC screen.",
      actionLabel: "Show follow-up",
      focus: "follow_up",
      tone: followUpNowCount > 0 ? "green" : "slate",
    },
    {
      label: "Cleanup bottleneck",
      value: cleanupBottleneck.value,
      detail: cleanupBottleneck.detail,
      actionLabel: cleanupBottleneck.actionLabel,
      focus: cleanupBottleneck.focus,
      tone: cleanupBottleneck.tone,
    },
    {
      label: "Freshest comp",
      value: latestRemovalLabel ?? "No removal date",
      detail: latestCaptureLabel
        ? `Latest capture reference ${latestCaptureLabel}. Use recent removals for broker price discovery.`
        : "Capture history will appear after the next source cleanup creates a retired record.",
      actionLabel: "Show recent removals",
      focus: "recent",
      tone: latestRemovalLabel ? "blue" : "amber",
    },
  ];
  const summaryTiles = [
    {
      label: "Retired records",
      value: total.toLocaleString("en-CA"),
      detail: "No longer in active capture",
      icon: <ArchiveX size={18} />,
      tone: "orange" as const,
    },
    {
      label: "Checked inactive",
      value: verifiedInactiveCount.toLocaleString("en-CA"),
      detail: "Source links failed or disappeared",
      icon: <ShieldAlert size={18} />,
      tone: "red" as const,
    },
    {
      label: "Retired ask volume",
      value: formatCompactCurrency(retiredValue),
      detail: "Last known asking prices",
      icon: <CircleDollarSign size={18} />,
      tone: "slate" as const,
    },
    {
      label: "Modeled positive CF",
      value: positiveCashflowCount.toLocaleString("en-CA"),
      detail: avgRetiredRoi != null ? `Avg retired CoC ${avgRetiredRoi.toFixed(1)}%` : "Modeled ROI unavailable",
      icon: <ListChecks size={18} />,
      tone: "green" as const,
    },
    {
      label: "Latest removal",
      value: latestRemovalLabel ?? "—",
      detail: latestCaptureLabel ? `Capture reference ${latestCaptureLabel}` : "Awaiting capture history",
      icon: <CalendarClock size={18} />,
      tone: "blue" as const,
    },
  ];
  const actionPlanItems: SoldActionPlanItem[] = [
    {
      label: "Broker follow-up",
      value: followUpNowCount.toLocaleString("en-CA"),
      detail: "Retired deals with positive cashflow and 5%+ modeled CoC. Ask what they traded for and why they moved.",
      actionLabel: "Show follow-up queue",
      focus: "follow_up",
      icon: <TrendingUp size={18} />,
      tone: "green",
    },
    {
      label: "Assumption cleanup",
      value: missingRoiCount.toLocaleString("en-CA"),
      detail: "Records missing modeled ROI. Fill rent, expense, or debt assumptions before using them as comps.",
      actionLabel: "Show missing ROI",
      focus: "missing_roi",
      icon: <ListChecks size={18} />,
      tone: "slate",
    },
    {
      label: "Lender feedback",
      value: lenderReviewCount.toLocaleString("en-CA"),
      detail: "Removed files with manual lender-review flags. Use them to refine 5+ unit policy assumptions.",
      actionLabel: "Show lender-review files",
      focus: "lender_review",
      icon: <ShieldAlert size={18} />,
      tone: "amber",
    },
    {
      label: "Fresh source check",
      value: recentRemovalCount.toLocaleString("en-CA"),
      detail: "Recent disappearances are the best candidates for quick source confirmation and price discovery.",
      actionLabel: "Show recent removals",
      focus: "recent",
      icon: <CalendarClock size={18} />,
      tone: "blue",
    },
  ];
  const auditRows = filteredListings.slice(0, 8);
  const removalEvidenceItems: RemovalEvidenceItem[] = [
    {
      label: "Focus in view",
      value: `${filteredListings.length.toLocaleString("en-CA")} / ${listings.length.toLocaleString("en-CA")}`,
      detail: activeFocus?.description ?? "Showing all retired records preserved from cleanup.",
      tone: reviewFocus === "all" ? "slate" : "blue",
    },
    {
      label: "Removed means",
      value: latestRemovalLabel ?? "Pending",
      detail: "The record left active inventory because it was marked sold, unavailable, or no longer found.",
      tone: latestRemovalLabel ? "amber" : "slate",
    },
    {
      label: "Last source check",
      value: `${verifiedInactiveCount.toLocaleString("en-CA")} inactive`,
      detail: "Link checks show the source page failed, disappeared, or stopped behaving like an active listing.",
      tone: verifiedInactiveCount > 0 ? "green" : "slate",
    },
    {
      label: "Last capture",
      value: latestCaptureLabel ?? "Pending",
      detail: "Most recent source snapshot reference; use it to separate stale data from fresh removals.",
      tone: latestCaptureLabel ? "blue" : "amber",
    },
  ];

  return (
    <div className="dashboard-page sold-page" style={{ padding: 24, backgroundColor: "#f8fafc", minHeight: "100%" }}>
      <header
        className="dashboard-hero"
        style={{
          background: "linear-gradient(135deg, #fff7ed 0%, #ffffff 100%)",
          border: "1px solid #fed7aa",
          borderRadius: 8,
          padding: "22px 24px",
          marginBottom: 24,
        }}
      >
        <p style={{ margin: 0, fontSize: 12, fontWeight: 800, letterSpacing: "0.12em", color: "#9a3412" }}>
          SOLD / UNAVAILABLE INVENTORY
        </p>
        <h1 style={{ margin: "8px 0 0", fontSize: 26, color: "#0f172a" }}>
          Listings removed from nightly capture
        </h1>
        <p className="sold-hero-copy" style={{ margin: "8px 0 0", maxWidth: 820, color: "#64748b", lineHeight: 1.6 }}>
          These records were previously captured in the active 5-plex scope, then disappeared from a later nightly snapshot.
          They are preserved for pricing history, underwriting notes, and follow-up analysis.
        </p>
        <p className="sold-hero-capture" style={{ margin: "8px 0 0", color: "#64748b", fontSize: 13 }}>
          {latestCaptureLabel ? `Latest data captured before removal: ${latestCaptureLabel}` : "Capture timestamps will appear after the next sold record is created."}
        </p>
        <div className="sold-hero-source-row" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
          <span style={styles.headerPill}>{total} sold or unavailable records</span>
          {Object.entries(sourceMix).map(([source, count]) => (
            <span key={source} style={styles.headerPillMuted}>
              {source}: {count}
            </span>
          ))}
        </div>
      </header>

      {loading ? (
        <SoldPageState mode="loading" onRetry={() => setLoadKey((key) => key + 1)} />
      ) : error ? (
        <SoldPageState mode="error" message={error} onRetry={() => setLoadKey((key) => key + 1)} />
      ) : listings.length === 0 ? (
        <SoldPageState mode="empty" onRetry={() => setLoadKey((key) => key + 1)} />
      ) : (
        <>
          <SoldCommandPanel
            items={firstGlanceItems}
            actions={actionPlanItems}
            metrics={summaryTiles}
            activeFocus={reviewFocus}
            onSelectFocus={setReviewFocus}
          />

          <section className="sold-triage-panel" style={styles.triagePanel}>
            <div style={styles.triageHeader}>
              <div>
                <p style={styles.eyebrow}>RETIRED LISTING TRIAGE</p>
                <h2 style={styles.sectionTitle}>What to do with removals</h2>
                <p style={styles.sectionCopy}>
                  Treat this page as a feedback loop: learn which deals moved quickly, which need better assumptions, and which source records need cleanup.
                </p>
              </div>
              <Link href="/" style={styles.triageAction}>
                Return to active queue
                <ArrowRight size={14} />
              </Link>
            </div>

            <div style={styles.focusPanel}>
              <div>
                <p style={styles.focusEyebrow}>REVIEW FOCUS</p>
                <h3 style={styles.focusTitle}>{activeFocus?.title ?? "All retired records"}</h3>
                <p style={styles.focusCopy}>
                  {activeFocus?.description ?? "Show every sold or unavailable record."}
                </p>
              </div>
              <div style={styles.focusCount}>
                <strong>{filteredListings.length.toLocaleString("en-CA")}</strong>
                <span>of {listings.length.toLocaleString("en-CA")} shown</span>
              </div>
            </div>
            <div className="sold-focus-button-grid" style={styles.focusButtonGrid} aria-label="Retired listing review focus">
              {reviewOptions.map((option) => {
                const active = option.key === reviewFocus;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setReviewFocus(option.key)}
                    style={{
                      ...styles.focusButton,
                      ...(active ? styles.focusButtonActive : {}),
                    }}
                    aria-pressed={active}
                  >
                    <span style={styles.focusButtonTop}>
                      <strong>{option.label}</strong>
                      <span style={active ? styles.focusButtonCountActive : styles.focusButtonCount}>{option.count.toLocaleString("en-CA")}</span>
                    </span>
                    <span style={styles.focusButtonCopy}>{option.short}</span>
                  </button>
                );
              })}
            </div>

            <SoldFocusCommandBar
              focus={reviewFocus}
              title={activeFocus?.title ?? "All retired records"}
              description={activeFocus?.description ?? "Show every sold or unavailable record."}
              shownCount={filteredListings.length}
              totalCount={listings.length}
              onReset={() => setReviewFocus("all")}
            />

            <div style={styles.triageGrid}>
              <TriageLane
                icon={<TrendingUp size={18} />}
                title="Follow up now"
                value={followUpNowCount.toLocaleString("en-CA")}
                detail="Positive cashflow with 5%+ modeled CoC before removal. Compare final price or call the broker."
                tone="green"
              />
              <TriageLane
                icon={<ShieldAlert size={18} />}
                title="Lender path to verify"
                value={lenderReviewCount.toLocaleString("en-CA")}
                detail="Removed records that still had manual lender-review flags. Useful for refining 5+ unit underwriting rules."
                tone="amber"
              />
              <TriageLane
                icon={<CalendarClock size={18} />}
                title="Recent disappearances"
                value={recentRemovalCount.toLocaleString("en-CA")}
                detail="Removed within 14 days of the latest removal timestamp. These are freshest for broker follow-up."
                tone="blue"
              />
              <TriageLane
                icon={<ListChecks size={18} />}
                title="Missing ROI cleanup"
                value={missingRoiCount.toLocaleString("en-CA")}
                detail="Retired records without modeled CoC. Fill missing rent/debt assumptions before using them as comps."
                tone="slate"
              />
            </div>
          </section>

          {missedOpportunities.length > 0 && (
            <section id="sold-missed-opportunities" style={styles.missedPanel}>
              <div style={styles.missedHeader}>
                <div>
                  <p style={styles.eyebrow}>MISSED OPPORTUNITY REVIEW</p>
                  <h2 style={styles.sectionTitle}>Retired deals worth learning from</h2>
                  <p style={styles.sectionCopy}>
                    These unavailable records had the strongest modeled cash-on-cash returns before they left active inventory.
                    Use them to tighten the buy box, follow broker conversations, or compare future asking prices.
                  </p>
                </div>
                <TrendingUp size={24} color="#16a34a" />
              </div>

              <div style={styles.missedGrid}>
                {missedOpportunities.map((listing, index) => (
                  <article key={listing.id} style={styles.missedCard}>
                    <div style={styles.missedRank}>#{index + 1}</div>
                    <Link href={`/listings/${listing.id}`} style={styles.missedTitle}>
                      {listing.address}
                    </Link>
                    <div style={styles.missedMeta}>
                      {listing.city}, {listing.province} · {listing.units} units · {sourceName(listing.source)}
                    </div>
                    <div style={styles.missedMetricGrid}>
                      <MissedMetric
                        label="Y1 CF"
                        value={listing.roi ? formatCurrency(listing.roi.annualCashflow) : "n/a"}
                        tone={(listing.roi?.annualCashflow ?? 0) >= 0 ? "green" : "red"}
                      />
                      <MissedMetric
                        label="3Y CF"
                        value={formatOptionalCurrency(threeYearCashflow(listing))}
                        tone={(threeYearCashflow(listing) ?? 0) >= 0 ? "green" : "red"}
                      />
                      <MissedMetric
                        label="CoC"
                        value={listing.roi?.cashOnCashReturn != null ? `${listing.roi.cashOnCashReturn.toFixed(1)}%` : "n/a"}
                        tone={(listing.roi?.cashOnCashReturn ?? 0) >= 0 ? "green" : "red"}
                      />
                      <MissedMetric
                        label="ROI value"
                        value={formatOptionalCurrency(listing.roi?.totalYearOneReturn)}
                        tone={(listing.roi?.totalYearOneReturn ?? 0) >= 0 ? "green" : "red"}
                      />
                      <MissedMetric
                        label="Cash in"
                        value={listing.roi ? formatCurrency(listing.roi.equityRequired) : "n/a"}
                        tone="slate"
                      />
                    </div>
                    {listing.roi?.totalYearOneReturn != null && (
                      <details className="sold-roi-formula-disclosure" style={styles.missedFormulaDisclosure}>
                        <summary style={styles.missedFormulaSummary}>
                          <span style={styles.missedFormulaSummaryCopy}>
                            <span style={styles.missedFormulaSummaryLabel}>ROI bridge</span>
                            <strong style={styles.missedFormulaSummaryTitle}>Show calculation</strong>
                          </span>
                          <span style={styles.missedFormulaSummaryHint}>Cashflow + paydown + appreciation</span>
                        </summary>
                        <div style={styles.missedFormula}>
                          <span>ROI value</span>
                          <strong>{retiredRoiFormula(listing)}</strong>
                        </div>
                      </details>
                    )}
                    <div style={styles.missedFooter}>
                      <span>{formatDateTime(listing.soldAt ?? listing.unavailableSince)} removed</span>
                      <Link href={`/listings/${listing.id}`} style={styles.reviewAction}>
                        Review
                        <ArrowRight size={14} />
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          <RemovalEvidenceGuide items={removalEvidenceItems} />

          <section id="sold-removal-audit" style={styles.auditPanel}>
            <div style={styles.auditHeader}>
              <div>
                <p style={styles.eyebrow}>REMOVAL AUDIT</p>
                <h2 style={styles.sectionTitle}>
                  {reviewFocus === "all" ? "Most recent unavailable listings" : `${activeFocus?.label ?? "Filtered"} removal audit`}
                </h2>
                <p style={styles.sectionCopy}>
                  {reviewFocus === "all"
                    ? "Use this list to quickly confirm what left active inventory before opening the full underwriting record."
                    : `Showing ${filteredListings.length.toLocaleString("en-CA")} retired records that match this focus.`}
                </p>
              </div>
              <ListChecks size={22} color="#9a3412" />
            </div>
            {auditRows.length > 0 ? (
              <div style={styles.auditList}>
                {auditRows.map((listing) => (
                <article key={listing.id} className="sold-audit-row" style={styles.auditRow}>
                  <div style={{ minWidth: 0 }}>
                    <Link href={`/listings/${listing.id}`} style={styles.auditTitle}>
                      {listing.address}
                    </Link>
                    <div style={styles.auditMeta}>
                      {listing.city}, {listing.province} · {listing.units} units · {sourceName(listing.source)}
                    </div>
                    <div style={styles.auditReason}>
                      <RemovalBadge listing={listing} />
                      <span>{removalReason(listing)}</span>
                    </div>
                  </div>
                  <div style={styles.auditTimeline}>
                    <TimelineItem label="Removed" value={formatDateTime(listing.soldAt ?? listing.unavailableSince)} />
                    <TimelineItem label="Last source check" value={formatDateTime(listing.linkCheckedAt)} />
                    <TimelineItem label="Last capture" value={formatDateTime(listing.lastSyncRunAt ?? listing.lastSeenAt)} />
                  </div>
                  <div style={styles.auditValues}>
                    <strong>{formatCurrency(listing.price)}</strong>
                    <span>{listing.roi?.cashOnCashReturn != null ? `${listing.roi.cashOnCashReturn.toFixed(1)}% CoC` : "CoC n/a"}</span>
                    <span>{listing.roi ? `${formatCurrency(listing.roi.annualCashflow)} annual CF` : "Cashflow n/a"}</span>
                    <span>{formatOptionalCurrency(threeYearCashflow(listing))} 3Y CF</span>
                    <span>{formatOptionalCurrency(listing.roi?.totalYearOneReturn)} ROI value</span>
                  </div>
                  {listing.listingUrl ? (
                    <a href={listing.listingUrl} target="_blank" rel="noopener noreferrer" style={styles.sourceAction}>
                      Source
                      <ExternalLink size={14} />
                    </a>
                  ) : (
                    <span style={styles.noSource}>No source</span>
                  )}
                </article>
                ))}
              </div>
            ) : (
              <EmptyFocusState onReset={() => setReviewFocus("all")} />
            )}
          </section>

          <section id="sold-retired-inventory">
            <div style={styles.cardsHeader}>
              <div>
                <h2 style={styles.sectionTitle}>
                  {reviewFocus === "all" ? "Full retired inventory" : `${activeFocus?.label ?? "Filtered"} retired inventory`}
                </h2>
                <p style={styles.sectionCopy}>
                  Cards are preserved for pricing history, provenance, and deal review. Current focus shows {filteredListings.length.toLocaleString("en-CA")} of {listings.length.toLocaleString("en-CA")} records.
                </p>
              </div>
            </div>
            {filteredListings.length > 0 ? (
              <div
                className="dashboard-card-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                  gap: 20,
                }}
              >
                {filteredListings.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            ) : (
              <EmptyFocusState onReset={() => setReviewFocus("all")} />
            )}
          </section>
        </>
      )}
    </div>
  );
}

function RemovalEvidenceGuide({ items }: { items: RemovalEvidenceItem[] }) {
  return (
    <section className="sold-removal-evidence-guide" style={styles.removalGuide} aria-label="Removal evidence guide">
      <div style={styles.removalGuideHeader}>
        <div style={{ minWidth: 0 }}>
          <p style={styles.eyebrow}>REMOVAL EVIDENCE GUIDE</p>
          <h2 style={styles.sectionTitle}>How to read the audit before opening a card</h2>
          <p style={styles.sectionCopy}>
            These timestamps are evidence, not a sale price. Use them to decide whether a removed listing is a broker follow-up,
            a lender-policy lesson, or just stale source cleanup.
          </p>
        </div>
        <span style={styles.removalGuideBadge}>Timestamp legend</span>
      </div>

      <div className="sold-removal-evidence-grid" style={styles.removalGuideGrid}>
        {items.map((item) => {
          const palette = removalEvidencePalette(item.tone);
          return (
            <div
              key={item.label}
              className="sold-removal-evidence-card"
              style={{
                ...styles.removalGuideCard,
                borderColor: palette.border,
                backgroundColor: palette.bg,
              }}
            >
              <span style={{ ...styles.removalGuideLabel, color: palette.label }}>{item.label}</span>
              <strong style={styles.removalGuideValue}>{item.value}</strong>
              <span style={styles.removalGuideDetail}>{item.detail}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function removalEvidencePalette(tone: RemovalEvidenceItem["tone"]) {
  return {
    green: { bg: "#ecfdf3", border: "#bbf7d0", label: "#166534" },
    amber: { bg: "#fffbeb", border: "#fde68a", label: "#b45309" },
    blue: { bg: "#eff6ff", border: "#bfdbfe", label: "#1d4ed8" },
    slate: { bg: "#f8fafc", border: "#e2e8f0", label: "#475569" },
  }[tone];
}

function EmptyFocusState({ onReset }: { onReset: () => void }) {
  return (
    <div style={styles.emptyFocus}>
      <strong>No retired listings match this focus yet.</strong>
      <span>Try all retired records, or wait for the next nightly cleanup snapshot.</span>
      <button type="button" onClick={onReset} style={styles.emptyFocusButton}>
        Show all retired records
      </button>
    </div>
  );
}

function SoldPageState({
  mode,
  message,
  onRetry,
}: {
  mode: "loading" | "error" | "empty";
  message?: string;
  onRetry: () => void;
}) {
  const copy = {
    loading: {
      eyebrow: "Cleanup history",
      title: "Loading retired listing records",
      detail:
        "Checking the sold/unavailable queue created by nightly capture cleanup before showing pricing history and follow-up signals.",
      badge: "Sync check",
      tone: "orange" as const,
    },
    error: {
      eyebrow: "Cleanup history",
      title: "Could not load retired listings",
      detail: message ?? "The sold listing request failed. Retry the feed or return to the active dashboard while this queue is unavailable.",
      badge: "Needs attention",
      tone: "red" as const,
    },
    empty: {
      eyebrow: "Cleanup history",
      title: "No retired listings have been captured yet",
      detail:
        "This page fills after nightly capture marks a previously seen source record as sold, unavailable, or no longer found. Until then, use the active queue and Montreal workflow for live screening.",
      badge: "No removals yet",
      tone: "blue" as const,
    },
  }[mode];
  const primary =
    mode === "empty" ? (
      <Link href="/" style={styles.soldStatePrimaryAction}>
        Open active queue
        <ArrowRight size={14} />
      </Link>
    ) : mode === "loading" ? (
      <span style={styles.soldStatePrimaryAction}>Loading retired queue</span>
    ) : (
      <button type="button" onClick={onRetry} style={{ ...styles.soldStatePrimaryAction, cursor: "pointer" }}>
        Retry sold feed
        <ArrowRight size={14} />
      </button>
    );

  return (
    <section className="sold-state-panel" data-testid={`sold-state-${mode}`} style={styles.soldStatePanel}>
      <div className="sold-state-grid" style={styles.soldStateGrid}>
        <div style={{ minWidth: 0 }}>
          <p style={{ ...styles.eyebrow, color: copy.tone === "red" ? "#b91c1c" : "#9a3412" }}>{copy.eyebrow}</p>
          <h2 style={styles.soldStateTitle}>{copy.title}</h2>
          <p style={{ ...styles.soldStateCopy, color: copy.tone === "red" ? "#991b1b" : "#475569" }}>{copy.detail}</p>
          <div className="sold-state-actions" style={styles.soldStateActions}>
            {primary}
            {mode !== "error" && (
              <button type="button" onClick={onRetry} style={styles.soldStateSecondaryAction}>
                Refresh cleanup
              </button>
            )}
            <Link href="/montreal" style={styles.soldStateSecondaryAction}>
              Montreal workflow
            </Link>
            <Link href="/underwriting" style={styles.soldStateSecondaryAction}>
              Underwriting box
            </Link>
          </div>
        </div>

        <aside style={styles.soldStateAside}>
          <span style={styles.soldStateBadge}>{copy.badge}</span>
          <SoldStateFact label="What appears here" value="Listings removed from active capture" />
          <SoldStateFact label="Why it matters" value="Preserves pricing history, source status, and follow-up cues" />
          <SoldStateFact label="Next source run" value="Nightly cleanup will add future removals" />
        </aside>
      </div>
    </section>
  );
}

function SoldStateFact({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.soldStateFact}>
      <p style={styles.soldStateFactLabel}>{label}</p>
      <p style={styles.soldStateFactValue}>{value}</p>
    </div>
  );
}

function SoldActionPlan({
  items,
  activeFocus,
  onSelectFocus,
}: {
  items: SoldActionPlanItem[];
  activeFocus: ReviewFocus;
  onSelectFocus: (focus: ReviewFocus) => void;
}) {
  return (
    <section className="sold-action-plan" style={styles.actionPlan}>
      <div style={styles.actionPlanHeader}>
        <div style={{ minWidth: 0 }}>
          <p style={styles.eyebrow}>FOLLOW-UP PLAYBOOK</p>
          <h2 style={styles.sectionTitle}>Turn retired inventory into broker actions</h2>
          <p style={styles.sectionCopy}>
            Use this as the work queue after a listing leaves active capture: call on the best missed deals, clean weak assumptions, and feed lender exceptions back into underwriting.
          </p>
        </div>
        <Link href="/underwriting" style={styles.actionPlanLink}>
          Update underwriting box
          <ArrowRight size={14} />
        </Link>
      </div>

      <div className="sold-action-plan-grid" style={styles.actionPlanGrid}>
        {items.map((item) => (
          <SoldActionPlanCard
            key={item.label}
            item={item}
            active={item.focus === activeFocus}
            onClick={() => onSelectFocus(item.focus)}
          />
        ))}
      </div>
    </section>
  );
}

function SoldActionPlanCard({
  item,
  active,
  onClick,
}: {
  item: SoldActionPlanItem;
  active: boolean;
  onClick: () => void;
}) {
  const palette = {
    green: { bg: "#ecfdf3", border: "#bbf7d0", accent: "#166534", soft: "#dcfce7" },
    amber: { bg: "#fffbeb", border: "#fde68a", accent: "#92400e", soft: "#fef3c7" },
    blue: { bg: "#eff6ff", border: "#bfdbfe", accent: "#1d4ed8", soft: "#dbeafe" },
    slate: { bg: "#f8fafc", border: "#e2e8f0", accent: "#334155", soft: "#e2e8f0" },
  }[item.tone];

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${item.actionLabel}: ${item.label}`}
      aria-pressed={active}
      className="sold-action-plan-card"
      style={{
        ...styles.actionPlanCard,
        borderColor: active ? palette.accent : palette.border,
        backgroundColor: active ? palette.bg : "#fff",
        boxShadow: active ? "0 12px 26px rgba(15,23,42,0.10)" : "none",
      }}
    >
      <span style={styles.actionPlanCardTop}>
        <span style={{ ...styles.actionPlanIcon, color: palette.accent, borderColor: palette.border, backgroundColor: palette.soft }}>
          {item.icon}
        </span>
        <span style={{ ...styles.actionPlanBadge, color: palette.accent, borderColor: palette.border, backgroundColor: active ? "#fff" : palette.bg }}>
          {active ? "Selected" : "Focus"}
        </span>
      </span>
      <span style={styles.actionPlanLabel}>{item.label}</span>
      <strong style={{ ...styles.actionPlanValue, color: palette.accent }}>{item.value}</strong>
      <span style={styles.actionPlanDetail}>{item.detail}</span>
      <span style={{ ...styles.actionPlanAction, color: palette.accent }}>
        {item.actionLabel}
        <ArrowRight size={14} />
      </span>
    </button>
  );
}

function SoldFocusCommandBar({
  focus,
  title,
  description,
  shownCount,
  totalCount,
  onReset,
}: {
  focus: ReviewFocus;
  title: string;
  description: string;
  shownCount: number;
  totalCount: number;
  onReset: () => void;
}) {
  const nextAction = soldFocusNextAction(focus);

  return (
    <section className="sold-focus-command-bar" style={styles.focusCommandBar} aria-label="Active retired listing focus">
      <div style={styles.focusCommandLead}>
        <span style={styles.focusCommandEyebrow}>Active queue</span>
        <strong style={styles.focusCommandTitle}>{title}</strong>
        <span style={styles.focusCommandCopy}>{description}</span>
      </div>
      <div style={styles.focusCommandMetric}>
        <strong>{shownCount.toLocaleString("en-CA")}</strong>
        <span>of {totalCount.toLocaleString("en-CA")} records</span>
      </div>
      <div style={styles.focusCommandAction}>
        <span style={styles.focusCommandNext}>{nextAction}</span>
        <div style={styles.focusCommandLinks}>
          <a href="#sold-removal-audit" style={styles.focusCommandLink}>
            Audit
          </a>
          <a href="#sold-retired-inventory" style={styles.focusCommandLink}>
            Cards
          </a>
          {focus !== "all" && (
            <button type="button" onClick={onReset} style={styles.focusCommandButton}>
              Reset
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function soldFocusNextAction(focus: ReviewFocus): string {
  if (focus === "follow_up") return "Call broker or compare final trade price first.";
  if (focus === "recent") return "Confirm whether the source removal reflects a sale, expiry, or stale capture.";
  if (focus === "lender_review") return "Feed financing exceptions back into the underwriting rules.";
  if (focus === "missing_roi") return "Clean rent, debt, or expense assumptions before ranking these records.";
  if (focus === "verified_inactive") return "Use source-status evidence to separate real removals from stale links.";
  return "Start with missed opportunities, then audit timestamps before opening full cards.";
}

function SoldCommandPanel({
  items,
  actions,
  metrics,
  activeFocus,
  onSelectFocus,
}: {
  items: SoldLessonItem[];
  actions: SoldActionPlanItem[];
  metrics: Array<{
    icon: ReactNode;
    label: string;
    value: string;
    detail: string;
    tone: "orange" | "red" | "blue" | "green" | "slate";
  }>;
  activeFocus: ReviewFocus;
  onSelectFocus: (focus: ReviewFocus) => void;
}) {
  const lead = items[0];
  const cleanup = items[2];
  const freshness = items[3];
  const primaryAction = lead.href ? (
    <Link href={lead.href} style={styles.commandPrimaryAction}>
      {lead.actionLabel}
      <ArrowRight size={14} />
    </Link>
  ) : lead.focus ? (
    <button type="button" onClick={() => onSelectFocus(lead.focus as ReviewFocus)} style={styles.commandPrimaryAction}>
      {lead.actionLabel}
      <ArrowRight size={14} />
    </button>
  ) : null;

  return (
    <section className="sold-command-panel" style={styles.commandPanel} aria-label="Retired inventory command">
      <div className="sold-command-verdict" style={styles.commandVerdict}>
        <p style={styles.commandEyebrow}>SOLD PAGE COMMAND</p>
        <h2 style={styles.commandTitle}>{lead.value === "No ROI lead" ? "Clean the retired queue before ranking misses" : "Start with the best retired lead"}</h2>
        <p style={styles.commandCopy}>{lead.detail}</p>
        <div className="sold-command-actions" style={styles.commandActions}>
          {primaryAction}
          {actions.slice(0, 3).map((action) => {
            const active = action.focus === activeFocus;
            return (
              <button
                key={action.label}
                type="button"
                onClick={() => onSelectFocus(action.focus)}
                aria-pressed={active}
                style={active ? { ...styles.commandSecondaryAction, ...styles.commandSecondaryActionActive } : styles.commandSecondaryAction}
              >
                {action.actionLabel}
              </button>
            );
          })}
        </div>
      </div>

      <div className="sold-command-proof" style={styles.commandProof}>
        <div style={styles.commandProofHeader}>
          <div>
            <span style={styles.commandProofEyebrow}>Proof before scroll</span>
            <strong style={styles.commandProofTitle}>Queue health and next cleanup</strong>
          </div>
          <span style={styles.commandProofBadge}>{freshness?.value ?? "Capture pending"}</span>
        </div>
        <div className="sold-command-signal-grid" style={styles.commandSignalGrid}>
          {metrics.slice(0, 5).map((metric) => (
            <SoldCommandMetric key={metric.label} {...metric} />
          ))}
        </div>
        {cleanup && (
          <div style={styles.commandCleanupNote}>
            <strong>{cleanup.value}</strong>
            <span>{cleanup.detail}</span>
          </div>
        )}
      </div>
    </section>
  );
}

function SoldCommandMetric({
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
  tone: "orange" | "red" | "blue" | "green" | "slate";
}) {
  const palette = {
    orange: { bg: "#fff7ed", border: "#fed7aa", color: "#9a3412" },
    red: { bg: "#fef2f2", border: "#fecaca", color: "#b91c1c" },
    blue: { bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" },
    green: { bg: "#ecfdf3", border: "#bbf7d0", color: "#166534" },
    slate: { bg: "#f8fafc", border: "#e2e8f0", color: "#334155" },
  }[tone];

  return (
    <article className="sold-command-signal-card" style={{ ...styles.commandSignalCard, borderColor: palette.border, backgroundColor: palette.bg }}>
      <span style={{ ...styles.commandSignalIcon, color: palette.color, borderColor: palette.border }}>{icon}</span>
      <span style={{ ...styles.commandSignalLabel, color: palette.color }}>{label}</span>
      <strong style={styles.commandSignalValue}>{value}</strong>
      <span className="sold-command-signal-detail" style={styles.commandSignalDetail}>{detail}</span>
    </article>
  );
}

function SoldLessonStrip({
  items,
  activeFocus,
  onSelectFocus,
}: {
  items: SoldLessonItem[];
  activeFocus: ReviewFocus;
  onSelectFocus: (focus: ReviewFocus) => void;
}) {
  return (
    <section className="sold-lesson-strip" style={styles.lessonStrip} aria-label="Investor first glance">
      <div className="sold-lesson-strip-header" style={styles.lessonHeader}>
        <div style={{ minWidth: 0 }}>
          <p style={styles.eyebrow}>INVESTOR FIRST GLANCE</p>
          <h2 style={styles.sectionTitle}>Cashflow, CoC, and ROI before you scroll</h2>
          <p style={styles.sectionCopy}>
            Start here: best missed deal, follow-up queue, cleanup backlog, and the freshest retired comp from nightly capture.
          </p>
        </div>
        <span style={styles.lessonBadge}>First scan</span>
      </div>

      <div className="sold-lesson-grid" style={styles.lessonGrid}>
        {items.map((item) => (
          <SoldLessonCard
            key={item.label}
            item={item}
            active={item.focus != null && item.focus === activeFocus}
            onSelectFocus={onSelectFocus}
          />
        ))}
      </div>
    </section>
  );
}

function SoldLessonCard({
  item,
  active,
  onSelectFocus,
}: {
  item: SoldLessonItem;
  active: boolean;
  onSelectFocus: (focus: ReviewFocus) => void;
}) {
  const palette = soldLessonPalette(item.tone);
  const actionLabel = `${item.actionLabel}: ${item.label}`;
  const content = (
    <>
      <span style={{ ...styles.lessonCardLabel, color: palette.label }}>{item.label}</span>
      <strong style={styles.lessonCardValue}>{item.value}</strong>
      <span style={styles.lessonCardDetail}>{item.detail}</span>
      <span style={{ ...styles.lessonCardCta, color: palette.cta }}>
        {item.actionLabel}
        <ArrowRight size={14} />
      </span>
    </>
  );
  const cardStyle = {
    ...styles.lessonCard,
    backgroundColor: active ? palette.bg : "#fff",
    borderColor: active ? palette.cta : palette.border,
    boxShadow: active ? "0 12px 26px rgba(15,23,42,0.10)" : "none",
  };

  if (item.href) {
    return (
      <Link href={item.href} aria-label={actionLabel} style={cardStyle}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => item.focus && onSelectFocus(item.focus)}
      aria-label={actionLabel}
      aria-pressed={active}
      style={{ ...cardStyle, ...styles.lessonButton }}
    >
      {content}
    </button>
  );
}

function reviewFocusOptions({
  listings,
  followUpNowCount,
  recentRemovalCount,
  lenderReviewCount,
  missingRoiCount,
  verifiedInactiveCount,
}: {
  listings: SoldListing[];
  followUpNowCount: number;
  recentRemovalCount: number;
  lenderReviewCount: number;
  missingRoiCount: number;
  verifiedInactiveCount: number;
}) {
  return [
    {
      key: "all" as const,
      label: "All retired",
      title: "All retired records",
      count: listings.length,
      short: "Full cleanup view",
      description: "Show every sold, unavailable, or stale record preserved from source cleanup.",
    },
    {
      key: "follow_up" as const,
      label: "Follow up",
      title: "Follow-up-worthy removals",
      count: followUpNowCount,
      short: "Positive CF + 5% CoC",
      description: "Prioritize removed deals that still modeled positive cashflow and at least 5% cash-on-cash return.",
    },
    {
      key: "recent" as const,
      label: "Recent",
      title: "Fresh disappearances",
      count: recentRemovalCount,
      short: "Removed near latest snapshot",
      description: "Focus on the records most likely to be useful for quick broker calls or price-discovery follow-up.",
    },
    {
      key: "lender_review" as const,
      label: "Lender review",
      title: "Financing-rule feedback",
      count: lenderReviewCount,
      short: "Manual underwriting flags",
      description: "Review removed records that still need lender-path confirmation, especially 5+ unit files.",
    },
    {
      key: "missing_roi" as const,
      label: "Missing ROI",
      title: "ROI cleanup queue",
      count: missingRoiCount,
      short: "Needs rent/debt assumptions",
      description: "Find retired records that cannot be compared yet because the return model is incomplete.",
    },
    {
      key: "verified_inactive" as const,
      label: "Inactive links",
      title: "Checked inactive links",
      count: verifiedInactiveCount,
      short: "Source failed/disappeared",
      description: "Audit records whose source page was checked and marked inactive.",
    },
  ];
}

function matchesReviewFocus(listing: SoldListing, focus: ReviewFocus, recentRemovalAnchor: number): boolean {
  if (focus === "all") return true;
  if (focus === "follow_up") {
    return (listing.roi?.cashOnCashReturn ?? Number.NEGATIVE_INFINITY) >= 5 && (listing.roi?.annualCashflow ?? Number.NEGATIVE_INFINITY) > 0;
  }
  if (focus === "recent") {
    const removedAt = new Date((listing.soldAt ?? listing.unavailableSince) || "").getTime();
    if (!Number.isFinite(removedAt)) return false;
    const daysFromAnchor = (recentRemovalAnchor - removedAt) / (1000 * 60 * 60 * 24);
    return daysFromAnchor >= 0 && daysFromAnchor <= 14;
  }
  if (focus === "lender_review") return Boolean(listing.underwriting?.manualLenderReview);
  if (focus === "missing_roi") return listing.roi?.cashOnCashReturn == null;
  if (focus === "verified_inactive") return listing.isLinkActive === false;
  return true;
}

function soldLessonPalette(tone: SoldLessonTone) {
  return {
    green: { bg: "#ecfdf3", border: "#bbf7d0", label: "#166534", cta: "#166534" },
    amber: { bg: "#fffbeb", border: "#fde68a", label: "#b45309", cta: "#b45309" },
    blue: { bg: "#eff6ff", border: "#bfdbfe", label: "#1d4ed8", cta: "#1d4ed8" },
    red: { bg: "#fef2f2", border: "#fecaca", label: "#b91c1c", cta: "#b91c1c" },
    slate: { bg: "#f8fafc", border: "#e2e8f0", label: "#475569", cta: "#334155" },
  }[tone];
}

function SummaryTile({
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
  tone: "orange" | "red" | "blue" | "green" | "slate";
}) {
  const palette = {
    orange: { bg: "#fff7ed", border: "#fed7aa", color: "#9a3412" },
    red: { bg: "#fef2f2", border: "#fecaca", color: "#b91c1c" },
    blue: { bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" },
    green: { bg: "#ecfdf3", border: "#bbf7d0", color: "#166534" },
    slate: { bg: "#f8fafc", border: "#e2e8f0", color: "#334155" },
  }[tone];

  return (
    <div style={styles.summaryTile}>
      <div style={styles.summaryTop}>
        <span style={styles.summaryLabel}>{label}</span>
        <span style={{ ...styles.summaryIcon, backgroundColor: palette.bg, borderColor: palette.border, color: palette.color }}>
          {icon}
        </span>
      </div>
      <div style={styles.summaryValue}>{value}</div>
      <div style={styles.summaryDetail}>{detail}</div>
    </div>
  );
}

function TriageLane({
  icon,
  title,
  value,
  detail,
  tone,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  detail: string;
  tone: "green" | "amber" | "blue" | "slate";
}) {
  const palette = {
    green: { bg: "#ecfdf3", border: "#bbf7d0", color: "#166534" },
    amber: { bg: "#fffbeb", border: "#fde68a", color: "#b45309" },
    blue: { bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" },
    slate: { bg: "#f8fafc", border: "#e2e8f0", color: "#334155" },
  }[tone];

  return (
    <article style={{ ...styles.triageLane, borderColor: palette.border, backgroundColor: palette.bg }}>
      <div style={styles.triageLaneTop}>
        <span style={{ ...styles.triageIcon, color: palette.color, borderColor: palette.border, backgroundColor: "#fff" }}>{icon}</span>
        <span style={{ ...styles.triageValue, color: palette.color }}>{value}</span>
      </div>
      <h3 style={styles.triageTitle}>{title}</h3>
      <p style={styles.triageDetail}>{detail}</p>
    </article>
  );
}

function RemovalBadge({ listing }: { listing: SoldListing }) {
  const hasHttpStatus = listing.linkStatusCode != null;
  const label = hasHttpStatus
    ? `HTTP ${listing.linkStatusCode}`
    : listing.isLinkActive === false
      ? "Inactive"
      : "Removed";
  const tone =
    listing.linkStatusCode === 404 || listing.linkStatusCode === 410 || listing.linkStatusCode === 451
      ? styles.removalBadgeRed
      : listing.isLinkActive === false
        ? styles.removalBadgeAmber
        : styles.removalBadgeNeutral;

  return <span style={{ ...styles.removalBadge, ...tone }}>{label}</span>;
}

function TimelineItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.timelineItem}>
      <span style={styles.timelineLabel}>{label}</span>
      <strong style={styles.timelineValue}>{value}</strong>
    </div>
  );
}

function MissedMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "red" | "slate";
}) {
  const toneStyle = {
    green: { color: "#166534", backgroundColor: "#ecfdf3", borderColor: "#bbf7d0" },
    red: { color: "#b91c1c", backgroundColor: "#fef2f2", borderColor: "#fecaca" },
    slate: { color: "#334155", backgroundColor: "#f8fafc", borderColor: "#e2e8f0" },
  }[tone];

  return (
    <div style={{ ...styles.missedMetric, ...toneStyle }}>
      <span style={styles.missedMetricLabel}>{label}</span>
      <strong style={styles.missedMetricValue}>{value}</strong>
    </div>
  );
}

function removalReason(listing: SoldListing): string {
  if (listing.linkStatusNote) return listing.linkStatusNote;
  if (listing.unavailableSince) return "No longer found in the active nightly capture.";
  if (listing.soldAt) return "Marked sold or unavailable during listing cleanup.";
  return "Retired from active inventory.";
}

function sourceName(source: string): string {
  const normalized = source.toLowerCase();
  if (normalized.includes("centris")) return "Centris";
  if (normalized.includes("multi")) return "Multi-source";
  if (normalized.includes("realtor")) return "Realtor.ca";
  return "Source";
}

function threeYearCashflow(listing: SoldListing): number | null {
  if (!listing.roi) return null;
  const years = listing.roi.cashflowYears?.slice(0, 3) ?? [];
  if (years.length > 0) {
    return years.reduce((sum, year) => sum + year.annualCashflow, 0);
  }
  return listing.roi.annualCashflow * 3;
}

function retiredRoiFormula(listing: SoldListing): string {
  const roi = listing.roi;
  if (!roi) return "ROI value n/a";
  const cashflow = roi.annualCashflow;
  const paydown = roi.yearOneDebtPaydown ?? 0;
  const appreciation = roi.yearOneAppreciation ?? 0;
  const total = roi.totalYearOneReturn ?? cashflow + paydown + appreciation;
  return `${formatCurrency(cashflow)} CF + ${formatCurrency(paydown)} paydown + ${formatCurrency(appreciation)} appreciation = ${formatCurrency(total)}`;
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

function formatDate(value?: string | null): string {
  if (!value) return "n/a";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "n/a";
  return date.toLocaleDateString("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function formatDateTime(value?: string | null): string {
  if (!value) return "n/a";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "n/a";
  return date.toLocaleString("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const styles: Record<string, CSSProperties> = {
  commandPanel: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 0.92fr) minmax(420px, 1.08fr)",
    gap: 14,
    alignItems: "stretch",
    borderRadius: 16,
    border: "1px solid #fed7aa",
    background: "linear-gradient(135deg, #ffffff 0%, #fff7ed 100%)",
    padding: 18,
    marginBottom: 22,
    boxShadow: "0 16px 38px rgba(154, 52, 18, 0.10)",
  },
  commandVerdict: {
    minWidth: 0,
    borderRadius: 13,
    border: "1px solid #fdba74",
    backgroundColor: "rgba(255,255,255,0.82)",
    padding: 16,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    gap: 14,
  },
  commandEyebrow: {
    margin: 0,
    color: "#c2410c",
    fontSize: 11,
    fontWeight: 950,
    letterSpacing: "0.12em",
  },
  commandTitle: {
    margin: "6px 0 0",
    color: "#0f172a",
    fontSize: 24,
    lineHeight: 1.12,
  },
  commandCopy: {
    margin: "8px 0 0",
    color: "#475569",
    fontSize: 14,
    lineHeight: 1.6,
  },
  commandActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  commandPrimaryAction: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 999,
    border: "1px solid #ea580c",
    backgroundColor: "#ea580c",
    color: "#fff",
    padding: "10px 13px",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  commandSecondaryAction: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    border: "1px solid #fed7aa",
    backgroundColor: "#fff",
    color: "#9a3412",
    padding: "10px 12px",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  commandSecondaryActionActive: {
    borderColor: "#ea580c",
    backgroundColor: "#ffedd5",
    boxShadow: "0 8px 18px rgba(234, 88, 12, 0.12)",
  },
  commandProof: {
    minWidth: 0,
    borderRadius: 13,
    border: "1px solid #fed7aa",
    backgroundColor: "rgba(255,255,255,0.72)",
    padding: 14,
    display: "grid",
    gap: 10,
  },
  commandProofHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
  },
  commandProofEyebrow: {
    display: "block",
    color: "#c2410c",
    fontSize: 10,
    fontWeight: 950,
    letterSpacing: "0.11em",
    textTransform: "uppercase",
  },
  commandProofTitle: {
    display: "block",
    marginTop: 4,
    color: "#0f172a",
    fontSize: 16,
    lineHeight: 1.2,
  },
  commandProofBadge: {
    borderRadius: 999,
    border: "1px solid #fed7aa",
    backgroundColor: "#fff7ed",
    color: "#9a3412",
    padding: "7px 10px",
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  commandSignalGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: 8,
  },
  commandSignalCard: {
    minWidth: 0,
    borderRadius: 11,
    borderWidth: 1,
    borderStyle: "solid",
    padding: 10,
    display: "grid",
    gap: 5,
  },
  commandSignalIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderWidth: 1,
    borderStyle: "solid",
    backgroundColor: "#fff",
    display: "grid",
    placeItems: "center",
  },
  commandSignalLabel: {
    fontSize: 10,
    fontWeight: 950,
    letterSpacing: "0.07em",
    textTransform: "uppercase",
  },
  commandSignalValue: {
    color: "#0f172a",
    fontSize: 18,
    lineHeight: 1.08,
    overflowWrap: "anywhere",
  },
  commandSignalDetail: {
    color: "#475569",
    fontSize: 11,
    lineHeight: 1.35,
  },
  commandCleanupNote: {
    borderRadius: 11,
    border: "1px solid #fed7aa",
    backgroundColor: "#fff",
    padding: 11,
    display: "grid",
    gap: 4,
    color: "#475569",
    fontSize: 12,
    lineHeight: 1.45,
  },
  headerPill: {
    display: "inline-flex",
    borderRadius: 999,
    backgroundColor: "#fff7ed",
    border: "1px solid #fed7aa",
    padding: "6px 10px",
    color: "#9a3412",
    fontSize: 13,
    fontWeight: 800,
  },
  headerPillMuted: {
    display: "inline-flex",
    borderRadius: 999,
    backgroundColor: "#fff",
    border: "1px solid #e2e8f0",
    padding: "6px 10px",
    color: "#475569",
    fontSize: 13,
    fontWeight: 700,
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: 12,
    marginBottom: 20,
  },
  summaryTile: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    border: "1px solid #e2e8f0",
    boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
    minWidth: 0,
  },
  summaryTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  summaryLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },
  summaryIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    display: "grid",
    placeItems: "center",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#e2e8f0",
    flexShrink: 0,
  },
  summaryValue: {
    color: "#0f172a",
    fontSize: 25,
    fontWeight: 800,
    lineHeight: 1.1,
    overflowWrap: "anywhere",
  },
  summaryDetail: {
    marginTop: 6,
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.45,
  },
  triagePanel: {
    borderRadius: 14,
    border: "1px solid #fed7aa",
    background: "linear-gradient(135deg, #ffffff 0%, #fff7ed 100%)",
    padding: 18,
    marginBottom: 22,
    boxShadow: "0 14px 34px rgba(154, 52, 18, 0.08)",
  },
  triageHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 14,
  },
  triageAction: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    border: "1px solid #fed7aa",
    backgroundColor: "#fff",
    color: "#9a3412",
    padding: "9px 12px",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 850,
    whiteSpace: "nowrap",
  },
  triageGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: 10,
  },
  triageLane: {
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#e2e8f0",
    padding: 14,
    minWidth: 0,
  },
  triageLaneTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },
  triageIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#e2e8f0",
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
  },
  triageValue: {
    fontSize: 25,
    lineHeight: 1,
    fontWeight: 900,
  },
  triageTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 14,
    fontWeight: 900,
  },
  triageDetail: {
    margin: "6px 0 0",
    color: "#475569",
    fontSize: 12,
    lineHeight: 1.45,
  },
  focusPanel: {
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#fdba74",
    backgroundColor: "rgba(255,255,255,0.72)",
    padding: 14,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
    flexWrap: "wrap",
  },
  focusEyebrow: {
    margin: 0,
    color: "#c2410c",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.11em",
  },
  focusTitle: {
    margin: "5px 0 0",
    color: "#0f172a",
    fontSize: 17,
  },
  focusCopy: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.45,
    maxWidth: 740,
  },
  focusCount: {
    display: "grid",
    justifyItems: "end",
    color: "#64748b",
    fontSize: 12,
    whiteSpace: "nowrap",
  },
  focusButtonGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 10,
    marginTop: 12,
  },
  focusButton: {
    display: "grid",
    gap: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#fed7aa",
    backgroundColor: "#fff",
    color: "#0f172a",
    padding: 11,
    textAlign: "left",
    cursor: "pointer",
  },
  focusButtonActive: {
    borderColor: "#ea580c",
    backgroundColor: "#ffedd5",
    boxShadow: "0 10px 22px rgba(234, 88, 12, 0.12)",
  },
  focusButtonTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    fontSize: 13,
  },
  focusButtonCount: {
    borderRadius: 999,
    border: "1px solid #fed7aa",
    backgroundColor: "#fff7ed",
    color: "#9a3412",
    padding: "3px 7px",
    fontSize: 11,
    fontWeight: 900,
  },
  focusButtonCountActive: {
    borderRadius: 999,
    backgroundColor: "#ea580c",
    color: "#fff",
    padding: "4px 8px",
    fontSize: 11,
    fontWeight: 900,
  },
  focusButtonCopy: {
    color: "#64748b",
    fontSize: 11,
    lineHeight: 1.35,
  },
  focusCommandBar: {
    margin: "12px 0 14px",
    borderRadius: 13,
    border: "1px solid #fdba74",
    background: "linear-gradient(135deg, #ffffff 0%, #fff7ed 100%)",
    padding: 13,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto minmax(220px, auto)",
    gap: 12,
    alignItems: "center",
    boxShadow: "0 10px 22px rgba(154, 52, 18, 0.08)",
  },
  focusCommandLead: {
    minWidth: 0,
    display: "grid",
    gap: 4,
  },
  focusCommandEyebrow: {
    color: "#c2410c",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.11em",
    textTransform: "uppercase",
  },
  focusCommandTitle: {
    color: "#0f172a",
    fontSize: 16,
    lineHeight: 1.2,
    overflowWrap: "anywhere",
  },
  focusCommandCopy: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.4,
  },
  focusCommandMetric: {
    minWidth: 104,
    borderRadius: 11,
    border: "1px solid #fed7aa",
    backgroundColor: "#fff",
    padding: "9px 11px",
    display: "grid",
    justifyItems: "center",
    gap: 3,
    color: "#64748b",
    fontSize: 11,
    whiteSpace: "nowrap",
  },
  focusCommandAction: {
    minWidth: 0,
    display: "grid",
    justifyItems: "end",
    gap: 8,
  },
  focusCommandNext: {
    color: "#9a3412",
    fontSize: 12,
    fontWeight: 850,
    lineHeight: 1.35,
    textAlign: "right",
  },
  focusCommandLinks: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 7,
    flexWrap: "wrap",
  },
  focusCommandLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 34,
    borderRadius: 999,
    border: "1px solid #fed7aa",
    backgroundColor: "#fff",
    color: "#9a3412",
    padding: "7px 10px",
    textDecoration: "none",
    fontSize: 12,
    fontWeight: 900,
  },
  focusCommandButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 34,
    borderRadius: 999,
    border: "1px solid #fed7aa",
    backgroundColor: "#ffedd5",
    color: "#9a3412",
    padding: "7px 10px",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
  actionPlan: {
    backgroundColor: "#fff",
    border: "1px solid #fed7aa",
    borderRadius: 14,
    padding: 18,
    marginBottom: 20,
    boxShadow: "0 12px 28px rgba(154, 52, 18, 0.08)",
  },
  actionPlanHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 14,
  },
  actionPlanLink: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    border: "1px solid #fed7aa",
    backgroundColor: "#fff7ed",
    color: "#9a3412",
    padding: "9px 12px",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  actionPlanGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: 10,
  },
  actionPlanCard: {
    textAlign: "left",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#fff",
    color: "#0f172a",
    padding: 14,
    display: "grid",
    gap: 8,
    minWidth: 0,
    cursor: "pointer",
  },
  actionPlanCardTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  actionPlanIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: "solid",
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
  },
  actionPlanBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "solid",
    padding: "4px 8px",
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  actionPlanLabel: {
    color: "#475569",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },
  actionPlanValue: {
    fontSize: 28,
    lineHeight: 1,
    fontWeight: 900,
    overflowWrap: "anywhere",
  },
  actionPlanDetail: {
    color: "#475569",
    fontSize: 12,
    lineHeight: 1.5,
  },
  actionPlanAction: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    justifySelf: "start",
    fontSize: 12,
    fontWeight: 900,
  },
  lessonStrip: {
    borderRadius: 14,
    border: "1px solid #dbeafe",
    background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
    padding: 18,
    marginBottom: 20,
    boxShadow: "0 14px 34px rgba(15, 23, 42, 0.08)",
  },
  lessonHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
    flexWrap: "wrap",
    marginBottom: 14,
  },
  lessonBadge: {
    borderRadius: 999,
    border: "1px solid #bfdbfe",
    backgroundColor: "#eff6ff",
    color: "#1d4ed8",
    padding: "7px 10px",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  lessonGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: 10,
  },
  lessonCard: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
    minHeight: 154,
    minWidth: 0,
    borderRadius: 13,
    borderWidth: 1,
    borderStyle: "solid",
    padding: 14,
    color: "#0f172a",
    textDecoration: "none",
  },
  lessonButton: {
    width: "100%",
    appearance: "none",
    textAlign: "left",
    cursor: "pointer",
  },
  lessonCardLabel: {
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  lessonCardValue: {
    color: "#0f172a",
    fontSize: 18,
    lineHeight: 1.22,
    overflowWrap: "anywhere",
  },
  lessonCardDetail: {
    color: "#475569",
    fontSize: 12,
    lineHeight: 1.45,
  },
  lessonCardCta: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    marginTop: "auto",
    fontSize: 12,
    fontWeight: 900,
  },
  missedPanel: {
    backgroundColor: "#fff",
    border: "1px solid #bbf7d0",
    borderRadius: 8,
    padding: 18,
    marginBottom: 22,
    boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
  },
  missedHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 14,
  },
  missedGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 12,
  },
  missedCard: {
    position: "relative",
    display: "grid",
    gap: 10,
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    background: "linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)",
    padding: 14,
    minWidth: 0,
  },
  missedRank: {
    position: "absolute",
    top: 12,
    right: 12,
    borderRadius: 999,
    backgroundColor: "#166534",
    color: "#fff",
    padding: "4px 8px",
    fontSize: 11,
    fontWeight: 900,
  },
  missedTitle: {
    color: "#0f172a",
    textDecoration: "none",
    fontSize: 15,
    fontWeight: 900,
    lineHeight: 1.3,
    paddingRight: 42,
  },
  missedMeta: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.45,
  },
  missedMetricGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(92px, 1fr))",
    gap: 8,
  },
  missedMetric: {
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 9,
    minWidth: 0,
  },
  missedMetricLabel: {
    display: "block",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },
  missedMetricValue: {
    display: "block",
    marginTop: 5,
    fontSize: 14,
    overflowWrap: "anywhere",
  },
  missedFormula: {
    display: "grid",
    gap: 4,
    borderTop: "1px solid #bbf7d0",
    marginTop: 8,
    paddingTop: 8,
    color: "#166534",
    fontSize: 12,
    lineHeight: 1.45,
    overflowWrap: "anywhere",
  },
  missedFormulaDisclosure: {
    borderRadius: 10,
    border: "1px solid #bbf7d0",
    backgroundColor: "#f0fdf4",
    padding: 9,
  },
  missedFormulaSummary: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    cursor: "pointer",
    listStyle: "none",
    color: "#166534",
  },
  missedFormulaSummaryCopy: {
    display: "grid",
    gap: 2,
    minWidth: 0,
  },
  missedFormulaSummaryLabel: {
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  missedFormulaSummaryTitle: {
    color: "#0f172a",
    fontSize: 13,
    lineHeight: 1.2,
  },
  missedFormulaSummaryHint: {
    color: "#166534",
    fontSize: 11,
    fontWeight: 800,
    textAlign: "right",
  },
  missedFooter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    color: "#64748b",
    fontSize: 12,
    flexWrap: "wrap",
  },
  reviewAction: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: "#166534",
    color: "#fff",
    textDecoration: "none",
    padding: "7px 10px",
    fontSize: 12,
    fontWeight: 900,
  },
  removalGuide: {
    backgroundColor: "#fff",
    border: "1px solid #dbeafe",
    borderRadius: 14,
    padding: 18,
    marginBottom: 18,
    boxShadow: "0 12px 28px rgba(15,23,42,0.06)",
  },
  removalGuideHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
    flexWrap: "wrap",
    marginBottom: 14,
  },
  removalGuideBadge: {
    borderRadius: 999,
    border: "1px solid #bfdbfe",
    backgroundColor: "#eff6ff",
    color: "#1d4ed8",
    padding: "7px 10px",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  removalGuideGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: 10,
  },
  removalGuideCard: {
    minWidth: 0,
    display: "grid",
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "solid",
    padding: 12,
  },
  removalGuideLabel: {
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  removalGuideValue: {
    color: "#0f172a",
    fontSize: 17,
    lineHeight: 1.18,
    overflowWrap: "anywhere",
  },
  removalGuideDetail: {
    color: "#475569",
    fontSize: 12,
    lineHeight: 1.45,
  },
  auditPanel: {
    backgroundColor: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: 18,
    marginBottom: 22,
    boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
  },
  auditHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 14,
  },
  eyebrow: {
    margin: 0,
    color: "#9a3412",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.1em",
  },
  sectionTitle: {
    margin: "4px 0 0",
    color: "#0f172a",
    fontSize: 20,
  },
  sectionCopy: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.55,
  },
  auditList: {
    display: "grid",
    gap: 8,
  },
  auditRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.25fr) minmax(220px, 0.9fr) minmax(170px, 0.65fr) auto",
    alignItems: "center",
    gap: 14,
    padding: 12,
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    backgroundColor: "#f8fafc",
  },
  auditTitle: {
    color: "#0f172a",
    textDecoration: "none",
    fontWeight: 800,
    lineHeight: 1.35,
  },
  auditMeta: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 12,
  },
  auditReason: {
    marginTop: 8,
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    color: "#475569",
    fontSize: 12,
    lineHeight: 1.45,
  },
  removalBadge: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    border: "1px solid",
    padding: "3px 7px",
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  removalBadgeRed: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    color: "#b91c1c",
  },
  removalBadgeAmber: {
    backgroundColor: "#fffbeb",
    borderColor: "#fde68a",
    color: "#92400e",
  },
  removalBadgeNeutral: {
    backgroundColor: "#f8fafc",
    borderColor: "#cbd5e1",
    color: "#475569",
  },
  auditTimeline: {
    display: "grid",
    gap: 6,
    minWidth: 0,
  },
  timelineItem: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    borderRadius: 8,
    backgroundColor: "#fff",
    border: "1px solid #e2e8f0",
    padding: "7px 9px",
  },
  timelineLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  timelineValue: {
    color: "#0f172a",
    fontSize: 12,
    textAlign: "right",
    overflowWrap: "anywhere",
  },
  auditValues: {
    display: "grid",
    gap: 4,
    color: "#0f172a",
    fontSize: 13,
    textAlign: "right",
    minWidth: 0,
  },
  sourceAction: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    backgroundColor: "#fff",
    color: "#2563eb",
    padding: "8px 10px",
    fontSize: 13,
    fontWeight: 800,
    textDecoration: "none",
  },
  noSource: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: 700,
  },
  emptyFocus: {
    display: "grid",
    justifyItems: "center",
    gap: 8,
    borderRadius: 12,
    border: "1px dashed #cbd5e1",
    backgroundColor: "#f8fafc",
    color: "#64748b",
    padding: 24,
    textAlign: "center",
  },
  emptyFocusButton: {
    borderRadius: 999,
    border: "1px solid #cbd5e1",
    backgroundColor: "#fff",
    color: "#334155",
    padding: "8px 11px",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
  soldStatePanel: {
    borderRadius: 16,
    border: "1px solid #fed7aa",
    background: "linear-gradient(135deg, #ffffff 0%, #fff7ed 100%)",
    padding: 22,
    boxShadow: "0 18px 45px rgba(154, 52, 18, 0.08)",
  },
  soldStateGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.25fr) minmax(260px, 0.75fr)",
    gap: 16,
    alignItems: "stretch",
  },
  soldStateTitle: {
    margin: "7px 0 0",
    color: "#0f172a",
    fontSize: 22,
    lineHeight: 1.2,
  },
  soldStateCopy: {
    margin: "8px 0 0",
    fontSize: 14,
    lineHeight: 1.6,
  },
  soldStateActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 16,
  },
  soldStatePrimaryAction: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 999,
    border: "1px solid #ea580c",
    backgroundColor: "#ea580c",
    color: "#fff",
    padding: "10px 14px",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 900,
  },
  soldStateSecondaryAction: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    border: "1px solid #fed7aa",
    backgroundColor: "#fff",
    color: "#9a3412",
    padding: "10px 14px",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
  },
  soldStateAside: {
    borderRadius: 12,
    border: "1px solid #fed7aa",
    backgroundColor: "#fff",
    padding: 14,
    display: "grid",
    gap: 11,
    alignContent: "start",
    minWidth: 0,
  },
  soldStateBadge: {
    justifySelf: "start",
    borderRadius: 999,
    border: "1px solid #fed7aa",
    backgroundColor: "#fff7ed",
    color: "#9a3412",
    padding: "6px 9px",
    fontSize: 12,
    fontWeight: 900,
  },
  soldStateFact: {
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    backgroundColor: "#f8fafc",
    padding: 11,
    minWidth: 0,
  },
  soldStateFactLabel: {
    margin: 0,
    color: "#64748b",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  soldStateFactValue: {
    margin: "6px 0 0",
    color: "#0f172a",
    fontSize: 13,
    lineHeight: 1.45,
    fontWeight: 800,
  },
  cardsHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 14,
  },
};
