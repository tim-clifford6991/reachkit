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
| 2 | Free scan for any URL | A real, permanent findability report without an account | **Fixed in code, unverified live** — the progress stream now crosses the instance boundary (#540, merged 2026-09-12) and per-stage budgets are in review (#539); no dev deploy of it yet, 0 completed scans on record. |
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
| 2 | `docs/SPEC.md` | **Fixed in code, unverified live** — the progress stream now crosses the instance boundary (#540, merged 2026-09-12) and per-stage budgets are in review (#539); no dev deploy of it yet, 0 completed scans on record. |
| 3 | `docs/DESIGN.md` | **Ready to test** — Resend domain verified (#325, 2026-09-12); one real magic link (#542) and one real Stripe test-mode payment (#319) still to be exercised. |
| 4 | `docs/PROCESS.md` | **Inert until a payment** — the screens exist and the eight Inngest jobs are registered against production (#422, 2026-09-12); nothing ticks before a paid site exists. |
| 5 | `CLAUDE.md` | What an agent reads first, and the nine things it never does. |

These five files are the corpus; there is no sixth. Renders live in `docs/design/`. Everything not needed for the nine features is archived under `docs/archive/<date>/`; the old
sdlc-factory corpus is frozen at `docs/archive/2026-09-04/` — never edited, never deleted. A difference between the code and `SPEC.md` or `DESIGN.md` is a defect in the code, filed as an issue.

## Where work is tracked

| Where | What it carries |
|---|---|
| [The Project board](https://github.com/users/tim-clifford6991/projects/1) | Every open issue in one flat list with its `Phase`. The board **is** the priority — no queue file, no milestone. |
| Issues | Three fields — outcome, evidence, done-when — plus one link to the `SPEC.md` section they implement. |
| Pull requests | One issue = one PR, body carrying `Closes #n`. |

How work flows is `docs/PROCESS.md`; this page carries no process detail.
