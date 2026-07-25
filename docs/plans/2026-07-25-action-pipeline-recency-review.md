# Action-generation pipeline review + recency + UI, merged with M & Phase D (2026-07-25)

Owner feedback (plausible.io plan walkthrough): the plan proposed **pre-launch "waitlist" actions for a live, established product**, told the user to **"post into Plausible's own GitHub"** (self-targeting), surfaced **5–8-month-old community threads** ("date unknown", one dead link), and has three UI annoyances. Root cause: review the action-generation pipeline. Merge the fix with M (inline-expand) + Phase D (calibration).

## Diagnosis (agent-verified, cited)

### A. Actions — why a live product got pre-launch validation cards
1. **Cold-start misclassification (THE root).** `isColdStart` (`lib/scan/cold-start.ts:44-61`) web branch = `domainAgeYears>=1 ? false : (competitors.length===0 && themes.length===0)`. It **deliberately ignores** ranked-keyword/SERP/brand footprint (comment `cold-start.ts:52-56`). Two failures compound:
   - `themes.length===0` is now **always true** (reviews retired → `collect.ts:75` hardcodes `reviews:[]` → `facts.ts:24` themes always `[]`). Half the AND is dead-true.
   - The only "established" guard is `domainAgeYears>=1`, from a **4s archive.org CDX call that routinely times out to null** (`adapters/domain-age.ts:14-19`). Null → skip the guard.
   - So a live product with a thin SPA homepage that yields **0 discovered competitors** → cold-start=true. plausible (1,425 ranked keywords) hit exactly this.
2. **Cold-start actions are a HARDCODED template**, not an LLM/growth decision (`lib/llm/cold-start-actions.ts:50` `coldStartActionsFrom`): "Ship a waitlist page" `:56`, "Share the waitlist in {communityA}" `:84`, "$50 search-ad test → waitlist" `:150`, "Decide: keep/sharpen/pivot" `:191`. Fire ONLY on cold-start; **skip the critic** (`full-scan.ts:473`). The established path (`generateActions`, `lib/llm/actions.ts:252`) is a separate LLM growth generator plausible never reached.
3. **Self-targeting bug.** Cold-start community targets = `grounding.communities[0]` = **Hacker News Algolia hits** (`find-communities.ts:47` → `hn-algolia.ts:16`). An HN story *about* plausible titled "Simple and privacy-friendly alternative…" links to `github.com/plausible/analytics` → becomes "community #1" → the action's target is the subject's OWN repo. **No self-property guard anywhere.**
4. **Competitor/referral insight is NOT used by the paid action generator.** `synthDistribution` (`synthesis/synthesize.ts:173-234`) DOES use `funnel.channelsMissing` ("channels feeding N rivals that self is ABSENT from"), `discoveryChannels`, community pockets — exactly what the owner wants — **but it's wired only to the `/api/app/*` intel/plan-generate routes, NOT the paid full-scan.** The paid scan's `generateActions` gets positioning + competitor_gap (mention COUNTS only) + keyword_data + findings — no referral/channel funnel. Cold-start is even thinner.

**Single highest-leverage root cause:** the cold-start classifier has no reliable "established product" signal. Honor ranked-keyword/SERP footprint (the data the scan already has) and the whole waitlist cascade stops.

### B. Recency — why threads are 5–8 months old
- Demand threads = DataForSEO SERP `site:reddit.com "{pain}"` (`demand/search.ts:28,105`). The recency lever (`tbs=qdr:`) EXISTS and is plumbed, but `discoverDemand` calls `searchDemand(lq.query)` **with no opt → defaults `qdr:y` (1 year)** (`demand/index.ts:92`, `search.ts:118`).
- `publishedAt` null for ~all Reddit (SERP returns no timestamp) → "date unknown".
- Recency weighting is a **no-op**: null date → flat `0.7` (`pockets.ts:29`), ~all null → pure-intent ranking; and the customers UI re-sorts by intent only (`buyer-thread-feed.tsx:72`, `customers-view.tsx:58`). A dateless thread can outrank a fresh dated one.
- **No liveness check** → removed thread 404s on click (the "server error"). Reddit 403s server-side → real dates/engagement/liveness need the deferred **Reddit OAuth** (`thread-activity.ts:31`, memory reachkit-reddit-demand-data-gap).

### C. UI
- Details button inline after evidence (`plan-entry-card.tsx:356`) → moves with content length. → constant position.
- Calendar renders a **fixed month grid** (`plan-timeline-view.tsx:441`) → on the 25th, days 1–24 are dead. → rolling window from today.
- Top-3-by-horizon shown; rest behind a "+N more" toggle (`plan-timeline-view.tsx:228`). → one consistent list.

## The merged plan (prioritized)

**Workstream A — Action pipeline (the core):**
- **A1 (root):** cold-start classifier honors real footprint. A subject with meaningful ranked-keyword/SERP presence (or a resolvable domain age) is NEVER cold-start. Fix the dead-true `themes` term. Guard: a calibration-style test over real footprints (plausible = established, a true pre-launch fixture = cold-start).
- **A2:** wire the referral/competitor planner into the paid action plan — bring `synthDistribution`'s `channelsMissing`/`discoveryChannels`/competitor-referrer signal into the paid generator (the good planner exists; it's on the wrong surface — a consolidation, one pipeline).
- **A3:** self-property guard — a distribution/community target may NEVER be the subject's own domain/property (drop or reclassify HN-hits that link to the subject).
- **A4:** established-product action quality — replace pre-launch validation with growth moves grounded in competitor referrers + channels-missing + recent demand (e.g. pursue the directories/communities/press feeding rivals; relaunch surfaces like Product Hunt where relevant; win the keyword gaps). Deep, specific, evidence-cited.

**Workstream R — Recency-first threads:**
- **R1:** default the demand sweep to `month` (add `week`) — pass recency through `gatherDemand`→`discoverDemand`→`searchDemand`.
- **R2:** make recency a real ranking factor end-to-end (fix the null-date default + the intent-only UI sort).
- **R3:** liveness — a cheap HEAD/status check drops 404 threads before they render.
- **R4 (durable, needs keys):** Reddit OAuth for real `created_utc` + engagement + liveness (owner decision — needs REDDIT_CLIENT_ID/SECRET).

**Workstream U — Plan UI:**
- **U1:** constant details-button position. **U2:** calendar auto-focus (rolling window from today, no dead days; show into next month). **U3:** one consistent task list (retire the +N dropdown).

**M — inline-expand vs the shared EvidenceDrawer** (app-wide interaction; folds in here because the plan detail + thread evidence are the surfaces).
**Phase D — score recalibration + calibration corpus** (validated pass). Note A1's cold-start fix and D's footprint-honoring share the same "trust the real ranked-keyword footprint" theme — do A1 in a way that's compatible with D.

## Sequencing
A1 (root, unblocks everything) → A2/A3 (grounded, self-guarded actions) → R1/R2/R3 (recency) → A4 (deep established-product actions, now with referral + recent-demand context) → U1/U2/U3 (UI) → M → Phase D. R4 (Reddit OAuth) + any credit-bearing re-scan validation gated on owner.
