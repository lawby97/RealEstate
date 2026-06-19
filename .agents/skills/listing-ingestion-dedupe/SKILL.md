---
name: listing-ingestion-dedupe
description: Design or review listing ingestion, deduplication, change detection, and nightly import workflows. Use when working on Centris listings, property imports, scraper jobs, listing snapshots, or duplicate detection.
---

For listing ingestion:
1. Capture source platform, source URL, source listing ID if available, scrape timestamp, and raw payload.
2. Deduplicate using source listing ID first, then address normalization, postal code, coordinates, price, and property characteristics.
3. Preserve listing history as snapshots instead of overwriting important values.
4. Detect price changes, status changes, description changes, and removed listings.
5. Log failures clearly.
6. Make ingestion idempotent.
7. Do not bypass login, CAPTCHA, anti-bot protections, or site access controls.
8. Prefer official APIs, licensed feeds, exports, or user-authorized data sources where possible.

Output:
- Ingestion flow
- Dedupe logic
- Snapshot strategy
- Failure modes
- Required indexes
- Monitoring and logging requirements
