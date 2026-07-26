# Requirement intake — Email system (retention + onboarding + general)

**Date:** 2026-07-26 · **Owner ask (verbatim):** "complete all retention, onboarding and general emails. I want you to trigger one per type to REACHKIT_OWNER_EMAILS for review. All emails must follow a decently designed email template which follows the design language of the app, colour palette, logo etc."

## Restatement (with deltas)

The launch audit found the product sends **exactly one** email today (the post-checkout magic link, `lib/email/resend.ts`). All three crons compute rich data (weekly digest, score snapshots, market alerts) but email nothing — the app is 100% pull. This intake builds the missing delivery layer: a **shared branded email template** matching the app's design language, and a **complete set of message types** covering onboarding, retention, and general/billing. **Review-first:** one sample of each type is sent to `REACHKIT_OWNER_EMAILS` before any email is wired to fire on real users.

## Clarifying questions (asked + recorded)

- **Q: Daily emails to every user — spam risk?** Default applied: the daily "focus" email is **conditional** (only when an action is scheduled for *today* and still open) and will be **preference-gated** when wired. The sample is sent so the owner can judge the cadence.
- **Q: Send domain (SPF/DKIM)?** OPEN — the audit couldn't confirm `reachkit.app` is DKIM-verified in Resend. The samples double as a live deliverability test (if they land in spam, that's the signal to verify the domain). Not resolved by this intake.
- **Q: Wire now or after review?** Owner said "for review" → build + sample-send this pass; wire into live triggers **after** design sign-off.

## Message types (the contract)

| # | Type | Trigger (when wired) | Purpose |
|---|---|---|---|
| 1 | `login-link` | post-checkout provision (exists — restyled) | The magic-link sign-in |
| 2 | `welcome` | after provision / first login | Plan active, what happens next |
| 3 | `scan-ready` | deep scan `done` | Report ready + score + top fix |
| 4 | `weekly-digest` | weekly-refresh cron (Mon) | Score + Δ + what changed + this week's actions + market alerts |
| 5 | `daily-focus` | daily cron (conditional) | Today's single action |
| 6 | `score-alert` | score-pulse cron (Thu) / on meaningful move | "Your score moved +N" |
| 7 | `subscription-canceled` | `customer.subscription.deleted` webhook | Sorry to see you go + reactivate |

## Permutation matrix (cells touched)

- **Tier:** paid (retention/digest/daily/score/canceled) · any (login/welcome/scan-ready). Free users get login + scan-ready only.
- **Auth/entry:** provision (login, welcome, scan-ready) · cron (digest, daily, score) · webhook (canceled).
- **Data-state:** fresh (all fields) · thin (no score move → score-alert suppressed; no scheduled action → daily suppressed) · legacy (missing digest fields → section omitted, never fabricated) · degraded (send failure → logged, recorded only on confirmed send — fixes the `provision.ts` "recorded-as-sent" bug).
- **Excluded:** payment receipt (Stripe sends its own); password reset (no password auth).

## Acceptance criteria (written first)

1. A shared `renderEmail(...)` produces a branded, table-based, inline-styled, ~600px, light-theme, mobile-safe HTML shell with the ReachKit logo + violet (`#6E56F7`) accent + `#16141F` ink, plus a plain-text alternative for every email.
2. Every message type builds from typed data; **no fabricated numbers** — an absent field omits its section (invariant #11 at the email layer).
3. One sample of **each** type renders with representative data and is **sent to `REACHKIT_OWNER_EMAILS`** via Resend.
4. Guard: a unit test renders every message type and asserts (a) no `undefined`/`NaN`/`[object Object]` in the HTML, (b) the branded shell (logo + footer) is present, (c) a text alternative exists.

## Class statement

Not "add one email" — build the ONE email design system + delivery seam so every current and future notification routes through a single branded template (the same one-implementation discipline as the rest of the repo). The retention *data* already exists; this is purely the delivery last-mile.

## Rendered-surface ledger

Each message type's data → the exact section that renders it: score→score block, Δ→trend row, changes→change rows, actions→action rows, alerts→alert rows, CTA→button. No data gathered that isn't rendered.
