"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AuthFormError, AuthFormSummary, AuthShell, AuthSubmitButton, AuthTextField } from "@/components/auth/AuthShell";

function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const signupHref = `/signup?callbackUrl=${encodeURIComponent(callbackUrl)}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email: email.trim(),
        password: password || undefined,
        callbackUrl,
        redirect: false,
      });
      if (res?.error) {
        setError("Invalid email or password.");
        setLoading(false);
        return;
      }
      if (res?.ok) {
        const profileRes = await fetch("/api/profile");
        if (profileRes.ok) {
          const profile = await profileRes.json();
          if (profile?.onboardingRequired) {
            window.location.href = "/profile?onboarding=1";
            return;
          }
        }
      }
      if (res?.url) window.location.href = res.url;
    } catch {
      setError("Something went wrong.");
    }
    setLoading(false);
  };

  return (
    <AuthShell
      accentColor="#2563eb"
      background="linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)"
      eyebrow="INVESTOR LISTINGS"
      title="Welcome back"
      subtitle="Sign in to keep underwriting assumptions, deal queues, and listing review synced to your investor profile."
      ctaHref={signupHref}
      ctaLabel="Sign up"
      ctaColor="#16a34a"
      calloutTitle="Your profile controls the screening model."
      calloutBody="Saved borrower and operating assumptions flow into dashboard filters, listing detail pages, and underwriting scenarios."
      workflowTitle="Screen deals with your own borrower box"
      workflowBody="The account layer is where saved assumptions turn generic listing math into a repeatable acquisition workflow."
      highlights={[
        {
          label: "Cash and borrowing limits",
          detail: "Max cash required, down payment, and borrower route stay attached to every screen.",
        },
        {
          label: "Occupancy and rental income",
          detail: "Owner-occupied and investor rental assumptions stay consistent across pages.",
        },
        {
          label: "Operating defaults",
          detail: "Insurance, repairs, utilities, and snow assumptions can fill gaps in sparse listings.",
        },
      ]}
      steps={[
        {
          label: "Load profile",
          detail: "Pull saved cash, occupancy, and operating assumptions.",
        },
        {
          label: "Resume queue",
          detail: "Return to dashboard and listings with your filters intact.",
        },
        {
          label: "Underwrite",
          detail: "Use saved borrower defaults on the deal file.",
        },
      ]}
      footer={
        <>
          <p style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: "#64748b" }}>
            Don&apos;t have an account?{" "}
            <Link href={signupHref} style={{ color: "#2563eb", fontWeight: 700, textDecoration: "none" }}>
              Sign up
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
        accentColor="#2563eb"
        title="Resume the same underwriting lens"
        detail="Signing in restores your saved borrower box and operating assumptions before you open cards or edit deal files."
        items={[
          { label: "Destination", value: callbackUrl.includes("profile") ? "Profile setup" : "Dashboard queue" },
          { label: "Restores", value: "Cash cap, occupancy, lender lane" },
        ]}
      />

      <form onSubmit={handleSubmit} className="auth-form" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
          placeholder="Your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        {error && <AuthFormError>{error}</AuthFormError>}
        <AuthSubmitButton disabled={loading} backgroundColor="#2563eb">
          {loading ? "Signing in..." : "Sign in and resume screening"}
        </AuthSubmitButton>
      </form>
    </AuthShell>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#f1f5f9" }}>
        <div style={{ padding: 40 }}>Loading…</div>
      </div>
    }>
      <SignInForm />
    </Suspense>
  );
}
