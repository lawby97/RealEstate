"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowRight,
  BarChart3,
  Building2,
  Database,
  MapPinned,
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

type CountRow = { label: string; count: number; share: number };

type MarketFocus = "roi" | "positive_cashflow" | "multifamily" | "missing_roi" | "high_score";

type MarketFocusOption = {
  key: MarketFocus;
  label: string;
  title: string;
  count: number;
  short: string;
  description: string;
};

const PRICE_BANDS = [
  { label: "Under $500k", min: 0, max: 500_000 },
  { label: "$500k-$800k", min: 500_000, max: 800_000 },
  { label: "$800k-$1.2M", min: 800_000, max: 1_200_000 },
  { label: "$1.2M+", min: 1_200_000, max: Number.POSITIVE_INFINITY },
];

export default function MarketPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [marketFocus, setMarketFocus] = useState<MarketFocus>("roi");
  const [loadKey, setLoadKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      limit: "100",
      sort: "roi_desc",
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
        setError(err instanceof Error ? err.message : "Could not load market data.");
        setListings([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [loadKey]);

  const analysis = useMemo(() => buildMarketAnalysis(listings, total), [listings, total]);
  const marketFocusOptions = useMemo(() => buildMarketFocusOptions(listings), [listings]);
  const activeMarketFocus = marketFocusOptions.find((option) => option.key === marketFocus) ?? marketFocusOptions[0];
  const focusedListings = useMemo(() => selectMarketFocusListings(listings, marketFocus).slice(0, 6), [listings, marketFocus]);

  return (
    <div className="dashboard-page" style={styles.page}>
      <header className="dashboard-hero" style={styles.hero}>
        <div>
          <p style={styles.eyebrow}>MARKET ANALYSIS</p>
          <h1 style={styles.title}>Active inventory signal, not just a list</h1>
          <p style={styles.heroCopy}>
            This page summarizes the active feed so you can see where the opportunity set is concentrated before opening individual deals.
          </p>
          <div style={styles.heroActions}>
            <Link href="/" style={styles.primaryLink}>
              Open dashboard
            </Link>
            <Link href="/underwriting" style={styles.secondaryLink}>
              Edit underwriting profile
            </Link>
          </div>
        </div>
        <div style={styles.captureCard}>
          <Database size={22} />
          <span>{analysis.latestCapture ?? "Capture timestamp pending"}</span>
        </div>
      </header>

      {loading ? (
        <MarketPageState mode="loading" onRetry={() => setLoadKey((key) => key + 1)} />
      ) : error ? (
        <MarketPageState mode="error" message={error} onRetry={() => setLoadKey((key) => key + 1)} />
      ) : listings.length === 0 ? (
        <MarketPageState mode="empty" onRetry={() => setLoadKey((key) => key + 1)} />
      ) : (
        <>
          <section className="market-action-panel" style={styles.marketActionPanel} aria-label="Market investor first glance">
            <div className="market-action-lead" style={styles.marketActionLead}>
              <p style={styles.marketActionEyebrow}>INVESTOR FIRST GLANCE</p>
              <h2 style={styles.marketActionTitle}>Cashflow, CoC, and ROI before market charts</h2>
              <p style={styles.marketActionCopy}>
                Start with the strongest modeled return, then use the other queues to separate live opportunities from underwriting cleanup.
              </p>
            </div>
            <div className="market-action-grid" style={styles.marketActionGrid}>
              <MarketActionCard
                label="Top CoC lead"
                value={
                  analysis.bestListing?.roi?.cashOnCashReturn != null
                    ? `${analysis.bestListing.roi.cashOnCashReturn.toFixed(1)}% CoC`
                    : "No ROI lead yet"
                }
                detail={
                  analysis.bestListing
                    ? `${analysis.bestListing.address} · ${listingLeadDetail(analysis.bestListing)}`
                    : "The feed needs ROI inputs before it can name a top deal."
                }
                action="Open top deal"
                href={analysis.bestListing ? `/listings/${analysis.bestListing.id}` : "/"}
                tone="blue"
              />
              <MarketActionCard
                label="Cashflow coverage"
                value={`${analysis.positiveCashflowCount.toLocaleString("en-CA")}/${analysis.activeCount.toLocaleString("en-CA")}`}
                detail={`${Math.round(analysis.positiveCashflowShare)}% of loaded listings model positive annual cashflow.`}
                action="Show positive CF"
                onClick={() => setMarketFocus("positive_cashflow")}
                tone="green"
              />
              <MarketActionCard
                label="5+ unit burden"
                value={analysis.fivePlusCount.toLocaleString("en-CA")}
                detail={`${Math.round(analysis.fivePlusShare)}% may need lender-exception, CMHC, or commercial-path review.`}
                action="Review 5+ units"
                onClick={() => setMarketFocus("multifamily")}
                tone="amber"
              />
              <MarketActionCard
                label="ROI cleanup"
                value={analysis.unknownRoiCount.toLocaleString("en-CA")}
                detail={
                  analysis.unknownRoiCount > 0
                    ? `${analysis.modeledRoiCount.toLocaleString("en-CA")} modeled, ${analysis.unknownRoiCount.toLocaleString("en-CA")} missing rent/debt assumptions.`
                    : "Every loaded listing has modeled CoC data."
                }
                action={analysis.unknownRoiCount > 0 ? "Show missing ROI" : "ROI queue"}
                onClick={() => setMarketFocus(analysis.unknownRoiCount > 0 ? "missing_roi" : "roi")}
                tone={analysis.unknownRoiCount > 0 ? "red" : "green"}
              />
            </div>
          </section>

          <MarketCommandPanel
            analysis={analysis}
            onShowPositiveCashflow={() => setMarketFocus("positive_cashflow")}
            onShowMissingRoi={() => setMarketFocus("missing_roi")}
            onShowMultifamily={() => setMarketFocus("multifamily")}
          />

          <section style={styles.panelGrid}>
            <MarketPanel title="Price bands" subtitle="Where asking prices cluster in the active feed." icon={<BarChart3 size={18} />}>
              {analysis.priceBands.map((row) => (
                <DistributionRow key={row.label} row={row} />
              ))}
            </MarketPanel>
            <MarketPanel title="Unit mix" subtitle="How much of the feed is true multifamily." icon={<Building2 size={18} />}>
              {analysis.unitMix.map((row) => (
                <DistributionRow key={row.label} row={row} />
              ))}
            </MarketPanel>
            <MarketPanel title="Source mix" subtitle="Useful when checking gaps between Centris and REALTOR.ca." icon={<Database size={18} />}>
              {analysis.sourceMix.map((row) => (
                <DistributionRow key={row.label} row={row} />
              ))}
            </MarketPanel>
          </section>

          <section className="dashboard-review-focus-panel" style={styles.marketFocusPanel}>
            <div style={styles.marketFocusHeader}>
              <div>
                <p style={styles.marketFocusEyebrow}>QUEUE FOCUS</p>
                <h2 style={styles.marketFocusTitle}>{activeMarketFocus.title}</h2>
                <p style={styles.marketFocusCopy}>{activeMarketFocus.description}</p>
              </div>
              <span style={styles.marketFocusBadge}>
                {focusedListings.length.toLocaleString("en-CA")} shown of {activeMarketFocus.count.toLocaleString("en-CA")}
              </span>
            </div>
            <div className="dashboard-review-focus-grid" style={styles.marketFocusGrid} aria-label="Market opportunity focus">
              {marketFocusOptions.map((option) => {
                const active = option.key === marketFocus;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setMarketFocus(option.key)}
                    aria-pressed={active}
                    style={{
                      ...styles.marketFocusButton,
                      ...(active ? styles.marketFocusButtonActive : {}),
                    }}
                  >
                    <span style={styles.marketFocusButtonTop}>
                      <strong>{option.label}</strong>
                      <span style={active ? styles.marketFocusCountActive : styles.marketFocusCount}>
                        {option.count.toLocaleString("en-CA")}
                      </span>
                    </span>
                    <span style={styles.marketFocusButtonCopy}>{option.short}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section style={styles.opportunityHeader}>
            <div>
              <p style={styles.eyebrow}>UNDERWRITING QUEUE</p>
              <h2 style={styles.sectionTitle}>{activeMarketFocus.label} opportunities</h2>
              <p style={styles.sectionCopy}>
                {activeMarketFocus.short}. Cards are still screening leads, not final recommendations.
              </p>
            </div>
            <MapPinned size={24} color="#2563eb" />
          </section>

          {focusedListings.length > 0 ? (
            <div className="dashboard-card-grid" style={styles.cardGrid}>
              {focusedListings.map((listing, index) => (
                <ListingCard key={listing.id} listing={listing} rank={index + 1} />
              ))}
            </div>
          ) : (
            <div style={styles.emptyFocusCard}>
              No listings match this market focus yet. Try another focus or refresh the active feed.
            </div>
          )}
        </>
      )}
    </div>
  );
}

function buildMarketAnalysis(listings: Listing[], total: number) {
  const prices = listings.map((listing) => listing.price).filter((price) => Number.isFinite(price)).sort((a, b) => a - b);
  const roiValues = listings
    .map((listing) => listing.roi?.cashOnCashReturn)
    .filter((value): value is number => value != null && Number.isFinite(value));
  const latestCapture = listings
    .map((listing) => listing.lastSyncRunAt ?? listing.lastSeenAt ?? listing.createdAt)
    .filter(Boolean)
    .map((value) => new Date(value as string).getTime())
    .filter(Number.isFinite)
    .sort((a, b) => b - a)[0];

  const priceBands = PRICE_BANDS.map((band) => {
    const count = listings.filter((listing) => listing.price >= band.min && listing.price < band.max).length;
    return toCountRow(band.label, count, listings.length);
  });
  const positiveCashflowCount = listings.filter((listing) => (listing.roi?.annualCashflow ?? Number.NEGATIVE_INFINITY) > 0).length;
  const modeledRoiCount = roiValues.length;
  const unknownRoiCount = listings.length - modeledRoiCount;
  const unitMix = [
    toCountRow("1 unit", listings.filter((listing) => listing.units === 1).length, listings.length),
    toCountRow("2-4 units", listings.filter((listing) => listing.units >= 2 && listing.units <= 4).length, listings.length),
    toCountRow("5+ units", listings.filter((listing) => listing.units >= 5).length, listings.length),
  ];
  const sourceMix = Object.entries(
    listings.reduce<Record<string, number>>((counts, listing) => {
      const label = sourceName(listing.source);
      counts[label] = (counts[label] ?? 0) + 1;
      return counts;
    }, {})
  )
    .map(([label, count]) => toCountRow(label, count, listings.length))
    .sort((a, b) => b.count - a.count);
  const topRoiListings = listings
    .filter((listing) => listing.roi?.cashOnCashReturn != null)
    .slice(0, 6);
  const fivePlusRow = unitMix.find((row) => row.label === "5+ units");

  return {
    activeCount: listings.length,
    total,
    medianPrice: median(prices),
    avgPrice: prices.length ? prices.reduce((sum, price) => sum + price, 0) / prices.length : 0,
    avgRoi: roiValues.length ? roiValues.reduce((sum, value) => sum + value, 0) / roiValues.length : null,
    positiveCashflowCount,
    positiveCashflowShare: listings.length > 0 ? (positiveCashflowCount / listings.length) * 100 : 0,
    modeledRoiCount,
    unknownRoiCount,
    highScoreCount: listings.filter((listing) => (listing.evaluation?.combinedScore ?? 0) >= 80).length,
    latestCapture: latestCapture ? `Latest capture ${formatDateTime(new Date(latestCapture).toISOString())}` : null,
    priceBands,
    dominantPriceBand: priceBands.slice().sort((a, b) => b.count - a.count)[0] ?? null,
    unitMix,
    fivePlusCount: fivePlusRow?.count ?? 0,
    fivePlusShare: fivePlusRow?.share ?? 0,
    sourceMix,
    topRoiListings,
    bestListing: topRoiListings[0] ?? null,
  };
}

function buildMarketFocusOptions(listings: Listing[]): MarketFocusOption[] {
  const roiCount = listings.filter((listing) => listing.roi?.cashOnCashReturn != null && Number.isFinite(listing.roi.cashOnCashReturn)).length;
  const positiveCashflowCount = listings.filter((listing) => (listing.roi?.annualCashflow ?? Number.NEGATIVE_INFINITY) > 0).length;
  const multifamilyCount = listings.filter((listing) => listing.units >= 5).length;
  const missingRoiCount = listings.filter((listing) => listing.roi?.cashOnCashReturn == null || !Number.isFinite(listing.roi.cashOnCashReturn)).length;
  const highScoreCount = listings.filter((listing) => (listing.evaluation?.combinedScore ?? 0) >= 80).length;

  return [
    {
      key: "roi",
      label: "ROI leaders",
      title: "Highest modeled cash-on-cash return",
      count: roiCount,
      short: "Known CoC, strongest first",
      description: "Start here when you want the fastest investor read from listings that already have return assumptions.",
    },
    {
      key: "positive_cashflow",
      label: "Positive CF",
      title: "Deals that model positive annual cashflow",
      count: positiveCashflowCount,
      short: "Cashflow-positive only",
      description: "Use this focus when carry matters more than score, source count, or long-term upside.",
    },
    {
      key: "multifamily",
      label: "5+ unit review",
      title: "Multifamily and lender-exception review",
      count: multifamilyCount,
      short: "5+ units, lender path first",
      description: "These listings are more likely to need commercial, CMHC, or written personal-lane exception review.",
    },
    {
      key: "missing_roi",
      label: "Missing ROI",
      title: "Listings that need assumptions before ranking",
      count: missingRoiCount,
      short: "Cleanup queue for rent/debt inputs",
      description: "Use this to find source-backed records that still need rent, expense, or debt assumptions before they can be compared.",
    },
    {
      key: "high_score",
      label: "High score",
      title: "Model score leaders",
      count: highScoreCount,
      short: "Score 80+, then ROI",
      description: "This is useful when you want to inspect broader deal quality before leaning on the cash-on-cash sort.",
    },
  ];
}

function selectMarketFocusListings(listings: Listing[], focus: MarketFocus): Listing[] {
  if (focus === "positive_cashflow") {
    return listings
      .filter((listing) => (listing.roi?.annualCashflow ?? Number.NEGATIVE_INFINITY) > 0)
      .sort(sortByRoiThenCashflow);
  }

  if (focus === "multifamily") {
    return listings
      .filter((listing) => listing.units >= 5)
      .sort(sortByRoiThenScore);
  }

  if (focus === "missing_roi") {
    return listings
      .filter((listing) => listing.roi?.cashOnCashReturn == null || !Number.isFinite(listing.roi.cashOnCashReturn))
      .sort(sortByScoreThenNewest);
  }

  if (focus === "high_score") {
    return listings
      .filter((listing) => (listing.evaluation?.combinedScore ?? 0) >= 80)
      .sort(sortByScoreThenRoi);
  }

  return listings
    .filter((listing) => listing.roi?.cashOnCashReturn != null && Number.isFinite(listing.roi.cashOnCashReturn))
    .sort(sortByRoiThenCashflow);
}

function sortByRoiThenCashflow(a: Listing, b: Listing): number {
  const roiDelta = finiteValue(b.roi?.cashOnCashReturn) - finiteValue(a.roi?.cashOnCashReturn);
  if (roiDelta !== 0) return roiDelta;
  return finiteValue(b.roi?.annualCashflow) - finiteValue(a.roi?.annualCashflow);
}

function sortByRoiThenScore(a: Listing, b: Listing): number {
  const roiDelta = finiteValue(b.roi?.cashOnCashReturn) - finiteValue(a.roi?.cashOnCashReturn);
  if (roiDelta !== 0) return roiDelta;
  return finiteValue(b.evaluation?.combinedScore) - finiteValue(a.evaluation?.combinedScore);
}

function sortByScoreThenRoi(a: Listing, b: Listing): number {
  const scoreDelta = finiteValue(b.evaluation?.combinedScore) - finiteValue(a.evaluation?.combinedScore);
  if (scoreDelta !== 0) return scoreDelta;
  return finiteValue(b.roi?.cashOnCashReturn) - finiteValue(a.roi?.cashOnCashReturn);
}

function sortByScoreThenNewest(a: Listing, b: Listing): number {
  const scoreDelta = finiteValue(b.evaluation?.combinedScore) - finiteValue(a.evaluation?.combinedScore);
  if (scoreDelta !== 0) return scoreDelta;
  return dateValue(b.lastSyncRunAt ?? b.lastSeenAt ?? b.createdAt) - dateValue(a.lastSyncRunAt ?? a.lastSeenAt ?? a.createdAt);
}

function MarketActionCard({
  label,
  value,
  detail,
  action,
  href,
  onClick,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  action: string;
  href?: string;
  onClick?: () => void;
  tone: "blue" | "green" | "amber" | "red";
}) {
  const palette = marketActionPalette(tone);
  const content = (
    <>
      <span style={{ ...styles.marketActionCardLabel, color: palette.label }}>{label}</span>
      <strong style={styles.marketActionCardValue}>{value}</strong>
      <span style={styles.marketActionCardDetail}>{detail}</span>
      <span style={{ ...styles.marketActionCardCta, color: palette.cta }}>
        {action}
        <ArrowRight size={14} />
      </span>
    </>
  );
  const cardStyle = {
    ...styles.marketActionCard,
    backgroundColor: palette.bg,
    borderColor: palette.border,
  };

  if (href) {
    return (
      <Link href={href} aria-label={`${action}: ${label}`} style={cardStyle}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" aria-label={`${action}: ${label}`} onClick={onClick} style={{ ...cardStyle, ...styles.marketActionButton }}>
      {content}
    </button>
  );
}

function finiteValue(value: number | null | undefined): number {
  return value != null && Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
}

function dateValue(value?: string | null): number {
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function MarketBriefCard({
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
    <Link href={href} aria-label={`${action}: ${label}`} style={styles.marketBriefCard}>
      <span style={styles.marketBriefCardLabel}>{label}</span>
      <strong style={styles.marketBriefCardValue}>{value}</strong>
      <span style={styles.marketBriefCardDetail}>{detail}</span>
      <span style={styles.marketBriefAction}>
        {action}
        <ArrowRight size={14} />
      </span>
    </Link>
  );
}

function MarketCommandPanel({
  analysis,
  onShowPositiveCashflow,
  onShowMissingRoi,
  onShowMultifamily,
}: {
  analysis: ReturnType<typeof buildMarketAnalysis>;
  onShowPositiveCashflow: () => void;
  onShowMissingRoi: () => void;
  onShowMultifamily: () => void;
}) {
  const roiCoverage =
    analysis.activeCount > 0 ? (analysis.modeledRoiCount / analysis.activeCount) * 100 : 0;
  const hasPositiveCashflow = analysis.positiveCashflowCount > 0;
  const needsRoiCleanup = analysis.unknownRoiCount > 0;
  const hasFivePlusDepth = analysis.fivePlusCount > 0;
  const verdictTone: MarketCommandTone = needsRoiCleanup
    ? "amber"
    : hasPositiveCashflow
      ? "green"
      : "blue";
  const verdict = needsRoiCleanup
    ? "Clean ROI gaps before trusting the market read"
    : hasPositiveCashflow
      ? "Start with cashflow-positive ROI leaders"
      : "Market is modeled, but carry is still thin";
  const verdictDetail = needsRoiCleanup
    ? `${analysis.unknownRoiCount.toLocaleString("en-CA")} loaded record${analysis.unknownRoiCount === 1 ? "" : "s"} need rent, expense, or debt assumptions before the market queue is comparable.`
    : hasPositiveCashflow
      ? `${analysis.positiveCashflowCount.toLocaleString("en-CA")} active record${analysis.positiveCashflowCount === 1 ? "" : "s"} model positive annual cashflow. Open the top CoC deal, then verify source facts and lender lane.`
      : "The feed has modeled ROI values, but no loaded record clears positive annual cashflow yet. Use market charts to find where assumptions need tightening.";
  const commandTone = marketCommandPalette(verdictTone);
  const sourceLabel =
    analysis.sourceMix.length > 1
      ? `${analysis.sourceMix.length} sources`
      : analysis.sourceMix[0]?.label ?? "Source pending";
  const commandSignals: MarketCommandSignal[] = [
    {
      label: "ROI coverage",
      value: `${analysis.modeledRoiCount.toLocaleString("en-CA")}/${analysis.activeCount.toLocaleString("en-CA")}`,
      detail: `${Math.round(roiCoverage)}% of loaded records have modeled CoC.`,
      tone: needsRoiCleanup ? "amber" : "green",
    },
    {
      label: "Cashflow pass",
      value: analysis.positiveCashflowCount.toLocaleString("en-CA"),
      detail: `${Math.round(analysis.positiveCashflowShare)}% of loaded records are cashflow positive.`,
      tone: hasPositiveCashflow ? "green" : "red",
    },
    {
      label: "Median ask",
      value: formatCurrency(analysis.medianPrice),
      detail: analysis.dominantPriceBand
        ? `Average ${formatCurrency(analysis.avgPrice)}; largest bucket is ${analysis.dominantPriceBand.label}.`
        : `Average ${formatCurrency(analysis.avgPrice)}; no dominant price bucket yet.`,
      tone: "blue",
    },
    {
      label: "Source spread",
      value: sourceLabel,
      detail:
        analysis.sourceMix.length > 1
          ? "Merged source coverage is improving; still verify badges on each card."
          : "Single-source market read. Use Montréal workflow to inspect source gaps.",
      tone: analysis.sourceMix.length > 1 ? "green" : "amber",
    },
  ];

  return (
    <section className="market-command-panel" style={styles.marketCommandPanel} aria-label="Market decision command">
      <div
        className="market-command-verdict"
        style={{
          ...styles.marketCommandVerdict,
          backgroundColor: commandTone.bg,
          borderColor: commandTone.border,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <p style={{ ...styles.marketCommandEyebrow, color: commandTone.label }}>MARKET COMMAND</p>
          <h2 style={styles.marketCommandTitle}>{verdict}</h2>
          <p style={styles.marketCommandCopy}>{verdictDetail}</p>
        </div>
        <div className="market-command-actions" style={styles.marketCommandActions}>
          {analysis.bestListing ? (
            <Link href={`/listings/${analysis.bestListing.id}`} style={{ ...styles.marketCommandPrimaryAction, color: commandTone.cta, borderColor: commandTone.border }}>
              Open top deal
              <ArrowRight size={14} />
            </Link>
          ) : (
            <Link href="/" style={{ ...styles.marketCommandPrimaryAction, color: commandTone.cta, borderColor: commandTone.border }}>
              Open dashboard
              <ArrowRight size={14} />
            </Link>
          )}
          <button type="button" onClick={needsRoiCleanup ? onShowMissingRoi : onShowPositiveCashflow} style={styles.marketCommandSecondaryAction}>
            {needsRoiCleanup ? "Show cleanup" : "Show cashflow"}
          </button>
          {hasFivePlusDepth ? (
            <button type="button" onClick={onShowMultifamily} style={styles.marketCommandSecondaryAction}>
              5+ unit review
            </button>
          ) : null}
        </div>
      </div>

      <div className="market-command-signal-grid" style={styles.marketCommandSignalGrid}>
        {commandSignals.map((signal) => {
          const palette = marketCommandPalette(signal.tone);
          return (
            <div
              key={signal.label}
              className="market-command-signal-card"
              style={{
                ...styles.marketCommandSignalCard,
                backgroundColor: palette.bg,
                borderColor: palette.border,
              }}
            >
              <span style={{ ...styles.marketCommandSignalLabel, color: palette.label }}>{signal.label}</span>
              <strong style={styles.marketCommandSignalValue}>{signal.value}</strong>
              <span style={styles.marketCommandSignalDetail}>{signal.detail}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MarketPageState({
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
      eyebrow: "Market feed",
      title: "Loading active inventory signals",
      detail:
        "Reading the active listing feed, ROI payloads, unit mix, and source coverage before building the market readout.",
      badge: "Building readout",
      tone: "blue" as const,
    },
    error: {
      eyebrow: "Market feed",
      title: "Could not load market analysis",
      detail: message ?? "The market request failed. Retry the feed or open the dashboard while the summary is unavailable.",
      badge: "Needs attention",
      tone: "red" as const,
    },
    empty: {
      eyebrow: "Market feed",
      title: "No active listings are available for market analysis",
      detail:
        "The market page needs active listings with source-status checks before it can show price bands, source mix, ROI leaders, and multifamily depth.",
      badge: "No active feed",
      tone: "amber" as const,
    },
  }[mode];
  const primary =
    mode === "error" ? (
      <button type="button" onClick={onRetry} style={{ ...styles.marketStatePrimaryAction, cursor: "pointer" }}>
        Retry market feed
        <ArrowRight size={14} />
      </button>
    ) : mode === "loading" ? (
      <span style={styles.marketStatePrimaryAction}>Loading market feed</span>
    ) : (
      <Link href="/" style={styles.marketStatePrimaryAction}>
        Open active queue
        <ArrowRight size={14} />
      </Link>
    );

  return (
    <section className="market-state-panel" data-testid={`market-state-${mode}`} style={styles.marketStatePanel}>
      <div className="market-state-grid" style={styles.marketStateGrid}>
        <div style={{ minWidth: 0 }}>
          <p style={{ ...styles.eyebrow, color: copy.tone === "red" ? "#b91c1c" : "#2563eb" }}>{copy.eyebrow}</p>
          <h2 style={styles.marketStateTitle}>{copy.title}</h2>
          <p style={{ ...styles.marketStateCopy, color: copy.tone === "red" ? "#991b1b" : "#475569" }}>
            {copy.detail}
          </p>
          <div className="market-state-actions" style={styles.marketStateActions}>
            {primary}
            {mode !== "error" && (
              <button type="button" onClick={onRetry} style={styles.marketStateSecondaryAction}>
                Refresh market
              </button>
            )}
            <Link href="/montreal" style={styles.marketStateSecondaryAction}>
              Montreal source workflow
            </Link>
            <Link href="/underwriting" style={styles.marketStateSecondaryAction}>
              Underwriting profile
            </Link>
          </div>
        </div>

        <aside style={styles.marketStateAside}>
          <span style={styles.marketStateBadge}>{copy.badge}</span>
          <MarketStateFact label="What this page needs" value="Active listings with source status and ROI payloads" />
          <MarketStateFact label="What it returns" value="Price bands, unit mix, source mix, and review queues" />
          <MarketStateFact label="Best fallback" value="Use the dashboard for live filtering while the market summary refreshes" />
        </aside>
      </div>
    </section>
  );
}

function MarketStateFact({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.marketStateFact}>
      <p style={styles.marketStateFactLabel}>{label}</p>
      <p style={styles.marketStateFactValue}>{value}</p>
    </div>
  );
}

function MarketPanel({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section style={styles.panel}>
      <div style={styles.panelTitleRow}>
        <div>
          <h2 style={styles.panelTitle}>{title}</h2>
          <p style={styles.panelSubtitle}>{subtitle}</p>
        </div>
        <span style={styles.panelIcon}>{icon}</span>
      </div>
      <div style={styles.distributionList}>{children}</div>
    </section>
  );
}

function DistributionRow({ row }: { row: CountRow }) {
  return (
    <div>
      <div style={styles.distributionTop}>
        <span>{row.label}</span>
        <strong>{row.count.toLocaleString("en-CA")} · {Math.round(row.share)}%</strong>
      </div>
      <div style={styles.progressTrack}>
        <div style={{ ...styles.progressFill, width: `${Math.min(100, Math.max(0, row.share))}%` }} />
      </div>
    </div>
  );
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 === 0 ? (values[middle - 1] + values[middle]) / 2 : values[middle];
}

function toCountRow(label: string, count: number, total: number): CountRow {
  return {
    label,
    count,
    share: total > 0 ? (count / total) * 100 : 0,
  };
}

function sourceName(source: string): string {
  const normalized = source.toLowerCase();
  if (normalized.includes("centris")) return "Centris";
  if (normalized.includes("multi")) return "Multi-source";
  if (normalized.includes("realtor")) return "Realtor.ca";
  return "Source";
}

function marketActionPalette(tone: "blue" | "green" | "amber" | "red") {
  return {
    blue: { bg: "#eff6ff", border: "#bfdbfe", label: "#1d4ed8", cta: "#1d4ed8" },
    green: { bg: "#ecfdf3", border: "#bbf7d0", label: "#166534", cta: "#166534" },
    amber: { bg: "#fffbeb", border: "#fde68a", label: "#b45309", cta: "#b45309" },
    red: { bg: "#fef2f2", border: "#fecaca", label: "#b91c1c", cta: "#b91c1c" },
  }[tone];
}

type MarketCommandTone = "blue" | "green" | "amber" | "red";

type MarketCommandSignal = {
  label: string;
  value: string;
  detail: string;
  tone: MarketCommandTone;
};

function marketCommandPalette(tone: MarketCommandTone) {
  return {
    blue: { bg: "#eff6ff", border: "#bfdbfe", label: "#1d4ed8", cta: "#1d4ed8" },
    green: { bg: "#ecfdf3", border: "#bbf7d0", label: "#166534", cta: "#166534" },
    amber: { bg: "#fffbeb", border: "#fde68a", label: "#b45309", cta: "#b45309" },
    red: { bg: "#fef2f2", border: "#fecaca", label: "#b91c1c", cta: "#b91c1c" },
  }[tone];
}

function listingLeadDetail(listing: Listing): string {
  const coc =
    listing.roi?.cashOnCashReturn != null
      ? `${listing.roi.cashOnCashReturn.toFixed(1)}% CoC`
      : "CoC n/a";
  const yearOneCashflow = listing.roi ? `${formatCurrency(listing.roi.annualCashflow)} Y1 CF` : "Y1 CF n/a";
  const threeYear = formatOptionalCurrency(threeYearCashflow(listing));
  const roiValue = formatOptionalCurrency(listing.roi?.totalYearOneReturn);
  return `${formatCurrency(listing.price)} ask · ${coc} · ${yearOneCashflow} · ${threeYear} 3Y CF · ${roiValue} ROI value`;
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
  }).format(value);
}

function formatDateTime(value: string): string {
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
    maxWidth: 760,
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
  captureCard: {
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
  stateCard: {
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    backgroundColor: "#fff",
    padding: 24,
    color: "#64748b",
  },
  marketStatePanel: {
    borderRadius: 16,
    border: "1px solid #bfdbfe",
    background: "linear-gradient(135deg, #ffffff 0%, #eff6ff 100%)",
    padding: 22,
    boxShadow: "0 18px 45px rgba(37,99,235,0.08)",
  },
  marketStateGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.25fr) minmax(260px, 0.75fr)",
    gap: 16,
    alignItems: "stretch",
  },
  marketStateTitle: {
    margin: "7px 0 0",
    color: "#0f172a",
    fontSize: 22,
    lineHeight: 1.2,
  },
  marketStateCopy: {
    margin: "8px 0 0",
    fontSize: 14,
    lineHeight: 1.6,
  },
  marketStateActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 16,
  },
  marketStatePrimaryAction: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 999,
    border: "1px solid #2563eb",
    backgroundColor: "#2563eb",
    color: "#fff",
    padding: "10px 14px",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 900,
  },
  marketStateSecondaryAction: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    border: "1px solid #bfdbfe",
    backgroundColor: "#fff",
    color: "#1d4ed8",
    padding: "10px 14px",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
  },
  marketStateAside: {
    borderRadius: 12,
    border: "1px solid #dbeafe",
    backgroundColor: "#fff",
    padding: 14,
    display: "grid",
    gap: 11,
    alignContent: "start",
    minWidth: 0,
  },
  marketStateBadge: {
    justifySelf: "start",
    borderRadius: 999,
    border: "1px solid #bfdbfe",
    backgroundColor: "#eff6ff",
    color: "#1d4ed8",
    padding: "6px 9px",
    fontSize: 12,
    fontWeight: 900,
  },
  marketStateFact: {
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    backgroundColor: "#f8fafc",
    padding: 11,
    minWidth: 0,
  },
  marketStateFactLabel: {
    margin: 0,
    color: "#64748b",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  marketStateFactValue: {
    margin: "6px 0 0",
    color: "#0f172a",
    fontSize: 13,
    lineHeight: 1.45,
    fontWeight: 800,
  },
  marketActionPanel: {
    marginBottom: 20,
    borderRadius: 16,
    border: "1px solid #dbeafe",
    background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
    padding: 18,
    boxShadow: "0 16px 36px rgba(15,23,42,0.08)",
  },
  marketActionLead: {
    display: "grid",
    gap: 5,
    marginBottom: 14,
    maxWidth: 860,
  },
  marketActionEyebrow: {
    margin: 0,
    color: "#2563eb",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.12em",
  },
  marketActionTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 23,
    lineHeight: 1.18,
  },
  marketActionCopy: {
    margin: 0,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.55,
  },
  marketActionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: 12,
  },
  marketActionCard: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
    minWidth: 0,
    minHeight: 154,
    borderRadius: 13,
    borderWidth: 1,
    borderStyle: "solid",
    padding: 14,
    color: "#0f172a",
    textDecoration: "none",
  },
  marketActionButton: {
    width: "100%",
    appearance: "none",
    textAlign: "left",
    cursor: "pointer",
  },
  marketActionCardLabel: {
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  marketActionCardValue: {
    color: "#0f172a",
    fontSize: 18,
    lineHeight: 1.24,
    overflowWrap: "anywhere",
  },
  marketActionCardDetail: {
    color: "#475569",
    fontSize: 12,
    lineHeight: 1.45,
  },
  marketActionCardCta: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    marginTop: "auto",
    fontSize: 12,
    fontWeight: 900,
  },
  marketCommandPanel: {
    marginBottom: 20,
    borderRadius: 16,
    border: "1px solid #c7d2fe",
    background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 50%, #eff6ff 100%)",
    padding: 16,
    boxShadow: "0 16px 36px rgba(15,23,42,0.08)",
    display: "grid",
    gridTemplateColumns: "minmax(300px, 0.92fr) minmax(0, 1.08fr)",
    gap: 12,
    alignItems: "stretch",
  },
  marketCommandVerdict: {
    minWidth: 0,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "solid",
    padding: 15,
    display: "grid",
    gap: 13,
    alignContent: "space-between",
  },
  marketCommandEyebrow: {
    margin: 0,
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.12em",
  },
  marketCommandTitle: {
    margin: "6px 0 0",
    color: "#0f172a",
    fontSize: 22,
    lineHeight: 1.16,
  },
  marketCommandCopy: {
    margin: "7px 0 0",
    color: "#334155",
    fontSize: 13,
    lineHeight: 1.55,
  },
  marketCommandActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  marketCommandPrimaryAction: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "solid",
    backgroundColor: "#fff",
    padding: "9px 12px",
    textDecoration: "none",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  marketCommandSecondaryAction: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    border: "1px solid #dbeafe",
    backgroundColor: "#fff",
    color: "#1d4ed8",
    padding: "9px 12px",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  marketCommandSignalGrid: {
    minWidth: 0,
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  },
  marketCommandSignalCard: {
    minWidth: 0,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "solid",
    padding: 12,
    display: "grid",
    gap: 6,
  },
  marketCommandSignalLabel: {
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  marketCommandSignalValue: {
    color: "#0f172a",
    fontSize: 18,
    lineHeight: 1.12,
    overflowWrap: "anywhere",
  },
  marketCommandSignalDetail: {
    color: "#475569",
    fontSize: 11,
    lineHeight: 1.35,
  },
  marketBriefPanel: {
    marginBottom: 20,
    borderRadius: 14,
    border: "1px solid #bfdbfe",
    background: "linear-gradient(135deg, #0f172a 0%, #172554 58%, #1d4ed8 100%)",
    padding: 18,
    color: "#fff",
    boxShadow: "0 18px 40px rgba(30,58,138,0.18)",
  },
  marketBriefHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 15,
  },
  marketBriefEyebrow: {
    margin: 0,
    color: "#bfdbfe",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.12em",
  },
  marketBriefTitle: {
    margin: "6px 0 0",
    color: "#fff",
    fontSize: 23,
    lineHeight: 1.18,
  },
  marketBriefCopy: {
    margin: "7px 0 0",
    color: "#dbeafe",
    fontSize: 13,
    lineHeight: 1.6,
    maxWidth: 840,
  },
  marketBriefBadge: {
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.12)",
    color: "#eff6ff",
    padding: "8px 11px",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  marketBriefGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: 12,
  },
  marketBriefCard: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
    minWidth: 0,
    minHeight: 150,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.1)",
    padding: 14,
    color: "#fff",
    textDecoration: "none",
  },
  marketBriefCardLabel: {
    color: "#bfdbfe",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.07em",
    textTransform: "uppercase",
  },
  marketBriefCardValue: {
    color: "#fff",
    fontSize: 17,
    lineHeight: 1.25,
    overflowWrap: "anywhere",
  },
  marketBriefCardDetail: {
    color: "#dbeafe",
    fontSize: 12,
    lineHeight: 1.45,
  },
  marketBriefAction: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    marginTop: "auto",
    color: "#bfdbfe",
    fontSize: 12,
    fontWeight: 900,
  },
  panelGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 14,
    marginBottom: 22,
  },
  marketFocusPanel: {
    marginBottom: 22,
    borderRadius: 14,
    border: "1px solid #dbeafe",
    background: "linear-gradient(135deg, #ffffff 0%, #eff6ff 100%)",
    padding: 18,
    boxShadow: "0 10px 28px rgba(37,99,235,0.08)",
  },
  marketFocusHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 14,
  },
  marketFocusEyebrow: {
    margin: 0,
    color: "#2563eb",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.1em",
  },
  marketFocusTitle: {
    margin: "5px 0 0",
    color: "#0f172a",
    fontSize: 21,
    lineHeight: 1.2,
  },
  marketFocusCopy: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.55,
    maxWidth: 820,
  },
  marketFocusBadge: {
    borderRadius: 999,
    border: "1px solid #bfdbfe",
    backgroundColor: "#fff",
    color: "#1d4ed8",
    padding: "7px 10px",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  marketFocusGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: 10,
  },
  marketFocusButton: {
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
  marketFocusButtonActive: {
    borderColor: "#2563eb",
    backgroundColor: "#dbeafe",
    boxShadow: "0 10px 22px rgba(37,99,235,0.13)",
  },
  marketFocusButtonTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    fontSize: 13,
  },
  marketFocusCount: {
    borderRadius: 999,
    border: "1px solid #dbeafe",
    backgroundColor: "#eff6ff",
    color: "#1d4ed8",
    padding: "3px 7px",
    fontSize: 11,
    fontWeight: 900,
  },
  marketFocusCountActive: {
    borderRadius: 999,
    backgroundColor: "#2563eb",
    color: "#fff",
    padding: "4px 8px",
    fontSize: 11,
    fontWeight: 900,
  },
  marketFocusButtonCopy: {
    color: "#64748b",
    fontSize: 11,
    lineHeight: 1.35,
  },
  panel: {
    backgroundColor: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: 16,
    boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
  },
  panelTitleRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  panelTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 18,
  },
  panelSubtitle: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.5,
  },
  panelIcon: {
    width: 34,
    height: 34,
    display: "grid",
    placeItems: "center",
    borderRadius: 8,
    backgroundColor: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#2563eb",
    flexShrink: 0,
  },
  distributionList: {
    display: "grid",
    gap: 12,
  },
  distributionTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    color: "#334155",
    fontSize: 13,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "#e2e8f0",
    marginTop: 7,
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#2563eb",
  },
  opportunityHeader: {
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
  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
    gap: 20,
  },
  emptyFocusCard: {
    borderRadius: 12,
    border: "1px dashed #cbd5e1",
    backgroundColor: "#fff",
    color: "#64748b",
    padding: 24,
    textAlign: "center",
    fontSize: 14,
  },
};
