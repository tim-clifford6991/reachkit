# ReachKit — Autopilot quality & discoverability brief

*Owner's brief, 2026-09-10 (drafted with Grok, handed to the master as the working brief for a docs+code change set). It amends BUILD.md §4.6, §7, §8, §9 and adds dated rulings to DECISIONS.md. It does not invent a second product. It tightens the product that already exists: measure → derive a finite list → write one grounded page → Autopilot-publish on the customer's domain → Monday verdict.*

Read first, in this order: this brief → BUILD.md §5, §7, §8, §9 → DECISIONS.md (whole) → ARCHITECTURE.md rows for `src/lib/opportunities/**`, `src/lib/generate/**`, `src/lib/publish/**`, `src/lib/measure/**`, `src/lib/market/**`, `src/lib/presentation/**` → CLAUDE.md.

Do not touch `archive/`. Do not add vendors. Do not inline new numbers — pin them in `src/lib/config/constants.ts` and assert them in `tests/pins.test.ts`. Every sentence the product speaks is a `copy()` key. No emoji. No Copilot promotion in UI, setup, pricing, or mail.

## 0. Product stance (non-negotiable)

ReachKit is a set-and-forget discoverability service. The customer confirms market + rivals + destination once. After that the loop runs without them. That is the product. Copilot (explicit approve) stays in the state machine as a hidden brake for `needs_attention` and for anyone who sets the veto window to "wait forever," but it is not a setup choice, not a plan name, not a headline.

Set-and-forget is allowed only because quality is enforced before a day is filled, not by hoping the founder reads drafts.

One sentence the code must keep true:

> ReachKit only writes when a right-sized rival is winning a specific query or AI answer, only ships pages grounded in the customer's live product, publishes as them on their domain, and leaves the calendar empty when nothing is worth saying.

If a change would make the calendar look "healthy" by inventing work, it is rejected.

Already-correct rulings to preserve:

- Customer is publisher of record. Live on `content.{customer-domain}` or their WordPress. `*.reachkit.app` previews are noindex forever (BUILD §9, site-reputation-abuse guardrail).
- Supply is the cap. Never invent an opportunity to fill a day (BUILD §7; ADR-061).
- Fix-type `unblock` is instruction only. Never generated. Never automated (BUILD §7, §9).
- Mechanical opportunity types. No LLM decides the type (BUILD §7).
- Hard generation rules enforced in code, not prompts (BUILD §8).
- "We make pages structurally citable; we never engineer content to steer what an assistant recommends."
- One automatic regeneration; a draft in review is never regenerated (ADR-070).
- ≤1 publish/day, ≤8/week hard ceiling (BUILD §9).
- Monday verdicts are shown, never hidden (BUILD §9).

## 1. New dated rulings to append to DECISIONS.md

Write these as one-line dated rulings, newest last, same style as the file. Date = day of the docs PR. Exact wording:

1. Autopilot is the product. Setup no longer offers Autopilot vs Copilot. The published mode is Autopilot: generate → veto window → publish. Copilot remains an internal transition (explicit approve) used only when a draft is in `needs_attention` or when the customer sets the veto window to 7 days and acts. No setup radio, no pricing bullet, no mail subject may say Copilot.
2. Set-and-forget quality is a deriver problem, not an approval problem. A day is filled only by an opportunity that passes readiness (`opportunityReady()`). Unready opportunities never enter `planned`.
3. Improve outranks Write. After clustering, the calendar prefers `expand_page` / `answerable_page` / `refresh_page` on an owned URL in the cluster over a new `keyword_page` or `format_page` for that cluster.
4. Opportunities are clustered by parent topic before ranking. The calendar unit is one cluster-day, not one keyword-day. Multiple queries that share a parent topic produce at most one Write target.
5. `keyword_page` is a residual type. It fires only when the extra gates in §3 of the brief all pass. Volume ≥10/mo alone is not sufficient.
6. `format_page` fires only when the missing format is one of the closed demand-bearing formats: comparison, alternative, integration, template. Glossary, changelog, "blog," and "resources hub" do not qualify.
7. A new family Earn exists with type `listed_page`. Trigger: a platform or publisher in `PLATFORM_DOMAINS` (or a measured citing domain) names a rival on a query in the market set and does not name the customer. Autopilot action is first-party only: write a citable asset on the customer's domain that those sources could cite. Autopilot never sends outreach mail.
8. Autopilot default veto window stays 24h, range 1–7 days. 0 days is removed so a draft always has a veto path. Pause remains one click and instant.
9. Empty calendar copy treats emptiness as competence: the system looked, nothing passed readiness or supply. It is never framed as an outage or as ReachKit being stopped unless an account-level stop is actually true (ADR-011 precedence still holds).
10. Monday Not working on a cluster suppresses new Write opportunities in that cluster for `CLUSTER_SUPPRESS_WEEKS` (pin 4). Improve of the live URL in that cluster remains allowed.
11. Answerability pass may not add question-shaped headings as an objective. It may only reorder existing sections, shorten a first block into 40–320 chars when a question heading already exists, and insert customer-sourced evidence already present in the brief. Numeral stuffing to lift evidenceDensity is a hard-rule failure.
12. Hosted destination stays `content.{customer-domain}` for MVP. WordPress posts must be created on a path of the customer's registered domain, never on a ReachKit host. Do not add a shared publishing network.

Owner owes: any UI-SPEC calendar headline that still reads "One page a day. Every day." is rewritten to a key that does not promise a filled grid (copy + UI-SPEC amendment named in the PR body).

## 2. Setup and mode (surfaces)

Files likely involved: `src/app/(account)/**` setup flow (BUILD §4 setup: market, rivals, mode + destination); `src/lib/presentation/copy/`; `src/lib/publish/**` `becomesPublishable()` / veto expiry; Settings screen (`/app` Settings).

Changes:

- Remove mode choice from setup. Destination choice remains: Hosted blog (`content.{customer-domain}`) or WordPress.
- Settings keep: veto window 1–7 days (default 24h), pause, destination, do-not-claim list, brand voice free-text, rivals (max `COMPETITORS_MAX` = 5), market category.
- Delete or stop rendering any copy key that presents Copilot as a product mode. If a key must remain for the approve button on `needs_attention` drafts, the verb is "Publish now" / "Veto", not "switch to Copilot."
- Autopilot path unchanged in the state machine (BUILD §9):

```
planned → generating → in_review → approved → publishing → published
                          ↓ veto                  ↓ fail
                       skipped            failed → retry ×3 → needs_attention
```

  `in_review → approved` still happens when the veto window expires without veto. That is set-and-forget.

- 0-day veto is invalid. Clamp stored values < 1 to 1 in one place (`src/lib/config/constants.ts` + publish settings parser). Pin `VETO_WINDOW_MIN_DAYS = 1`, `VETO_WINDOW_MAX_DAYS = 7`, `VETO_WINDOW_DEFAULT_HOURS = 24`.

## 3. Opportunity deriver (`src/lib/opportunities/**`)

This is the main engineering change. Types live in `types.ts`. Derivation in `derive`. Ranking in `rank`. Winnability in `winnability`. Supply in `supply`. Next-day picker in `next.ts`. Weekly judgment in `verdicts`.

### 3.1 Closed type enum (extend, do not rename)

Keep existing:

| Family | Type | Trigger (existing) |
|---|---|---|
| Write | `answer_page` | AI answer for a question names rivals, not customer |
| Write | `keyword_page` | Rival top-20; customer absent — now residual, see gates |
| Write | `comparison_page` | Gap query names a rival or contains vs/alternative |
| Write | `format_page` | Rivals have a page type customer lacks — narrowed formats |
| Improve | `expand_page` | Customer ranks 4–30, page thin |
| Improve | `answerable_page` | Page has search value, low answerability |
| Improve | `refresh_page` | Ranking page stale vs rivals |
| Fix | `unblock` | Access gate fails — never generated, never automated |

Add:

| Family | Type | Trigger |
|---|---|---|
| Earn | `listed_page` | A `PLATFORM_DOMAINS` host or a measured citing domain names a rival on a market query and does not name the customer |

`listed_page` evidence must include: citing URL, rival named, query, and the first-party asset to write (usually a comparison table, integration page, or original-data page). Acceptance test: "named on question P or customer URL cited on the same host within 8 weeks" — pick one string and keep it stable. Autopilot never emails the citing host.

### 3.2 Parent-topic clustering (new, mechanical)

Add `clusterKey(opportunity) → string` in `src/lib/opportunities/` (new file or inside derive). Rules, no LLM required for v1:

- If the opportunity already has a target URL on the customer's domain, `clusterKey` = canonical customer URL.
- Else if the query contains vs / versus / alternative / a confirmed rival hostname or brand from `deriveRivals()`, `clusterKey` = `compare:{customer}|{rival}` (one cluster per rival).
- Else `clusterKey` = the query that sends the most estimated traffic to the current #1 URL for that query among the measured SERPs (parent-topic approximation). If SERP #1 is a `PLATFORM_DOMAINS` host, fall through to the highest-volume non-platform URL. If none, `clusterKey` = normalized query string.

After derivation, collapse: one opportunity survives per `clusterKey`. Survivor = highest rank after the Improve-outranks-Write sort in §3.4. Losers are stored as `absorbed_queries[]` on the survivor (needed for the outline and for Monday tests). They do not get their own calendar days.

Pin nothing magic here except `CLUSTER_SUPPRESS_WEEKS = 4`.

### 3.3 `keyword_page` extra gates

A `keyword_page` is ready only when all of these are true:

1. Existing winnability: top-10 contains a domain with ranked count ≤ max(500, 5× customer) (BUILD §7). Unchanged.
2. Customer has no owned URL already in this `clusterKey` (otherwise emit Improve on that URL, not Write).
3. Query volume ≥ `KEYWORD_PAGE_MIN_VOLUME` — pin 50, not 10. The old "≥10/mo" trigger stays as discovery input if you want, but it cannot pass readiness at 10.
4. Intent is one of: comparison, alternative, commercial-investigational, or a how-to that the customer's live pages already evidence. Informational commodity ("what is {category}", "{category} in 2026", "{category} tips") fails readiness.
5. The current #1 is not a thin listicle we would only clone. Practical test: #1 word count below `THIN_RIVAL_WORDS` (pin 400) and no table/FAQ in the fetched HTML → fail readiness (we will not be the 12th clone).
6. Near-duplicate: proposed slug/title vs published set would fail the 85% gate → do not plan it.

If gates fail, the row may remain in the opportunity table as rejected/unready for debugging, but `supplyDepth()` and `next.ts` must not see it as fillable supply.

### 3.4 Ranking and precedence

Keep one list and the existing formula shape demand × intent × (1−effort) × fit in `rank`. Apply a stable sort key before that score:

1. Family order: Fix (shown, not scheduled) → Improve → Earn → Write.
2. Inside Write: `comparison_page` → `answer_page` → `listed_page` if you parked it under Write instead of Earn → `format_page` → `keyword_page`.
3. Then the numeric formula.
4. Then cluster collapse.

`fit` should rise when the brief can attach ≥1 live-page fact from measure / fetched customer HTML. If no fact can be attached, readiness fails (see §4). Winnability bands (Winnable / Reach / Not-yet) unchanged. Not-yet never fills a day.

### 3.5 Readiness — `opportunityReady()`

New exported function in `src/lib/opportunities/` (likely `pass.ts` or a new `ready.ts`). `next.ts` may only return an opportunity where this is true. Readiness checklist (all must pass):

1. Type-specific gates above.
2. Winnable or Reach, never Not-yet.
3. Evidence fields present: query, rival or citing URL, target slug+title or target URL.
4. At least one grounding candidate: a fact extracted from the customer's fetched HTML (price, limit, integration name, feature string, dated claim already on their site).
5. For `comparison_page`: a table skeleton with ≥3 rows whose cells can be filled from customer HTML plus the rival's fetched HTML. If a cell would require invention, readiness fails and the day stays empty.
6. Not in a cluster suppressed by Monday Not working (`CLUSTER_SUPPRESS_WEEKS`).
7. Not a near-duplicate of a published or in-flight draft.
8. `unblock` is never ready for generate.

When supply after readiness is zero, `supplyDepth()` reports zero and the calendar shows the empty-competence line. Do not lower gates to fill a week.

### 3.6 Cadence constants (Autopilot still set-and-forget)

Keep hard ceiling: `PUBLISH_MAX_PER_DAY = 1`, `PUBLISH_MAX_PER_WEEK = 8`. Add operating preference, also pinned: `AUTOPILOT_WRITE_MAX_PER_WEEK = 4` — Autopilot will not schedule more than 4 Write-family publishes in a local week. Remaining slots may be Improve or Earn. Weekends stay eligible. Do not special-case Saturday. Emptiness handles rest. Jobs already generate the evening before publish (BUILD §8). Unchanged.

## 4. Generation (`src/lib/generate/**`)

Pipeline stays: brief (nano) → outline (nano) → grounded draft (Haiku) → answerability+SEO pass (Haiku) → claim check (nano). Call sites stay inside `LLM_CALL_SITES`. `CAP_DRAFT` (45¢) still enforced before the pipeline.

### 4.1 Brief must carry product evidence

The brief (nano) is only allowed to include: `clusterKey`, type, target query + `absorbed_queries`; rival evidence URLs; extracted facts from customer HTML (and rival HTML for comparisons), each with source URL + read date; do-not-claim list; brand voice free-text; acceptance test string.

If extracted facts is empty, do not call Haiku. Mark the opportunity unready, skip the day, ledger nothing toward `CAP_DRAFT` except the nano brief if it already ran. Prefer failing before Haiku.

### 4.2 Hard rules — keep and extend (`src/lib/generate/rules`)

Existing, still enforced in code: Grounded (≥1 verifiable fact from the customer's own live pages, source URL + read date, highlighted in draft view); no invented people / bylines / personas; not a doorway (first 300 chars contain no brand mention); do-not-claim list, string/semantic, fail → regen once → `needs_attention`; near-duplicate ≥85% vs published set → never queued; no invented rival metrics, every rival claim links a public source; brand voice = one free-text field, nothing learned.

Add, enforced in `runHardRules()`:

8. No invented tests ("we tried 14 tools", "our team used X for 6 months") unless that sentence already exists on a customer live URL in the brief facts.
9. No fake author, datePublished of experience, or stock case study.
10. Answerability pass output must not increase the count of question-shaped headings by more than `ANSWERABILITY_MAX_NEW_QUESTIONS` — pin 0. Reordering only.
11. Evidence added in the pass must be traceable to brief facts. New numerals not present in brief facts → claim-check fail.
12. First 40–320 character block after the first heading must answer the target question. Brand still banned in first 300 chars.

`claimCheck()` already validates grounding. Extend it for rules 8–11 rather than adding a second model judge.

### 4.3 Type-specific skeletons (outline stage)

Outline (nano) must follow a closed skeleton per type. Do not let Haiku pick a blog-post shape.

- `comparison_page`: H1 question → 40–80 word answer → comparison table (≥3 rows from brief) → "who should pick whom" → source lines. No "what is {category}" preamble.
- `answer_page`: H1 = the question the AI answer ranked → direct answer → evidence from customer pages → one section the rivals were cited for, answered with customer facts.
- `expand_page` / `answerable_page` / `refresh_page`: operate on the existing URL's outline; add or replace sections; do not invent a new slug.
- `keyword_page` (rare): same as `answer_page`, plus absorbed queries as H2s only when each H2 can be answered from brief facts.
- `format_page`: only comparison / alternative / integration / template skeletons.
- `listed_page`: one citable object (table, numbered spec, dated stat with methodology). Short page. The object is the point.

Customer identity or none. Never "ReachKit editorial."

## 5. Publishing & hosted CMS (`src/lib/publish/**`, `src/app/(hosted)/**`)

Unchanged and must stay unchanged unless a named issue says otherwise: idempotent `(draft_id, destination)` (ADR-080); draft-by-default, then Autopilot approve on veto expiry; verify +24h: reachable, indexable, in sitemap, AI-readable (`verifyLive()`); hosted robots.txt allows the pinned `AI_READER_AGENTS` list (ADR-022, ADR-090); preview host noindex forever; FAQPage schema only when a real FAQ block exists in the published HTML; WordPress: REST + app password, encrypted at rest, revoke on disconnect, visible findability stamp + invisible idempotency marker (ADR-083); Fix never automates; Pause is one click and instant.

Do not build outreach sending, comment spam, directory-submission bots, or `llms.txt` stuffed with claims absent from the live page.

Preferred future (do not implement in this brief unless the issue is scoped to it): WordPress/path on apex inherits more than `content.` subdomain. MVP hosted destination stays as specified.

## 6. Monday loop (verdicts, weekly/refresh job)

Keep `judgeWeek()` / `readWeek()` / `weeklyDigest()`. Each live publication is Working / Too early / Not working against its acceptance test. Add:

- Persist `clusterKey` on the publication record (already: opportunity id, target query, measurement date, approved-vs-autopilot, live URL — extend with `clusterKey`).
- Not working → suppress Write in that cluster for `CLUSTER_SUPPRESS_WEEKS`.
- Two consecutive Not working on Improve of the same URL → stop scheduling that URL; surface one Settings line via existing `HealthReason` / needs-you patterns, not a new health state.
- Digest mail already exists. Do not add "you published 7 pages" as a success metric. Movement copy should name score band, accepted tests that moved, and empty-days-as-planned if supply was zero.

GSC remains postponed (2026-09-03 owner ruling). Do not sneak a GSC integration into this brief.

## 7. Scoring (`src/lib/measure/**`) — do not retune the cube root

BUILD §5 formulas stay. Do not change Foundations / Answerability / Presence / cube-root score to "make Autopilot look effective." Allowed follow-on (separate issue only): when measuring customer pages that are JS-only shells, record not judgeable rather than a fake 0 (ADR-071 four-way split). Out of scope unless the issue names it. Answerability remains a measured property of HTML, not a target the generator is allowed to game (ruling 11 in §1).

## 8. Copy and calendar chrome

BUILD §4.6 calendar currently headlines "One page a day. Every day." That fights ADR-061 and this brief. Replace with copy keys (owner writes final words; ship `TODO(copy)` if needed, never invent brand voice):

- Calendar headline: the service publishes when something passes readiness, at most once a day.
- Empty day: looked, nothing ready; this is working as designed.
- "If you do nothing": the draft publishes when the veto window ends. Veto is available until then.
- Overview must not celebrate raw publish counts. Celebrate Monday movement and score band.

Do not mention Copilot. Do not mention "content engine," "blog automation," or "50 posts a month." Mail kinds stay under `src/lib/mail/templates/<kind>/`. Progress email already Monday-gated (ADR-060). Same rule: no vanity publish totals.

## 9. Tests the agent must add or extend

Follow CLAUDE.md: only the test files for code you touch, `npx vitest run … <paths> --maxWorkers=1`. CI runs the rest. Minimum new coverage:

- derive / pass / ready: `keyword_page` at 10 vol is not ready; at 50+ with no owned URL and non-commodity intent can be ready.
- Cluster collapse: two queries sharing parent topic → one planned day.
- Improve on owned URL beats Write for same cluster.
- `format_page` for "glossary" is not derived.
- `comparison_page` without a groundable table is not ready.
- `opportunityReady()` false → `next.ts` returns empty for that day.
- `runHardRules()`: invented "we tested 14 tools" fails; extra question-H2 from answerability pass fails; brand in first 300 chars still fails.
- Veto window 0 clamps to 1.
- Setup has no mode radio (presentation/conformance test if that is how setup is locked).
- Pins test includes every new constant.

Do not run the full unit or layout suite locally.

## 10. Constants to pin (`src/lib/config/constants.ts`)

Add only these (names may match house style; keep them in the pins test):

```
VETO_WINDOW_MIN_DAYS = 1
VETO_WINDOW_MAX_DAYS = 7
VETO_WINDOW_DEFAULT_HOURS = 24
KEYWORD_PAGE_MIN_VOLUME = 50
THIN_RIVAL_WORDS = 400
AUTOPILOT_WRITE_MAX_PER_WEEK = 4
PUBLISH_MAX_PER_DAY = 1          // already exists; do not fork
PUBLISH_MAX_PER_WEEK = 8         // already exists; do not fork
CLUSTER_SUPPRESS_WEEKS = 4
ANSWERABILITY_MAX_NEW_QUESTIONS = 0
FORMAT_PAGE_ALLOWED = ['comparison', 'alternative', 'integration', 'template']
```

Do not change `CAP_DRAFT`, `COMPETITORS_MAX`, `QUESTIONS`, `SERP_LOCATION`, or cost caps.

## 11. Suggested issue split (one issue = one PR)

Do not pad scope. Open separate issues and implement in this order:

1. **Docs.** Append §1 rulings to DECISIONS.md. Patch BUILD.md §4.6 headline note, §7 table + readiness + cluster + Earn family, §8 hard rules 8–12, §9 Autopilot-as-product and veto min 1 day. Name the amendments in the PR body under Corpus.
2. **Pins + types.** Constants, `types.ts` enum + `clusterKey` + `absorbed_queries` + readiness fields.
3. **Deriver.** Cluster, gates, Improve-outranks-Write, `opportunityReady()`, supply/next ignore unready.
4. **Generate.** Brief facts required; skeletons; hard rules 8–12; answerability pass cap.
5. **Setup/Settings/copy.** Remove mode choice; clamp veto; empty-day competence copy keys.
6. **Verdicts.** Cluster suppress on Not working.
7. **Earn `listed_page`.** Can land after 1–6. Do not block 1–6 on outreach fantasy.

If only one issue is opened, do 1 + 2 + 3 and stop. Deriver readiness is the whole game.

## 12. Explicit non-goals (reject if they appear mid-PR)

Promoting Copilot or adding a mode picker back. Daily-page guarantees, padded calendars, or lowering readiness to keep streaks. Programmatic location / "{tool} for {persona} in {city}" pages. Shared blog network, expired-domain hosts, guest-post exchange. Auto outreach, directory blasts, fake reviews, prompt-injection for assistants. GSC, new vendors, JS rendering of customer sites, locale expansion (`SERP_LOCATION` stays US-en). Changing the Discoverability Score formula so publishes "work." Per-customer hosted templates. Invented product sentences in `copy()`. Touching `archive/`, adding dependencies, or importing `src/app/**` from `src/lib/**`.

## 13. Acceptance for the whole program

Done when: a typical small-product fixture with many rival keywords produces few planned days, mostly Improve + `comparison_page`, not a `keyword_page` for every tail; Autopilot can run unattended for a week without human approve, and will skip days rather than invent pages; a draft still cannot ship without a live-page fact, cannot name the brand in the first 300 characters, cannot invent rival numbers, and cannot add FAQ wallpaper to chase Answerability; Monday Not working slows that cluster instead of doubling output; no user-facing string tells them they bought a blog mill or a Copilot seat.

That is set-and-forget that can raise discoverability without walking the customer into scaled-content abuse.
