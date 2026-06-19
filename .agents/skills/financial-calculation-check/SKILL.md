---
name: financial-calculation-check
description: Review real-estate financial calculations for correctness, assumptions, edge cases, and tests. Use when working on NOI, cap rate, cash flow, DSCR, LTV, BRRR, rent upside, financing, or valuation logic.
---

Check formulas for:
1. Gross scheduled rent
2. Vacancy
3. Effective gross income
4. Operating expenses
5. NOI
6. Debt service
7. Cash flow
8. Cap rate
9. Cash-on-cash return
10. ROI
11. DSCR
12. LTV
13. Stabilized value
14. Renovation budget
15. Refinance proceeds
16. BRRR cash left in deal

Rules:
- Show assumptions separately from calculated outputs.
- Never hide missing inputs.
- Avoid false precision.
- Add unit tests for formulas.
- Include edge cases: zero rent, missing expense, vacant property, negative cash flow, and partial data.

Output:
- Formula review
- Incorrect or risky assumptions
- Required tests
- Suggested UI labels
