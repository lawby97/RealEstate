---
name: rent-comp-analysis
description: Analyze rental comparables for a property, normalize rent data, flag weak comps, and estimate market rent. Use when working with Facebook Marketplace, rental listings, rent comps, unit-level rents, or rent upside.
---

When analyzing rent comps:
1. Group comps by unit type: studio, 1BR, 2BR, 3BR, 4BR+.
2. Compare by neighborhood, postal code, distance, beds, baths, parking, utilities, renovated status, furnished status, and date posted.
3. Flag low-confidence comps.
4. Do not treat asking rent as achieved rent unless clearly stated.
5. Store source URL, source platform, captured date, and confidence score.
6. Prefer median rent over average when outliers exist.
7. Separate current rent, estimated market rent, and stabilized rent.

Output:
- Suggested market rent by unit type
- Confidence level
- Excluded comps and why
- Required database fields
- UI display recommendation
