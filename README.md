# ReachKit

For a founder who owns a small company website and knows nothing about SEO. They give us one domain;
the product says the rest in its own approved words: "See what AI tells buyers about your market —
and write your way in." and "A free scan shows where AI answers and Google search send buyers to
your rivals instead of you. Then ReachKit writes one page a day to change that." One plan, "€49" "per month, VAT included".

Production <https://reachkit.app> · dev <https://dev.reachkit.app> · repo `tim-clifford6991/reachkit`.

## The nine MVP features (status 2026-09-15)

Built means on `main` with tests. None of it counts as delivered until a stranger walks it on production (below).

| # | Feature | What the user gets | Status |
|---|---|---|---|
| 1 | Landing / marketing | Reads what ReachKit does and types in a domain | **Live**: approved copy renders. `/privacy`, `/terms` and `/imprint` still carry the owner's placeholders (#335). |
| 2 | Free scan for any URL | A real, permanent findability report without an account | **Works on dev**: progress stream (#540), per-stage budgets (#539), the measurement line, the reused-answers line and "Retry this part" (#719). **Owner walk:** one live scan with the site-profile crawl inside 12¢ and 50 s (#715). |
| 3 | Payment + magic-link auth | Pays €49 with no account first, then signs in from the mailed link | **Built; payment walked on dev**: a Stripe test-mode payment completed on dev.reachkit.app (#319, 2026-09-15); a link lasts 24 h and sign-out is global (#718). **Owner walk:** one real magic link on production (#542). |
| 4 | Protected dashboard | One signed-in place showing the market, the rivals and the week | **Built, inert until a payment**: the screens exist, the eight jobs are registered (#422), and "Needs you" carries the customer's own technical issues (#572). Nothing ticks before a paid site exists. |
| 5 | Onboarding | Confirms rivals and category and connects where pages publish: a hosted subdomain, or their WordPress | **Built**: one submit with rivals, an editable category (#562), a hosted label that refuses a taken host (#608), WordPress, and the voice; a bounded site-profile crawl (#609, #610). **Owner walk:** a real WordPress connects and receives a page (#324). |
| 6 | Weekly deep scan and targeting | Every Monday the market is re-measured and the next pages are picked | **Built, proved on a simulated week**: Monday re-measure, verdicts and readiness (#474, #477, #478), and a seven-day hands-off run on a fake clock (#323). Never run live. |
| 7 | Content calendar, daily actions | A new post, new page or update each day, cross-linked to their own pages and earlier assets | **Built, proved on a simulated week**: generate → veto → publish at most one a day, cross-links (#567), and metadata fixes (#690). **Owner walk:** live-model drafts pass every hard rule at 45¢ or less (#321). |
| 8 | Email | Onboarding, free-scan nurture, weekly digest, retention / win-back | **Built, copy written**: every customer mail kind in SPEC §8 has owner-approved copy (#721), and the retention sequence runs (#569). **Owner walk:** each kind seen in Gmail and Apple Mail (#339). The owner's own incident alert (#330) has drafted copy (#759) for the owner to correct. |
| 9 | Technical site issues | Told what is broken on their own site and what to do about it | **Built, copy written**: nine checks over the crawled pages, each with a count, a severity and who fixes it; the same counts on the report, the dashboard and mail; Monday drops a fixed issue; a ReachKit-fixable page becomes a Fix (#570–#573, #690, #716). Never run live. |

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

These five files are the corpus; there is no sixth. `docs/archive/` is frozen history — not instructions. A difference between the code and `SPEC.md` is a defect in the code — CI's `audit` check blocks the PR.

## Where work is tracked

| Where | What it carries |
|---|---|
| [The Project board](https://github.com/users/tim-clifford6991/projects/1) | Status (Ready is next) and Feature (F1–F9). P0 = the paying path. |
| Issues | What the user can do afterwards. A SPEC link when behaviour is new. |
| Pull requests | What changed, how it was proved, `Closes #n` when it closes an issue. |

How work flows is `docs/PROCESS.md`. The owner does not review by reading tickets: they answer questions and click through `dev.reachkit.app`.
