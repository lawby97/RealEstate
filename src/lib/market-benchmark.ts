/**
 * Market benchmark selection for a listing.
 * Prefers DB (MarketMetric from CMHC RMR ingestion); falls back to JSON.
 */

import type { AssumptionSource, DataConfidence, MarketBenchmarkProfile, UnitRentBenchmark } from "@/types/listing";
import { prisma } from "@/lib/prisma";
import { resolveCmhcZone } from "./cmhc-zone";
import { getBestRentEstimate, getBestVacancyRate, getCmhcRentGrowth } from "./cmhc-data";
import { getZoneRents, getZoneVacancy } from "./cmhc-zone-data";
import {
  getVacancyFromDb,
  getRentFromDb,
  getVacantRentFromDb,
  getOccupiedRentFromDb,
  getNewestStockRentFromDb,
  getRentChangePctFromDb,
  resolveMarketZone,
} from "./market-metrics-db";
import type { ParsedBedroomMix } from "./quebec-unit-mix";

const RENOVATION_UPLIFT = 1.12; // 12% uplift when no newer-stock benchmark
const TURNOVER_RATIO_SHRINKAGE = 0.5;

function bedroomToKey(bedrooms: number | null | undefined): string {
  if (bedrooms == null) return "total";
  if (bedrooms === 0) return "studio";
  if (bedrooms === 1) return "1_bed";
  if (bedrooms === 2) return "2_bed";
  return "3_bed_plus";
}

function resolveBedroomBasis(
  bedrooms: number | null | undefined,
  normalizedUnits: number,
  normalizedAssetType: string,
  parsedBedroomMix?: ParsedBedroomMix | null
): { key: string; label: string } {
  if (normalizedAssetType === "land" || normalizedAssetType === "parking") {
    return { key: "total", label: "total (non-residential proxy)" };
  }
  if (normalizedUnits > 1 && parsedBedroomMix) {
    return {
      key: bedroomToKey(parsedBedroomMix.basisBedrooms),
      label: `${parsedBedroomMix.label}, ~${parsedBedroomMix.avgBedroomsPerUnit.toFixed(1)} bed/unit`,
    };
  }
  if (bedrooms == null || bedrooms <= 0) {
    return { key: "total", label: "total" };
  }
  if (normalizedUnits <= 1) {
    return {
      key: bedroomToKey(bedrooms),
      label: `${bedrooms}-bed`,
    };
  }

  // Listing feeds often store total bedrooms for the whole building.
  const avgBedroomsPerUnit = bedrooms / normalizedUnits;
  const roundedBasis =
    avgBedroomsPerUnit < 0.5 ? 0
    : avgBedroomsPerUnit < 1.5 ? 1
    : avgBedroomsPerUnit < 2.5 ? 2
    : 3;

  return {
    key: bedroomToKey(roundedBasis),
    label: `~${avgBedroomsPerUnit.toFixed(1)} bed/unit (${roundedBasis}+ bed basis)`,
  };
}

function zoneRentByBedroomKey(
  rents: ReturnType<typeof getZoneRents>,
  bedroomKey: string
): number | null {
  if (!rents) return null;
  if (bedroomKey === "studio") return rents.studio ?? rents.total ?? null;
  if (bedroomKey === "1_bed") return rents.oneBed ?? rents.total ?? null;
  if (bedroomKey === "2_bed") return rents.twoBed ?? rents.total ?? null;
  if (bedroomKey === "3_bed_plus") return rents.threeBedPlus ?? rents.total ?? null;
  return rents.total ?? null;
}

function bedroomLabelFromKey(key: string): string {
  if (key === "studio") return "studio";
  if (key === "1_bed") return "1-bed";
  if (key === "2_bed") return "2-bed";
  if (key === "3_bed_plus") return "3+ bed";
  return "total";
}

function nearbyBedroomKeys(targetKey: string): string[] {
  switch (targetKey) {
    case "studio":
      return ["1_bed", "2_bed", "3_bed_plus"];
    case "1_bed":
      return ["2_bed", "studio", "3_bed_plus"];
    case "2_bed":
      return ["1_bed", "3_bed_plus", "studio"];
    case "3_bed_plus":
      return ["2_bed", "1_bed", "studio"];
    default:
      return ["2_bed", "1_bed", "3_bed_plus", "studio"];
  }
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!;
}

function toAssumptionValue(
  value: number,
  source: AssumptionSource,
  label: string
) {
  return { value, source, label };
}

function bedroomCountFromKey(key: string): number {
  if (key === "studio") return 0;
  if (key === "1_bed") return 1;
  if (key === "2_bed") return 2;
  if (key === "3_bed_plus") return 3;
  return 1;
}

function getBedroomMixCounts(parsedBedroomMix: ParsedBedroomMix): Array<{ bedrooms: number; count: number }> {
  return Array.from(
    parsedBedroomMix.bedroomsPerUnit.reduce((acc, bedrooms) => {
      acc.set(bedrooms, (acc.get(bedrooms) ?? 0) + 1);
      return acc;
    }, new Map<number, number>())
  )
    .sort((a, b) => a[0] - b[0])
    .map(([bedrooms, count]) => ({ bedrooms, count }));
}

async function getWeightedMetricFromMix(
  parsedBedroomMix: ParsedBedroomMix,
  fetcher: (bedroomKey: string) => Promise<{ value: number; source: string } | null>
): Promise<{ value: number; source: string } | null> {
  if (!parsedBedroomMix.isComplete || !parsedBedroomMix.bedroomsPerUnit.length) return null;

  let weightedTotal = 0;
  let totalUnits = 0;
  for (const bucket of getBedroomMixCounts(parsedBedroomMix)) {
    const row = await fetcher(bedroomToKey(bucket.bedrooms));
    if (!row) return null;
    weightedTotal += row.value * bucket.count;
    totalUnits += bucket.count;
  }

  if (totalUnits <= 0) return null;
  return {
    value: weightedTotal / totalUnits,
    source: `weighted by ${parsedBedroomMix.label}`,
  };
}

function getWeightedZoneRentFromMix(
  parsedBedroomMix: ParsedBedroomMix,
  rents: ReturnType<typeof getZoneRents>
): number | null {
  if (!parsedBedroomMix.isComplete || !rents) return null;

  let weightedTotal = 0;
  let totalUnits = 0;
  for (const bucket of getBedroomMixCounts(parsedBedroomMix)) {
    const rent = zoneRentByBedroomKey(rents, bedroomToKey(bucket.bedrooms));
    if (rent == null) return null;
    weightedTotal += rent * bucket.count;
    totalUnits += bucket.count;
  }
  return totalUnits > 0 ? weightedTotal / totalUnits : null;
}

function yearBuiltToBucket(yearBuilt: number | null | undefined): string | null {
  if (!yearBuilt) return null;
  if (yearBuilt < 1940) return "pre_1940";
  if (yearBuilt <= 1959) return "1940_1959";
  if (yearBuilt <= 1974) return "1960_1974";
  if (yearBuilt <= 1989) return "1975_1989";
  if (yearBuilt <= 2004) return "1990_2004";
  if (yearBuilt <= 2014) return "2005_2014";
  return "2015_plus";
}

export async function buildMarketBenchmarkProfile(params: {
  city: string;
  province?: string | null;
  postalCode?: string | null;
  normalizedAssetType: string;
  normalizedUnits: number;
  bedrooms?: number | null;
  parsedBedroomMix?: ParsedBedroomMix | null;
  yearBuilt?: number | null;
  squareFeet?: number | null;
}): Promise<MarketBenchmarkProfile> {
  const { city, province, postalCode, normalizedAssetType, normalizedUnits, bedrooms, parsedBedroomMix, yearBuilt } = params;
  const staticResolved = resolveCmhcZone(city, province, postalCode);
  let mappedCity = staticResolved.cma;
  let mappedZone = staticResolved.zone;
  let zoneMatchMethod: string | null = staticResolved.zone ? "fsa" : "fallback_city";

  // Prefer DB mapping when available so the same logic works across all zones.
  const resolvedFromDb = await resolveMarketZone({ city, province, postalCode });
  if (resolvedFromDb) {
    const marketCity = await prisma.marketCity.findUnique({
      where: { id: resolvedFromDb.marketCityId },
      select: { city: true },
    });
    if (marketCity?.city) mappedCity = marketCity.city;
    zoneMatchMethod = resolvedFromDb.zoneMatchMethod;

    if (resolvedFromDb.marketZoneId) {
      const zoneRow = await prisma.marketZone.findUnique({
        where: { id: resolvedFromDb.marketZoneId },
        select: { zoneLabel: true },
      });
      if (zoneRow?.zoneLabel) mappedZone = zoneRow.zoneLabel;
    }
  }

  const bedBasis = resolveBedroomBasis(bedrooms, normalizedUnits, normalizedAssetType, parsedBedroomMix);
  const bedKey = bedBasis.key;
  const structureSizeBasis =
    normalizedUnits >= 200 ? "200_plus"
    : normalizedUnits >= 100 ? "100_to_199"
    : normalizedUnits >= 50 ? "50_to_99"
    : normalizedUnits >= 20 ? "20_to_49"
    : normalizedUnits >= 6 ? "6_to_19"
    : normalizedUnits >= 3 ? "3_to_5"
    : null;
  const yearBuiltBasis = yearBuiltToBucket(yearBuilt);
  const turnoverMetricCache = new Map<string, { value: number; source: AssumptionSource; label: string }>();

  const applyTurnoverFallbackFloor = (
    fallbackValue: number,
    occupiedValue: number | null,
    baseLabel: string
  ): { value: number; source: AssumptionSource; label: string } => {
    if (occupiedValue == null) {
      return {
        value: Math.round(fallbackValue),
        source: "market_benchmark",
        label: baseLabel,
      };
    }

    const flooredValue = Math.max(fallbackValue, occupiedValue);
    const floorApplied = flooredValue > fallbackValue + 0.5;
    return {
      value: Math.round(flooredValue),
      source: "market_benchmark",
      label: floorApplied
        ? `${baseLabel}. Calculation: fallback turnover rent floored at occupied rent (${Math.round(occupiedValue).toLocaleString("en-CA")}) because turnover should not underwrite below occupied benchmark without direct vacant-unit evidence.`
        : baseLabel,
    };
  };

  const inferTurnoverRentFromAdjacentRatios = async (
    targetBedroomKey: string,
    occupiedValue: number
  ): Promise<{ value: number; source: AssumptionSource; label: string } | null> => {
    const ratioSamples: Array<{ ratio: number; vacantSource: string; occupiedSource: string }> = [];
    for (const candidateKey of nearbyBedroomKeys(targetBedroomKey)) {
      const [vacantRow, occupiedRow] = await Promise.all([
        getVacantRentFromDb({ city, province, postalCode, bedroomType: candidateKey }),
        getOccupiedRentFromDb({ city, province, postalCode, bedroomType: candidateKey }),
      ]);
      if (!vacantRow || !occupiedRow || occupiedRow.value <= 0) continue;
      ratioSamples.push({
        ratio: Math.max(1, vacantRow.value / occupiedRow.value),
        vacantSource: vacantRow.source,
        occupiedSource: occupiedRow.source,
      });
    }

    const medianRatio = median(ratioSamples.map((sample) => sample.ratio));
    if (medianRatio == null) return null;

    const shrunkenRatio = 1 + (medianRatio - 1) * TURNOVER_RATIO_SHRINKAGE;
    const inferredValue = Math.max(occupiedValue, occupiedValue * shrunkenRatio);
    const sourceScope = Array.from(
      new Set(
        ratioSamples
          .flatMap((sample) => [sample.vacantSource, sample.occupiedSource])
          .map((source) => source.trim())
      )
    )[0] ?? "CMHC market data";
    return {
      value: Math.round(inferredValue),
      source: "market_benchmark",
      label: `Source: ${sourceScope}. Calculation: Turnover rent inferred from nearby vacant-unit premiums with ${(TURNOVER_RATIO_SHRINKAGE * 100).toFixed(0)}% shrinkage toward occupied rent (median vacant / occupied ratio ${medianRatio.toFixed(3)}).`,
    };
  };

  const getTurnoverRentByBedroomKey = async (
    bedroomKey: string
  ): Promise<{ value: number; source: AssumptionSource; label: string }> => {
    const cached = turnoverMetricCache.get(bedroomKey);
    if (cached) return cached;

    const occupiedRow = await getOccupiedRentFromDb({ city, province, postalCode, bedroomType: bedroomKey });

    const dbVacantRent = await getVacantRentFromDb({ city, province, postalCode, bedroomType: bedroomKey });
    if (dbVacantRent) {
      const result = {
        value: Math.round(dbVacantRent.value),
        source: "market_benchmark" as const,
        label: `${dbVacantRent.source}, vacant units`,
      };
      turnoverMetricCache.set(bedroomKey, result);
      return result;
    }

    if (occupiedRow) {
      const inferredResult = await inferTurnoverRentFromAdjacentRatios(bedroomKey, occupiedRow.value);
      if (inferredResult) {
        turnoverMetricCache.set(bedroomKey, inferredResult);
        return inferredResult;
      }
    }

    const dbRent = await getRentFromDb({
      city,
      province,
      postalCode,
      bedroomType: bedroomKey,
    });
    if (dbRent) {
      const result = applyTurnoverFallbackFloor(
        dbRent.value,
        occupiedRow?.value ?? null,
        `Source: ${dbRent.source}. Calculation: Using average market rent because no direct vacant-unit row was available for ${bedroomLabelFromKey(bedroomKey)}.`
      );
      turnoverMetricCache.set(bedroomKey, result);
      return result;
    }

    if (mappedZone) {
      const zoneRents = getZoneRents(mappedCity, mappedZone);
      const zoneRent = zoneRentByBedroomKey(zoneRents, bedroomKey);
      if (zoneRent != null) {
        const result = applyTurnoverFallbackFloor(
          zoneRent,
          occupiedRow?.value ?? null,
          `Source: CMHC market benchmark, ${mappedZone}, ${bedroomLabelFromKey(bedroomKey)}. Calculation: Using zone-level market rent because no direct vacant-unit row was available.`
        );
        turnoverMetricCache.set(bedroomKey, result);
        return result;
      }
    }

    const est = getBestRentEstimate(mappedCity, normalizedUnits);
    const fallbackRent = zoneRentByBedroomKey(est.rents, bedroomKey) ?? est.rents.total ?? 1500;
    const result = applyTurnoverFallbackFloor(
      fallbackRent,
      occupiedRow?.value ?? null,
      `Source: CMHC city-level, ${est.source}. Calculation: Using CMA rent fallback because no zone-specific turnover evidence was available.`
    );
    turnoverMetricCache.set(bedroomKey, result);
    return result;
  };

  let benchmarkVacancyRate: number | null = null;
  let benchmarkVacancyProvenance: AssumptionSource = "assumed";
  let benchmarkVacancyLabel = "Assumed (no zone match)";

  const dbVacancy = await getVacancyFromDb({
    city,
    province,
    postalCode,
    bedroomType: bedKey,
    structureSizeBucket: structureSizeBasis,
    yearBuiltBucket: yearBuiltBasis,
  });
  if (dbVacancy) {
    benchmarkVacancyRate = dbVacancy.value;
    benchmarkVacancyProvenance = "market_benchmark";
    benchmarkVacancyLabel = dbVacancy.source;
  }
  if (benchmarkVacancyRate == null && mappedZone) {
    const zoneVac = getZoneVacancy(mappedCity, mappedZone);
    if (zoneVac != null) {
      benchmarkVacancyRate = zoneVac;
      benchmarkVacancyProvenance = "market_benchmark";
      benchmarkVacancyLabel = `CMHC market benchmark, ${mappedZone}, apartment, ${bedBasis.label}`;
    }
  }
  if (benchmarkVacancyRate == null) {
    const cityVac = getBestVacancyRate(mappedCity);
    benchmarkVacancyRate = cityVac.rate;
    benchmarkVacancyProvenance = "market_benchmark";
    benchmarkVacancyLabel = `CMHC city-level, ${mappedCity}`;
  }

  let benchmarkRentGrowthRateAnnual: number | null = null;
  let benchmarkRentGrowthProvenance: AssumptionSource = "assumed";
  let benchmarkRentGrowthLabel = "Static city-level rent growth fallback";

  const weightedRentGrowth =
    parsedBedroomMix
      ? await getWeightedMetricFromMix(parsedBedroomMix, (mixBedKey) =>
          getRentChangePctFromDb({ city, province, postalCode, bedroomType: mixBedKey })
        )
      : null;
  if (weightedRentGrowth) {
    benchmarkRentGrowthRateAnnual = weightedRentGrowth.value;
    benchmarkRentGrowthProvenance = "market_benchmark";
    benchmarkRentGrowthLabel = `CMHC rent growth, ${weightedRentGrowth.source}`;
  }

  const dbRentGrowth = await getRentChangePctFromDb({ city, province, postalCode, bedroomType: bedKey });
  if (benchmarkRentGrowthRateAnnual == null && dbRentGrowth) {
    benchmarkRentGrowthRateAnnual = dbRentGrowth.value;
    benchmarkRentGrowthProvenance = "market_benchmark";
    benchmarkRentGrowthLabel = `${dbRentGrowth.source}, year-over-year rent change`;
  }
  if (benchmarkRentGrowthRateAnnual == null) {
    benchmarkRentGrowthRateAnnual = getCmhcRentGrowth(mappedCity);
    benchmarkRentGrowthProvenance = "market_benchmark";
    benchmarkRentGrowthLabel = `CMHC city-level rent-growth fallback, ${mappedCity}`;
  }

  let benchmarkCurrentRent: number | null = null;
  let benchmarkCurrentRentProvenance: AssumptionSource = "assumed";
  let benchmarkCurrentRentLabel = "Assumed (no zone match)";

  const weightedOccupiedRent =
    parsedBedroomMix
      ? await getWeightedMetricFromMix(parsedBedroomMix, (mixBedKey) =>
          getOccupiedRentFromDb({ city, province, postalCode, bedroomType: mixBedKey })
        )
      : null;
  if (weightedOccupiedRent) {
    benchmarkCurrentRent = Math.round(weightedOccupiedRent.value);
    benchmarkCurrentRentProvenance = "market_benchmark";
    benchmarkCurrentRentLabel = `CMHC occupied-unit rents, ${weightedOccupiedRent.source}`;
  }

  const dbOccupiedRent = await getOccupiedRentFromDb({ city, province, postalCode, bedroomType: bedKey });
  if (benchmarkCurrentRent == null && dbOccupiedRent) {
    benchmarkCurrentRent = Math.round(dbOccupiedRent.value);
    benchmarkCurrentRentProvenance = "market_benchmark";
    benchmarkCurrentRentLabel = `${dbOccupiedRent.source}, occupied units`;
  }
  const weightedAverageRent =
    parsedBedroomMix
      ? await getWeightedMetricFromMix(parsedBedroomMix, (mixBedKey) =>
          getRentFromDb({
            city,
            province,
            postalCode,
            bedroomType: mixBedKey,
          })
        )
      : null;
  if (benchmarkCurrentRent == null && weightedAverageRent) {
    benchmarkCurrentRent = Math.round(weightedAverageRent.value);
    benchmarkCurrentRentProvenance = "market_benchmark";
    benchmarkCurrentRentLabel = `CMHC average rents, ${weightedAverageRent.source}`;
  }
  const dbRent = await getRentFromDb({
    city,
    province,
    postalCode,
    bedroomType: bedKey,
  });
  if (benchmarkCurrentRent == null && dbRent) {
    benchmarkCurrentRent = Math.round(dbRent.value);
    benchmarkCurrentRentProvenance = "market_benchmark";
    benchmarkCurrentRentLabel = `${dbRent.source}, average occupied and vacant`;
  }
  if (benchmarkCurrentRent == null && mappedZone) {
    const zoneRents = getZoneRents(mappedCity, mappedZone);
    const rent =
      parsedBedroomMix
        ? getWeightedZoneRentFromMix(parsedBedroomMix, zoneRents) ?? zoneRentByBedroomKey(zoneRents, bedKey)
        : zoneRentByBedroomKey(zoneRents, bedKey);
    if (rent != null) {
      benchmarkCurrentRent = rent;
      benchmarkCurrentRentProvenance = "market_benchmark";
      benchmarkCurrentRentLabel = parsedBedroomMix?.isComplete
        ? `CMHC market benchmark, ${mappedZone}, weighted by ${parsedBedroomMix.label}`
        : `CMHC market benchmark, ${mappedZone}, ${bedBasis.label}`;
    }
  }
  if (benchmarkCurrentRent == null) {
    const est = getBestRentEstimate(mappedCity, normalizedUnits);
    benchmarkCurrentRent = est.rents.total ?? 1500;
    benchmarkCurrentRentProvenance = "market_benchmark";
    benchmarkCurrentRentLabel = `CMHC city-level, ${est.source}`;
  }

  let benchmarkTurnoverRent: number | null = null;
  let benchmarkTurnoverRentProvenance: AssumptionSource = "assumed";
  let benchmarkTurnoverRentLabel = "Assumed (no turnover benchmark match)";

  const weightedVacantRent =
    parsedBedroomMix
      ? await getWeightedMetricFromMix(parsedBedroomMix, (mixBedKey) => getTurnoverRentByBedroomKey(mixBedKey))
      : null;
  if (weightedVacantRent) {
    benchmarkTurnoverRent = Math.round(weightedVacantRent.value);
    benchmarkTurnoverRentProvenance = "market_benchmark";
    benchmarkTurnoverRentLabel = `CMHC turnover rents, ${weightedVacantRent.source}`;
  }

  const turnoverRow = await getTurnoverRentByBedroomKey(bedKey);
  if (benchmarkTurnoverRent == null && turnoverRow) {
    benchmarkTurnoverRent = Math.round(turnoverRow.value);
    benchmarkTurnoverRentProvenance = "market_benchmark";
    benchmarkTurnoverRentLabel = turnoverRow.label;
  }

  let benchmarkRenovatedRentProxy: number | null = null;
  let benchmarkRenovatedRentProvenance: AssumptionSource = "assumed";
  let benchmarkRenovatedRentLabel = "Assumed (current rent × renovation uplift)";

  const weightedNewestStockRent =
    parsedBedroomMix
      ? await getWeightedMetricFromMix(parsedBedroomMix, (mixBedKey) =>
          getNewestStockRentFromDb({ city, province, postalCode, bedroomType: mixBedKey })
        )
      : null;
  if (weightedNewestStockRent) {
    benchmarkRenovatedRentProxy = Math.round(weightedNewestStockRent.value);
    benchmarkRenovatedRentProvenance = "market_benchmark";
    benchmarkRenovatedRentLabel = `CMHC newer-stock proxy, ${weightedNewestStockRent.source}, user-editable`;
  }

  const dbNewestRent = await getNewestStockRentFromDb({ city, province, postalCode, bedroomType: bedKey });
  if (benchmarkRenovatedRentProxy == null && dbNewestRent) {
    benchmarkRenovatedRentProxy = Math.round(dbNewestRent.value);
    benchmarkRenovatedRentProvenance = "market_benchmark";
    benchmarkRenovatedRentLabel = `CMHC newer-stock proxy (${dbNewestRent.source}), user-editable`;
  }
  if (benchmarkRenovatedRentProxy == null && mappedZone) {
    const zoneRents = getZoneRents(mappedCity, mappedZone);
    const zoneBedRent =
      parsedBedroomMix
        ? getWeightedZoneRentFromMix(parsedBedroomMix, zoneRents) ?? zoneRentByBedroomKey(zoneRents, bedKey)
        : zoneRentByBedroomKey(zoneRents, bedKey);
    if (zoneBedRent != null) {
      benchmarkRenovatedRentProxy = Math.round(zoneBedRent * RENOVATION_UPLIFT);
      benchmarkRenovatedRentProvenance = "market_benchmark";
      benchmarkRenovatedRentLabel = parsedBedroomMix?.isComplete
        ? `Zone-level weighted unit-mix proxy (${mappedZone} × ${((RENOVATION_UPLIFT - 1) * 100).toFixed(0)}% uplift), user-editable`
        : `Zone-level ${bedroomLabelFromKey(bedKey)} proxy (${mappedZone} × ${((RENOVATION_UPLIFT - 1) * 100).toFixed(0)}% uplift), user-editable`;
    }
  }
  if (benchmarkRenovatedRentProxy == null && benchmarkCurrentRent != null) {
    benchmarkRenovatedRentProxy = Math.round(benchmarkCurrentRent * RENOVATION_UPLIFT);
    benchmarkRenovatedRentProvenance = "market_benchmark";
    benchmarkRenovatedRentLabel = `Newer-stock proxy (current market × ${((RENOVATION_UPLIFT - 1) * 100).toFixed(0)}% uplift), user-editable`;
  }

  const currentRentCache = new Map<number, { value: number; source: AssumptionSource; label: string }>();
  const renovatedRentCache = new Map<number, { value: number; source: AssumptionSource; label: string }>();

  const buildCurrentRentForBedroom = async (
    bedroomCount: number
  ): Promise<{ value: number; source: AssumptionSource; label: string }> => {
    const cached = currentRentCache.get(bedroomCount);
    if (cached) return cached;

    const unitBedKey = bedroomToKey(bedroomCount);
    const dbOccupiedRent = await getOccupiedRentFromDb({ city, province, postalCode, bedroomType: unitBedKey });
    if (dbOccupiedRent) {
      const result = {
        value: Math.round(dbOccupiedRent.value),
        source: "market_benchmark" as const,
        label: `${dbOccupiedRent.source}, occupied units`,
      };
      currentRentCache.set(bedroomCount, result);
      return result;
    }

    const dbRent = await getRentFromDb({
      city,
      province,
      postalCode,
      bedroomType: unitBedKey,
    });
    if (dbRent) {
      const result = {
        value: Math.round(dbRent.value),
        source: "market_benchmark" as const,
        label: `${dbRent.source}, average occupied and vacant`,
      };
      currentRentCache.set(bedroomCount, result);
      return result;
    }

    if (mappedZone) {
      const zoneRents = getZoneRents(mappedCity, mappedZone);
      const zoneRent = zoneRentByBedroomKey(zoneRents, unitBedKey);
      if (zoneRent != null) {
        const result = {
          value: Math.round(zoneRent),
          source: "market_benchmark" as const,
          label: `CMHC market benchmark, ${mappedZone}, ${bedroomLabelFromKey(unitBedKey)}`,
        };
        currentRentCache.set(bedroomCount, result);
        return result;
      }
    }

    const est = getBestRentEstimate(mappedCity, normalizedUnits);
    const fallbackRent = zoneRentByBedroomKey(est.rents, unitBedKey) ?? est.rents.total ?? 1500;
    const result = {
      value: Math.round(fallbackRent),
      source: "market_benchmark" as const,
      label: `CMHC city-level, ${est.source}`,
    };
    currentRentCache.set(bedroomCount, result);
    return result;
  };

  const buildTurnoverRentForBedroom = async (
    bedroomCount: number
  ): Promise<{ value: number; source: AssumptionSource; label: string }> => {
    const unitBedKey = bedroomToKey(bedroomCount);
    return getTurnoverRentByBedroomKey(unitBedKey);
  };

  const buildRenovatedRentForBedroom = async (
    bedroomCount: number,
    currentRentValue: number
  ): Promise<{ value: number; source: AssumptionSource; label: string }> => {
    const cached = renovatedRentCache.get(bedroomCount);
    if (cached) return cached;

    const unitBedKey = bedroomToKey(bedroomCount);
    const dbNewestRent = await getNewestStockRentFromDb({ city, province, postalCode, bedroomType: unitBedKey });
    if (dbNewestRent) {
      const result = {
        value: Math.round(dbNewestRent.value),
        source: "market_benchmark" as const,
        label: `CMHC newer-stock proxy (${dbNewestRent.source})`,
      };
      renovatedRentCache.set(bedroomCount, result);
      return result;
    }

    if (mappedZone) {
      const zoneRents = getZoneRents(mappedCity, mappedZone);
      const zoneRent = zoneRentByBedroomKey(zoneRents, unitBedKey);
      if (zoneRent != null) {
        const result = {
          value: Math.round(zoneRent * RENOVATION_UPLIFT),
          source: "market_benchmark" as const,
          label: `Zone-level ${bedroomLabelFromKey(unitBedKey)} proxy (${mappedZone} x ${((RENOVATION_UPLIFT - 1) * 100).toFixed(0)}% uplift)`,
        };
        renovatedRentCache.set(bedroomCount, result);
        return result;
      }
    }

    const result = {
      value: Math.round(currentRentValue * RENOVATION_UPLIFT),
      source: "market_benchmark" as const,
      label: `Newer-stock proxy (current market x ${((RENOVATION_UPLIFT - 1) * 100).toFixed(0)}% uplift)`,
    };
    renovatedRentCache.set(bedroomCount, result);
    return result;
  };

  const shouldRenderUnitSchedule = normalizedUnits > 1 && normalizedUnits <= 12;
  const unitBedroomCounts: number[] =
    parsedBedroomMix && parsedBedroomMix.bedroomsPerUnit.length === normalizedUnits
      ? parsedBedroomMix.bedroomsPerUnit
      : shouldRenderUnitSchedule
        ? Array.from({ length: normalizedUnits }, () => bedroomCountFromKey(bedKey))
        : [];

  const unitRentBenchmarks: UnitRentBenchmark[] =
    unitBedroomCounts.length > 1
      ? await Promise.all(
          unitBedroomCounts.map(async (unitBedrooms, index) => {
            const currentRent = await buildCurrentRentForBedroom(unitBedrooms);
            const turnoverRent = await buildTurnoverRentForBedroom(unitBedrooms);
            const renovatedRent = await buildRenovatedRentForBedroom(unitBedrooms, currentRent.value);
            const modeledRentValue =
              currentRent.value > 0 && renovatedRent.value > 0
                ? Math.round((currentRent.value + renovatedRent.value) / 2)
                : Math.round(Math.max(currentRent.value, renovatedRent.value, 0));

            return {
              unitNumber: index + 1,
              unitLabel: `Unit ${index + 1}`,
              bedrooms: unitBedrooms,
              bedroomLabel:
                bedKey === "total" ? "Unit size unknown" : unitBedrooms === 0 ? "Studio" : `${unitBedrooms} BR`,
              currentMarketRent: toAssumptionValue(currentRent.value, currentRent.source, currentRent.label),
              turnoverMarketRent: toAssumptionValue(turnoverRent.value, turnoverRent.source, turnoverRent.label),
              renovatedRentProxy: toAssumptionValue(renovatedRent.value, renovatedRent.source, renovatedRent.label),
              modeledMarketRent: toAssumptionValue(
                modeledRentValue,
                "market_benchmark",
                `Average of ${currentRent.label} and ${renovatedRent.label}.`
              ),
            };
          })
        )
      : [];

  const benchmarkConfidence: DataConfidence = mappedZone ? "high" : "medium";

  return {
    mappedMarketCity: mappedCity,
    mappedZone: mappedZone ?? null,
    zoneMatchMethod,
    benchmarkVacancyRate,
    benchmarkVacancyProvenance,
    benchmarkVacancyLabel,
    benchmarkCurrentRent,
    benchmarkCurrentRentProvenance,
    benchmarkCurrentRentLabel,
    benchmarkTurnoverRent,
    benchmarkTurnoverRentProvenance,
    benchmarkTurnoverRentLabel,
    benchmarkRenovatedRentProxy,
    benchmarkRenovatedRentProvenance,
    benchmarkRenovatedRentLabel,
    benchmarkRentGrowthRateAnnual,
    benchmarkRentGrowthProvenance,
    benchmarkRentGrowthLabel,
    benchmarkAssetClass:
      normalizedAssetType === "apartment" || normalizedAssetType === "mixed_use" || normalizedUnits >= 5
        ? "apartment"
        : "small_residential_proxy",
    benchmarkBedroomBasis: bedBasis.label,
    benchmarkStructureSizeBasis: structureSizeBasis,
    benchmarkYearBuiltBasis: yearBuiltBasis,
    benchmarkSourceYear: 2025,
    benchmarkConfidence,
    unitRentBenchmarks,
  };
}

export function getRentGrowthForCity(city: string): number {
  return getCmhcRentGrowth(city);
}
