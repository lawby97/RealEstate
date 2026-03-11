/**
 * Read market metrics from DB (populated by CMHC RMR ingestion).
 * Zone resolution: DB (exact postal → FSA) first, then static FSA map, then city fallback.
 */

import { prisma } from "@/lib/prisma";
import { resolveCmhcZone, CMA_PROVINCES } from "./cmhc-zone";

const SURVEY_YEAR = 2025;

function normalizePostal(postalCode: string | null | undefined): string | null {
  if (!postalCode || typeof postalCode !== "string") return null;
  return postalCode.replace(/\s/g, "").toLowerCase().slice(0, 6) || null;
}

function extractFsa(postalCode: string | null | undefined): string | null {
  const normalized = normalizePostal(postalCode);
  return normalized && normalized.length >= 3 ? normalized.slice(0, 3) : null;
}

function extractZoneCodeFromLabel(zoneLabel: string | null): string | null {
  if (!zoneLabel) return null;
  const m = zoneLabel.match(/^Zone\s+(\d+)/i);
  return m ? m[1]! : null;
}

/**
 * Resolve listing location to MarketCity + MarketZone for the most accurate data.
 * Order: 1) internal override 2) exact postal in MarketPostalZoneMap 3) FSA in MarketPostalZoneMap
 *        4) static FSA→zone (cmhc-zone) + MarketZone by code  5) city-level only.
 */
export async function resolveMarketZone(params: {
  city: string;
  province?: string | null;
  postalCode?: string | null;
}): Promise<{ marketCityId: string; marketZoneId: string | null; zoneMatchMethod: string } | null> {
  const { cma, zone } = resolveCmhcZone(params.city, params.province, params.postalCode);
  const province = CMA_PROVINCES[cma] ?? params.province ?? "ON";
  const marketCity = await prisma.marketCity.findUnique({
    where: { city_province: { city: cma, province } },
  });
  if (!marketCity) return null;

  let marketZoneId: string | null = null;
  let zoneMatchMethod = "fallback_city";

  const fullPostal = normalizePostal(params.postalCode);
  const fsa = extractFsa(params.postalCode);

  if (fullPostal && fullPostal.length >= 6) {
    const exact = await prisma.marketPostalZoneMap.findFirst({
      where: { marketCityId: marketCity.id, postalCode: fullPostal, isExact: true },
      include: { zone: true },
    });
    if (exact) {
      marketZoneId = exact.zoneId;
      zoneMatchMethod = "exact_postal";
      return { marketCityId: marketCity.id, marketZoneId, zoneMatchMethod };
    }
  }

  if (fsa) {
    const fsaRow = await prisma.marketPostalZoneMap.findFirst({
      where: { marketCityId: marketCity.id, postalFsa: fsa },
      include: { zone: true },
    });
    if (fsaRow) {
      marketZoneId = fsaRow.zoneId;
      zoneMatchMethod = "fsa";
      return { marketCityId: marketCity.id, marketZoneId, zoneMatchMethod };
    }
  }

  if (zone) {
    const zoneCode = extractZoneCodeFromLabel(zone);
    if (zoneCode) {
      const marketZone = await prisma.marketZone.findUnique({
        where: { marketCityId_zoneCode: { marketCityId: marketCity.id, zoneCode } },
      });
      if (marketZone) {
        marketZoneId = marketZone.id;
        zoneMatchMethod = "fsa";
      }
    }
  }

  return { marketCityId: marketCity.id, marketZoneId, zoneMatchMethod };
}

export async function getMetricFromDb(params: {
  marketCityId: string;
  marketZoneId?: string | null;
  metricType: "vacancy_rate" | "average_rent" | "vacant_rent" | "occupied_rent" | "turnover_rate" | "rent_change_pct";
  bedroomType: string;
  structureSizeBucket?: string | null;
  yearBuiltBucket?: string | null;
}): Promise<{ value: number; source: string } | null> {
  const { marketCityId, marketZoneId, metricType, bedroomType, structureSizeBucket, yearBuiltBucket } = params;

  const rows = await prisma.marketMetric.findMany({
    where: {
      marketCityId,
      zoneId: marketZoneId ?? null,
      metricType,
      assetClass: "apartment",
      bedroomType,
      ...(structureSizeBucket && { structureSizeBucket }),
      ...(yearBuiltBucket && { yearBuiltBucket }),
      surveyYear: SURVEY_YEAR,
      suppressionFlag: false,
      value: { not: null },
    },
    include: {
      zone: {
        select: {
          zoneLabel: true,
        },
      },
    },
    orderBy: [
      { zoneId: "asc" },
      { bedroomType: "asc" },
      { structureSizeBucket: "asc" },
      { yearBuiltBucket: "asc" },
      { id: "asc" },
    ],
  });
  const row = rows[0];
  if (row?.value != null) {
    const scopeLabel = marketZoneId ? row.zone?.zoneLabel ?? "zone" : "city";
    const basis = [scopeLabel, bedroomType, structureSizeBucket, yearBuiltBucket].filter(Boolean).join(", ");
    return { value: row.value, source: `CMHC ${SURVEY_YEAR} (${basis})` };
  }
  return null;
}

function getStructureSizeFallbacks(structureSizeBucket?: string | null): Array<string | null> {
  if (!structureSizeBucket) return [null];
  if (structureSizeBucket === "100_to_199" || structureSizeBucket === "200_plus") {
    return [structureSizeBucket, "100_plus", null];
  }
  if (structureSizeBucket === "100_plus") {
    return ["100_plus", "100_to_199", "200_plus", null];
  }
  return [structureSizeBucket, null];
}

async function getMetricWithFallbacks(params: {
  city: string;
  province?: string | null;
  postalCode?: string | null;
  metricType: "vacancy_rate" | "average_rent" | "vacant_rent" | "occupied_rent" | "turnover_rate" | "rent_change_pct";
  bedroomType?: string;
  structureSizeBucket?: string | null;
  yearBuiltBucket?: string | null;
}): Promise<{ value: number; source: string } | null> {
  const resolved = await resolveMarketZone(params);
  if (!resolved) return null;

  const bedroom = params.bedroomType ?? "total";
  const zoneAndCity = [resolved.marketZoneId ?? null, null];
  const bedroomFallbacks = bedroom === "total" ? ["total"] : [bedroom, "total"];
  const scopedFilters = getStructureSizeFallbacks(params.structureSizeBucket).flatMap((structureSizeBucket) => [
    {
      structureSizeBucket,
      yearBuiltBucket: params.yearBuiltBucket ?? null,
    },
    {
      structureSizeBucket,
      yearBuiltBucket: null,
    },
  ]).concat([
    {
      structureSizeBucket: null,
      yearBuiltBucket: params.yearBuiltBucket ?? null,
    },
    {
      structureSizeBucket: null,
      yearBuiltBucket: null,
    },
  ]).filter((scope, index, all) => {
    return all.findIndex(
      (candidate) =>
        candidate.structureSizeBucket === scope.structureSizeBucket &&
        candidate.yearBuiltBucket === scope.yearBuiltBucket
    ) === index;
  });

  for (const scope of scopedFilters) {
    for (const zoneId of zoneAndCity) {
      for (const bedroomType of bedroomFallbacks) {
        const row = await getMetricFromDb({
          marketCityId: resolved.marketCityId,
          marketZoneId: zoneId,
          metricType: params.metricType,
          bedroomType,
          structureSizeBucket: scope.structureSizeBucket,
          yearBuiltBucket: scope.yearBuiltBucket,
        });
        if (row) return row;
      }
    }
  }

  return null;
}

export async function getVacancyFromDb(params: {
  city: string;
  province?: string | null;
  postalCode?: string | null;
  bedroomType?: string;
  structureSizeBucket?: string | null;
  yearBuiltBucket?: string | null;
}): Promise<{ value: number; source: string } | null> {
  return getMetricWithFallbacks({
    city: params.city,
    province: params.province,
    postalCode: params.postalCode,
    metricType: "vacancy_rate",
    bedroomType: params.bedroomType ?? "total",
    structureSizeBucket: params.structureSizeBucket,
    yearBuiltBucket: params.yearBuiltBucket,
  });
}

export async function getRentFromDb(params: {
  city: string;
  province?: string | null;
  postalCode?: string | null;
  bedroomType?: string;
  structureSizeBucket?: string | null;
  yearBuiltBucket?: string | null;
}): Promise<{ value: number; source: string } | null> {
  return getMetricWithFallbacks({
    city: params.city,
    province: params.province,
    postalCode: params.postalCode,
    metricType: "average_rent",
    bedroomType: params.bedroomType ?? "total",
    structureSizeBucket: params.structureSizeBucket,
    yearBuiltBucket: params.yearBuiltBucket,
  });
}

export async function getVacantRentFromDb(params: {
  city: string;
  province?: string | null;
  postalCode?: string | null;
  bedroomType?: string;
}): Promise<{ value: number; source: string } | null> {
  return getMetricWithFallbacks({
    city: params.city,
    province: params.province,
    postalCode: params.postalCode,
    metricType: "vacant_rent",
    bedroomType: params.bedroomType ?? "total",
  });
}

export async function getOccupiedRentFromDb(params: {
  city: string;
  province?: string | null;
  postalCode?: string | null;
  bedroomType?: string;
}): Promise<{ value: number; source: string } | null> {
  return getMetricWithFallbacks({
    city: params.city,
    province: params.province,
    postalCode: params.postalCode,
    metricType: "occupied_rent",
    bedroomType: params.bedroomType ?? "total",
  });
}

/** Get newest year-built bucket rent for renovated proxy (e.g. 2015_plus). */
export async function getNewestStockRentFromDb(params: {
  city: string;
  province?: string | null;
  postalCode?: string | null;
  bedroomType?: string;
}): Promise<{ value: number; source: string } | null> {
  const buckets = ["2015_plus", "2005_2014", "1990_2004"];
  for (const yb of buckets) {
    const row = await getMetricWithFallbacks({
      city: params.city,
      province: params.province,
      postalCode: params.postalCode,
      metricType: "average_rent",
      bedroomType: params.bedroomType ?? "total",
      yearBuiltBucket: yb,
    });
    if (row) return row;
  }
  return null;
}

export async function getRentChangePctFromDb(params: {
  city: string;
  province?: string | null;
  postalCode?: string | null;
  bedroomType?: string;
}): Promise<{ value: number; source: string } | null> {
  const row = await getMetricWithFallbacks({
    city: params.city,
    province: params.province,
    postalCode: params.postalCode,
    metricType: "rent_change_pct",
    bedroomType: params.bedroomType ?? "total",
  });

  if (!row) return null;

  return {
    value: row.value > 1 || row.value < -1 ? row.value / 100 : row.value,
    source: row.source,
  };
}
