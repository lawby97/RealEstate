/**
 * Sync a Centris snapshot into the local database.
 *
 * Usage:
 *   npx tsx scripts/sync-centris-snapshot.ts --file=/tmp/centris.json --montreal-5plex --mark-missing-sold
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import { prisma } from "@/lib/prisma";
import {
  MONTREAL_ISLAND_5PLEX_FILTER,
  MONTREAL_ISLAND_5PLEX_SYNC_SCOPE,
  syncCentrisSnapshot,
} from "@/lib/listing-sync";

config({ path: resolve(process.cwd(), ".env") });

function parseArg(name: string): string | undefined {
  const entry = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return entry ? entry.split("=").slice(1).join("=") : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function optionalNumber(name: string): number | undefined {
  const value = parseArg(name);
  if (value == null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readSnapshot(filePath: string): {
  listings: Array<Record<string, unknown>>;
  capturedAt?: Date;
} {
  const fullPath = resolve(process.cwd(), filePath);
  const parsed = JSON.parse(readFileSync(fullPath, "utf8"));
  const listings =
    Array.isArray(parsed) ? parsed :
    Array.isArray(parsed?.listings) ? parsed.listings :
    Array.isArray(parsed?.items) ? parsed.items :
    Array.isArray(parsed?.data) ? parsed.data :
    [];

  if (!Array.isArray(listings)) return { listings: [] };
  const capturedAtRaw = parsed?.capturedAt;
  const capturedAt =
    typeof capturedAtRaw === "string" && Number.isFinite(new Date(capturedAtRaw).getTime())
      ? new Date(capturedAtRaw)
      : undefined;

  return {
    listings: listings as Array<Record<string, unknown>>,
    capturedAt,
  };
}

async function main() {
  const filePath = parseArg("file");
  if (!filePath) {
    throw new Error("Missing --file=<snapshot.json>");
  }

  const useMontrealFiveplex = hasFlag("montreal-5plex");
  const syncScope = parseArg("sync-scope") ??
    (useMontrealFiveplex ? MONTREAL_ISLAND_5PLEX_SYNC_SCOPE : "centris_ca_snapshot");
  const filters = useMontrealFiveplex
    ? MONTREAL_ISLAND_5PLEX_FILTER
    : {
        minPrice: optionalNumber("min-price"),
        maxPrice: optionalNumber("max-price"),
        units: optionalNumber("units"),
      };

  const snapshot = readSnapshot(filePath);
  const result = await syncCentrisSnapshot(snapshot.listings, {
    syncScope,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    units: filters.units,
    cityNames: "cityNames" in filters ? filters.cityNames : undefined,
    markMissingAsSold: hasFlag("mark-missing-sold"),
    runAt: snapshot.capturedAt,
  });

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
