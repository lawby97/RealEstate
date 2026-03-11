"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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
  borderRadius: 16,
  boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
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
    fetch("/api/profile")
      .then(async (res) => {
        if (res.status === 401) {
          window.location.href = "/signin?callbackUrl=/profile";
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
    return <div style={{ padding: 32, color: "#64748b" }}>Loading profile…</div>;
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f8fafc", padding: 24 }}>
      <div style={{ maxWidth: 1120, margin: "0 auto", display: "grid", gap: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
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
          </div>
          <Link
            href="/"
            style={{
              whiteSpace: "nowrap",
              padding: "10px 14px",
              borderRadius: 10,
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
        </div>

        <div style={{ display: "grid", gap: 20, gridTemplateColumns: "minmax(0,1.2fr) minmax(280px,0.8fr)" }}>
          <div style={{ ...CARD, padding: 24 }}>
            <div style={{ display: "grid", gap: 18 }}>
              <QuestionCard
                title="Is this your first property purchase?"
                subtitle="Used to assess first-time buyer and owner-occupied CMHC paths."
                value={firstPropertyBuyer}
                onChange={setFirstPropertyBuyer}
              />
              <QuestionCard
                title="Will you live in the property?"
                subtitle="This changes owner-occupied versus investor financing treatment."
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
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: 16,
                  backgroundColor: "#f8fafc",
                }}
              >
                <label style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={saveToProfile}
                    onChange={(event) => setSaveToProfile(event.target.checked)}
                    style={{ marginTop: 3 }}
                  />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>
                      Save these answers to your profile
                    </div>
                    <div style={{ marginTop: 4, fontSize: 13, lineHeight: 1.6, color: "#64748b" }}>
                      If you leave this off, you can continue now and fill this in later from your profile page.
                    </div>
                  </div>
                </label>
              </div>

              <div
                style={{
                  borderTop: "1px solid #e2e8f0",
                  paddingTop: 20,
                  display: "grid",
                  gap: 16,
                }}
              >
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a" }}>
                    Operating assumptions
                  </div>
                  <div style={{ marginTop: 4, fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>
                    These optional defaults flow into listing underwriting when the source does not provide exact operating costs.
                  </div>
                </div>

                <InputCard
                  title="Average management fee"
                  subtitle="Saved as a global default percentage of EGI."
                  suffix="%"
                  value={averageManagementFeePct}
                  onChange={setAverageManagementFeePct}
                  placeholder="4.0"
                />

                <div style={{ display: "grid", gap: 14 }}>
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
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
            <div style={{ ...CARD, padding: 20 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#64748b" }}>
                Why this matters
              </p>
              <ul style={{ margin: "12px 0 0", paddingLeft: 18, color: "#475569", lineHeight: 1.8, fontSize: 14 }}>
                <li>Owner-occupied and investor financing are not the same path.</li>
                <li>First-time buyer status can unlock Home Start-style screening.</li>
                <li>5+ unit and construction paths use different CMHC rules and leverage caps.</li>
                <li>Renovation intent affects whether bridge and improvement logic should show.</li>
              </ul>
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

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={handleSkip}
            disabled={saving}
            style={{
              padding: "12px 16px",
              borderRadius: 10,
              border: "1px solid #cbd5e1",
              backgroundColor: "#fff",
              color: "#475569",
              fontWeight: 600,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            Skip for now
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "12px 18px",
              borderRadius: 10,
              border: "none",
              backgroundColor: "#0f172a",
              color: "#fff",
              fontWeight: 700,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Saving…" : saveToProfile ? "Save and continue" : "Continue without saving"}
          </button>
        </div>
      </div>
    </div>
  );
}

function QuestionCard({
  title,
  subtitle,
  value,
  onChange,
}: {
  title: string;
  subtitle: string;
  value: boolean | null;
  onChange: (value: boolean) => void;
}) {
  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a" }}>{title}</div>
        <div style={{ marginTop: 4, fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>{subtitle}</div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
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
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 16 }}>
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
          borderRadius: 10,
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
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 16 }}>
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
          borderRadius: 10,
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
  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a" }}>{title}</div>
      <div style={{ marginTop: 12, display: "grid", gap: 12, gridTemplateColumns: "minmax(0,1fr) minmax(0,0.8fr)" }}>
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
              borderRadius: 10,
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
              borderRadius: 10,
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
