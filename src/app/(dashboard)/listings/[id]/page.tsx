import type { CSSProperties, ReactNode } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import {
  ArrowUpRight,
  Building2,
  ChartColumnIncreasing,
  Database,
  MapPinned,
  Wallet,
} from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getListingDetailPayload } from "@/lib/listing-detail";
import { ProvenanceBadge } from "@/components/listing/ProvenanceBadge";
import { ListingDetailClient } from "@/components/strategies/ListingDetailClient";
import { buildInvestorContextDefaults, type InvestorProfileDefaults } from "@/lib/investor-context";
import { buildInvestmentWorkspace } from "@/lib/investment-workspace";
import type { OperatingExpenseTemplate } from "@/types/listing";

export default async function ListingDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  const userProfile = session?.user?.email
    ? await prisma.user.findUnique({
        where: { email: session.user.email },
        select: {
          firstPropertyBuyer: true,
          willLiveThere: true,
          preferredAssetBand: true,
          preferredDealStage: true,
          plansRenovations: true,
          averageManagementFeePct: true,
          insuranceDefaultBasis: true,
          insuranceDefaultValue: true,
          repairsDefaultBasis: true,
          repairsDefaultValue: true,
          utilitiesDefaultBasis: true,
          utilitiesDefaultValue: true,
          snowDefaultBasis: true,
          snowDefaultValue: true,
        },
      })
    : null;
  const operatingExpenseTemplate: OperatingExpenseTemplate | null = userProfile
    ? {
        averageManagementFeePct: userProfile.averageManagementFeePct,
        insuranceDefaultBasis: userProfile.insuranceDefaultBasis as OperatingExpenseTemplate["insuranceDefaultBasis"],
        insuranceDefaultValue: userProfile.insuranceDefaultValue,
        repairsDefaultBasis: userProfile.repairsDefaultBasis as OperatingExpenseTemplate["repairsDefaultBasis"],
        repairsDefaultValue: userProfile.repairsDefaultValue,
        utilitiesDefaultBasis: userProfile.utilitiesDefaultBasis as OperatingExpenseTemplate["utilitiesDefaultBasis"],
        utilitiesDefaultValue: userProfile.utilitiesDefaultValue,
        snowDefaultBasis: userProfile.snowDefaultBasis as OperatingExpenseTemplate["snowDefaultBasis"],
        snowDefaultValue: userProfile.snowDefaultValue,
      }
    : null;

  const payload = await getListingDetailPayload(params.id, {
    operatingExpenseTemplate,
  });
  if (!payload) notFound();

  const {
    listing,
    evaluation,
    profile,
    marketBenchmark,
    provenanceCounts,
    defaultAssumptions,
    dataConfidence,
    missingInputsNote,
  } = payload;

  const investorProfileDefaults: InvestorProfileDefaults | null = userProfile
    ? {
        firstPropertyBuyer: userProfile.firstPropertyBuyer,
        willLiveThere: userProfile.willLiveThere,
        preferredAssetBand:
          userProfile.preferredAssetBand === "one_to_four_units" ||
          userProfile.preferredAssetBand === "five_plus_units" ||
          userProfile.preferredAssetBand === "flexible"
            ? userProfile.preferredAssetBand
            : null,
        preferredDealStage:
          userProfile.preferredDealStage === "existing" ||
          userProfile.preferredDealStage === "new_construction" ||
          userProfile.preferredDealStage === "either"
            ? userProfile.preferredDealStage
            : null,
        plansRenovations: userProfile.plansRenovations,
      }
    : null;

  const investorContextDefaults = buildInvestorContextDefaults(profile, investorProfileDefaults);
  const workspaceInput = {
    price: listing.price,
    squareFeet: listing.squareFeet,
    lotSizeSqFt: listing.lotSizeSqFt,
    descriptionText: listing.description,
    defaultAssumptions,
    profile,
    unitRentBenchmarks: marketBenchmark.unitRentBenchmarks,
    marketCity: marketBenchmark.mappedMarketCity,
    province: listing.province,
    operatingExpenseTemplate,
  };
  const initialWorkspace = buildInvestmentWorkspace({
    ...workspaceInput,
    investorContext: investorContextDefaults,
  });

  const photos = parsePhotoUrls(listing.photoUrls);
  const sourceLabel = listing.source.toLowerCase().includes("centris")
    ? "Centris"
    : listing.source.toLowerCase().includes("realtor")
      ? "Realtor.ca"
      : "Source";
  const pricePerUnit = listing.units > 0 ? Math.round(listing.price / listing.units) : null;
  const benchmarkRentLabel = marketBenchmark.benchmarkCurrentRentLabel || "Market benchmark";

  return (
    <div style={styles.page}>
      <Link href="/" style={styles.backLink}>
        {"<- Back to dashboard"}
      </Link>

      <header style={styles.headerWrap}>
        <div style={styles.headerCard}>
          <div style={styles.badgeRow}>
            <HeaderBadge>{listing.propertyType}</HeaderBadge>
            <HeaderBadge>
              {listing.units} {listing.units === 1 ? "unit" : "units"}
            </HeaderBadge>
            {listing.externalId && <HeaderBadge>MLS #{listing.externalId}</HeaderBadge>}
            <span style={confidenceStyle(dataConfidence)}>
              Data confidence: {dataConfidence}
            </span>
          </div>

          <h1 style={styles.address}>{listing.address}</h1>
          <p style={styles.location}>
            {listing.city}, {listing.province}
            {listing.postalCode && ` · ${listing.postalCode}`}
          </p>

          <div style={styles.badgeRow}>
            {listing.bedrooms != null && <FactBadge>{listing.bedrooms} bed</FactBadge>}
            {listing.bathrooms != null && <FactBadge>{listing.bathrooms} bath</FactBadge>}
            {listing.squareFeet != null && <FactBadge>{listing.squareFeet.toLocaleString()} sq ft</FactBadge>}
            {listing.yearBuilt != null && <FactBadge>Built {listing.yearBuilt}</FactBadge>}
            {listing.listingUrl ? (
              <a href={listing.listingUrl} target="_blank" rel="noopener noreferrer" style={styles.sourceLink}>
                Open on {sourceLabel}
                <ArrowUpRight size={14} />
              </a>
            ) : (
              <FactBadge>Source link unavailable</FactBadge>
            )}
          </div>

          <p style={styles.headerCopy}>
            This page separates listing facts from benchmark assumptions so you can quickly see what came from the source, what was inferred, and what is driving the underwriting model.
          </p>

          <div style={styles.summaryGrid}>
            <SummaryCard
              icon={<Wallet size={16} />}
              label="Asking price"
              value={`$${listing.price.toLocaleString("en-CA")}`}
              detail={`${listing.currency}${pricePerUnit ? ` · ${pricePerUnit.toLocaleString("en-CA")} per unit` : ""}`}
            />
            <SummaryCard
              icon={<ChartColumnIncreasing size={16} />}
              label="Deal score"
              value={evaluation ? evaluation.combinedScore.toFixed(1) : "—"}
              detail={evaluation ? `Cashflow ${evaluation.cashflowScore.toFixed(1)} · Equity ${evaluation.equityGrowthScore.toFixed(1)}` : "No evaluation yet"}
            />
            <SummaryCard
              icon={<MapPinned size={16} />}
              label="Current market rent"
              value={marketBenchmark.benchmarkCurrentRent != null ? `$${marketBenchmark.benchmarkCurrentRent.toLocaleString("en-CA")}/mo` : "—"}
              detail={benchmarkRentLabel}
            />
            <SummaryCard
              icon={<Building2 size={16} />}
              label="Mapped market"
              value={marketBenchmark.mappedMarketCity ?? "—"}
              detail={marketBenchmark.mappedZone ?? "City-level fallback"}
            />
          </div>
        </div>

        {photos.length > 0 ? (
          <div style={styles.photoRail}>
            {photos.slice(0, 5).map((url, i) => (
              <img key={i} src={url} alt="" style={styles.photo} />
            ))}
          </div>
        ) : (
          <div style={styles.emptyPhotos}>No photos</div>
        )}
      </header>

      {profile.hasInferredFields && (
        <div style={styles.warnBanner}>
          <strong>Note:</strong> Some property characteristics were inferred by our system due to limited source data.
        </div>
      )}

      <section style={styles.panel}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
          <div style={styles.iconChip}>
            <Database size={18} />
          </div>
          <div>
            <h2 style={styles.panelTitle}>Data confidence & transparency</h2>
            <p style={styles.panelSubtitle}>
              Use this panel to see how much of the page is based on listing facts versus inferred or modeled fields.
            </p>
          </div>
        </div>

        <div style={styles.kpiGrid}>
          <KpiCard value={provenanceCounts.source} label="Source listing fields" tone="default" />
          <KpiCard value={provenanceCounts.inferred} label="Inferred" tone="default" />
          <KpiCard value={provenanceCounts.marketBenchmark} label="Market benchmark" tone="blue" />
          <KpiCard value={provenanceCounts.assumed} label="Assumed" tone="amber" />
          <KpiCard value={provenanceCounts.userOverride} label="User override" tone="violet" />
        </div>
        {missingInputsNote && (
          <p style={{ marginTop: 16, fontSize: 14, color: "#475569" }}>
            <strong>Missing inputs:</strong> {missingInputsNote}
          </p>
        )}
      </section>

      <section style={styles.panel}>
        <h2 style={styles.panelTitle}>Market benchmarks</h2>
        <p style={{ ...styles.panelSubtitle, marginBottom: 16 }}>
          These are benchmark references used to calibrate underwriting. They are not listing facts and should be checked against your rent roll, comps, and business plan.
        </p>

        <div style={styles.benchmarkLayout}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <BenchmarkRow
              label="Mapped market"
              value={`${marketBenchmark.mappedMarketCity ?? "—"}${marketBenchmark.mappedZone ? ` · ${marketBenchmark.mappedZone}` : ""}`}
            />
            <BenchmarkRow
              label="Zone match"
              value={`${marketBenchmark.zoneMatchMethod ?? "—"} · ${marketBenchmark.benchmarkConfidence} confidence`}
            />
            <BenchmarkRow
              label="Vacancy rate"
              value={marketBenchmark.benchmarkVacancyRate != null ? `${(marketBenchmark.benchmarkVacancyRate * 100).toFixed(1)}%` : "—"}
              suffix={
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <ProvenanceBadge
                    source={marketBenchmark.benchmarkVacancyProvenance}
                    detail={marketBenchmark.benchmarkVacancyLabel}
                  />
                </div>
              }
            />
            <BenchmarkRow
              label="Current market rent"
              value={marketBenchmark.benchmarkCurrentRent != null ? `$${marketBenchmark.benchmarkCurrentRent.toLocaleString("en-CA")}/mo` : "—"}
              suffix={
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <ProvenanceBadge
                    source={marketBenchmark.benchmarkCurrentRentProvenance}
                    detail={marketBenchmark.benchmarkCurrentRentLabel}
                  />
                </div>
              }
            />
            <BenchmarkRow
              label="Market rent on turnover"
              value={marketBenchmark.benchmarkTurnoverRent != null ? `$${marketBenchmark.benchmarkTurnoverRent.toLocaleString("en-CA")}/mo` : "—"}
              suffix={
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <ProvenanceBadge
                    source={marketBenchmark.benchmarkTurnoverRentProvenance}
                    detail={marketBenchmark.benchmarkTurnoverRentLabel}
                  />
                </div>
              }
            />
            <BenchmarkRow
              label="Rent growth (YoY)"
              value={marketBenchmark.benchmarkRentGrowthRateAnnual != null ? `${(marketBenchmark.benchmarkRentGrowthRateAnnual * 100).toFixed(1)}%` : "—"}
              suffix={
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <ProvenanceBadge
                    source={marketBenchmark.benchmarkRentGrowthProvenance}
                    detail={marketBenchmark.benchmarkRentGrowthLabel}
                  />
                </div>
              }
            />
          </div>

          <div style={styles.sidePanel}>
            <h3 style={{ margin: 0, fontSize: 14, color: "#1e293b" }}>How market rent on turnover is formed</h3>
            <p style={{ margin: "8px 0 0", fontSize: 14, color: "#475569", lineHeight: 1.6 }}>
              Current market rent is anchored to occupied-unit or average-rent data. Market rent on turnover uses direct vacant-unit data first, then a conservative inferred turnover premium when the vacant row is suppressed.
            </p>
            <DataRow label="Source year" value={String(marketBenchmark.benchmarkSourceYear ?? "—")} />
            <DataRow label="Asset class" value={String(marketBenchmark.benchmarkAssetClass)} />
            <DataRow label="Bedroom basis" value={String(marketBenchmark.benchmarkBedroomBasis ?? "—")} />
            <DataRow
              label="Proxy rent reference"
              value={marketBenchmark.benchmarkRenovatedRentProxy != null ? `$${marketBenchmark.benchmarkRenovatedRentProxy.toLocaleString("en-CA")}/mo` : "—"}
            />
          </div>
        </div>
      </section>

      <section style={styles.panel}>
        <h2 style={styles.panelTitle}>Investment paths</h2>
        <p style={{ ...styles.panelSubtitle, marginBottom: 16 }}>
          Review the business plan first, then compare financing scenarios inside it. The context strip below uses saved profile defaults but lets you override them for this listing only.
        </p>
        <ListingDetailClient
          initialWorkspace={initialWorkspace}
          workspaceInput={workspaceInput}
          investorContextDefaults={investorContextDefaults}
        />
      </section>

      {evaluation && (evaluation.cashflowNotes || evaluation.equityNotes) && (
        <section style={{ ...styles.panel, backgroundColor: "#f8fafc" }}>
          <h3 style={{ margin: 0, fontSize: 14, color: "#334155" }}>Evaluation notes (supporting)</h3>
          {evaluation.cashflowNotes && <p style={{ marginTop: 8, fontSize: 14, color: "#475569" }}>{evaluation.cashflowNotes}</p>}
          {evaluation.equityNotes && <p style={{ marginTop: 8, fontSize: 14, color: "#475569" }}>{evaluation.equityNotes}</p>}
        </section>
      )}
    </div>
  );
}

function BenchmarkRow({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
  suffix?: ReactNode;
}) {
  return (
    <div style={styles.dataRow}>
      <div>
        <div style={styles.dataLabel}>{label}</div>
        <div style={styles.dataValue}>{value}</div>
      </div>
      {suffix}
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div style={styles.summaryCard}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#64748b", fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>
        {icon}
        {label}
      </div>
      <div style={{ marginTop: 10, fontSize: "clamp(28px,2.5vw,34px)", fontWeight: 700, letterSpacing: "-0.03em", color: "#0f172a" }}>{value}</div>
      <div style={{ marginTop: 6, fontSize: 15, color: "#64748b" }}>{detail}</div>
    </div>
  );
}

function HeaderBadge({ children }: { children: ReactNode }) {
  return <span style={styles.headerBadge}>{children}</span>;
}

function FactBadge({ children }: { children: ReactNode }) {
  return <span style={styles.factBadge}>{children}</span>;
}

function KpiCard({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: "default" | "blue" | "amber" | "violet";
}) {
  const tones: Record<string, CSSProperties> = {
    default: { backgroundColor: "#fff", borderColor: "#e2e8f0" },
    blue: { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" },
    amber: { backgroundColor: "#fffbeb", borderColor: "#fde68a" },
    violet: { backgroundColor: "#f5f3ff", borderColor: "#ddd6fe" },
  };

  return (
    <div style={{ ...styles.kpiCard, ...tones[tone] }}>
      <div style={{ fontSize: 28, fontWeight: 700, color: "#0f172a" }}>{value}</div>
      <div style={{ marginTop: 6, fontSize: 13, color: "#64748b" }}>{label}</div>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, paddingTop: 12, borderTop: "1px solid #e2e8f0", marginTop: 12 }}>
      <span style={{ fontSize: 13, color: "#64748b" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", textAlign: "right" }}>{value}</span>
    </div>
  );
}

function parsePhotoUrls(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function confidenceStyle(confidence: "high" | "medium" | "low"): CSSProperties {
  if (confidence === "high") return { ...styles.confidenceBadge, color: "#166534", backgroundColor: "#ecfdf3" };
  if (confidence === "low") return { ...styles.confidenceBadge, color: "#92400e", backgroundColor: "#fffbeb" };
  return { ...styles.confidenceBadge, color: "#475569", backgroundColor: "#f8fafc" };
}

const styles: Record<string, CSSProperties> = {
  page: {
    width: "min(1440px, calc(100vw - 48px))",
    margin: "0 auto",
    padding: "16px 0 48px",
    display: "grid",
    gap: 24,
  },
  backLink: {
    color: "#475569",
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 600,
  },
  headerWrap: {
    display: "grid",
    gap: 16,
  },
  headerCard: {
    backgroundColor: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 22,
    padding: 18,
    boxShadow: "0 10px 28px rgba(15,23,42,0.06)",
  },
  badgeRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
  },
  headerBadge: {
    borderRadius: 999,
    border: "1px solid #e2e8f0",
    backgroundColor: "#f8fafc",
    padding: "8px 12px",
    fontSize: 13,
    fontWeight: 600,
    color: "#334155",
  },
  confidenceBadge: {
    borderRadius: 999,
    padding: "8px 12px",
    fontSize: 13,
    fontWeight: 600,
  },
  address: {
    margin: "18px 0 0",
    maxWidth: 1120,
    fontSize: "clamp(34px, 4.2vw, 44px)",
    lineHeight: 1.04,
    letterSpacing: "-0.05em",
    color: "#0f172a",
  },
  location: {
    margin: "14px 0 0",
    fontSize: 22,
    color: "#475569",
  },
  factBadge: {
    borderRadius: 999,
    backgroundColor: "#f8fafc",
    border: "1px solid #e2e8f0",
    padding: "8px 12px",
    fontSize: 13,
    fontWeight: 600,
    color: "#334155",
  },
  sourceLink: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    color: "#2563eb",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 700,
  },
  headerCopy: {
    margin: "18px 0 0",
    maxWidth: 1100,
    fontSize: 15,
    lineHeight: 1.75,
    color: "#475569",
  },
  summaryGrid: {
    marginTop: 22,
    display: "grid",
    gap: 10,
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  },
  summaryCard: {
    borderRadius: 18,
    border: "1px solid #e2e8f0",
    backgroundColor: "#fff",
    padding: 18,
  },
  photoRail: {
    display: "grid",
    gap: 12,
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  },
  photo: {
    width: "100%",
    height: 160,
    objectFit: "cover",
    borderRadius: 16,
    border: "1px solid #e2e8f0",
  },
  emptyPhotos: {
    borderRadius: 18,
    border: "1px dashed #cbd5e1",
    backgroundColor: "#f8fafc",
    color: "#64748b",
    display: "grid",
    placeItems: "center",
    minHeight: 160,
  },
  warnBanner: {
    borderRadius: 14,
    border: "1px solid #fcd34d",
    backgroundColor: "#fffbeb",
    padding: "14px 16px",
    color: "#92400e",
    fontSize: 14,
  },
  panel: {
    backgroundColor: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 22,
    padding: 22,
    boxShadow: "0 8px 24px rgba(15,23,42,0.04)",
  },
  panelTitle: {
    margin: 0,
    fontSize: 20,
    color: "#0f172a",
  },
  panelSubtitle: {
    margin: "6px 0 0",
    fontSize: 14,
    color: "#64748b",
    lineHeight: 1.7,
  },
  iconChip: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#eff6ff",
    color: "#2563eb",
    display: "grid",
    placeItems: "center",
    border: "1px solid #bfdbfe",
    flexShrink: 0,
  },
  kpiGrid: {
    display: "grid",
    gap: 12,
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  },
  kpiCard: {
    borderRadius: 16,
    border: "1px solid #e2e8f0",
    padding: 18,
  },
  benchmarkLayout: {
    display: "grid",
    gap: 16,
    gridTemplateColumns: "minmax(0, 1.4fr) minmax(280px, 0.9fr)",
  },
  sidePanel: {
    borderRadius: 18,
    border: "1px solid #e2e8f0",
    backgroundColor: "#f8fafc",
    padding: 18,
  },
  dataRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    borderRadius: 16,
    border: "1px solid #e2e8f0",
    backgroundColor: "#fff",
    padding: 16,
  },
  dataLabel: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "#64748b",
  },
  dataValue: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: 600,
    color: "#0f172a",
  },
};
