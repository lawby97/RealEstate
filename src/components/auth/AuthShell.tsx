"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import type { CSSProperties, InputHTMLAttributes, ReactNode } from "react";

type AuthHighlight = {
  label: string;
  detail: string;
};

type AuthStep = {
  label: string;
  detail: string;
};

type AuthShellProps = {
  accentColor: string;
  background: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaHref: string;
  ctaLabel: string;
  ctaColor?: string;
  calloutTitle: string;
  calloutBody: string;
  workflowTitle: string;
  workflowBody: string;
  highlights: AuthHighlight[];
  steps?: AuthStep[];
  children: ReactNode;
  footer: ReactNode;
};

type AuthFormSummaryItem = {
  label: string;
  value: string;
};

type AuthTextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "style"> & {
  label: string;
  helper?: ReactNode;
  helperId?: string;
  inputStyle?: CSSProperties;
};

type AuthSubmitButtonProps = {
  children: ReactNode;
  disabled?: boolean;
  backgroundColor: string;
};

export function AuthShell({
  accentColor,
  background,
  eyebrow,
  title,
  subtitle,
  ctaHref,
  ctaLabel,
  ctaColor,
  calloutTitle,
  calloutBody,
  workflowTitle,
  workflowBody,
  highlights,
  steps = [],
  children,
  footer,
}: AuthShellProps) {
  const buttonColor = ctaColor ?? accentColor;

  return (
    <div className="auth-page" style={{ ...styles.page, background }}>
      <div className="auth-shell" style={styles.shell}>
        <section className="auth-workflow-panel" style={styles.workflowPanel}>
          <p style={styles.workflowEyebrow}>INVESTOR WORKFLOW</p>
          <h2 style={styles.workflowTitle}>{workflowTitle}</h2>
          <p style={styles.workflowBody}>{workflowBody}</p>
          <div className="auth-highlight-list" style={styles.highlightList}>
            {highlights.map((item) => (
              <div key={item.label} className="auth-highlight-item" style={styles.highlightItem}>
                <span style={{ ...styles.highlightIcon, color: accentColor }}>
                  <CheckCircle2 size={17} />
                </span>
                <div>
                  <div style={styles.highlightLabel}>{item.label}</div>
                  <div style={styles.highlightDetail}>{item.detail}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={styles.panelFooter}>
            Profile answers feed max cash required, occupancy treatment, operating-cost defaults, and underwriting queues.
          </div>
        </section>

        <main className="auth-card" style={styles.card}>
          <div className="auth-header-row" style={styles.headerRow}>
            <div style={{ minWidth: 0 }}>
              <p style={{ ...styles.eyebrow, color: accentColor }}>{eyebrow}</p>
              <h1 style={styles.title}>{title}</h1>
              <p style={styles.subtitle}>{subtitle}</p>
            </div>
            <Link
              href={ctaHref}
              className="auth-cta-link"
              style={{
                ...styles.ctaLink,
                borderColor: buttonColor,
                color: buttonColor,
              }}
            >
              {ctaLabel}
            </Link>
          </div>

          <div style={{ ...styles.callout, borderColor: `${accentColor}33`, backgroundColor: `${accentColor}0f` }}>
            <div style={{ color: accentColor, fontSize: 13, fontWeight: 850 }}>{calloutTitle}</div>
            <div style={styles.calloutBody}>{calloutBody}</div>
          </div>

          {steps.length > 0 && (
            <section className="auth-next-steps" style={styles.nextSteps} aria-label="Account workflow steps">
              <div style={styles.nextStepsHeader}>
                <span style={{ ...styles.nextStepsEyebrow, color: accentColor }}>NEXT STEPS</span>
                <strong style={styles.nextStepsTitle}>What happens after this</strong>
              </div>
              <div className="auth-next-step-grid" style={styles.nextStepGrid}>
                {steps.map((step, index) => (
                  <div key={step.label} className="auth-next-step-card" style={styles.nextStepCard}>
                    <span
                      style={{
                        ...styles.nextStepNumber,
                        backgroundColor: `${accentColor}14`,
                        borderColor: `${accentColor}33`,
                        color: accentColor,
                      }}
                    >
                      {index + 1}
                    </span>
                    <div>
                      <div style={styles.nextStepLabel}>{step.label}</div>
                      <div style={styles.nextStepDetail}>{step.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {children}

          <div style={styles.footer}>{footer}</div>
        </main>
      </div>
    </div>
  );
}

export function AuthFormSummary({
  accentColor,
  title,
  detail,
  items,
}: {
  accentColor: string;
  title: string;
  detail: string;
  items: AuthFormSummaryItem[];
}) {
  return (
    <section
      className="auth-form-summary"
      aria-label="Authentication form summary"
      style={{ ...styles.formSummary, borderColor: `${accentColor}33`, backgroundColor: `${accentColor}0f` }}
    >
      <div>
        <p style={{ ...styles.formSummaryEyebrow, color: accentColor }}>Before you continue</p>
        <h2 style={styles.formSummaryTitle}>{title}</h2>
        <p style={styles.formSummaryDetail}>{detail}</p>
      </div>
      <div className="auth-form-summary-grid" style={styles.formSummaryGrid}>
        {items.map((item) => (
          <div key={item.label} className="auth-form-summary-card" style={styles.formSummaryCard}>
            <span style={styles.formSummaryCardLabel}>{item.label}</span>
            <strong style={styles.formSummaryCardValue}>{item.value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

export function AuthTextField({
  label,
  helper,
  helperId,
  inputStyle,
  id,
  name,
  ...inputProps
}: AuthTextFieldProps) {
  const inputId = id ?? name ?? label.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return (
    <div className="auth-field" style={styles.field}>
      <label htmlFor={inputId} style={styles.fieldLabel}>
        {label}
      </label>
      <input
        {...inputProps}
        id={inputId}
        name={name}
        aria-describedby={helperId ?? inputProps["aria-describedby"]}
        style={{ ...styles.input, ...inputStyle }}
      />
      {helper ? (
        <p id={helperId} style={styles.fieldHelper}>
          {helper}
        </p>
      ) : null}
    </div>
  );
}

export function AuthSubmitButton({
  children,
  disabled,
  backgroundColor,
}: AuthSubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="auth-submit-button"
      style={{
        ...styles.submitButton,
        backgroundColor: disabled ? "#94a3b8" : backgroundColor,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

export function AuthFormError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" aria-live="polite" className="auth-form-error" style={styles.formError}>
      {children}
    </p>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "clamp(14px, 5vw, 24px)",
    boxSizing: "border-box",
  },
  shell: {
    width: "100%",
    maxWidth: 1060,
    display: "flex",
    alignItems: "stretch",
    justifyContent: "center",
    gap: 20,
    flexWrap: "wrap",
  },
  workflowPanel: {
    flex: "1 1 320px",
    minWidth: 0,
    borderRadius: 18,
    background: "linear-gradient(135deg, #0f172a 0%, #172554 58%, #1e40af 100%)",
    color: "#fff",
    border: "1px solid rgba(147,197,253,0.35)",
    padding: "clamp(22px, 6vw, 28px)",
    boxShadow: "0 22px 46px rgba(15, 23, 42, 0.18)",
  },
  workflowEyebrow: {
    margin: 0,
    color: "#bfdbfe",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.12em",
  },
  workflowTitle: {
    margin: "9px 0 0",
    fontSize: 28,
    lineHeight: 1.1,
    color: "#fff",
  },
  workflowBody: {
    margin: "10px 0 0",
    color: "#dbeafe",
    fontSize: 14,
    lineHeight: 1.65,
  },
  highlightList: {
    display: "grid",
    gap: 12,
    marginTop: 22,
  },
  highlightItem: {
    display: "flex",
    gap: 11,
    alignItems: "flex-start",
    minWidth: 0,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.08)",
    padding: 13,
  },
  highlightIcon: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: "#fff",
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
  },
  highlightLabel: {
    color: "#fff",
    fontSize: 14,
    fontWeight: 850,
    lineHeight: 1.25,
  },
  highlightDetail: {
    marginTop: 4,
    color: "#bfdbfe",
    fontSize: 12,
    lineHeight: 1.45,
  },
  panelFooter: {
    marginTop: 18,
    borderTop: "1px solid rgba(255,255,255,0.14)",
    paddingTop: 14,
    color: "#bfdbfe",
    fontSize: 12,
    lineHeight: 1.55,
  },
  card: {
    flex: "1 1 430px",
    maxWidth: 500,
    minWidth: 0,
    backgroundColor: "#fff",
    padding: "clamp(22px, 6vw, 34px)",
    borderRadius: 18,
    boxShadow: "0 18px 36px rgba(15,23,42,0.1)",
    border: "1px solid #e2e8f0",
    boxSizing: "border-box",
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
    marginBottom: 8,
  },
  eyebrow: {
    margin: 0,
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.1em",
  },
  title: {
    fontSize: 28,
    fontWeight: 800,
    margin: 0,
    color: "#0f172a",
    lineHeight: 1.12,
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
    margin: "8px 0 0",
    lineHeight: 1.55,
  },
  ctaLink: {
    flexShrink: 0,
    padding: "10px 16px",
    border: "1px solid",
    borderRadius: 999,
    backgroundColor: "#fff",
    textDecoration: "none",
    fontWeight: 750,
    fontSize: 14,
  },
  callout: {
    margin: "22px 0 18px",
    borderRadius: 12,
    border: "1px solid",
    padding: 13,
  },
  calloutBody: {
    marginTop: 5,
    color: "#475569",
    fontSize: 13,
    lineHeight: 1.55,
  },
  formSummary: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: 11,
    borderRadius: 14,
    border: "1px solid",
    padding: 13,
    marginBottom: 18,
  },
  formSummaryEyebrow: {
    margin: 0,
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  formSummaryTitle: {
    margin: "5px 0 0",
    color: "#0f172a",
    fontSize: 17,
    lineHeight: 1.2,
  },
  formSummaryDetail: {
    margin: "6px 0 0",
    color: "#475569",
    fontSize: 13,
    lineHeight: 1.55,
  },
  formSummaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 8,
  },
  formSummaryCard: {
    minWidth: 0,
    borderRadius: 11,
    border: "1px solid #e2e8f0",
    backgroundColor: "#fff",
    padding: "9px 10px",
    display: "grid",
    gap: 4,
  },
  formSummaryCardLabel: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  formSummaryCardValue: {
    color: "#0f172a",
    fontSize: 13,
    lineHeight: 1.25,
    overflowWrap: "anywhere",
  },
  field: {
    display: "grid",
    gap: 6,
  },
  fieldLabel: {
    color: "#334155",
    fontSize: 13,
    fontWeight: 800,
  },
  input: {
    width: "100%",
    minHeight: 46,
    padding: "12px 14px",
    border: "1px solid #cbd5e1",
    borderRadius: 11,
    backgroundColor: "#fff",
    color: "#0f172a",
    fontSize: 15,
    boxSizing: "border-box",
    outlineColor: "#93c5fd",
  },
  fieldHelper: {
    margin: 0,
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.45,
  },
  submitButton: {
    width: "100%",
    minHeight: 48,
    padding: "14px 16px",
    color: "#fff",
    border: "none",
    borderRadius: 11,
    fontSize: 16,
    fontWeight: 850,
  },
  formError: {
    margin: 0,
    borderRadius: 11,
    border: "1px solid #fecaca",
    backgroundColor: "#fef2f2",
    color: "#b91c1c",
    padding: "10px 12px",
    fontSize: 13,
    lineHeight: 1.45,
  },
  nextSteps: {
    margin: "0 0 18px",
    borderRadius: 14,
    border: "1px solid #e2e8f0",
    backgroundColor: "#f8fafc",
    padding: 13,
  },
  nextStepsHeader: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },
  nextStepsEyebrow: {
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.12em",
  },
  nextStepsTitle: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: 850,
    textAlign: "right",
  },
  nextStepGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(128px, 1fr))",
    gap: 9,
  },
  nextStepCard: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    minWidth: 0,
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    backgroundColor: "#fff",
    padding: 10,
  },
  nextStepNumber: {
    width: 24,
    height: 24,
    borderRadius: 999,
    border: "1px solid",
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
    fontSize: 12,
    fontWeight: 900,
  },
  nextStepLabel: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: 850,
    lineHeight: 1.25,
  },
  nextStepDetail: {
    marginTop: 3,
    color: "#64748b",
    fontSize: 11,
    lineHeight: 1.45,
  },
  footer: {
    marginTop: 20,
  },
};
