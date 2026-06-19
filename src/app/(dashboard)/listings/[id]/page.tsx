import type { CSSProperties, ReactNode } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import {
  ArrowUpRight,
  Database,
} from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getListingDetailPayload } from "@/lib/listing-detail";
import { ListingPhotoGallery } from "@/components/listing/ListingPhotoGallery";
import { ProvenanceBadge } from "@/components/listing/ProvenanceBadge";
import { ListingDetailClient } from "@/components/strategies/ListingDetailClient";
import { buildInvestorContextDefaults, type InvestorProfileDefaults } from "@/lib/investor-context";
import {
  buildInvestmentWorkspace,
  selectDefaultBusinessPlan,
  selectDefaultScenario,
} from "@/lib/investment-workspace";
import {
  buildFinanceabilityLaneSummary,
  type FinanceabilityLaneSummary,
  type FinanceabilityLaneSummaryItem,
} from "@/lib/financeability-lanes";
import type { StrategyModel } from "@/lib/strategy-modeling";
import { computeCashflowProjection } from "@/lib/finance";
import { toFinanceOperatingExpenseItems } from "@/lib/operating-expenses";
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
  const financeabilitySummary = buildFinanceabilityLaneSummary(initialWorkspace);
  const defaultBusinessPlanId = selectDefaultBusinessPlan(initialWorkspace);
  const defaultScenarioId = selectDefaultScenario(initialWorkspace, defaultBusinessPlanId);
  const defaultScenarioModel = initialWorkspace.scenarioModels[defaultScenarioId];
  const defaultBusinessPlanName = initialWorkspace.businessPlanMeta[defaultBusinessPlanId]?.name ?? "Default business plan";
  const defaultScenarioName = initialWorkspace.scenarioMeta[defaultScenarioId]?.name ?? "Default strategy";
  const investorSnapshot = buildInvestorSnapshot(
    defaultScenarioModel,
    defaultScenarioName,
    listing.price
  );
  const underwritingHandoff = defaultScenarioModel
    ? buildUnderwritingHandoff(defaultScenarioModel, defaultBusinessPlanName, defaultScenarioName)
    : null;

  const photos = parsePhotoUrls(listing.photoUrls);
  const displayAddress = formatListingAddress(listing.address);
  const isInactiveListing = listing.listingStatus === "sold" || listing.isLinkActive === false;
  const inactiveSince = listing.soldAt ?? listing.unavailableSince ?? null;
  const firstAddedLabel = formatShortDate(listing.createdAt);
  const nightlyVerifiedLabel = formatDateTime(listing.lastSyncRunAt ?? listing.lastSeenAt ?? null) ?? "n/a";
  const isNewListing = isWithinLastDays(listing.createdAt, 7);
  const sourceLabel = listing.source.toLowerCase().includes("centris")
    ? "Centris"
    : listing.source.toLowerCase().includes("multi")
      ? "Multiple sources"
    : listing.source.toLowerCase().includes("realtor")
      ? "Realtor.ca"
      : "Source";
  const pricePerUnit = listing.units > 0 ? Math.round(listing.price / listing.units) : null;
  const sourceDescription = formatListingDescription(listing.description);
  const sourceSignalItems = extractSourceSignalItems(listing.description);
  const listingFactItems: ListingFactItem[] = [
    {
      label: "Asking price",
      value: formatCurrency(listing.price),
      detail: pricePerUnit ? `${formatCurrency(pricePerUnit)} per unit` : listing.currency,
    },
    {
      label: "Unit count",
      value: `${listing.units} ${listing.units === 1 ? "unit" : "units"}`,
      detail: listing.units >= 5 ? "5+ unit lending lane should be verified." : "Small-rental screen.",
    },
    {
      label: "Property type",
      value: listing.propertyType,
      detail: `Captured from ${sourceLabel}.`,
    },
    {
      label: "Beds / baths",
      value: `${listing.bedrooms ?? "n/a"} / ${listing.bathrooms ?? "n/a"}`,
      detail: "Source-provided where available.",
    },
    {
      label: "Size",
      value: listing.squareFeet != null ? `${listing.squareFeet.toLocaleString("en-CA")} sq ft` : "n/a",
      detail: listing.lotSizeSqFt != null ? `${listing.lotSizeSqFt.toLocaleString("en-CA")} sq ft lot` : "Building or lot size may be missing.",
    },
    {
      label: "Year built",
      value: listing.yearBuilt != null ? String(listing.yearBuilt) : "n/a",
      detail: listing.yearBuilt != null ? "Source-provided construction year." : "Age-sensitive expenses need manual check.",
    },
  ];
  const sourceFreshnessItems: ListingFreshnessItem[] = [
    {
      label: "Source status",
      value: isInactiveListing ? "Unavailable" : listing.isLinkActive === false ? "Link inactive" : "Active inventory",
      detail: isInactiveListing
        ? "Retired from active matching; use as comp or cleanup record."
        : "Still included in the active listing queue.",
      tone: isInactiveListing ? "amber" : "green",
    },
    {
      label: "First added",
      value: firstAddedLabel,
      detail: "First captured by the platform.",
      tone: "slate",
    },
    {
      label: "Last nightly check",
      value: nightlyVerifiedLabel,
      detail: "Latest ingestion or source-seen timestamp.",
      tone: nightlyVerifiedLabel === "n/a" ? "amber" : "blue",
    },
    {
      label: "Captured from",
      value: sourceLabel,
      detail: listing.externalId ? `MLS #${listing.externalId}` : "Source listing id unavailable.",
      tone: "blue",
    },
  ];
  const dataConfidenceSummary = buildDataConfidenceSummary(dataConfidence, profile.hasInferredFields, missingInputsNote);
  const benchmarkRentLabel = marketBenchmark.benchmarkCurrentRentLabel || "Market benchmark";
  const turnoverLift =
    marketBenchmark.benchmarkCurrentRent != null && marketBenchmark.benchmarkTurnoverRent != null
      ? marketBenchmark.benchmarkTurnoverRent - marketBenchmark.benchmarkCurrentRent
      : null;
  const marketSignalItems: MarketSignalItem[] = [
    {
      label: "Current rent basis",
      value: marketBenchmark.benchmarkCurrentRent != null ? `${formatCurrency(marketBenchmark.benchmarkCurrentRent)}/mo` : "n/a",
      detail: benchmarkRentLabel,
      tone: marketBenchmark.benchmarkCurrentRent != null ? "blue" : "amber",
    },
    {
      label: "Turnover lift",
      value: turnoverLift != null ? `${turnoverLift > 0 ? "+" : ""}${formatCurrency(turnoverLift)}/mo` : "n/a",
      detail: "Turnover benchmark minus current-rent benchmark.",
      tone: turnoverLift == null ? "amber" : turnoverLift > 0 ? "green" : "slate",
    },
    {
      label: "Vacancy drag",
      value: marketBenchmark.benchmarkVacancyRate != null ? formatPercent(marketBenchmark.benchmarkVacancyRate * 100) : "n/a",
      detail: "Applied to gross scheduled rent in underwriting.",
      tone:
        marketBenchmark.benchmarkVacancyRate == null
          ? "amber"
          : marketBenchmark.benchmarkVacancyRate <= 0.03
            ? "green"
            : "blue",
    },
    {
      label: "Benchmark confidence",
      value: formatConfidenceLabel(marketBenchmark.benchmarkConfidence),
      detail: marketBenchmark.mappedZone
        ? `${marketBenchmark.mappedZone} via ${marketBenchmark.zoneMatchMethod ?? "market match"}`
        : "City-level fallback; verify with local comps.",
      tone: marketBenchmark.benchmarkConfidence === "high" ? "green" : marketBenchmark.benchmarkConfidence === "low" ? "amber" : "blue",
    },
  ];
  const dataTrustItems: DataTrustItem[] = [
    {
      label: "Source facts",
      value: `${provenanceCounts.source} fields`,
      detail: "Price, address, unit count, photos, and source link drive the listing record.",
      tone: provenanceCounts.source > 0 ? "green" : "amber",
    },
    {
      label: "Market inputs",
      value: formatConfidenceLabel(marketBenchmark.benchmarkConfidence),
      detail: marketBenchmark.mappedZone
        ? `${marketBenchmark.mappedZone} benchmark used for rent and vacancy.`
        : "City-level benchmark; verify with comps and rent roll.",
      tone: marketBenchmark.benchmarkConfidence === "high" ? "green" : marketBenchmark.benchmarkConfidence === "low" ? "amber" : "blue",
    },
    {
      label: "Modeled assumptions",
      value: `${provenanceCounts.assumed} inputs`,
      detail: "Debt, expenses, growth, and exit assumptions are editable and should be stress-tested.",
      tone: provenanceCounts.assumed > provenanceCounts.source ? "amber" : "blue",
    },
    {
      label: "Manual checks",
      value: missingInputsNote ? "Needed" : profile.hasInferredFields ? "Review" : "Light",
      detail: missingInputsNote ?? (profile.hasInferredFields ? "Some normalized fields were inferred from sparse listing data." : "No major missing-input warning on this record."),
      tone: missingInputsNote ? "amber" : profile.hasInferredFields ? "blue" : "green",
    },
  ];
  const dealActionItems = buildListingActionPlan({
    investorSnapshot,
    isInactiveListing,
    units: listing.units,
    benchmarkCurrentRent: marketBenchmark.benchmarkCurrentRent,
    benchmarkRentLabel,
  });
  const reviewMapItems: DetailReviewMapItem[] = [
    {
      href: "#listing-returns",
      label: "Returns",
      detail: investorSnapshot
        ? `${formatPercent(investorSnapshot.cashOnCashReturn)} selected-path CoC · ${formatCurrency(investorSnapshot.totalYearOneReturn)} Y1 modeled return`
        : "Selected-path cashflow and return snapshot",
    },
    {
      href: "#listing-photos",
      label: "Photos",
      detail: photos.length ? `${photos.length} listing photo${photos.length === 1 ? "" : "s"}` : "No source photos",
    },
    {
      href: "#listing-facts",
      label: "Facts",
      detail: sourceDescription ? "Source remarks and property facts" : "Core property facts",
    },
    {
      href: "#listing-market",
      label: "Market",
      detail:
        marketBenchmark.benchmarkCurrentRent != null
          ? `${formatCurrency(marketBenchmark.benchmarkCurrentRent)}/mo rent benchmark`
          : "Rent benchmark and vacancy",
    },
    {
      href: "#listing-underwriting",
      label: "Underwrite",
      detail: "Strategy, assumptions, and lender path",
    },
    {
      href: "#listing-data",
      label: "Data",
      detail: `${provenanceCounts.source} source · ${provenanceCounts.inferred} inferred`,
    },
  ];

  return (
    <div className="dashboard-page listing-detail-page" style={styles.page}>
      <Link href="/" style={styles.backLink}>
        {"<- Back to dashboard"}
      </Link>

      <header className="listing-detail-header" style={styles.headerWrap}>
        <div style={styles.headerCard}>
          {isInactiveListing && (
            <div style={styles.inactiveBanner}>
              <strong>Sold / unavailable.</strong>{" "}
              {inactiveSince
                ? `This record was retired on ${new Date(inactiveSince).toLocaleDateString("en-CA", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                  })}.`
                : "This record is no longer part of the active inventory."}
            </div>
          )}
          <div className="listing-primary-badge-row" style={styles.badgeRow}>
            <HeaderBadge>{listing.propertyType}</HeaderBadge>
            <HeaderBadge>
              {listing.units} {listing.units === 1 ? "unit" : "units"}
            </HeaderBadge>
            {listing.externalId && <HeaderBadge>MLS #{listing.externalId}</HeaderBadge>}
            {isNewListing && <FreshListingBadge>New: added in last 7 days</FreshListingBadge>}
          </div>

          <h1 className="listing-address-title" style={styles.address}>{displayAddress}</h1>

          <p className="listing-location" style={styles.location}>
            {listing.city}, {listing.province}
            {listing.postalCode && ` · ${listing.postalCode}`}
          </p>

          <ListingHeaderCommandPanel
            price={listing.price}
            pricePerUnit={pricePerUnit}
            units={listing.units}
            snapshot={investorSnapshot}
            financeabilitySummary={financeabilitySummary}
            primaryAction={dealActionItems[0]}
            isInactiveListing={isInactiveListing}
            sourceLabel={sourceLabel}
            listingUrl={listing.listingUrl}
            firstAddedLabel={firstAddedLabel}
            nightlyVerifiedLabel={nightlyVerifiedLabel}
          />

          <div className="listing-header-secondary-row" style={styles.badgeRow}>
            {listing.bedrooms != null && <FactBadge>{listing.bedrooms} bed</FactBadge>}
            {listing.bathrooms != null && <FactBadge>{listing.bathrooms} bath</FactBadge>}
            {listing.squareFeet != null && <FactBadge>{listing.squareFeet.toLocaleString()} sq ft</FactBadge>}
            {listing.yearBuilt != null && <FactBadge>Built {listing.yearBuilt}</FactBadge>}
            <FactBadge>First added {firstAddedLabel}</FactBadge>
            <FactBadge>Last check {nightlyVerifiedLabel}</FactBadge>
            {listing.listingUrl ? (
              <a href={listing.listingUrl} target="_blank" rel="noopener noreferrer" style={styles.sourceLink}>
                Open on {sourceLabel}
                <ArrowUpRight size={14} />
              </a>
            ) : (
              <FactBadge>Source link unavailable</FactBadge>
            )}
          </div>

          <p className="listing-header-copy" style={styles.headerCopy}>
            Use the deal verdict as the offer-triage read, then open the return model, photos, source facts, and underwriting proof below.
          </p>
        </div>
      </header>

      <section
        id="listing-photos"
        className="listing-opening-panel listing-detail-section-anchor"
        aria-label="Listing photos and investor return snapshot"
        style={styles.openingPanel}
      >
        <div className="listing-opening-grid" style={styles.openingGrid}>
          <div className="listing-opening-returns" style={styles.openingReturns}>
            {investorSnapshot ? (
              <InvestorHeroSnapshot
                snapshot={investorSnapshot}
                primaryAction={dealActionItems[0]}
                units={listing.units}
                flush
              />
            ) : (
              <div style={styles.snapshotUnavailable}>
                <p style={styles.openingEyebrow}>Selected path first glance</p>
                <h2 style={styles.openingTitle}>Return model unavailable</h2>
                <p style={styles.panelSubtitle}>
                  The listing facts loaded, but the page could not build the default investment path yet. Open underwriting to fill the missing inputs.
                </p>
                <a href="#listing-underwriting" style={styles.snapshotUnavailableAction}>
                  Open underwriting
                  <ArrowUpRight size={13} />
                </a>
              </div>
            )}
          </div>

          <div className="listing-opening-media" style={styles.openingMedia}>
            <div style={styles.openingMediaHeader}>
              <div>
                <p style={styles.openingEyebrow}>Visual check</p>
                <h2 style={styles.openingTitle}>Photos and source context</h2>
              </div>
              <span style={styles.openingPill}>{photos.length ? `${photos.length} photos` : "No photos"}</span>
            </div>
            <ListingPhotoGallery photos={photos} address={displayAddress} />
          </div>
        </div>
      </section>

      {investorSnapshot && <ListingReturnStickyBar snapshot={investorSnapshot} primaryAction={dealActionItems[0]} />}

      <ListingDecisionCommandBar
        primaryAction={dealActionItems[0]}
        secondaryItems={dealActionItems.slice(1, 3)}
        reviewItems={reviewMapItems}
      />

      <ListingFreshnessStrip items={sourceFreshnessItems} />

      {profile.hasInferredFields && (
        <div style={styles.warnBanner}>
          <strong>Note:</strong> Some property characteristics were inferred by our system due to limited source data.
        </div>
      )}

      <section id="listing-facts" className="listing-detail-section-anchor" style={styles.listingFactsPanel}>
        <SourceListingSnapshot
          address={displayAddress}
          sourceLabel={sourceLabel}
          listingUrl={listing.listingUrl}
          description={sourceDescription}
          signals={sourceSignalItems}
          facts={listingFactItems}
        />
      </section>

      <section id="listing-market" className="listing-detail-section-anchor" style={styles.panel}>
        <h2 style={styles.panelTitle}>Market benchmarks</h2>
        <p style={{ ...styles.panelSubtitle, marginBottom: 16 }}>
          These are benchmark references used to calibrate underwriting. They are not listing facts and should be checked against your rent roll, comps, and business plan.
        </p>

        <MarketSignalStrip items={marketSignalItems} />

        <div className="dashboard-two-column" style={styles.benchmarkLayout}>
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

      <section id="listing-underwriting" className="listing-detail-section-anchor" style={styles.panel}>
        <h2 style={styles.panelTitle}>Investment paths</h2>
        <p style={{ ...styles.panelSubtitle, marginBottom: 16 }}>
          Review the business plan first, then compare financing scenarios inside it. The context strip below uses saved profile defaults but lets you override them for this listing only.
        </p>
        {underwritingHandoff && <UnderwritingHandoffPanel handoff={underwritingHandoff} />}
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

      <section id="listing-data" className="listing-detail-section-anchor" style={styles.panel}>
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

        <DataTrustPanel summary={dataConfidenceSummary} items={dataTrustItems} />

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
    </div>
  );
}

type InvestorSnapshot = {
  strategyName: string;
  cashflowYears: Array<{
    year: number;
    annualCashflow: number;
    monthlyCashflow: number;
    cumulativeCashflow: number;
    dscr: number;
  }>;
  equityRequired: number;
  cashOnCashReturn: number | null;
  yearOneRoi: number | null;
  yearOneCashflow: number;
  yearOneDebtPaydown: number;
  yearOneAppreciation: number;
  stabilizationLift: number | null;
  totalYearOneReturn: number;
  cocCalculation: string;
  roiCalculation: string;
  roiBasis: string;
  basisPrice: number;
  downPaymentAmount: number;
  downPaymentPct: number | null;
  loanAmount: number;
  ltvPct: number | null;
  mortgageRate: number;
  mortgageRateLabel: string;
  amortizationYears: number;
  closingCosts: number;
  capitalBudget: number;
  modeledUnits: number;
  modeledRentPerUnit: number;
  unitMonthlyRents: number[] | null;
  rentRollMonthly: number;
  rentRollBasisDetail: string;
  rentRollFormula: string;
  modeledRentBasisLabel: string;
  propertyTaxAnnual: number;
  propertyTaxBasisLabel: string;
  propertyTaxDetail: string;
  managementFeePct: number;
  managementAnnual: number;
  managementDetail: string;
  grossScheduledRent: number;
  effectiveGrossIncome: number;
  operatingExpenses: number;
  operatingExpenseRatio: number;
  noi: number;
  annualDebtService: number;
  dscr: number;
};

type DetailReviewMapItem = {
  href: string;
  label: string;
  detail: string;
};

type ListingActionTone = "green" | "amber" | "red" | "blue" | "slate";

type ListingActionItem = {
  label: string;
  value: string;
  detail: string;
  href: string;
  action: string;
  tone: ListingActionTone;
};

type ListingFreshnessItem = {
  label: string;
  value: string;
  detail: string;
  tone: ListingActionTone;
};

type ListingFactItem = {
  label: string;
  value: string;
  detail: string;
};

type SourceSignalItem = {
  label: string;
  value: string;
  detail: string;
  tone: ListingActionTone;
};

type MarketSignalItem = {
  label: string;
  value: string;
  detail: string;
  tone: ListingActionTone;
};

type UnderwritingHandoff = {
  businessPlanName: string;
  scenarioName: string;
  overview: string;
  items: Array<{
    label: string;
    value: string;
    detail: string;
    tone: ListingActionTone;
  }>;
  risks: string[];
};

type DataConfidenceSummary = {
  label: string;
  headline: string;
  detail: string;
  tone: ListingActionTone;
};

type DataTrustItem = {
  label: string;
  value: string;
  detail: string;
  tone: ListingActionTone;
};

function FinanceabilityLanesDisclosure({ summary }: { summary: FinanceabilityLaneSummary }) {
  const lane = summary.recommendedLane;
  const metrics = summary.topMetrics;
  const candidateLanes = summary.eligibleLanes.slice(0, 4);
  const blockedCount = summary.blockedLanes.length;
  const verdictTone = financeabilityTone(lane);
  const primaryWarning = summary.policyWarnings[0];

  return (
    <details
      className="listing-financeability-panel"
      aria-label="Financing lane details"
      style={styles.financeabilityDisclosure}
    >
      <summary className="listing-detail-disclosure-summary" style={styles.financeabilityDisclosureSummary}>
        <div style={{ minWidth: 0 }}>
          <span style={styles.heroDisclosureEyebrow}>Financing lanes</span>
          <strong style={styles.financeabilityDisclosureTitle}>Show lender lane proof and alternatives</strong>
          <span style={styles.financeabilityDisclosureCopy}>
            {lane
              ? `${lane.label}: ${financeabilityLaneDetail(lane)}`
              : "No financing lane selected yet; open this before relying on the deal model."}
          </span>
        </div>
        <div style={{ ...styles.financeabilityVerdictBadge, ...financeabilityVerdictStyle(verdictTone) }}>
          {lane ? financeabilityStatusLabel(lane) : "Needs data"}
        </div>
      </summary>

      <div className="listing-financeability-grid" style={styles.financeabilityGrid}>
        <FinanceabilityMetricCard
          label="Most plausible lane"
          value={lane?.label ?? "n/a"}
          detail={lane ? financeabilityLaneDetail(lane) : "No lane selected yet."}
          tone={verdictTone}
        />
        <FinanceabilityMetricCard
          label="DSCR"
          value={metrics?.dscr != null ? formatRatio(metrics.dscr) : "n/a"}
          detail={metrics?.annualDebtService != null ? `${formatCurrency(metrics.annualDebtService)}/yr debt service` : "Debt service unavailable"}
          tone={metrics?.dscr == null ? "slate" : metrics.dscr >= 1.25 ? "green" : metrics.dscr >= 1 ? "amber" : "red"}
        />
        <FinanceabilityMetricCard
          label="Cashflow"
          value={metrics?.annualCashflow != null ? `${formatCurrency(metrics.annualCashflow)}/yr` : "n/a"}
          detail={metrics?.cashOnCashReturnPct != null ? `${formatPercent(metrics.cashOnCashReturnPct)} CoC on modeled equity` : "CoC unavailable"}
          tone={metrics?.annualCashflow == null ? "slate" : metrics.annualCashflow >= 0 ? "green" : "red"}
        />
        <FinanceabilityMetricCard
          label="Leverage"
          value={metrics?.ltvPct != null ? `${formatPercent(metrics.ltvPct * 100)} LTV` : "n/a"}
          detail={`${candidateLanes.length} candidate lane${candidateLanes.length === 1 ? "" : "s"} · ${blockedCount} blocked`}
          tone="blue"
        />
      </div>

      <div className="listing-financeability-lanes" style={styles.financeabilityLaneGrid}>
        {candidateLanes.map((candidate) => (
          <div key={candidate.id} style={styles.financeabilityLaneCard}>
            <div style={styles.financeabilityLaneTop}>
              <span style={styles.financeabilityLaneLabel}>{candidate.label}</span>
              <span style={{ ...styles.financeabilityLanePill, ...financeabilityVerdictStyle(financeabilityTone(candidate)) }}>
                {financeabilityStatusLabel(candidate)}
              </span>
            </div>
            <p style={styles.financeabilityLaneReason}>{candidate.reason}</p>
          </div>
        ))}
      </div>

      {(summary.manualVerificationItems.length > 0 || primaryWarning) && (
        <div style={styles.financeabilityProofBox}>
          <div>
            <p style={styles.financeabilityProofEyebrow}>Before relying on this lane</p>
            <h3 style={styles.financeabilityProofTitle}>
              {summary.manualVerificationItems.length > 0
                ? "Manual lender verification is part of the workflow"
                : primaryWarning?.title}
            </h3>
          </div>
          <div style={styles.financeabilityProofList}>
            {summary.manualVerificationItems.slice(0, 3).map((item) => (
              <span key={item.id} style={styles.financeabilityProofChip}>
                {item.label}
              </span>
            ))}
            {primaryWarning && (
              <span style={{ ...styles.financeabilityProofChip, borderColor: "#fed7aa", backgroundColor: "#fff7ed", color: "#9a3412" }}>
                {primaryWarning.title}
              </span>
            )}
          </div>
          <p style={styles.financeabilityProofCopy}>
            This is a modeled screen, not a commitment to lend. Bank and insurer rules can change; store policy source, capture date, confidence, and broker/lender confirmation before offer work.
          </p>
        </div>
      )}
    </details>
  );
}

function FinanceabilityMetricCard(props: {
  label: string;
  value: string;
  detail: string;
  tone: ListingActionTone;
}) {
  const palette = financeabilityMetricStyle(props.tone);

  return (
    <div style={styles.financeabilityMetricCard}>
      <span style={{ ...styles.financeabilityMetricLabel, color: palette.label }}>{props.label}</span>
      <strong style={{ ...styles.financeabilityMetricValue, color: palette.value }}>{props.value}</strong>
      <span style={styles.financeabilityMetricDetail}>{props.detail}</span>
    </div>
  );
}

function buildUnifiedDealVerdict({
  primaryAction,
  cashflow,
  cashOnCashReturn,
  dscr,
  lane,
  isInactiveListing,
}: {
  primaryAction: ListingActionItem;
  cashflow: number | null;
  cashOnCashReturn: number | null;
  dscr: number | null;
  lane: FinanceabilityLaneSummaryItem | null;
  isInactiveListing: boolean;
}): { title: string; detail: string } {
  if (isInactiveListing) {
    return {
      title: "Inactive source: use as a comp, not an active deal",
      detail: primaryAction.detail,
    };
  }

  const riskSignals = [
    cashflow != null && cashflow < 0 ? `negative Y1 cashflow (${formatCurrency(cashflow)})` : null,
    cashOnCashReturn != null && cashOnCashReturn < 0 ? `negative CoC (${formatPercent(cashOnCashReturn)})` : null,
    dscr != null && dscr < 1.25 ? `weak DSCR (${formatRatio(dscr)})` : null,
    lane?.status === "verify" ? "lender confirmation required" : null,
    lane?.status === "blocked" ? "financing lane blocked" : null,
  ].filter(Boolean);

  if (riskSignals.length > 0) {
    return {
      title: `${primaryAction.value}: ${riskSignals.slice(0, 2).join(" + ")}`,
      detail: `${primaryAction.detail} Financing read: ${lane ? `${lane.label} is ${financeabilityStatusLabel(lane).toLowerCase()}` : "lane unavailable"}. ${riskSignals.join("; ")}.`,
    };
  }

  return {
    title: primaryAction.value,
    detail: lane
      ? `${primaryAction.detail} Financing read: ${lane.label} is ${financeabilityStatusLabel(lane).toLowerCase()}.`
      : primaryAction.detail,
  };
}

function financeabilityHeadline(lane: FinanceabilityLaneSummaryItem): string {
  if (lane.id === "personal_plex_exception_5_8") {
    return "Possible 5-8 unit personal lane, but verify in writing";
  }
  if (lane.status === "eligible") return "Financeable lane found for first-pass underwriting";
  if (lane.status === "verify") return "Potential lane found, verification required";
  return "Current model blocks this lane";
}

function financeabilityStatusLabel(lane: FinanceabilityLaneSummaryItem): string {
  if (lane.verdict === "recommended" && lane.status === "eligible") return "Recommended";
  if (lane.verdict === "recommended" && lane.status === "verify") return "Recommended · verify";
  if (lane.status === "eligible") return "Candidate";
  if (lane.status === "verify") return "Verify";
  return "Blocked";
}

function financeabilityLaneDetail(lane: FinanceabilityLaneSummaryItem): string {
  const missing = lane.missingInputs.length;
  const checks = lane.manualVerificationItems.length;
  if (lane.id === "personal_plex_exception_5_8") {
    return "Exception path; written lender/broker confirmation required.";
  }
  if (missing > 0) return `${missing} missing input${missing === 1 ? "" : "s"} before confidence improves.`;
  if (checks > 0) return `${checks} manual check${checks === 1 ? "" : "s"} before offer work.`;
  return "Modeled from the selected strategy workspace.";
}

function financeabilityTone(lane: FinanceabilityLaneSummaryItem | null): ListingActionTone {
  if (!lane) return "amber";
  if (lane.status === "eligible") return "green";
  if (lane.status === "verify") return "amber";
  return "red";
}

function financeabilityVerdictStyle(tone: ListingActionTone): CSSProperties {
  if (tone === "green") return { backgroundColor: "#ecfdf3", borderColor: "#bbf7d0", color: "#166534" };
  if (tone === "amber") return { backgroundColor: "#fffbeb", borderColor: "#fde68a", color: "#92400e" };
  if (tone === "red") return { backgroundColor: "#fef2f2", borderColor: "#fecaca", color: "#991b1b" };
  if (tone === "blue") return { backgroundColor: "#eff6ff", borderColor: "#bfdbfe", color: "#1d4ed8" };
  return { backgroundColor: "#f8fafc", borderColor: "#e2e8f0", color: "#475569" };
}

function financeabilityMetricStyle(tone: ListingActionTone): { label: string; value: string } {
  if (tone === "green") return { label: "#166534", value: "#14532d" };
  if (tone === "amber") return { label: "#92400e", value: "#78350f" };
  if (tone === "red") return { label: "#991b1b", value: "#7f1d1d" };
  if (tone === "blue") return { label: "#1d4ed8", value: "#1e3a8a" };
  return { label: "#64748b", value: "#0f172a" };
}

function buildDataConfidenceSummary(
  confidence: "high" | "medium" | "low",
  hasInferredFields: boolean,
  missingInputsNote: string | null
): DataConfidenceSummary {
  if (confidence === "high" && !missingInputsNote && !hasInferredFields) {
    return {
      label: "High confidence",
      headline: "Good enough for first-pass underwriting",
      detail: "The source facts, mapped market, and normalized fields are strong enough for screening. Still verify rent roll, taxes, and financing before making an offer.",
      tone: "green",
    };
  }

  if (confidence === "low" || missingInputsNote) {
    return {
      label: confidence === "low" ? "Low confidence" : "Missing inputs",
      headline: "Use the model as a prompt, not a decision",
      detail: missingInputsNote ?? "Important listing fields were sparse or inferred. Verify source facts and replace assumptions before ranking this deal.",
      tone: "amber",
    };
  }

  return {
    label: "Medium confidence",
    headline: "Screenable, but verify the sensitive inputs",
    detail: hasInferredFields
      ? "Some property characteristics were inferred. The page is useful for triage, but rent roll, unit mix, and expenses should be confirmed."
      : "The page is useful for triage, but market rents and debt assumptions still need deal-specific verification.",
    tone: "blue",
  };
}

function buildUnderwritingHandoff(
  model: StrategyModel,
  businessPlanName: string,
  scenarioName: string
): UnderwritingHandoff {
  const effectiveLtv = model.result.basisPrice > 0 ? (model.result.loanAmount / model.result.basisPrice) * 100 : null;
  const debtTermDetail = [
    effectiveLtv != null ? `${formatPercent(effectiveLtv)} modeled leverage` : null,
    `${formatCurrency(model.result.annualDebtService)}/yr debt service`,
  ].filter(Boolean).join(" · ");
  const cashDetail = [
    `${formatCurrency(model.result.closingCosts)} closing`,
    model.result.capitalBudget > 0 ? `${formatCurrency(model.result.capitalBudget)} capital budget` : null,
  ].filter(Boolean).join(" · ");

  return {
    businessPlanName,
    scenarioName,
    overview: model.overview,
    items: [
      {
        label: "Selected model",
        value: scenarioName,
        detail: businessPlanName,
        tone: "blue",
      },
      {
        label: "Rent used",
        value: `${formatCurrency(model.modeledRentPerUnit.value)}/unit`,
        detail: `${model.modeledUnits.value} modeled unit${model.modeledUnits.value === 1 ? "" : "s"} · ${model.modeledRentBasisLabel}`,
        tone: "blue",
      },
      {
        label: "Debt terms",
        value: `${formatRatePercent(model.assumptions.mortgageRate.value * 100)} / ${Math.round(model.assumptions.amortizationYears.value)} yr`,
        detail: debtTermDetail,
        tone: model.result.dscr >= 1.25 ? "green" : model.result.dscr >= 1 ? "amber" : "red",
      },
      {
        label: "NOI / DSCR",
        value: `${formatCurrency(model.result.noi)} NOI`,
        detail: `${formatRatio(model.result.dscr)} DSCR after operating expenses`,
        tone: model.result.dscr >= 1.25 ? "green" : model.result.dscr >= 1 ? "amber" : "red",
      },
      {
        label: "Cash required",
        value: formatCurrency(model.result.equityRequired),
        detail: cashDetail || "Down payment plus modeled transaction costs.",
        tone: model.result.equityRequired > 0 ? "blue" : "amber",
      },
      {
        label: "Financing envelope",
        value: `${formatPercent(model.programEnvelope.maxLeveragePct * 100)} max ${model.programEnvelope.leverageMetric}`,
        detail: model.programEnvelope.note ?? "Selected program constraint.",
        tone: model.requiresBridgeLoan ? "amber" : "slate",
      },
    ],
    risks: model.keyRisks.slice(0, 2),
  };
}

function buildInvestorSnapshot(
  model: StrategyModel | undefined,
  strategyName: string,
  purchasePrice: number
): InvestorSnapshot | null {
  if (!model) return null;

  const unitMonthlyRents = unitMonthlyRentsForProjection(model);
  const rentRollMonthly =
    unitMonthlyRents?.reduce((sum, rent) => sum + rent, 0) ??
    Math.max(0, model.modeledUnits.value) * Math.max(0, model.modeledRentPerUnit.value);
  const rentRollBasisDetail =
    unitMonthlyRents && unitMonthlyRents.length > 0
      ? `${unitMonthlyRents.length} unit rents are summed directly for GSR, NOI, and hold-period cashflow.`
      : "No complete unit rent schedule is available, so the model uses average rent per unit.";
  const rentRollFormula =
    unitMonthlyRents && unitMonthlyRents.length > 0
      ? `${unitMonthlyRents.map((rent) => formatCurrency(rent)).join(" + ")} = ${formatCurrency(rentRollMonthly)}/mo`
      : `${model.modeledUnits.value} units x ${formatCurrency(model.modeledRentPerUnit.value)}/mo = ${formatCurrency(rentRollMonthly)}/mo`;
  const threeYearProjection = computeCashflowProjection({
    financeInputs: {
      price: purchasePrice,
      units: model.modeledUnits.value,
      avgMonthlyRentPerUnit: model.modeledRentPerUnit.value,
      unitMonthlyRents,
      vacancyRate: model.assumptions.vacancyRate.value,
      operatingExpenseItems: toFinanceOperatingExpenseItems(model.assumptions.operatingExpenses),
      mortgageRate: model.assumptions.mortgageRate.value,
      amortizationYears: model.assumptions.amortizationYears.value,
      ltvPct: model.result.basisPrice > 0 ? model.result.loanAmount / model.result.basisPrice : 0,
      closingCostPct: purchasePrice > 0 ? model.result.closingCosts / purchasePrice : model.assumptions.closingCostPct.value,
      capitalBudget: model.result.capitalBudget,
    },
    holdPeriodYears: Math.max(3, model.assumptions.holdPeriodYears.value),
    rentGrowthRateAnnual: model.assumptions.rentGrowthRateAnnual.value,
    bridge:
      model.requiresBridgeLoan && model.bridgeFacility
        ? {
            enabled: true,
            bridgeMonthlyCarry: model.bridgeFacility.monthlyInterestCarry,
            bridgeTermMonths: model.assumptions.bridgeTermMonths.value,
            takeoutLoanAmount: model.result.loanAmount,
            takeoutMortgageRate: model.assumptions.mortgageRate.value,
            takeoutAmortizationYears: model.assumptions.amortizationYears.value,
          }
        : null,
  });

  const cashflowYears = threeYearProjection.years.slice(0, 3).map((year) => ({
    year: year.year,
    annualCashflow: year.annualCashflow,
    monthlyCashflow: year.monthlyCashflow,
    cumulativeCashflow: year.cumulativeCashflow,
    dscr: year.dscr,
  }));
  const yearOneCashflow = cashflowYears[0]?.annualCashflow ?? model.result.annualCashflow;
  const equityRequired = model.result.equityRequired;
  const downPaymentAmount = Math.max(0, model.result.basisPrice - model.result.loanAmount);
  const downPaymentPct = model.result.basisPrice > 0 ? downPaymentAmount / model.result.basisPrice : null;
  const ltvPct = model.result.basisPrice > 0 ? model.result.loanAmount / model.result.basisPrice : null;
  const propertyTaxLine = model.assumptions.operatingExpenses.find((item) => item.key === "property_tax");
  const propertyTaxEstimate = propertyTaxLine?.propertyTaxEstimate ?? null;
  const propertyTaxAnnual = propertyTaxLine?.amountAnnual.value ?? 0;
  const propertyTaxBasisLabel =
    propertyTaxEstimate?.method === "exact_bill"
      ? "Centris municipal + school tax"
      : propertyTaxEstimate
        ? "Fallback property tax estimate"
        : "Property tax assumption";
  const propertyTaxDetail =
    propertyTaxEstimate?.method === "exact_bill"
      ? [propertyTaxEstimate.taxYear ? `${propertyTaxEstimate.taxYear} source year` : null, propertyTaxLine?.formula]
          .filter(Boolean)
          .join(" · ")
      : propertyTaxLine?.amountAnnual.label ?? "Property tax source unavailable; verify before offer.";
  const managementLine = model.assumptions.operatingExpenses.find((item) => item.key === "management");
  const managementFeePct = managementLine?.rate.value ?? 0;
  const managementAnnual = managementLine?.amountAnnual.value ?? 0;
  const managementDetail =
    managementLine?.amountAnnual.label ??
    (managementFeePct > 0
      ? "Management fee is applied to effective gross income."
      : "Default management fee is 0; add a fee if this will be third-party managed.");
  const cashOnCashReturn =
    equityRequired > 0 && Number.isFinite(yearOneCashflow)
      ? (yearOneCashflow / equityRequired) * 100
      : null;
  const roiBasisParts = [
    `cashflow ${formatCurrency(model.returnBridge.yearOneCashflow)}`,
    `debt paydown ${formatCurrency(model.returnBridge.yearOneDebtPaydown)}`,
    `appreciation ${formatCurrency(model.returnBridge.yearOneAppreciation)}`,
    ...(model.returnBridge.stabilizationLift != null
      ? [`stabilization lift ${formatCurrency(model.returnBridge.stabilizationLift)}`]
      : []),
  ];

  return {
    strategyName,
    cashflowYears,
    equityRequired,
    cashOnCashReturn,
    yearOneRoi: model.returnBridge.totalYearOneRoiPct,
    yearOneCashflow: model.returnBridge.yearOneCashflow,
    yearOneDebtPaydown: model.returnBridge.yearOneDebtPaydown,
    yearOneAppreciation: model.returnBridge.yearOneAppreciation,
    stabilizationLift: model.returnBridge.stabilizationLift,
    totalYearOneReturn: model.returnBridge.totalYearOneReturn,
    cocCalculation:
      equityRequired > 0
        ? `${formatCurrency(yearOneCashflow)} / ${formatCurrency(equityRequired)} = ${formatPercent(cashOnCashReturn)}`
        : "Equity required unavailable",
    roiCalculation:
      equityRequired > 0
        ? `${formatCurrency(model.returnBridge.totalYearOneReturn)} / ${formatCurrency(equityRequired)} = ${formatPercent(model.returnBridge.totalYearOneRoiPct)}`
        : "Equity required unavailable",
    roiBasis: roiBasisParts.join(" + "),
    basisPrice: model.result.basisPrice,
    downPaymentAmount,
    downPaymentPct,
    loanAmount: model.result.loanAmount,
    ltvPct,
    mortgageRate: model.assumptions.mortgageRate.value,
    mortgageRateLabel: model.assumptions.mortgageRate.label,
    amortizationYears: model.assumptions.amortizationYears.value,
    closingCosts: model.result.closingCosts,
    capitalBudget: model.result.capitalBudget,
    modeledUnits: model.modeledUnits.value,
    modeledRentPerUnit: model.modeledRentPerUnit.value,
    unitMonthlyRents: unitMonthlyRents ?? null,
    rentRollMonthly,
    rentRollBasisDetail,
    rentRollFormula,
    modeledRentBasisLabel: model.modeledRentBasisLabel,
    propertyTaxAnnual,
    propertyTaxBasisLabel,
    propertyTaxDetail,
    managementFeePct,
    managementAnnual,
    managementDetail,
    grossScheduledRent: model.result.grossScheduledRent,
    effectiveGrossIncome: model.result.effectiveGrossIncome,
    operatingExpenses: model.result.operatingExpenses,
    operatingExpenseRatio: model.result.operatingExpenseRatio,
    noi: model.result.noi,
    annualDebtService: model.result.annualDebtService,
    dscr: model.result.dscr,
  };
}

function unitMonthlyRentsForProjection(model: StrategyModel): number[] | undefined {
  const modeledUnitCount = Math.max(0, Math.round(model.modeledUnits.value));
  if (modeledUnitCount <= 0 || model.unitRentSchedule.length !== modeledUnitCount) {
    return undefined;
  }

  return model.unitRentSchedule.map((unit) => Math.max(0, unit.modeledRent.value));
}

function buildListingActionPlan({
  investorSnapshot,
  isInactiveListing,
  units,
  benchmarkCurrentRent,
  benchmarkRentLabel,
}: {
  investorSnapshot: InvestorSnapshot | null;
  isInactiveListing: boolean;
  units: number;
  benchmarkCurrentRent: number | null;
  benchmarkRentLabel: string;
}): ListingActionItem[] {
  const threeYearCashflow =
    investorSnapshot?.cashflowYears.reduce((sum, year) => sum + year.annualCashflow, 0) ?? null;
  const yearOneCashflow = investorSnapshot?.cashflowYears[0]?.annualCashflow ?? null;
  const positiveReturn =
    investorSnapshot?.cashOnCashReturn != null &&
    investorSnapshot.cashOnCashReturn > 0 &&
    yearOneCashflow != null &&
    yearOneCashflow > 0 &&
    threeYearCashflow != null &&
    threeYearCashflow > 0;

  const primaryAction: ListingActionItem = isInactiveListing
    ? {
        label: "Next move",
        value: "Use as a comp",
        detail: "This record is retired from active inventory, so keep it for price history and source cleanup.",
        href: "#listing-data",
        action: "Review data",
        tone: "amber",
      }
    : !investorSnapshot
      ? {
          label: "Next move",
          value: "Build the model",
          detail: "The listing needs an underwriting path before the platform can call the return quality.",
          href: "#listing-underwriting",
          action: "Open paths",
          tone: "blue",
        }
      : positiveReturn
        ? {
            label: "Next move",
            value: "Underwrite first",
            detail: `${formatPercent(investorSnapshot.cashOnCashReturn)} CoC with ${formatCurrency(threeYearCashflow)} modeled 3-year cashflow.`,
            href: "#listing-underwriting",
            action: "Review path",
            tone: "green",
          }
        : {
            label: "Next move",
            value: "Stress before offer",
            detail: `${formatCurrency(yearOneCashflow ?? 0)} Y1 cashflow. Verify rent roll, expenses, and debt terms before pursuing.`,
            href: "#playbook-assumptions",
            action: "Stress inputs",
            tone: yearOneCashflow != null && yearOneCashflow < 0 ? "red" : "amber",
          };

  const lenderAction: ListingActionItem =
    units >= 5
      ? {
          label: "Lender lane",
          value: "5+ unit review",
          detail: "Confirm personal-lane exception, CMHC path, or commercial takeout before treating debt as executable.",
          href: "#listing-underwriting",
          action: "Check lane",
          tone: "amber",
        }
      : {
          label: "Lender lane",
          value: `${units} ${units === 1 ? "unit" : "units"}`,
          detail: "Confirm owner-occupancy, rental-income inclusion, and down-payment capacity before relying on the card.",
          href: "#listing-underwriting",
          action: "Check debt",
          tone: "blue",
        };

  return [
    primaryAction,
    {
      label: "Rent roll check",
      value: benchmarkCurrentRent != null ? `${formatCurrency(benchmarkCurrentRent)}/mo` : "Benchmark missing",
      detail:
        benchmarkCurrentRent != null
          ? `${benchmarkRentLabel}. Compare against actual rents and vacancy before trusting upside.`
          : "Add a rent benchmark or rent roll before relying on cashflow and CoC.",
      href: "#listing-market",
      action: "Review rents",
      tone: benchmarkCurrentRent != null ? "blue" : "amber",
    },
    lenderAction,
  ];
}

function ListingHeaderCommandPanel({
  price,
  pricePerUnit,
  units,
  snapshot,
  financeabilitySummary,
  primaryAction,
  isInactiveListing,
  sourceLabel,
  listingUrl,
  firstAddedLabel,
  nightlyVerifiedLabel,
}: {
  price: number;
  pricePerUnit: number | null;
  units: number;
  snapshot: InvestorSnapshot | null;
  financeabilitySummary: FinanceabilityLaneSummary;
  primaryAction: ListingActionItem;
  isInactiveListing: boolean;
  sourceLabel: string;
  listingUrl: string | null;
  firstAddedLabel: string;
  nightlyVerifiedLabel: string;
}) {
  const firstYearCashflow = snapshot?.cashflowYears[0]?.annualCashflow ?? snapshot?.yearOneCashflow ?? null;
  const dscr = snapshot?.cashflowYears[0]?.dscr ?? snapshot?.dscr ?? financeabilitySummary.topMetrics?.dscr ?? null;
  const recommendedLane = financeabilitySummary.recommendedLane;
  const financeabilityToneValue = financeabilityTone(recommendedLane);
  const primaryTone = actionPlanTone(primaryAction.tone);
  const sourceTone = actionPlanTone(isInactiveListing ? "amber" : "green");
  const missingTopInputs = [
    !snapshot ? "return model unavailable" : null,
    dscr == null ? "DSCR unavailable" : null,
    !recommendedLane ? "financing lane unavailable" : null,
    nightlyVerifiedLabel === "n/a" ? "nightly verification missing" : null,
    !listingUrl ? "source link unavailable" : null,
    isInactiveListing ? "source no longer active" : null,
  ].filter(Boolean);
  const dealVerdict = buildUnifiedDealVerdict({
    primaryAction,
    cashflow: firstYearCashflow,
    cashOnCashReturn: snapshot?.cashOnCashReturn ?? null,
    dscr,
    lane: recommendedLane,
    isInactiveListing,
  });
  const metrics = [
    {
      label: "Asking price",
      value: formatCurrency(price),
      detail: pricePerUnit != null ? `${formatCurrency(pricePerUnit)} per unit` : `${units} modeled unit${units === 1 ? "" : "s"}`,
      tone: "blue",
      href: "#listing-facts",
    },
    {
      label: "Y1 cashflow",
      value: firstYearCashflow != null ? formatCurrency(firstYearCashflow) : "n/a",
      detail: firstYearCashflow != null
        ? `${firstYearCashflow < 0 ? "Negative cashflow: " : "Cashflow: "}${formatCurrency(firstYearCashflow / 12)}/mo after debt`
        : "Cashflow model unavailable.",
      tone: numberTone(firstYearCashflow),
      href: "#listing-returns",
    },
    {
      label: "CoC return",
      value: snapshot ? formatPercent(snapshot.cashOnCashReturn) : "n/a",
      detail: snapshot?.cocCalculation ?? "Needs underwriting model.",
      tone: numberTone(snapshot?.cashOnCashReturn ?? null),
      href: "#listing-returns",
    },
    {
      label: "DSCR",
      value: dscr != null ? formatRatio(dscr) : "n/a",
      detail: dscr == null
        ? "Debt-service coverage unavailable."
        : dscr < 1.25
          ? "Weak DSCR below 1.25x; lender review needed."
          : "Debt-service coverage clears first-pass threshold.",
      tone: dscr == null ? "amber" : dscr >= 1.25 ? "green" : dscr >= 1 ? "amber" : "red",
      href: "#listing-returns",
    },
    {
      label: "Cash required",
      value: snapshot ? formatCurrency(snapshot.equityRequired) : "Model pending",
      detail: snapshot
        ? `${formatCurrency(snapshot.downPaymentAmount)} down${
            snapshot.downPaymentPct != null ? ` (${formatPercent(snapshot.downPaymentPct * 100)})` : ""
          } + costs/capex`
        : "Open underwriting to build the cash stack.",
      tone: snapshot ? "blue" : "amber",
      href: "#listing-returns",
    },
    {
      label: "Financing lane",
      value: recommendedLane?.label ?? "Needs review",
      detail: recommendedLane
        ? `${financeabilityStatusLabel(recommendedLane)}: ${financeabilityLaneDetail(recommendedLane)}`
        : "No lender lane selected from the model.",
      tone: financeabilityToneValue,
      href: "#listing-underwriting",
    },
  ] satisfies Array<{ label: string; value: string; detail: string; tone: ListingActionTone; href: string }>;

  return (
    <section className="listing-header-command-panel" aria-label="Listing deal verdict summary" style={styles.headerCommandPanel}>
      <div
        className="listing-header-command-verdict"
        style={{
          ...styles.headerCommandVerdict,
          backgroundColor: primaryTone.bg,
          borderColor: primaryTone.border,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <span style={{ ...styles.headerCommandEyebrow, color: primaryTone.label }}>Deal verdict</span>
          <strong style={styles.headerCommandTitle}>{dealVerdict.title}</strong>
          <p className="listing-header-command-detail" style={styles.headerCommandDetail}>{dealVerdict.detail}</p>
        </div>
        <div className="listing-header-command-actions" style={styles.headerCommandActions}>
          <a
            href={primaryAction.href}
            aria-label={`${primaryAction.action}: ${primaryAction.value}`}
            style={{ ...styles.headerCommandPrimaryAction, color: primaryTone.cta, borderColor: primaryTone.border }}
          >
            {primaryAction.action}
            <ArrowUpRight size={13} />
          </a>
          <a className="listing-header-command-secondary-action" href="#listing-returns" style={styles.headerCommandSecondaryAction}>
            Show cashflow math
          </a>
          {listingUrl ? (
            <a className="listing-header-command-secondary-action" href={listingUrl} target="_blank" rel="noopener noreferrer" style={styles.headerCommandSecondaryAction}>
              Open {sourceLabel}
              <ArrowUpRight size={13} />
            </a>
          ) : null}
        </div>
      </div>

      <div className="listing-header-command-metrics" style={styles.headerCommandMetrics}>
        {metrics.map((metric) => {
          const tone = actionPlanTone(metric.tone);
          const metricBody = (
            <>
              <span style={{ ...styles.headerCommandMetricLabel, color: tone.label }}>{metric.label}</span>
              <strong style={styles.headerCommandMetricValue}>{metric.value}</strong>
              <span className="listing-header-command-metric-detail" style={styles.headerCommandMetricDetail}>
                {metric.detail}
              </span>
            </>
          );
          return (
            <a
              key={metric.label}
              href={metric.href ?? undefined}
              className="listing-header-command-metric"
              style={{
                ...styles.headerCommandMetric,
                backgroundColor: tone.bg,
                borderColor: tone.border,
                cursor: "pointer",
              }}
            >
              {metricBody}
            </a>
          );
        })}
      </div>

      {missingTopInputs.length > 0 && (
        <div className="listing-header-command-warning" style={styles.headerCommandWarning}>
          <strong>Screening confidence is limited:</strong> {missingTopInputs.join(", ")}. Treat this as triage, not offer-ready underwriting.
        </div>
      )}

      <FinanceabilityLanesDisclosure summary={financeabilitySummary} />

      <div className="listing-header-command-footnote" style={styles.headerCommandFootnote}>
        <span style={{ ...styles.headerCommandFootnoteDot, backgroundColor: sourceTone.label }} />
        <span>
          First added {firstAddedLabel} · Last nightly check {nightlyVerifiedLabel}.{" "}
          {isInactiveListing ? "This record is no longer active inventory." : "Still in the active listing workflow."}
        </span>
      </div>
    </section>
  );
}

function ListingFreshnessStrip({ items }: { items: ListingFreshnessItem[] }) {
  return (
    <section className="listing-freshness-strip" data-testid="listing-freshness-strip" aria-label="Listing source freshness" style={styles.freshnessStrip}>
      <div style={styles.freshnessHeader}>
        <div>
          <p style={styles.freshnessEyebrow}>Source freshness</p>
          <h2 style={styles.freshnessTitle}>Can I trust this listing is current?</h2>
        </div>
        <span style={styles.freshnessPill}>Nightly ingestion</span>
      </div>
      <div className="listing-freshness-grid" style={styles.freshnessGrid}>
        {items.map((item) => {
          const tone = actionPlanTone(item.tone);
          return (
            <div
              key={item.label}
              className="listing-freshness-card"
              style={{
                ...styles.freshnessCard,
                backgroundColor: tone.bg,
                borderColor: tone.border,
              }}
            >
              <span style={{ ...styles.freshnessCardLabel, color: tone.label }}>{item.label}</span>
              <strong style={styles.freshnessCardValue}>{item.value}</strong>
              <span style={styles.freshnessCardDetail}>{item.detail}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function UnderwritingHandoffPanel({ handoff }: { handoff: UnderwritingHandoff }) {
  return (
    <section className="listing-underwriting-handoff" aria-label="Selected underwriting handoff" style={styles.underwritingHandoff}>
      <div style={styles.underwritingHandoffHeader}>
        <div>
          <p style={styles.underwritingHandoffEyebrow}>Before editing assumptions</p>
          <h3 style={styles.underwritingHandoffTitle}>Selected model handoff</h3>
          <p style={styles.underwritingHandoffCopy}>{handoff.overview}</p>
        </div>
        <span style={styles.underwritingHandoffPill}>Default path</span>
      </div>
      <div className="listing-underwriting-handoff-grid" style={styles.underwritingHandoffGrid}>
        {handoff.items.map((item) => {
          const tone = actionPlanTone(item.tone);
          return (
            <div
              key={item.label}
              className="listing-underwriting-handoff-card"
              style={{
                ...styles.underwritingHandoffCard,
                backgroundColor: tone.bg,
                borderColor: tone.border,
              }}
            >
              <span style={{ ...styles.underwritingHandoffLabel, color: tone.label }}>{item.label}</span>
              <strong style={styles.underwritingHandoffValue}>{item.value}</strong>
              <span style={styles.underwritingHandoffDetail}>{item.detail}</span>
            </div>
          );
        })}
      </div>
      {handoff.risks.length > 0 ? (
        <div style={styles.underwritingHandoffRisks}>
          <span style={styles.underwritingHandoffRiskLabel}>First checks</span>
          <div style={styles.underwritingHandoffRiskList}>
            {handoff.risks.map((risk) => (
              <span key={risk} style={styles.underwritingHandoffRiskChip}>
                {risk}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function DataTrustPanel({
  summary,
  items,
}: {
  summary: DataConfidenceSummary;
  items: DataTrustItem[];
}) {
  const tone = actionPlanTone(summary.tone);

  return (
    <section className="listing-data-trust-panel" aria-label="Data trust summary" style={styles.dataTrustPanel}>
      <div
        className="listing-data-trust-verdict"
        style={{
          ...styles.dataTrustVerdict,
          backgroundColor: tone.bg,
          borderColor: tone.border,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <span style={{ ...styles.dataTrustVerdictLabel, color: tone.label }}>{summary.label}</span>
          <strong style={styles.dataTrustVerdictHeadline}>{summary.headline}</strong>
          <p style={styles.dataTrustVerdictDetail}>{summary.detail}</p>
        </div>
      </div>

      <div className="listing-data-trust-grid" style={styles.dataTrustGrid}>
        {items.map((item) => {
          const itemTone = actionPlanTone(item.tone);
          return (
            <div
              key={item.label}
              className="listing-data-trust-card"
              style={{
                ...styles.dataTrustCard,
                backgroundColor: itemTone.bg,
                borderColor: itemTone.border,
              }}
            >
              <span style={{ ...styles.dataTrustCardLabel, color: itemTone.label }}>{item.label}</span>
              <strong style={styles.dataTrustCardValue}>{item.value}</strong>
              <span style={styles.dataTrustCardDetail}>{item.detail}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MarketSignalStrip({ items }: { items: MarketSignalItem[] }) {
  return (
    <section className="listing-market-signal-strip" aria-label="Market rent check" style={styles.marketSignalStrip}>
      <div style={styles.marketSignalHeader}>
        <div>
          <p style={styles.marketSignalEyebrow}>Market rent check</p>
          <h3 style={styles.marketSignalTitle}>What the benchmark is telling the model</h3>
        </div>
        <span style={styles.marketSignalPill}>Verify against rent roll</span>
      </div>
      <div className="listing-market-signal-grid" style={styles.marketSignalGrid}>
        {items.map((item) => {
          const tone = actionPlanTone(item.tone);
          return (
            <div
              key={item.label}
              className="listing-market-signal-card"
              style={{
                ...styles.marketSignalCard,
                backgroundColor: tone.bg,
                borderColor: tone.border,
              }}
            >
              <span style={{ ...styles.marketSignalLabel, color: tone.label }}>{item.label}</span>
              <strong style={styles.marketSignalValue}>{item.value}</strong>
              <span style={styles.marketSignalDetail}>{item.detail}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SourceListingSnapshot({
  address,
  sourceLabel,
  listingUrl,
  description,
  signals,
  facts,
}: {
  address: string;
  sourceLabel: string;
  listingUrl: string | null;
  description: string | null;
  signals: SourceSignalItem[];
  facts: ListingFactItem[];
}) {
  return (
    <div>
      <div style={styles.listingFactsHeader}>
        <div>
          <p style={styles.listingFactsEyebrow}>Source listing snapshot</p>
          <h2 style={styles.panelTitle}>Property facts and source remarks</h2>
          <p style={styles.panelSubtitle}>
            This is the listing record before the model starts layering in rent benchmarks, expenses, financing, and return assumptions.
          </p>
        </div>
        {listingUrl ? (
          <a href={listingUrl} target="_blank" rel="noopener noreferrer" style={styles.listingFactsSourceLink}>
            Open on {sourceLabel}
            <ArrowUpRight size={14} />
          </a>
        ) : (
          <span style={styles.listingFactsSourcePill}>Source link unavailable</span>
        )}
      </div>

      <div className="listing-source-snapshot-grid" style={styles.listingFactsLayout}>
        <article style={styles.listingDescriptionCard}>
          <p style={styles.listingFactsCardLabel}>Source remarks</p>
          <h3 style={styles.listingDescriptionTitle}>{address}</h3>
          <p style={styles.listingDescriptionText}>
            {description ?? "No listing remarks were captured from the source. Rely on source facts, photos, and underwriting inputs until remarks are available."}
          </p>
          {signals.length > 0 && (
            <div className="listing-source-signal-grid" style={styles.sourceSignalGrid} aria-label="Captured source signals">
              {signals.map((signal) => {
                const tone = actionPlanTone(signal.tone);
                return (
                  <div
                    key={`${signal.label}:${signal.value}`}
                    className="listing-source-signal-card"
                    style={{
                      ...styles.sourceSignalCard,
                      backgroundColor: tone.bg,
                      borderColor: tone.border,
                    }}
                  >
                    <span style={{ ...styles.sourceSignalLabel, color: tone.label }}>{signal.label}</span>
                    <strong style={styles.sourceSignalValue}>{signal.value}</strong>
                    <span style={styles.sourceSignalDetail}>{signal.detail}</span>
                  </div>
                );
              })}
            </div>
          )}
        </article>
        <div className="listing-source-fact-grid" style={styles.listingFactGrid}>
          {facts.map((fact) => (
            <div key={fact.label} className="listing-source-fact-card" style={styles.listingFactCard}>
              <span style={styles.listingFactsCardLabel}>{fact.label}</span>
              <strong style={styles.listingFactValue}>{fact.value}</strong>
              <span style={styles.listingFactDetail}>{fact.detail}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ListingDecisionCommandBar({
  primaryAction,
  secondaryItems,
  reviewItems,
}: {
  primaryAction: ListingActionItem;
  secondaryItems: ListingActionItem[];
  reviewItems: DetailReviewMapItem[];
}) {
  const actionItems = [primaryAction, ...secondaryItems];

  return (
    <section className="listing-decision-command-bar" aria-label="Investor review shortcuts" style={styles.decisionCommandBar}>
      <div className="listing-decision-command-guide" style={styles.decisionCommandGuide}>
        <div style={styles.decisionCommandGuideHeader}>
          <div>
            <span style={styles.decisionCommandGuideEyebrow}>Deal review path</span>
            <strong style={styles.decisionCommandGuideTitle}>Jump straight to the proof behind the return cards</strong>
          </div>
          <span style={styles.decisionCommandGuidePill}>Section jumps</span>
        </div>

        <div className="listing-decision-command-route-grid" style={styles.decisionCommandRouteGrid}>
          {reviewItems.map((item) => {
            const isPrimary = item.href === "#listing-returns";
            return (
              <a
                key={item.href}
                href={item.href}
                aria-label={`Jump to ${item.label}`}
                style={isPrimary ? { ...styles.decisionCommandRouteLink, ...styles.decisionCommandRouteLeadLink } : styles.decisionCommandRouteLink}
              >
                <span
                  className="listing-decision-command-route-label"
                  style={isPrimary ? { ...styles.decisionCommandRouteLabel, ...styles.decisionCommandRouteLeadLabel } : styles.decisionCommandRouteLabel}
                >
                  {item.label}
                </span>
                <span
                  className="listing-decision-command-route-detail"
                  style={isPrimary ? { ...styles.decisionCommandRouteDetail, ...styles.decisionCommandRouteLeadDetail } : styles.decisionCommandRouteDetail}
                >
                  {item.detail}
                </span>
              </a>
            );
          })}
        </div>
      </div>

      <div className="listing-decision-command-action-panel" style={styles.decisionCommandActionPanel}>
        <div style={styles.decisionCommandActionPanelHeader}>
          <span style={styles.decisionCommandGuideEyebrow}>Next checks</span>
          <strong style={styles.decisionCommandActionPanelTitle}>Before trusting the return</strong>
        </div>
        <div className="listing-decision-command-check-grid" style={styles.decisionCommandCheckGrid}>
          {actionItems.map((item) => {
            const itemTone = actionPlanTone(item.tone);
            return (
              <a
                key={`${item.label}:${item.href}:${item.value}`}
                href={item.href}
                aria-label={`${item.action}: ${item.value}`}
                style={{
                  ...styles.decisionCommandCheckCard,
                  backgroundColor: itemTone.bg,
                  borderColor: itemTone.border,
                  color: itemTone.cta,
                }}
              >
                <span style={styles.decisionCommandCheckLabel}>{item.label}</span>
                <strong style={styles.decisionCommandCheckValue}>{item.value}</strong>
                <span style={styles.decisionCommandCheckCta}>
                  {item.action}
                  <ArrowUpRight size={13} />
                </span>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function InvestorHeroSnapshot({
  snapshot,
  primaryAction,
  units,
  flush = false,
}: {
  snapshot: InvestorSnapshot;
  primaryAction: ListingActionItem;
  units: number;
  flush?: boolean;
}) {
  const threeYearCashflow = snapshot.cashflowYears.reduce((sum, year) => sum + year.annualCashflow, 0);
  const threeYearCashflowCalculation =
    snapshot.cashflowYears.length > 0
      ? `${snapshot.cashflowYears.map((year) => formatCurrency(year.annualCashflow)).join(" + ")} = ${formatCurrency(threeYearCashflow)}`
      : "Cashflow projection unavailable";
  const modeledReturnCalculation = `${snapshot.roiBasis} = ${formatCurrency(snapshot.totalYearOneReturn)}`;
  const cashflowTone = threeYearCashflow > 0 ? "#166534" : threeYearCashflow < 0 ? "#991b1b" : "#334155";

  return (
    <div
      id="listing-returns"
      className="listing-detail-section-anchor"
      data-testid="investor-first-glance"
      style={flush ? { ...styles.heroSnapshot, ...styles.heroSnapshotFlush } : styles.heroSnapshot}
    >
      <div style={styles.heroSnapshotHeader}>
        <div>
          <p style={styles.heroSnapshotEyebrow}>Selected path first glance</p>
          <h2 style={styles.heroSnapshotTitle}>Underwriting cashflow, CoC, and Y1 modeled return</h2>
        </div>
        <div style={styles.heroSnapshotPill}>{snapshot.strategyName}</div>
      </div>

      <InvestorPriorityScorecard
        snapshot={snapshot}
        primaryAction={primaryAction}
        threeYearCashflow={threeYearCashflow}
      />

      <InvestorCashflowTimeline snapshot={snapshot} threeYearCashflow={threeYearCashflow} />

      <details
        className="listing-detail-disclosure investor-first-glance-formula-disclosure"
        style={styles.heroDisclosure}
      >
        <summary className="listing-detail-disclosure-summary" style={styles.heroDisclosureSummary}>
          <div style={{ minWidth: 0 }}>
            <span style={styles.heroDisclosureEyebrow}>Return calculations</span>
            <strong style={styles.heroDisclosureTitle}>Show cashflow, CoC, and modeled-return math</strong>
            <span style={styles.heroDisclosureCopy}>
              Expands the formulas for audit mode after the high-signal cards have done their job.
            </span>
          </div>
          <span style={styles.heroDisclosureBadge}>Show math</span>
        </summary>
        <div className="investor-first-glance-formulas" style={styles.heroSnapshotFormula}>
          <div style={styles.heroSnapshotFormulaItem}>
            <span style={styles.heroSnapshotFormulaLabel}>3-year cashflow</span>
            <strong style={{ ...styles.heroSnapshotFormulaValue, color: cashflowTone }}>
              {threeYearCashflowCalculation}
            </strong>
          </div>
          <div style={styles.heroSnapshotFormulaItem}>
            <span style={styles.heroSnapshotFormulaLabel}>Selected-path CoC calculation</span>
            <span style={styles.heroSnapshotFormulaValue}>{snapshot.cocCalculation}</span>
          </div>
          <div style={styles.heroSnapshotFormulaItem}>
            <span style={styles.heroSnapshotFormulaLabel}>Y1 modeled return calculation</span>
            <span style={styles.heroSnapshotFormulaValue}>{modeledReturnCalculation}</span>
            <span style={styles.heroSnapshotFormulaSubvalue}>
              {snapshot.roiCalculation} ({formatPercent(snapshot.yearOneRoi)} Y1 modeled ROI; not all components are cash proceeds)
            </span>
          </div>
        </div>
      </details>

      <details
        className="listing-detail-disclosure investor-math-audit-disclosure"
        style={styles.heroDisclosure}
      >
        <summary className="listing-detail-disclosure-summary" style={styles.heroDisclosureSummary}>
          <div style={{ minWidth: 0 }}>
            <span style={styles.heroDisclosureEyebrow}>Assumption audit</span>
            <strong style={styles.heroDisclosureTitle}>Debt, rent, NOI, and lender lane used here</strong>
            <span style={styles.heroDisclosureCopy}>
              Opens the underwriting inputs behind the first-glance return cards without crowding the decision view.
            </span>
          </div>
          <span style={styles.heroDisclosureBadge}>Show assumptions</span>
        </summary>
        <InvestorOperatingBridge snapshot={snapshot} />
        <InvestorMathAudit snapshot={snapshot} units={units} />
      </details>
    </div>
  );
}

function InvestorPriorityScorecard({
  snapshot,
  primaryAction,
  threeYearCashflow,
}: {
  snapshot: InvestorSnapshot;
  primaryAction: ListingActionItem;
  threeYearCashflow: number;
}) {
  const primaryTone = actionPlanTone(primaryAction.tone);
  const firstYearCashflow = snapshot.cashflowYears[0]?.annualCashflow ?? snapshot.yearOneCashflow;
  const finalYearCashflow = snapshot.cashflowYears[snapshot.cashflowYears.length - 1]?.annualCashflow ?? firstYearCashflow;
  const cashflowChange = finalYearCashflow - firstYearCashflow;
  const ltvLabel = snapshot.ltvPct != null ? `${formatPercent(snapshot.ltvPct * 100)} LTV` : "LTV unavailable";
  const downPaymentLabel = snapshot.downPaymentPct != null ? `${formatPercent(snapshot.downPaymentPct * 100)} down` : "Down payment unavailable";
  const lenderLabel = snapshot.modeledUnits >= 5 ? "RBC/Desjardins check" : "Residential lender check";
  const lenderDetail =
    snapshot.modeledUnits >= 5
      ? "Confirm the personal plex exception, borrower reporting, and commercial takeout path before offer math."
      : "Confirm rental-income inclusion, owner-occupancy status, and stress-test treatment before offer math.";
  const metrics = [
    {
      label: "Y1 cashflow",
      value: formatCurrency(firstYearCashflow),
      detail: `${formatCurrency(firstYearCashflow / 12)}/mo after debt · DSCR ${formatRatio(snapshot.cashflowYears[0]?.dscr ?? snapshot.dscr)}`,
      tone: firstYearCashflow,
    },
    {
      label: "3Y cashflow",
      value: formatCurrency(threeYearCashflow),
      detail: `${formatCurrency(cashflowChange)} Y1-to-Y3 change`,
      tone: threeYearCashflow,
    },
    {
      label: "CoC return",
      value: formatPercent(snapshot.cashOnCashReturn),
      detail: snapshot.cocCalculation,
      tone: snapshot.cashOnCashReturn,
    },
    {
      label: "Y1 modeled return",
      value: formatCurrency(snapshot.totalYearOneReturn),
      detail: `${formatPercent(snapshot.yearOneRoi)} Y1 modeled ROI on cash in`,
      tone: snapshot.totalYearOneReturn,
    },
  ];
  const supportItems = [
    {
      label: "Cash in",
      value: formatCurrency(snapshot.equityRequired),
      detail: `${formatCurrency(snapshot.downPaymentAmount)} down (${downPaymentLabel}) + ${formatCurrency(snapshot.closingCosts + snapshot.capitalBudget)} costs/capex`,
      tone: "blue",
    },
    {
      label: "Debt terms",
      value: `${formatCurrency(snapshot.loanAmount)} loan`,
      detail: `${ltvLabel} · ${formatRatePercent(snapshot.mortgageRate * 100)} · ${Math.round(snapshot.amortizationYears)} yr amortization`,
      tone: snapshot.dscr >= 1.25 ? "green" : snapshot.dscr >= 1 ? "amber" : "red",
    },
    {
      label: "Rent basis",
      value:
        snapshot.unitMonthlyRents && snapshot.unitMonthlyRents.length > 0
          ? `${formatCurrency(snapshot.rentRollMonthly)}/mo`
          : `${formatCurrency(snapshot.modeledRentPerUnit)}/unit`,
      detail: `${snapshot.rentRollBasisDetail} ${snapshot.modeledRentBasisLabel}`,
      tone: "blue",
    },
    {
      label: "Tax basis",
      value: formatCurrency(snapshot.propertyTaxAnnual),
      detail: `${snapshot.propertyTaxBasisLabel}. ${snapshot.propertyTaxDetail}`,
      tone: snapshot.propertyTaxAnnual > 0 ? "green" : "amber",
    },
    {
      label: "Management",
      value: formatPercent(snapshot.managementFeePct * 100),
      detail: `${formatCurrency(snapshot.managementAnnual)}/yr. ${snapshot.managementDetail}`,
      tone: snapshot.managementFeePct > 0 ? "blue" : "slate",
    },
    {
      label: "Lender path",
      value: lenderLabel,
      detail: lenderDetail,
      tone: snapshot.modeledUnits >= 5 ? "amber" : "blue",
    },
  ] satisfies Array<{ label: string; value: string; detail: string; tone: ListingActionTone }>;

  return (
    <section className="investor-priority-scorecard" aria-label="Investor first-glance scorecard" style={styles.priorityScorecard}>
      <div
        className="investor-priority-scorecard-primary"
        style={{
          ...styles.priorityScorecardPrimary,
          backgroundColor: primaryTone.bg,
          borderColor: primaryTone.border,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <span style={{ ...styles.priorityScorecardEyebrow, color: primaryTone.label }}>Investor read</span>
          <strong style={styles.priorityScorecardTitle}>{primaryAction.value}</strong>
          <p style={styles.priorityScorecardDetail}>{primaryAction.detail}</p>
        </div>
        <a
          href={primaryAction.href}
          aria-label={`${primaryAction.action}: ${primaryAction.value}`}
          style={{ ...styles.priorityScorecardAction, color: primaryTone.cta, borderColor: primaryTone.border }}
        >
          {primaryAction.action}
          <ArrowUpRight size={13} />
        </a>
      </div>

      <div className="investor-priority-scorecard-metrics" style={styles.priorityScorecardMetrics}>
        {metrics.map((metric) => (
          <InvestorScorecardMetric
            key={metric.label}
            label={metric.label}
            value={metric.value}
            detail={metric.detail}
            tone={metric.tone}
          />
        ))}
      </div>

      <div className="investor-priority-scorecard-support" style={styles.priorityScorecardSupport}>
        {supportItems.map((item) => {
          const tone = actionPlanTone(item.tone);
          return (
            <div
              key={item.label}
              className="investor-priority-scorecard-support-card"
              style={{
                ...styles.priorityScorecardSupportCard,
                backgroundColor: tone.bg,
                borderColor: tone.border,
              }}
            >
              <span style={{ ...styles.priorityScorecardSupportLabel, color: tone.label }}>{item.label}</span>
              <strong style={styles.priorityScorecardSupportValue}>{item.value}</strong>
              <span style={styles.priorityScorecardSupportDetail}>{item.detail}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function InvestorScorecardMetric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: number | null;
}) {
  const color =
    tone == null || !Number.isFinite(tone)
      ? "#334155"
      : tone > 0
        ? "#166534"
        : tone < 0
          ? "#991b1b"
          : "#334155";

  return (
    <div className="investor-priority-scorecard-metric" style={styles.priorityScorecardMetric}>
      <span style={styles.priorityScorecardMetricLabel}>{label}</span>
      <strong style={{ ...styles.priorityScorecardMetricValue, color }}>{value}</strong>
      <span style={styles.priorityScorecardMetricDetail}>{detail}</span>
    </div>
  );
}

function InvestorCashflowTimeline({
  snapshot,
  threeYearCashflow,
}: {
  snapshot: InvestorSnapshot;
  threeYearCashflow: number;
}) {
  const projectedYears = snapshot.cashflowYears.slice(0, 3);
  const firstYearCashflow = projectedYears[0]?.annualCashflow ?? snapshot.yearOneCashflow;
  const finalYearCashflow = projectedYears[projectedYears.length - 1]?.annualCashflow ?? firstYearCashflow;
  const trajectory = finalYearCashflow - firstYearCashflow;
  const timelineTone: ListingActionTone =
    threeYearCashflow > 0 && trajectory >= 0
      ? "green"
      : threeYearCashflow > 0
        ? "blue"
        : firstYearCashflow < 0
          ? "red"
          : "amber";
  const tone = actionPlanTone(timelineTone);

  return (
    <section className="investor-cashflow-timeline" aria-label="First three years of modeled cashflow" style={styles.cashflowTimeline}>
      <div style={styles.cashflowTimelineHeader}>
        <div>
          <p style={styles.cashflowTimelineEyebrow}>Hold-period cashflow</p>
          <h3 style={styles.cashflowTimelineTitle}>First 3 years before you underwrite deeper</h3>
          <p style={styles.cashflowTimelineCopy}>
            These cards use the selected path rent roll, expenses, vacancy, debt service, and rent growth. They are the quick pass-fail read before touching assumptions.
          </p>
        </div>
        <div
          style={{
            ...styles.cashflowTimelineTotal,
            backgroundColor: tone.bg,
            borderColor: tone.border,
          }}
        >
          <span style={{ ...styles.cashflowTimelineTotalLabel, color: tone.label }}>3Y total</span>
          <strong style={styles.cashflowTimelineTotalValue}>{formatCurrency(threeYearCashflow)}</strong>
          <span style={styles.cashflowTimelineTotalDetail}>
            {trajectory === 0 ? "Flat cashflow path" : `${trajectory > 0 ? "+" : ""}${formatCurrency(trajectory)} Y1-to-Y3`}
          </span>
        </div>
      </div>

      <div className="investor-cashflow-timeline-grid" style={styles.cashflowTimelineGrid}>
        {projectedYears.map((year) => (
          <InvestorCashflowYearCard key={year.year} year={year} />
        ))}
      </div>
    </section>
  );
}

function InvestorCashflowYearCard({
  year,
}: {
  year: InvestorSnapshot["cashflowYears"][number];
}) {
  const cashflowTone: ListingActionTone =
    year.annualCashflow > 0 ? "green" : year.annualCashflow < 0 ? "red" : "slate";
  const dscrTone: ListingActionTone = year.dscr >= 1.25 ? "green" : year.dscr >= 1 ? "amber" : "red";
  const tone = actionPlanTone(cashflowTone);
  const dscrLabel = actionPlanTone(dscrTone).label;

  return (
    <article
      className="investor-cashflow-timeline-card"
      style={{
        ...styles.cashflowTimelineCard,
        backgroundColor: tone.bg,
        borderColor: tone.border,
      }}
    >
      <div style={styles.cashflowTimelineYearHeader}>
        <span style={{ ...styles.cashflowTimelineYearLabel, color: tone.label }}>Year {year.year}</span>
        <span style={{ ...styles.cashflowTimelineDscr, color: dscrLabel }}>DSCR {formatRatio(year.dscr)}</span>
      </div>
      <strong style={styles.cashflowTimelineYearValue}>{formatCurrency(year.annualCashflow)}</strong>
      <div style={styles.cashflowTimelineYearStats}>
        <span>{formatCurrency(year.monthlyCashflow)}/mo</span>
        <span>{formatCurrency(year.cumulativeCashflow)} cumulative</span>
      </div>
    </article>
  );
}

function InvestorOperatingBridge({ snapshot }: { snapshot: InvestorSnapshot }) {
  const yearOneCashflow = snapshot.cashflowYears[0]?.annualCashflow ?? snapshot.yearOneCashflow;
  const vacancyLoss = Math.max(0, snapshot.grossScheduledRent - snapshot.effectiveGrossIncome);
  const rentBasis =
    snapshot.unitMonthlyRents && snapshot.unitMonthlyRents.length > 0
      ? snapshot.rentRollFormula
      : `${snapshot.modeledUnits} unit${snapshot.modeledUnits === 1 ? "" : "s"} x ${formatCurrency(snapshot.modeledRentPerUnit)}/mo`;
  const debtTerms = [
    snapshot.ltvPct != null ? `${formatPercent(snapshot.ltvPct * 100)} LTV` : null,
    `${formatRatePercent(snapshot.mortgageRate * 100)} rate`,
    `${Math.round(snapshot.amortizationYears)} yr amortization`,
  ].filter(Boolean).join(" · ");
  const bridgeItems = [
    {
      label: "Gross rent",
      value: formatCurrency(snapshot.grossScheduledRent),
      detail: `${rentBasis}; ${snapshot.rentRollBasisDetail}`,
      tone: "blue",
    },
    {
      label: "Effective income",
      value: formatCurrency(snapshot.effectiveGrossIncome),
      detail: `${formatCurrency(vacancyLoss)} vacancy/credit loss modeled before expenses.`,
      tone: "blue",
    },
    {
      label: "Operating expenses",
      value: formatCurrency(snapshot.operatingExpenses),
      detail: `${formatPercent(snapshot.operatingExpenseRatio * 100)} of effective gross income.`,
      tone: snapshot.operatingExpenseRatio <= 0.4 ? "green" : "amber",
    },
    {
      label: "NOI",
      value: formatCurrency(snapshot.noi),
      detail: `${formatCurrency(snapshot.effectiveGrossIncome)} EGI - ${formatCurrency(snapshot.operatingExpenses)} expenses.`,
      tone: snapshot.noi >= snapshot.annualDebtService ? "green" : "amber",
    },
    {
      label: "Debt service",
      value: formatCurrency(snapshot.annualDebtService),
      detail: `${debtTerms}. ${snapshot.mortgageRateLabel}`,
      tone: snapshot.dscr >= 1.25 ? "green" : snapshot.dscr >= 1 ? "amber" : "red",
    },
    {
      label: "Y1 cashflow",
      value: formatCurrency(yearOneCashflow),
      detail: `${formatCurrency(snapshot.noi)} NOI - ${formatCurrency(snapshot.annualDebtService)} debt = ${formatCurrency(yearOneCashflow / 12)}/mo.`,
      tone: yearOneCashflow > 0 ? "green" : yearOneCashflow < 0 ? "red" : "slate",
    },
  ] satisfies Array<{ label: string; value: string; detail: string; tone: ListingActionTone }>;

  return (
    <section className="investor-operating-bridge" aria-label="Year one operating bridge" style={styles.operatingBridge}>
      <div style={styles.operatingBridgeHeader}>
        <div>
          <p style={styles.operatingBridgeEyebrow}>Year-one bridge</p>
          <h3 style={styles.operatingBridgeTitle}>How rent turns into cashflow</h3>
        </div>
        <span style={styles.operatingBridgePill}>{formatRatio(snapshot.dscr)} DSCR</span>
      </div>
      <div className="investor-operating-bridge-grid" style={styles.operatingBridgeGrid}>
        {bridgeItems.map((item) => {
          const tone = actionPlanTone(item.tone);
          return (
            <div
              key={item.label}
              className="investor-operating-bridge-card"
              style={{
                ...styles.operatingBridgeCard,
                backgroundColor: tone.bg,
                borderColor: tone.border,
              }}
            >
              <span style={{ ...styles.operatingBridgeLabel, color: tone.label }}>{item.label}</span>
              <strong style={styles.operatingBridgeValue}>{item.value}</strong>
              <span style={styles.operatingBridgeDetail}>{item.detail}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function InvestorMathAudit({
  snapshot,
  units,
}: {
  snapshot: InvestorSnapshot;
  units: number;
}) {
  const lenderLane = units >= 5 ? "Personal exception or commercial takeout" : "Residential rental mortgage";
  const lenderDetail =
    units >= 5
      ? "For a 5+ unit plex, confirm the personal-borrower exception, borrower reporting, and refinance/takeout terms in writing."
      : "Confirm rental-income treatment, stress test, and owner-occupancy status with the lender.";
  const financingTerms = [
    snapshot.ltvPct != null ? `${formatPercent(snapshot.ltvPct * 100)} LTV` : null,
    `${formatRatePercent(snapshot.mortgageRate * 100)} rate`,
    `${Math.round(snapshot.amortizationYears)} yr amortization`,
  ].filter(Boolean).join(" · ");
  const items = [
    {
      label: "Cash stack",
      value: formatCurrency(snapshot.equityRequired),
      detail: `${formatCurrency(snapshot.downPaymentAmount)} down payment${
        snapshot.downPaymentPct != null ? ` (${formatPercent(snapshot.downPaymentPct * 100)})` : ""
      } + ${formatCurrency(snapshot.closingCosts + snapshot.capitalBudget)} closing/capex.`,
      tone: "blue",
    },
    {
      label: "Debt terms",
      value: formatCurrency(snapshot.loanAmount),
      detail: `${financingTerms}. ${snapshot.mortgageRateLabel}`,
      tone: snapshot.dscr >= 1.25 ? "green" : snapshot.dscr >= 1 ? "amber" : "red",
    },
    {
      label: "Rent basis",
      value:
        snapshot.unitMonthlyRents && snapshot.unitMonthlyRents.length > 0
          ? `${formatCurrency(snapshot.rentRollMonthly)}/mo`
          : `${formatCurrency(snapshot.modeledRentPerUnit)}/unit`,
      detail: `${snapshot.rentRollFormula} · ${formatCurrency(snapshot.grossScheduledRent)}/yr GSR. ${snapshot.modeledRentBasisLabel}`,
      tone: "blue",
    },
    {
      label: "NOI bridge",
      value: formatCurrency(snapshot.noi),
      detail: `${formatCurrency(snapshot.effectiveGrossIncome)} EGI - ${formatCurrency(snapshot.operatingExpenses)} expenses (${formatPercent(snapshot.operatingExpenseRatio * 100)}).`,
      tone: snapshot.noi >= snapshot.annualDebtService ? "green" : "amber",
    },
    {
      label: "Lender lane",
      value: lenderLane,
      detail: lenderDetail,
      tone: units >= 5 ? "amber" : "blue",
    },
  ] satisfies Array<{ label: string; value: string; detail: string; tone: ListingActionTone }>;

  return (
    <section className="investor-math-audit" aria-label="Deal math assumption audit" style={styles.mathAudit}>
      <div style={styles.mathAuditHeader}>
        <div>
          <p style={styles.mathAuditEyebrow}>Deal math audit</p>
          <h3 style={styles.mathAuditTitle}>What these returns are actually using</h3>
        </div>
        <span style={styles.mathAuditPill}>Assumptions to verify</span>
      </div>

      <div className="investor-math-audit-grid" style={styles.mathAuditGrid}>
        {items.map((item) => {
          const tone = actionPlanTone(item.tone);
          return (
            <div
              key={item.label}
              className="investor-math-audit-card"
              style={{
                ...styles.mathAuditCard,
                backgroundColor: tone.bg,
                borderColor: tone.border,
              }}
            >
              <span style={{ ...styles.mathAuditLabel, color: tone.label }}>{item.label}</span>
              <strong style={styles.mathAuditValue}>{item.value}</strong>
              <span style={styles.mathAuditDetail}>{item.detail}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ListingReturnStickyBar({
  snapshot,
  primaryAction,
}: {
  snapshot: InvestorSnapshot;
  primaryAction: ListingActionItem;
}) {
  const threeYearCashflow = snapshot.cashflowYears.reduce((sum, year) => sum + year.annualCashflow, 0);
  const firstYearCashflow = snapshot.cashflowYears[0]?.annualCashflow ?? snapshot.yearOneCashflow;
  const actionTone = actionPlanTone(primaryAction.tone);

  return (
    <aside
      className="listing-return-sticky-bar"
      aria-label="Sticky listing return summary"
      style={styles.returnStickyBar}
    >
      <div style={styles.returnStickyIntro}>
        <span style={styles.returnStickyEyebrow}>Investor read</span>
        <strong style={styles.returnStickyTitle}>{primaryAction.value}</strong>
      </div>
      <div className="listing-return-sticky-metrics" style={styles.returnStickyMetrics}>
        <StickyReturnMetric label="Y1 CF" value={formatCurrency(firstYearCashflow)} tone={firstYearCashflow} />
        <StickyReturnMetric label="3Y CF" value={formatCurrency(threeYearCashflow)} tone={threeYearCashflow} />
        <StickyReturnMetric
          label="CoC"
          value={formatPercent(snapshot.cashOnCashReturn)}
          tone={snapshot.cashOnCashReturn}
        />
        <StickyReturnMetric label="Y1 return" value={formatCurrency(snapshot.totalYearOneReturn)} tone={snapshot.totalYearOneReturn} />
        <StickyReturnMetric label="Cash in" value={formatCurrency(snapshot.equityRequired)} />
      </div>
      <a
        href={primaryAction.href}
        aria-label={`${primaryAction.action}: ${primaryAction.value}`}
        style={{
          ...styles.returnStickyAction,
          color: actionTone.cta,
          borderColor: actionTone.border,
          backgroundColor: actionTone.bg,
        }}
      >
        {primaryAction.action}
        <ArrowUpRight size={13} />
      </a>
    </aside>
  );
}

function StickyReturnMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: number | null;
}) {
  const color =
    tone == null || !Number.isFinite(tone)
      ? "#334155"
      : tone > 0
        ? "#166534"
        : tone < 0
          ? "#991b1b"
          : "#334155";

  return (
    <div style={styles.returnStickyMetric}>
      <span style={styles.returnStickyMetricLabel}>{label}</span>
      <strong style={{ ...styles.returnStickyMetricValue, color }}>{value}</strong>
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

function HeaderBadge({ children }: { children: ReactNode }) {
  return <span style={styles.headerBadge}>{children}</span>;
}

function FactBadge({ children }: { children: ReactNode }) {
  return <span style={styles.factBadge}>{children}</span>;
}

function FreshListingBadge({ children }: { children: ReactNode }) {
  return <span style={styles.freshListingBadge}>{children}</span>;
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

function formatListingAddress(address: string): string {
  return address
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ")
    .replace(/\s+/g, " ");
}

function formatListingDescription(description: string | null): string | null {
  if (!description) return null;
  const cleaned = description
    .replace(/\bMunicipal assessment:?\s*\$?[\d\s,.]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  return cleaned.length > 900 ? `${cleaned.slice(0, 897).trimEnd()}...` : cleaned;
}

function extractSourceSignalItems(description: string | null): SourceSignalItem[] {
  if (!description) return [];
  const text = description.replace(/\s+/g, " ").trim();
  const items: SourceSignalItem[] = [];

  const potentialRevenue = extractMoneyAfterLabel(text, /Potential gross revenue/i);
  if (potentialRevenue) {
    items.push({
      label: "Source gross revenue",
      value: potentialRevenue,
      detail: "Captured from remarks. Compare to the rent roll before relying on cashflow.",
      tone: "blue",
    });
  }

  const municipalTax = extractMoneyAfterLabel(text, /Municipal taxes/i);
  const schoolTax = extractMoneyAfterLabel(text, /School taxes/i);
  if (municipalTax || schoolTax) {
    const taxParts = [municipalTax ? `municipal ${municipalTax}` : null, schoolTax ? `school ${schoolTax}` : null].filter(Boolean);
    items.push({
      label: "Source taxes used",
      value: taxParts.join(" + "),
      detail: "Used as annual municipal plus school tax in operating expenses.",
      tone: "green",
    });
  }

  const occupancySignal = extractSentenceMatching(text, /available for occupancy|occupied|vacant|buyer/i);
  if (occupancySignal) {
    items.push({
      label: "Occupancy clue",
      value: "Verify before offer",
      detail: occupancySignal,
      tone: "amber",
    });
  }

  return items.slice(0, 4);
}

function extractMoneyAfterLabel(text: string, label: RegExp): string | null {
  const match = text.match(new RegExp(`${label.source}:?\\s*\\$?([0-9][0-9\\s,.]*)`, "i"));
  if (!match?.[1]) return null;
  const parsed = Number(match[1].replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return formatCurrency(parsed);
}

function extractSentenceMatching(text: string, pattern: RegExp): string | null {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const match = sentences.find((sentence) => pattern.test(sentence));
  if (!match) return null;
  return match.length > 150 ? `${match.slice(0, 147).trimEnd()}...` : match;
}

function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return "n/a";
  return value.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  });
}

function formatPercent(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "n/a";
  return `${value.toFixed(1)}%`;
}

function formatRatePercent(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "n/a";
  return `${value.toFixed(2)}%`;
}

function formatRatio(value: number): string {
  if (!Number.isFinite(value)) return "n/a";
  return `${value.toFixed(2)}x`;
}

function formatConfidenceLabel(value: string | null | undefined): string {
  if (!value) return "n/a";
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function formatShortDate(value?: Date | string | null): string {
  if (!value) return "n/a";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "n/a";
  return date.toLocaleDateString("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function formatDateTime(value?: Date | string | null): string | null {
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

function isWithinLastDays(value: Date | string | null | undefined, days: number): boolean {
  if (!value) return false;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return false;
  const ageMs = Date.now() - date.getTime();
  return ageMs >= 0 && ageMs <= days * 24 * 60 * 60 * 1000;
}

function numberTone(value: number | null): ListingActionTone {
  if (value == null || !Number.isFinite(value)) return "slate";
  if (value > 0) return "green";
  if (value < 0) return "red";
  return "slate";
}

function actionPlanTone(tone: ListingActionTone) {
  return {
    green: { bg: "#ecfdf3", border: "#bbf7d0", label: "#166534", cta: "#166534" },
    amber: { bg: "#fffbeb", border: "#fde68a", label: "#b45309", cta: "#b45309" },
    red: { bg: "#fef2f2", border: "#fecaca", label: "#b91c1c", cta: "#b91c1c" },
    blue: { bg: "#eff6ff", border: "#bfdbfe", label: "#1d4ed8", cta: "#1d4ed8" },
    slate: { bg: "#f8fafc", border: "#e2e8f0", label: "#475569", cta: "#334155" },
  }[tone];
}

const styles: Record<string, CSSProperties> = {
  page: {
    width: "min(1440px, calc(100% - 48px))",
    margin: "0 auto",
    padding: "16px 0 48px",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
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
    borderRadius: 8,
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
  address: {
    margin: "18px 0 0",
    maxWidth: 1120,
    fontSize: 36,
    lineHeight: 1.12,
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
  freshListingBadge: {
    borderRadius: 999,
    backgroundColor: "#ecfdf3",
    border: "1px solid #bbf7d0",
    padding: "8px 12px",
    fontSize: 13,
    fontWeight: 800,
    color: "#166534",
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
  financeabilityDisclosure: {
    borderRadius: 14,
    border: "1px solid #dbeafe",
    backgroundColor: "#f8fafc",
    padding: 12,
    display: "grid",
    gap: 12,
  },
  financeabilityDisclosureSummary: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 12,
    alignItems: "center",
    cursor: "pointer",
    listStyle: "none",
  },
  financeabilityDisclosureTitle: {
    display: "block",
    marginTop: 4,
    color: "#0f172a",
    fontSize: 14,
    lineHeight: 1.25,
  },
  financeabilityDisclosureCopy: {
    display: "block",
    marginTop: 4,
    color: "#475569",
    fontSize: 12,
    lineHeight: 1.45,
  },
  financeabilityVerdictBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "solid",
    padding: "8px 11px",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  financeabilityGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 10,
    marginTop: 12,
  },
  financeabilityMetricCard: {
    minWidth: 0,
    borderRadius: 14,
    border: "1px solid rgba(203,213,225,0.9)",
    backgroundColor: "rgba(255,255,255,0.96)",
    padding: 13,
    display: "grid",
    gap: 6,
    boxShadow: "0 10px 24px rgba(15,23,42,0.08)",
  },
  financeabilityMetricLabel: {
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  },
  financeabilityMetricValue: {
    fontSize: 18,
    lineHeight: 1.15,
    overflowWrap: "anywhere",
  },
  financeabilityMetricDetail: {
    color: "#475569",
    fontSize: 12,
    lineHeight: 1.4,
  },
  financeabilityLaneGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  },
  financeabilityLaneCard: {
    minWidth: 0,
    borderRadius: 14,
    border: "1px solid #dbeafe",
    backgroundColor: "#eff6ff",
    padding: 12,
  },
  financeabilityLaneTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "flex-start",
  },
  financeabilityLaneLabel: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: 900,
    lineHeight: 1.25,
  },
  financeabilityLanePill: {
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "solid",
    padding: "5px 7px",
    fontSize: 10,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  financeabilityLaneReason: {
    margin: "8px 0 0",
    color: "#475569",
    fontSize: 12,
    lineHeight: 1.5,
  },
  financeabilityProofBox: {
    borderRadius: 14,
    border: "1px solid #fed7aa",
    backgroundColor: "#fff7ed",
    padding: 13,
    display: "grid",
    gap: 10,
  },
  financeabilityProofEyebrow: {
    margin: 0,
    color: "#9a3412",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  financeabilityProofTitle: {
    margin: "5px 0 0",
    color: "#7c2d12",
    fontSize: 16,
    lineHeight: 1.25,
  },
  financeabilityProofList: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  financeabilityProofChip: {
    borderRadius: 999,
    border: "1px solid #fdba74",
    backgroundColor: "#fff",
    color: "#9a3412",
    padding: "7px 9px",
    fontSize: 12,
    fontWeight: 800,
    lineHeight: 1.2,
  },
  financeabilityProofCopy: {
    margin: 0,
    color: "#9a3412",
    fontSize: 12,
    lineHeight: 1.55,
  },
  headerCommandPanel: {
    marginTop: 18,
    borderRadius: 16,
    border: "1px solid #cbd5e1",
    background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 48%, #eef2ff 100%)",
    padding: 14,
    display: "grid",
    gridTemplateColumns: "minmax(300px, 0.78fr) minmax(0, 1.22fr)",
    gap: 12,
    boxShadow: "0 14px 32px rgba(15,23,42,0.08)",
  },
  headerCommandVerdict: {
    minWidth: 0,
    borderRadius: 13,
    borderWidth: 1,
    borderStyle: "solid",
    padding: 14,
    display: "grid",
    gap: 13,
    alignContent: "space-between",
  },
  headerCommandEyebrow: {
    display: "block",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  headerCommandTitle: {
    display: "block",
    marginTop: 5,
    color: "#0f172a",
    fontSize: 24,
    lineHeight: 1.12,
    overflowWrap: "anywhere",
  },
  headerCommandDetail: {
    margin: "8px 0 0",
    color: "#334155",
    fontSize: 13,
    lineHeight: 1.5,
  },
  headerCommandActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },
  headerCommandPrimaryAction: {
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
  headerCommandSecondaryAction: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 999,
    border: "1px solid #dbeafe",
    backgroundColor: "#fff",
    color: "#1d4ed8",
    padding: "9px 11px",
    textDecoration: "none",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  headerCommandMetrics: {
    minWidth: 0,
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 9,
  },
  headerCommandMetric: {
    minWidth: 0,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "solid",
    padding: 11,
    display: "grid",
    gap: 5,
    color: "inherit",
    textDecoration: "none",
  },
  headerCommandMetricLabel: {
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  headerCommandMetricValue: {
    color: "#0f172a",
    fontSize: 19,
    lineHeight: 1.1,
    fontVariantNumeric: "tabular-nums",
    overflowWrap: "anywhere",
  },
  headerCommandMetricDetail: {
    color: "#475569",
    fontSize: 11,
    lineHeight: 1.35,
    overflowWrap: "anywhere",
  },
  headerCommandWarning: {
    borderRadius: 12,
    border: "1px solid #fed7aa",
    backgroundColor: "#fff7ed",
    color: "#9a3412",
    padding: "10px 12px",
    fontSize: 12,
    lineHeight: 1.5,
  },
  headerCommandFootnote: {
    gridColumn: "1 / -1",
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#475569",
    fontSize: 12,
    fontWeight: 700,
    lineHeight: 1.4,
  },
  headerCommandFootnoteDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    flex: "0 0 auto",
  },
  openingPanel: {
    borderRadius: 18,
    border: "1px solid #dbeafe",
    background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 48%, #eff6ff 100%)",
    padding: 18,
    boxShadow: "0 18px 44px rgba(15,23,42,0.10)",
  },
  openingGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.48fr) minmax(300px, 0.52fr)",
    gap: 16,
    alignItems: "stretch",
  },
  openingMedia: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  openingReturns: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
  },
  openingMediaHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
  },
  openingEyebrow: {
    margin: 0,
    color: "#2563eb",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  openingTitle: {
    margin: "5px 0 0",
    color: "#0f172a",
    fontSize: 22,
    lineHeight: 1.16,
  },
  openingPill: {
    borderRadius: 999,
    border: "1px solid #bfdbfe",
    backgroundColor: "#eff6ff",
    color: "#1d4ed8",
    padding: "7px 10px",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  snapshotUnavailable: {
    minHeight: "100%",
    borderRadius: 14,
    border: "1px solid #dbeafe",
    backgroundColor: "#fff",
    padding: 18,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  snapshotUnavailableAction: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    width: "fit-content",
    marginTop: 14,
    borderRadius: 999,
    border: "1px solid #bfdbfe",
    backgroundColor: "#eff6ff",
    color: "#1d4ed8",
    padding: "9px 12px",
    textDecoration: "none",
    fontSize: 12,
    fontWeight: 900,
  },
  freshnessStrip: {
    marginTop: 14,
    borderRadius: 14,
    border: "1px solid #dbeafe",
    background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
    padding: 14,
  },
  freshnessHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 10,
  },
  freshnessEyebrow: {
    margin: 0,
    color: "#2563eb",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  freshnessTitle: {
    margin: "4px 0 0",
    color: "#0f172a",
    fontSize: 16,
    lineHeight: 1.2,
  },
  freshnessPill: {
    borderRadius: 999,
    border: "1px solid #bfdbfe",
    backgroundColor: "#eff6ff",
    color: "#1d4ed8",
    padding: "6px 9px",
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  freshnessGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: 9,
  },
  freshnessCard: {
    minWidth: 0,
    display: "grid",
    gap: 5,
    borderRadius: 11,
    borderWidth: 1,
    borderStyle: "solid",
    padding: 11,
  },
  freshnessCardLabel: {
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  freshnessCardValue: {
    color: "#0f172a",
    fontSize: 16,
    lineHeight: 1.15,
    overflowWrap: "anywhere",
  },
  freshnessCardDetail: {
    color: "#475569",
    fontSize: 11,
    lineHeight: 1.35,
  },
  heroSnapshot: {
    marginTop: 18,
    borderRadius: 14,
    border: "1px solid #bfdbfe",
    background: "linear-gradient(135deg, #eff6ff 0%, #f8fafc 54%, #ecfeff 100%)",
    padding: 16,
    boxShadow: "0 12px 28px rgba(37,99,235,0.10)",
  },
  heroSnapshotFlush: {
    marginTop: 0,
    minHeight: "100%",
  },
  heroSnapshotHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  heroSnapshotEyebrow: {
    margin: 0,
    color: "#2563eb",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
  },
  heroSnapshotTitle: {
    margin: "5px 0 0",
    color: "#0f172a",
    fontSize: 22,
    lineHeight: 1.15,
  },
  heroSnapshotPill: {
    borderRadius: 999,
    border: "1px solid #bfdbfe",
    backgroundColor: "#fff",
    color: "#1e40af",
    padding: "8px 12px",
    fontSize: 12,
    fontWeight: 800,
    maxWidth: 360,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  priorityScorecard: {
    marginTop: 13,
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 10,
    alignItems: "stretch",
  },
  priorityScorecardPrimary: {
    minWidth: 0,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    alignItems: "center",
    gap: 12,
    borderRadius: 13,
    borderWidth: 1,
    borderStyle: "solid",
    padding: 14,
  },
  priorityScorecardEyebrow: {
    display: "block",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  },
  priorityScorecardTitle: {
    display: "block",
    marginTop: 6,
    color: "#0f172a",
    fontSize: 23,
    lineHeight: 1.12,
    overflowWrap: "anywhere",
  },
  priorityScorecardDetail: {
    margin: "8px 0 0",
    color: "#334155",
    fontSize: 13,
    lineHeight: 1.5,
  },
  priorityScorecardAction: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    width: "fit-content",
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
  priorityScorecardMetrics: {
    minWidth: 0,
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 10,
  },
  priorityScorecardMetric: {
    minWidth: 0,
    borderRadius: 13,
    border: "1px solid #dbeafe",
    backgroundColor: "rgba(255,255,255,0.9)",
    padding: 13,
    display: "grid",
    gap: 6,
  },
  priorityScorecardMetricLabel: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  priorityScorecardMetricValue: {
    color: "#0f172a",
    fontSize: 22,
    lineHeight: 1.08,
    fontVariantNumeric: "tabular-nums",
    overflowWrap: "anywhere",
  },
  priorityScorecardMetricDetail: {
    color: "#475569",
    fontSize: 11,
    lineHeight: 1.35,
    overflowWrap: "anywhere",
  },
  priorityScorecardSupport: {
    gridColumn: "1 / -1",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: 10,
  },
  priorityScorecardSupportCard: {
    minWidth: 0,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "solid",
    padding: 12,
    display: "grid",
    gap: 5,
  },
  priorityScorecardSupportLabel: {
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  priorityScorecardSupportValue: {
    color: "#0f172a",
    fontSize: 16,
    lineHeight: 1.14,
    overflowWrap: "anywhere",
  },
  priorityScorecardSupportDetail: {
    color: "#475569",
    fontSize: 11,
    lineHeight: 1.35,
    overflowWrap: "anywhere",
  },
  cashflowTimeline: {
    marginTop: 13,
    borderRadius: 14,
    border: "1px solid #bfdbfe",
    background: "linear-gradient(135deg, rgba(255,255,255,0.94) 0%, rgba(239,246,255,0.88) 100%)",
    padding: 14,
  },
  cashflowTimelineHeader: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 12,
    alignItems: "start",
    marginBottom: 10,
  },
  cashflowTimelineEyebrow: {
    margin: 0,
    color: "#1d4ed8",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  cashflowTimelineTitle: {
    margin: "4px 0 0",
    color: "#0f172a",
    fontSize: 17,
    lineHeight: 1.18,
  },
  cashflowTimelineCopy: {
    margin: "6px 0 0",
    color: "#475569",
    fontSize: 12,
    lineHeight: 1.5,
  },
  cashflowTimelineTotal: {
    minWidth: 150,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "solid",
    padding: "10px 11px",
    display: "grid",
    gap: 4,
  },
  cashflowTimelineTotalLabel: {
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  cashflowTimelineTotalValue: {
    color: "#0f172a",
    fontSize: 22,
    lineHeight: 1.05,
    fontVariantNumeric: "tabular-nums",
    overflowWrap: "anywhere",
  },
  cashflowTimelineTotalDetail: {
    color: "#475569",
    fontSize: 11,
    lineHeight: 1.3,
  },
  cashflowTimelineGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 9,
  },
  cashflowTimelineCard: {
    minWidth: 0,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "solid",
    padding: 12,
    display: "grid",
    gap: 7,
  },
  cashflowTimelineYearHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  cashflowTimelineYearLabel: {
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  cashflowTimelineDscr: {
    fontSize: 10,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  cashflowTimelineYearValue: {
    color: "#0f172a",
    fontSize: 23,
    lineHeight: 1.08,
    fontVariantNumeric: "tabular-nums",
    overflowWrap: "anywhere",
  },
  cashflowTimelineYearStats: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    color: "#475569",
    fontSize: 11,
    fontWeight: 800,
    lineHeight: 1.35,
  },
  operatingBridge: {
    marginTop: 13,
    borderRadius: 13,
    border: "1px solid #bae6fd",
    background: "linear-gradient(135deg, rgba(240,249,255,0.96) 0%, rgba(255,255,255,0.9) 100%)",
    padding: 13,
  },
  operatingBridgeHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 10,
  },
  operatingBridgeEyebrow: {
    margin: 0,
    color: "#0369a1",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  operatingBridgeTitle: {
    margin: "4px 0 0",
    color: "#0f172a",
    fontSize: 16,
    lineHeight: 1.2,
  },
  operatingBridgePill: {
    borderRadius: 999,
    border: "1px solid #bae6fd",
    backgroundColor: "#fff",
    color: "#0369a1",
    padding: "6px 9px",
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  operatingBridgeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
    gap: 9,
  },
  operatingBridgeCard: {
    minWidth: 0,
    display: "grid",
    gap: 5,
    borderRadius: 11,
    borderWidth: 1,
    borderStyle: "solid",
    padding: 11,
  },
  operatingBridgeLabel: {
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  operatingBridgeValue: {
    color: "#0f172a",
    fontSize: 16,
    lineHeight: 1.15,
    overflowWrap: "anywhere",
  },
  operatingBridgeDetail: {
    color: "#475569",
    fontSize: 11,
    lineHeight: 1.4,
    overflowWrap: "anywhere",
  },
  mathAudit: {
    marginTop: 13,
    borderRadius: 13,
    border: "1px solid #bfdbfe",
    background: "linear-gradient(135deg, rgba(255,255,255,0.92) 0%, rgba(239,246,255,0.82) 100%)",
    padding: 13,
  },
  mathAuditHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 10,
  },
  mathAuditEyebrow: {
    margin: 0,
    color: "#1d4ed8",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  mathAuditTitle: {
    margin: "4px 0 0",
    color: "#0f172a",
    fontSize: 16,
    lineHeight: 1.2,
  },
  mathAuditPill: {
    borderRadius: 999,
    border: "1px solid #bfdbfe",
    backgroundColor: "#fff",
    color: "#1d4ed8",
    padding: "6px 9px",
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  mathAuditGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: 9,
  },
  mathAuditCard: {
    minWidth: 0,
    display: "grid",
    gap: 5,
    borderRadius: 11,
    borderWidth: 1,
    borderStyle: "solid",
    padding: 11,
  },
  mathAuditLabel: {
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  mathAuditValue: {
    color: "#0f172a",
    fontSize: 16,
    lineHeight: 1.15,
    overflowWrap: "anywhere",
  },
  mathAuditDetail: {
    color: "#475569",
    fontSize: 11,
    lineHeight: 1.4,
    overflowWrap: "anywhere",
  },
  heroDisclosure: {
    marginTop: 13,
    borderRadius: 13,
    border: "1px solid #dbeafe",
    backgroundColor: "rgba(255,255,255,0.72)",
    overflow: "hidden",
  },
  heroDisclosureSummary: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: 13,
    cursor: "pointer",
    listStyle: "none",
  },
  heroDisclosureEyebrow: {
    display: "block",
    color: "#2563eb",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  },
  heroDisclosureTitle: {
    display: "block",
    marginTop: 4,
    color: "#0f172a",
    fontSize: 16,
    lineHeight: 1.2,
  },
  heroDisclosureCopy: {
    display: "block",
    marginTop: 5,
    color: "#475569",
    fontSize: 12,
    lineHeight: 1.45,
  },
  heroDisclosureBadge: {
    flex: "0 0 auto",
    borderRadius: 999,
    border: "1px solid #bfdbfe",
    backgroundColor: "#eff6ff",
    color: "#1d4ed8",
    padding: "7px 10px",
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  heroSnapshotFormula: {
    marginTop: 10,
    display: "grid",
    gap: 8,
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    borderTop: "1px solid #dbeafe",
    paddingTop: 10,
    color: "#334155",
    fontSize: 13,
    lineHeight: 1.45,
  },
  heroSnapshotFormulaItem: {
    minWidth: 0,
    borderRadius: 10,
    border: "1px solid #dbeafe",
    backgroundColor: "rgba(255,255,255,0.7)",
    padding: "9px 10px",
  },
  heroSnapshotFormulaLabel: {
    display: "block",
    color: "#64748b",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.09em",
    textTransform: "uppercase",
  },
  heroSnapshotFormulaValue: {
    display: "block",
    marginTop: 4,
    color: "#0f172a",
    fontSize: 12,
    fontWeight: 800,
    lineHeight: 1.35,
    overflowWrap: "anywhere",
  },
  heroSnapshotFormulaSubvalue: {
    display: "block",
    marginTop: 5,
    color: "#475569",
    fontSize: 11,
    fontWeight: 700,
    lineHeight: 1.35,
    overflowWrap: "anywhere",
  },
  summaryGrid: {
    marginTop: 22,
    display: "grid",
    gap: 10,
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  },
  summaryCard: {
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    backgroundColor: "#fff",
    padding: 18,
  },
  warnBanner: {
    borderRadius: 8,
    border: "1px solid #fcd34d",
    backgroundColor: "#fffbeb",
    padding: "14px 16px",
    color: "#92400e",
    fontSize: 14,
  },
  inactiveBanner: {
    borderRadius: 8,
    border: "1px solid #fed7aa",
    backgroundColor: "#fff7ed",
    padding: "14px 16px",
    color: "#9a3412",
    fontSize: 14,
    marginBottom: 14,
    lineHeight: 1.5,
  },
  listingFactsPanel: {
    backgroundColor: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 18,
    boxShadow: "0 10px 28px rgba(15,23,42,0.05)",
  },
  listingFactsHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
    flexWrap: "wrap",
    marginBottom: 14,
  },
  listingFactsEyebrow: {
    margin: 0,
    color: "#2563eb",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  listingFactsSourceLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 999,
    border: "1px solid #bfdbfe",
    backgroundColor: "#eff6ff",
    color: "#1d4ed8",
    padding: "9px 12px",
    textDecoration: "none",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  listingFactsSourcePill: {
    borderRadius: 999,
    border: "1px solid #e2e8f0",
    backgroundColor: "#f8fafc",
    color: "#475569",
    padding: "9px 12px",
    fontSize: 12,
    fontWeight: 900,
  },
  listingFactsLayout: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.05fr) minmax(420px, 0.95fr)",
    gap: 14,
    alignItems: "stretch",
  },
  listingDescriptionCard: {
    minWidth: 0,
    borderRadius: 13,
    border: "1px solid #dbeafe",
    background: "linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)",
    padding: 16,
  },
  listingFactsCardLabel: {
    color: "#2563eb",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  },
  listingDescriptionTitle: {
    margin: "7px 0 0",
    color: "#0f172a",
    fontSize: 17,
    lineHeight: 1.25,
  },
  listingDescriptionText: {
    margin: "10px 0 0",
    color: "#334155",
    fontSize: 14,
    lineHeight: 1.7,
  },
  sourceSignalGrid: {
    marginTop: 14,
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 9,
  },
  sourceSignalCard: {
    minWidth: 0,
    borderRadius: 11,
    borderWidth: 1,
    borderStyle: "solid",
    padding: 10,
    display: "grid",
    gap: 5,
  },
  sourceSignalLabel: {
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  sourceSignalValue: {
    color: "#0f172a",
    fontSize: 15,
    lineHeight: 1.15,
    overflowWrap: "anywhere",
  },
  sourceSignalDetail: {
    color: "#475569",
    fontSize: 11,
    lineHeight: 1.35,
  },
  listingFactGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  },
  listingFactCard: {
    minWidth: 0,
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    backgroundColor: "#f8fafc",
    padding: 13,
    display: "grid",
    gap: 6,
  },
  listingFactValue: {
    color: "#0f172a",
    fontSize: 17,
    lineHeight: 1.15,
    overflowWrap: "anywhere",
  },
  listingFactDetail: {
    color: "#64748b",
    fontSize: 11,
    lineHeight: 1.4,
  },
  panel: {
    backgroundColor: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
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
  marketSignalStrip: {
    borderRadius: 14,
    border: "1px solid #dbeafe",
    background: "linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)",
    padding: 14,
    marginBottom: 16,
  },
  marketSignalHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 10,
  },
  marketSignalEyebrow: {
    margin: 0,
    color: "#2563eb",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  marketSignalTitle: {
    margin: "4px 0 0",
    color: "#0f172a",
    fontSize: 16,
    lineHeight: 1.2,
  },
  marketSignalPill: {
    borderRadius: 999,
    border: "1px solid #bfdbfe",
    backgroundColor: "#eff6ff",
    color: "#1d4ed8",
    padding: "6px 9px",
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  marketSignalGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 9,
  },
  marketSignalCard: {
    minWidth: 0,
    borderRadius: 11,
    borderWidth: 1,
    borderStyle: "solid",
    padding: 11,
    display: "grid",
    gap: 5,
  },
  marketSignalLabel: {
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  marketSignalValue: {
    color: "#0f172a",
    fontSize: 18,
    lineHeight: 1.12,
    overflowWrap: "anywhere",
  },
  marketSignalDetail: {
    color: "#475569",
    fontSize: 11,
    lineHeight: 1.35,
  },
  underwritingHandoff: {
    borderRadius: 14,
    border: "1px solid #dbeafe",
    background: "linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)",
    padding: 14,
    marginBottom: 16,
  },
  underwritingHandoffHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 10,
  },
  underwritingHandoffEyebrow: {
    margin: 0,
    color: "#2563eb",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  underwritingHandoffTitle: {
    margin: "4px 0 0",
    color: "#0f172a",
    fontSize: 17,
    lineHeight: 1.2,
  },
  underwritingHandoffCopy: {
    margin: "6px 0 0",
    maxWidth: 900,
    color: "#475569",
    fontSize: 13,
    lineHeight: 1.55,
  },
  underwritingHandoffPill: {
    borderRadius: 999,
    border: "1px solid #bfdbfe",
    backgroundColor: "#fff",
    color: "#1d4ed8",
    padding: "6px 9px",
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  underwritingHandoffGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 9,
  },
  underwritingHandoffCard: {
    minWidth: 0,
    borderRadius: 11,
    borderWidth: 1,
    borderStyle: "solid",
    padding: 11,
    display: "grid",
    gap: 5,
  },
  underwritingHandoffLabel: {
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  underwritingHandoffValue: {
    color: "#0f172a",
    fontSize: 17,
    lineHeight: 1.12,
    overflowWrap: "anywhere",
  },
  underwritingHandoffDetail: {
    color: "#475569",
    fontSize: 11,
    lineHeight: 1.35,
  },
  underwritingHandoffRisks: {
    marginTop: 10,
    borderTop: "1px solid #bfdbfe",
    paddingTop: 10,
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    flexWrap: "wrap",
  },
  underwritingHandoffRiskLabel: {
    color: "#2563eb",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    paddingTop: 7,
  },
  underwritingHandoffRiskList: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    flex: "1 1 320px",
  },
  underwritingHandoffRiskChip: {
    borderRadius: 999,
    border: "1px solid #bfdbfe",
    backgroundColor: "#fff",
    color: "#334155",
    padding: "7px 9px",
    fontSize: 11,
    fontWeight: 800,
    lineHeight: 1.35,
  },
  returnStickyBar: {
    position: "sticky",
    top: 12,
    alignSelf: "start",
    zIndex: 25,
    display: "grid",
    gridTemplateColumns: "minmax(170px, 0.9fr) minmax(0, 2.5fr) auto",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    border: "1px solid #c7d2fe",
    background: "rgba(255,255,255,0.97)",
    boxShadow: "0 14px 34px rgba(15,23,42,0.10)",
    padding: 12,
    backdropFilter: "blur(14px)",
  },
  returnStickyIntro: {
    minWidth: 0,
    display: "grid",
    gap: 3,
  },
  returnStickyEyebrow: {
    color: "#2563eb",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  returnStickyTitle: {
    color: "#0f172a",
    fontSize: 15,
    lineHeight: 1.2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  returnStickyMetrics: {
    minWidth: 0,
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(92px, 1fr))",
    gap: 8,
  },
  returnStickyMetric: {
    minWidth: 0,
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    backgroundColor: "#f8fafc",
    padding: "8px 9px",
  },
  returnStickyMetricLabel: {
    display: "block",
    color: "#64748b",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  returnStickyMetricValue: {
    display: "block",
    marginTop: 3,
    color: "#0f172a",
    fontSize: 14,
    lineHeight: 1.15,
    fontVariantNumeric: "tabular-nums",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  returnStickyAction: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 999,
    border: "1px solid #bfdbfe",
    padding: "9px 11px",
    textDecoration: "none",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  decisionCommandBar: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 10,
    alignItems: "stretch",
    borderRadius: 16,
    border: "1px solid #c7d2fe",
    background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 46%, #eff6ff 100%)",
    boxShadow: "0 16px 36px rgba(15,23,42,0.08)",
    padding: 14,
  },
  decisionCommandPrimary: {
    minWidth: 0,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    alignItems: "center",
    gap: 12,
    borderRadius: 13,
    borderWidth: 1,
    borderStyle: "solid",
    padding: 13,
  },
  decisionCommandEyebrow: {
    display: "block",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  },
  decisionCommandTitle: {
    display: "block",
    marginTop: 5,
    color: "#0f172a",
    fontSize: 22,
    lineHeight: 1.15,
    overflowWrap: "anywhere",
  },
  decisionCommandDetail: {
    margin: "6px 0 0",
    color: "#334155",
    fontSize: 12,
    lineHeight: 1.45,
  },
  decisionCommandAction: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "solid",
    backgroundColor: "#fff",
    padding: "8px 10px",
    textDecoration: "none",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  decisionCommandMetrics: {
    minWidth: 0,
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 8,
  },
  decisionCommandMetric: {
    minWidth: 0,
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    backgroundColor: "#fff",
    padding: 11,
    display: "grid",
    gap: 5,
  },
  decisionCommandMetricLabel: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  decisionCommandMetricValue: {
    color: "#0f172a",
    fontSize: 18,
    lineHeight: 1.12,
    fontVariantNumeric: "tabular-nums",
    overflowWrap: "anywhere",
  },
  decisionCommandMetricDetail: {
    color: "#64748b",
    fontSize: 11,
    lineHeight: 1.35,
    overflowWrap: "anywhere",
  },
  decisionCommandSide: {
    minWidth: 0,
    display: "grid",
    gap: 8,
  },
  decisionCommandDataCard: {
    minWidth: 0,
    display: "grid",
    gap: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "solid",
    padding: "10px 11px",
  },
  decisionCommandSideLabel: {
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  decisionCommandSideValue: {
    color: "#0f172a",
    fontSize: 15,
    lineHeight: 1.18,
    overflowWrap: "anywhere",
  },
  decisionCommandSideDetail: {
    color: "#475569",
    fontSize: 11,
    lineHeight: 1.35,
  },
  decisionCommandSideLink: {
    minWidth: 0,
    display: "grid",
    gap: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "solid",
    padding: "10px 11px",
    textDecoration: "none",
    fontSize: 11,
    fontWeight: 900,
    lineHeight: 1.25,
  },
  decisionCommandGuide: {
    minWidth: 0,
    borderRadius: 13,
    border: "1px solid #dbeafe",
    background: "rgba(255,255,255,0.78)",
    padding: 12,
  },
  decisionCommandActionPanel: {
    minWidth: 0,
    borderRadius: 13,
    border: "1px solid #dbeafe",
    background: "rgba(255,255,255,0.78)",
    padding: 12,
  },
  decisionCommandActionPanelHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 10,
  },
  decisionCommandActionPanelTitle: {
    display: "block",
    marginTop: 4,
    color: "#0f172a",
    fontSize: 16,
    lineHeight: 1.2,
  },
  decisionCommandGuideHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 10,
  },
  decisionCommandGuideEyebrow: {
    display: "block",
    color: "#2563eb",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  decisionCommandGuideTitle: {
    display: "block",
    marginTop: 4,
    color: "#0f172a",
    fontSize: 16,
    lineHeight: 1.2,
  },
  decisionCommandGuidePill: {
    borderRadius: 999,
    border: "1px solid #bfdbfe",
    backgroundColor: "#eff6ff",
    color: "#1d4ed8",
    padding: "6px 9px",
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  decisionCommandRouteGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
    gap: 8,
  },
  decisionCommandRouteLink: {
    minWidth: 0,
    display: "grid",
    gap: 4,
    borderRadius: 11,
    border: "1px solid #e2e8f0",
    backgroundColor: "#f8fafc",
    color: "#0f172a",
    padding: "10px 11px",
    textDecoration: "none",
  },
  decisionCommandRouteLeadLink: {
    borderColor: "#bfdbfe",
    background: "linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)",
  },
  decisionCommandRouteLabel: {
    color: "#1d4ed8",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  decisionCommandRouteLeadLabel: {
    color: "#1e40af",
  },
  decisionCommandRouteDetail: {
    color: "#475569",
    fontSize: 11,
    fontWeight: 800,
    lineHeight: 1.32,
    overflowWrap: "anywhere",
  },
  decisionCommandRouteLeadDetail: {
    color: "#0f172a",
    fontSize: 12,
  },
  decisionCommandCheckGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 8,
  },
  decisionCommandCheckCard: {
    minWidth: 0,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    alignItems: "center",
    gap: 8,
    borderRadius: 11,
    borderWidth: 1,
    borderStyle: "solid",
    padding: "10px 11px",
    textDecoration: "none",
  },
  decisionCommandCheckLabel: {
    display: "block",
    gridColumn: "1 / -1",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  decisionCommandCheckValue: {
    color: "#0f172a",
    fontSize: 14,
    lineHeight: 1.18,
    overflowWrap: "anywhere",
  },
  decisionCommandCheckCta: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    color: "inherit",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  dataTrustPanel: {
    borderRadius: 14,
    border: "1px solid #dbeafe",
    background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
    padding: 14,
    marginBottom: 16,
  },
  dataTrustVerdict: {
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "solid",
    padding: 14,
    marginBottom: 10,
  },
  dataTrustVerdictLabel: {
    display: "block",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  },
  dataTrustVerdictHeadline: {
    display: "block",
    marginTop: 5,
    color: "#0f172a",
    fontSize: 18,
    lineHeight: 1.2,
  },
  dataTrustVerdictDetail: {
    margin: "6px 0 0",
    color: "#475569",
    fontSize: 13,
    lineHeight: 1.55,
  },
  dataTrustGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 9,
  },
  dataTrustCard: {
    minWidth: 0,
    borderRadius: 11,
    borderWidth: 1,
    borderStyle: "solid",
    padding: 11,
    display: "grid",
    gap: 5,
  },
  dataTrustCardLabel: {
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  dataTrustCardValue: {
    color: "#0f172a",
    fontSize: 17,
    lineHeight: 1.12,
    overflowWrap: "anywhere",
  },
  dataTrustCardDetail: {
    color: "#475569",
    fontSize: 11,
    lineHeight: 1.35,
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
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    padding: 18,
  },
  benchmarkLayout: {
    display: "grid",
    gap: 16,
    gridTemplateColumns: "minmax(0, 1.4fr) minmax(280px, 0.9fr)",
  },
  sidePanel: {
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    backgroundColor: "#f8fafc",
    padding: 18,
  },
  dataRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    borderRadius: 8,
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
