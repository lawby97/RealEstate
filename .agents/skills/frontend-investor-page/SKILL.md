---
name: frontend-investor-page
description: Implement or review investor-facing frontend pages for a real-estate analysis app. Use when changing dashboards, listing cards, property detail pages, filters, tables, charts, or comparison views.
---

Before coding:
1. Identify the existing page/component pattern.
2. Reuse existing components where possible.
3. Confirm required API fields.
4. Define loading, empty, error, and stale-data states.

Investor page priority:
1. Deal score or investability summary
2. Price and estimated value
3. Rent and rent upside
4. NOI, cap rate, cash flow, cash-on-cash return, ROI, and DSCR
5. Key risks
6. Data confidence and source timestamp
7. Details and assumptions

Implementation rules:
- Keep changes small.
- Do not refactor unrelated code.
- Make important metrics scannable.
- Show assumptions, not just final numbers.
- Add responsive behavior for desktop and mobile.
- Add manual test steps after changes.

Output:
- Files changed
- UI behavior changed
- Data dependencies
- Manual test plan
- Risks or missing backend fields
