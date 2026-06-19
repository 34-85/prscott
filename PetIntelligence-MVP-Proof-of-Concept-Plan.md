# APPA Pet Intelligence — MVP Proof-of-Concept Plan (pre-incorporation)

> A lean, ~5-month test to validate the data/AI business **before** incorporating APPA Ventures or committing the staged ~$3M (§D). Run as an **internal APPA project — no new entity yet.** Designed to run **concurrently with the Pets of [City] MVP**, sharing resources (see §7).

## 1. Why this MVP is different (and easier) than the newsletter MVP

Unlike Pets of [City], APPA **already owns the core asset** (the National Pet Owners Survey + industry spending statistics) and **already has paying customers** (NPOS buyers) and 1,200 member companies. So the MVP doesn't test *whether the data has value* — it tests **productization, AI trust, and willingness-to-pay for a year-round subscription + AI layer.** That means you can validate with a **prototype + human-backed ("concierge") answers** before building full automation — cheap and fast.

## 2. The riskiest assumptions to test

| # | Hypothesis | Why it's the risk |
|---|---|---|
| D1 | **Willingness-to-pay & packaging** — members and non-members will pay for a year-round **subscription** (and upgrade to the **AI tier**) vs. today's one-off report | The §A revenue model hinges on conversion + the Pro+AI ARPU lift |
| D2 | **AI value & trust** — a **grounded** co-pilot answers real pet-market questions accurately, **with citations and ~zero hallucination on numbers**, and users find it genuinely useful | The AI is the differentiator; if it's not trustworthy, it's worse than nothing |
| D3 | **Data-rights feasibility** — POS/panel data (NielsenIQ/Circana) can be licensed with **AI/derived-use rights** at acceptable cost | The "survey + point-of-sale truth" combination is the moat |
| D4 | **Engagement / retention signal** — users log in and query **repeatedly** (the daily-utility / dues-retention thesis) | Retention is half the business case |

## 3. Scope — what we actually build

A **functional prototype on APPA's owned data only** (no partner data needed for the MVP):

1. **Lightweight dashboard** over NPOS + spending statistics (existing BI tool; no custom platform yet).
2. **Grounded AI co-pilot prototype** — RAG over APPA's owned reports via an existing LLM API + vector store; answers cite the underlying data; **refuses/escalates** rather than guessing on anything unsupported.
3. **Concierge backstop** — a human analyst (existing APPA research staff) answers the hardest queries behind the scenes during beta (Wizard-of-Oz), so we test *demand* before automating everything.
4. **Pricing test pack** — the 3-tier pricing (Core / Pro+AI / Enterprise) put in front of design partners to validate (or correct) the price points.
5. **POS-partnership scoping** — obtain a **term sheet/quote** from a POS/panel provider including AI/derived-use rights (validates D3 *on paper* — no integration yet).

Run a **closed "design-partner" cohort** of ~15–25 members + a few non-member brands/investors.

## 4. Timeline (~5 months, parallel to the Pets of [City] MVP)

| Phase | Weeks | Activities | Output |
|---|---|---|---|
| **0 · Build** | 1–4 | Structure NPOS + stats into a queryable dataset; stand up dashboard + grounded AI co-pilot prototype; recruit design partners; finalize pricing test | Working prototype + cohort |
| **1 · Closed beta** | 5–10 | Design partners use it weekly; concierge analyst backs hard queries; log usage, accuracy, feedback; iterate | Usage + AI-quality data |
| **2 · Willingness-to-pay** | 11–16 | Convert design partners to **paid pilots / signed LOIs / pre-commitments** at target pricing; pitch a few non-members; secure POS-partnership term sheet | Revenue validation + data-rights proof |
| **3 · Measure & decide** | 17–22 | Analyze vs. thresholds; write board decision memo | **Go/no-go** to build + incorporate |

## 5. Success metrics & go/no-go thresholds

| Metric | Target | Tests |
|---|---|---|
| **Design partners recruited** | 15–25 (members + a few non-members) | D1/D4 |
| **AI answer quality** | **≥ 90% of test queries answered accurately with correct citations; ~0 hallucinated numbers** | D2 |
| **Active usage** | Majority of partners active **weekly/biweekly**; meaningful **queries per active user** | D4 (daily-utility/retention) |
| **Willingness-to-pay** | **≥ 10–15 paid pilots or signed LOIs** for Core/Pro+AI at (or near) target price — a credible path to the §A Year-1 ~$0.8M | D1 |
| **Price validation** | Confirm or correct the **$3.5K/$9K member · $7.5K/$15K non-member** points | D1 |
| **Value perception** | Strong qualitative/NPS; "would be disappointed without it" | D1/D2 |
| **Data-rights** | A **POS/panel term sheet with acceptable AI rights + price** in hand | D3 |

**Decision rule: GO** to build + incorporate if **willingness-to-pay is validated** (≥10–15 paid/LOI commitments implying credible ARR) **and** the **AI-quality bar is met** **and** a **viable POS data-rights path** exists. Otherwise iterate on packaging/price or narrow scope — cheaply, on owned data.

## 6. Budget (~$125–150K, 5 months)

Note: **no paid-acquisition line** (unlike the newsletter MVP) — APPA's members/customers are the warm cohort.

| Line item | Allocation |
|---|---|
| Prototype build — dashboard + grounded AI co-pilot (contract dev / AI engineer) | $50,000 |
| Data structuring/prep (NPOS + stats → queryable; data contractor) | $25,000 |
| Concierge analyst time (human-backed beta answers; partly existing staff) | $15,000 |
| LLM API + vector store + cloud (pilot usage) | $8,000 |
| Product/UX design for the prototype | $10,000 |
| Project lead (fractional; **shared with PoC MVP**) | $15,000 |
| Data-partnership scoping (legal/advisory; term sheet, no license yet) | $8,000 |
| Contingency (~10%) | $13,000 |
| **Total** | **~$144,000** |

**Funding:** board-approved pilot line, under any entity-formation threshold; a rounding error against the ~$3M it de-risks.

## 7. Shared resources across BOTH MVPs (same time frame)

Running the data MVP and the Pets of [City] MVP **concurrently** is itself a live test of the venture-studio "shared platform" thesis (Operating Plan §4) — and it lowers combined cost:

| Shared resource | How both MVPs use it |
|---|---|
| **Project lead / PM** | One fractional PM runs both pilots and writes one combined board memo |
| **AI/data engineering & tooling** | Same LLM API accounts, vector store, RAG patterns, and prompt-engineering know-how power the **data co-pilot** *and* the **newsletter's AI content pipeline** |
| **APPA's owned data** | Pet Intelligence productizes it; Pets of [City] uses it for **market selection, ad targeting, and factual editorial** (the spending stats already cited in the Austin sample). PoC's consumer/local signals, in turn, become future Pet Intelligence inputs |
| **Member/customer access** | The same APPA relationships recruit **data design partners** *and* **newsletter sponsors/advertisers**; one member-outreach effort |
| **Design / brand** | One freelance designer covers both prototypes and templates |
| **Legal/advisory** | One engagement covers sponsorship terms **and** data-partnership scoping, plus the "run-as-internal-program" structuring for both |
| **Analytics / measurement** | One metrics/dashboard setup tracks both pilots |
| **Governance & decision** | **One go/no-go decision** to the board → **one APPA Ventures incorporation** covering both businesses |

**Combined cost efficiency:** standalone the two MVPs sum to ~$145K (PoC) + ~$144K (Data) ≈ **$289K**. Sharing PM, design, AI tooling/infra, legal, member outreach, and measurement saves roughly **$40–60K**, for a **combined ~$230–250K to validate both businesses** over the same ~5 months — and it proves the shared-platform economics that underpin the §C/§D consolidated model.

## 8. What it de-risks → the decision it feeds

A successful data MVP converts §A from projection to evidence: real willingness-to-pay at real price points, a working grounded AI users trust, a usage/retention signal, and a viable data-rights path. Together with the Pets of [City] MVP, it gives the board **one evidence-backed decision** to **(a) incorporate APPA Ventures, (b) commit the staged ~$3M, and (c) build both businesses** — or to stop/iterate for a fraction of the cost and a fraction of the time.
