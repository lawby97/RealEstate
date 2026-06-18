"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowUpRight,
  Bath,
  BedDouble,
  Building2,
  Calendar,
  CircleDollarSign,
  ExternalLink,
  MapPin,
  ShieldCheck,
  Wallet,
} from "lucide-react";

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

type ListingDecisionCue = {
  label: string;
  title: string;
  detail: string;
  tone: "green" | "blue" | "amber" | "red" | "slate";
};

type ListingCapitalFit = {
  label: string;
  title: string;
  detail: string;
  tone: "green" | "amber" | "red" | "slate";
};

export function ListingCard({
  listing,
  rank = 0,
  maxDownPayment,
}: {
  listing: Listing;
  rank?: number;
  maxDownPayment?: number | null;
}) {
  const [supportOpen, setSupportOpen] = useState(false);
  const score = listing.evaluation?.combinedScore ?? 0;
  const photos = parsePhotoUrls(listing.photoUrls);
  const primaryPhoto = photos[0];
  const isUnavailable = listing.listingStatus === "sold" || listing.isLinkActive === false;
  const soldStr = formatShortDate(listing.soldAt || listing.unavailableSince || null);
  const firstAddedStr = formatShortDate(listing.createdAt);
  const nightlyVerifiedStr = formatDateTime(listing.lastSyncRunAt ?? listing.lastSeenAt ?? null);
  const isNewListing = isWithinLastDays(listing.createdAt, 7);
  const cashOnCashRoi = listing.roi?.cashOnCashReturn ?? null;
  const annualCashflow = listing.roi?.annualCashflow ?? null;
  const monthlyCashflow = annualCashflow != null ? annualCashflow / 12 : null;
  const equityRequired = listing.roi?.equityRequired ?? listing.underwriting?.minimumDownPayment ?? null;
  const yearOneRoi = listing.roi?.yearOneRoi ?? null;
  const totalYearOneReturn = listing.roi?.totalYearOneReturn ?? null;
  const yearOneDebtPaydown = listing.roi?.yearOneDebtPaydown ?? null;
  const yearOneAppreciation = listing.roi?.yearOneAppreciation ?? null;
  const cashflowYears = listing.roi?.cashflowYears ?? [];
  const pricePerUnit = listing.units > 0 ? Math.round(listing.price / listing.units) : null;
  const rentPerUnit = listing.roi?.rentPerUnitMonthly ?? null;
  const sourceLabel = sourceName(listing.source);
  const scoreTone = getScoreTone(score);
  const decisionCue = getListingDecisionCue({
    isUnavailable,
    annualCashflow,
    cashOnCashRoi,
    equityRequired,
    manualLenderReview: listing.underwriting?.manualLenderReview ?? false,
  });
  const capitalFit = getListingCapitalFit({
    isUnavailable,
    equityRequired,
    maxDownPayment,
  });
  const cashRequiredTone =
    equityRequired == null || capitalFit == null
      ? "default"
      : capitalFit.tone === "green"
        ? "positive"
        : capitalFit.tone === "red"
          ? "negative"
          : "muted";
  const statusTone = isUnavailable
    ? { bg: "#fff7ed", border: "#fed7aa", fg: "#9a3412", label: "Unavailable" }
    : listing.isLinkActive === true
      ? null
      : { bg: "#f8fafc", border: "#e2e8f0", fg: "#475569", label: "Needs check" };

  return (
    <article className="listing-card" style={styles.card}>
      <div className="listing-card-media" style={styles.media}>
        {primaryPhoto ? (
          <Image
            src={primaryPhoto}
            alt={`${listing.address} listing photo`}
            fill
            sizes="(min-width: 1200px) 360px, 100vw"
            style={{ objectFit: "cover" }}
          />
        ) : (
          <div style={styles.photoFallback}>
            <Building2 size={28} />
            <span>No photo</span>
          </div>
        )}
        <div style={styles.mediaScrim} />
        <div style={styles.mediaTopRow}>
          <div style={styles.mediaTopLeft}>
            {rank > 0 ? <span style={styles.rankBadge}>#{rank}</span> : null}
            {isNewListing ? <span style={styles.newListingBadge}>New this week</span> : null}
          </div>
          {statusTone ? (
            <span style={{ ...styles.statusBadge, backgroundColor: statusTone.bg, borderColor: statusTone.border, color: statusTone.fg }}>
              {statusTone.label}
            </span>
          ) : null}
        </div>
        <div style={styles.mediaBottomRow}>
          <span style={styles.sourceBadge}>{sourceLabel}</span>
          <span style={styles.typeBadge}>{listing.propertyType}</span>
        </div>
      </div>

      <div style={styles.body}>
        {isUnavailable ? (
          <div style={styles.unavailableNotice}>
            Removed from active inventory{soldStr ? ` on ${soldStr}` : ""}. Kept for price history and review.
          </div>
        ) : null}

        <div>
          <Link href={`/listings/${listing.id}`} style={styles.titleLink}>
            {listing.address}
          </Link>
          <div style={styles.location}>
            <MapPin size={14} />
            <span>{listing.city}, {listing.province}</span>
          </div>
        </div>

        <DecisionCueStrip cue={decisionCue} />

        {capitalFit && <CapitalFitStrip fit={capitalFit} />}

        <ReturnSnapshot
          annualCashflow={annualCashflow}
          monthlyCashflow={monthlyCashflow}
          cashOnCashRoi={cashOnCashRoi}
          equityRequired={equityRequired}
          cashflowYears={cashflowYears}
          yearOneRoi={yearOneRoi}
          totalYearOneReturn={totalYearOneReturn}
          yearOneDebtPaydown={yearOneDebtPaydown}
          yearOneAppreciation={yearOneAppreciation}
        />

        <div className="listing-card-primary-metrics" style={styles.primaryMetrics}>
          <MetricTile
            icon={<CircleDollarSign size={15} />}
            label="Ask"
            value={formatCurrency(listing.price)}
          />
          <MetricTile
            icon={<Building2 size={15} />}
            label="Price/unit"
            value={pricePerUnit ? formatCurrency(pricePerUnit) : "n/a"}
          />
          <MetricTile
            icon={<Wallet size={15} />}
            label="Cash req."
            value={equityRequired != null ? formatCurrency(Math.round(equityRequired)) : "n/a"}
            tone={cashRequiredTone}
          />
          <MetricTile
            icon={<ShieldCheck size={15} />}
            label="Rent/unit"
            value={rentPerUnit != null ? `${formatCurrency(rentPerUnit)}/mo` : "n/a"}
          />
        </div>

        <section
          className="listing-card-support-disclosure"
          style={styles.supportDisclosure}
          data-open={supportOpen ? "true" : "false"}
        >
          <button
            type="button"
            className="listing-card-support-summary"
            aria-expanded={supportOpen}
            aria-controls={`listing-card-support-${listing.id}`}
            onClick={() => setSupportOpen((open) => !open)}
            style={styles.supportSummary}
          >
            <span style={styles.supportSummaryText}>
              Facts, freshness, and lender check
            </span>
            <span style={styles.supportSummaryHint}>
              {supportOpen ? "Hide" : "Show"}
            </span>
          </button>

          {supportOpen && (
            <div
              id={`listing-card-support-${listing.id}`}
              className="listing-card-support-body"
              style={styles.supportBody}
            >
              <div style={styles.factsRow}>
                <InlineFact icon={<Building2 size={14} />}>
                  {listing.units} {listing.units === 1 ? "unit" : "units"}
                </InlineFact>
                <InlineFact icon={<BedDouble size={14} />}>
                  {listing.bedrooms != null ? `${listing.bedrooms} bed` : "Beds n/a"}
                </InlineFact>
                <InlineFact icon={<Bath size={14} />}>
                  {listing.bathrooms != null ? `${listing.bathrooms} bath` : "Baths n/a"}
                </InlineFact>
                <InlineFact icon={<Calendar size={14} />}>
                  First added {firstAddedStr}
                </InlineFact>
                <InlineFact icon={<ShieldCheck size={14} />}>
                  Nightly verified {nightlyVerifiedStr ?? "n/a"}
                </InlineFact>
              </div>

              <div className="listing-card-review-grid" style={styles.cardReviewGrid}>
                <div style={styles.scoreStrip}>
                  <div>
                    <div style={styles.stripLabel}>Deal score</div>
                    <div style={styles.stripValue}>
                      {Math.round(score)} <span className="listing-card-score-note" style={styles.stripNote}>{scoreTone.label}</span>
                    </div>
                  </div>
                  <div style={{ ...styles.scorePill, backgroundColor: scoreTone.bg, color: scoreTone.fg }}>
                    {scoreTone.shortLabel}
                  </div>
                </div>

                {listing.underwriting ? (
                  <div style={styles.underwritingBox}>
                    <div style={styles.underwritingTop}>
                      <span>{listing.underwriting.financingTrackLabel}</span>
                      <strong>{Math.round(listing.underwriting.minimumDownPaymentPct * 100)}% down</strong>
                    </div>
                    {listing.underwriting.manualLenderReview ? (
                      <div className="listing-card-review-note" style={styles.reviewNote}>Lender exception requires review.</div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </section>

        <div style={styles.actions}>
          <Link href={`/listings/${listing.id}`} style={styles.primaryAction}>
            {isUnavailable ? "Review record" : "Underwrite"}
            <ArrowUpRight size={15} />
          </Link>
          {listing.listingUrl ? (
            <a href={listing.listingUrl} target="_blank" rel="noopener noreferrer" style={styles.secondaryAction}>
              Source
              <ExternalLink size={15} />
            </a>
          ) : (
            <button type="button" disabled style={styles.disabledAction}>
              No source
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function CapitalFitStrip({ fit }: { fit: ListingCapitalFit }) {
  const tone = capitalFitTone(fit.tone);
  return (
    <div className="listing-card-capital-fit" style={{ ...styles.capitalFit, backgroundColor: tone.bg, borderColor: tone.border }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ ...styles.capitalFitLabel, color: tone.fg }}>{fit.label}</div>
        <div style={styles.capitalFitTitle}>{fit.title}</div>
      </div>
      <div style={styles.capitalFitDetail}>{fit.detail}</div>
    </div>
  );
}

function DecisionCueStrip({ cue }: { cue: ListingDecisionCue }) {
  const tone = decisionCueTone(cue.tone);
  return (
    <div style={{ ...styles.decisionCue, backgroundColor: tone.bg, borderColor: tone.border }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ ...styles.decisionCueLabel, color: tone.fg }}>{cue.label}</div>
        <div style={styles.decisionCueTitle}>{cue.title}</div>
        <div style={styles.decisionCueDetail}>{cue.detail}</div>
      </div>
      <span style={{ ...styles.decisionCuePill, backgroundColor: tone.pillBg, color: tone.fg }}>
        {cue.tone === "green" ? "Open" : cue.tone === "red" ? "Risk" : "Review"}
      </span>
    </div>
  );
}

function ReturnSnapshot({
  annualCashflow,
  monthlyCashflow,
  cashOnCashRoi,
  equityRequired,
  cashflowYears,
  yearOneRoi,
  totalYearOneReturn,
  yearOneDebtPaydown,
  yearOneAppreciation,
}: {
  annualCashflow: number | null;
  monthlyCashflow: number | null;
  cashOnCashRoi: number | null;
  equityRequired: number | null;
  cashflowYears: Array<{
    year: number;
    annualCashflow: number;
    monthlyCashflow: number;
    cumulativeCashflow: number;
    dscr: number;
  }>;
  yearOneRoi: number | null;
  totalYearOneReturn: number | null;
  yearOneDebtPaydown: number | null;
  yearOneAppreciation: number | null;
}) {
  const cocTone = valueTone(cashOnCashRoi);
  const hasRoiValue =
    totalYearOneReturn != null &&
    Number.isFinite(totalYearOneReturn) &&
    yearOneRoi != null &&
    Number.isFinite(yearOneRoi);
  const roiTone = valueTone(hasRoiValue ? totalYearOneReturn : null);
  const visibleCashflowYears =
    cashflowYears.length > 0
      ? cashflowYears.slice(0, 3)
      : annualCashflow != null
        ? [
            {
              year: 1,
              annualCashflow,
              monthlyCashflow: monthlyCashflow ?? annualCashflow / 12,
              cumulativeCashflow: annualCashflow,
              dscr: Number.NaN,
            },
          ]
        : [];
  const threeYearCashflow = visibleCashflowYears.reduce((sum, year) => sum + year.annualCashflow, 0);
  const threeYearTone = valueTone(visibleCashflowYears.length > 0 ? threeYearCashflow : null);
  const roiValueBridge =
    annualCashflow != null && totalYearOneReturn != null
      ? `${formatCurrency(annualCashflow)} CF + ${formatCurrency(yearOneDebtPaydown ?? 0)} paydown + ${formatCurrency(yearOneAppreciation ?? 0)} appreciation = ${formatCurrency(totalYearOneReturn)}`
      : "Cashflow + paydown + appreciation";
  const cocCalculation =
    annualCashflow != null && equityRequired != null && equityRequired > 0
      ? `${formatCurrency(annualCashflow)} / ${formatCurrency(equityRequired)} = ${cashOnCashRoi != null ? `${cashOnCashRoi.toFixed(1)}%` : "n/a"}`
      : "Cashflow / cash required";
  const roiCalculation =
    totalYearOneReturn != null && equityRequired != null && equityRequired > 0
      ? `${formatCurrency(totalYearOneReturn)} / ${formatCurrency(equityRequired)} = ${yearOneRoi != null ? `${yearOneRoi.toFixed(1)}%` : "n/a"}`
      : "Total return / cash required";
  return (
    <div style={styles.returnSnapshot}>
      <div style={styles.returnSnapshotHeader}>
        <div>
          <div style={styles.returnSnapshotEyebrow}>Return math</div>
          <div style={styles.returnSnapshotTitle}>Cashflow, CoC, ROI value</div>
        </div>
        <div style={styles.returnSnapshotPill}>
          {equityRequired != null ? `${formatCurrency(Math.round(equityRequired))} cash in` : "Cash in n/a"}
        </div>
      </div>

      <div className="listing-card-return-top-grid" style={styles.returnTopGrid}>
        <div style={styles.returnMetric}>
          <div style={styles.returnLabel}>3Y cashflow</div>
          <div style={{ ...styles.returnValue, color: threeYearTone.color }}>
            {visibleCashflowYears.length > 0 ? formatCurrency(threeYearCashflow) : "n/a"}
          </div>
          <div style={styles.returnDetail}>
            {visibleCashflowYears.length >= 3 ? "Y1-Y3 total" : "After debt service"}
          </div>
        </div>
        <div style={styles.returnMetric}>
          <div style={styles.returnLabel}>Screen CoC</div>
          <div style={{ ...styles.returnValue, color: cocTone.color }}>
            {cashOnCashRoi != null ? `${cashOnCashRoi.toFixed(1)}%` : "n/a"}
          </div>
          <div style={styles.returnDetail}>Queue yield</div>
        </div>
        <div style={styles.returnMetric}>
          <div style={styles.returnLabel}>Y1 ROI value</div>
          <div style={{ ...styles.returnValue, color: roiTone.color }}>
            {hasRoiValue ? formatCurrency(totalYearOneReturn) : "n/a"}
          </div>
          <div style={styles.returnDetail}>
            {yearOneRoi != null ? `${yearOneRoi.toFixed(1)}% value return` : "Value return"}
          </div>
        </div>
      </div>

      {visibleCashflowYears.length > 0 && (
        <div className="listing-card-cashflow-mini" style={styles.cashflowMiniTable}>
          {visibleCashflowYears.map((year) => {
            const tone = valueTone(year.annualCashflow);
            return (
              <div key={year.year} style={styles.cashflowMiniRow}>
                <span>Y{year.year}</span>
                <strong style={{ color: tone.color }}>{formatCurrency(year.annualCashflow)}</strong>
                <span>{Number.isFinite(year.dscr) ? `${year.dscr.toFixed(2)}x DSCR` : `${formatCurrency(year.monthlyCashflow)}/mo`}</span>
              </div>
            );
          })}
        </div>
      )}

      <details className="listing-card-formula-disclosure" style={styles.formulaDisclosure}>
        <summary style={styles.formulaSummary}>
          <span style={styles.formulaSummaryLabel}>Show calculations</span>
          <span style={styles.formulaSummaryHint}>CoC and ROI bridge</span>
        </summary>
        <div className="listing-card-formula-stack" style={styles.formulaStack}>
          {visibleCashflowYears.length > 0 && (
            <div style={styles.formulaLine}>
              <span>3Y CF</span>
              <strong>{formatCurrency(threeYearCashflow)}</strong>
            </div>
          )}
          <div style={styles.formulaLine}>
            <span>Screen CoC</span>
            <strong>{cocCalculation}</strong>
          </div>
          <div style={styles.formulaLine}>
            <span>ROI value</span>
            <strong>{roiValueBridge}</strong>
            <span>{roiCalculation}</span>
          </div>
        </div>
      </details>
    </div>
  );
}

function getListingCapitalFit({
  isUnavailable,
  equityRequired,
  maxDownPayment,
}: {
  isUnavailable: boolean;
  equityRequired: number | null;
  maxDownPayment?: number | null;
}): ListingCapitalFit | null {
  if (isUnavailable || maxDownPayment == null || !Number.isFinite(maxDownPayment)) {
    return null;
  }

  if (equityRequired == null || !Number.isFinite(equityRequired)) {
    return {
      label: "Capital fit",
      title: "Cash need unavailable",
      detail: `Current cap ${formatCurrency(maxDownPayment)}. Open the record to verify down payment and closing cost assumptions.`,
      tone: "amber",
    };
  }

  const headroom = maxDownPayment - equityRequired;
  if (headroom >= 0) {
    return {
      label: "Capital fit",
      title: `Fits ${formatCurrency(maxDownPayment)} cap`,
      detail: `${formatCurrency(headroom)} headroom after ${formatCurrency(equityRequired)} estimated cash need.`,
      tone: "green",
    };
  }

  return {
    label: "Capital gap",
    title: `${formatCurrency(Math.abs(headroom))} over cash cap`,
    detail: `Needs ${formatCurrency(equityRequired)} estimated cash against a ${formatCurrency(maxDownPayment)} cap.`,
    tone: "red",
  };
}

function capitalFitTone(tone: ListingCapitalFit["tone"]) {
  const tones: Record<ListingCapitalFit["tone"], { bg: string; border: string; fg: string }> = {
    green: { bg: "#ecfdf3", border: "#bbf7d0", fg: "#166534" },
    amber: { bg: "#fffbeb", border: "#fde68a", fg: "#92400e" },
    red: { bg: "#fef2f2", border: "#fecaca", fg: "#b91c1c" },
    slate: { bg: "#f8fafc", border: "#e2e8f0", fg: "#475569" },
  };
  return tones[tone];
}

function getListingDecisionCue({
  isUnavailable,
  annualCashflow,
  cashOnCashRoi,
  equityRequired,
  manualLenderReview,
}: {
  isUnavailable: boolean;
  annualCashflow: number | null;
  cashOnCashRoi: number | null;
  equityRequired: number | null;
  manualLenderReview: boolean;
}): ListingDecisionCue {
  if (isUnavailable) {
    return {
      label: "Record only",
      title: "No longer active",
      detail: "Kept for price history, comps, and sold-page review.",
      tone: "slate",
    };
  }

  if (annualCashflow == null || cashOnCashRoi == null || !Number.isFinite(cashOnCashRoi)) {
    return {
      label: "Data gap",
      title: "Return needs better inputs",
      detail: "Open to verify rent, expense, and financing assumptions.",
      tone: "amber",
    };
  }

  const cashRequired = equityRequired != null ? ` · cash ${formatCurrency(equityRequired)}` : "";
  const lenderNote = manualLenderReview ? " · lender review" : "";

  if (annualCashflow > 0 && cashOnCashRoi >= 8) {
    return {
      label: "Underwrite first",
      title: `${formatCurrency(annualCashflow)} Y1 cashflow`,
      detail: `${cashOnCashRoi.toFixed(1)}% CoC${cashRequired}${lenderNote}`,
      tone: manualLenderReview ? "blue" : "green",
    };
  }

  if (annualCashflow > 0) {
    return {
      label: "Cashflow-positive",
      title: `${formatCurrency(annualCashflow)} Y1 cashflow`,
      detail: `${cashOnCashRoi.toFixed(1)}% CoC${cashRequired}${lenderNote}`,
      tone: manualLenderReview ? "blue" : "amber",
    };
  }

  if (annualCashflow < 0) {
    return {
      label: "Watch cash drag",
      title: `${formatCurrency(annualCashflow)} Y1 cashflow`,
      detail: `${cashOnCashRoi.toFixed(1)}% CoC${cashRequired}${lenderNote}`,
      tone: "red",
    };
  }

  return {
    label: "Flat carry",
    title: "Break-even cashflow",
    detail: `${cashOnCashRoi.toFixed(1)}% CoC${cashRequired}${lenderNote}`,
    tone: manualLenderReview ? "blue" : "slate",
  };
}

function decisionCueTone(tone: ListingDecisionCue["tone"]) {
  const tones: Record<ListingDecisionCue["tone"], { bg: string; border: string; fg: string; pillBg: string }> = {
    green: { bg: "#ecfdf3", border: "#bbf7d0", fg: "#166534", pillBg: "#dcfce7" },
    blue: { bg: "#eff6ff", border: "#bfdbfe", fg: "#1d4ed8", pillBg: "#dbeafe" },
    amber: { bg: "#fffbeb", border: "#fde68a", fg: "#92400e", pillBg: "#fef3c7" },
    red: { bg: "#fef2f2", border: "#fecaca", fg: "#b91c1c", pillBg: "#fee2e2" },
    slate: { bg: "#f8fafc", border: "#e2e8f0", fg: "#475569", pillBg: "#e2e8f0" },
  };
  return tones[tone];
}

function MetricTile({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone?: "default" | "positive" | "negative" | "muted";
}) {
  const color = tone === "positive" ? "#166534" : tone === "negative" ? "#b91c1c" : tone === "muted" ? "#854d0e" : "#0f172a";
  return (
    <div className="listing-card-metric-tile" style={styles.metricTile}>
      <div style={styles.metricLabel}>{icon}{label}</div>
      <div style={{ ...styles.metricValue, color }}>{value}</div>
    </div>
  );
}

function InlineFact({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span style={styles.inlineFact}>
      {icon}
      {children}
    </span>
  );
}

function parsePhotoUrls(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string" && item.startsWith("http")) : [];
  } catch {
    return [];
  }
}

function sourceName(source: string): string {
  const normalized = source.toLowerCase();
  if (normalized.includes("centris")) return "Centris";
  if (normalized.includes("multi")) return "Multi-source";
  if (normalized.includes("realtor")) return "Realtor.ca";
  return "Source";
}

function getScoreTone(score: number) {
  if (score >= 85) return { bg: "#dcfce7", fg: "#166534", label: "High conviction", shortLabel: "Strong" };
  if (score >= 70) return { bg: "#dbeafe", fg: "#1d4ed8", label: "Worth underwriting", shortLabel: "Review" };
  return { bg: "#f1f5f9", fg: "#475569", label: "Needs review", shortLabel: "Watch" };
}

function valueTone(value: number | null): { color: string } {
  if (value == null || !Number.isFinite(value)) return { color: "#e2e8f0" };
  if (value > 0) return { color: "#86efac" };
  if (value < 0) return { color: "#fecaca" };
  return { color: "#e2e8f0" };
}

function formatCurrency(value: number): string {
  return value.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  });
}

function formatShortDate(value?: string | null): string {
  if (!value) return "n/a";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "n/a";
  return date.toLocaleDateString("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function formatDateTime(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toLocaleString("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isWithinLastDays(value: string | null | undefined, days: number): boolean {
  if (!value) return false;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return false;
  const ageMs = Date.now() - date.getTime();
  return ageMs >= 0 && ageMs <= days * 24 * 60 * 60 * 1000;
}

const styles: Record<string, CSSProperties> = {
  card: {
    backgroundColor: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    overflow: "hidden",
    boxShadow: "0 10px 28px rgba(15,23,42,0.06)",
    display: "flex",
    flexDirection: "column",
    minHeight: "100%",
  },
  media: {
    position: "relative",
    minHeight: 150,
    backgroundColor: "#e2e8f0",
    overflow: "hidden",
  },
  mediaScrim: {
    position: "absolute",
    inset: 0,
    background: "linear-gradient(180deg, rgba(15,23,42,0.34) 0%, rgba(15,23,42,0.08) 45%, rgba(15,23,42,0.54) 100%)",
  },
  photoFallback: {
    position: "absolute",
    inset: 0,
    display: "grid",
    placeItems: "center",
    gap: 8,
    color: "#64748b",
    fontSize: 13,
    fontWeight: 700,
    backgroundColor: "#f1f5f9",
  },
  mediaTopRow: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  mediaTopLeft: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    minWidth: 0,
  },
  mediaBottomRow: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  rankBadge: {
    borderRadius: 999,
    padding: "5px 9px",
    backgroundColor: "rgba(15,23,42,0.78)",
    color: "#fff",
    fontSize: 12,
    fontWeight: 800,
  },
  statusBadge: {
    border: "1px solid",
    borderRadius: 999,
    padding: "5px 9px",
    fontSize: 12,
    fontWeight: 800,
    backdropFilter: "blur(8px)",
  },
  newListingBadge: {
    borderRadius: 999,
    border: "1px solid rgba(187,247,208,0.85)",
    padding: "5px 9px",
    backgroundColor: "rgba(22,101,52,0.88)",
    color: "#fff",
    fontSize: 12,
    fontWeight: 900,
    backdropFilter: "blur(8px)",
    whiteSpace: "nowrap",
  },
  sourceBadge: {
    borderRadius: 999,
    padding: "5px 9px",
    backgroundColor: "rgba(255,255,255,0.92)",
    color: "#0f172a",
    fontSize: 12,
    fontWeight: 800,
  },
  typeBadge: {
    borderRadius: 999,
    padding: "5px 9px",
    backgroundColor: "rgba(15,23,42,0.78)",
    color: "#fff",
    fontSize: 12,
    fontWeight: 800,
    maxWidth: "55%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  body: {
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    flex: 1,
  },
  unavailableNotice: {
    borderRadius: 8,
    backgroundColor: "#fff7ed",
    border: "1px solid #fed7aa",
    padding: "9px 10px",
    color: "#9a3412",
    fontSize: 13,
    lineHeight: 1.4,
  },
  titleLink: {
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    color: "#0f172a",
    textDecoration: "none",
    fontWeight: 800,
    fontSize: 16,
    lineHeight: 1.35,
  },
  location: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    color: "#64748b",
    fontSize: 13,
    marginTop: 6,
  },
  decisionCue: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 10,
    alignItems: "center",
    border: "1px solid",
    borderRadius: 10,
    padding: "10px 11px",
  },
  decisionCueLabel: {
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  },
  decisionCueTitle: {
    marginTop: 4,
    color: "#0f172a",
    fontSize: 15,
    fontWeight: 900,
    lineHeight: 1.15,
    overflowWrap: "anywhere",
    fontVariantNumeric: "tabular-nums",
  },
  decisionCueDetail: {
    marginTop: 4,
    color: "#475569",
    fontSize: 12,
    lineHeight: 1.35,
    overflowWrap: "anywhere",
  },
  decisionCuePill: {
    borderRadius: 999,
    padding: "6px 9px",
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  capitalFit: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 0.8fr) minmax(0, 1.2fr)",
    gap: 10,
    alignItems: "center",
    border: "1px solid",
    borderRadius: 10,
    padding: "9px 10px",
  },
  capitalFitLabel: {
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  },
  capitalFitTitle: {
    marginTop: 4,
    color: "#0f172a",
    fontSize: 14,
    fontWeight: 900,
    lineHeight: 1.2,
    overflowWrap: "anywhere",
  },
  capitalFitDetail: {
    color: "#475569",
    fontSize: 12,
    lineHeight: 1.4,
    overflowWrap: "anywhere",
  },
  returnSnapshot: {
    display: "grid",
    gap: 8,
    borderRadius: 12,
    background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
    border: "1px solid rgba(37,99,235,0.35)",
    padding: 10,
    boxShadow: "0 10px 24px rgba(30,58,138,0.14)",
  },
  returnSnapshotHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  returnSnapshotEyebrow: {
    color: "#93c5fd",
    fontSize: 9,
    fontWeight: 900,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  returnSnapshotTitle: {
    marginTop: 3,
    color: "#fff",
    fontSize: 14,
    fontWeight: 900,
    lineHeight: 1.15,
  },
  returnSnapshotPill: {
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.11)",
    color: "#dbeafe",
    padding: "5px 8px",
    fontSize: 10,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  returnTopGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 6,
  },
  returnMetric: {
    minWidth: 0,
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.08)",
    padding: 8,
  },
  returnLabel: {
    color: "#bfdbfe",
    fontSize: 10,
    fontWeight: 850,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  },
  returnValue: {
    marginTop: 5,
    fontSize: 17,
    lineHeight: 1,
    fontWeight: 900,
    letterSpacing: "-0.03em",
    overflowWrap: "anywhere",
    fontVariantNumeric: "tabular-nums",
  },
  returnDetail: {
    marginTop: 6,
    color: "#dbeafe",
    fontSize: 11,
    lineHeight: 1.35,
  },
  cashflowMiniTable: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(88px, 1fr))",
    gap: 5,
    borderTop: "1px solid rgba(255,255,255,0.14)",
    paddingTop: 8,
  },
  cashflowMiniRow: {
    display: "grid",
    gap: 3,
    alignItems: "start",
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.07)",
    padding: 6,
    color: "#dbeafe",
    fontSize: 11,
    minWidth: 0,
  },
  formulaStack: {
    marginTop: 7,
    display: "grid",
    gap: "6px 8px",
    gridTemplateColumns: "repeat(auto-fit, minmax(104px, 1fr))",
    borderRadius: 10,
    backgroundColor: "rgba(15,23,42,0.24)",
    border: "1px solid rgba(255,255,255,0.12)",
    padding: 8,
  },
  formulaDisclosure: {
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    backgroundColor: "rgba(15,23,42,0.18)",
    overflow: "hidden",
  },
  formulaSummary: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    padding: "8px 9px",
    color: "#dbeafe",
    cursor: "pointer",
    listStyle: "none",
  },
  formulaSummaryLabel: {
    color: "#eff6ff",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  formulaSummaryHint: {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  formulaLine: {
    display: "grid",
    gap: 3,
    color: "#bfdbfe",
    fontSize: 11,
    lineHeight: 1.35,
    minWidth: 0,
    overflowWrap: "anywhere",
  },
  primaryMetrics: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))",
    gap: 8,
  },
  supportDisclosure: {
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    backgroundColor: "#f8fafc",
    overflow: "hidden",
  },
  supportSummary: {
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    border: 0,
    backgroundColor: "transparent",
    padding: "9px 10px",
    color: "#334155",
    cursor: "pointer",
    textAlign: "left",
  },
  supportSummaryText: {
    color: "#334155",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  supportSummaryHint: {
    borderRadius: 999,
    border: "1px solid #cbd5e1",
    backgroundColor: "#fff",
    color: "#475569",
    padding: "4px 8px",
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  supportBody: {
    display: "grid",
    gap: 8,
    borderTop: "1px solid #e2e8f0",
    padding: 10,
    backgroundColor: "#fff",
  },
  metricTile: {
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    backgroundColor: "#f8fafc",
    padding: 8,
    minWidth: 0,
  },
  metricLabel: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    color: "#64748b",
    fontSize: 11,
    fontWeight: 800,
    textTransform: "uppercase",
  },
  metricValue: {
    marginTop: 6,
    color: "#0f172a",
    fontSize: 15,
    fontWeight: 850,
    lineHeight: 1.1,
    overflowWrap: "anywhere",
  },
  factsRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px 10px",
    color: "#475569",
    fontSize: 13,
  },
  cardReviewGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: 8,
  },
  inlineFact: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
  },
  scoreStrip: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    padding: "9px 10px",
  },
  stripLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: 800,
    textTransform: "uppercase",
  },
  stripValue: {
    marginTop: 3,
    color: "#0f172a",
    fontWeight: 850,
    fontSize: 16,
  },
  stripNote: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 700,
  },
  scorePill: {
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 850,
  },
  underwritingBox: {
    borderRadius: 8,
    border: "1px solid #dbeafe",
    backgroundColor: "#eff6ff",
    padding: "9px 10px",
  },
  underwritingTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    color: "#1e3a8a",
    fontSize: 13,
    fontWeight: 800,
  },
  reviewNote: {
    marginTop: 5,
    color: "#92400e",
    fontSize: 12,
    fontWeight: 700,
  },
  actions: {
    marginTop: "auto",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 8,
  },
  primaryAction: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    minHeight: 40,
    padding: "9px 12px",
    backgroundColor: "#1d4ed8",
    color: "white",
    borderRadius: 8,
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 850,
  },
  secondaryAction: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 40,
    padding: "9px 12px",
    backgroundColor: "#fff",
    color: "#0f172a",
    borderRadius: 8,
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 800,
    border: "1px solid #cbd5e1",
  },
  disabledAction: {
    minHeight: 40,
    padding: "9px 12px",
    backgroundColor: "#e2e8f0",
    color: "#64748b",
    borderRadius: 8,
    border: "none",
    fontSize: 14,
    fontWeight: 800,
    cursor: "not-allowed",
  },
};
