"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AuthFormError, AuthFormSummary, AuthShell, AuthSubmitButton, AuthTextField } from "@/components/auth/AuthShell";

const PASSWORD_HINT = "At least 8 characters, including one letter and one number";

function SignUpForm() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/profile?onboarding=1";
  const signinHref = `/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError(PASSWORD_HINT);
      return;
    }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError(PASSWORD_HINT);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          firstName: firstName.trim() || null,
          lastName: lastName.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Registration failed.");
        setLoading(false);
        return;
      }
      window.location.href = signinHref;
    } catch {
      setError("Something went wrong.");
      setLoading(false);
    }
  };

  return (
    <AuthShell
      accentColor="#0d9488"
      background="linear-gradient(135deg, #f8fafc 0%, #ecfdf3 100%)"
      eyebrow="INVESTOR LISTINGS"
      title="Create account"
      subtitle="Create a workspace for saved assumptions, listing review, and underwriting queues."
      ctaHref={signinHref}
      ctaLabel="Sign in"
      ctaColor="#475569"
      calloutTitle="Start with email, then set your underwriting profile."
      calloutBody="After account creation, the profile page captures occupancy, asset target, renovation intent, and operating-cost defaults."
      workflowTitle="Build the investor profile before chasing deals"
      workflowBody="A saved profile keeps the dashboard, sold page, calculator, and listing detail pages anchored to the same underwriting assumptions."
      highlights={[
        {
          label: "One borrower profile",
          detail: "Occupancy, asset size, and renovation intent route the financing lane.",
        },
        {
          label: "Cleaner deal queues",
          detail: "Cash limits and operating defaults help filter out listings that do not fit.",
        },
        {
          label: "Repeatable review",
          detail: "Saved assumptions make each property card easier to compare at first glance.",
        },
      ]}
      steps={[
        {
          label: "Create login",
          detail: "Save the workspace used by dashboard, calculator, and listings.",
        },
        {
          label: "Complete profile",
          detail: "Set occupancy, cash cap, asset target, and expense defaults.",
        },
        {
          label: "Screen deals",
          detail: "Rank cards by cashflow, CoC, ROI, and lender fit.",
        },
      ]}
      footer={
        <>
          <p style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: "#64748b" }}>
            Already have an account?{" "}
            <Link href={signinHref} style={{ color: "#2563eb", fontWeight: 700, textDecoration: "none" }}>
              Sign in
            </Link>
          </p>

          <p style={{ textAlign: "center", marginTop: 24, marginBottom: 0 }}>
            <Link href="/" style={{ fontSize: 14, color: "#64748b", textDecoration: "none" }}>
              Back to listings
            </Link>
          </p>
        </>
      }
    >
      <AuthFormSummary
        accentColor="#0d9488"
        title="Create the account, then set the borrower box"
        detail="The next screen captures occupancy, cash limits, asset target, and expense defaults so the dashboard can filter like an investor."
        items={[
          { label: "Step 1", value: "Create secure login" },
          { label: "Step 2", value: "Complete profile setup" },
        ]}
      />

      <form onSubmit={handleSubmit} className="auth-form" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="auth-name-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
          <AuthTextField
            id="firstName"
            label="First name"
            type="text"
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoComplete="given-name"
          />
          <AuthTextField
            id="lastName"
            label="Last name"
            type="text"
            placeholder="Last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            autoComplete="family-name"
          />
        </div>
        <AuthTextField
          id="email"
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <AuthTextField
          id="password"
          label="Password"
          type="password"
          placeholder="Create password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
          helper={PASSWORD_HINT}
          helperId="password-hint"
        />
        <AuthTextField
          id="confirmPassword"
          label="Confirm password"
          type="password"
          placeholder="Re-enter password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          autoComplete="new-password"
        />
        {error && <AuthFormError>{error}</AuthFormError>}
        <AuthSubmitButton disabled={loading} backgroundColor="#0d9488">
          {loading ? "Creating account..." : "Create account and continue"}
        </AuthSubmitButton>
      </form>
    </AuthShell>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#f1f5f9" }}>
        <div style={{ padding: 40 }}>Loading…</div>
      </div>
    }>
      <SignUpForm />
    </Suspense>
  );
}
