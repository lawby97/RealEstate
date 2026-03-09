"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

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
      if (res?.url) window.location.href = res.url;
    } catch {
      setError("Something went wrong.");
    }
    setLoading(false);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f1f5f9",
        padding: 24,
      }}
    >
      <div
        style={{
          backgroundColor: "#fff",
          padding: "32px 40px",
          borderRadius: 16,
          boxShadow: "0 4px 6px -1px rgba(0,0,0,0.08), 0 2px 4px -2px rgba(0,0,0,0.06)",
          border: "1px solid #e2e8f0",
          width: "100%",
          maxWidth: 420,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, color: "#0f172a" }}>
              Sign in
            </h1>
            <p style={{ fontSize: 14, color: "#64748b", margin: "8px 0 0 0" }}>
              Sign in to save lists and track deals.
            </p>
          </div>
          <Link
            href="/signup"
            style={{
              padding: "10px 18px",
              border: "2px solid #16a34a",
              borderRadius: 10,
              color: "#16a34a",
              backgroundColor: "#fff",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Sign up
          </Link>
        </div>

        <div style={{ marginTop: 28 }}>
          <p style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }}>Continue with</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button
              type="button"
              disabled
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                padding: "12px 16px",
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                backgroundColor: "#fff",
                fontSize: 14,
                fontWeight: 500,
                color: "#64748b",
                cursor: "not-allowed",
              }}
            >
              <span style={{ fontSize: 18 }}>G</span>
              Continue with Google
              <span style={{ fontSize: 12, color: "#94a3b8" }}> (not configured)</span>
            </button>
            <button
              type="button"
              disabled
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                padding: "12px 16px",
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                backgroundColor: "#fff",
                fontSize: 14,
                fontWeight: 500,
                color: "#64748b",
                cursor: "not-allowed",
              }}
            >
              Continue with Apple
              <span style={{ fontSize: 12, color: "#94a3b8" }}> (not configured)</span>
            </button>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "24px 0" }}>
          <div style={{ flex: 1, height: 1, backgroundColor: "#e2e8f0" }} />
          <span style={{ fontSize: 13, color: "#94a3b8" }}>Or with email</span>
          <div style={{ flex: 1, height: 1, backgroundColor: "#e2e8f0" }} />
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <label htmlFor="email" style={{ display: "block", fontSize: 14, fontWeight: 500, color: "#374151", marginBottom: 6 }}>
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                fontSize: 15,
                boxSizing: "border-box",
              }}
            />
          </div>
          <div>
            <label htmlFor="password" style={{ display: "block", fontSize: 14, fontWeight: 500, color: "#374151", marginBottom: 6 }}>
              Password
            </label>
            <input
              id="password"
              type="password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                fontSize: 15,
                boxSizing: "border-box",
              }}
            />
          </div>
          {error && (
            <p style={{ margin: 0, fontSize: 13, color: "#dc2626" }}>{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "14px 16px",
              backgroundColor: "#16a34a",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontSize: 16,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: "#64748b" }}>
          Don&apos;t have an account?{" "}
          <Link href="/signup" style={{ color: "#16a34a", fontWeight: 600, textDecoration: "none" }}>
            Sign up
          </Link>
        </p>

        <p style={{ textAlign: "center", marginTop: 24, marginBottom: 0 }}>
          <Link href="/" style={{ fontSize: 14, color: "#64748b", textDecoration: "none" }}>
            ← Back to listings
          </Link>
        </p>
      </div>
    </div>
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
