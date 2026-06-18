"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, ClipboardList, Home, Settings2 } from "lucide-react";

type ProfilePayload = {
  email: string;
  firstName: string | null;
  lastName: string | null;
  firstPropertyBuyer: boolean | null;
  willLiveThere: boolean | null;
  preferredAssetBand: string | null;
  preferredDealStage: string | null;
  plansRenovations: boolean | null;
  averageManagementFeePct: number | null;
  insuranceDefaultBasis: string | null;
  insuranceDefaultValue: number | null;
  repairsDefaultBasis: string | null;
  repairsDefaultValue: number | null;
  utilitiesDefaultBasis: string | null;
  utilitiesDefaultValue: number | null;
  snowDefaultBasis: string | null;
  snowDefaultValue: number | null;
  onboardingCompletedAt: string | null;
  onboardingSkippedAt: string | null;
  onboardingRequired: boolean;
};

type ExpenseBasisValue =
  | "percent_of_egi"
  | "annual_total"
  | "annual_per_unit"
  | "annual_per_sqft"
  | "";

type ProfilePreviewTone = "green" | "amber" | "blue" | "violet" | "slate";

type ProfilePreviewItem = {
  label: string;
  value: string;
  detail: string;
  href: string;
  action: string;
  tone: ProfilePreviewTone;
};

type ProfileCommandSignal = {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  tone: "blue" | "green" | "violet" | "slate" | "amber";
};

function toDisplayTemplateValue(value: number | null, basis: string | null): string {
  if (value == null) return "";
  return basis === "percent_of_egi" ? String(value * 100) : String(value);
}

function toStoredTemplateValue(value: string, basis: ExpenseBasisValue): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return basis === "percent_of_egi" ? parsed / 100 : parsed;
}

const CARD: React.CSSProperties = {
  backgroundColor: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
};

const PROFILE_PRIMARY_ACTION: React.CSSProperties = {
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
};

const PROFILE_SECONDARY_ACTION: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 999,
  border: "1px solid #bfdbfe",
  backgroundColor: "#eff6ff",
  color: "#1d4ed8",
  padding: "10px 14px",
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 900,
};

const stylesProfileCommandPanel: React.CSSProperties = {
  ...CARD,
  display: "grid",
  gridTemplateColumns: "minmax(0, 0.92fr) minmax(420px, 1.08fr)",
  gap: 14,
  alignItems: "stretch",
  padding: 18,
  borderRadius: 16,
  borderColor: "#dbeafe",
  background: "linear-gradient(135deg, #ffffff 0%, #eff6ff 100%)",
  boxShadow: "0 16px 38px rgba(37,99,235,0.10)",
};

const stylesProfileCommandVerdict: React.CSSProperties = {
  minWidth: 0,
  borderRadius: 13,
  border: "1px solid #fed7aa",
  backgroundColor: "#fff7ed",
  padding: 16,
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  gap: 14,
};

const stylesProfileCommandVerdictReady: React.CSSProperties = {
  ...stylesProfileCommandVerdict,
  borderColor: "#bbf7d0",
  backgroundColor: "#ecfdf3",
};

const stylesProfileCommandEyebrow: React.CSSProperties = {
  margin: 0,
  color: "#c2410c",
  fontSize: 11,
  fontWeight: 950,
  letterSpacing: "0.12em",
};

const stylesProfileCommandEyebrowReady: React.CSSProperties = {
  ...stylesProfileCommandEyebrow,
  color: "#166534",
};

const stylesProfileCommandTitle: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#0f172a",
  fontSize: 24,
  lineHeight: 1.12,
};

const stylesProfileCommandCopy: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#475569",
  fontSize: 14,
  lineHeight: 1.6,
};

const stylesProfileCommandProgressRow: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginTop: 12,
};

const stylesProfileCommandProgress: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  borderRadius: 999,
  borderWidth: 1,
  borderStyle: "solid",
  padding: "6px 9px",
  fontSize: 12,
  fontWeight: 900,
};

const stylesProfileCommandActions: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const stylesProfileCommandAmberAction: React.CSSProperties = {
  ...PROFILE_PRIMARY_ACTION,
  borderColor: "#ea580c",
  backgroundColor: "#ea580c",
};

const stylesProfileCommandProof: React.CSSProperties = {
  minWidth: 0,
  borderRadius: 13,
  border: "1px solid #bfdbfe",
  backgroundColor: "rgba(255,255,255,0.78)",
  padding: 14,
  display: "grid",
  gap: 10,
};

const stylesProfileCommandProofHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
};

const stylesProfileCommandProofEyebrow: React.CSSProperties = {
  display: "block",
  color: "#2563eb",
  fontSize: 10,
  fontWeight: 950,
  letterSpacing: "0.11em",
  textTransform: "uppercase",
};

const stylesProfileCommandProofTitle: React.CSSProperties = {
  display: "block",
  marginTop: 4,
  color: "#0f172a",
  fontSize: 16,
  lineHeight: 1.2,
};

const stylesProfileCommandPill: React.CSSProperties = {
  borderRadius: 999,
  border: "1px solid #fde68a",
  backgroundColor: "#fffbeb",
  color: "#b45309",
  padding: "7px 10px",
  fontSize: 11,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const stylesProfileCommandPillReady: React.CSSProperties = {
  ...stylesProfileCommandPill,
  borderColor: "#bbf7d0",
  backgroundColor: "#ecfdf3",
  color: "#166534",
};

const stylesProfileCommandSignalGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 8,
};

const stylesProfileCommandSignalCard: React.CSSProperties = {
  minWidth: 0,
  borderRadius: 11,
  borderWidth: 1,
  borderStyle: "solid",
  padding: 10,
  display: "grid",
  gap: 5,
};

const stylesProfileCommandSignalIcon: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 9,
  borderWidth: 1,
  borderStyle: "solid",
  backgroundColor: "#fff",
  display: "grid",
  placeItems: "center",
};

const stylesProfileCommandSignalLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 950,
  letterSpacing: "0.07em",
  textTransform: "uppercase",
};

const stylesProfileCommandSignalValue: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 18,
  lineHeight: 1.08,
  overflowWrap: "anywhere",
};

const stylesProfileCommandSignalDetail: React.CSSProperties = {
  color: "#475569",
  fontSize: 11,
  lineHeight: 1.35,
};

const stylesProfileCommandProofNote: React.CSSProperties = {
  borderRadius: 11,
  border: "1px solid #dbeafe",
  backgroundColor: "#fff",
  padding: 11,
  display: "grid",
  gap: 4,
  color: "#475569",
  fontSize: 12,
  lineHeight: 1.45,
};

const ROUTING_QUESTION_TOTAL = 5;
const OPERATING_DEFAULT_TOTAL = 5;

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [authRequired, setAuthRequired] = useState(false);
  const [saveToProfile, setSaveToProfile] = useState(true);
  const [firstPropertyBuyer, setFirstPropertyBuyer] = useState<boolean | null>(null);
  const [willLiveThere, setWillLiveThere] = useState<boolean | null>(null);
  const [preferredAssetBand, setPreferredAssetBand] = useState("flexible");
  const [preferredDealStage, setPreferredDealStage] = useState("either");
  const [plansRenovations, setPlansRenovations] = useState<boolean | null>(null);
  const [averageManagementFeePct, setAverageManagementFeePct] = useState("");
  const [insuranceDefaultBasis, setInsuranceDefaultBasis] = useState<ExpenseBasisValue>("");
  const [insuranceDefaultValue, setInsuranceDefaultValue] = useState("");
  const [repairsDefaultBasis, setRepairsDefaultBasis] = useState<ExpenseBasisValue>("");
  const [repairsDefaultValue, setRepairsDefaultValue] = useState("");
  const [utilitiesDefaultBasis, setUtilitiesDefaultBasis] = useState<ExpenseBasisValue>("");
  const [utilitiesDefaultValue, setUtilitiesDefaultValue] = useState("");
  const [snowDefaultBasis, setSnowDefaultBasis] = useState<ExpenseBasisValue>("");
  const [snowDefaultValue, setSnowDefaultValue] = useState("");

  useEffect(() => {
    setAuthRequired(false);
    setError("");
    fetch("/api/profile")
      .then(async (res) => {
        if (res.status === 401) {
          setAuthRequired(true);
          throw new Error("unauthorized");
        }
        if (!res.ok) throw new Error("Failed to load profile.");
        return res.json();
      })
      .then((data: ProfilePayload) => {
        setProfile(data);
        setFirstPropertyBuyer(data.firstPropertyBuyer);
        setWillLiveThere(data.willLiveThere);
        setPreferredAssetBand(data.preferredAssetBand ?? "flexible");
        setPreferredDealStage(data.preferredDealStage ?? "either");
        setPlansRenovations(data.plansRenovations);
        setAverageManagementFeePct(
          data.averageManagementFeePct != null ? String(data.averageManagementFeePct * 100) : ""
        );
        setInsuranceDefaultBasis((data.insuranceDefaultBasis as ExpenseBasisValue | null) ?? "");
        setInsuranceDefaultValue(toDisplayTemplateValue(data.insuranceDefaultValue, data.insuranceDefaultBasis));
        setRepairsDefaultBasis((data.repairsDefaultBasis as ExpenseBasisValue | null) ?? "");
        setRepairsDefaultValue(toDisplayTemplateValue(data.repairsDefaultValue, data.repairsDefaultBasis));
        setUtilitiesDefaultBasis((data.utilitiesDefaultBasis as ExpenseBasisValue | null) ?? "");
        setUtilitiesDefaultValue(toDisplayTemplateValue(data.utilitiesDefaultValue, data.utilitiesDefaultBasis));
        setSnowDefaultBasis((data.snowDefaultBasis as ExpenseBasisValue | null) ?? "");
        setSnowDefaultValue(toDisplayTemplateValue(data.snowDefaultValue, data.snowDefaultBasis));
      })
      .catch((err: Error) => {
        if (err.message !== "unauthorized") {
          setError("Could not load your profile.");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const isFirstVisit = useMemo(
    () => Boolean(profile?.onboardingRequired),
    [profile]
  );
  const routingAnswersCompleted =
    [firstPropertyBuyer, willLiveThere, plansRenovations].filter((value) => value !== null).length +
    (preferredAssetBand ? 1 : 0) +
    (preferredDealStage ? 1 : 0);
  const operatingDefaultsCompleted = [
    averageManagementFeePct,
    insuranceDefaultBasis && insuranceDefaultValue,
    repairsDefaultBasis && repairsDefaultValue,
    utilitiesDefaultBasis && utilitiesDefaultValue,
    snowDefaultBasis && snowDefaultValue,
  ].filter(Boolean).length;
  const profileStatus = profile?.onboardingCompletedAt
    ? "Saved"
    : profile?.onboardingSkippedAt
      ? "Skipped"
      : "In progress";
  const missingRoutingSteps = [
    firstPropertyBuyer == null ? "first property status" : null,
    willLiveThere == null ? "occupancy plan" : null,
    preferredAssetBand ? null : "target asset size",
    preferredDealStage ? null : "deal stage",
    plansRenovations == null ? "renovation intent" : null,
  ].filter((step): step is string => Boolean(step));
  const routingProgressLabel = formatProgressLabel(routingAnswersCompleted, ROUTING_QUESTION_TOTAL, "answered");
  const operatingProgressLabel = formatProgressLabel(operatingDefaultsCompleted, OPERATING_DEFAULT_TOTAL, "defaults set");
  const operatingShortLabel = formatProgressLabel(operatingDefaultsCompleted, OPERATING_DEFAULT_TOTAL, "set");
  const routingProgressPct = progressPercent(routingAnswersCompleted, ROUTING_QUESTION_TOTAL);
  const operatingProgressPct = progressPercent(operatingDefaultsCompleted, OPERATING_DEFAULT_TOTAL);
  const financingLane =
    willLiveThere === true
      ? "Owner-occupied borrower screen"
      : preferredAssetBand === "five_plus_units"
        ? "5+ unit commercial / CMHC screen"
        : willLiveThere === false
          ? "Investor rental screen"
          : "Set occupancy to choose the lane";
  const rentalIncomeTreatment =
    willLiveThere === true
      ? "Owner unit is excluded from rental-income support."
      : willLiveThere === false
        ? "All rented units can support the investor rental model."
        : "Occupancy answer decides how rental income is counted.";
  const nextProfileAction =
    missingRoutingSteps.length > 0
      ? `Answer ${missingRoutingSteps[0]} next.`
      : operatingDefaultsCompleted < 5
        ? "Optional: add expense defaults to reduce assumed fields."
        : "Profile is ready to drive dashboard screening.";
  const setupRoadmapSteps = [
    {
      step: "1",
      title: "Route the deal",
      status: routingProgressLabel,
      detail:
        missingRoutingSteps.length > 0
          ? `Next: ${missingRoutingSteps[0]}.`
          : `Route is set to ${financingLane}.`,
      href: "#financing-route",
      action: "Edit route",
      tone: "blue" as const,
    },
    {
      step: "2",
      title: "Tune expense defaults",
      status: operatingShortLabel,
      detail:
        operatingDefaultsCompleted > 0
          ? "These defaults reduce assumed NOI fields when listings are incomplete."
          : "Optional, but useful when source listings omit operating costs.",
      href: "#operating-assumptions",
      action: "Set defaults",
      tone: "violet" as const,
    },
    {
      step: "3",
      title: "Save and screen",
      status: saveToProfile ? "Will save" : "Session only",
      detail: saveToProfile
        ? "Saved answers will feed future dashboard and listing screens."
        : "You can continue once without changing your saved profile.",
      href: "#profile-actions",
      action: "Review save",
      tone: "green" as const,
    },
  ];
  const assumptionQualityRows = [
    {
      label: "Management fee",
      status: averageManagementFeePct.trim() ? "Profile override" : "App baseline",
      value: averageManagementFeePct.trim() ? `${averageManagementFeePct}% of EGI` : "Not set",
      detail: "Affects NOI and cashflow when source management cost is missing.",
    },
    {
      label: "Insurance",
      status: hasExpenseDefault(insuranceDefaultBasis, insuranceDefaultValue) ? "Profile override" : "App baseline",
      value: describeExpenseDefault(insuranceDefaultBasis, insuranceDefaultValue),
      detail: "Used when annual insurance is not available from the listing source.",
    },
    {
      label: "Repairs",
      status: hasExpenseDefault(repairsDefaultBasis, repairsDefaultValue) ? "Profile override" : "App baseline",
      value: describeExpenseDefault(repairsDefaultBasis, repairsDefaultValue),
      detail: "Helps avoid overly optimistic NOI on older or value-add assets.",
    },
    {
      label: "Utilities/common",
      status: hasExpenseDefault(utilitiesDefaultBasis, utilitiesDefaultValue) ? "Profile override" : "App baseline",
      value: describeExpenseDefault(utilitiesDefaultBasis, utilitiesDefaultValue),
      detail: "Used when owner-paid utility exposure is not structured in the source.",
    },
    {
      label: "Snow/landscaping",
      status: hasExpenseDefault(snowDefaultBasis, snowDefaultValue) ? "Profile override" : "App baseline",
      value: describeExpenseDefault(snowDefaultBasis, snowDefaultValue),
      detail: "Applies a recurring exterior-maintenance fallback when needed.",
    },
  ];
  const assumptionOverrideCount = assumptionQualityRows.filter((row) => row.status === "Profile override").length;
  const assumptionBaselineCount = assumptionQualityRows.length - assumptionOverrideCount;
  const targetInventory =
    preferredAssetBand === "five_plus_units"
      ? "5+ unit multifamily"
      : preferredAssetBand === "one_to_four_units"
        ? "1-4 unit rentals"
        : "Flexible inventory";
  const dashboardPreviewHref =
    preferredAssetBand === "five_plus_units"
      ? "/?propertyTypes=Multi-Family&minUnits=5&sort=roi_desc"
      : preferredAssetBand === "one_to_four_units"
        ? "/?propertyTypes=Multi-Family&maxUnits=4&sort=roi_desc"
        : "/?sort=roi_desc";
  const routeQualityTone: ProfilePreviewTone =
    missingRoutingSteps.length > 0 ? "amber" : preferredAssetBand === "five_plus_units" ? "blue" : "green";
  const noiFallbackTone: ProfilePreviewTone =
    operatingDefaultsCompleted >= 4 ? "green" : operatingDefaultsCompleted > 0 ? "violet" : "slate";
  const screeningPreviewItems: ProfilePreviewItem[] = [
    {
      label: "Dashboard route",
      value: targetInventory,
      detail:
        missingRoutingSteps.length > 0
          ? `Complete ${missingRoutingSteps[0]} before treating filtered inventory as final.`
          : `${financingLane}. Sort the queue by modeled ROI first.`,
      href: missingRoutingSteps.length > 0 ? "#financing-route" : dashboardPreviewHref,
      action: missingRoutingSteps.length > 0 ? "Finish route" : "Open queue",
      tone: routeQualityTone,
    },
    {
      label: "Borrower lane",
      value: willLiveThere == null ? "Occupancy missing" : willLiveThere ? "Owner-occupied" : "Investor rental",
      detail: rentalIncomeTreatment,
      href: willLiveThere == null ? "#financing-route" : "/underwriting",
      action: willLiveThere == null ? "Set occupancy" : "Open underwriting",
      tone: willLiveThere == null ? "amber" : willLiveThere ? "blue" : "green",
    },
    {
      label: "NOI fallbacks",
      value: formatProgressLabel(operatingDefaultsCompleted, OPERATING_DEFAULT_TOTAL, "defaults"),
      detail:
        operatingDefaultsCompleted > 0
          ? "Sparse listings will use more of your profile assumptions instead of app baselines."
          : "Sparse listings still rely on generic operating-cost assumptions.",
      href: "#operating-assumptions",
      action: operatingDefaultsCompleted > 0 ? "Review defaults" : "Add defaults",
      tone: noiFallbackTone,
    },
    {
      label: "Save behavior",
      value: saveToProfile ? "Applies going forward" : "Session only",
      detail: saveToProfile
        ? "Dashboard and listing underwriting will use these answers after save."
        : "You can continue once without changing saved defaults.",
      href: "#profile-actions",
      action: "Review save",
      tone: saveToProfile ? "green" : "slate",
    },
  ];
  const profileCommandSignals: ProfileCommandSignal[] = [
    {
      icon: <ClipboardList size={18} />,
      label: "Route answers",
      value: `${boundedCount(routingAnswersCompleted, ROUTING_QUESTION_TOTAL)} / ${ROUTING_QUESTION_TOTAL}`,
      detail: missingRoutingSteps.length > 0 ? `Next: ${missingRoutingSteps[0]}.` : `Route set to ${targetInventory}.`,
      tone: missingRoutingSteps.length > 0 ? "amber" : "blue",
    },
    {
      icon: <Home size={18} />,
      label: "Borrower lane",
      value: willLiveThere == null ? "Not set" : willLiveThere ? "Owner-use" : "Investor",
      detail: rentalIncomeTreatment,
      tone: willLiveThere == null ? "amber" : willLiveThere ? "blue" : "green",
    },
    {
      icon: <Settings2 size={18} />,
      label: "NOI defaults",
      value: `${boundedCount(operatingDefaultsCompleted, OPERATING_DEFAULT_TOTAL)} / ${OPERATING_DEFAULT_TOTAL}`,
      detail:
        operatingDefaultsCompleted > 0
          ? `${assumptionOverrideCount} profile override${assumptionOverrideCount === 1 ? "" : "s"} ready for sparse listings.`
          : "Sparse listings still use app baselines.",
      tone: operatingDefaultsCompleted > 0 ? "violet" : "slate",
    },
    {
      icon: <CheckCircle2 size={18} />,
      label: "Save behavior",
      value: saveToProfile ? "Persistent" : "Session",
      detail: saveToProfile ? "Future dashboards and listing pages will use these answers." : "Continue once without changing saved defaults.",
      tone: saveToProfile ? "green" : "slate",
    },
  ];

  async function handleSave() {
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saveToProfile,
          firstPropertyBuyer,
          willLiveThere,
          preferredAssetBand,
          preferredDealStage,
          plansRenovations,
          averageManagementFeePct:
            averageManagementFeePct.trim() === ""
              ? null
              : Number(averageManagementFeePct) / 100,
          insuranceDefaultBasis: insuranceDefaultBasis || null,
          insuranceDefaultValue: toStoredTemplateValue(insuranceDefaultValue, insuranceDefaultBasis),
          repairsDefaultBasis: repairsDefaultBasis || null,
          repairsDefaultValue: toStoredTemplateValue(repairsDefaultValue, repairsDefaultBasis),
          utilitiesDefaultBasis: utilitiesDefaultBasis || null,
          utilitiesDefaultValue: toStoredTemplateValue(utilitiesDefaultValue, utilitiesDefaultBasis),
          snowDefaultBasis: snowDefaultBasis || null,
          snowDefaultValue: toStoredTemplateValue(snowDefaultValue, snowDefaultBasis),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not save your profile.");
        setSaving(false);
        return;
      }
      window.location.href = "/";
    } catch {
      setError("Could not save your profile.");
      setSaving(false);
    }
  }

  async function handleSkip() {
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skip: true }),
      });
      if (!res.ok) throw new Error("skip_failed");
      window.location.href = "/";
    } catch {
      setError("Could not skip right now.");
      setSaving(false);
    }
  }

  if (loading) {
    return <ProfileGateState mode="loading" onRetry={() => window.location.reload()} />;
  }

  if (authRequired) {
    return <ProfileGateState mode="auth" />;
  }

  if (error && !profile) {
    return <ProfileGateState mode="error" message={error} onRetry={() => window.location.reload()} />;
  }

  return (
    <div className="dashboard-page profile-page" style={{ minHeight: "100vh", backgroundColor: "#f8fafc", padding: 24, boxSizing: "border-box" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto", display: "grid", gap: 20 }}>
        <header
          className="profile-hero"
          style={{
            ...CARD,
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) auto",
            gap: 16,
            alignItems: "flex-start",
            padding: 22,
            background: "linear-gradient(135deg, #ffffff 0%, #eff6ff 100%)",
            borderColor: "#dbeafe",
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#64748b" }}>
              Profile
            </p>
            <h1 style={{ margin: "8px 0 0", fontSize: 32, lineHeight: 1.1, color: "#0f172a" }}>
              {isFirstVisit ? "Quick prescreening" : "Investor profile"}
            </h1>
            <p style={{ margin: "10px 0 0", maxWidth: 760, fontSize: 15, lineHeight: 1.7, color: "#475569" }}>
              Answer a few financing questions once so the app can route owner-occupied, CMHC, small rental, and 5+ unit scenarios more accurately.
            </p>
            <div className="profile-hero-action-row" style={{ display: "flex", flexWrap: "wrap", gap: 9, marginTop: 14 }}>
              <a href="#financing-route" style={PROFILE_PRIMARY_ACTION}>
                Finish route
                <ArrowRight size={14} />
              </a>
              <a href="#operating-assumptions" style={PROFILE_SECONDARY_ACTION}>
                Expense defaults
              </a>
            </div>
          </div>
          <Link
            href="/"
            className="profile-hero-back-link"
            style={{
              whiteSpace: "nowrap",
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              backgroundColor: "#fff",
              color: "#475569",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Back to dashboard
          </Link>
        </header>

        <ProfileCommandPanel
          nextAction={nextProfileAction}
          missingInput={missingRoutingSteps[0] ?? null}
          routingProgressPct={routingProgressPct}
          operatingProgressPct={operatingProgressPct}
          financingLane={financingLane}
          rentalIncomeTreatment={rentalIncomeTreatment}
          saveToProfile={saveToProfile}
          dashboardPreviewHref={dashboardPreviewHref}
          signals={profileCommandSignals}
        />

        <ProfileScreeningPreview
          items={screeningPreviewItems}
          routeComplete={missingRoutingSteps.length === 0}
          routingProgressPct={routingProgressPct}
          operatingProgressPct={operatingProgressPct}
        />

        <section style={{ ...CARD, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#64748b" }}>
                Setup roadmap
              </p>
              <h2 style={{ margin: "6px 0 0", color: "#0f172a", fontSize: 22, lineHeight: 1.25 }}>
                Finish the inputs that change screening first
              </h2>
              <p style={{ margin: "6px 0 0", maxWidth: 780, color: "#64748b", fontSize: 14, lineHeight: 1.6 }}>
                Work top to bottom: route the deal, tune defaults only if useful, then save the profile before reviewing inventory.
              </p>
            </div>
            <Link
              href="/underwriting"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                borderRadius: 999,
                border: "1px solid #bfdbfe",
                backgroundColor: "#eff6ff",
                color: "#1d4ed8",
                padding: "9px 12px",
                textDecoration: "none",
                fontSize: 13,
                fontWeight: 800,
              }}
            >
              Capital gate
              <ArrowRight size={14} />
            </Link>
          </div>
          <div style={{ marginTop: 15, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {setupRoadmapSteps.map((item) => (
              <RoadmapCard key={item.step} {...item} />
            ))}
          </div>
        </section>

        <div style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
          <div style={{ ...CARD, padding: 24 }}>
            <div style={{ display: "grid", gap: 18 }}>
              <SectionIntro
                id="financing-route"
                step="1"
                title="Financing route"
                subtitle="These five answers decide whether listings should be screened as owner-occupied, investor rental, 5+ unit, construction, or renovation scenarios."
                progressLabel={routingProgressLabel}
                progressPct={routingProgressPct}
              />
              <QuestionCard
                title="Is this your first property purchase?"
                subtitle="Used to assess first-time buyer and owner-occupied CMHC paths."
                value={firstPropertyBuyer}
                onChange={setFirstPropertyBuyer}
              />
              <QuestionCard
                title="Will you live in the property?"
                subtitle="This changes owner-occupied versus investor financing treatment."
                testId="profile-question-occupancy"
                value={willLiveThere}
                onChange={setWillLiveThere}
              />
              <SelectCard
                title="What type of asset are you mainly targeting?"
                subtitle="This helps route 1–4 unit versus 5+ unit financing screens."
                value={preferredAssetBand}
                onChange={setPreferredAssetBand}
                options={[
                  { value: "one_to_four_units", label: "1–4 units" },
                  { value: "five_plus_units", label: "5+ units" },
                  { value: "flexible", label: "Flexible" },
                ]}
              />
              <SelectCard
                title="Are you targeting an existing building or new construction?"
                subtitle="This helps route Standard Rental, MLI Select, ACLP, and improvement paths."
                value={preferredDealStage}
                onChange={setPreferredDealStage}
                options={[
                  { value: "existing", label: "Existing building" },
                  { value: "new_construction", label: "New construction" },
                  { value: "either", label: "Either" },
                ]}
              />
              <QuestionCard
                title="Are you planning renovations right away?"
                subtitle="Used to route value-add, improvement, and bridge-style financing screens."
                value={plansRenovations}
                onChange={setPlansRenovations}
              />
              <div
                style={{
                  borderTop: "1px solid #e2e8f0",
                  paddingTop: 20,
                  display: "grid",
                  gap: 16,
                }}
              >
                <SectionIntro
                  id="operating-assumptions"
                  step="2"
                  title="Operating assumptions"
                  subtitle="Optional defaults flow into listing underwriting when the source does not provide exact operating costs."
                  progressLabel={operatingProgressLabel}
                  progressPct={operatingProgressPct}
                />

                <div className="profile-operating-defaults" style={{ display: "grid", gap: 14 }}>
                  <ProfileOperatingSection
                    eyebrow="2A. Management policy"
                    title="Start with how the asset is managed"
                    detail="Leave this blank or set 0 if you self-manage. Add a percentage only when you want every sparse listing to carry a management-fee override."
                  >
                    <InputCard
                      title="Average management fee"
                      subtitle="Optional percentage of effective gross income used only when a listing lacks management cost data."
                      suffix="%"
                      value={averageManagementFeePct}
                      onChange={setAverageManagementFeePct}
                      placeholder="0"
                    />
                  </ProfileOperatingSection>

                  <ProfileOperatingSection
                    eyebrow="2B. Recurring cost defaults"
                    title="Fill only the costs you want to override"
                    detail="Each blank row keeps the app baseline. Set a profile default when you have a trusted rule of thumb for your target asset type."
                  >
                    <div className="profile-expense-template-grid" style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                      <ExpenseTemplateCard
                        title="Insurance default"
                        basis={insuranceDefaultBasis}
                        value={insuranceDefaultValue}
                        onBasisChange={setInsuranceDefaultBasis}
                        onValueChange={setInsuranceDefaultValue}
                      />
                      <ExpenseTemplateCard
                        title="Repairs & maintenance default"
                        basis={repairsDefaultBasis}
                        value={repairsDefaultValue}
                        onBasisChange={setRepairsDefaultBasis}
                        onValueChange={setRepairsDefaultValue}
                      />
                      <ExpenseTemplateCard
                        title="Utilities / common area default"
                        basis={utilitiesDefaultBasis}
                        value={utilitiesDefaultValue}
                        onBasisChange={setUtilitiesDefaultBasis}
                        onValueChange={setUtilitiesDefaultValue}
                      />
                      <ExpenseTemplateCard
                        title="Snow / landscaping default"
                        basis={snowDefaultBasis}
                        value={snowDefaultValue}
                        onBasisChange={setSnowDefaultBasis}
                        onValueChange={setSnowDefaultValue}
                      />
                    </div>
                  </ProfileOperatingSection>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
            <details className="profile-assumption-disclosure" style={{ ...CARD, padding: 0, overflow: "hidden" }}>
              <summary
                className="profile-assumption-summary"
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) auto",
                  gap: 12,
                  alignItems: "center",
                  padding: 20,
                  cursor: "pointer",
                  listStyle: "none",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#64748b" }}>
                    NOI fallback audit
                  </p>
                  <h2 style={{ margin: "6px 0 0", color: "#0f172a", fontSize: 18, lineHeight: 1.25 }}>
                    {assumptionOverrideCount} profile override{assumptionOverrideCount === 1 ? "" : "s"}, {assumptionBaselineCount} app baseline{assumptionBaselineCount === 1 ? "" : "s"}
                  </h2>
                  <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13, lineHeight: 1.55 }}>
                    Open this only when you want to audit which sparse-listing expenses come from your profile.
                  </p>
                </div>
                <span style={{ borderRadius: 999, border: "1px solid #bfdbfe", backgroundColor: "#eff6ff", color: "#1d4ed8", padding: "7px 10px", fontSize: 12, fontWeight: 900, whiteSpace: "nowrap" }}>
                  Show audit
                </span>
              </summary>
              <div style={{ padding: "0 20px 20px" }}>
                <Link href="#operating-assumptions" style={{ display: "inline-flex", marginBottom: 12, color: "#2563eb", fontSize: 13, fontWeight: 800, textDecoration: "none" }}>
                  Edit defaults
                </Link>
                <div style={{ display: "grid", gap: 9 }}>
                {assumptionQualityRows.map((row) => (
                  <AssumptionQualityRow key={row.label} {...row} />
                ))}
                </div>
              </div>
            </details>

            <div style={{ ...CARD, padding: 20 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#64748b" }}>
                What this changes
              </p>
              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                <SidebarFact label="Financing lane" value={financingLane} />
                <SidebarFact label="Rental-income treatment" value={rentalIncomeTreatment} />
                <SidebarFact label="Next missing input" value={missingRoutingSteps[0] ?? "None for routing"} />
              </div>
            </div>
            <div style={{ ...CARD, padding: 20 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#64748b" }}>
                Current status
              </p>
              <div style={{ marginTop: 12, fontSize: 14, color: "#475569", lineHeight: 1.8 }}>
                <div>Email: {profile?.email}</div>
                <div>
                  Questionnaire:{" "}
                  {profile?.onboardingCompletedAt
                    ? "saved"
                    : profile?.onboardingSkippedAt
                      ? "skipped"
                      : "not completed"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {error && <p style={{ margin: 0, color: "#dc2626", fontSize: 14 }}>{error}</p>}

        <ProfileActionPanel
          id="profile-actions"
          compact
          nextAction={nextProfileAction}
          missingInput={missingRoutingSteps[0] ?? null}
          routingProgressPct={routingProgressPct}
          operatingProgressPct={operatingProgressPct}
          financingLane={financingLane}
          saveToProfile={saveToProfile}
          saving={saving}
          onSaveToProfileChange={setSaveToProfile}
          onSave={handleSave}
          onSkip={handleSkip}
        />
      </div>
    </div>
  );
}

function ProfileActionPanel({
  id,
  compact = false,
  nextAction,
  missingInput,
  routingProgressPct,
  operatingProgressPct,
  financingLane,
  saveToProfile,
  saving,
  onSaveToProfileChange,
  onSave,
  onSkip,
}: {
  id?: string;
  compact?: boolean;
  nextAction: string;
  missingInput: string | null;
  routingProgressPct: number;
  operatingProgressPct: number;
  financingLane: string;
  saveToProfile: boolean;
  saving: boolean;
  onSaveToProfileChange: (value: boolean) => void;
  onSave: () => void;
  onSkip: () => void;
}) {
  return (
    <section
      id={id}
      className={`profile-action-panel${compact ? " profile-action-panel-compact" : ""}`}
      style={{
        ...CARD,
        padding: compact ? 16 : 20,
        display: "grid",
        gridTemplateColumns: compact ? "minmax(0, 1fr) auto" : "minmax(0, 1.2fr) minmax(300px, 0.8fr)",
        gap: compact ? 14 : 18,
        alignItems: "center",
        borderColor: missingInput ? "#fed7aa" : "#bbf7d0",
        backgroundColor: missingInput ? "#fff7ed" : "#f0fdf4",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, color: missingInput ? "#c2410c" : "#166534", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase" }}>
          {missingInput ? "Finish this before screening" : "Ready to screen inventory"}
        </p>
        <h2 style={{ margin: "6px 0 0", color: "#0f172a", fontSize: compact ? 18 : 22, lineHeight: 1.2 }}>
          {nextAction}
        </h2>
        <p style={{ margin: "7px 0 0", color: "#475569", fontSize: 13, lineHeight: 1.55 }}>
          Financing lane: <strong style={{ color: "#0f172a" }}>{financingLane}</strong>. Save mode:{" "}
          <strong style={{ color: "#0f172a" }}>{saveToProfile ? "future listings use these answers" : "this session only"}</strong>.
        </p>
        {!compact && (
          <div className="profile-action-metric-row" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            <ProfileActionMetric label="Route" value={`${routingProgressPct}%`} />
            <ProfileActionMetric label="Expense defaults" value={`${operatingProgressPct}%`} />
            <ProfileActionMetric label="Next missing input" value={missingInput ?? "None"} />
          </div>
        )}
      </div>

      <div className="profile-action-controls" style={{ display: "grid", gap: 10, justifyItems: "stretch" }}>
        <label
          className="profile-action-save-mode"
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            backgroundColor: "#fff",
            padding: 12,
            minWidth: 0,
          }}
        >
          <input
            type="checkbox"
            checked={saveToProfile}
            onChange={(event) => onSaveToProfileChange(event.target.checked)}
            style={{ marginTop: 3 }}
          />
          <span style={{ display: "grid", gap: 3, minWidth: 0 }}>
            <span style={{ color: "#0f172a", fontSize: 13, fontWeight: 850 }}>Save to investor profile</span>
            <span style={{ color: "#64748b", fontSize: 12, lineHeight: 1.4 }}>
              {saveToProfile ? "Use these assumptions across dashboard and listings." : "Continue once without changing saved defaults."}
            </span>
          </span>
        </label>

        <div className="profile-action-buttons" style={{ display: "flex", gap: 10, justifyContent: compact ? "flex-end" : "stretch", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={onSkip}
            disabled={saving}
            style={{
              flex: "1 1 120px",
              minWidth: 120,
              padding: "12px 15px",
              borderRadius: 10,
              border: "1px solid #cbd5e1",
              backgroundColor: "#fff",
              color: "#475569",
              fontWeight: 750,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            Skip for now
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            style={{
              flex: "1 1 180px",
              minWidth: 180,
              padding: "12px 16px",
              borderRadius: 10,
              border: "none",
              backgroundColor: "#0f172a",
              color: "#fff",
              fontWeight: 850,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Saving…" : saveToProfile ? "Save and continue" : "Continue without saving"}
          </button>
        </div>
      </div>
    </section>
  );
}

function ProfileActionMetric({ label, value }: { label: string; value: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 999, border: "1px solid #e2e8f0", backgroundColor: "#fff", color: "#334155", padding: "6px 9px", fontSize: 12, fontWeight: 850 }}>
      <span style={{ color: "#64748b", fontWeight: 750 }}>{label}</span>
      {value}
    </span>
  );
}

function ProfileCommandPanel({
  nextAction,
  missingInput,
  routingProgressPct,
  operatingProgressPct,
  financingLane,
  rentalIncomeTreatment,
  saveToProfile,
  dashboardPreviewHref,
  signals,
}: {
  nextAction: string;
  missingInput: string | null;
  routingProgressPct: number;
  operatingProgressPct: number;
  financingLane: string;
  rentalIncomeTreatment: string;
  saveToProfile: boolean;
  dashboardPreviewHref: string;
  signals: ProfileCommandSignal[];
}) {
  const ready = !missingInput;

  return (
    <section className="profile-command-panel" style={stylesProfileCommandPanel} aria-label="Profile screening command">
      <div className="profile-command-verdict" style={ready ? stylesProfileCommandVerdictReady : stylesProfileCommandVerdict}>
        <div style={{ minWidth: 0 }}>
          <p style={ready ? stylesProfileCommandEyebrowReady : stylesProfileCommandEyebrow}>
            PROFILE COMMAND
          </p>
          <h2 style={stylesProfileCommandTitle}>
            {ready ? "This profile can drive screening" : "Finish the borrower route first"}
          </h2>
          <p style={stylesProfileCommandCopy}>{nextAction}</p>
          <div className="profile-command-progress-row" style={stylesProfileCommandProgressRow}>
            <ProfileCommandProgress label="Route" value={`${routingProgressPct}%`} tone={ready ? "green" : "amber"} />
            <ProfileCommandProgress label="Defaults" value={`${operatingProgressPct}%`} tone={operatingProgressPct > 0 ? "violet" : "slate"} />
            <ProfileCommandProgress label="Save" value={saveToProfile ? "On" : "Off"} tone={saveToProfile ? "green" : "slate"} />
          </div>
        </div>
        <div className="profile-command-actions" style={stylesProfileCommandActions}>
          <a href={missingInput ? "#financing-route" : dashboardPreviewHref} style={ready ? PROFILE_PRIMARY_ACTION : stylesProfileCommandAmberAction}>
            {missingInput ? "Finish route" : "Open ROI queue"}
            <ArrowRight size={14} />
          </a>
          <Link href="/underwriting" style={PROFILE_SECONDARY_ACTION}>
            Underwriting
          </Link>
          <a href="#operating-assumptions" style={PROFILE_SECONDARY_ACTION}>
            Defaults
          </a>
        </div>
      </div>

      <div className="profile-command-proof" style={stylesProfileCommandProof}>
        <div style={stylesProfileCommandProofHeader}>
          <div style={{ minWidth: 0 }}>
            <span style={stylesProfileCommandProofEyebrow}>Screening proof</span>
            <strong style={stylesProfileCommandProofTitle}>What these answers change</strong>
          </div>
          <span style={ready ? stylesProfileCommandPillReady : stylesProfileCommandPill}>
            {ready ? "Route ready" : `${routingProgressPct}% route`}
          </span>
        </div>
        <div className="profile-command-signal-grid" style={stylesProfileCommandSignalGrid}>
          {signals.map((signal) => (
            <ProfileCommandSignalCard key={signal.label} signal={signal} />
          ))}
        </div>
        <div className="profile-command-proof-note" style={stylesProfileCommandProofNote}>
          <strong>{financingLane}</strong>
          <span>{rentalIncomeTreatment}</span>
        </div>
      </div>
    </section>
  );
}

function ProfileCommandProgress({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "amber" | "violet" | "slate";
}) {
  const palette = profileCommandPalette(tone);

  return (
    <span style={{ ...stylesProfileCommandProgress, borderColor: palette.border, backgroundColor: palette.bg, color: palette.color }}>
      <span style={{ color: "#64748b", fontWeight: 800 }}>{label}</span>
      {value}
    </span>
  );
}

function ProfileCommandSignalCard({ signal }: { signal: ProfileCommandSignal }) {
  const palette = profileCommandPalette(signal.tone);

  return (
    <article
      className="profile-command-signal-card"
      style={{
        ...stylesProfileCommandSignalCard,
        borderColor: palette.border,
        backgroundColor: palette.bg,
      }}
    >
      <span style={{ ...stylesProfileCommandSignalIcon, color: palette.color, borderColor: palette.border }}>
        {signal.icon}
      </span>
      <span style={{ ...stylesProfileCommandSignalLabel, color: palette.color }}>{signal.label}</span>
      <strong style={stylesProfileCommandSignalValue}>{signal.value}</strong>
      <span className="profile-command-signal-detail" style={stylesProfileCommandSignalDetail}>{signal.detail}</span>
    </article>
  );
}

function profileCommandPalette(tone: ProfileCommandSignal["tone"]) {
  return {
    blue: { bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" },
    green: { bg: "#ecfdf3", border: "#bbf7d0", color: "#166534" },
    violet: { bg: "#f5f3ff", border: "#ddd6fe", color: "#6d28d9" },
    slate: { bg: "#f8fafc", border: "#e2e8f0", color: "#334155" },
    amber: { bg: "#fffbeb", border: "#fde68a", color: "#b45309" },
  }[tone];
}

function ProfileScreeningPreview({
  items,
  routeComplete,
  routingProgressPct,
  operatingProgressPct,
}: {
  items: ProfilePreviewItem[];
  routeComplete: boolean;
  routingProgressPct: number;
  operatingProgressPct: number;
}) {
  return (
    <section
      className="profile-screening-preview"
      data-testid="profile-screening-preview"
      style={{
        ...CARD,
        padding: 20,
        background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
      }}
    >
      <div className="profile-screening-preview-header" style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, color: "#2563eb", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Screening preview
          </p>
          <h2 style={{ margin: "6px 0 0", color: "#0f172a", fontSize: 22, lineHeight: 1.22 }}>
            What the platform will do with this profile
          </h2>
          <p style={{ margin: "7px 0 0", color: "#64748b", fontSize: 13, lineHeight: 1.6, maxWidth: 820 }}>
            This is the handoff from profile setup into dashboard screening, underwriting, and listing-level NOI fallbacks.
          </p>
        </div>
        <span
          style={{
            borderRadius: 999,
            border: routeComplete ? "1px solid #bbf7d0" : "1px solid #fde68a",
            backgroundColor: routeComplete ? "#ecfdf3" : "#fffbeb",
            color: routeComplete ? "#166534" : "#b45309",
            padding: "7px 10px",
            fontSize: 12,
            fontWeight: 900,
            whiteSpace: "nowrap",
          }}
        >
          {routeComplete ? "Route ready" : `${routingProgressPct}% route`}
        </span>
      </div>

      <div className="profile-screening-preview-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, marginTop: 15 }}>
        {items.map((item) => (
          <ProfilePreviewCard key={item.label} item={item} />
        ))}
      </div>

      <div className="profile-screening-preview-actions" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 15 }}>
        <Link href="/underwriting" style={PROFILE_SECONDARY_ACTION}>
          Open underwriting
        </Link>
        <Link href="/?sort=roi_desc" style={PROFILE_SECONDARY_ACTION}>
          View ROI queue
        </Link>
        <span style={{ borderRadius: 999, border: "1px solid #e2e8f0", backgroundColor: "#fff", color: "#475569", padding: "10px 12px", fontSize: 12, fontWeight: 850 }}>
          Expense defaults {operatingProgressPct}% complete
        </span>
      </div>
    </section>
  );
}

function ProfilePreviewCard({ item }: { item: ProfilePreviewItem }) {
  const palette = {
    green: { bg: "#ecfdf3", border: "#bbf7d0", color: "#166534" },
    amber: { bg: "#fffbeb", border: "#fde68a", color: "#b45309" },
    blue: { bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" },
    violet: { bg: "#f5f3ff", border: "#ddd6fe", color: "#6d28d9" },
    slate: { bg: "#f8fafc", border: "#e2e8f0", color: "#334155" },
  }[item.tone];

  return (
    <Link
      href={item.href}
      className="profile-screening-preview-card"
      style={{
        display: "grid",
        gap: 9,
        borderRadius: 12,
        border: `1px solid ${palette.border}`,
        backgroundColor: palette.bg,
        color: "#0f172a",
        padding: 14,
        textDecoration: "none",
        minWidth: 0,
      }}
    >
      <span style={{ color: palette.color, fontSize: 11, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        {item.label}
      </span>
      <strong style={{ color: "#0f172a", fontSize: 18, lineHeight: 1.15 }}>
        {item.value}
      </strong>
      <span style={{ color: "#475569", fontSize: 12, lineHeight: 1.5 }}>
        {item.detail}
      </span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: palette.color, fontSize: 12, fontWeight: 900 }}>
        {item.action}
        <ArrowRight size={13} />
      </span>
    </Link>
  );
}

function RoadmapCard({
  step,
  title,
  status,
  detail,
  href,
  action,
  tone,
}: {
  step: string;
  title: string;
  status: string;
  detail: string;
  href: string;
  action: string;
  tone: "blue" | "green" | "violet";
}) {
  const palette = {
    blue: { bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" },
    green: { bg: "#ecfdf3", border: "#bbf7d0", color: "#166534" },
    violet: { bg: "#f5f3ff", border: "#ddd6fe", color: "#6d28d9" },
  }[tone];
  const accessibleLabel = `Step ${step}: ${title}. Status: ${status}. ${detail} ${action}.`;

  return (
    <Link
      className="profile-roadmap-card"
      href={href}
      aria-label={accessibleLabel}
      style={{
        display: "grid",
        gap: 10,
        borderRadius: 12,
        border: "1px solid #e2e8f0",
        backgroundColor: "#fff",
        padding: 15,
        color: "inherit",
        textDecoration: "none",
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <span style={{ minWidth: 58, height: 30, borderRadius: 999, display: "grid", placeItems: "center", border: `1px solid ${palette.border}`, backgroundColor: palette.bg, color: palette.color, fontSize: 12, fontWeight: 900 }}>
          Step {step}
        </span>
        {" "}
        <span style={{ borderRadius: 999, border: `1px solid ${palette.border}`, backgroundColor: palette.bg, color: palette.color, padding: "5px 8px", fontSize: 11, fontWeight: 850 }}>
          {status}
        </span>
      </div>
      <div>
        <p style={{ margin: 0, color: "#0f172a", fontSize: 15, fontWeight: 800 }}>{title}</p>
        <p style={{ margin: "5px 0 0", color: "#64748b", fontSize: 13, lineHeight: 1.5 }}>{detail}</p>
      </div>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: palette.color, fontSize: 13, fontWeight: 850 }}>
        {action}
        <ArrowRight size={13} />
      </span>
    </Link>
  );
}

function SectionIntro({
  id,
  step,
  title,
  subtitle,
  progressLabel,
  progressPct,
}: {
  id?: string;
  step: string;
  title: string;
  subtitle: string;
  progressLabel: string;
  progressPct: number;
}) {
  return (
    <div id={id} style={{ scrollMarginTop: 96, borderRadius: 8, border: "1px solid #dbeafe", backgroundColor: "#eff6ff", padding: 15 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, color: "#1d4ed8", fontSize: 11, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Step {step}
          </p>
          <h2 style={{ margin: "5px 0 0", color: "#0f172a", fontSize: 19, lineHeight: 1.25 }}>
            {title}
          </h2>
          <p style={{ margin: "5px 0 0", color: "#475569", fontSize: 13, lineHeight: 1.55 }}>
            {subtitle}
          </p>
        </div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#1d4ed8", fontSize: 12, fontWeight: 900, borderRadius: 999, border: "1px solid #bfdbfe", backgroundColor: "#fff", padding: "6px 9px" }}>
          <CheckCircle2 size={14} />
          {progressLabel}
        </span>
      </div>
      <div style={{ height: 8, borderRadius: 999, backgroundColor: "#dbeafe", overflow: "hidden", marginTop: 12 }}>
        <div style={{ width: `${Math.min(100, Math.max(0, progressPct))}%`, height: "100%", borderRadius: 999, backgroundColor: "#2563eb" }} />
      </div>
    </div>
  );
}

function ProfileOperatingSection({
  eyebrow,
  title,
  detail,
  children,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="profile-operating-section"
      style={{
        borderRadius: 14,
        border: "1px solid #dbeafe",
        background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
        padding: 15,
        display: "grid",
        gap: 13,
      }}
    >
      <div>
        <p style={{ margin: 0, color: "#2563eb", fontSize: 10, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase" }}>
          {eyebrow}
        </p>
        <h3 style={{ margin: "5px 0 0", color: "#0f172a", fontSize: 17, lineHeight: 1.25 }}>
          {title}
        </h3>
        <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13, lineHeight: 1.6 }}>
          {detail}
        </p>
      </div>
      {children}
    </section>
  );
}

function SidebarFact({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ borderRadius: 8, backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", padding: "10px 11px" }}>
      <div style={{ color: "#64748b", fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ marginTop: 5, color: "#0f172a", fontSize: 13, fontWeight: 750, lineHeight: 1.45 }}>
        {value}
      </div>
    </div>
  );
}

function AssumptionQualityRow({
  label,
  status,
  value,
  detail,
}: {
  label: string;
  status: string;
  value: string;
  detail: string;
}) {
  const hasOverride = status === "Profile override";
  return (
    <div style={{ borderRadius: 10, border: "1px solid #e2e8f0", backgroundColor: hasOverride ? "#ecfdf3" : "#f8fafc", padding: 11 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: "#0f172a", fontSize: 13, fontWeight: 850 }}>{label}</div>
          <div style={{ marginTop: 3, color: "#64748b", fontSize: 12, lineHeight: 1.4 }}>{value}</div>
        </div>
        <span
          style={{
            borderRadius: 999,
            border: hasOverride ? "1px solid #bbf7d0" : "1px solid #e2e8f0",
            backgroundColor: "#fff",
            color: hasOverride ? "#166534" : "#475569",
            padding: "4px 7px",
            fontSize: 10,
            fontWeight: 900,
            whiteSpace: "nowrap",
          }}
        >
          {status}
        </span>
      </div>
      <div style={{ marginTop: 6, color: "#64748b", fontSize: 11, lineHeight: 1.45 }}>{detail}</div>
    </div>
  );
}

function ProfileGateState({
  mode,
  message,
  onRetry,
}: {
  mode: "loading" | "auth" | "error";
  message?: string;
  onRetry?: () => void;
}) {
  const copy = {
    loading: {
      eyebrow: "Investor profile",
      title: "Loading your underwriting profile",
      detail:
        "Checking saved borrower route, occupancy treatment, and operating defaults before opening the profile workspace.",
      badge: "Checking session",
    },
    auth: {
      eyebrow: "Sign in required",
      title: "Your profile controls the screening model",
      detail:
        "Sign in to edit borrower route, rental-income treatment, and operating-cost defaults used by dashboard filters and listing underwriting.",
      badge: "Profile locked",
    },
    error: {
      eyebrow: "Profile unavailable",
      title: "Could not load your investor profile",
      detail: message ?? "The profile request failed. Retry the request or return to the dashboard while the saved profile is unavailable.",
      badge: "Needs attention",
    },
  }[mode];

  return (
    <div
      className="dashboard-page profile-page"
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)",
        padding: 24,
        boxSizing: "border-box",
        display: "grid",
        placeItems: "center",
      }}
    >
      <section
        className="profile-gate-card"
        data-testid={`profile-gate-${mode}`}
        style={{
          width: "100%",
          maxWidth: 860,
          borderRadius: 18,
          border: "1px solid #bfdbfe",
          backgroundColor: "#fff",
          boxShadow: "0 22px 55px rgba(15,23,42,0.12)",
          overflow: "hidden",
        }}
      >
        <div
          className="profile-gate-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.15fr) minmax(240px, 0.85fr)",
            minHeight: 320,
          }}
        >
          <div style={{ padding: 28, minWidth: 0 }}>
            <p style={{ margin: 0, color: "#2563eb", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase" }}>
              {copy.eyebrow}
            </p>
            <h1 style={{ margin: "8px 0 0", color: "#0f172a", fontSize: 32, lineHeight: 1.1 }}>
              {copy.title}
            </h1>
            <p style={{ margin: "10px 0 0", color: "#475569", fontSize: 15, lineHeight: 1.7 }}>
              {copy.detail}
            </p>

            <div className="profile-gate-actions" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 20 }}>
              {mode === "auth" && (
                <Link href="/signin?callbackUrl=/profile" style={PROFILE_PRIMARY_ACTION}>
                  Sign in to continue
                  <ArrowRight size={14} />
                </Link>
              )}
              {mode === "error" && onRetry && (
                <button type="button" onClick={onRetry} style={{ ...PROFILE_PRIMARY_ACTION, cursor: "pointer" }}>
                  Retry profile
                  <ArrowRight size={14} />
                </button>
              )}
              {mode === "loading" && (
                <span style={PROFILE_PRIMARY_ACTION}>
                  Loading profile
                </span>
              )}
              <Link href="/" style={PROFILE_SECONDARY_ACTION}>
                Back to dashboard
              </Link>
            </div>
          </div>

          <aside
            style={{
              background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
              color: "#fff",
              padding: 24,
              display: "grid",
              alignContent: "center",
              gap: 12,
            }}
          >
            <span style={{ justifySelf: "start", borderRadius: 999, border: "1px solid rgba(255,255,255,0.18)", backgroundColor: "rgba(255,255,255,0.1)", color: "#dbeafe", padding: "7px 10px", fontSize: 12, fontWeight: 900 }}>
              {copy.badge}
            </span>
            <ProfileGateFact label="Borrower lane" value="Owner-occupied / investor / 5+ units" />
            <ProfileGateFact label="Rental income" value="Controls capacity and eligibility assumptions" />
            <ProfileGateFact label="NOI defaults" value="Fills missing expense data on sparse listings" />
          </aside>
        </div>
      </section>
    </div>
  );
}

function ProfileGateFact({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.14)", backgroundColor: "rgba(255,255,255,0.08)", padding: 12 }}>
      <p style={{ margin: 0, color: "#bfdbfe", fontSize: 10, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        {label}
      </p>
      <p style={{ margin: "6px 0 0", color: "#fff", fontSize: 13, lineHeight: 1.45, fontWeight: 800 }}>
        {value}
      </p>
    </div>
  );
}

function QuestionCard({
  title,
  subtitle,
  testId,
  value,
  onChange,
}: {
  title: string;
  subtitle: string;
  testId?: string;
  value: boolean | null;
  onChange: (value: boolean) => void;
}) {
  return (
    <div data-testid={testId} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a" }}>{title}</div>
        <div style={{ marginTop: 4, fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>{subtitle}</div>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <ChoiceButton active={value === true} onClick={() => onChange(true)}>
          Yes
        </ChoiceButton>
        <ChoiceButton active={value === false} onClick={() => onChange(false)}>
          No
        </ChoiceButton>
      </div>
    </div>
  );
}

function describeExpenseDefault(basis: ExpenseBasisValue, value: string): string {
  if (!basis || !value.trim()) return "Not set";
  const basisLabel = {
    percent_of_egi: "% of EGI",
    annual_total: "annual total",
    annual_per_unit: "annual per unit",
    annual_per_sqft: "annual per sq ft",
    "": "",
  }[basis];
  return `${value}${basis === "percent_of_egi" ? "%" : ""} ${basisLabel}`.trim();
}

function boundedCount(value: number, total: number): number {
  return Math.min(total, Math.max(0, value));
}

function progressPercent(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((boundedCount(value, total) / total) * 100);
}

function formatProgressLabel(value: number, total: number, suffix: string): string {
  return `${boundedCount(value, total)} of ${total} ${suffix}`;
}

function hasExpenseDefault(basis: ExpenseBasisValue, value: string): boolean {
  return Boolean(basis && value.trim());
}

function SelectCard({
  title,
  subtitle,
  value,
  onChange,
  options,
}: {
  title: string;
  subtitle: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a" }}>{title}</div>
        <div style={{ marginTop: 4, fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>{subtitle}</div>
      </div>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{
          width: "100%",
          padding: "12px 14px",
          borderRadius: 8,
          border: "1px solid #cbd5e1",
          backgroundColor: "#fff",
          fontSize: 14,
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function InputCard({
  title,
  subtitle,
  value,
  onChange,
  placeholder,
  suffix,
}: {
  title: string;
  subtitle: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  suffix?: string;
}) {
  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a" }}>{title}</div>
        <div style={{ marginTop: 4, fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>{subtitle}</div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          padding: "10px 12px",
          borderRadius: 8,
          border: "1px solid #cbd5e1",
          backgroundColor: "#fff",
          fontSize: 14,
        }}
      >
        <input
          type="number"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          style={{
            width: "100%",
            border: "none",
            outline: "none",
            backgroundColor: "transparent",
            fontSize: 14,
            fontWeight: 600,
            color: "#0f172a",
          }}
        />
        {suffix && <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>{suffix}</span>}
      </div>
    </div>
  );
}

function ExpenseTemplateCard({
  title,
  basis,
  value,
  onBasisChange,
  onValueChange,
}: {
  title: string;
  basis: ExpenseBasisValue;
  value: string;
  onBasisChange: (value: ExpenseBasisValue) => void;
  onValueChange: (value: string) => void;
}) {
  const hasOverride = hasExpenseDefault(basis, value);
  const description = hasOverride
    ? describeExpenseDefault(basis, value)
    : "Uses the app baseline until you choose a basis and value.";

  return (
    <div
      className="profile-expense-template-card"
      style={{
        border: hasOverride ? "1px solid #bbf7d0" : "1px solid #e2e8f0",
        borderRadius: 12,
        backgroundColor: hasOverride ? "#ecfdf3" : "#fff",
        padding: 14,
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 750, color: "#0f172a" }}>{title}</div>
          <div style={{ marginTop: 4, fontSize: 12, color: "#64748b", lineHeight: 1.45 }}>{description}</div>
        </div>
        <span
          style={{
            borderRadius: 999,
            border: hasOverride ? "1px solid #bbf7d0" : "1px solid #e2e8f0",
            backgroundColor: "#fff",
            color: hasOverride ? "#166534" : "#475569",
            padding: "5px 8px",
            fontSize: 10,
            fontWeight: 900,
            whiteSpace: "nowrap",
          }}
        >
          {hasOverride ? "Profile override" : "App baseline"}
        </span>
      </div>
      <div style={{ marginTop: 12, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748b" }}>
            Basis
          </span>
          <select
            value={basis}
            onChange={(event) => onBasisChange(event.target.value as ExpenseBasisValue)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              backgroundColor: "#fff",
              fontSize: 14,
            }}
          >
            <option value="">Use app baseline</option>
            <option value="percent_of_egi">% of EGI</option>
            <option value="annual_total">Annual total</option>
            <option value="annual_per_unit">Annual per unit</option>
            <option value="annual_per_sqft">Annual per sq ft</option>
          </select>
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748b" }}>
            Value
          </span>
          <input
            type="number"
            value={value}
            placeholder={basis === "percent_of_egi" ? "4.0" : basis === "" ? "" : "0"}
            onChange={(event) => onValueChange(event.target.value)}
            disabled={basis === ""}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              backgroundColor: basis === "" ? "#f1f5f9" : "#fff",
              fontSize: 14,
            }}
          />
        </label>
      </div>
    </div>
  );
}

function ChoiceButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      style={{
        padding: "10px 14px",
        borderRadius: 999,
        border: active ? "1px solid #0f172a" : "1px solid #cbd5e1",
        backgroundColor: active ? "#0f172a" : "#fff",
        color: active ? "#fff" : "#475569",
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
