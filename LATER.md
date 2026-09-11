# Later — deferred, and not built

Everything ReachKit deliberately does not do yet, in one place, so `SPEC.md` can be read as the
MVP and nothing else. A line here is **not** a plan and **not** a backlog to groom: it is a thing
the owner has already decided is not in the MVP. Moving a line out of this file is an owner
ruling, recorded in `DECISIONS.md`.

Nothing here is started while the value chain in `README.md` has an open issue.

## 1. Non-goals — do not build (SPEC §17)

Settings that tune the engine · feature flags · a crawler or sitemap reader · LLM-written UI text
or emails · a second score · multi-site · approval workflows, comments or content calendars
beyond SPEC §4.6 · images in drafts · backlinks, local or per-country SERPs · community outreach
of any kind.

These are not "not yet". A PR that adds one is rejected on sight.

## 2. v1.1 — deferred with an issue

| # | Issue | What is deferred | Where the MVP states it |
|---|---|---|---|
| 1 | [#56](https://github.com/tim-clifford6991/reachkit/issues/56) | **Search Console connection.** Postponed by the owner 2026-09-03 — *"get users on app and later start reviewing and improving based on feedback."* Labelled `blocked-on-owner`. | DECISIONS 2026-09-03 |
| 2 | [#57](https://github.com/tim-clifford6991/reachkit/issues/57) | **Perplexity as a fourth AI engine.** LLM Responses at ~0.56¢ per answer — 70 % of the old battery cost for a duplicate verdict. The MVP battery is ChatGPT + Google AI Mode + AI Overviews read free out of the target SERPs. | SPEC §6.2, §6.8 §1 and §3 |
| 3 | [#58](https://github.com/tim-clifford6991/reachkit/issues/58) | **Locale derivation** (site `lang` + TLD → country). MVP is US-English only: one `SERP_LOCATION` constant and one written footer line — *"Measured on US Google. More countries soon."* Volumes and rivals will be wrong for non-US markets, stated rather than hidden. | SPEC §6.3a · DECISIONS 2026-08-28 |
| 4 | [#59](https://github.com/tim-clifford6991/reachkit/issues/59) | **Webflow / Shopify / Ghost / Framer / Notion destinations.** MVP publishes to the hosted blog on `content.{customer-domain}` or to the customer's WordPress, and nothing else. | SPEC §9 · DECISIONS 2026-09-10 (brief §1.12) |

## 3. Edge cases and upgrades the spec names as later

Each of these is a sentence the MVP already carries. None has an issue yet; filing one is the
master's, and only once the chain is delivered.

| Deferred | Stated in |
|---|---|
| **AI Keyword Data** — how queries are phrased inside AI tools, with volumes (1¢/task + 0.01¢/kw). A nice-to-have for question derivation; a v1.1 candidate only, and on the never-pull list until then. | SPEC §6.4 · §6.8 §1 |
| **The Standing module** — the platform hits behind a market's questions are stored in the report blob and are *not rendered* in MVP. | SPEC §6.7 |
| **Per-customer hosted templates.** Published pages render through one clean typographic template, light-only accepted; customisable later, never per-customer in MVP. | SPEC §9 |
| **Stripe Tax.** No Stripe Tax at launch: €49 charged tax-inclusive, country and VAT ID collected so the records exist. A known, accepted compliance debt from customer one; revisit before meaningful EU B2C volume. | SPEC §13 · DECISIONS 2026-08-28 (ADR-052) |
| **Authenticated report removal.** Report pages are `noindex` forever and in no sitemap; v1 removal is a written request to the removal address, not a control — `domain_blocks` has no writer in the product. | DECISIONS 2026-08-31 (ADR-002), 2026-09-05 (#28) |
| **`format_page` and `refresh_page` opportunities** are typed but not derived until a page-format signal and a last-changed measurement exist. | SPEC §7 · DECISIONS 2026-09-06 (#125) |
| **A score on the sign-in screen** (REQ-098 c4/c5). Deferred until the owner names the number for that surface; sign-in is one address field, one action and the no-password line. | DECISIONS 2026-09-06 (#106) |
| **`middleware.ts` → `proxy.ts`.** The setup gate runs in the `(account)` server layout because middleware is still Edge-bundled under the deprecated convention; migrating is an owner-file change. | DECISIONS 2026-09-07 (#171) |
| **Unifying the two AI cache windows** at 6 d (`serpWeeklyRecheck` 7 d and `aiBattery` 6 d) — one pin, the owner's to make. | DECISIONS 2026-09-07 (#207) |
| **Sonnet for the draft step.** Upgrading generation alone adds ~4¢ against a €0.45 per-draft ceiling; the MVP stays on the pinned tiers. | SPEC §6.8 §6 |

## 4. How a line leaves this file

1. The chain in `README.md` is delivered — live on production, real copy, a stranger walking it.
2. The owner rules the item in, as a `DECISIONS.md` row on the day it is ruled.
3. `SPEC.md` is amended in the same or the next docs PR, and the line is deleted from here.

A line is never built because an implementer found it while doing something else. That is an
*Adjacent* note in a PR body, and only the master files issues.
