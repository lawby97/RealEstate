---
name: qa-regression-review
description: Review a completed code change for bugs, missing tests, broken user flows, edge cases, and regression risk.
---

Review:
1. What changed?
2. What user flow could break?
3. What data edge cases exist?
4. Are loading, empty, error, and stale states handled?
5. Are tests present for important logic?
6. Are financial calculations covered?
7. Are scraper failures logged?
8. Are migrations safe?
9. Are unrelated files changed?

Output:
- Must-fix issues
- Should-fix issues
- Test gaps
- Manual QA checklist
- Final risk level: low, medium, or high
