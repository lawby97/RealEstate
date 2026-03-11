/**
 * Single assumption row: label, value, provenance badge, optional reset.
 */

import type { AssumptionValue } from "@/types/listing";
import { ProvenanceBadge } from "@/components/listing/ProvenanceBadge";

interface AssumptionRowProps {
  label: string;
  assumption: AssumptionValue<number>;
  format?: "currency" | "percent" | "number" | "years";
}

function formatValue(value: number, format: AssumptionRowProps["format"]): string {
  switch (format) {
    case "currency":
      return `$${value.toLocaleString("en-CA", { maximumFractionDigits: 0 })}`;
    case "percent":
      return `${(value * 100).toFixed(1)}%`;
    case "years":
      return `${value} years`;
    case "number":
    default:
      return value.toLocaleString();
  }
}

export function AssumptionRow({ label, assumption, format = "number" }: AssumptionRowProps) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 py-1.5">
      <span className="text-sm text-slate-600">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-medium text-slate-900">
          {formatValue(assumption.value, format)}
        </span>
        <ProvenanceBadge source={assumption.source} detail={assumption.label} />
      </div>
    </div>
  );
}
