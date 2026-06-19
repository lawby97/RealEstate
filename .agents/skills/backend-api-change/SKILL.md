---
name: backend-api-change
description: Plan, implement, or review backend API changes for listings, rent comps, underwriting assumptions, users, automations, and financial calculations.
---

Before coding:
1. Find existing route/controller/service patterns.
2. Identify database tables and models involved.
3. Check validation and error handling conventions.
4. Avoid breaking existing API contracts.

For every API change:
- Define request shape.
- Define response shape.
- Validate inputs.
- Handle missing or stale data.
- Include source and timestamp fields where relevant.
- Avoid mixing scraped raw data with normalized app data.
- Add or update tests where possible.

Output:
- Endpoint behavior
- Data model impact
- Migration impact
- Validation rules
- Tests added or needed
- Manual test command
