% PetGuardian Master Plan
% Converged strategy, structure, and build plan
% Draft for owner review. Not built beyond the current MVP.

## What this document is

This is the single converged plan for the venture: the entity it should become, the product it builds, how it makes money without ever selling user data, and the order in which it all gets built. It supersedes the scattered decisions made across prior sessions and pulls them into one place.

Detailed clean-room and build wiring for the polling and content features lives alongside this in `POLLING_AND_CONTENT_ENGINE_SPEC.md`. This plan sits above that at the strategy and sequencing altitude.

Status: the consumer MVP exists, is deployed, and runs against a clean production database. Everything past the MVP in this plan is approved in principle and awaiting the open decisions named at the end. The venture name is itself an open decision; PetGuardian is used throughout as a working name.

### The binding constraints (walls, not goals)

Four constraints govern every decision below. They are not trade-offs to balance. They are walls.

1. No APPA branding on the venture. APPA appears only as a cited data source and, by the founder's standing commitment, as a recipient of the anonymized and aggregated research in perpetuity at no cost. APPA's name, logo, and voice never appear on venture surfaces or in its content.
2. The clean-room wall holds absolutely. Plan and estate data (the Vault) is never joined to research answers (the Insights plane), never sold, and never leaves first-party control. Research answers carry no PII and are pseudonymized at write time.
3. We never sell user information. The venture is a research instrument first. If a retailer or brand has an offer, the venture delivers it first-party; no third party ever receives user data, and never any PII.
4. Human in the loop throughout. No auto-posting, no unattended data release, no poll logic that fires without a hard cap.

---

## 1. The entity: a 501(c)(3) research nonprofit

The venture should be formed as an independent 501(c)(3) research nonprofit. This decision frames everything else, so it comes first.

Why this structure is right, not just acceptable:

- It makes the promises credible. "We never sell your data; we are a nonprofit research institute" is a materially stronger claim from a nonprofit than from a company, and it answers the trust risk in a data model head-on.
- It strengthens research independence. A nonprofit research institute carries more authority than a for-profit data shop, and it reframes the venture from a rival of the National Pet Owners Survey into an independent research complement. That is better for the APPA relationship and better for grant funders.
- It opens grant funding. Animal-welfare foundations and research grants are real money for a mission that sits at the intersection of access-to-planning and animal welfare.
- It resolves ownership cleanly. The "built while employed at APPA" question is settled by a clean IP assignment into the entity at the outset.

Decisions the founder has already made, recorded here so they are not relitigated:

- No equity and no exit. The founder accepts this. The vehicle is mission, salary, and legacy, not ownership.
- UBIT is not a blocker. If earned revenue owes unrelated-business-income tax, the entity pays it. Structure for cleanliness, not for tax avoidance.
- Data to APPA in perpetuity, free. The anonymized and aggregated research is provided to APPA at no cost, indefinitely. The Vault stays private; this commitment covers research outputs, not user records.

Professional advice still required before filing (named, not hand-waved):

- A nonprofit attorney and tax advisor to structure earned-revenue lines (research licensing, attorney seats) and confirm UBIT handling.
- A clean IP assignment from the founder and from APPA, as applicable, into the entity, in writing, up front.
- Consider operating under a fiscal sponsor as a bridge so the entity can accept grants before IRS determination clears.

---

## 2. The strategy: two flywheels, one instrument

The venture runs on a single loop, now with a second loop feeding it from the professional side.

Consumer loop:

```
free utility -> research panel -> insights -> content -> awareness -> more users -> bigger panel
```

Professional loop:

```
CLE / education -> attorneys adopt the platform -> attorneys bring clients -> more plans -> bigger panel
```

Both loops fill the same panel. The panel is the research instrument. The content engine is the distribution arm that turns a finding into reach and brings new users back. The attorney tier is a second intake that also happens to be clean earned revenue.

The headline this is built to produce, within a year, is a line no one else can publish: a rolling, always-current read on pet-owner intent (intent to acquire another pet, intent to buy a category, switching intent) against a self-serve panel. The National Pet Owners Survey is deep and periodic. This is shallow and continuous. That contrast is the product, not a weakness to hide.

The venture's structural edge under all of this is deep pet-industry knowledge: knowing the channels, the economics, and the buyer behavior that a consumer startup from outside the industry cannot see. Section 9 develops this against the competitive field.

---

## 3. The architecture walls

Two planes, one wall, enforced in the database, not by convention.

- Vault: plan, pet, caregiver, trustee, funding, and user PII. Source of truth for the care product. Never exported, never joined to Insights, never sold.
- Insights: research questions, pseudonymized answers, and the minimal attributes needed to weight the panel (coarse region, household band, species or count, acquisition recency band). Keyed by a pseudonymous panelist id derived at consent time, held inside the Vault boundary, and never present in any Insights query path or export.

Enforcement: the Insights query role has no grant on any Vault table, the same pattern already used to revoke access from the anon and authenticated roles on the production database.

Consent: explicit, separate from account terms, revocable from the account page. No research prompt fires for a user who has not opted in. An attorney who creates a plan for a client cannot opt that client into research; consent is always the individual's.

---

## 4. The build tracks

Each track carries its gate work, its Product Score (which ranks, it does not decide), and its kill criteria. Scores use the house weighting: demand x3, mission fit x3, reach x2, authority x2, sustainability x2, effort-inverse x1, out of 65.

### Track 1: Consumer utility and research panel (mobile micro-polling)

Concept, in a user's words: "Every so often PetGuardian asks me one quick, anonymous question about my pet, and I can see how other owners answered."

This is the core data asset and the fuel for everything else. It rides the attention the free utility already earns, so the panel costs almost nothing to fill.

- Product Score: 50 / 65. Track: Major.
- The weak lens, scored low on purpose: representativeness. A panel self-selected from planning-minded owners is not a national sample. Mitigate by capturing weighting attributes, labeling early output panel-based and directional (never nationally representative) until weighting holds, and publishing a short methodology note with every external figure. The methodology note is itself an authority asset.
- Anti-fatigue caps, enforced server-side: at most one poll per session; a small weekly cap per panelist across all triggers; always skippable in one tap; every card shows why we ask and that it is anonymous. Over-polling burns the goodwill that got the user there.
- Just-in-time triggers: ask when the answer is most salient (acquisition intent right after a pet is added; category or switching questions at the annual-review reminder; seasonal pulses in season). Triggers are admin-authored data, not hard-coded.
- Native surface: in-app poll card by default, occasional push-to-poll inside the weekly cap, both on the existing Capacitor notification plumbing.
- 90-day bar: a target number of active panelists answering at a defined cadence, skip rate below the fatigue line, zero PII in the Insights store (audited), one publishable finding produced. The number is an open decision; the bar is not binding until it is set.
- Kill criteria: fatigue or uninstall crosses the line and does not recover after caps tighten; or the panel cannot be weighted to a defensible composition; or any PII is found to have crossed into Insights. Any one reverts the feature to internal-signal-only or removes it.

### Track 2: Admin content engine

Concept: "One finding or topic goes in; platform-right drafts come out for review, in the right voice, never posted without a human."

The distribution arm. Without it the flywheel has no second half.

- Product Score: 45 / 65. Track: Standard.
- The honest limit: content is not defensible; the panel behind it is. The engine is a force multiplier on Track 1, resourced as such.
- Draft-and-review only. No posting integration in v1. Scheduling stays with existing tools until volume justifies more.
- Multiple voice profiles, selected per output, never a single default. The disclaimer discipline and the no-APPA-branding wall are enforced inside the engine, with an APPA-reference lint pass flagged for human confirmation.
- Seeded by Track 1. Its highest-value input is a fresh finding, rendered to the open-on-the-number, give-the-read, ask-for-one-thing spine, then handed to review.
- 90-day bar: a weekly volume of review-ready drafts with an editor-acceptance rate above a floor, and zero published pieces that breach the branding or disclaimer walls. Numbers are open decisions.
- Depends on the voice and design system (Section 5).

### Track 3: Professional (attorney) workspace

Concept: an estate-planning attorney manages their clients' plans in one professional workspace, with each client's plan owned by and portable to the client.

This is an acquisition motion as much as a feature. One attorney brings ten or twelve users, and attorneys are the people who turn a PetGuardian plan into an enforceable instrument. It is also clean earned revenue that never touches the data wall.

- Product Score: not yet gated in detail; proposed Major track because it is a multi-tenancy build and raises the security bar.
- Client owns the record. The attorney holds delegated access. If the attorney leaves, the client keeps the plan and can export it.
- Polling consent stays individual. An attorney cannot opt a client into research.
- Stay clear of UPL and privilege. The platform never practices law; the attorney does. Confidentiality and privilege raise the stakes on the Vault, so this is where encryption-at-rest, access logging, and a formal security review become mandatory.
- Revenue: attorney seats are a paid professional tool. This does not conflict with free-forever, which is a promise to pet owners and to the panel, not to professionals. The data wall is untouched by this revenue.
- Gate it on its own before building; do not bolt multi-tenancy onto the single-user model without a Problem Brief and a 90-day bar.

### Track 4: Estate-planner entry point and CLE

Concept: a distinct entry point for attorneys, with accredited continuing legal education on animal-care planning as the wedge that drives adoption and authority.

- Separate entry point and onboarding for attorneys, with their own value proposition (a client-service and differentiation tool), downstream of Track 3.
- CLE is a strong authority and acquisition play aimed exactly at the professionals who drive document execution, and it is grant-fundable as education.
- Partner for accreditation; do not become a provider. CLE accreditation is state-by-state and bureaucratic. Partner with an accredited provider or a state bar rather than earning provider status in fifty jurisdictions. Stage it after the platform has attorney traction.
- Nail the gap stat first. The "high interest, low action" gap (many owners want provisions for their animals, few execute them) is the spine of the CLE and marketing pitch. It must be sourced to a real, dated, citable figure before the pitch is built on it. This is a named research task, not an approximation. See open decisions.

---

## 5. The voice and design system

A shared voice and design system is what keeps reports, posts, plans, decks, and client documents reading as one organization. It is also what lets the content engine stop making style decisions post by post and simply apply them. It is a dependency of Track 2, not an afterthought.

Critical point: this is the venture's own voice and design, not APPA's. The APPA skills are the method borrowed (how to write with demonstrated authority, how to run gates, how to audit for slop). The identity is the venture's own, with the no-APPA-branding wall enforced inside it.

Add both layers.

- Voice layer, built now because it is stable and cheap. Three profiles: an authority profile for LinkedIn and the blog; a warm profile for Instagram and Facebook; a plain-precise profile for client-facing and attorney-facing documents. The not-legal-advice and guide-for-your-attorney disclaimer discipline, the no-APPA-branding wall, source-citation rules, and the clean-room language are baked in as rules, with do and don't examples.
- Design layer, locked once the name and entity are settled. Palette, typography, logo usage, and layout templates for the recurring formats (report cover, one-pager, social graphic, deck, client document). It extends the app's existing look so the app, the generated documents, and the marketing content read as one brand.

Timing: the voice layer proceeds now. The visual design system waits until the name and entity are locked, so a brand is not built around a name that may change. The right durable form for both is a reusable skill that loads automatically whenever a deliverable is produced.

---

## 6. Revenue model

Free for pet owners, forever. Earned revenue comes from three lines, none of which sells user data:

1. Research products: syndicated pulse reports (headline stat free, the cut and the dataset paid and licensed), custom questions, and sponsored research. Research independence is absolute: a sponsor funds access and reach, never a finding.
2. Attorney seats: the professional workspace as a paid tool.
3. Grants: foundation and research funding for the public-good mission.

Offers from retailers or brands, where they exist, are delivered first-party. No third party receives user data, and never any PII. UBIT, if owed on any earned line, is paid.

Standing and outside the ladder: the anonymized and aggregated research to APPA, in perpetuity, free.

---

## 7. Launch tiers

- Track 1 capability rollout: Standard. Member-first, quiet release of the feature with a talk track for why we ask and how data is protected.
- Track 1 first pulse finding: the marquee moment. The first methodology-backed intent read is the proof the flywheel turns and the first real contrast with the periodic survey. Open on the number, give the read and the method, ask for one thing.
- Track 2 engine: Quiet. It is internal; the content it makes is the launch vehicle for everything else.
- Track 3 and Track 4: their own launches once gated, with the estate-planner entry point and CLE as the authority anchor for the professional audience.

---

## 8. Sequencing

Build in the order the loop fills.

Phase 1, now: consumer utility hardening, the voice layer of the system, and the clean-room consent and Insights plumbing.

Phase 2: the polling module (data model, admin authoring, mobile card, caps, JIT triggers), then weighting and the audit.

Phase 3: the content engine, draft-only, seeded first by existing education content, then wired to poll findings. First pulse report once the panel clears its 90-day bar.

Phase 4: the professional workspace (Track 3), gated on its own, with the security review that privilege demands.

Phase 5: the estate-planner entry point and CLE (Track 4), accreditation via partner.

In parallel, not blocked by the phases: the entity decision and formation, because it shapes how the first dollar and the first grant are taken, and the name decision, because the visual design system waits on it.

Do not start Track 2 until Track 1's clean-room wall is built and audited. The content engine must never be able to reach the Vault for a content idea.

---

## 9. Competitive landscape and our edge

A scan of the field (October 2026) across five representative players.

| Player | What it is | Model | Price |
|---|---|---|---|
| Pet Legacia | A startup building nearly our exact consumer concept | Consumer subscription, smart tag, vet and shelter channel | Free "Pet ID" hook, 25 dollars/year monitoring; trust creation marked "coming soon" |
| Rocket Lawyer | Incumbent legal-subscription platform; a pet trust is a loss-leader document | Document free in trial inside a broad legal membership, plus attorney connect | Free in trial, then membership |
| Standard Legal | DIY legal-forms software since 2002 | One-time download, a separate professional edition, attorney-find | 49.95 dollars one-time |
| Montana State Extension | A free authority guide co-authored by a leading pet-trust law professor | Free public education | Free |
| Best Friends Animal Society | An animal-welfare nonprofit using estate-planning content as a planned-giving funnel | Free content into legacy-gift fundraising | Free |

What the field proves:

1. The document layer is a commodity. It is free from Rocket Lawyer in trial and from every animal-welfare nonprofit, and fifty dollars one-time from Standard Legal. The emergency card and caregiver forms are given away by the Humane Society, the ASPCA, 2ndChance4Pets, and Best Friends. No business can stand on generating the trust or the care documents.
2. The educational content space is saturated. A law professor, two national nonprofits, a university extension service, and two legal incumbents already own the "what is a pet trust" explainer. The content engine must lead with proprietary panel data, not an education rehash.
3. Our differentiation holds, and it is narrow: the clean-room research instrument, the estate-planning-attorney channel, and the nonprofit trust structure. None of the five does a data or research model. Only one has a professional channel, and it is pointed the wrong way.

Pet Legacia is the one to watch. It independently reached the same framing (the probate gap, a will is not enough, fifty-state coverage, an emergency card, a protection score, a cost calculator), which validates the problem. But it bets on consumer subscription plus a hardware tag, the same shape as the player that recently abandoned pet-care planning and left the category for housing, and its paid trust product and placement network are still marked "coming soon." It has no research or data model.

### Channel analysis: why vets and shelters fail, and where the real customer is

Pet Legacia's choice of veterinary practices and shelters as its distribution channel is a strategic error and a tell.

- Veterinary practices are increasingly private-equity managed and are measured on procedure and wellness-plan revenue. A mortality conversation competes against everything the practice is incentivized to sell first, and it will not get airtime.
- Shelters are understaffed and overwhelmed by intake. They have no capacity to counsel owners on estate planning, and the lost-pet tag problem their patrons have is already solved by existing products.
- A team that picks this channel is reasoning from where pets are, not from who has the time, the incentive, and the right moment for the conversation. That is an industry-blind call, and it suggests the competitor is not from pet care.

The cleaner architecture, which this plan already favors: attorneys are the acquisition channel, because they own the moment and the client relationship where this conversation belongs. Independent pet retailers and brands are not a distribution channel at all; they are the research customers on the data side (intent to buy, offers, samples). We never ask an overworked vet or shelter to sell anything.

### Our structural edge, named as an asset

Deep pet-industry knowledge. Knowing the channel dynamics, the private-equity economics, the buyer behavior, and where the real conversations happen is the one advantage a funded consumer startup cannot clone. It is why we can route around the mistakes a category outsider will keep making, and it should inform every channel and partnership decision in this plan.

---

## 10. Open decisions (named gaps, not filled with invented numbers)

These need real answers before the bars and pitches that depend on them are binding. They are not filled here with guesses.

1. The venture name and the entity formation timeline (and whether to use a fiscal sponsor as a bridge).
2. Track 1 panel-size target and answer cadence for the 90-day bar.
3. The weekly poll cap and the skip-rate fatigue threshold.
4. The known pet-owner frame to weight the panel against.
5. The first-wave intent question set (the three to five questions that matter most to the first buyers).
6. Track 2 weekly draft target and the editor-acceptance floor.
7. The sourced "interest vs. action" gap statistic, with citation, for the CLE and marketing pitch. Source trail from the landscape scan: the ASPCA Pet Trust Primer and pet-planning pages, the Humane Society "Providing for Your Pet's Future" fact sheet, and the Montana State Extension guide (co-authored by Prof. Gerry Beyer) are the places to nail a real, dated figure.
8. Whether a light participation reward (a relevant first-party offer or sample, never cash, never tied to a specific answer) is in v1 or deferred.

---

## 11. Professional advice checklist

- Nonprofit attorney and tax advisor: entity formation, earned-revenue structuring, UBIT handling, governance (board, bylaws, conflict-of-interest policy, no private inurement).
- IP assignment into the entity, in writing, from the founder and from APPA as applicable.
- Data and privacy counsel: the consent model, the clean-room wall, and the first-party offer mechanism.
- Security review before the professional tier ships, given privilege and confidentiality.
- CLE accreditation partner in the target jurisdictions.

---

## 12. Slop Audit

| The line | The tell | The fix |
|---|---|---|
| "a line no one else can publish" | Edges toward asserting authority. | Kept: immediately backed by the concrete, demonstrable contrast with the periodic survey. On bar. |
| Product Scores (50, 45) and "proposed Major" for Track 3 | False-precision scoring that could decide for you. | Labeled as ranking not deciding; the low representativeness lens is called a standing condition the total does not override; Track 3 explicitly not yet gated in detail. On bar. |
| 90-day bars referencing target numbers | Empty placeholders or invented precision. | Left as named open decisions, not invented. Flagged in Section 10. On bar. |
| Launch tiers split across Standard, marquee, Quiet, and own-launch | Launching everything at one tier. | Differentiated by track. On bar. |
| Kill criteria and 90-day bars present on the gated tracks | A happy-path plan. | Present and specific where tracks are gated; Tracks 3 and 4 explicitly deferred to their own gates. On bar. |
| Access ladder: headline free, cut and dataset paid | Paywalling the headline or giving away the depth. | Correct direction. On bar. |
| Revenue section naming three earned lines | Dressing up a cost saver as revenue, or burying the data-wall promise. | Each line stated plainly; the no-sale and first-party-offer promises stated in the same place. On bar. |
| Watch-words (strategic, leverage, robust, holistic, streamline) | Filler. | Scanned; none load-bearing in the final text. On bar. |
| Competitive table and "the one to watch" | Competitor-bashing or vanity framing. | Claims sourced to five scraped pages; Pet Legacia's "coming soon" status reported as stated, not editorialized. On bar. |
| "Industry knowledge" named as our edge | Asserting an unearned moat. | Tied to a specific, checkable behavior (the vet and shelter channel error) rather than claimed in the abstract. On bar. |

Total: 0 clean breaches; 9 lines checked and justified. Band: on bar. This plan can move to build planning once the open decisions in Section 10 are answered.
