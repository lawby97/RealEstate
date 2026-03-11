/**
 * Load postal code → zone mappings from CSV into MarketPostalZoneMap.
 * Use this to improve accuracy: add exact (6-char) or FSA (3-char) mappings per city.
 *
 * CSV format (header required):
 *   city,province,postal_or_fsa,zone_code,is_exact
 *   Toronto,ON,M5V1A1,3,1
 *   Toronto,ON,M5V,3,0
 *
 * - city: CMA name (e.g. Toronto, Montreal)
 * - province: ON, QC, BC, etc.
 * - postal_or_fsa: full postal (e.g. M5V1A1) or FSA (e.g. M5V). Normalized to lowercase, no spaces.
 * - zone_code: CMHC zone number as string (1, 2, 3, ...)
 * - is_exact: 1 or true = full postal code match; 0 or false = FSA match
 *
 * Run: npx tsx scripts/load-postal-zone-map.ts path/to/mappings.csv
 *
 * Data sources you can use to build the CSV:
 * - Statistics Canada PCCF/PCCF+ (postal → census tract; then map CT to CMHC zone if you have zone definitions)
 * - Municipal or real estate neighbourhood guides that list postal areas by zone
 * - Manual research from CMHC RMR zone descriptions
 */

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function normalizePostal(s: string): string {
  return s.replace(/\s/g, "").toLowerCase().trim();
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath || !fs.existsSync(csvPath)) {
    console.error("Usage: npx tsx scripts/load-postal-zone-map.ts <path/to/mappings.csv>");
    process.exit(1);
  }

  const content = fs.readFileSync(csvPath, "utf-8");
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    console.error("CSV must have header + at least one row.");
    process.exit(1);
  }

  const headerCols = lines[0]!.toLowerCase().split(",").map((c) => c.trim());
  const cityIdx = headerCols.indexOf("city");
  const provIdx = headerCols.indexOf("province");
  const postalIdx = headerCols.indexOf("postal_or_fsa");
  const zoneIdx = headerCols.indexOf("zone_code");
  const exactIdx = headerCols.indexOf("is_exact");

  if ([cityIdx, provIdx, postalIdx, zoneIdx, exactIdx].some((i) => i === -1)) {
    console.error("CSV must have columns: city, province, postal_or_fsa, zone_code, is_exact. Got:", headerCols);
    process.exit(1);
  }

  const rows = lines.slice(1);
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const line of rows) {
    const cols = line.split(",").map((c) => c.trim());
    const city = cols[cityIdx];
    const province = cols[provIdx];
    const postalOrFsa = normalizePostal(cols[postalIdx] ?? "");
    const zoneCode = String(cols[zoneIdx] ?? "").trim();
    const isExact = /^(1|true|yes)$/i.test(String(cols[exactIdx] ?? "0"));

    if (!city || !province || !postalOrFsa || !zoneCode) {
      skipped++;
      continue;
    }

    const marketCity = await prisma.marketCity.findUnique({
      where: { city_province: { city, province } },
    });
    if (!marketCity) {
      console.warn(`Unknown city: ${city}, ${province} (run seed:market and ingest:cmhc first)`);
      skipped++;
      continue;
    }

    const marketZone = await prisma.marketZone.findFirst({
      where: { marketCityId: marketCity.id, zoneCode },
    });
    if (!marketZone) {
      console.warn(`Unknown zone code "${zoneCode}" for ${city} (zones come from RMR ingestion)`);
      skipped++;
      continue;
    }

    const postalFsa = postalOrFsa.slice(0, 3);
    const postalCode = isExact && postalOrFsa.length >= 6 ? postalOrFsa : null;

    const existing = await prisma.marketPostalZoneMap.findFirst({
      where: {
        marketCityId: marketCity.id,
        ...(postalCode ? { postalCode, isExact: true } : { postalFsa, isExact: false }),
      },
    });

    if (existing) {
      await prisma.marketPostalZoneMap.update({
        where: { id: existing.id },
        data: { zoneId: marketZone.id, postalFsa, postalCode, isExact },
      });
      updated++;
    } else {
      await prisma.marketPostalZoneMap.create({
        data: {
          marketCityId: marketCity.id,
          postalFsa,
          postalCode,
          zoneId: marketZone.id,
          confidence: isExact ? 1 : 0.9,
          source: "imported",
          isExact,
        },
      });
      created++;
    }
  }

  console.log(`Done. Created ${created}, updated ${updated}, skipped ${skipped}.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
