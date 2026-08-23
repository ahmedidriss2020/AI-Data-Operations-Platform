---
name: uk-ltd-transaction-categorisation
description: "Use when processing bank or card statements (Excel/CSV/XLSX) for a UK limited company and assigning each transaction to a nominal category for statutory accounts and a CT600 corporation tax return. Triggers: bank statement, card statement, transaction categorisation, nominal coding, chart of accounts mapping, allowable vs disallowable expenditure, capital vs revenue, director's loan account, CT600, corporation tax computation, add-backs, capital allowances, bookkeeping clean-up for a UK Ltd. Also use when building or reviewing recipe steps, mapping tables or exception rules that perform this categorisation inside AnalyzeIt, or in the controlled tool layer the Hermes agent calls."
metadata:
  author: AnalyzeIt
  version: "1.2.0"
  jurisdiction: "United Kingdom — private companies limited by shares (Ltd)"
  rates_verified_to: "2026-08"
---

# UK Ltd Statement Processing & Transaction Categorisation

You are preparing a UK limited company's bank and card statements so a qualified
accountant can produce statutory accounts and a **CT600 corporation tax return**.

**You are not the accountant.** You are the bookkeeping layer that does the
mechanical, high-volume work perfectly and hands over a short, ranked list of
things that genuinely need professional judgement. A wrong category that goes
unquestioned into a tax return is a filing error the company is liable for —
an escalated transaction costs the accountant thirty seconds.

## The three non-negotiables

**1. Never guess a category.** If the evidence on the statement line does not
support a category at the required confidence, the transaction is
`accountant_review`. An unclassified transaction is a correct output, not a
failure. Do not infer intent from a vendor name alone when the same vendor can
be business or personal (Amazon, Apple, PayPal, Uber, Tesco, a hotel chain).

**2. Never calculate a financial number with the LLM.** All arithmetic —
totals, VAT splits, balance reconciliation, materiality — is executed
deterministically in Polars/DuckDB and returned by a tool. The model proposes
categories and explains them; the engine computes. This mirrors the platform
rule in PRD v3 §6: *the LLM is never the source of a financial number.*

**3. A bank statement is evidence of a payment, not evidence of its nature.**
It shows that money moved, when, and to whom. It does not show what was bought,
whether VAT was charged, whether the spend was wholly and exclusively for the
trade, or whether an item is capital. Where the tax treatment depends on
information a statement cannot carry, say so and escalate — do not fill the gap
with an assumption.

---

## Part 1 — Ingesting the statement

### 1.1 Establish the engagement context before coding anything

Read these from the workspace configuration (`workspaces.settings` /
`tax_config`). If any is missing, **ask once and stop** — every one of them
changes the correct answer for many lines:

| Fact | Why it changes categorisation |
|---|---|
| Company name & registration number | Identifies own-name transfers; confirms the account belongs to the company |
| **Accounting period start & end** | Transactions outside it belong to another return; a period cannot exceed 12 months for a single CT600 |
| VAT registered? From when? | Determines gross vs net posting, and whether a VAT control account is used |
| VAT scheme (standard / cash / flat rate / annual) | Flat rate changes how input VAT is treated entirely |
| Trade / SIC and business model | "Wholly and exclusively" is judged against *this* trade |
| Directors and shareholders (names) | Payments to these names are DLA / salary / dividend candidates, never expenses |
| Number of associated companies | Divides the £50k / £250k CT rate thresholds |
| Employer PAYE scheme? CIS? | Splits HMRC payments correctly |
| Existing nominal ledger / chart of accounts | Use the client's codes, not generic ones |
| Prior-period mapping table | The single biggest source of automation — see §4.3 |

### 1.2 Parse the workbook defensively

UK bank exports are messy in predictable ways. Handle all of these; each becomes
a recipe step (PRD v3 §5):

- **Header row is not row 1.** Bank name, account number, sort code, address
  block and statement period usually sit above the table. Capture the statement
  period and account identifiers as metadata — do not discard them.
- **Two amount conventions.** Either separate `Money In` / `Money Out` (or
  `Paid In` / `Withdrawn`, `Debit` / `Credit`) columns, or one signed `Amount`
  column. Normalise to a single signed `amount` where **negative = money out**,
  and record which convention the source used.
- **Sign traps.** Parentheses negatives `(1,250.00)`, trailing `CR`/`DR`
  markers, `-` as a null placeholder, and Debit/Credit columns where the bank
  has already applied the sign (double negation risk).
- **Dates.** UK statements are `DD/MM/YYYY`. Excel serials, `DD-MMM-YY`, and
  mixed conventions inside one column all occur. Never let a US `MM/DD`
  interpretation through: if a column contains no value with a first component
  above 12, the convention is ambiguous — flag it, don't pick.
- **Running balance column.** Keep it. It is your reconciliation control (§3.1).
- **Non-transaction rows:** opening balance, closing balance, brought/carried
  forward, subtotals, page-break repeats of the header, blank separators, and
  footnote/disclaimer text below the table. These must be excluded from
  transaction counts and totals — a totals row treated as a transaction is the
  classic silent failure.
- **Duplicates.** Overlapping statement periods across files, and re-downloads
  of the same month. Match on `(date, amount, description, balance)`; near
  matches (same day, same amount, different reference) go to review, never
  auto-delete.
- **Foreign currency.** A GBP account may carry FX transactions with a separate
  original-currency column. Record original currency, original amount and the
  implied rate; exchange differences are a separate nominal and a separate tax
  consideration.
- **Multiple accounts / cards in one workbook** — one sheet or block per
  account. Never merge them into one ledger without preserving the account key.

### 1.3 Normalise the description field

Bank narratives are the primary evidence. Extract, don't destroy:

```
"CARD PAYMENT TO AMZNMktplace GB*2F41K, 14.99 GBP ON 03-08-2026"
  → counterparty_raw : "AMZNMktplace GB*2F41K"
  → method           : card_payment
  → tokens           : ["AMZN", "MKTPLACE", "GB"]
```

Keep `description_raw` untouched for provenance. Derive `counterparty_normalised`
by stripping payment-processor noise (`SumUp *`, `PAYPAL *`, `SQ *`, `IZ *`,
`*` reference suffixes, terminal IDs, dates, card last-4). Note that
`PAYPAL *X` and `SumUp *X` mean **the payment rail, not the supplier** — the
merchant is in the suffix and is often truncated or absent. Payment-aggregator
lines with an unidentifiable merchant are `accountant_review` by default.

Method matters for treatment: `FASTER PAYMENT`, `BACS`, `DD` (direct debit),
`SO` (standing order), `CHQ`, `CARD PAYMENT`, `ATM`, `TFR` (transfer),
`INT` (interest), `CHG`/`FEE` (bank charges).

---

## Part 2 — Categorising each transaction

### 2.1 Decide in this order

Work down the ladder. The first question that resolves the line wins — this
ordering exists because a payment can look like an expense at every level above
the one it truly belongs to.

```
1. Is it a transaction at all?          → balance rows, page artefacts       → exclude
2. Is it a transfer, not a P&L event?   → own accounts, savings, credit card → balance sheet
3. Is it a person, not a supplier?      → director/shareholder               → DLA / payroll / dividend
4. Is it a tax authority?               → HMRC                               → split by reference
5. Is it financing?                     → loan, HP, invoice finance          → capital vs interest split
6. Is it capital, not revenue?          → asset purchase                     → fixed assets + capital allowances
7. Is it revenue expenditure?           → then: allowable or disallowable?
8. Is it income?                        → trading turnover vs other income
9. Anything left                        → accountant_review
```

### 2.2 Category set and tax treatment

Map to the client's own nominal codes where they exist. `tax_treatment` is the
field the corporation tax computation consumes — it matters more than the label.

**Income**

| Category | Tax treatment | Notes |
|---|---|---|
| Trading income / turnover | Taxable trading receipt | Recognise on the accounts basis, not the bank date — the statement is cash |
| Bank / building society interest received | Taxable — **non-trading loan relationship credit**, taxed separately from trading profit | Do not net against interest paid |
| Rental income received | Taxable — UK property business, computed separately from trade | |
| Grants received | Usually taxable; some are capital or specifically exempt | → `accountant_review` |
| Insurance proceeds | Depends on what was insured (revenue loss vs capital asset) | → `accountant_review` |
| Refunds from suppliers | Credit the original expense category | Match to the original payment |
| Sale of a fixed asset | **Not income** — disposal proceeds, triggers balancing charge/allowance | → `accountant_review` |
| New share capital / director loan in | **Not income** — balance sheet | Money in from a director is a DLA credit |

**Revenue expenditure — normally allowable** (wholly and exclusively for the trade, CTA 2009 s54)

Cost of sales · Subcontractors (check CIS) · Wages and salaries (gross) ·
Employer's NIC · Employer pension contributions · Rent of business premises ·
Business rates · Utilities · Insurance · Telephone and internet ·
Software and SaaS subscriptions · Accountancy and bookkeeping ·
Legal fees on revenue matters · Bank charges · Merchant/card processing fees ·
Loan and overdraft interest · Advertising and marketing ·
**Staff** entertaining (within reason) · Staff training relevant to the trade ·
Travel and subsistence on business journeys · Motor running costs ·
Postage, printing and stationery · Repairs and maintenance (restoring, not improving) ·
Trade subscriptions and professional bodies · Protective clothing and uniforms ·
Charitable donations to UK registered charities (relieved as a charitable donation, not a trading expense).

**Revenue expenditure — disallowable: goes in the accounts, then is added back
in the tax computation**

| Item | Rule |
|---|---|
| **Client / customer entertaining** | Disallowed in full. Staff entertaining is different — keep the two in separate nominals or the add-back cannot be computed |
| **Business gifts** | Disallowed, unless ≤£50 per recipient per year, carrying a conspicuous advert for the company, and **not** food, drink, tobacco or exchangeable vouchers |
| **Depreciation and amortisation** | Always added back; capital allowances replace it |
| **Fines and penalties** | Disallowed — including HMRC and Companies House late-filing penalties, and parking/motoring fines |
| **Political donations** | Disallowed |
| **Donations to non-UK-registered or local non-charities** | Disallowed |
| **Legal/professional fees on capital transactions** | Disallowed as revenue — capital in nature (property purchase, share transactions, company formation) |
| **General provisions** | Disallowed; only specific provisions are relieved |
| **Personal expenditure of a director** | Not a company expense at all — see §2.4 |
| **Car lease rentals, cars over 50g/km CO2** | 15% of the rental is disallowed |
| **Non-trade element of any mixed-use cost** | Apportion; the private share is disallowed or a benefit in kind |

**Capital expenditure — never a P&L expense; goes to fixed assets and claims
capital allowances**

Computers, servers, phones, machinery, tools, commercial vehicles, vans, cars,
furniture and fittings, leasehold improvements, and any item with a lasting
benefit to the trade. Flag every capital candidate with its likely pool:

| Pool | Treatment |
|---|---|
| Main pool plant & machinery | Annual Investment Allowance (100% up to the AIA cap), or full expensing for new and unused assets |
| Special rate pool | Integral features, long-life assets, thermal insulation — AIA, or 50% first-year allowance for new assets |
| Cars | Never qualify for AIA. Rate depends on CO2 emissions; new zero-emission cars attract a 100% first-year allowance |
| Structures & buildings | Separate straight-line allowance; land is never relieved |
| Software | May be plant, or an intangible under the corporate intangibles regime |

Do **not** compute the claim. Categorise as capital, identify the asset, and let
the accountant pool it — the AIA cap, full-expensing conditions, disposals and
the intangibles regime are all judgement calls.

**Balance sheet — no P&L, no tax effect on their own**

Transfers between the company's own accounts · Credit card settlement payments ·
Loan principal repayments · HP capital element · VAT paid to / refunded by HMRC ·
PAYE and NIC remitted to HMRC (the *gross wage* was the expense, not the
remittance) · Corporation tax paid · Dividends paid · Share capital ·
Director's loan movements · Payments to and from a savings or reserve account.

### 2.3 HMRC payments must be split, never lumped

A single "HMRC" line on a statement can be any of five different things with
five different treatments. Use the payment reference:

| Reference pattern | Meaning | Treatment |
|---|---|---|
| 17 characters, `nnnAnnnnnnnnnnnnn` style ending in a tax-period suffix | PAYE / NIC | Balance sheet — clears the payroll liability |
| 9-digit VAT registration number, often prefixed | VAT | Balance sheet — VAT control |
| 17 characters beginning with the UTR, containing `A001nnA` | Corporation tax | Balance sheet — CT liability |
| `CIS` in the narrative | CIS deductions | Balance sheet |
| Anything unrecognised | Unknown tax | `accountant_review` |

Never treat a payment to HMRC as a tax-deductible expense. Corporation tax
itself is never deductible against corporation tax.

### 2.4 Directors, shareholders and the loan account — the highest-risk area

Money moving between a company and the people who own it is where the largest
tax exposures hide, and it is almost never resolvable from a statement alone.

- **Payment to a director's personal account with no payroll context** →
  `accountant_review`. It could be salary, a dividend, an expense
  reimbursement, or a loan. Each is taxed completely differently.
- **Company card used for personal spending** → director's loan account, never
  an expense. If you can see it is personal (supermarket, personal travel,
  clothing, a personal subscription) code it to DLA and flag it.
- **An overdrawn director's loan account** carries a **s455 charge** — tax
  payable by the company on the balance outstanding nine months and one day
  after the period end, refundable when the loan is repaid — plus a possible
  benefit-in-kind on a cheap or interest-free loan over £10,000. Always report
  the net DLA movement in the summary; the accountant must see it.
- **Dividends** are paid from post-tax distributable profits, are not
  deductible, and require the profits to exist. A "dividend" narrative is a
  claim, not a fact — flag it for the accountant to confirm against reserves.
- **Salary** should reconcile to the payroll records. If the statement shows
  regular round-sum payments to a director and no payroll scheme is configured,
  raise it — it is a common and costly error.

### 2.5 VAT on statements

If the company is VAT-registered, statement amounts are **gross**. You cannot
derive the VAT from the payment: the supplier may be unregistered, the supply
may be zero-rated (most food, books, children's clothes), exempt (insurance,
finance, postage, health, education), outside the scope, or subject to the
reverse charge (many overseas digital services, and construction under the
domestic reverse charge).

So: post gross, tag `vat_evidence: statement_only`, and let VAT be resolved
against invoices — a statement is not a valid VAT invoice and does not support
an input tax claim. Flag the known blocks: input VAT on **client entertainment**
and on the **purchase of a car** is generally irrecoverable. If the company is
on the **flat rate scheme**, do not attempt any input VAT treatment at all.

### 2.6 Category-specific traps worth encoding as rules

- **Repairs vs improvement.** Restoring an asset is revenue; enhancing it is
  capital. A new roof on an old building is usually revenue; an extension is
  capital.
- **Mixed-use cost.** Home broadband, a mobile phone, a car — apportionment is
  needed, and the basis must come from the client, not from you.
- **Prepayments and accruals.** Annual insurance paid mid-year, software paid
  36 months up front. Flag anything that clearly straddles the period end.
- **Round-sum allowances** paid to staff are pay, subject to PAYE — not expenses.
- **Mileage claims** are allowable at approved rates; a payment exceeding those
  rates is partly taxable pay.
- **Subscriptions.** A professional body on HMRC's approved list is allowable;
  a gym membership or a personal streaming service is not.
- **Crypto, gambling, or unexplained large round sums** → always
  `accountant_review`, never auto-coded.
- **R&D.** Where spend looks like it may qualify for R&D relief (technical
  staff, prototypes, specialist software, subcontracted development), tag it
  `rd_candidate` for the accountant. Do not attempt to quantify a claim — the
  regime, the qualifying conditions and the intensity tests are specialist work.

---

## Part 3 — Controls that must run before you hand anything over

### 3.1 Reconcile, don't assert

Run these deterministically. Any failure **blocks** the run (PRD v3 §10) — a
categorisation set that does not reconcile is worse than no categorisation,
because it looks finished.

1. `opening_balance + Σ(money_in) − Σ(money_out) == closing_balance`, to the
   penny. If the statement carries a running balance, also verify it
   line-by-line — the first row where it breaks is your parsing bug.
2. Every transaction date falls inside the statement period, and the statement
   period is inside (or correctly straddles) the accounting period.
3. No gaps between consecutive statement periods, and no overlaps.
4. Transaction count matches the parsed row count minus excluded non-transaction
   rows, and that exclusion list is itemised.
5. Every row carries exactly one category, or is explicitly `accountant_review`.
   No silent nulls.
6. Category totals sum to the statement total.

### 3.2 Confidence tiers

| Tier | When | Behaviour |
|---|---|---|
| `auto` | Exact match in the workspace mapping table, or an unambiguous structural rule (own-account transfer, bank charge, identified HMRC reference) | Applied, logged, reversible |
| `review` | Strong but not certain — fuzzy vendor match above threshold, a recurring pattern seen before with a different amount | Queued, grouped, ranked by GBP |
| `accountant_review` | Judgement is required, or the statement lacks the evidence | Never auto-coded. Carries a specific question |
| `block` | Reconciliation failed, period is wrong, or a required context fact is missing | Run halts |

### 3.3 Always escalate these to the accountant

Regardless of how confident the pattern match looks:

- Any payment to or from a director, shareholder or connected person
- Any transaction where capital vs revenue is arguable
- Anything crossing the accounting period end
- Any unidentifiable counterparty, or a payment-aggregator line with no merchant
- Any single transaction above the workspace materiality threshold
- Any round-sum payment with no supporting narrative
- Anything touching a foreign entity, foreign tax, or an unusual currency
- Grants, insurance proceeds, legal settlements, and asset disposals
- Anything where the honest answer is "it depends what it was for"

### 3.4 Write the escalation so it can be answered in seconds

A useless escalation says *"unclear transaction"*. A useful one states the
evidence, the candidate treatments, and the exact question:

```
⚠  accountant_review · £4,250.00 · 14/07/2026
   "FASTER PAYMENT TO J HARRISON REF LAPTOPS"

   Evidence   : Payee not in mapping table. No prior payment to this name.
                Reference suggests hardware. Amount above the £1,000
                capitalisation threshold set for this workspace.
   Candidates : (a) Capital — computer equipment, main pool
                (b) Revenue — cost of sales, if bought for resale
                (c) DLA — "J Harrison" matches director Jane Harrison
   Question   : Is J Harrison the director, and was this a purchase of
                fixed assets, stock for resale, or a personal transfer?
   If (a)     : capital, excluded from P&L, capital allowances to compute
   Impact     : £4,250 to taxable profit; ~£1,062 tax at 25%
```

Rank the queue by **GBP impact, not row count** (PRD v3 §10). Group identical
questions: *"38 payments to SumUp, £2,140 total — same question"* is one
escalation, not thirty-eight.

---

## Part 4 — Key details the corporation tax return depends on

You are not preparing the CT600, but everything you output feeds it. Get these
right and the accountant's job is assembly rather than investigation.

### 4.1 The tax computation this output must support

```
Profit per the statutory accounts
  + Disallowable expenditure        (entertaining, depreciation, fines, ...)
  + Capital items wrongly expensed
  − Capital allowances              (AIA / full expensing / WDA)
  − Other reliefs                   (R&D, losses, group relief)
  = Taxable total profits
  × Applicable rate                 (with marginal relief where it applies)
  = Corporation tax payable
```

Every disallowable item must therefore be **in its own nominal category**. If
client entertaining is mixed into "travel and subsistence", the add-back cannot
be computed without re-reading every line — that is the single most common way
this work has to be redone.

### 4.2 Rates, thresholds and dates — verify before relying on them

Rates change at each fiscal event. **Read them from the workspace `tax_config`,
and if the value there is older than the current fiscal year, flag it rather
than using a remembered figure.** The values below were correct as at the date
in this skill's frontmatter and are given so you recognise what matters:

| Item | Value |
|---|---|
| Main rate of corporation tax | 25% on augmented profits above £250,000 |
| Small profits rate | 19% on profits up to £50,000 |
| Marginal relief | Between £50,000 and £250,000, fraction 3/200 |
| Associated companies | Both thresholds are divided by the number of associated companies — a critical fact to establish up front |
| s455 charge on an overdrawn DLA | 33.75% |
| Annual Investment Allowance | £1,000,000 |
| Writing down allowances | 18% main pool, 6% special rate pool |
| Structures & buildings allowance | 3% straight line |
| VAT registration threshold | £90,000 rolling twelve months |
| Trivial benefits / small gift limit | £50 |
| Approved mileage rates | 45p per mile to 10,000 miles, 25p thereafter |
| Car lease rental disallowance | 15% where CO2 exceeds 50g/km |
| Corporate interest restriction | De minimis £2m of net interest |

**Deadlines that drive urgency in the exception queue:**

- **Corporation tax is payable 9 months and 1 day after the end of the
  accounting period** — before the return is even due.
- **The CT600 is due 12 months after the end of the accounting period.**
- Large companies pay by quarterly instalments instead.
- Statutory accounts are due at Companies House 9 months after the period end
  for a private company.
- The return is filed online with **iXBRL-tagged accounts and computations**
  attached — the categorisation must therefore map to real, taggable nominals.
- **Records must be kept for 6 years** from the end of the accounting period.
  Your provenance chain is part of those records.
- Late filing penalties escalate: £100, then £100 at three months, then 10% of
  unpaid tax at six months and a further 10% at twelve.

### 4.3 What the accountant should receive

1. **Categorised ledger** — every line with `date`, `description_raw`,
   `counterparty_normalised`, `amount` (signed), `category`, `nominal_code`,
   `tax_treatment`, `confidence`, `rule_id`, `source_row_id`.
2. **Reconciliation statement** — opening, movements, closing, and the itemised
   list of excluded non-transaction rows.
3. **Category summary** with totals, separating allowable, disallowable,
   capital and balance sheet.
4. **A draft add-back schedule** — every disallowable total, ready to drop into
   the computation.
5. **A capital additions list** — date, description, amount, suggested pool.
6. **Director's loan account movement** — every debit and credit, with the net
   position and a flag if it is overdrawn at the period end.
7. **The exception queue** — ranked by GBP, grouped, each with a specific
   question.
8. **Assumptions and limitations** — stated plainly, including that VAT has not
   been verified against invoices and that the accounts basis may differ from
   the cash movements shown.

Close every handover with the standing caveat: *this is a bookkeeping
preparation, categorised from bank data only; the tax treatment of each item
remains the accountant's determination.*

---

## Part 5 — Running this inside AnalyzeIt / Hermes

This skill executes as a recipe on the **managed Hermes Agent hosted on
Hostinger**, the production agent runtime (PRD v3 §3). Hermes is reached only
through a server-side authenticated bridge:

```
browser → AnalyzeIt server/API → authenticated Hermes API
        → controlled tool layer → Supabase / DuckDB / Polars
```

Three boundaries follow from that, and none of them are optional:

- **Hermes has no direct Supabase access** (PRD v3 §7). It calls the controlled
  AnalyzeIt tool layer, which authorizes every operation against
  organization → workspace → client *before* any data reaches the agent.
- **Two dashboards, never mixed** (PRD v3 §4). The Hostinger Hermes dashboard
  is the operator's infrastructure console — skills, agent config, logs. The
  AnalyzeIt dashboard is the accountant's product. An accountant must never
  receive Hermes admin credentials, model keys, system prompts or runtime
  controls.
- **Secrets stay server-side.** The Hermes secret and the reasoning-model API
  key are never exposed to the browser, never returned in a tool result, and
  never written into an exception note.

Reasoning is served through **OpenRouter** behind the model abstraction
(PRD v3 §11.1) — `google/gemini-3.7-flash` primary, Kimi K3 secondary, with the
`:batch` variant for overnight statement runs. The OpenRouter key belongs to the
AnalyzeIt backend, never to the browser and never to a tool result.

Write nothing in this workflow that depends on a specific model's behaviour. No
prompt, recipe step or categorisation rule may be tuned to one model's quirks —
swapping the primary model must be a config change, never a code change.

### 5.1 Tool contract

Use the platform tools (PRD v3 §7) — do not reimplement them, do not reach past
them to the database, and do not process rows in the model:

```
parse_workbook(file_id)                        → structure + confidence
profile_dataset(dataset_version_id)
match_recipe(dataset_version_id)               → by source_signature (bank + layout)
apply_recipe(dataset_version_id, recipe_version_id, dry_run)
normalize_values(dataset_version_id, column, rules)
detect_duplicates(dataset_version_id, keys)
validate_dataset(dataset_version_id, rule_set)
check_invariants(run_id)                       → reconciliation gate (§3.1)
explain_number(analysis_run_id, value_ref)     → provenance
```

Every mutating call runs `dry_run` first. Every tool result carries `status`,
`result`, `evidence`, `warnings`, `execution_metadata`.

### 5.2 Context discipline — this is client financial data

**Never send raw transaction rows to a reasoning model.** Send the schema,
profile statistics, and a small redacted sample. Categorisation prompts should
carry the normalised counterparty and the amount band, not account numbers,
sort codes, card numbers or customer names. This is both the PRD rule and, in
practice, most of the platform's data-protection posture.

### 5.3 Mapping tables are where the automation actually comes from

Each workspace holds a growable counterparty → category mapping table. Every
accountant resolution of an exception **writes back** to it, so the same
counterparty resolves automatically next month. This is criterion 9 of the MVP
and it is what moves a client from 60% to 99% automated. A resolution that does
not write back is a bug.

Do not share mapping entries across workspaces without review: "Shell" is fuel
for a courier and could be something else entirely for another client.

### 5.4 Persist deviations properly

Write escalations to `deviations` with `type`, `severity`, `materiality_gbp`,
`affected_rows` and an `evidence_json` containing the candidates and the
question from §3.4. Materiality is in GBP — that is what the review queue sorts
on. Pin every run to a `recipe_version`, never a recipe, so a historical run
never changes what it claims to have done.

### 5.5 Invariants specific to statement processing

Add these to `invariants_json` on any statement recipe:

- Balance reconciles to the penny (§3.1) — **block** on failure
- No transaction outside the statement period — **block**
- Statement period contiguous with the prior period — **review**
- `accountant_review` count within *n*% of the trailing three-month average — a
  sudden collapse in escalations usually means a rule became too greedy
- Total spend per category within tolerance of the trailing average — **review**
- Post-acceptance correction rate is rising — the recipe is degrading, and the
  product should say so (PRD v3 §16)

---

## Worked example

Input row:

```
03/08/2026 | CARD PAYMENT TO PREMIER INN LONDON, 189.00 GBP | 189.00 | 12,411.02
```

Output:

```json
{
  "source_row_id": "r_0417",
  "date": "2026-08-03",
  "description_raw": "CARD PAYMENT TO PREMIER INN LONDON, 189.00 GBP",
  "counterparty_normalised": "Premier Inn",
  "amount": -189.00,
  "category": "Travel and subsistence — accommodation",
  "nominal_code": "7402",
  "tax_treatment": "allowable_revenue",
  "vat_evidence": "statement_only",
  "confidence": "review",
  "rule_id": "map_hotel_chain_v3",
  "note": "Hotel chain matched from the mapping table. Allowable only if the stay was a business journey — if a director stayed for personal reasons this is a DLA debit. No prior London bookings for this workspace."
}
```

The category is proposed; the tier is `review` rather than `auto` because
nothing on the statement establishes the purpose of the stay. That is the whole
discipline of this skill in one line: **code what the evidence supports, and be
explicit about what it does not.**
