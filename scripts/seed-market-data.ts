/**
 * Seed MarketCity, MarketZone, and MarketPostalZoneMap from static FSA/zone data.
 * Run: npx tsx scripts/seed-market-data.ts
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { CMA_PROVINCES, FSA_TO_ZONE_FOR_SEED } from "../src/lib/cmhc-zone";

const prisma = new PrismaClient();

function zoneLabelToCode(label: string): string {
  const m = label.match(/^Zone\s+(\d+)/i);
  return m ? m[1]! : label.replace(/\s+/g, "_").slice(0, 20);
}

async function main() {
  const cities = Object.keys(CMA_PROVINCES);
  for (const city of cities) {
    const province = CMA_PROVINCES[city]!;
    const normalizedCityName = city;
    const marketCity = await prisma.marketCity.upsert({
      where: { city_province: { city, province } },
      create: { city, province, normalizedCityName, cmhcMarketName: `${city} (CMA)`, datasetYear: 2025 },
      update: { normalizedCityName, cmhcMarketName: `${city} (CMA)`, datasetYear: 2025 },
    });
    console.log(`MarketCity: ${marketCity.city}, ${marketCity.province} (${marketCity.id})`);

    const zoneMap = FSA_TO_ZONE_FOR_SEED[city];
    if (zoneMap) {
      const zoneLabels = Array.from(new Set(Object.values(zoneMap)));
      const zoneIdByLabel: Record<string, string> = {};
      let zoneOrder = 0;
      for (const zoneLabel of zoneLabels) {
        const zoneCode = zoneLabelToCode(zoneLabel);
        const zone = await prisma.marketZone.upsert({
          where: { marketCityId_zoneCode: { marketCityId: marketCity.id, zoneCode } },
          create: { marketCityId: marketCity.id, zoneCode, zoneLabel, zoneDisplayName: zoneLabel, zoneOrder: zoneOrder++ },
          update: { zoneLabel, zoneDisplayName: zoneLabel, zoneOrder: zoneOrder++ },
        });
        zoneIdByLabel[zoneLabel] = zone.id;
      }
      for (const [fsa, zoneLabel] of Object.entries(zoneMap)) {
        const zoneId = zoneIdByLabel[zoneLabel];
        if (zoneId) {
          const existing = await prisma.marketPostalZoneMap.findFirst({
            where: { marketCityId: marketCity.id, postalFsa: fsa },
          });
          if (!existing) {
            await prisma.marketPostalZoneMap.create({
              data: {
                marketCityId: marketCity.id,
                postalFsa: fsa,
                zoneId,
                confidence: 0.9,
                source: "manual",
                isExact: false,
              },
            });
          }
        }
      }
      console.log(`  Zones: ${zoneLabels.length}, FSAs: ${Object.keys(zoneMap).length}`);
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
