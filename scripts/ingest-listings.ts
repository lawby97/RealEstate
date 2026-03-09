/**
 * Ingest is now Realtor.ca only (via Apify export or scrape ingest API).
 * Use: npm run ingest:realtor -- --file=path/to/realtor-export.json
 *
 * Redfin has been removed. Add listings by:
 * 1. Running a Realtor.ca scraper on Apify, export JSON
 * 2. npm run ingest:realtor -- --file=your-export.json
 * (App must be running so the script can POST to /api/scrape/realtor-ca/ingest)
 */
console.log("Ingest no longer uses Redfin.");
console.log("To add listings, run: npm run ingest:realtor -- --file=path/to/realtor-export.json");
console.log("(Export Realtor.ca data from Apify first, then run with the app running.)");
