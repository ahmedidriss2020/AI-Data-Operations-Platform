# Fixtures

Deliberately messy workbooks, matching the failure modes listed in PRD section 6. They exist so
that the upload and parsing paths are exercised against something realistic rather than a tidy
CSV, and they are the seed of the eval harness described in section 8.

Regenerate with `npm run fixtures`.

- `messy/acme-sales-2026-08.xlsx` — header on row 5 under a merged title block, blank separator
  rows, an embedded subtotal row, a trailing TOTAL row, an exact duplicate transaction, vendor
  names in four spellings, parentheses negatives, thousands separators, a stray currency symbol,
  one date in MM/DD among DD/MM, footnotes below the data, and a second sheet.
