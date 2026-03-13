/**
 * Re-map already-ingested realtor_ca listings from stored rawJson and update fields.
 *
 * Usage:
 *   npx tsx scripts/backfill-realtor-from-raw.ts --limit=50
 */

import { prisma } from "@/lib/prisma";
import { mapRealtorCaListing } from "@/lib/realtor-ca-api";
import { mapCentrisListing } from "@/lib/centris-api";
import { upsertMappedListing } from "@/lib/listing-sync";

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
      const mapped =
        source === "centris_ca"
          ? mapCentrisListing(raw)
          : mapRealtorCaListing(raw);
      await upsertMappedListing(mapped);

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
