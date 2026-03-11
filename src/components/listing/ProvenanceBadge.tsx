/**
 * Badge for data source: actual, market benchmark, official rate, assumed, user override.
 */

import type { AssumptionSource } from "@/types/listing";

const LABELS: Record<AssumptionSource, string> = {
  actual: "Listing data",
  market_benchmark: "Market benchmark",
  official_rate: "Official rate",
  assumed: "Assumed",
  description_inferred: "Description inferred",
  profile_default: "Profile default",
  asset_baseline: "Asset baseline",
  user_override: "User override",
};

const STYLES: Record<AssumptionSource, string> = {
  actual: "bg-slate-100 text-slate-700 border-slate-200",
  market_benchmark: "bg-blue-50 text-blue-800 border-blue-200",
  official_rate: "bg-emerald-50 text-emerald-800 border-emerald-200",
  assumed: "bg-amber-50 text-amber-800 border-amber-200",
  description_inferred: "bg-cyan-50 text-cyan-800 border-cyan-200",
  profile_default: "bg-indigo-50 text-indigo-800 border-indigo-200",
  asset_baseline: "bg-slate-100 text-slate-700 border-slate-200",
  user_override: "bg-violet-50 text-violet-800 border-violet-200",
};

const DESCRIPTIONS: Record<AssumptionSource, string> = {
  actual: "Taken directly from the listing source or stored source payload.",
  market_benchmark:
    "Mapped from benchmark market data for this city, zone, unit mix, or property profile.",
  official_rate:
    "Taken from an official municipal or government rate table, then applied in the model where relevant.",
  assumed:
    "Default underwriting assumption used because the listing or benchmark data did not provide the field directly.",
  description_inferred:
    "Inferred from the listing description or remarks when the source did not provide a structured field.",
  profile_default:
    "Taken from the investor's saved profile defaults and applied to this listing as the default operating assumption.",
  asset_baseline:
    "Generated from the app's internal asset-level baseline for this property type, unit count, and deal stage.",
  user_override: "Entered manually in the model and now overrides the default source.",
};

function summarizeDetail(detail?: string): string | null {
  if (!detail) return null;
  const normalized = detail.replace(/\s+/g, " ").trim();
  if (!normalized) return null;

  const explicitSource = normalized.match(/^Source:\s*(.*?)(?:\.\s*)Calculation:\s*.*$/i);
  if (explicitSource?.[1]) {
    return explicitSource[1].trim();
  }

  const referenceSource = normalized.match(/^(.*?)(?:\.\s*)Reference proxy:\s*.*$/i);
  if (referenceSource?.[1]) {
    return referenceSource[1].trim();
  }

  return normalized;
}

export function ProvenanceBadge({
  source,
  detail,
}: {
  source: AssumptionSource;
  detail?: string;
}) {
  const detailSummary = summarizeDetail(detail);

  return (
    <span className="group relative inline-flex">
      <span
        tabIndex={0}
        className={`inline-flex cursor-help items-center rounded border px-1.5 py-0.5 text-xs font-medium ${STYLES[source]}`}
        aria-label={`${LABELS[source]} source information`}
      >
        {LABELS[source]}
      </span>
      <span className="pointer-events-none invisible absolute left-1/2 top-full z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-3 text-left opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        <span className="block text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
          {LABELS[source]}
        </span>
        <span className="mt-1 block text-xs leading-5 text-slate-700">{DESCRIPTIONS[source]}</span>
        {detailSummary && (
          <>
            <span className="mt-3 block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
              Source detail
            </span>
            <span className="mt-1 block text-xs leading-5 text-slate-600">{detailSummary}</span>
          </>
        )}
      </span>
    </span>
  );
}
