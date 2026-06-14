# ReachKit vs. Marc Lou's "32 Principles of a Viral Product" — Audit & Plan

**Date:** 2026-06-14
**Scope:** Marketing surface (`app/(marketing)`, `components/sections`, OG image, pricing, funnel entry) reviewed against all 32 principles.
**Source of truth for ReachKit:** `REACHKIT_SPEC_V2.md`, live landing composition in `app/(marketing)/page.tsx`.

> Marc's own framing: *"These are not rules. They're patterns. Use them as a compass, not a checklist."* Several principles assume a **one-time-purchase, single-feature, hard-paywalled product**. ReachKit is a **continuous SaaS with a deliberate PLG free-scan wedge**. Where a principle fights that strategy, this audit says so explicitly rather than recommending a self-defeating change.

---

## 1. Scorecard (all 32 at a glance)

Legend: ✅ strong · 🟡 partial / improvable · 🔴 gap · ⚠️ conflicts with deliberate strategy (judgment call)

| # | Principle | Status | One-line verdict |
|---|-----------|:---:|---|
| 1 | No free plan | ⚠️🟡 | Free *scan* is a lead magnet (good); but pricing lists "Free — $0 forever" as a standing **plan**, which reads leech-y. Reframe. |
| 2 | Three colors | 🟡 | Cream/ink/honey is disciplined — but feature cards add blue+amber+green accents. 5 colors fighting. |
| 3 | Numbers not adjectives | ✅ | "~90 sec", "0–100", "18 signals", "$29". Strong. A few stray adjectives. |
| 4 | Footer people want to share | 🔴 | Footer is generic nav + legal. No memorable closer, no share hook. |
| 5 | OG = YouTube thumbnail | 🟡 | Exists, on-brand, but text-heavy, low-contrast cream, no number/score punch. |
| 6 | One idea per screen | ✅ | Section-composed; each band carries one idea. |
| 7 | Fifth-grader headline | ✅ | "Find out exactly why your product isn't getting found." |
| 8 | Hard paywall | ⚠️ | Deliberately *not* — free scan → email gate → paid. The PLG wedge. Keep, but see #1. |
| 9 | Copy only you could write | 🟡 | About page has founder POV; landing copy is generic SaaS ("Everything a solo founder needs"). |
| 10 | Show before explain | 🟡 | "Watch a scan happen" is an *animation*, not the real product. Teardowns help. |
| 11 | Does one thing | 🟡 | Core is "discoverability," but bento lists 7 features → Swiss-army risk. |
| 12 | Popcorn pricing (3) | ✅ | Free / Solo / Growth = Good/Better/Best. |
| 13 | Rides a wave | 🟡 | AI + #buildinpublic underleveraged; hero never says "AI". |
| 14 | Steal copy from customers | 🔴 | No VOC yet (pre-launch). No testimonials to mine. |
| 15 | Founder you can see & hear | 🔴 | Tim is named on /about; no face, no video anywhere. |
| 16 | Pricing in header | ✅ | "Pricing" is a top-nav link. |
| 17 | Headline remembered next day | 🟡 | Clear, not sticky. Never A/B'd against alternatives. |
| 18 | Emotional headline | 🟡✅ | "isn't getting found" taps real founder pain; could go harder. |
| 19 | Something never seen | ✅ | Discoverability **Score** + **action verification** is a genuinely fresh combo. |
| 20 | Sellable from hero alone | ✅ | Headline + subhead + scan input, all above fold. |
| 21 | Empathy before sell | 🟡 | About page does it; landing hero jumps straight to solution. |
| 22 | One CTA | ✅ | Hero = a single scan input. Clean. |
| 23 | Memorable name | ✅ | "ReachKit" — real words, no explanation needed. |
| 24 | Sell desire, not feature | 🟡 | "Get found" = good desire; subhead reverts to features (score, gap, steps). |
| 25 | Try before buy | ✅ | The free scan **is** the try-before-buy. Best-in-class here. |
| 26 | No weak words | 🟡 | Mostly strong; stray "everything", "more". |
| 27 | No subscription | ⚠️ | ReachKit **is** subscription. Justified (continuous monitoring) — Marc's own exception. Consider annual + one-time pack. |
| 28 | CTA says what happens | ✅ | "Scan my product →". Textbook. |
| 29 | No launch without testimonials | 🔴 | Zero on the page. **Highest-leverage pre-launch gap.** |
| 30 | Describe in <10 words | ✅ | "The distribution system for solo founders" (6 words). |
| 31 | Compare to competitors | ✅ | Comparison table vs ChatGPT + SparkToro. |
| 32 | More expensive than competitors | ⚠️🔴 | $29 vs SparkToro $38–225 → ReachKit is the *cheaper* option. Deliberate (pre-revenue ICP), but "nobody talks about the second cheapest." |

**Tally:** ✅ 11 · 🟡 11 · 🔴 5 · ⚠️ 5 (some double-coded). The product is already strong on structure, clarity, and the try-before-buy wedge. The real gaps cluster in **trust/proof (14, 15, 29), copy distinctiveness (9, 24), the shareable footer/OG (4, 5),** and **three deliberate strategic forks (1/8, 27, 32).**

---

## 2. Principle-by-principle review

### Trust & proof — the biggest cluster of real gaps

**#29 No launch without testimonials 🔴 / #14 Steal copy from customers 🔴 / #15 Founder you can see & hear 🔴**
There is no social-proof section anywhere in `page.tsx`. The `recent-scans` marquee shows anonymized scores ("journaling app · 63/100") — that's *activity*, not *endorsement*. A first-time visitor is asked to trust a black-box AI score with zero human vouching.
- **Research/why it matters:** For an unknown indie tool, proof is the conversion bottleneck, not features. Nielsen/Baymard-class findings consistently put testimonials, founder identity, and specific outcomes among the top trust signals; a score from an anonymous tool reads as "marketing" until a human stands behind it.
- **ReachKit-specific play:** You already have five real teardowns (Bearable, Opal, CardPointers, Sofa, Nudgi) and a build-in-public motion. That *is* your proof inventory before you have paying customers:
  - Founder quote/photo + a 60–90s Loom ("here's the scan that made me build this").
  - Beta/teardown subjects' reactions as quasi-testimonials ("the gap it found on my subtitle was real").
  - A live counter: "X products scanned this week" (you have `recent-scans` data already).
  - As paid users arrive, harvest their exact words (#14) for headline/subhead rewrites.

**#21 Empathy before sell 🟡 / #24 Sell desire not feature 🟡**
The hero opens on the *solution* ("Find out why…"). The about page nails empathy ("Most products don't fail because they're bad. They fail because nobody can find them.") — that line belongs higher up.
- **Play:** Add one empathy beat between hero and features: *"You shipped it. You posted once. Then… silence. The people who'd love it are searching — they just land on someone else's listing."* Then the score as the relief.

### Copy distinctiveness

**#9 Copy only you could write 🟡 / #26 No weak words 🟡 / #17 & #18 Memorable, emotional headline 🟡**
"Everything a solo founder needs to get found" is copy any competitor could paste. The distinctive assets — the teardown voice, "the hands of 20 people," "distribution is a black box you either ignore or pay an agency a fortune for" — are buried in spec/about.
- **Play:** Pull founder-voice lines forward. Write 5 headline candidates, ship the OG/hero A/B (#17's literal method). Candidates to test against the current one:
  - "Your product isn't bad. It's invisible." (emotional, #18)
  - "You can build. You can't get found. We fix the second one."
  - "A discoverability score for the product you can't get anyone to see."

### Color & visual discipline

**#2 Three colors 🟡**
Base palette (cream `#faf6ef` / ink `#2a2018` / honey `#b3792d`) is correctly 3. But `FEATURE_CONTENT` cards carry per-card `accent: "blue" | "amber" | "green"`. That's the rainbow Marc warns about — every card fights for attention.
- **Play:** Collapse card accents to the single honey accent (or neutral + honey for the one "hero" card). Keep the Buy/Scan button as the one place color screams.

### The shareable surface

**#4 Footer worth sharing 🔴 / #5 OG thumbnail 🟡**
97% won't buy but might share — and your *whole GTM is a share loop* (score-badge image, build-in-public). Yet the footer is pure utility and the marketing OG is a quiet cream card.
- **Footer play:** End strong — a founder sign-off line, a "Scan your product, share your score" band, or the score-badge teaser. Make the last thing they see the thing they'd screenshot.
- **OG play:** The `/report` route already overrides with a score badge (good). The *marketing* OG should borrow that energy: a big number, high contrast, a "34/100 — here's what's missing" framing. Treat it like a thumbnail that must earn the click.

### Show, don't tell

**#10 Show before explain 🟡 / #25 Try before buy ✅**
The free scan is your show-don't-tell trump card (#25 is genuinely excellent). But above the fold, the "show" is a *simulated* `ScanScrollSequence`. A real 8–12s scan recording (or an interactive sample report a click away) converts harder than an abstract animation.

### "One thing" & the wave

**#11 Does one thing 🟡 / #13 Rides a wave 🟡 / #30 <10 words ✅**
Positioning ("distribution system for solo founders") is tight. The 7-card bento dilutes it. Lead with the *one* outcome (your score + this week's plays); demote the rest to "what's inside." And the AI wave is invisible in the copy — for the 2026 indie audience, "AI reads your live listing the way a customer's search does" is free narrative lift (#13).

### The three strategic forks (your call — they change the build)

**#1 / #8 — Free plan vs hard paywall ⚠️**
Your PLG free-scan wedge is the right call for a pre-revenue ICP and is *not* the "free plan leech" Marc attacks — a one-shot scan is a lead magnet, not standing free usage. **But** the pricing table presents "Free — $0 — forever" as a co-equal plan with its own CTA, which imports the exact downside (signals it's a destination, invites freeloading expectations). Cheap fix: reframe that column as "Scan (demo)" not a forever plan, and let the paywall bite right after the report. *No business-model change, just framing.*

**#27 — Subscription vs one-time ⚠️**
A continuous monitoring engine genuinely needs recurring revenue — this is Marc's stated exception ("unless you can't ship without it"). Keep the subscription. Two softeners worth testing: an **annual** option (cheaper to sell, better cash) and a **one-time "Deep Scan" pack** as a low-commitment on-ramp for the subscription-fatigued.

**#32 — Price level ⚠️🔴**
At $29 you are the *cheapest* named option (SparkToro $38–225). "Nobody talks about the second cheapest." This is a deliberate pre-revenue-ICP choice, and there's real logic to it — but it's the principle you're most clearly *against*, so decide it consciously. Options: hold $29 (volume/ICP fit), or move Solo to $39–49 and anchor with a premium tier, letting price signal quality.

---

## 3. The plan — prioritized

### P0 — Pre-launch trust & framing (cheap, highest conversion leverage)

1. **Add a social-proof section** between the comparison table and pricing (or right under the hero):
   - Founder quote + photo, 2–3 teardown-subject reactions, "X products scanned" live counter.
   - Net-new component `components/sections/social-proof.tsx`, content object in `page.tsx`.
2. **Founder presence (#15):** photo + 60–90s Loom on `/about` and a compact founder strip on the landing page. "Built by Tim, a solo founder who…" with a face.
3. **Reframe the "Free" pricing column (#1):** relabel to "Scan" / "Demo", drop "forever", make the paywall the obvious next step. ~10-line copy change in `PRICING_CONTENT`.
4. **Color discipline (#2):** collapse `FEATURE_CONTENT` card accents to one honey accent. Small edit.
5. **Empathy beat (#21/#24):** insert one problem-empathy band before `FeatureBento`; pull the "products don't fail because they're bad" line up from /about.
6. **Headline A/B prep (#17/#18/#9):** draft 5 candidates, wire one alternative behind a flag or simple split; mine for distinctiveness.

### P1 — Show & share

7. **Real product demo (#10):** replace/augment the simulated scan with an 8–12s real scan recording or a one-click interactive sample report.
8. **Shareable footer (#4):** add a "Scan your product, share your score" closer band above the utility footer.
9. **Marketing OG punch-up (#5):** redesign `app/opengraph-image.tsx` around a big score number + high contrast, thumbnail-grade.
10. **Ride the AI wave (#13):** thread one "AI reads your listing like a customer's search does" line into hero subhead or feature copy.
11. **Sharpen "one thing" (#11):** lead the bento with the single outcome (score + this week's plays); group the other six as "what's inside."

### P2 — Strategic decisions (require your call before building)

12. **Pricing level (#32):** hold $29 vs. raise Solo + add premium anchor.
13. **Subscription softeners (#27):** add annual toggle and/or one-time Deep Scan pack.
14. **Paywall timing (#1/#8):** confirm free-scan-then-gate stays; tune where the gate bites.

### Already strong — protect, don't touch

Try-before-buy (#25), single hero CTA (#22), "what happens next" CTA (#28), pricing in header (#16), comparison table (#31), <10-word description (#30), memorable name (#23), fifth-grade headline (#7), sellable-from-hero (#20), popcorn pricing (#12), novelty (#19).

---

## 4. Suggested execution order

P0 items 1–5 are a single focused PR (copy + two small components, no architecture). Item 6 and all of P1 are independent follow-ups. P2 needs three decisions from Tim before any code. Recommend: ship P0 → decide P2 forks → P1.

---

## 5. Implementation status — shipped 2026-06-14 (branch `scan-robustness`)

Tim approved all three priorities with these decisions: remove the Free plan (scan = lead magnet only), add an annual option (no one-time pack), raise prices to $50+.

**P2 — pricing (done)**
- Free tier removed from both the home pricing block and `/pricing` (and JSON-LD offer ladder).
- **Solo $29→$59/mo, Growth $99→$129/mo** (research-grounded: SparkToro Personal $50/mo is the direct comp; #32 "be more expensive").
- **Annual billing** added — Solo $590/yr (≈$49/mo), Growth $1,290/yr (≈$108/mo), "2 months free", via a monthly/annual toggle on `/pricing`. Backend: `priceIdFor(plan, interval)`, `tierForPriceId` maps annual→tier, checkout + route accept `interval`, two new env vars (`STRIPE_PRICE_SOLO_ANNUAL`/`_GROWTH_ANNUAL`) with graceful monthly fallback.
- All stale $29/$99 strings swept across in-app billing, llms.txt, report/plays upgrade CTAs, launch drafts.
- ⚠️ **Go-live blocker:** the existing LIVE Stripe price IDs are now the wrong amount — new $59/$129 monthly + annual prices must be created and the 4 `STRIPE_PRICE_*` env vars repointed.

**P0 — trust & framing (done)**
- New `SocialProof` section (#15/#29): founder vouch (face slot + 90s-video slot + quote), factual proof points, and a ready-to-populate `testimonials` slot (empty — no fabricated quotes). *Asset TODO: Tim adds headshot + Loom URL.*
- New `Empathy` band before the features (#21/#24): "You shipped it. You posted once. Then… silence."
- Color discipline (#2): dropped per-card blue/amber/green; bento now uses the single brand accent.
- Bento headline leads with the one outcome (#11): "One score. One weekly plan to raise it."

**P1 — show & share (done)**
- `PreFooterShare` band site-wide above the footer (#4): "Run your scan. Share your score. Watch who finally shows up."
- OG image redesigned around a big `47/100` score badge (#5, thumbnail-grade).
- AI-wave framing threaded into the hero subhead + Search Gap card (#13).

**Verified:** typecheck clean · 610 tests pass · production build succeeds · bundle budget green (home 218 KB, pricing 219 KB ≤ 220 KB — kept under by server-rendering the cards and shrinking the toggle to a tiny client island).

**Still asset/launch-dependent (not code):** real founder headshot + Loom (#15), real customer testimonials (#14/#29), a real scan recording for the demo (#10). Components are built and ready to receive these.
