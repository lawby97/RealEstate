# Project: Real Estate Investment Analysis App

## Product Purpose

This app helps Canadian real-estate investors find, compare, and underwrite multiplex opportunities using listing data, rent comps, financing assumptions, and source transparency.

## Core User

The primary user is a real-estate investor evaluating 5-unit Island of Montreal plexes and similar multifamily opportunities. The product should answer quickly: is this property worth deeper underwriting?

## Product Principles

- Show investor decision metrics first: price, estimated value, current rent, market rent, rent upside, NOI, cap rate, cash flow, cash-on-cash return, ROI, DSCR, financing feasibility, risks, and last verification.
- Every deal page should distinguish raw scraped data, normalized app data, and calculated values.
- Do not hide missing, stale, or low-confidence data. Show source, captured-at timestamp, first-added date, last-verified date, and confidence notes.
- Treat the individual listing page as an investor decision engine, not a generic listing brochure.
- Keep underwriting assumptions visible and editable where the user is testing scenarios.
- Do not assume every 5+ unit property must be commercial financing. Model conventional, insured, and lender-specific personal mortgage paths where applicable, including RBC/Desjardins-style exception testing.
- Use property tax values from the source listing when available. Do not invent assessed-value workflows unless explicitly requested.

## Engineering Principles

- Read the current implementation before changing it.
- Keep changes small, scoped, and reviewable.
- Reuse existing Next.js, React, Prisma, service, and test patterns.
- Do not refactor unrelated pages or schemas while implementing a focused request.
- Add or update tests for financial calculations, ingestion/dedupe logic, filters, and API behavior when those areas change.
- For UI work, include loading, empty, error, and stale-data states where the current pattern supports them.
- For visible frontend changes, manually verify the affected page in the browser when feasible.

## Ingestion Rules

- Centris and REALTOR.ca should be treated as source records that can merge into one canonical listing.
- Capture source platform, source URL, source listing ID, raw payload, photo URLs, capture timestamp, and source status when available.
- Nightly listing ingestion should be idempotent, preserve price/status history, mark missing source records unavailable or sold, and avoid duplicating canonical listings.
- Do not bypass login, CAPTCHA, anti-bot protections, or site access controls.
- Prefer official APIs, licensed feeds, permitted exports, or user-authorized data sources where possible.
- Rate-limit ingestion jobs and log failures clearly.

## Done Means

- The requested behavior works manually.
- Relevant tests pass, or failures are explained.
- Type checking passes for code changes.
- Edge cases are handled or explicitly called out.
- The final response states files changed, checks run, and any residual risk.
