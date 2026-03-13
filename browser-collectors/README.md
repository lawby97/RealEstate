# Quebec browser collectors

These userscripts are the primary no-paid acquisition path for Quebec listings.

Active Quebec lanes:
- `broad_residential`
- `small_bay_2to4`
- `five_plus_multifamily`

Out of scope for this queue:
- land
- parking

## What they do

- run inside your own browser session on `Centris`, `Realtor`, or `DuProprio`
- watch page `fetch` / `XHR` traffic for listing payloads
- let you pull the next Quebec queue task from your local app
- post the captured payload to your local ingest route on `http://localhost:3000`

## Requirements

- a userscript manager such as Tampermonkey
- the local app running on `http://localhost:3000`
- one script installed per source:
  - `centris-capture.user.js`
  - `realtor-capture.user.js`
  - `duproprio-capture.user.js`

## Operator workflow

1. Start the local app.
2. Install the source userscript.
3. Open the matching site in your browser.
4. Click `Next task` in the floating panel.
5. Open the search page for that source/segment manually.
6. Let the page load.
7. Click `Send latest JSON` when the results payload has been captured.
8. If no JSON payload is captured, use `Send page HTML` as a fallback.
9. Mark `Terminal page` when you reach the last page for that segment.

Queue behavior:
- `in_progress` segments resume before fresh `pending` segments
- `broad_residential` keeps general Quebec residential sale inventory
- `small_bay_2to4` keeps only 2–4 unit residential listings
- `five_plus_multifamily` keeps only 5+ residential multifamily listings

## Queue helpers

- API: `GET /api/ingest/quebec-manifest?source=<source>&next=1`
- CLI: `npm run queue:quebec-capture -- --source=centris_ca`
