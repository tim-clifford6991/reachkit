# ReachKit

For a founder who owns a small company website and knows nothing about SEO. They give us one domain;
the product says the rest in its own approved words: "See what AI tells buyers about your market —
and write your way in." and "A free scan shows where AI answers and Google search send buyers to
your rivals instead of you. Then ReachKit writes one page a day to change that." One plan, "€49" "per month, VAT included".

Production <https://reachkit.app> · dev <https://dev.reachkit.app> · repo `tim-clifford6991/reachkit`.

## The nine MVP features

All nine are on `main`. None of them counts as delivered until a stranger walks the path on production. Where that walk stands is `docs/GO-LIVE.md` and nowhere else. This table does not carry a second status.

| # | Feature | What the user gets |
|---|---|---|
| 1 | Landing / marketing | Reads what ReachKit does and types in a domain |
| 2 | Free scan for any URL | A real, permanent findability report without an account |
| 3 | Payment + magic-link auth | Pays €49 with no account first, then signs in from the mailed link |
| 4 | Protected dashboard | One signed-in place showing the market, the rivals and the week |
| 5 | Onboarding | Confirms rivals and category and connects where pages publish: a hosted subdomain, or their WordPress |
| 6 | Weekly deep scan and targeting | Every Monday the market is re-measured and the next pages are picked |
| 7 | Content calendar, daily actions | A new post, new page or update each day, cross-linked to their own pages and earlier assets |
| 8 | Email | Onboarding, free-scan nurture, weekly digest, retention / win-back |
| 9 | Technical site issues | Told what is broken on their own site and what to do about it |

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
| 1 | `README.md` | This page: what ReachKit is, the nine features, what delivered means. |
| 2 | `docs/SPEC.md` | One section per feature: what the user gets, rules, done-when. No pixels. |
| 3 | `docs/DESIGN.md` | daisyUI + Recharts + lucide. No artboards. |
| 4 | `docs/PROCESS.md` | How work moves. The four gates, Coherence, the worktrees, the queue. |
| 5 | `docs/GO-LIVE.md` | The only checklist of what is left before a stranger pays. |
| 6 | `docs/RUNBOOK.md` | How the box and the vendors are operated after a change is merged. |
| 7 | `CLAUDE.md` | What an agent reads first. It points at the pages above and does not restate a different rule. |

A difference between the code and `SPEC.md` is a defect in the code — CI's `audit` check blocks the PR. A difference between these pages is fixed in the same change. The milestone **Launch** is the list of open issues for that checklist.

## Where work is tracked

| Where | What it carries |
|---|---|
| [The Project board](https://github.com/users/tim-clifford6991/projects/1) | Status (Ready is next) and Feature (F1–F9). P0 = the paying path. |
| Issues | What the user can do afterwards. A SPEC link when behaviour is new. |
| Pull requests | What changed, the conditions, the overlaps, the surfaces, how it was proved, `Closes #n` when it closes an issue. |

How work flows is `docs/PROCESS.md`, including Coherence. The owner answers questions and looks at `dev.reachkit.app` for taste. Conditions and screen strategy are the gates.
