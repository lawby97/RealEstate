"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { formatCompactCurrency } from "@/lib/display-format";
import {
  ArrowRight,
  BriefcaseBusiness,
} from "lucide-react";
import { ListingCard } from "@/components/ListingCard";

type Stats = {
  avgScore: number;
  avgRoi: number;
  totalPortfolioValue?: number;
  totalListings: number;
  topDeals?: number;
  highScore90?: number;
};

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
  evaluation: { combinedScore: number } | null;
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

type PipelineFocus = "roi" | "ready" | "positive_cashflow" | "lender_review" | "missing_roi";

type PipelineFocusOption = {
  key: PipelineFocus;
  label: string;
  title: string;
  count: number;
  short: string;
  description: string;
};

type PipelineQueueStats = {
  bestCoc: number | null;
  medianEquity: number | null;
  positiveCashflow: number;
  readyToUnderwrite: number;
  lenderReview: number;
  missingRoi: number;
  total: number;
};

type PipelineActionTone = "green" | "blue" | "amber" | "red" | "slate";

type PipelineActionItem = {
  label: string;
  value: string;
  detail: string;
  action: string;
  tone: PipelineActionTone;
  href?: string;
  onClick?: () => void;
};

type PipelineProofItem = {
  label: string;
  value: string;
  detail: string;
  tone: "blue" | "green" | "violet" | "slate";
};

type PipelineReviewStatus = "ready" | "watch" | "blocked";

type PipelineReviewStep = {
  step: string;
  title: string;
  value: string;
  detail: string;
  status: PipelineReviewStatus;
  action: string;
  href?: string;
  onClick?: () => void;
};

export default function PropertiesPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loadingListings, setLoadingListings] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pipelineFocus, setPipelineFocus] = useState<PipelineFocus>("roi");
  const [loadKey, setLoadKey] = useState(0);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, [loadKey]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({
      limit: "12",
      sort: "roi_desc",
    });
    setLoadingListings(true);
    setError(null);
    fetch(`/api/listings?${params}`)
      .then((response) => {
        if (!response.ok) throw new Error(`Server returned ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (!cancelled) setListings(Array.isArray(data?.listings) ? data.listings : []);
      })
      .catch((err) => {
        if (!cancelled) {
          setListings([]);
          setError(err instanceof Error ? err.message : "Could not load tracked opportunities.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingListings(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadKey]);

  const portfolioValue = stats?.totalPortfolioValue ?? 0;
  const avgRoiDisplay = stats?.avgRoi != null ? `${stats.avgRoi.toFixed(1)}%` : "—";
  const avgScore = stats?.avgScore != null ? stats.avgScore.toFixed(1) : "—";
  const queueStats = useMemo(() => {
    const finiteRoiValues = listings
      .map((listing) => listing.roi?.cashOnCashReturn)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    const equityValues = listings
      .map((listing) => listing.roi?.equityRequired)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);
    const positiveCashflow = listings.filter(
      (listing) => typeof listing.roi?.annualCashflow === "number" && Number.isFinite(listing.roi.annualCashflow) && listing.roi.annualCashflow > 0
    ).length;
    const readyToUnderwrite = listings.filter(
      (listing) =>
        typeof listing.roi?.cashOnCashReturn === "number" &&
        Number.isFinite(listing.roi.cashOnCashReturn) &&
        typeof listing.roi?.annualCashflow === "number" &&
        listing.roi.annualCashflow > 0 &&
        !listing.underwriting?.manualLenderReview
    ).length;
    const lenderReview = listings.filter((listing) => listing.underwriting?.manualLenderReview).length;
    const missingRoi = listings.filter(
      (listing) => typeof listing.roi?.cashOnCashReturn !== "number" || !Number.isFinite(listing.roi.cashOnCashReturn)
    ).length;

    return {
      bestCoc: finiteRoiValues.length ? Math.max(...finiteRoiValues) : null,
      medianEquity: median(equityValues),
      positiveCashflow,
      readyToUnderwrite,
      lenderReview,
      missingRoi,
      total: listings.length,
    };
  }, [listings]);
  const pipelineFocusOptions = useMemo(() => buildPipelineFocusOptions(listings, queueStats), [listings, queueStats]);
  const activePipelineFocus = pipelineFocusOptions.find((option) => option.key === pipelineFocus) ?? pipelineFocusOptions[0];
  const reviewListings = useMemo(() => selectPipelineFocusListings(listings, pipelineFocus).slice(0, 6), [listings, pipelineFocus]);
  const bestPipelineListing = useMemo(() => selectPipelineFocusListings(listings, "roi")[0] ?? null, [listings]);
  const queueAction = getQueueAction(queueStats);
  const latestCapture = useMemo(
    () =>
      listings
        .map((listing) => listing.lastSyncRunAt ?? listing.lastSeenAt ?? listing.createdAt)
        .filter(Boolean)
        .map((value) => new Date(value as string).getTime())
        .filter(Number.isFinite)
        .sort((a, b) => b - a)[0],
    [listings]
  );
  const latestCaptureLabel = latestCapture ? formatDateTime(new Date(latestCapture).toISOString()) : "Pending";
  const modeledRoiCount = Math.max(0, queueStats.total - queueStats.missingRoi);
  const pipelineProofItems: PipelineProofItem[] = [
    {
      label: "Active value",
      value: formatCompactCurrency(portfolioValue),
      detail: `${stats?.totalListings ?? 0} active records in scope.`,
      tone: "blue",
    },
    {
      label: "Average CoC",
      value: avgRoiDisplay,
      detail: "Real modeled cash-on-cash return, nulls excluded.",
      tone: "green",
    },
    {
      label: "Average score",
      value: avgScore,
      detail: `${stats?.topDeals ?? 0} listings score 80+; ${stats?.highScore90 ?? 0} score 90+.`,
      tone: "violet",
    },
    {
      label: "Latest capture",
      value: latestCaptureLabel,
      detail: "Newest active record captured or verified in this pipeline.",
      tone: "slate",
    },
  ];
  const pipelineReviewSteps: PipelineReviewStep[] = [
    {
      step: "01",
      title: "Active source queue",
      value: queueStats.total.toLocaleString("en-CA"),
      detail: `Latest captured or verified ${latestCaptureLabel}. Only active records should feed this pipeline.`,
      status: queueStats.total > 0 ? "ready" : "blocked",
      action: "Open dashboard",
      href: "/",
    },
    {
      step: "02",
      title: "ROI model ready",
      value: `${modeledRoiCount.toLocaleString("en-CA")}/${queueStats.total.toLocaleString("en-CA")}`,
      detail: "Listings need rent, expense, and debt assumptions before CoC can drive the queue.",
      status: queueStats.missingRoi === 0 ? "ready" : modeledRoiCount > 0 ? "watch" : "blocked",
      action: queueStats.missingRoi > 0 ? "Show missing ROI" : "Show ROI leaders",
      onClick: () => setPipelineFocus(queueStats.missingRoi > 0 ? "missing_roi" : "roi"),
    },
    {
      step: "03",
      title: "Cashflow pass",
      value: queueStats.positiveCashflow.toLocaleString("en-CA"),
      detail: "Positive year-one cashflow is the first carry test before deeper underwriting.",
      status: queueStats.positiveCashflow > 0 ? "ready" : modeledRoiCount > 0 ? "watch" : "blocked",
      action: "Show positive CF",
      onClick: () => setPipelineFocus("positive_cashflow"),
    },
    {
      step: "04",
      title: "Financing lane",
      value: queueStats.lenderReview > 0 ? `${queueStats.lenderReview.toLocaleString("en-CA")} review` : "Clear",
      detail: "5-8 unit personal-lender exceptions and manual flags need confirmation before offer math.",
      status: queueStats.lenderReview > 0 ? "watch" : "ready",
      action: queueStats.lenderReview > 0 ? "Show lender flags" : "Open underwriting",
      onClick: queueStats.lenderReview > 0 ? () => setPipelineFocus("lender_review") : undefined,
      href: queueStats.lenderReview > 0 ? undefined : "/underwriting",
    },
    {
      step: "05",
      title: "Ready to underwrite",
      value: queueStats.readyToUnderwrite.toLocaleString("en-CA"),
      detail: "This is the cleanest shortlist: modeled CoC, positive cashflow, and no lender-review flag.",
      status: queueStats.readyToUnderwrite > 0 ? "ready" : queueStats.total > 0 ? "watch" : "blocked",
      action: "Show ready queue",
      onClick: () => setPipelineFocus("ready"),
    },
  ];

  return (
    <div className="dashboard-page" style={styles.page}>
      <header className="dashboard-hero" style={styles.hero}>
        <div>
          <p style={styles.eyebrow}>PROPERTY PIPELINE</p>
          <h1 style={styles.title}>Tracked opportunities, not owned assets</h1>
          <p style={styles.heroCopy}>
            This page summarizes the active acquisition pipeline currently in the workspace. Once owned-asset tracking is added, this is the natural home for operating performance and refinance monitoring.
          </p>
          <div style={styles.heroActions}>
            <Link href="/" style={styles.primaryLink}>
              Review dashboard
            </Link>
            <Link href="/sold" style={styles.secondaryLink}>
              See retired listings
            </Link>
          </div>
        </div>
        <div style={styles.heroBadge}>
          <BriefcaseBusiness size={22} />
          Pipeline view
        </div>
      </header>

      {!loadingListings && !error && listings.length > 0 && (
        <PipelineActionPlan
          proofItems={pipelineProofItems}
          items={[
            {
              label: "Top CoC lead",
              value:
                bestPipelineListing?.roi?.cashOnCashReturn != null
                  ? `${bestPipelineListing.roi.cashOnCashReturn.toFixed(1)}% CoC`
                  : "No ROI lead",
              detail: bestPipelineListing
                ? `${bestPipelineListing.address} · ${pipelineLeadDetail(bestPipelineListing)}`
                : "The queue needs modeled ROI before it can name a top listing.",
              action: bestPipelineListing ? "Open listing" : "Open dashboard",
              href: bestPipelineListing ? `/listings/${bestPipelineListing.id}` : "/",
              tone: bestPipelineListing ? "green" : "blue",
            },
            {
              label: "Ready queue",
              value: queueStats.readyToUnderwrite.toLocaleString("en-CA"),
              detail: "Positive cashflow, modeled CoC, and no manual lender-review flag.",
              action: "Show ready",
              onClick: () => setPipelineFocus("ready"),
              tone: queueStats.readyToUnderwrite > 0 ? "green" : "slate",
            },
            {
              label: "Lender cleanup",
              value: queueStats.lenderReview.toLocaleString("en-CA"),
              detail: "Broker or lender-path confirmation needed before relying on modeled returns.",
              action: "Show lender flags",
              onClick: () => setPipelineFocus("lender_review"),
              tone: queueStats.lenderReview > 0 ? "amber" : "blue",
            },
            {
              label: "ROI cleanup",
              value: queueStats.missingRoi.toLocaleString("en-CA"),
              detail: "Records missing rent, expense, or debt assumptions cannot be ranked cleanly.",
              action: "Show missing ROI",
              onClick: () => setPipelineFocus("missing_roi"),
              tone: queueStats.missingRoi > 0 ? "red" : "green",
            },
          ]}
        />
      )}

      {!loadingListings && !error && listings.length > 0 && (
        <PipelineReviewPath steps={pipelineReviewSteps} />
      )}

      {!loadingListings && !error && listings.length > 0 && (
        <section style={styles.queuePanel}>
          <div style={styles.queueHeader}>
            <div>
              <p style={styles.eyebrow}>INVESTOR QUEUE</p>
              <h2 style={styles.sectionTitle}>What needs attention first</h2>
              <p style={styles.sectionCopy}>
                Snapshot of the top {queueStats.total} ROI-sorted active listings. This is the fast triage layer before opening individual underwriting files.
              </p>
            </div>
            <Link href="/underwriting" style={styles.queueLink}>
              Confirm capacity
              <ArrowRight size={14} />
            </Link>
          </div>

          <div style={styles.queueGrid}>
            <QueueMetric
              title="Ready to underwrite"
              value={queueStats.readyToUnderwrite.toLocaleString("en-CA")}
              detail="Positive cashflow, modeled CoC, no lender-review flag"
              tone="green"
            />
            <QueueMetric
              title="Positive cashflow"
              value={queueStats.positiveCashflow.toLocaleString("en-CA")}
              detail="Year-one annual cashflow is above zero"
              tone="blue"
            />
            <QueueMetric
              title="Best CoC"
              value={formatPercentValue(queueStats.bestCoc)}
              detail="Highest modeled cash-on-cash return in this queue"
              tone="violet"
            />
            <QueueMetric
              title="Median cash required"
              value={queueStats.medianEquity == null ? "—" : formatCompactCurrency(queueStats.medianEquity)}
              detail="Median equity required across listings with ROI data"
              tone="slate"
            />
          </div>

          <div style={styles.queueFooter}>
            <strong style={{ color: "#0f172a" }}>Next move:</strong>
            <span>{queueAction}</span>
            {queueStats.lenderReview > 0 && <span style={styles.warningPill}>{queueStats.lenderReview} need lender review</span>}
            {queueStats.missingRoi > 0 && <span style={styles.mutedPill}>{queueStats.missingRoi} missing ROI</span>}
          </div>

          <div className="dashboard-review-focus-panel" style={styles.pipelineFocusPanel}>
            <div>
              <p style={styles.pipelineFocusEyebrow}>REVIEW FOCUS</p>
              <h3 style={styles.pipelineFocusTitle}>{activePipelineFocus.title}</h3>
              <p style={styles.pipelineFocusCopy}>{activePipelineFocus.description}</p>
            </div>
            <span style={styles.pipelineFocusBadge}>
              {reviewListings.length.toLocaleString("en-CA")} shown of {activePipelineFocus.count.toLocaleString("en-CA")}
            </span>
          </div>
          <div className="dashboard-review-focus-grid" style={styles.pipelineFocusGrid} aria-label="Pipeline review focus">
            {pipelineFocusOptions.map((option) => {
              const active = option.key === pipelineFocus;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setPipelineFocus(option.key)}
                  aria-pressed={active}
                  style={{
                    ...styles.pipelineFocusButton,
                    ...(active ? styles.pipelineFocusButtonActive : {}),
                  }}
                >
                  <span style={styles.pipelineFocusButtonTop}>
                    <strong>{option.label}</strong>
                    <span style={active ? styles.pipelineFocusCountActive : styles.pipelineFocusCount}>
                      {option.count.toLocaleString("en-CA")}
                    </span>
                  </span>
                  <span style={styles.pipelineFocusButtonCopy}>{option.short}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <div style={styles.sectionHeader}>
          <div>
            <p style={styles.eyebrow}>NEXT REVIEW</p>
            <h2 style={styles.sectionTitle}>{activePipelineFocus.label} tracked opportunities</h2>
            <p style={styles.sectionCopy}>
              {activePipelineFocus.short}. Use these cards as a working queue, not as final investment advice.
            </p>
          </div>
        </div>
        {loadingListings ? (
          <PropertiesPageState mode="loading" onRetry={() => setLoadKey((key) => key + 1)} />
        ) : error ? (
          <PropertiesPageState mode="error" message={error} onRetry={() => setLoadKey((key) => key + 1)} />
        ) : listings.length === 0 ? (
          <PropertiesPageState mode="empty" onRetry={() => setLoadKey((key) => key + 1)} />
        ) : reviewListings.length === 0 ? (
          <PropertiesPageState
            mode="focus_empty"
            focusLabel={activePipelineFocus.label}
            onRetry={() => setLoadKey((key) => key + 1)}
            onResetFocus={() => setPipelineFocus("roi")}
          />
        ) : (
          <div className="dashboard-card-grid" style={styles.cardGrid}>
            {reviewListings.map((listing, index) => (
              <ListingCard key={listing.id} listing={listing} rank={index + 1} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

type PropertiesPageStateMode = "loading" | "error" | "empty" | "focus_empty";

function PropertiesPageState({
  mode,
  message,
  focusLabel,
  onRetry,
  onResetFocus,
}: {
  mode: PropertiesPageStateMode;
  message?: string;
  focusLabel?: string;
  onRetry: () => void;
  onResetFocus?: () => void;
}) {
  const copy: Record<PropertiesPageStateMode, { eyebrow: string; title: string; detail: string; badge: string }> = {
    loading: {
      eyebrow: "Pipeline loading",
      title: "Building the next-review queue",
      detail: "Applying ROI sorting, active-source cleanup, lender flags, and cashflow signals before showing the investor queue.",
      badge: "Reading active listings",
    },
    error: {
      eyebrow: "Pipeline unavailable",
      title: "Could not load tracked opportunities",
      detail: message ?? "The active listing feed did not respond. Retry the feed, then check the dashboard or source workflow if it keeps failing.",
      badge: "Needs refresh",
    },
    empty: {
      eyebrow: "No active pipeline",
      title: "No active tracked opportunities are available",
      detail: "The acquisition queue only shows active, source-backed records. Retired records move to sold, and new captures appear here after the next successful sync.",
      badge: "Queue empty",
    },
    focus_empty: {
      eyebrow: "Review focus empty",
      title: `${focusLabel ?? "This focus"} has no matching opportunities`,
      detail: "Switch back to ROI leaders or refresh the feed. Empty focus states usually mean the listings exist, but this slice has no modeled cashflow, lender, or ROI matches.",
      badge: "Change focus",
    },
  };
  const active = copy[mode];

  return (
    <div className="properties-state-panel" data-testid={`properties-state-${mode}`} style={styles.propertiesStatePanel}>
      <div className="properties-state-grid" style={styles.propertiesStateGrid}>
        <div>
          <p style={styles.pipelineFocusEyebrow}>{active.eyebrow}</p>
          <h3 style={styles.propertiesStateTitle}>{active.title}</h3>
          <p style={styles.propertiesStateCopy}>{active.detail}</p>
          <div className="properties-state-actions" style={styles.propertiesStateActions}>
            {mode === "loading" ? (
              <span style={styles.propertiesStateDisabledAction}>Loading feed...</span>
            ) : (
              <button type="button" onClick={onRetry} style={styles.propertiesStatePrimaryAction}>
                Retry pipeline feed
              </button>
            )}
            {mode === "focus_empty" && onResetFocus ? (
              <button type="button" onClick={onResetFocus} style={styles.propertiesStateSecondaryButton}>
                Show ROI leaders
              </button>
            ) : (
              <Link href="/" style={styles.propertiesStateSecondaryAction}>
                Open dashboard
              </Link>
            )}
            <Link href="/sold" style={styles.propertiesStateSecondaryAction}>
              Review sold page
            </Link>
          </div>
        </div>

        <aside style={styles.propertiesStateAside}>
          <span style={styles.propertiesStateBadge}>{active.badge}</span>
          <PropertiesStateFact label="What appears here" value="Top active listings sorted by modeled CoC ROI" />
          <PropertiesStateFact label="Decision signal" value="Cashflow, CoC, lender review, and missing ROI" />
          <PropertiesStateFact label="Next source check" value="Dashboard queue or nightly capture workflow" />
        </aside>
      </div>
    </div>
  );
}

function PropertiesStateFact({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.propertiesStateFact}>
      <span style={styles.propertiesStateFactLabel}>{label}</span>
      <strong style={styles.propertiesStateFactValue}>{value}</strong>
    </div>
  );
}

function QueueMetric({
  title,
  value,
  detail,
  tone,
}: {
  title: string;
  value: string;
  detail: string;
  tone: "blue" | "green" | "violet" | "slate";
}) {
  const palette = {
    blue: { bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" },
    green: { bg: "#ecfdf3", border: "#bbf7d0", color: "#166534" },
    violet: { bg: "#f5f3ff", border: "#ddd6fe", color: "#6d28d9" },
    slate: { bg: "#f8fafc", border: "#e2e8f0", color: "#334155" },
  }[tone];

  return (
    <div style={{ ...styles.queueMetric, borderColor: palette.border, backgroundColor: palette.bg }}>
      <div style={{ ...styles.queueMetricLabel, color: palette.color }}>{title}</div>
      <div style={styles.queueMetricValue}>{value}</div>
      <div style={styles.queueMetricDetail}>{detail}</div>
    </div>
  );
}

function PipelineActionPlan({
  items,
  proofItems,
}: {
  items: PipelineActionItem[];
  proofItems: PipelineProofItem[];
}) {
  return (
    <section className="properties-action-plan" aria-label="Pipeline action plan" style={styles.pipelineActionPlan}>
      <div className="properties-action-plan-header" style={styles.pipelineActionHeader}>
        <div>
          <p style={styles.pipelineActionEyebrow}>INVESTOR FIRST GLANCE</p>
          <h2 style={styles.pipelineActionTitle}>Cashflow, CoC, and cleanup before the queue</h2>
          <p style={styles.pipelineActionCopy}>
            Start here: open the strongest modeled return, work ready deals, or clear lender and ROI gaps before deeper review.
          </p>
        </div>
        <span style={styles.pipelineActionBadge}>Active queue</span>
      </div>

      <div className="properties-action-proof-grid" style={styles.pipelineActionProofGrid}>
        {proofItems.map((item) => (
          <PipelineProofCard key={item.label} item={item} />
        ))}
      </div>

      <div className="properties-action-plan-grid" style={styles.pipelineActionGrid}>
        {items.map((item) => (
          <PipelineActionCard key={`${item.label}:${item.action}`} item={item} />
        ))}
      </div>
    </section>
  );
}

function PipelineProofCard({ item }: { item: PipelineProofItem }) {
  const palette = {
    blue: { bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" },
    green: { bg: "#ecfdf3", border: "#bbf7d0", color: "#166534" },
    violet: { bg: "#f5f3ff", border: "#ddd6fe", color: "#6d28d9" },
    slate: { bg: "#f8fafc", border: "#e2e8f0", color: "#334155" },
  }[item.tone];

  return (
    <article
      className="properties-action-proof-card"
      style={{
        ...styles.pipelineActionProofCard,
        backgroundColor: palette.bg,
        borderColor: palette.border,
      }}
    >
      <span style={{ ...styles.pipelineActionProofLabel, color: palette.color }}>{item.label}</span>
      <strong style={styles.pipelineActionProofValue}>{item.value}</strong>
      <span style={styles.pipelineActionProofDetail}>{item.detail}</span>
    </article>
  );
}

function PipelineActionCard({ item }: { item: PipelineActionItem }) {
  const palette = pipelineActionPalette(item.tone);
  const actionLabel = `${item.action}: ${item.value}`;
  const content = (
    <>
      <span style={{ ...styles.pipelineActionCardLabel, color: palette.label }}>{item.label}</span>
      <strong style={styles.pipelineActionCardValue}>{item.value}</strong>
      <span style={styles.pipelineActionCardDetail}>{item.detail}</span>
      <span style={{ ...styles.pipelineActionCardCta, color: palette.cta }}>
        {item.action}
        <ArrowRight size={14} />
      </span>
    </>
  );
  const cardStyle = {
    ...styles.pipelineActionCard,
    backgroundColor: palette.bg,
    borderColor: palette.border,
  };

  if (item.href) {
    return (
      <Link href={item.href} aria-label={actionLabel} style={cardStyle}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" aria-label={actionLabel} onClick={item.onClick} style={{ ...cardStyle, ...styles.pipelineActionButton }}>
      {content}
    </button>
  );
}

function PipelineReviewPath({ steps }: { steps: PipelineReviewStep[] }) {
  return (
    <details className="properties-review-path-disclosure" aria-label="Pipeline review path" style={styles.pipelineReviewPath}>
      <summary className="properties-review-path-summary" style={styles.pipelineReviewSummary}>
        <div>
          <p style={styles.pipelineReviewEyebrow}>PIPELINE REVIEW PATH</p>
          <h2 style={styles.pipelineReviewTitle}>Show the 5-step actionability checklist</h2>
          <p style={styles.pipelineReviewCopy}>
            Read left to right: source freshness, modeled ROI, cashflow, lender lane, then the clean underwriting shortlist.
          </p>
        </div>
        <span style={styles.pipelineReviewBadge}>Decision order</span>
      </summary>

      <div className="properties-review-path-grid" style={styles.pipelineReviewGrid}>
        {steps.map((step) => (
          <PipelineReviewStepCard key={`${step.step}:${step.title}`} step={step} />
        ))}
      </div>
    </details>
  );
}

function PipelineReviewStepCard({ step }: { step: PipelineReviewStep }) {
  const palette = pipelineReviewPalette(step.status);
  const actionLabel = `${step.action}: ${step.title}`;
  const action = (
    <span style={{ ...styles.pipelineReviewStepAction, color: palette.action }}>
      {step.action}
      <ArrowRight size={13} />
    </span>
  );

  const content = (
    <>
      <div style={styles.pipelineReviewStepTop}>
        <span style={{ ...styles.pipelineReviewStepNumber, backgroundColor: palette.numberBg, color: palette.number }}>
          {step.step}
        </span>
        <span style={{ ...styles.pipelineReviewStatus, backgroundColor: palette.badgeBg, color: palette.badge }}>
          {pipelineReviewStatusLabel(step.status)}
        </span>
      </div>
      <div>
        <p style={styles.pipelineReviewStepTitle}>{step.title}</p>
        <strong style={styles.pipelineReviewStepValue}>{step.value}</strong>
        <p style={styles.pipelineReviewStepDetail}>{step.detail}</p>
      </div>
      {action}
    </>
  );
  const cardStyle = {
    ...styles.pipelineReviewStep,
    borderColor: palette.border,
    backgroundColor: palette.bg,
  };

  if (step.href) {
    return (
      <Link href={step.href} aria-label={actionLabel} style={cardStyle}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" aria-label={actionLabel} onClick={step.onClick} style={{ ...cardStyle, ...styles.pipelineReviewStepButton }}>
      {content}
    </button>
  );
}

function buildPipelineFocusOptions(listings: Listing[], stats: PipelineQueueStats): PipelineFocusOption[] {
  const modeledRoiCount = listings.filter((listing) => isFiniteNumber(listing.roi?.cashOnCashReturn)).length;

  return [
    {
      key: "roi",
      label: "ROI leaders",
      title: "Highest modeled cash-on-cash return",
      count: modeledRoiCount,
      short: "Known CoC, strongest first",
      description: "Start here when you want the fastest investor review queue from listings that already have return assumptions.",
    },
    {
      key: "ready",
      label: "Ready",
      title: "Ready-to-underwrite deals",
      count: stats.readyToUnderwrite,
      short: "Positive CF, modeled CoC, no lender flag",
      description: "These deals clear the first-pass cashflow and lender-screen checks, so they deserve the first underwriting file review.",
    },
    {
      key: "positive_cashflow",
      label: "Positive CF",
      title: "Positive-cashflow pipeline",
      count: stats.positiveCashflow,
      short: "Year-one cashflow above zero",
      description: "Use this view when carry is the first decision rule before score, source mix, or appreciation upside.",
    },
    {
      key: "lender_review",
      label: "Lender review",
      title: "Financing-path cleanup",
      count: stats.lenderReview,
      short: "Manual lender review flagged",
      description: "These records need broker or lender-path confirmation before their modeled return should drive a decision.",
    },
    {
      key: "missing_roi",
      label: "Missing ROI",
      title: "Assumption cleanup queue",
      count: stats.missingRoi,
      short: "Needs rent/debt assumptions",
      description: "Use this to find records that cannot be compared yet because the model is missing return inputs.",
    },
  ];
}

function selectPipelineFocusListings(listings: Listing[], focus: PipelineFocus): Listing[] {
  if (focus === "ready") {
    return listings
      .filter(
        (listing) =>
          isFiniteNumber(listing.roi?.cashOnCashReturn) &&
          isFiniteNumber(listing.roi?.annualCashflow) &&
          (listing.roi?.annualCashflow ?? 0) > 0 &&
          !listing.underwriting?.manualLenderReview
      )
      .sort(sortByRoiThenCashflow);
  }

  if (focus === "positive_cashflow") {
    return listings
      .filter((listing) => isFiniteNumber(listing.roi?.annualCashflow) && (listing.roi?.annualCashflow ?? 0) > 0)
      .sort(sortByRoiThenCashflow);
  }

  if (focus === "lender_review") {
    return listings
      .filter((listing) => listing.underwriting?.manualLenderReview)
      .sort(sortByRoiThenCashflow);
  }

  if (focus === "missing_roi") {
    return listings
      .filter((listing) => !isFiniteNumber(listing.roi?.cashOnCashReturn))
      .sort(sortByScoreThenNewest);
  }

  return listings
    .filter((listing) => isFiniteNumber(listing.roi?.cashOnCashReturn))
    .sort(sortByRoiThenCashflow);
}

function sortByRoiThenCashflow(a: Listing, b: Listing): number {
  const roiDelta = finiteValue(b.roi?.cashOnCashReturn) - finiteValue(a.roi?.cashOnCashReturn);
  if (roiDelta !== 0) return roiDelta;
  return finiteValue(b.roi?.annualCashflow) - finiteValue(a.roi?.annualCashflow);
}

function sortByScoreThenNewest(a: Listing, b: Listing): number {
  const scoreDelta = finiteValue(b.evaluation?.combinedScore) - finiteValue(a.evaluation?.combinedScore);
  if (scoreDelta !== 0) return scoreDelta;
  return dateValue(b.lastSyncRunAt ?? b.lastSeenAt ?? b.createdAt) - dateValue(a.lastSyncRunAt ?? a.lastSeenAt ?? a.createdAt);
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function finiteValue(value: number | null | undefined): number {
  return isFiniteNumber(value) ? value : Number.NEGATIVE_INFINITY;
}

function dateValue(value?: string | null): number {
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
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

function formatPercentValue(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1)}%`;
}

function pipelineLeadDetail(listing: Listing): string {
  const coc =
    listing.roi?.cashOnCashReturn != null
      ? `${formatPercentValue(listing.roi.cashOnCashReturn)} CoC`
      : "CoC n/a";
  const yearOneCashflow = listing.roi ? `${formatCurrency(listing.roi.annualCashflow)} Y1 CF` : "Y1 CF n/a";
  const threeYear = `${formatOptionalCurrency(threeYearCashflow(listing))} 3Y CF`;
  const roiValue = `${formatOptionalCurrency(listing.roi?.totalYearOneReturn)} ROI value`;
  return `${formatCurrency(listing.price)} ask · ${coc} · ${yearOneCashflow} · ${threeYear} · ${roiValue}`;
}

function threeYearCashflow(listing: Listing): number | null {
  if (!listing.roi) return null;
  const years = listing.roi.cashflowYears?.slice(0, 3) ?? [];
  if (years.length > 0) {
    return years.reduce((sum, year) => sum + year.annualCashflow, 0);
  }
  return listing.roi.annualCashflow * 3;
}

function formatOptionalCurrency(value?: number | null): string {
  return value == null || !Number.isFinite(value) ? "n/a" : formatCurrency(value);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function pipelineActionPalette(tone: PipelineActionTone) {
  return {
    green: { bg: "#ecfdf3", border: "#bbf7d0", label: "#166534", cta: "#166534" },
    blue: { bg: "#eff6ff", border: "#bfdbfe", label: "#1d4ed8", cta: "#1d4ed8" },
    amber: { bg: "#fffbeb", border: "#fde68a", label: "#b45309", cta: "#b45309" },
    red: { bg: "#fef2f2", border: "#fecaca", label: "#b91c1c", cta: "#b91c1c" },
    slate: { bg: "#f8fafc", border: "#e2e8f0", label: "#475569", cta: "#334155" },
  }[tone];
}

function pipelineReviewPalette(status: PipelineReviewStatus) {
  return {
    ready: {
      bg: "#ecfdf3",
      border: "#bbf7d0",
      numberBg: "#dcfce7",
      number: "#166534",
      badgeBg: "#dcfce7",
      badge: "#166534",
      action: "#166534",
    },
    watch: {
      bg: "#fffbeb",
      border: "#fde68a",
      numberBg: "#fef3c7",
      number: "#92400e",
      badgeBg: "#fef3c7",
      badge: "#92400e",
      action: "#b45309",
    },
    blocked: {
      bg: "#f8fafc",
      border: "#e2e8f0",
      numberBg: "#e2e8f0",
      number: "#334155",
      badgeBg: "#e2e8f0",
      badge: "#334155",
      action: "#334155",
    },
  }[status];
}

function pipelineReviewStatusLabel(status: PipelineReviewStatus): string {
  if (status === "ready") return "Ready";
  if (status === "watch") return "Check";
  return "Blocked";
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[midpoint];
  return (sorted[midpoint - 1] + sorted[midpoint]) / 2;
}

function getQueueAction(stats: {
  readyToUnderwrite: number;
  lenderReview: number;
  missingRoi: number;
  positiveCashflow: number;
}): string {
  if (stats.readyToUnderwrite > 0) {
    return "Open the ready deals first; they already clear the first-pass cashflow and lender-screen checks.";
  }
  if (stats.positiveCashflow > 0) {
    return "Review the positive-cashflow deals next, then resolve any lender or missing-data flags before offer-level work.";
  }
  if (stats.lenderReview > 0) {
    return "Start in underwriting; lender-path uncertainty is the bottleneck before these can be ranked cleanly.";
  }
  if (stats.missingRoi > 0) {
    return "Fill the missing rent, expense, and debt assumptions so the platform can compute comparable ROI.";
  }
  return "No immediate action is available until more active listings are captured.";
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
  pipelineActionPlan: {
    marginBottom: 18,
    borderRadius: 16,
    border: "1px solid #dbeafe",
    background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
    padding: 18,
    boxShadow: "0 16px 36px rgba(15,23,42,0.08)",
  },
  pipelineActionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
    flexWrap: "wrap",
    marginBottom: 14,
  },
  pipelineActionEyebrow: {
    margin: 0,
    color: "#2563eb",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.12em",
  },
  pipelineActionTitle: {
    margin: "5px 0 0",
    color: "#0f172a",
    fontSize: 22,
    lineHeight: 1.18,
  },
  pipelineActionCopy: {
    margin: "6px 0 0",
    maxWidth: 850,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.55,
  },
  pipelineActionBadge: {
    borderRadius: 999,
    border: "1px solid #bfdbfe",
    backgroundColor: "#eff6ff",
    color: "#1d4ed8",
    padding: "7px 10px",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  pipelineActionProofGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 9,
    marginBottom: 10,
  },
  pipelineActionProofCard: {
    minWidth: 0,
    borderRadius: 11,
    borderWidth: 1,
    borderStyle: "solid",
    padding: 11,
    display: "grid",
    gap: 5,
  },
  pipelineActionProofLabel: {
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  pipelineActionProofValue: {
    color: "#0f172a",
    fontSize: 19,
    lineHeight: 1.1,
    overflowWrap: "anywhere",
  },
  pipelineActionProofDetail: {
    color: "#475569",
    fontSize: 11,
    lineHeight: 1.35,
  },
  pipelineActionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: 12,
  },
  pipelineActionCard: {
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
  pipelineActionButton: {
    width: "100%",
    appearance: "none",
    textAlign: "left",
    cursor: "pointer",
  },
  pipelineActionCardLabel: {
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  pipelineActionCardValue: {
    color: "#0f172a",
    fontSize: 18,
    lineHeight: 1.22,
    overflowWrap: "anywhere",
  },
  pipelineActionCardDetail: {
    color: "#475569",
    fontSize: 12,
    lineHeight: 1.45,
  },
  pipelineActionCardCta: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    marginTop: "auto",
    fontSize: 12,
    fontWeight: 900,
  },
  pipelineReviewPath: {
    marginBottom: 18,
    borderRadius: 16,
    border: "1px solid #e2e8f0",
    backgroundColor: "#fff",
    padding: 18,
    boxShadow: "0 10px 28px rgba(15,23,42,0.07)",
  },
  pipelineReviewHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
    flexWrap: "wrap",
    marginBottom: 14,
  },
  pipelineReviewSummary: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
    flexWrap: "wrap",
    cursor: "pointer",
    listStyle: "none",
  },
  pipelineReviewEyebrow: {
    margin: 0,
    color: "#475569",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.12em",
  },
  pipelineReviewTitle: {
    margin: "5px 0 0",
    color: "#0f172a",
    fontSize: 21,
    lineHeight: 1.18,
  },
  pipelineReviewCopy: {
    margin: "6px 0 0",
    maxWidth: 830,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.55,
  },
  pipelineReviewBadge: {
    borderRadius: 999,
    border: "1px solid #e2e8f0",
    backgroundColor: "#f8fafc",
    color: "#334155",
    padding: "7px 10px",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  pipelineReviewGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: 10,
  },
  pipelineReviewStep: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    minWidth: 0,
    minHeight: 190,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "solid",
    padding: 14,
    color: "#0f172a",
    textDecoration: "none",
  },
  pipelineReviewStepButton: {
    width: "100%",
    appearance: "none",
    textAlign: "left",
    cursor: "pointer",
  },
  pipelineReviewStepTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  pipelineReviewStepNumber: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 34,
    height: 34,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 950,
  },
  pipelineReviewStatus: {
    borderRadius: 999,
    padding: "5px 8px",
    fontSize: 11,
    fontWeight: 900,
  },
  pipelineReviewStepTitle: {
    margin: 0,
    color: "#475569",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  pipelineReviewStepValue: {
    display: "block",
    marginTop: 6,
    color: "#0f172a",
    fontSize: 20,
    lineHeight: 1.14,
    overflowWrap: "anywhere",
  },
  pipelineReviewStepDetail: {
    margin: "7px 0 0",
    color: "#475569",
    fontSize: 12,
    lineHeight: 1.45,
  },
  pipelineReviewStepAction: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    marginTop: "auto",
    fontSize: 12,
    fontWeight: 900,
  },
  queuePanel: {
    borderRadius: 14,
    border: "1px solid #dbeafe",
    background: "linear-gradient(135deg, #ffffff 0%, #f8fbff 100%)",
    boxShadow: "0 14px 36px rgba(15, 23, 42, 0.08)",
    padding: 18,
    marginBottom: 22,
  },
  queueHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 14,
  },
  queueLink: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    border: "1px solid #bfdbfe",
    backgroundColor: "#eff6ff",
    color: "#1d4ed8",
    padding: "9px 12px",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 850,
    whiteSpace: "nowrap",
  },
  queueGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: 10,
  },
  queueMetric: {
    minWidth: 0,
    borderRadius: 12,
    border: "1px solid",
    padding: 14,
  },
  queueMetricLabel: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  queueMetricValue: {
    marginTop: 7,
    color: "#0f172a",
    fontSize: 24,
    lineHeight: 1.1,
    fontWeight: 900,
    overflowWrap: "anywhere",
  },
  queueMetricDetail: {
    marginTop: 6,
    color: "#475569",
    fontSize: 12,
    lineHeight: 1.45,
  },
  queueFooter: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 14,
    borderTop: "1px solid #e2e8f0",
    paddingTop: 12,
    color: "#475569",
    fontSize: 13,
    lineHeight: 1.45,
  },
  pipelineFocusPanel: {
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#bfdbfe",
    backgroundColor: "rgba(255,255,255,0.74)",
    padding: 14,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
    flexWrap: "wrap",
  },
  pipelineFocusEyebrow: {
    margin: 0,
    color: "#2563eb",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.1em",
  },
  pipelineFocusTitle: {
    margin: "5px 0 0",
    color: "#0f172a",
    fontSize: 17,
    lineHeight: 1.25,
  },
  pipelineFocusCopy: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.45,
    maxWidth: 820,
  },
  pipelineFocusBadge: {
    borderRadius: 999,
    border: "1px solid #bfdbfe",
    backgroundColor: "#fff",
    color: "#1d4ed8",
    padding: "7px 10px",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  pipelineFocusGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 10,
    marginTop: 12,
  },
  pipelineFocusButton: {
    display: "grid",
    gap: 7,
    minWidth: 0,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#bfdbfe",
    backgroundColor: "#fff",
    color: "#0f172a",
    padding: 12,
    textAlign: "left",
    cursor: "pointer",
  },
  pipelineFocusButtonActive: {
    borderColor: "#2563eb",
    backgroundColor: "#dbeafe",
    boxShadow: "0 10px 22px rgba(37,99,235,0.13)",
  },
  pipelineFocusButtonTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    fontSize: 13,
  },
  pipelineFocusCount: {
    borderRadius: 999,
    border: "1px solid #dbeafe",
    backgroundColor: "#eff6ff",
    color: "#1d4ed8",
    padding: "3px 7px",
    fontSize: 11,
    fontWeight: 900,
  },
  pipelineFocusCountActive: {
    borderRadius: 999,
    backgroundColor: "#2563eb",
    color: "#fff",
    padding: "4px 8px",
    fontSize: 11,
    fontWeight: 900,
  },
  pipelineFocusButtonCopy: {
    color: "#64748b",
    fontSize: 11,
    lineHeight: 1.35,
  },
  warningPill: {
    display: "inline-flex",
    borderRadius: 999,
    backgroundColor: "#fff7ed",
    color: "#9a3412",
    border: "1px solid #fed7aa",
    padding: "4px 8px",
    fontSize: 12,
    fontWeight: 800,
  },
  mutedPill: {
    display: "inline-flex",
    borderRadius: 999,
    backgroundColor: "#f8fafc",
    color: "#475569",
    border: "1px solid #e2e8f0",
    padding: "4px 8px",
    fontSize: 12,
    fontWeight: 800,
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
    marginBottom: 14,
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
  stateCard: {
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    backgroundColor: "#fff",
    padding: 24,
    color: "#64748b",
  },
  propertiesStatePanel: {
    borderRadius: 14,
    border: "1px solid #dbeafe",
    background: "linear-gradient(135deg, #ffffff 0%, #eff6ff 58%, #f8fafc 100%)",
    boxShadow: "0 14px 36px rgba(15, 23, 42, 0.08)",
    padding: 18,
  },
  propertiesStateGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.5fr) minmax(260px, 0.7fr)",
    gap: 16,
    alignItems: "stretch",
  },
  propertiesStateTitle: {
    margin: "6px 0 0",
    color: "#0f172a",
    fontSize: 22,
    lineHeight: 1.2,
  },
  propertiesStateCopy: {
    margin: "8px 0 0",
    color: "#475569",
    fontSize: 14,
    lineHeight: 1.65,
    maxWidth: 820,
  },
  propertiesStateActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 16,
  },
  propertiesStatePrimaryAction: {
    border: 0,
    borderRadius: 8,
    backgroundColor: "#2563eb",
    color: "#fff",
    padding: "10px 13px",
    fontSize: 13,
    fontWeight: 850,
    cursor: "pointer",
  },
  propertiesStateSecondaryAction: {
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
  propertiesStateSecondaryButton: {
    borderRadius: 8,
    backgroundColor: "#fff",
    border: "1px solid #bfdbfe",
    color: "#1d4ed8",
    padding: "10px 13px",
    fontSize: 13,
    fontWeight: 850,
    cursor: "pointer",
  },
  propertiesStateDisabledAction: {
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
  propertiesStateAside: {
    borderRadius: 12,
    border: "1px solid #bfdbfe",
    backgroundColor: "rgba(255,255,255,0.76)",
    padding: 14,
    display: "grid",
    gap: 10,
  },
  propertiesStateBadge: {
    justifySelf: "start",
    borderRadius: 999,
    backgroundColor: "#dbeafe",
    color: "#1d4ed8",
    padding: "6px 9px",
    fontSize: 11,
    fontWeight: 900,
  },
  propertiesStateFact: {
    borderTop: "1px solid #dbeafe",
    paddingTop: 10,
  },
  propertiesStateFactLabel: {
    display: "block",
    color: "#64748b",
    fontSize: 11,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  propertiesStateFactValue: {
    display: "block",
    marginTop: 4,
    color: "#0f172a",
    fontSize: 13,
    lineHeight: 1.4,
  },
  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
    gap: 20,
  },
};
