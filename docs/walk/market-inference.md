# Market and rival inference — the offline dogfood test (#1185)

Run 2026-10-02 by `node scripts/market-inference.mjs --run`, on stored evidence only: each site's stored report (its AI answers with the domains they cited, its measured top tens and its ranked searches) and the pages its scans read, from the committed snapshots in `scripts/eval-content/snapshot/`. No vendor was called and nothing was written to the database. The one live call is the inference itself (`src/lib/market/infer/infer.ts`, Haiku 4.5), made once per site in this run (`MI_RUNS=1`, the end of the test's budget); the earlier three-run passes are under *What the iterations taught*. Rivals are only what survives the checks in `concludeRivals()`: products, never a publisher, aggregator or platform, never the site itself.

This run: 3.58¢. The whole test, every iteration and probe below included: about 49.7¢ of the 50¢ the owner allowed.

## Result

| | reachkit.app | linear.app | plausible.io |
|---|---|---|---|
| Category | **AI discovery and search visibility** — pass (was "SEO software") | Product development system | Privacy-friendly web analytics |
| "SEO software" on not-our-market | **yes** — pass | — | — |
| Rivals | **fail**: 1 of 5 is an AI-visibility product (AthenaHQ); the rest are AI-SEO content tools | Shortcut, Height, Plane, Notion | Matomo, Fathom, Simple Analytics, GoatCounter, PostHog |

**The category passes the owner's bar; the rivals do not, and cannot from this evidence.** Every measurement stored for reachkit.app was bought under "SEO software": its twelve questions, their AI answers and their top tens are all about SEO tools. Profound, Peec AI and Otterly appear nowhere in it, and the model cannot supply them either: asked directly, Haiku 4.5 names Semrush, Moz and Conductor as AI-visibility software, and Sonnet 4.5 names Profound under a wrong domain (`profound.so`) beside two companies that do not exist. A rival list from model recall is a guess in a young market. What does name them is the one source #1185 lists first — who AI answers name for **the market's** prompts — and that needs the market's prompts to be asked. So the product concludes the market at the start of a pass, measures in it, and re-checks the rivals after the pass's own AI answers are in. The re-measure of reachkit.app on production is the proof of the rivals half.

## What the iterations taught

1. **One call for market and rivals took its rivals from the wrong market's top tens** (Search Atlas, SEO.ai, Semrush, Ahrefs), even with the category right. Rivals are now a second call, made against the concluded market, that says which measured domains sell that market's category at all.
2. **The model was told what the measurements were bought for.** `measuredUnder` names the category the stored answers were measured under; without it the twelve SEO questions outvoted the site's own headline.
3. **The category is the buyer's outcome, not the product's method.** Before that rule reachkit.app read as "AI-powered content writing for SEO" — what ReachKit does, not what its buyer pays for.
4. **Temperature 0.** At the vendor's default of 1.0 three calls on identical evidence gave three categories (the noise #1159 found in the profile call). At 0 the category was identical across all runs of a site.
5. **Not-our-market is a different outcome, never a broader category.** Pushing the head category there struck linear.app's own category off and left it with Replit, Cursor and Anthropic as rivals; now it has Shortcut, Height and Plane.


## reachkit.app

- **Category:** AI discovery and search visibility — The headline and products show ReachKit solves the job of getting discovered by AI and search—not traditional SEO ranking or content writing—by measuring where AI answers and Google send buyers, then writing pages to close that specific gap.
- **Synonyms:** AI answer visibility · search discoverability · AI and search ranking
- **Who buys:** B2B SaaS founders and marketing leaders whose sites are not appearing in AI answers and Google search results
- **The job:** get their site discovered by AI and search engines so buyers find them instead of competitors
- **Differentiators:** scans where AI answers and Google search send buyers to your rivals · writes one page a day to close the gap · weekly re-measurement of your whole market · shows AI answers about your market, not just keywords
- **Not our market:** SEO software · content writing services · keyword research tools · rank tracking software · AI writing assistants

| Rival | Basis | Reason |
|---|---|---|
| SEO.ai (seo.ai) | ranks | AI-powered SEO automation platform that helps sites get discovered by search engines and AI systems. |
| Quattr (quattr.com) | ranks | AI SEO tool that optimizes content for search visibility and AI answer discovery. |
| Search Atlas (searchatlas.com) | ranks | AI SEO automation platform helping sites rank and appear in search results. |
| Athena (athenahq.ai) | ai_answer | AI SEO tool that helps optimize sites for search engine and AI visibility. |
| Fritz (fritz.ai) | ai_answer | AI-powered SEO software helping sites improve search discoverability. |

Across 1 runs on the same evidence:

| Run | Category | Rivals | Cost |
|---|---|---|---|
| 1 | AI discovery and search visibility | seo.ai, quattr.com, searchatlas.com, athenahq.ai, fritz.ai | 1.19¢ |

**Pass bar (owner, #1185):**

- Run 1: **fail** — category is AI visibility, not "SEO software": yes; AI-visibility rivals: 1 of 5; zapier/ahrefs-type rivals: none; "SEO software" on not-our-market: yes

## linear.app

- **Category:** Product development system — Linear's headline and pages emphasize it as "the system for product development" designed for "teams and agents" with AI-first capabilities like agent tasks and coding sessions, not generic project management.
- **Synonyms:** product planning software · development coordination platform · product management system
- **Who buys:** Product development teams and engineering organizations
- **The job:** Plan, coordinate, and execute product development with AI agents integrated into the workflow
- **Differentiators:** AI agents that write code and handle tasks end-to-end · Loops for recurring agent workflows that automate coordination · Integrated coding sessions with Claude and Codex · Purpose-built for teams and AI agents working together
- **Not our market:** project management software · issue tracking software · team communication tools · code review platforms · agile planning tools

| Rival | Basis | Reason |
|---|---|---|
| Notion (notion.so) | same_job | All-in-one workspace for product teams to plan, coordinate, and execute development with database and workflow capabilities. |
| Plane (plane.so) | same_job | Open-source product development system designed for engineering teams to plan and coordinate work with modern tooling. |
| Shortcut (shortcut.com) | same_job | Product development platform built for engineering teams to plan, track, and coordinate product work end-to-end. |
| Height (height.app) | same_job | Product development system with AI-powered task automation and coordination for engineering teams. |

Across 1 runs on the same evidence:

| Run | Category | Rivals | Cost |
|---|---|---|---|
| 1 | Product development system | notion.so, plane.so, shortcut.com, height.app | 1.12¢ |

## plausible.io

- **Category:** Privacy-friendly web analytics — The headline leads with "privacy-friendly Google Analytics alternative" and all pages emphasize privacy, GDPR compliance, and no cookie banners as the core value proposition that distinguishes it from broader web analytics tools.
- **Synonyms:** GDPR-compliant analytics · privacy-first analytics · lightweight analytics
- **Who buys:** Website owners and SaaS companies seeking privacy-compliant analytics
- **The job:** Track website visitor behavior and performance without compromising visitor privacy
- **Differentiators:** No cookie banner required · EU-hosted with data residency · Open source and auditable code · Lightweight script that doesn't affect page speed · Simple single-page dashboard
- **Not our market:** Web analytics software · Session replay tools · Heatmap and user behavior software · Marketing attribution platforms · Customer data platforms

| Rival | Basis | Reason |
|---|---|---|
| Matomo (matomo.org) | ranks | Open-source privacy-friendly analytics platform with GDPR compliance and no cookie banner requirement, directly competing on privacy-first positioning. |
| Fathom Analytics (usefathom.com) | ranks | Privacy-first Google Analytics alternative with GDPR compliance and lightweight script, targeting the same privacy-conscious website owners. |
| Simple Analytics (simpleanalytics.com) | ranks | Privacy-focused analytics platform with GDPR compliance and no cookie banner, competing directly on privacy and simplicity. |
| GoatCounter (goatcounter.com) | ranks | Open-source privacy-first web analytics tool with GDPR compliance and lightweight implementation for privacy-conscious users. |
| PostHog (posthog.com) | ranks | Open-source product analytics platform with privacy-friendly self-hosting options and GDPR compliance for SaaS companies. |

Across 1 runs on the same evidence:

| Run | Category | Rivals | Cost |
|---|---|---|---|
| 1 | Privacy-friendly web analytics | matomo.org, usefathom.com, simpleanalytics.com, goatcounter.com, posthog.com | 1.27¢ |
