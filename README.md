# ReachKit

For a founder who owns a small company website and knows nothing about SEO. They give us one domain;
the product says the rest in its own approved words: "See what AI tells buyers about your market —
and write your way in." and "A free scan shows where AI answers and Google search send buyers to
your rivals instead of you. Then ReachKit writes one page a day to change that." One plan, "€49" "per month, VAT included".

Production <https://reachkit.app> · dev <https://dev.reachkit.app> · repo `tim-clifford6991/reachkit`.

## The nine MVP features (status 2026-09-12)

| # | Feature | What the user gets | Status |
|---|---|---|---|
| 1 | Landing / marketing | Reads what ReachKit does and types in a domain | **Live** — approved copy renders. |
| 2 | Free scan for any URL | A real, permanent findability report without an account | **Works on dev** (2026-09-12) — progress stream (#540) and per-stage budgets (#539) merged and smoke-checked on dev.reachkit.app: four real sites complete in 6–19 s, no ceiling, ≤ 12¢; production deploy pending the owner's lift of the freeze. |
| 3 | Payment + magic-link auth | Pays €49 with no account first, then signs in from the mailed link | **Ready to test** — Resend domain verified (#325, 2026-09-12); one real magic link (#542) and one real Stripe test-mode payment (#319) still to be exercised. |
| 4 | Protected dashboard | One signed-in place showing the market, the rivals and the week | **Inert until a payment** — the screens exist and the eight Inngest jobs are registered against production (#422, 2026-09-12); nothing ticks before a paid site exists. |
| 5 | Onboarding | Confirms rivals and category and connects where pages publish: a hosted subdomain, or their WordPress | **Partial** — setup, hosted + WordPress connect and rival/category confirm all exist in `src/app`; unproven end to end. |
| 6 | Weekly deep scan and targeting | Every Monday the market is re-measured and the next pages are picked | **Built, never run live.** |
| 7 | Content calendar, daily actions | A new post, new page or update each day, cross-linked to their own pages and earlier assets | **Built, never run live.** |
| 8 | Email | Onboarding, free-scan nurture, weekly digest, retention / win-back | **Sends, copy incomplete** — mail can send (#325); 11 mail kinds registered, 5 without copy (#388); no sequence has run live. |
| 9 | Technical site issues | Told what is broken on their own site and what to do about it | **Not built.** |

## What "delivered" means

> Live on production, with real copy, and a stranger completes landing → free scan → pays →
> onboards → sees a page published on their own domain, unaided.

Real copy means no `TODO(copy)` renders on that path. Merged is not delivered, green is not
delivered, working on dev is not delivered.

## Build order

Build along the value chain — landing → free scan → auth and payment → dashboard and onboarding →
weekly scan → calendar → email → technical issues — but all nine are MVP: none is deferred for being late in the chain.

## Read in this order

| # | Document | What it holds |
|---|---|---|
| 1 | `README.md` | This page: what ReachKit is, the nine features and where each stands, what delivered means. |
| 2 | `docs/SPEC.md` | One section per feature: what the user gets, rules, done-when. No pixels. |
| 3 | `docs/DESIGN.md` | daisyUI + Recharts + lucide. No artboards. |
| 4 | `docs/PROCESS.md` | Issue → docs if needed → implement → merge. The owner tests live. |
| 5 | `CLAUDE.md` | What an agent reads first, and what it never does. |

These five files are the corpus; there is no sixth. `docs/design/canvas/` and `docs/archive/` are frozen history — not instructions. A difference between the code and `SPEC.md` is a defect in the code — CI's `audit` check blocks the PR.

## Where work is tracked

| Where | What it carries |
|---|---|
| [The Project board](https://github.com/users/tim-clifford6991/projects/1) | Status (Ready is next) and Feature (F1–F9). P0 = the paying path. |
| Issues | What the user can do afterwards. A SPEC link when behaviour is new. |
| Pull requests | What changed, how it was proved, `Closes #n` when it closes an issue. |

How work flows is `docs/PROCESS.md`. The owner does not review by reading tickets: they answer questions and click through `dev.reachkit.app`.
