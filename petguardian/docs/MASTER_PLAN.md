% PetGuardian Master Plan
% Two-sided strategy, structure, and build plan
% Draft for owner review. Not built beyond the current MVP.

## What this document is

This is the single converged plan for the venture: the structure it should take, the two sides it serves, how it makes money without ever selling user data or practicing law, and the order in which it all gets built. It supersedes the earlier single-sided, nonprofit framing and the scattered decisions before it.

Detailed clean-room and build wiring for the polling and content features lives alongside this in `POLLING_AND_CONTENT_ENGINE_SPEC.md`. This plan sits above that at the strategy and sequencing altitude.

Status: the consumer MVP exists, is deployed, and runs against a clean production database. Its document output has been reshaped from an executed legal instrument into an attorney-ready planning guide. Everything past the MVP in this plan is approved in principle and awaiting the open decisions named at the end. The venture name is itself an open decision; PetGuardian is used throughout as a working name.

### The binding constraints (walls, not goals)

Seven constraints govern every decision below. They are not trade-offs to balance. They are walls.

1. No APPA branding on the venture. APPA appears only as a cited data source, and, if the founder chooses, as a recipient of the anonymized and aggregated research. APPA's name, logo, and voice never appear on venture surfaces or in its content.
2. The clean-room wall holds absolutely. Consumer plan and estate data (the Vault) is never joined to research answers (the Insights plane), never sold, and never leaves first-party control. Research answers carry no PII and are pseudonymized at write time.
3. We never sell user information. The consumer side is a research instrument first. If a retailer or brand has an offer, the venture delivers it first-party; no third party ever receives user data, and never any PII.
4. Human in the loop throughout. No auto-posting, no unattended data release, no poll logic that fires without a hard cap, no legal document produced without a licensed attorney.
5. Plan the funding, never touch the funding. The venture documents and plans how a trust will be funded; it never holds, moves, routes, or takes custody of any money, never acts as trustee or custodian, and never facilitates a transfer.
6. The company never practices law. On the consumer side the company gives only a guide, stated upfront as not legal advice and not a legal document. The only legal document in the system is drafted and delivered by a licensed attorney using the attorney-side tool, and that attorney owns the judgment and the output.
7. Attorney matter data is walled. Client matter data created on the attorney side is privileged and confidential. It never joins the research plane, is never seen by the data side, and is isolated technically and, preferably, in a separate entity.

---

## 1. The structure: a two-sided, for-profit business

The venture is a two-sided, for-profit business, not a 501(c)(3). The earlier nonprofit framing is retired.

The two sides:

- Consumer side: always free. A data company that gives pet owners a practical care plan and an attorney-ready planning guide, and runs an anonymized research panel. It never produces a legal document and never gives legal advice.
- Attorney side: a paid SaaS subscription for licensed attorneys only. The attorney uses it to draft the pet trust and deliver it as an editable Word document. Access requires verified bar membership.

The handoff is the hinge between them. A pet owner fills in their plan on the free side. If their attorney subscribes, the attorney pulls that structured data (with the owner's consent) and drafts the trust in minutes. If their attorney does not use the platform, the owner prints the guide and hands it over. The owner is never stranded without a path, and the company never hands anyone a finished legal document.

What dropping the nonprofit changes, recorded so it is eyes-open:

- Gained: equity and upside, investment, speed, and a normal SaaS structure. No UBIT questions.
- Given up: grant access, and some of the independent-research-institute credibility the nonprofit lent the data side. The data side now earns credibility through methodology, which for-profit data companies do routinely.
- The APPA data commitment survives if the founder wants it. It was a personal promise; a for-profit can honor it by contract. It is now a choice, not a structural feature.

One entity or two is an open decision, but the strong default is to separate the attorney-side SaaS (which holds privileged client matter data) from the consumer data company, as two entities or with an airtight internal wall, so the data company can never be perceived to reach privileged files. This is the top item for counsel.

---

## 2. The model: two sides, one data asset

The free consumer side is the top of the funnel and the research instrument. The paid attorney side is where revenue from the legal workflow lands. They share one hinge: the client's structured plan data.

```
CONSUMER SIDE (free)                         ATTORNEY SIDE (paid SaaS)

pet owner uses the free utility
  -> fills in a care plan
  -> gets a care memo + emergency card (usable now)
  -> gets an attorney-ready planning guide
  -> answers occasional anonymous polls ---> research panel -> data products

                 the handoff (with consent, or printed)
                            |
                            v
                                        licensed attorney pulls the plan data
                                          -> drafts the pet trust
                                          -> delivers an editable Word document
                                          -> more attorneys subscribe because
                                             clients arrive pre-organized
```

Two revenue lines, consumer free: the attorney SaaS subscription, and the data company (anonymized research plus first-party offers). The research panel is the defensible data asset. The consumer-as-intake engine is the wedge that makes the attorney subscription worth paying for, because clients arrive organized and the attorney saves intake time.

The headline the data side is built to produce, within a year, is a line no one else can publish: a rolling, always-current read on pet-owner intent (intent to acquire another pet, intent to buy a category, switching intent) against a self-serve panel. The National Pet Owners Survey is deep and periodic. This is shallow and continuous. That contrast is the product.

The venture's structural edge under all of this is deep pet-industry knowledge: knowing the channels, the economics, and the buyer behavior that a consumer startup from outside the industry cannot see. Section 7 develops this against the competitive field.

---

## 3. Architecture and data walls

Three data classes, two hard walls, enforced in the database and the corporate structure, not by convention.

- Vault (consumer): plan, pet, caregiver, trustee, funding, and user PII on the free side. Source of truth for the consumer product. Never exported, never joined to Insights, never sold.
- Insights (research): poll questions, pseudonymized answers, and the minimal attributes needed to weight the panel. Keyed by a pseudonymous panelist id derived at consent time, held inside the Vault boundary, and never present in any Insights query path or export. Enforced by database roles: the Insights query role has no grant on any Vault table.
- Matter (attorney): the privileged, confidential client data and drafts created on the attorney side. Walled from both Vault research use and the data company entirely. Governed by the attorney's confidentiality and privilege obligations, with the venture as a processor under strict terms. Preferably a separate entity.

Consent governs every crossing. A consumer opts in, separately from account terms, before any research poll fires and before any plan data is shared with a named attorney. Consent is revocable from the account page. An attorney who creates a matter for a client cannot opt that client into research; research consent is always the individual's.

---

## 4. The build tracks

Each track carries its gate work, Product Score (which ranks, it does not decide), and kill criteria. Scores use the house weighting: demand x3, mission fit x3, reach x2, authority x2, sustainability x2, effort-inverse x1, out of 65.

### Track 1: Consumer utility and research panel (free)

Concept, in a user's words: "A free app that helps me plan for my pet's care, gives me a guide to take to my lawyer, and now and then asks one quick anonymous question."

- Product Score: 50 / 65. Track: Major. It is the funnel and the research instrument.
- Output is a guide, never a document. The reshaped planning guide, the care memorandum, and the emergency card. The care memo and emergency card are practical and usable immediately; the guide is the attorney handoff.
- Research panel: just-in-time, anti-fatigue-capped micro-polls feeding the Insights plane. Representativeness is the weak lens (scored 2): mitigate with weighting attributes, honest "panel-based, directional" labeling until weighting holds, and a published methodology note.
- Anti-fatigue caps enforced server-side; one poll per session, a small weekly cap, always skippable, always showing why we ask and that it is anonymous.
- 90-day bar and kill criteria as in the companion spec; the panel-size and cadence numbers are open decisions.

### Track 2: Content engine

Concept: one finding or topic in, platform-right drafts out for human review, never auto-posted.

- Product Score: 45 / 65. Track: Standard.
- Draft-and-review only, multiple voice profiles, disclaimer discipline and the no-APPA-branding wall enforced inside it, seeded by panel findings.
- For a free consumer product with no ad budget, this is the main organic-reach channel, and it is also the demand engine for the attorney side.

### Track 3: Attorney SaaS drafting platform (the paid core)

Concept: a licensed estate-planning attorney pulls a client's structured plan and drafts a valid, state-specific pet trust, delivered as an editable Word document, in minutes.

This is the revenue core and the biggest new build. It is a real document-automation product, not a workspace bolt-on.

- Product Score: not yet gated in detail; proposed Major track. It raises the security and compliance bar and is a larger engineering effort than the consumer app.
- Licensed-attorney-only access, gated by real bar-membership verification, and scoped to the states the attorney is licensed in.
- A document-assembly engine: clause libraries, state-by-state variation, and editable Word output the attorney reviews, edits, and finalizes. The attorney exercises judgment; the tool assists. It is never a one-click generator with the lawyer as a front.
- Pulls consumer plan data on the handoff, with the client's consent. If the client's attorney is not on the platform, the client prints the guide instead.
- Revenue: a flat SaaS subscription. No per-matter fee and no share of the attorney's legal fees.
- Gate it on its own, with the security review that privilege demands, before building. Kill criteria tied to attorney retention and draft-acceptance once piloted.

### Track 4: Estate-planner acquisition and CLE

Concept: a distinct way to reach and win attorneys, with accredited continuing legal education on animal-care planning as the wedge.

- The attorney acquisition engine. CLE on pet trusts targets exactly the attorneys who would subscribe, and builds authority.
- Partner for accreditation; do not become a provider. Stage it after the attorney platform has early traction.
- Nail the "interest vs. action" gap stat first, with a real citation (see open decisions), since it anchors both the CLE pitch and consumer marketing.

---

## 5. The voice and design system

A shared voice and design system keeps the consumer app, the attorney-facing product, the documents, and the marketing reading as one company, and lets the content engine apply style instead of re-deciding it. It is the venture's own identity, not APPA's; the APPA skills are the borrowed method, with the no-APPA-branding wall enforced inside.

- Voice layer, built now (stable and cheap). Profiles: an authority profile for LinkedIn and the blog; a warm profile for Instagram and Facebook; a plain-precise profile for consumer guide copy; and a professional profile for the attorney-facing product. The not-legal-advice and guide-not-document discipline, the no-APPA-branding wall, source-citation rules, and the clean-room language are baked in as rules.
- Design layer, locked once the name and entity structure are settled. Palette, typography, logo, and templates for the recurring formats, extending the app's existing look.

The durable form for both is a reusable skill that loads automatically whenever a deliverable is produced.

---

## 6. Revenue model

Two lines, consumer free, for-profit:

1. Attorney SaaS: a flat subscription for licensed attorneys for the drafting platform. The paid core. Never a per-matter fee and never a share of legal fees, to stay clear of fee-splitting and referral regulation.
2. Data company: syndicated and custom research from the panel (headline stat free, the cut and dataset paid and licensed), plus first-party offer delivery. Research independence is absolute; a sponsor funds access and reach, never a finding. No third party receives user data, and never any PII.

Consumers pay nothing, ever. The venture never holds or moves user or trust money. If the founder chooses, the anonymized and aggregated research goes to APPA by contract, at no cost.

---

## 7. Competitive landscape and our edge

Two competitive fields now, one per side.

Consumer and DIY field (October 2026 scan): Pet Legacia (a startup building the consumer concept, consumer subscription plus tag, currently paused pending legal review), Rocket Lawyer (pet trust as a loss-leader doc in a legal membership), Standard Legal (DIY forms, 49.95 dollars one-time), and free authority content from the Humane Society, the ASPCA, 2ndChance4Pets, Best Friends, and university extensions. The lesson holds: the consumer document layer is a commodity, and "what is a pet trust" content is saturated. We do not compete there on documents; we give a free guide and run the panel.

Attorney-tooling field: estate-planning document-automation incumbents such as Gavel, Lawyaw, WealthCounsel and ElderDocx, and Trust and Will's advisor tools. They automate documents for lawyers but are general estate-planning tools without a pet-specific build and without a consumer intake feeder.

Our edge on the attorney side is the consumer-as-intake engine: clients arrive pre-organized, which saves the attorney intake time and makes the subscription worth paying. Our edge on the data side is a continuous panel no one else has. And the structural edge under both is deep pet-industry knowledge, the thing a category outsider cannot clone. Pet Legacia's pause pending legal review, and the earlier competitor that abandoned the category for housing, both say the same thing: the consumer document business is a trap, and the defensible ground is the attorney tool plus the data.

---

## 8. Legal and regulatory risks

The two-sided structure is the cleaner posture on the founder's main worry, UPL, because it draws the line exactly at who does what. This is the risk register for counsel to validate; it is analysis, not legal advice.

- Unauthorized practice of law. The company-to-consumer activity is a guide only, stated upfront as not legal advice and not a legal document. The only legal document is drafted and delivered by a licensed attorney using the attorney-side tool. Selling document-automation software to lawyers is well established and is not UPL. Keep it clean with these disciplines:
  - The consumer guide organizes and prompts; it never recommends a choice (no "you need a trust, not a will," no "fund it with X dollars").
  - The attorney reviews, edits, and finalizes every draft. The tool assists; it is never a one-click generator with the lawyer as a front.
  - Terms state that using the consumer guide creates no attorney-client relationship; that forms only when the client separately engages an attorney.
- Fee-splitting and referral. Attorneys pay a flat SaaS subscription. No per-matter fee, no share of legal fees. Be careful with any consumer-to-attorney matching, which can be a regulated referral service; the safe default is the client chooses or already has their attorney and the platform only transfers data with consent.
- Licensing and jurisdiction. Gate attorney access with real bar verification and scope each attorney to the states they are licensed in, since a trust is state-specific. Do not let the platform enable cross-jurisdiction drafting.
- Privileged data. Matter data is privileged and confidential; wall it from the data company entirely, preferably as a separate entity, with the venture acting as a processor under strict terms.
- Enforceability and advertising. The consumer side never claims its guide is a valid or executed instrument. The attorney side relies on the attorney's judgment and the state's execution formalities, which the attorney handles.
- Handling money. The venture never holds, moves, or custodies funds on either side (the fifth wall).
- Insurance. Documenting that a client intends to fund through life insurance is fine; advising on or selling it is producer-licensed. The venture documents, it does not advise or sell.

The honest note: the consumer side gives up the satisfaction of a finished document, by design. That value moves to the attorney side, where it belongs, and the consumer keeps the practical care memo and emergency card, which drive return visits and feed the panel.

---

## 9. Launch tiers

- Track 1 consumer rollout and first pulse finding: the first methodology-backed intent read is the marquee data moment.
- Track 2 engine: Quiet, internal; the content it makes is the launch vehicle.
- Track 3 attorney platform: its own launch to the legal market once gated and piloted, with CLE as the authority anchor.
- Track 4 CLE: paced after the attorney platform shows early traction.

---

## 10. Sequencing

1. Consumer side first: utility hardening, the voice layer, the reshaped guide (done), and the clean-room consent and Insights plumbing.
2. The research panel: polling module, caps, JIT triggers, then weighting and audit.
3. The content engine, draft-only, seeded by panel findings.
4. The attorney SaaS platform (Track 3): the document-automation engine, bar verification, the consent handoff, and the privilege-grade security and data separation. This is the largest build and the revenue core.
5. Estate-planner acquisition and CLE (Track 4).

In parallel: the entity-structure decision (one entity or two) and the name, because both shape how the first dollar is taken and when the visual design system can be locked. Do not start the content engine's reach into the Vault, or the attorney platform's reach into consumer data, until the consent and clean-room walls are built and audited.

---

## 11. Open decisions (named gaps, not filled with invented numbers)

1. One entity or two, and where the wall between the data company and the attorney SaaS sits.
2. The venture name, and when the visual design system is locked.
3. Track 1 panel-size target and answer cadence for the 90-day bar.
4. The weekly poll cap and the skip-rate fatigue threshold.
5. The pet-owner frame to weight the panel against.
6. The first-wave intent question set (the three to five questions that matter most to buyers).
7. The sourced "interest vs. action" gap statistic, with citation. Source trail: the ASPCA Pet Trust Primer and pet-planning pages, the Humane Society "Providing for Your Pet's Future" fact sheet, and the Montana State Extension guide (co-authored by Prof. Gerry Beyer).
8. Attorney-side pricing (flat subscription tiers), the bar-verification vendor, and the first states for the drafting engine.
9. Whether a light consumer participation reward (a relevant first-party offer or sample, never cash, never tied to an answer) is in v1 or deferred.

---

## 12. Professional advice checklist

- Corporate and tax counsel: for-profit formation and the one-entity-or-two decision, with the wall between the data company and the attorney SaaS.
- UPL and legal-document counsel: confirm the consumer guide-not-document framing clears UPL, and that the attorney-side tool is structured as the attorney's instrument, not the company's.
- Fee-splitting and referral review: confirm the flat-SaaS, no-matching-fee posture.
- Bar-admission and multistate review: verification and jurisdiction scoping on the attorney side.
- Data, privacy, and privilege counsel: the consent model, the clean-room wall, the privileged-matter wall, and the first-party offer mechanism.
- Security review before the attorney platform ships, given privilege and confidentiality.
- CLE accreditation partner in the target jurisdictions.
- IP assignment into the entity (or entities), in writing, from the founder and from APPA as applicable.

---

## 13. Slop Audit

| The line | The tell | The fix |
|---|---|---|
| "a line no one else can publish" | Asserting authority. | Backed immediately by the concrete contrast with the periodic survey. On bar. |
| Product Scores (50, 45) and "proposed Major" for Track 3 | False-precision scoring that could decide for you. | Labeled as ranking not deciding; the low representativeness lens is a standing condition; Track 3 explicitly not yet gated in detail. On bar. |
| 90-day bars referencing target numbers | Empty placeholders. | Left as named open decisions, not invented. Flagged in Section 11. On bar. |
| Two-sided model framed as low-UPL | Happy-path spin on a real legal risk. | The UPL section names the specific disciplines and the privileged-data and fee-splitting traps, not just the upside. On bar. |
| The seven walls | Rules stated without teeth. | Each is a bright line with a stated consequence, carried into the risk register and the advice checklist. On bar. |
| "Consumer-as-intake engine is the wedge" | Vague value prop. | Tied to a concrete attorney benefit (saved intake time) and a concrete competitor gap (no pet-specific feeder). On bar. |
| Revenue section naming two lines | Burying the data-wall promise or dressing up a cost saver. | Each line stated plainly; the no-sale, no-fee-split, and no-custody promises stated alongside. On bar. |
| Dropping the nonprofit | Quietly reversing a prior conviction. | The trade is stated plainly, gains and losses both, in Section 1. On bar. |

Total: 0 clean breaches; 8 lines checked and justified. Band: on bar. This plan can move to build planning once the open decisions in Section 11 are answered.
