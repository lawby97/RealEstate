---
name: listing-page-product-audit
description: Audit the opened listing/property detail page of a real-estate investment app. Use when reviewing what information is shown, hidden, prioritized, calculated, or used on the listing page before making product or code changes.
---

You are reviewing an existing listing/property detail page for a real-estate investment analysis app.

The goal is not to code. The goal is to understand what the page currently shows, what data it uses, what assumptions it makes, and whether the page helps an investor make a decision.

Review the page from these perspectives:

1. Investor decision quality
- What does the investor need to know first?
- Does the page quickly answer: is this deal worth investigating?
- Are price, rent, NOI, cap rate, cash flow, DSCR, rent upside, and risks visible enough?
- Are important assumptions hidden?
- Are there misleading metrics or false precision?

2. Product logic
- Why is each section on the page?
- Why is each metric shown or hidden?
- What user decision does each element support?
- What is noise?
- What is missing from the user flow?
- What should be must-have, should-have, or later?

3. Data usage
- What fields does the page consume?
- Which fields are raw scraped data?
- Which fields are normalized?
- Which fields are calculated?
- Which fields need source, timestamp, or confidence score?
- What data is missing for proper underwriting?

4. UX and layout
- What is above the fold?
- Is the order of information logical for an investor?
- Are risks and assumptions easy to find?
- Are loading, empty, stale, and error states handled?
- Is the page usable on desktop and mobile?

5. Challenge the existing design
- Why does this exist?
- Why is it placed here?
- Why is this more important than other missing information?
- What investor decision does this support?
- What could go wrong if the user trusts this?

Output:
- Current page summary
- Data map: displayed fields, hidden fields, calculated fields
- Investor critique
- Product critique
- UX critique
- Missing information
- Misleading or risky information
- Recommended above-the-fold layout
- Must-have changes
- Should-have changes
- Later improvements
- Open questions for the founder
- Acceptance criteria for the next implementation phase
