/**
 * Ingest Realtor.ca listings from a JSON file (e.g. exported from Apify or a scraper).
 * POSTs to the app's /api/scrape/realtor-ca/ingest endpoint.
 *
 * Usage:
 *   npx tsx scripts/ingest-realtor-from-file.ts --file=realtor-listings.json
 *   npx tsx scripts/ingest-realtor-from-file.ts --file=listings.json --url=http://localhost:3001
 */
import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync } from "fs";

config({ path: resolve(process.cwd(), ".env") });

const args = process.argv.slice(2);
const fileArg = args.find((a) => a.startsWith("--file="));
const urlArg = args.find((a) => a.startsWith("--url="));
const filePath = fileArg?.slice("--file=".length);
const baseUrl = urlArg?.slice("--url=".length) || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

if (!filePath) {
  console.error("Usage: npx tsx scripts/ingest-realtor-from-file.ts --file=<path> [--url=<baseUrl>]");
  process.exit(1);
}

const fullPath = resolve(process.cwd(), filePath);
let data: unknown;
try {
  data = JSON.parse(readFileSync(fullPath, "utf-8"));
} catch (e: unknown) {
  const err = e as NodeJS.ErrnoException;
  if (err?.code === "ENOENT") {
    console.error("File not found:", fullPath);
    console.error("");
    console.error("Create the file first by either:");
    console.error("  1. Running a Realtor.ca scraper on Apify (e.g. 'Realtor.ca Property Search Scraper'),");
    console.error("     then export the dataset as JSON and save it as", filePath);
    console.error("  2. Or copy the sample: cp realtor-montreal.json.example realtor-montreal.json");
    console.error("     then replace with real data. Expected format: { \"listings\": [ { \"Id\", \"Address\", \"City\", \"Province\", \"Price\", ... } ] }");
  } else {
    console.error("Failed to read or parse file:", fullPath, e);
  }
  process.exit(1);
}

const listings =
  Array.isArray(data) ? data
  : (data as { listings?: unknown[] })?.listings
  ?? (data as { items?: unknown[] })?.items
  ?? [];
if (!Array.isArray(listings) || listings.length === 0) {
  console.error("File must contain a JSON array or { listings: [...] } or { items: [...] } (Apify) with at least one listing.");
  process.exit(1);
}

const ingestUrl = `${baseUrl.replace(/\/$/, "")}/api/scrape/realtor-ca/ingest`;
console.log(`Posting ${listings.length} listings to ${ingestUrl}...`);

fetch(ingestUrl, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ listings }),
})
  .then(async (r) => {
    const out = await r.json();
    if (!r.ok) {
      console.error("Ingest failed:", out);
      process.exit(1);
    }
    console.log("Result:", out);
  })
  .catch((e) => {
    console.error("Request failed:", e);
    process.exit(1);
  });
