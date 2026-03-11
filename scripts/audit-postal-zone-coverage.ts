/**
 * Audit postal-code to CMHC-zone coverage for currently ingested listings.
 * Run: npm run audit:postal-zones
 */

import { prisma } from "../src/lib/prisma";
import { resolveMarketZone } from "../src/lib/market-metrics-db";

function normalizePostal(postalCode: string | null | undefined): string | null {
  if (!postalCode) return null;
  const cleaned = postalCode.replace(/\s/g, "").toUpperCase();
  return cleaned.length >= 3 ? cleaned : null;
}

async function main() {
  const listings = await prisma.listing.findMany({
    select: { id: true, city: true, province: true, postalCode: true, address: true },
  });

  const keyed = new Map<string, { city: string; province: string; postalCode: string; count: number }>();
  for (const row of listings) {
    const normalized = normalizePostal(row.postalCode);
    if (!normalized) continue;
    const key = `${row.city}|${row.province}|${normalized}`;
    const existing = keyed.get(key);
    if (existing) existing.count += 1;
    else keyed.set(key, { city: row.city, province: row.province, postalCode: normalized, count: 1 });
  }

  const all = Array.from(keyed.values());
  let mappedZone = 0;
  let cityFallback = 0;
  const missesByCity = new Map<string, number>();
  const details: Array<{ city: string; province: string; postalCode: string; method: string; zone: string | null; count: number }> = [];

  for (const entry of all) {
    const resolved = await resolveMarketZone({
      city: entry.city,
      province: entry.province,
      postalCode: entry.postalCode,
    });
    const method = resolved?.zoneMatchMethod ?? "unresolved";
    const zoneId = resolved?.marketZoneId ?? null;
    if (zoneId) mappedZone += 1;
    else {
      cityFallback += 1;
      missesByCity.set(entry.city, (missesByCity.get(entry.city) ?? 0) + 1);
    }
    details.push({
      city: entry.city,
      province: entry.province,
      postalCode: entry.postalCode,
      method,
      zone: zoneId,
      count: entry.count,
    });
  }

  console.log("Postal-zone coverage audit");
  console.log("==========================");
  console.log(`Unique postals in listings: ${all.length}`);
  console.log(`Mapped to zone: ${mappedZone}`);
  console.log(`City-level fallback (no zone): ${cityFallback}`);
  console.log("");

  if (missesByCity.size > 0) {
    console.log("Missing zone matches by city:");
    Array.from(missesByCity.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([city, count]) => console.log(`- ${city}: ${count}`));
    console.log("");
  }

  console.log("Per-postal details:");
  details
    .sort((a, b) => a.city.localeCompare(b.city) || a.postalCode.localeCompare(b.postalCode))
    .forEach((d) => {
      const zoneState = d.zone ? "zone-mapped" : "city-fallback";
      console.log(`- ${d.city}, ${d.province}, ${d.postalCode}: ${zoneState} (${d.method}), listings=${d.count}`);
    });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
