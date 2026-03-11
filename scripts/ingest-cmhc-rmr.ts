/**
 * Ingest CMHC Rent Market Report Excel workbooks into MarketMetric.
 * Run: npx tsx scripts/ingest-cmhc-rmr.ts [directory]
 * Default directory: ~/Downloads (looks for rmr-*-2025-en.xlsx)
 */

import "dotenv/config";
import * as XLSX from "xlsx";
import * as path from "path";
import * as fs from "fs";
import { PrismaClient } from "@prisma/client";
import { CMA_PROVINCES } from "../src/lib/cmhc-zone";

const prisma = new PrismaClient();
const SURVEY_YEAR = 2025;
const PARSER_VERSION = "1";

const WORKBOOK_TO_CITY: Record<string, string> = {
  "rmr-toronto-2025-en": "Toronto",
  "rmr-montreal-2025-en": "Montreal",
  "rmr-hamilton-2025-en": "Hamilton",
  "rmr-calgary-2025-en": "Calgary",
  "rmr-edmonton-2025-en": "Edmonton",
  "rmr-regina-2025-en": "Regina",
  "rmr-saskatoon-2025-en": "Saskatoon",
  "rmr-winnipeg-2025-en": "Winnipeg",
  "rmr-halifax-2025-en": "Halifax",
  "rmr-quebec-cma-2025-en": "Quebec City",
  "rmr-gatineau-2025-en": "Gatineau",
  "rmr-vancouver-2025-en": "Vancouver",
  "rmr-victoria-2025-en": "Victoria",
  "rmr-ottawa-2025-en": "Ottawa",
  "rmr-kitchener-cambridge-waterloo-2025-en": "Kitchener",
  "rmr-london-2025-en": "London",
  "rmr-st-catharines-niagara-2025-en": "St. Catharines",
  "rmr-windsor-2025-en": "Windsor",
};

const BEDROOM_COLS = [
  { key: "studio", label: "Studio" },
  { key: "1_bed", label: "1 Bedroom" },
  { key: "2_bed", label: "2 Bedroom" },
  { key: "3_bed_plus", label: "3 Bedroom +" },
  { key: "total", label: "Total" },
];

const STRUCTURE_SIZE_MAP: Record<string, string> = {
  "3 to 5 units": "3_to_5",
  "6 to 19 units": "6_to_19",
  "20 to 49 units": "20_to_49",
  "50 to 99 units": "50_to_99",
  "100 to 199 units": "100_to_199",
  "200+ units": "200_plus",
  "100+ units": "100_plus",
};

const YEAR_BUILT_MAP: Record<string, string> = {
  "pre 1940": "pre_1940",
  "1940 - 1959": "1940_1959",
  "pre 1960": "1940_1959",
  "1960 - 1974": "1960_1974",
  "1975 - 1989": "1975_1989",
  "1990 - 2004": "1990_2004",
  "2005 - 2014": "2005_2014",
  "2015+": "2015_plus",
};

type SheetSection = {
  label: string;
  zoneCodes: string[];
  rowIndex: number;
};

function parseValue(cell: unknown): { value: number | null; quality: string | null; suppressed: boolean } {
  if (cell == null || cell === "") return { value: null, quality: null, suppressed: false };
  const s = String(cell).trim();
  if (s === "**" || s === "++") return { value: null, quality: null, suppressed: true };
  const num = parseFloat(s.replace(/,/g, ""));
  if (!Number.isNaN(num)) return { value: num, quality: null, suppressed: false };
  if (/^[a-d]$/i.test(s)) return { value: null, quality: s.toLowerCase(), suppressed: false };
  return { value: null, quality: null, suppressed: false };
}

function extractZoneCode(zoneLabel: string): string | null {
  const m = zoneLabel.match(/^Zone\s+(\d+)\s*-/i);
  return m ? m[1]! : null;
}

function parseZoneCodesFromSectionLabel(label: string): string[] {
  const match = label.match(/\(Zones?\s+([^)]+)\)/i);
  if (!match) return [];
  const zoneCodes = new Set<string>();
  for (const rawPart of match[1]!.split(",")) {
    const part = rawPart.trim();
    const rangeMatch = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1]!, 10);
      const end = parseInt(rangeMatch[2]!, 10);
      for (let zone = start; zone <= end; zone++) zoneCodes.add(String(zone));
      continue;
    }
    const singleMatch = part.match(/^(\d+)$/);
    if (singleMatch) zoneCodes.add(singleMatch[1]!);
  }
  return Array.from(zoneCodes).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
}

function collectSheetSections(rows: unknown[][], startRow = 6): SheetSection[] {
  const sections: SheetSection[] = [];
  for (let r = startRow; r < rows.length; r++) {
    const label = String(rows[r]?.[0] ?? "").trim();
    if (!label || !/\(Zones?\s+/i.test(label)) continue;
    const zoneCodes = parseZoneCodesFromSectionLabel(label);
    if (!zoneCodes.length) continue;
    sections.push({ label, zoneCodes, rowIndex: r });
  }
  return sections;
}

function buildZoneSectionAssignments(sections: SheetSection[]): Map<number, Set<string>> {
  const minimumCoverage = new Map<string, number>();
  for (const section of sections) {
    for (const zoneCode of section.zoneCodes) {
      const currentMin = minimumCoverage.get(zoneCode);
      if (currentMin == null || section.zoneCodes.length < currentMin) {
        minimumCoverage.set(zoneCode, section.zoneCodes.length);
      }
    }
  }

  const assignments = new Map<number, Set<string>>();
  for (const section of sections) {
    for (const zoneCode of section.zoneCodes) {
      if (minimumCoverage.get(zoneCode) !== section.zoneCodes.length) continue;
      const assigned = assignments.get(section.rowIndex) ?? new Set<string>();
      assigned.add(zoneCode);
      assignments.set(section.rowIndex, assigned);
    }
  }
  return assignments;
}

function getTrendTableBedroomColumnIndices(): { bedroom: string; valueCol: number; qualityCol: number }[] {
  return BEDROOM_COLS.map((b, i) => ({
    bedroom: b.key,
    valueCol: 1 + i * 5 + 2,
    qualityCol: 1 + i * 5 + 3,
  }));
}

function getPairedTableBedroomColumnIndices(): { bedroom: string; valueCol: number; qualityCol: number }[] {
  return BEDROOM_COLS.map((b, i) => ({
    bedroom: b.key,
    valueCol: 1 + i * 4 + 2,
    qualityCol: 1 + i * 4 + 3,
  }));
}

async function ingestZoneBedroomTable(
  prisma: PrismaClient,
  marketCityId: string,
  zoneByLabel: Map<string, string>,
  sheetName: string,
  rows: unknown[][],
  metricType: string,
  surveyYear: number,
  colMap: { bedroom: string; valueCol: number; qualityCol: number }[]
) {
  let count = 0;
  for (let r = 6; r < rows.length; r++) {
    const row = rows[r] as unknown[];
    const zoneLabel = String(row[0] ?? "").trim();
    if (!zoneLabel || !zoneLabel.startsWith("Zone ") || zoneLabel.includes("(Zones") || zoneLabel.includes("Former") || zoneLabel.includes("Rest of") || zoneLabel === "Total") continue;
    const zoneId = zoneByLabel.get(zoneLabel);
    if (!zoneId) continue;
    for (const { bedroom, valueCol, qualityCol } of colMap) {
      const rawVal = row[valueCol];
      const rawQual = row[qualityCol];
      const { value, quality, suppressed } = parseValue(rawVal);
      if (quality && value == null && !suppressed) continue;
      let storedValue: number | null = suppressed ? null : value;
      if (storedValue != null && (metricType === "vacancy_rate" || metricType === "turnover_rate")) {
        storedValue = storedValue / 100;
      }
      await prisma.marketMetric.create({
        data: {
          marketCityId,
          zoneId,
          metricType,
          assetClass: "apartment",
          bedroomType: bedroom,
          value: storedValue ?? undefined,
          surveyYear,
          sourceSheet: sheetName,
          sourceTable: sheetName,
          qualityFlag: quality ?? undefined,
          suppressionFlag: suppressed,
        },
      });
      count++;
    }
  }
  return count;
}

async function ingestZoneVacantOccupiedRentTable(
  prisma: PrismaClient,
  marketCityId: string,
  zoneByLabel: Map<string, string>,
  sheetName: string,
  rows: unknown[][],
  surveyYear: number
) {
  let count = 0;
  for (let r = 7; r < rows.length; r++) {
    const row = rows[r] as unknown[];
    const zoneLabel = String(row[0] ?? "").trim();
    if (!zoneLabel || !zoneLabel.startsWith("Zone ")) continue;
    const zoneId = zoneByLabel.get(zoneLabel);
    if (!zoneId) continue;

    for (let i = 0; i < BEDROOM_COLS.length; i++) {
      const bedroomType = BEDROOM_COLS[i]!.key;
      const baseCol = 1 + i * 5;
      const vacant = parseValue(row[baseCol]);
      const occupied = parseValue(row[baseCol + 2]);

      if (!(vacant.quality && vacant.value == null && !vacant.suppressed)) {
        await prisma.marketMetric.create({
          data: {
            marketCityId,
            zoneId,
            metricType: "vacant_rent",
            assetClass: "apartment",
            bedroomType,
            value: vacant.suppressed ? undefined : vacant.value ?? undefined,
            surveyYear,
            sourceSheet: sheetName,
            sourceTable: sheetName,
            qualityFlag: vacant.quality ?? undefined,
            suppressionFlag: vacant.suppressed,
          },
        });
        count++;
      }

      if (!(occupied.quality && occupied.value == null && !occupied.suppressed)) {
        await prisma.marketMetric.create({
          data: {
            marketCityId,
            zoneId,
            metricType: "occupied_rent",
            assetClass: "apartment",
            bedroomType,
            value: occupied.suppressed ? undefined : occupied.value ?? undefined,
            surveyYear,
            sourceSheet: sheetName,
            sourceTable: sheetName,
            qualityFlag: occupied.quality ?? undefined,
            suppressionFlag: occupied.suppressed,
          },
        });
        count++;
      }
    }
  }
  return count;
}

async function ingestYearBuiltTable(
  prisma: PrismaClient,
  marketCityId: string,
  zoneByCode: Map<string, string>,
  sheetName: string,
  rows: unknown[][],
  metricType: string,
  surveyYear: number
) {
  const colMap = metricType === "average_rent" ? getPairedTableBedroomColumnIndices() : getTrendTableBedroomColumnIndices();
  const sections = collectSheetSections(rows);
  const sectionAssignments = buildZoneSectionAssignments(sections);
  let activeZoneIds: string[] | null = null;
  let count = 0;
  for (let r = 6; r < rows.length; r++) {
    const row = rows[r] as unknown[];
    const label = String(row[0] ?? "").trim();
    if (sectionAssignments.has(r)) {
      activeZoneIds = Array.from(sectionAssignments.get(r) ?? [])
        .map((zoneCode) => zoneByCode.get(zoneCode))
        .filter((value): value is string => Boolean(value));
      continue;
    }
    const yb = Object.keys(YEAR_BUILT_MAP).find((k) => label.toLowerCase().includes(k.toLowerCase()));
    if (!yb) continue;
    const yearBuiltBucket = YEAR_BUILT_MAP[yb];
    for (const { bedroom, valueCol } of colMap) {
      const rawVal = row[valueCol];
      const { value, quality, suppressed } = parseValue(rawVal);
      if (quality && value == null && !suppressed) continue;
      let storedValue: number | null = suppressed ? null : value;
      if (storedValue != null && (metricType === "vacancy_rate" || metricType === "turnover_rate")) {
        storedValue = storedValue / 100;
      }
      const targetZoneIds = activeZoneIds?.length ? activeZoneIds : [null];
      for (const zoneId of targetZoneIds) {
        await prisma.marketMetric.create({
          data: {
            marketCityId,
            zoneId,
            metricType,
            assetClass: "apartment",
            bedroomType: bedroom,
            yearBuiltBucket,
            value: storedValue ?? undefined,
            surveyYear,
            sourceSheet: sheetName,
            sourceTable: sheetName,
            qualityFlag: quality ?? undefined,
            suppressionFlag: suppressed,
          },
        });
        count++;
      }
    }
  }
  return count;
}

async function ingestStructureSizeTable(
  prisma: PrismaClient,
  marketCityId: string,
  zoneByCode: Map<string, string>,
  sheetName: string,
  rows: unknown[][],
  metricType: string,
  surveyYear: number
) {
  const colMap = metricType === "average_rent" ? getPairedTableBedroomColumnIndices() : getTrendTableBedroomColumnIndices();
  const sections = collectSheetSections(rows);
  const sectionAssignments = buildZoneSectionAssignments(sections);
  let activeZoneIds: string[] | null = null;
  let count = 0;
  for (let r = 6; r < rows.length; r++) {
    const row = rows[r] as unknown[];
    const label = String(row[0] ?? "").trim();
    if (sectionAssignments.has(r)) {
      activeZoneIds = Array.from(sectionAssignments.get(r) ?? [])
        .map((zoneCode) => zoneByCode.get(zoneCode))
        .filter((value): value is string => Boolean(value));
      continue;
    }
    const sz = Object.keys(STRUCTURE_SIZE_MAP).find((k) => label.toLowerCase().includes(k.toLowerCase()));
    if (!sz || label === "Total") continue;
    const structureSizeBucket = STRUCTURE_SIZE_MAP[sz];
    for (const { bedroom, valueCol } of colMap) {
      const rawVal = row[valueCol];
      const { value, quality, suppressed } = parseValue(rawVal);
      if (quality && value == null && !suppressed) continue;
      let storedValue: number | null = suppressed ? null : value;
      if (storedValue != null && (metricType === "vacancy_rate" || metricType === "turnover_rate")) {
        storedValue = storedValue / 100;
      }
      const targetZoneIds = activeZoneIds?.length ? activeZoneIds : [null];
      for (const zoneId of targetZoneIds) {
        await prisma.marketMetric.create({
          data: {
            marketCityId,
            zoneId,
            metricType,
            assetClass: "apartment",
            bedroomType: bedroom,
            structureSizeBucket,
            value: storedValue ?? undefined,
            surveyYear,
            sourceSheet: sheetName,
            sourceTable: sheetName,
            qualityFlag: quality ?? undefined,
            suppressionFlag: suppressed,
          },
        });
        count++;
      }
    }
  }
  return count;
}

async function ingestZoneStructureSizeTable(
  prisma: PrismaClient,
  marketCityId: string,
  zoneByLabel: Map<string, string>,
  sheetName: string,
  rows: unknown[][],
  metricType: string,
  surveyYear: number
) {
  const sizeCols = [
    { bucket: "3_to_5", valueCol: 3, qualityCol: 4 },
    { bucket: "6_to_19", valueCol: 8, qualityCol: 9 },
    { bucket: "20_to_49", valueCol: 13, qualityCol: 14 },
    { bucket: "50_to_99", valueCol: 18, qualityCol: 19 },
    { bucket: "100_plus", valueCol: 23, qualityCol: 24 },
    { bucket: "100_plus", valueCol: 28, qualityCol: 29 },
  ];

  let count = 0;
  for (let r = 6; r < rows.length; r++) {
    const row = rows[r] as unknown[];
    const zoneLabel = String(row[0] ?? "").trim();
    if (!zoneLabel || !zoneLabel.startsWith("Zone ")) continue;
    const zoneId = zoneByLabel.get(zoneLabel);
    if (!zoneId) continue;

    for (const { bucket, valueCol, qualityCol } of sizeCols) {
      const { value, quality, suppressed } = parseValue(row[valueCol]);
      if (quality && value == null && !suppressed) continue;
      let storedValue: number | null = suppressed ? null : value;
      if (storedValue != null && (metricType === "vacancy_rate" || metricType === "turnover_rate")) {
        storedValue = storedValue / 100;
      }
      await prisma.marketMetric.create({
        data: {
          marketCityId,
          zoneId,
          metricType,
          assetClass: "apartment",
          bedroomType: "total",
          structureSizeBucket: bucket,
          value: storedValue ?? undefined,
          surveyYear,
          sourceSheet: sheetName,
          sourceTable: sheetName,
          qualityFlag: quality ?? undefined,
          suppressionFlag: suppressed,
        },
      });
      count++;
    }
  }

  return count;
}

async function processWorkbook(filePath: string) {
  const base = path.basename(filePath, ".xlsx");
  const city = WORKBOOK_TO_CITY[base];
  if (!city) {
    console.log(`Skip ${base}: unknown city`);
    return;
  }
  const province = CMA_PROVINCES[city] ?? "ON";
  const marketCity = await prisma.marketCity.upsert({
    where: { city_province: { city, province } },
    create: { city, province, normalizedCityName: city, cmhcMarketName: `${city} (CMA)`, datasetYear: SURVEY_YEAR },
    update: { datasetYear: SURVEY_YEAR },
  });

  await prisma.marketMetric.deleteMany({ where: { marketCityId: marketCity.id, surveyYear: SURVEY_YEAR } });

  await prisma.marketMetricSource.create({
    data: {
      workbookFile: path.basename(filePath),
      worksheetName: "multiple",
      city,
      parserVersion: PARSER_VERSION,
    },
  });

  const workbook = XLSX.readFile(filePath);
  const zoneByLabel = new Map<string, string>();
  const zoneByCode = new Map<string, string>();

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

    if (sheetName === "Table 1.1.1") {
      for (let r = 6; r < Math.min(60, rows.length); r++) {
        const row = rows[r] as unknown[];
        const zoneLabel = String(row[0] ?? "").trim();
        if (zoneLabel.startsWith("Zone ") && zoneLabel.includes(" - ") && !zoneLabel.includes("(Zones")) {
          const code = extractZoneCode(zoneLabel);
          if (code) {
            const zone = await prisma.marketZone.upsert({
              where: { marketCityId_zoneCode: { marketCityId: marketCity.id, zoneCode: code } },
              create: { marketCityId: marketCity.id, zoneCode: code, zoneLabel, zoneDisplayName: zoneLabel, zoneOrder: parseInt(code, 10) || 0 },
              update: { zoneLabel, zoneDisplayName: zoneLabel },
            });
            zoneByLabel.set(zoneLabel, zone.id);
            zoneByCode.set(code, zone.id);
          }
        }
      }
    }
  }

  let totalMetrics = 0;
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

    if (sheetName === "Table 1.1.1") {
      totalMetrics += await ingestZoneBedroomTable(
        prisma,
        marketCity.id,
        zoneByLabel,
        sheetName,
        rows,
        "vacancy_rate",
        SURVEY_YEAR,
        getTrendTableBedroomColumnIndices()
      );
    } else if (sheetName === "Table 1.1.2") {
      totalMetrics += await ingestZoneBedroomTable(
        prisma,
        marketCity.id,
        zoneByLabel,
        sheetName,
        rows,
        "average_rent",
        SURVEY_YEAR,
        getPairedTableBedroomColumnIndices()
      );
    } else if (sheetName === "Table 1.1.9") {
      totalMetrics += await ingestZoneVacantOccupiedRentTable(prisma, marketCity.id, zoneByLabel, sheetName, rows, SURVEY_YEAR);
    } else if (sheetName === "Table 1.1.5") {
      totalMetrics += await ingestZoneBedroomTable(
        prisma,
        marketCity.id,
        zoneByLabel,
        sheetName,
        rows,
        "rent_change_pct",
        SURVEY_YEAR,
        getPairedTableBedroomColumnIndices()
      );
    } else if (sheetName === "Table 1.1.6") {
      totalMetrics += await ingestZoneBedroomTable(
        prisma,
        marketCity.id,
        zoneByLabel,
        sheetName,
        rows,
        "turnover_rate",
        SURVEY_YEAR,
        getTrendTableBedroomColumnIndices()
      );
    } else if (sheetName === "Table 1.2.1") {
      totalMetrics += await ingestYearBuiltTable(prisma, marketCity.id, zoneByCode, sheetName, rows, "vacancy_rate", SURVEY_YEAR);
    } else if (sheetName === "Table 1.2.2") {
      totalMetrics += await ingestYearBuiltTable(prisma, marketCity.id, zoneByCode, sheetName, rows, "average_rent", SURVEY_YEAR);
    } else if (sheetName === "Table 1.3.1") {
      totalMetrics += await ingestStructureSizeTable(prisma, marketCity.id, zoneByCode, sheetName, rows, "vacancy_rate", SURVEY_YEAR);
    } else if (sheetName === "Table 1.3.2") {
      totalMetrics += await ingestStructureSizeTable(prisma, marketCity.id, zoneByCode, sheetName, rows, "average_rent", SURVEY_YEAR);
    } else if (sheetName === "Table 1.3.3") {
      totalMetrics += await ingestZoneStructureSizeTable(prisma, marketCity.id, zoneByLabel, sheetName, rows, "vacancy_rate", SURVEY_YEAR);
    }
  }

  console.log(`${city}: ${zoneByLabel.size} zones, ${totalMetrics} metrics`);
}

async function main() {
  const dir = process.argv[2] || path.join(process.env.HOME || "", "Downloads");
  const files = fs.readdirSync(dir).filter((f) => f.startsWith("rmr-") && f.endsWith("-2025-en.xlsx"));
  if (files.length === 0) {
    console.log(`No rmr-*-2025-en.xlsx files in ${dir}`);
    return;
  }
  console.log(`Found ${files.length} workbooks in ${dir}`);
  for (const f of files) {
    const fp = path.join(dir, f);
    try {
      await processWorkbook(fp);
    } catch (e) {
      console.error(`Error processing ${f}:`, e);
    }
  }
  console.log("Done.");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
