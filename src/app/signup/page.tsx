"use client";

import Link from "next/link";
import { useState } from "react";

const PASSWORD_HINT = "At least 8 characters, including one letter and one number";

export default function SignUpPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
      window.location.href = "/signin";
    } catch {
      setError("Something went wrong.");
      setLoading(false);
    }
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
              Create account
            </h1>
            <p style={{ fontSize: 14, color: "#64748b", margin: "8px 0 0 0" }}>
              Register with email to get started.
            </p>
          </div>
          <Link
            href="/signin"
            style={{
              padding: "10px 18px",
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              color: "#475569",
              backgroundColor: "#fff",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Sign in
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

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <label htmlFor="firstName" style={{ display: "block", fontSize: 14, fontWeight: 500, color: "#374151", marginBottom: 6 }}>
              First name
            </label>
            <input
              id="firstName"
              type="text"
              placeholder="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
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
            <label htmlFor="lastName" style={{ display: "block", fontSize: 14, fontWeight: 500, color: "#374151", marginBottom: 6 }}>
              Last name
            </label>
            <input
              id="lastName"
              type="text"
              placeholder="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="family-name"
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
              placeholder="At least 8 characters, including one letter and one number"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                fontSize: 15,
                boxSizing: "border-box",
              }}
            />
            <p style={{ fontSize: 12, color: "#64748b", margin: "6px 0 0 0" }}>{PASSWORD_HINT}</p>
          </div>
          <div>
            <label htmlFor="confirmPassword" style={{ display: "block", fontSize: 14, fontWeight: 500, color: "#374151", marginBottom: 6 }}>
              Confirm password
            </label>
            <input
              id="confirmPassword"
              type="password"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
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
              backgroundColor: "#0d9488",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontSize: 16,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: "#64748b" }}>
          Already have an account?{" "}
          <Link href="/signin" style={{ color: "#16a34a", fontWeight: 600, textDecoration: "none" }}>
            Sign in
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
