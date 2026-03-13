# Greater Montreal browser collectors

These userscripts are the primary no-paid acquisition path for Greater Montreal residential sale listings.

Active scope:
- `greater_montreal_core`

Active regions:
- `Montreal`
- `Laval`
- `Longueuil / South Shore`

Active sources:
- `centris_ca`
- `duproprio_ca`

Active lanes:
- `broad_residential`
- `small_bay_2to4`
- `five_plus_multifamily`

Out of scope for this queue:
- land
- parking
- non-residential assets
- `realtor_ca`

## What they do

- run inside your own browser session on `Centris` or `DuProprio`
- watch page `fetch` / `XHR` traffic for listing payloads
- let you pull the next Greater Montreal queue task from your local app
- post the captured payload to your local ingest route on `http://localhost:3000`

## Requirements

- a userscript manager such as Tampermonkey
- the local app running on `http://localhost:3000`
- one script installed per source:
  - `centris-capture.user.js`
  - `duproprio-capture.user.js`

## Operator workflow

1. Start the local app.
2. Install the source userscript.
3. Open the matching site in your browser.
4. Click `Next task` in the floating panel.
5. Click `Open task page` to jump directly to the source-native results page.
6. Let the page load.
7. Click `Send latest JSON` when the results payload has been captured.
8. If no JSON payload is captured, use `Send page HTML` as a fallback.
9. Mark `Terminal page` when you reach the last page for that segment.

Queue behavior:
- `in_progress` segments resume before fresh `pending` segments
- `broad_residential` keeps general Greater Montreal residential sale inventory
- `small_bay_2to4` keeps only 2–4 unit residential listings
- `five_plus_multifamily` keeps only 5+ residential multifamily listings
- Centris task pages open directly by lane and region
- DuProprio broad-residential tasks open region pages; multiplex lanes open the region multiplex page
- price bands still need to be set manually on the source page

## Queue helpers

- API: `GET /api/ingest/quebec-manifest?scope=greater_montreal_core&source=<source>&next=1`
- CLI: `npm run queue:quebec-capture -- --scope=greater_montreal_core --source=centris_ca`
