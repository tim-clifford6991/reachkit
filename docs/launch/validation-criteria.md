# Validation criteria — decided BEFORE launch traffic

> Scaffolded per launch remediation Task 6.5 (2026-07-15 review). **The floors below are proposed defaults, not measurements** — they assume cold/community traffic (indie-hackers, PH, Reddit), not paid ads. Tim edits the floors + traffic plan to numbers he'll actually honor, sets the start date, and commits. The commit is the point — a pre-committed, version-controlled decision rule that can't be quietly re-negotiated later.

**Window:** 4 weeks from first public launch post (start: <DATE>).
**Traffic plan:** <channels Tim commits to — e.g. PH launch, 3 subreddit posts, X build-log>.

## The funnel gates (PostHog: funnel scan_started → subscription_activated)
| Stage | Metric | Floor (edit me) | Reading if below |
|---|---|---|---|
| Top | unique scans started | 200 | distribution problem, not product — fix channels first |
| Report | scan → findings shown | 85% | pipeline reliability problem (scan failures) |
| Interest | findings → paywall viewed | 35% | report isn't compelling — conversion surface work |
| Intent | paywall → checkout started | 4% | offer/price problem |
| Money | checkout → paid | 40% | checkout friction/trust problem |
| **Verdict** | **paying customers in window** | **3** | — |

## Decision rule (pre-committed)
- **≥3 paying customers** (any mix of Solo/Growth): validated — invest (Phase 5/6 backlog, content engine).
- **1–2 paying** OR strong intent (≥10 checkout starts) without conversion: iterate the offer, run one more 4-week window. Max ONE repeat window.
- **0 paying and <10 checkout starts** after the full traffic plan executed: the idea as priced/framed is not validated — pivot or park. Executed-traffic-plan is a precondition: no verdict without the distribution work actually done.

## Weekly ritual
Every Monday: read the funnel in PostHog, write 3 lines (numbers, surprise, next lever) at the bottom of this doc. The Task 6.3 reconcile + Task 2.1 events make the numbers trustworthy.
