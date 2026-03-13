import { prisma } from "@/lib/prisma";
import { syncListingDerivedState } from "@/lib/listing-sync";

async function main() {
  const rows = await prisma.listing.findMany({
    select: { id: true },
    orderBy: { updatedAt: "desc" },
  });

  let updated = 0;
  let failed = 0;
  let deduped = 0;

  for (const row of rows) {
    try {
      const result = await syncListingDerivedState(row.id);
      updated += 1;
      if (result.duplicateOfListingId) deduped += 1;
    } catch (error) {
      failed += 1;
      console.error(`[recompute-listing-evaluations] ${row.id}`, error);
    }
  }

  console.log(JSON.stringify({ processed: rows.length, updated, deduped, failed }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
