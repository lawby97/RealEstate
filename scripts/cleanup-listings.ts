/**
 * Force a cleanup pass across the current listing inventory.
 *
 * Retires placeholder/example rows immediately, then force-refreshes all
 * remaining active listings so stale rows can move to sold/unavailable.
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import {
  markPlaceholderListingsUnavailable,
  refreshListingActivityCache,
} from "@/lib/listing-activity";

config({ path: resolve(process.cwd(), ".env") });

async function main() {
  const retiredPlaceholders = await markPlaceholderListingsUnavailable();
  await refreshListingActivityCache(
    {
      listingStatus: { not: "sold" },
    },
    { force: true }
  );

  const summary = {
    retiredPlaceholders,
    activeListings: await prisma.listing.count({ where: { listingStatus: { not: "sold" } } }),
    soldListings: await prisma.listing.count({ where: { listingStatus: "sold" } }),
  };

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
