export function formatCurrencyInteger(value: number): string {
  if (!Number.isFinite(value)) return "$0";
  const sign = value < 0 ? "-" : "";
  const rounded = Math.round(Math.abs(value));
  const grouped = String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}$${grouped}`;
}

export function formatCompactCurrency(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "$0";

  const sign = value < 0 ? "-" : "";
  const absolute = Math.abs(value);

  if (absolute >= 999_500_000) return `${sign}$${formatCompactNumber(absolute / 1_000_000_000)}B`;
  if (absolute >= 999_500) return `${sign}$${formatCompactNumber(absolute / 1_000_000)}M`;
  if (absolute >= 1_000) return `${sign}$${formatCompactNumber(absolute / 1_000)}K`;

  return `${sign}$${Math.round(absolute)}`;
}

function formatCompactNumber(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
