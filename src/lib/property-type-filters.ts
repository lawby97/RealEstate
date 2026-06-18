import type { Prisma } from "@prisma/client";

export const MULTIFAMILY_LABEL = "Multi-Family";

function normalizeComparable(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s_-]+/g, "")
    .trim();
}

export function normalizePropertyTypeOption(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const comparable = normalizeComparable(trimmed);
  if (comparable === "multifamily" || comparable === "multi-family") {
    return MULTIFAMILY_LABEL;
  }
  return trimmed;
}

export function parsePropertyTypeParams(searchParams: URLSearchParams): string[] {
  const values = [
    ...searchParams.getAll("propertyTypes"),
    ...searchParams.getAll("propertyType"),
  ];
  return Array.from(
    new Set(
      values
        .flatMap((value) => value.split(","))
        .map(normalizePropertyTypeOption)
        .filter(Boolean)
    )
  );
}

export function propertyTypeWhere(types: string[]): Prisma.ListingWhereInput | null {
  const normalized = Array.from(new Set(types.map(normalizePropertyTypeOption).filter(Boolean)));
  if (normalized.length === 0) return null;

  return {
    OR: normalized.map((type) => {
      if (type === MULTIFAMILY_LABEL) {
        return {
          OR: [
            { propertyType: { contains: "Multi-Family" } },
            { propertyType: { contains: "Multi-family" } },
            { propertyType: { contains: "multifamily" } },
            { propertyType: { contains: "multi family" } },
          ],
        };
      }
      return { propertyType: { equals: type } };
    }),
  };
}
