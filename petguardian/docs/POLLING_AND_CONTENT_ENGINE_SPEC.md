# PetGuardian: Micro-Polling + Content Engine Spec

Product-gate spec for the two features that turn the free utility into a data company and its own distribution arm.

Status: G2 draft. Not built. Awaiting owner sign-off on the open decisions in the last section.

---

## How to read this

This runs the two features through the same gates as the pivot brief: G1 Problem Brief, Product Score, G2 Concept and Case, launch tier, and a Slop Audit at the end. The gate methodology is APPA's internal product-development discipline; it is applied here to PetGuardian, which is a separate personal venture. The three lenses are adapted to PetGuardian's situation:

- Mission impact becomes: does it protect more pets and strengthen the free utility, or just chase revenue?
- Member equity becomes user trust and representativeness: does it serve users fairly and produce honest data, or exploit them?
- Financial sustainability is unchanged: does it wash its face?

Three constraints are binding on everything below. They are not goals to balance; they are walls.

1. No APPA branding on the venture. APPA appears only as a cited data source (the National Pet Owners Survey is the reference point we complement) and, per the owner's standing commitment, as a recipient of the anonymized and aggregated research in perpetuity at no cost. APPA's name, logo, and voice never appear on PetGuardian surfaces or in its content.
2. The clean-room wall holds absolutely. Plan and estate data (the Vault) is never joined to poll answers (the Insights plane), never sold, and never leaves first-party control. Poll answers carry no PII and are pseudonymized at write time.
3. Human in the loop throughout. No auto-posting, no unattended data release, no poll logic that fires without a cap.

---

## The strategic frame: one flywheel

These are not two features. They are one loop:

```
free utility  ->  research panel  ->  insights  ->  content  ->  awareness  ->  more users  ->  bigger panel
```

The polling module is the panel's fuel. The content engine is how a panel finding reaches an audience and comes back as new users. Build order follows the loop: polling first, content engine second, seeded by the first findings.

The headline this loop is built to produce, within a year, is a line no one else can publish: a rolling, always-current read on pet-owner intent (intent to acquire another pet, intent to buy a category, switching intent) against a self-serve panel. The National Pet Owners Survey is deep and periodic. This is shallow and continuous. That contrast is the product, not a weakness to hide.

---

# Feature A: Mobile just-in-time micro-polling

## G1 Problem Brief

**The problem, in the buyer's words.** "I find out what pet owners intend to do once a year, in a big batch, months after they decided. By the time I can act on intent-to-buy or intent-to-acquire, the season has turned." Independent pet stores and mid-size brands cannot afford custom panels and get category intent too late and too coarse to act on.

**Who has it and how badly.** Two buyers. Brands and independent retailers who need current intent signals to plan assortment, promotions, and samples. And the research community (APPA among them) that owns depth but not velocity. The pain is real and recurring; the gap is timeliness and continuity, not raw sample size.

**Why PetGuardian and why now.** PetGuardian already holds the one thing a panel needs and cannot buy: a reason for pet owners to come back. The utility earns return visits for care planning; polling rides that existing attention instead of paying to manufacture it. The native shell already carries the plumbing (local notifications are wired for the annual-review reminder; the offline emergency card proves the native surface works), so the marginal build is the poll module and the consent and clean-room wiring, not a new app.

**First-pass Product Score: 50 / 65. Proposed track: Major** (it touches the revenue model and the data instrument, so it gets full gates and explicit kill criteria).

**The weakest part of the case.** Representativeness. A panel self-selected from estate-planning-minded pet owners is not a representative sample of US pet owners, and a data product sold as market truth lives or dies on that. This is the one near-red lens (scored 2 below) and the thing most likely to kill credibility with both brands and APPA. It is addressed head-on in the Concept and Case; if it cannot be mitigated, the feature should not ship as a market-research product and should stay an internal signal only.

## Product Score (ranks, does not decide)

Rated 0 to 5, weighted. Max 65.

| Criterion | Weight | Score | Weighted | Note |
|---|---|---|---|---|
| Buyer / user demand | x3 | 4 | 12 | Buyer demand strong; respondent-side demand modest, which the anti-fatigue design must respect. |
| Mission fit | x3 | 5 | 15 | This is the pivot's core engine; it funds the free utility. |
| Reach and representativeness | x2 | 2 | 4 | The weak lens. Self-selected, skewed panel. Must be actively mitigated. |
| Authority / defensibility | x2 | 4 | 8 | A longitudinal, continuous panel is genuinely novel and hard to copy without the utility underneath it. |
| Financial sustainability | x2 | 4 | 8 | The revenue engine of the whole model. |
| Effort (inverse, lighter scores higher) | x1 | 3 | 3 | Native rails exist; consent, clean-room, and weighting are real work. |
| **Total** | | | **50** | Strong candidate, Major track, with one lens flagged. |

Reading: 50 clears the Major bar, but the reach lens at 2 is a standing condition, not a rounding error. The score does not pass on its own until the representativeness mitigation is credible.

## G2 Concept and Case

**Concept, in a sentence a user would repeat.** "Every so often PetGuardian asks me one quick, anonymous question about my pet, and I can see how other owners answered."

**Three lenses.**

- Mission impact: positive. Keeps the utility free and gives users a small, honest reason to engage. The clean-room wall keeps the care plan untouched.
- User trust and representativeness: mixed. Trust is protected by the anti-fatigue caps, the visible "why we ask / this is anonymous" line, and the clean-room wall. Representativeness is the risk, mitigated as below. Conflict named out loud: the feature is good for users and good for buyers only if we never let panel skew be sold as national truth.
- Financial sustainability: positive. Syndicated pulse reports plus custom question buys, with the utility as a near-zero-marginal-cost acquisition channel.

**Access split.**
- Free / public: the headline pulse stat (one number, one read). This is marketing and it is generous on purpose.
- Member / partner: the full cut, the trend over time, the methodology note.
- Paid: custom questions, segment cuts, raw pseudonymized dataset under license.
- Standing and free, outside the ladder: the anonymized and aggregated research to APPA, in perpetuity, per the owner's commitment.

**Definition of done.** A pet owner on mobile receives, at most within the hard caps, a single poll card; can answer or skip in one tap; sees an aggregate result; and the answer lands in the Insights plane pseudonymized, with the Vault untouched. Consent is captured and revocable. An admin can author a poll, set its JIT trigger, and read only aggregates.

**90-day bar.** At least N active panelists answering at a defined cadence, a measured skip rate below the fatigue threshold, zero PII in the Insights store (audited), and one publishable pulse finding produced. N and the cadence are an open decision below; do not ship the bar without a real number.

**Kill criteria, pre-agreed.** Skip rate or uninstall rate crosses the fatigue line and does not recover after the caps tighten; or the panel cannot be weighted to a defensible composition; or any PII is found to have crossed into the Insights plane. Any one of those sunsets the market-research use and the feature reverts to an internal-signal-only tool or is removed.

**Owner, track, cost, what comes off the plate.** Owner: the founder plus whoever owns the data instrument. Track: Major. Cost: the module build plus the consent and clean-room wiring plus a standing weighting and audit burden. What comes off the plate: the dashboard-embedded survey idea from the pivot brief is replaced by this; do not build both.

## Architecture and wiring

**Two planes, one wall.**

- Vault: existing plan, pet, caregiver, trustee, funding, and user PII. Source of truth for the care product. Never exported, never joined to Insights, never sold.
- Insights: poll questions, pseudonymized answers, and the minimal weighting attributes needed to post-stratify (coarse region, household composition band, pet species or count, acquisition recency band). Keyed by a pseudonymous panelist id that is not the user id and cannot be reversed to it without a secret held only in the Vault boundary and never present in any Insights query path or export.

The pseudonymous id is derived at consent time and stored on the user record inside the Vault boundary; the Insights plane only ever sees the derived id. Enforce with database roles: the Insights query role has no grant on any Vault table. This matches the existing pattern of revoking from anon and authenticated roles on Supabase.

**Consent model.**
- Explicit opt-in, separate from the account terms, with plain-language copy: what is asked, that it is anonymous, that it never touches the care plan, that answers may appear in aggregate research shared with third parties and with APPA.
- Revocable at any time from the account page, alongside the existing account-deletion flow. Revocation stops new prompts and tombstones future use of the panelist id; already-aggregated data is, by definition, no longer individually attributable.
- No poll fires for a user who has not opted in.

**JIT triggers (contextual, event-driven).** Ask when the answer is most salient. Examples: after a pet is added, offer the acquisition-intent question; at the annual-review reminder, offer a category or switching question; seasonally, offer a timely pulse (boarding, gifting). Triggers are data and live admin-side, not hard-coded.

**Anti-fatigue caps (hard, enforced server-side).**
- At most one poll per session.
- At most a small fixed number per week (candidate: two), per panelist, across all triggers.
- Always skippable in one tap; a skip counts and backs off the cadence.
- Every card shows why we ask and that it is anonymous.
- Caps are enforced on the server, not trusted to the client.

**Representativeness mitigation (the standing condition).**
- Capture enough coarse weighting attributes to post-stratify against a known pet-owner frame.
- Label all early output panel-based and directional, never nationally representative, until the panel is large enough and weighting holds.
- Publish a short, honest methodology note with every external figure. This is also an authority asset: showing the method is how you earn trust against a periodic survey, not by claiming to replace it.

**Mobile surface.** In-app poll card as the default passive surface. Occasional push-to-poll for time-sensitive or seasonal questions, inside the weekly cap and the user's notification consent. Both ride the existing Capacitor local-notification and native plumbing.

---

# Feature B: Admin content engine

## G1 Problem Brief

**The problem, in the founder's words.** "A free utility with no ad budget lives on organic reach, and I do not have time to write the same insight four different ways for four platforms, on a cadence, in the right voice, without it drifting into legal advice or brushing against APPA's brand."

**Who has it and how badly.** The founder and whatever small team runs growth. The pain is capacity: the raw material already exists (the education and checklist content, the 50-state statute knowledge, the readiness concepts, and soon the poll findings), but turning it into a steady stream of platform-right drafts is the bottleneck between having a finding and getting reach from it.

**Why PetGuardian and why now.** The content substrate is already in the app, and Feature A is about to start producing publishable findings. Without a distribution arm, the flywheel has no second half. Now, because the engine should exist before the first pulse finding lands so the finding can ship as content the same week.

**First-pass Product Score: 45 / 65. Proposed track: Standard.**

**The weakest part of the case.** Content itself is not defensible; anyone can post. The defensibility lives in the panel data behind it, not the engine. So the engine is a force multiplier on Feature A, not a standalone bet, and should be scoped and resourced as such. Second risk: an over-automated engine that drifts off the branding wall or the legal-disclaimer line. Mitigated by draft-only and human review.

## Product Score (ranks, does not decide)

| Criterion | Weight | Score | Weighted | Note |
|---|---|---|---|---|
| Founder / growth demand | x3 | 3 | 9 | Real internal pull; not user-facing demand. |
| Mission fit | x3 | 4 | 12 | The distribution arm of the free utility. |
| Reach and equity | x2 | 4 | 8 | Content is the main no-cost organic channel. |
| Authority / defensibility | x2 | 3 | 6 | The engine is not defensible; the data it carries is. |
| Financial sustainability | x2 | 3 | 6 | Lowers acquisition cost; cheap to run; no direct revenue. |
| Effort (inverse) | x1 | 4 | 4 | A draft-only generator is a modest build. |
| **Total** | | | **45** | Standard track. |

## G2 Concept and Case

**Concept, in a sentence.** "One finding or topic goes in; platform-right drafts come out for review, in the right voice, never posted without a human."

**Three lenses.**
- Mission impact: positive. Drives awareness for the free utility and recycles content the app already holds.
- User trust and equity: neutral to positive, as long as content stays honest, non-manipulative, and inside the legal-disclaimer discipline.
- Financial sustainability: positive on cost; it is an efficiency tool, not a revenue line. Say so and do not dress it up as revenue.

**Access split.** Internal tool. The output is public content; the engine is admin-only. No public-facing surface.

**Definition of done.** An admin enters a topic or selects a poll finding, picks a platform and a voice profile, and receives a draft tailored to that platform. The draft carries the right disclaimer framing where the topic touches pet trusts or planning, carries no APPA branding, and is stored for review. Nothing posts automatically. Scheduling and posting stay with existing tools (Buffer, Hootsuite, or native) until volume justifies integration.

**90-day bar.** A set number of review-ready drafts produced per week with an editor-acceptance rate above a floor (drafts used with light edits, not rewritten from scratch), and zero published pieces that breach the branding wall or the disclaimer line. Numbers are an open decision below.

**Kill criteria.** If acceptance rate stays low enough that editing from scratch would be faster, or if the engine repeatedly produces branding or disclaimer breaches that review has to catch, it sunsets back to a prompt library and templates.

**Owner, track, cost, what comes off the plate.** Owner: founder or growth lead. Track: Standard. Cost: a draft-generator build plus voice-profile authoring. What comes off the plate: ad-hoc manual drafting for routine posts; the engine is a net capacity gain or it is not worth keeping.

## Architecture and guardrails

- Draft-and-review only. No posting integration in the MVP. Human in the loop on every piece.
- Multiple voice profiles, not one. At least: an authority profile for LinkedIn and the blog (demonstrated authority, a number and a read, no em dashes, no emojis, one concrete ask) and a warmer profile for Instagram and Facebook (emotion, story, community). The profile is a selectable input, not a default.
- Disclaimer discipline matches the documents. Any draft touching pet trusts or planning carries the guide-for-your-attorney, not-legal-advice framing, even in short form. Enforce it as a non-removable element on planning-topic drafts.
- No APPA branding, enforced. APPA may be cited as a data source the way any source is cited; it is never styled as endorsing, owning, or co-publishing. A lint pass flags APPA references for human confirmation before any draft is cleared.
- Seeded by Feature A. The highest-value input is a fresh pulse finding. The engine should take a finding and produce the open-on-the-number, give-the-read, ask-for-one-thing spine automatically, then hand it to review.

---

## Launch tiers

- Feature A, the module rollout: Standard. Member-first, quiet release of the capability itself, with a talk track for why we ask and how the data is protected.
- Feature A, the first pulse finding: Tentpole-adjacent. The first publishable, methodology-backed intent read is the marquee moment. It is the proof the flywheel turns and the first real contrast with the periodic survey. Open on the number, give the read and the method, ask for one thing (read the report).
- Feature B, the engine: Quiet. It is an internal tool; it gets no launch. The content it produces is the launch vehicle for everything else.

---

## Sequencing

1. Polling first. Consent model and clean-room wiring, then the poll data model and the admin authoring, then the mobile card and caps, then JIT triggers, then weighting and the audit.
2. Content engine second, draft-only, seeded by the education content, then wired to take poll findings.
3. First pulse report third, once the panel clears its 90-day bar and weighting holds.

Do not start Feature B until Feature A's clean-room wall is built and audited. The engine must never be able to reach the Vault for a content idea.

---

## Open decisions (named gaps, not filled with invented numbers)

These need a real answer before the 90-day bars are binding. I will not invent them.

1. Panel size target N and answer cadence for Feature A's 90-day bar.
2. The exact weekly poll cap (candidate: two) and the skip-rate fatigue threshold.
3. The known pet-owner frame to weight the panel against (what public distribution we post-stratify toward).
4. The first-wave question set: the three to five intent questions that matter most to the first buyers.
5. Feature B's weekly draft target and the editor-acceptance floor.
6. Whether a light participation reward (a relevant first-party offer or sample, never cash, never tied to a specific answer) is in scope for v1 or deferred, given it can bias answers if done wrong.

---

## Slop Audit (run on this spec)

| The line | The tell | The fix |
|---|---|---|
| "a read no one else can publish" (frame section) | Edges toward asserting authority. | Load-bearing and kept: it is immediately backed by the concrete contrast with the periodic survey, which demonstrates rather than asserts. No change. |
| 90-day bars referencing "N" and "a set number" | Risk of false precision or empty placeholders. | Deliberately left as named open decisions rather than invented figures; flagged in the open-decisions list. On bar. |
| Product Score totals (50, 45) | False-precision scoring that could decide for you. | Explicitly labeled as ranking, not deciding; the reach lens at 2 is called a standing condition that the total does not override. On bar. |
| Launch tiers split across Standard, Tentpole-adjacent, Quiet | Checks against launching everything at one tier. | Correctly differentiated. On bar. |
| Kill criteria and 90-day bars present for both features | Checks against a happy-path plan. | Present and specific. On bar. |
| Access split gives away the headline, charges for depth | Checks against paywalling the headline or giving away the depth. | Correct: headline free, cut and dataset paid. On bar. |
| Watch-words (strategic, leverage, robust, holistic) | Filler tells. | Scanned; none load-bearing in final text. On bar. |

Total hits: 0 clean breaches; 3 lines checked and justified. Band: on bar. This spec can move to build planning once the six open decisions are answered.
