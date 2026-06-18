/**
 * Generates Prisma Client and applies safe schema additions before local development.
 */
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";

// Load .env from project root
config({ path: resolve(process.cwd(), ".env") });

const ADDITIVE_USER_COLUMNS = [
  ["annualEmploymentIncome", "REAL"],
  ["annualOtherIncome", "REAL"],
  ["monthlyDebtPayments", "REAL"],
  ["monthlyTaxesHeatingCondo", "REAL"],
  ["maxDownPayment", "REAL"],
  ["closingCostReserve", "REAL"],
  ["creditScore", "INTEGER"],
  ["underwritingOwnerOccupied", "BOOLEAN"],
  ["rentalIncomeOffsetPct", "REAL"],
  ["expectedMonthlyRentPerUnit", "REAL"],
  ["qualifyingRatePct", "REAL"],
  ["underwritingAmortizationYears", "INTEGER"],
  ["targetCommercialRefinanceYears", "INTEGER"],
  ["targetCommercialLtvPct", "REAL"],
  ["targetCommercialDscr", "REAL"],
] as const;

const ADDITIVE_LISTING_COLUMNS = [
  ["listingStatus", "TEXT DEFAULT 'active'"],
  ["soldAt", "DATETIME"],
  ["unavailableSince", "DATETIME"],
  ["syncScope", "TEXT"],
  ["lastSyncRunAt", "DATETIME"],
  ["lastPriceChangeAt", "DATETIME"],
] as const;

async function ensureListingSourceTable(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS ListingSource (
      id TEXT NOT NULL PRIMARY KEY,
      listingId TEXT NOT NULL,
      source TEXT NOT NULL,
      externalId TEXT NOT NULL,
      syncScope TEXT,
      address TEXT,
      price REAL,
      propertyType TEXT,
      units INTEGER,
      listingUrl TEXT,
      photoUrls TEXT,
      rawJson TEXT,
      capturedAt DATETIME,
      listingStatus TEXT NOT NULL DEFAULT 'active',
      unavailableSince DATETIME,
      lastSeenAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      lastPriceChangeAt DATETIME,
      isLinkActive BOOLEAN,
      linkCheckedAt DATETIME,
      linkStatusCode INTEGER,
      linkStatusNote TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ListingSource_listingId_fkey FOREIGN KEY (listingId) REFERENCES Listing (id) ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
  const sourceColumns = await prisma.$queryRawUnsafe<Array<{ name: string }>>("PRAGMA table_info(ListingSource)");
  const existingSourceColumns = new Set(sourceColumns.map((column) => column.name));
  if (!existingSourceColumns.has("syncScope")) {
    await prisma.$executeRawUnsafe("ALTER TABLE ListingSource ADD COLUMN syncScope TEXT");
  }
  await prisma.$executeRawUnsafe("CREATE UNIQUE INDEX IF NOT EXISTS ListingSource_source_externalId_key ON ListingSource(source, externalId)");
  await prisma.$executeRawUnsafe("CREATE INDEX IF NOT EXISTS ListingSource_listingId_idx ON ListingSource(listingId)");
  await prisma.$executeRawUnsafe("CREATE INDEX IF NOT EXISTS ListingSource_source_listingStatus_idx ON ListingSource(source, listingStatus)");
}

async function backfillListingSources(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(`
    INSERT OR IGNORE INTO ListingSource (
      id,
      listingId,
      source,
      externalId,
      syncScope,
      address,
      price,
      propertyType,
      units,
      listingUrl,
      photoUrls,
      rawJson,
      capturedAt,
      listingStatus,
      unavailableSince,
      lastSeenAt,
      lastPriceChangeAt,
      isLinkActive,
      linkCheckedAt,
      linkStatusCode,
      linkStatusNote,
      createdAt,
      updatedAt
    )
    SELECT
      'ls_' || lower(hex(randomblob(12))),
      id,
      source,
      externalId,
      syncScope,
      address,
      price,
      propertyType,
      units,
      listingUrl,
      photoUrls,
      rawJson,
      lastSyncRunAt,
      listingStatus,
      unavailableSince,
      lastSeenAt,
      lastPriceChangeAt,
      isLinkActive,
      linkCheckedAt,
      linkStatusCode,
      linkStatusNote,
      createdAt,
      updatedAt
    FROM Listing
    WHERE source IS NOT NULL
      AND source != 'multi_source'
      AND externalId IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM ListingSource
        WHERE ListingSource.source = Listing.source
          AND ListingSource.externalId = Listing.externalId
      )
  `);
}

async function ensureCompatibilityTables() {
  const prisma = new PrismaClient();
  try {
    const userColumns = await prisma.$queryRawUnsafe<Array<{ name: string }>>("PRAGMA table_info(User)");
    const existingUserColumns = new Set(userColumns.map((column) => column.name));
    for (const [name, type] of ADDITIVE_USER_COLUMNS) {
      if (!existingUserColumns.has(name)) {
        await prisma.$executeRawUnsafe(`ALTER TABLE User ADD COLUMN ${name} ${type}`);
      }
    }

    const listingColumns = await prisma.$queryRawUnsafe<Array<{ name: string }>>("PRAGMA table_info(Listing)");
    const existingListingColumns = new Set(listingColumns.map((column) => column.name));
    for (const [name, type] of ADDITIVE_LISTING_COLUMNS) {
      if (!existingListingColumns.has(name)) {
        await prisma.$executeRawUnsafe(`ALTER TABLE Listing ADD COLUMN ${name} ${type}`);
      }
    }

    await ensureListingSourceTable(prisma);
    await backfillListingSources(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  console.log("Ensuring database and schema...");
  execSync("npx prisma generate", { stdio: "inherit" });
  try {
    execSync("npx prisma db push", { stdio: "inherit" });
    await ensureCompatibilityTables();
  } catch {
    console.warn("Full Prisma sync was skipped to preserve existing database columns.");
    await ensureCompatibilityTables();
  }
  console.log("Database ready.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
