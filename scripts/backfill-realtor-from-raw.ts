/**
 * Re-map already-ingested realtor_ca listings from stored rawJson and update fields.
 *
 * Usage:
 *   npx tsx scripts/backfill-realtor-from-raw.ts --limit=50
 */

import { prisma } from "@/lib/prisma";
import { evaluateListing } from "@/lib/evaluation";
import { mapRealtorCaListing } from "@/lib/realtor-ca-api";

function parseArg(name: string, fallback: string): string {
  const entry = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return entry ? entry.split("=").slice(1).join("=") : fallback;
}

async function main() {
  const limit = Math.max(1, Number.parseInt(parseArg("limit", "50"), 10) || 50);
  const source = parseArg("source", "realtor_ca");

  const rows = await prisma.listing.findMany({
    where: { source },
    orderBy: { lastSeenAt: "desc" },
    take: limit,
    select: { id: true, rawJson: true },
  });

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    try {
      if (!row.rawJson) {
        skipped += 1;
        continue;
      }
      const raw = JSON.parse(row.rawJson);
      const mapped = mapRealtorCaListing(raw);

      const listing = await prisma.listing.update({
        where: { id: row.id },
        data: {
          price: mapped.price,
          address: mapped.address,
          city: mapped.city,
          province: mapped.province,
          propertyType: mapped.propertyType,
          units: mapped.units,
          postalCode: mapped.postalCode,
          latitude: mapped.latitude,
          longitude: mapped.longitude,
          bedrooms: mapped.bedrooms,
          bathrooms: mapped.bathrooms,
          squareFeet: mapped.squareFeet,
          lotSizeSqFt: mapped.lotSizeSqFt,
          yearBuilt: mapped.yearBuilt,
          description: mapped.description,
          photoUrls: mapped.photoUrls,
          listingUrl: mapped.listingUrl,
          rawJson: mapped.rawJson,
          lastSeenAt: new Date(),
          isLinkActive: null,
          linkCheckedAt: null,
          linkStatusCode: null,
          linkStatusNote: null,
        },
      });

      const result = evaluateListing({
        price: listing.price,
        city: listing.city,
        province: listing.province,
        postalCode: listing.postalCode,
        units: listing.units,
        bedrooms: listing.bedrooms,
      });

      await prisma.listingEvaluation.upsert({
        where: { listingId: listing.id },
        create: {
          listingId: listing.id,
          cashflowScore: result.cashflowScore,
          equityGrowthScore: result.equityGrowthScore,
          combinedScore: result.combinedScore,
          cashflowNotes: result.cashflowNotes,
          equityNotes: result.equityNotes,
        },
        update: {
          cashflowScore: result.cashflowScore,
          equityGrowthScore: result.equityGrowthScore,
          combinedScore: result.combinedScore,
          cashflowNotes: result.cashflowNotes,
          equityNotes: result.equityNotes,
          computedAt: new Date(),
        },
      });

      updated += 1;
    } catch {
      skipped += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        source,
        processed: rows.length,
        updated,
        skipped,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
