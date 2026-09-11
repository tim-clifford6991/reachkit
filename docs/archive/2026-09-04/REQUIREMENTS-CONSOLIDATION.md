# ReachKit v3 — requirements consolidation brief

Owner-supplied working brief, produced by a read-only corpus review
(2026-08-30) of all 66 requirements, 6 journeys and BUILD.md. Execute it
in this project through the factory's own verbs. Doctrine 0.8.2 carries
the rules this brief leans on (rule 7.4 vertical slices; the transcription
review path; the seam-merge test) — **confirm `sdlc-factory` is updated to
0.8.2 and the session restarted before starting.**

## Diagnosis (context for every step below)

The corpus was transcribed one BUILD.md bullet at a time instead of one
behavior at a time. Result: ~20% of the 356 criteria carry no promise —
they only disclaim facts to sibling REQs; 170 cross-references live in
Non-goals; and all 13 open `REVIEW(conflict)` markers sit on seams between
REQs that describe one behavior. Seam conflicts cannot be reviewed away —
they merge away. Target: **66 → 44 REQs** (~1 per journey step, the
altitude the journeys already demonstrate). The writing quality itself is
high; keep the content, merge the containers.

## Step 0 — before anything

1. `git init` && commit the corpus as-is (seed commit). The factory's
   acceptance model is commit-based; /implement refuses without it.
2. Repoint `factory.config.json` schema when Supabase migrations land
   (charter open question) — unchanged for now.

## Step 1 — zero-argument merges (kill 5 conflicts outright)

Run `/requirement-cleanup REQ-050 REQ-051 REQ-052 REQ-054`, then
`REQ-071 REQ-072 REQ-080`, then `REQ-056 REQ-058`, with this map:

| Merge | Surviving title (proposal) |
|---|---|
| 050+051+052+054 | A generated draft passes the hard rules or is never queued (BUILD §8 is one rule list; all four end in the identical recovery-path clause) |
| 071+072+080 | Changing what the site is measured as — domain, market, rivals — takes effect at the next re-measurement and never reads as movement |
| 056+058 | A page moves through defined publish states, a retry never publishes twice, and stopping is instant |

## Step 2 — disclaim-ring merges

| Cluster | Merge | Note |
|---|---|---|
| Free funnel | 001 + 002(c1–c5) + 012 | one /scan/{domain} state machine; also closes the unowned first-visit-to-shared-address gap |
| | 003 + 015 | two ceilings, one stop-early-and-say-so behavior |
| | 002(c6–c8) + 014 | correction + removal = two dispositions of one proof of control (JN-006 says so itself) |
| | 004 + 005 | 005 merges in as the corpus-wide null-vs-zero law, opening on the header |
| | 006 + 007 · 010 + 011 | one card (§4.1 m2); one paragraph (§4.2) |
| | retire 013 | one line of copy, not a behavior; c4 → one criterion in 064 |
| Buy + setup | 021 + 090 | the "nothing measured for the purchased domain" fact: 9 statements in 5 files today |
| | 022 + 023 | §13 is one ruling; move 023 c4 (VAT field) → 076 |
| | 026 + 027 | rivals derive from market — one decision chain |
| App | 047 + 048 + 049 | 048/049 are attributes of 047's object |
| | 045 + 046 (+ 061 c2) | one draft view |
| | 043 + 044 · 041 + 042 | one screen each (§4.6, §4.4) |
| | retire 061 | 4 of 5 criteria already live in 078/079 |
| Moves | 023 c4 → 076 · 059 c6/c7 → 076 | settles the VAT-surface and serving-window conflicts |

Keep unchanged: 008, 009, 020, 024, 025, 028, 029, 040, 053, 055, 057,
059, 060, 062–065, 070, 073–079, and the three laws 091/092/093 — but
**delete the laws' verbatim restatements** inside bound REQs (e.g. 064 c4,
040 c4, 028 c2); a law cited from a rationale needs no duplicate criterion.

After each cleanup batch: `/relink`, then re-approve nothing yet — Step 4
decides the order.

## Step 3 — route the ~15 real decisions to /decide

These are where BUILD.md is silent and review rounds were re-litigating;
each needs one owner ruling, not another round:

1. **The domain-owner takedown/correction subsystem** (002 c6–c8 + 014 +
   all of JN-006) — net-new scope; no §16 milestone accounts for it. Rule
   on whether it ships, and in which milestone.
2. The paid-but-stuck founder path (024 c3/c5/c6, 021 c5/c7).
3. Autopilot at veto-window zero (057 c7) — source of the 057↔064
   unsuppressible-mail conflict.
4. 30-day post-cancel hosted serving + 410 (059 c6/c7) and 30-day hard
   deletion incl. grounding passages (079 c7) — the retention policy.
5. The Winnable band threshold max(100, 2×ranked) (049 c2).
6. p95 < 60s + 90s hard stop (003 c2/c5).
7. "Publishable" as one predicate — window expired/approved AND no unsaved
   edit AND no outstanding claim re-check (053/046/057).
8. 10-minute release from the progress screen (029 c5/c6); email-sequence
   serialization per address (011 c4/c5); "no longer judgeable" as a
   fourth verdict (063 c6); effective-date rule (the 071/072/080 merge
   codifies it); "active access" predicate (076 c3/c8); change-email
   (077); told-when-we-stopped (092 — good, keep, just rule it in).

## Step 4 — go vertical (rule 7.4)

Fix two journey defects first: JN-002 lacks the step for the founder whose
site address setup refuses (the one human-contact point); JN-005 lacks its
depends-on front-matter (JN-002). Then: approve **JN-001's merged ~8 REQs
only**, `/expand-requirement` them, and build — the free funnel is the
M1–M4 sellable spine. Every other journey stays draft inventory; approve
each as its build slot approaches. Re-MoSCoW per wave at `/wave propose`
(60/66 Must is no signal).

## Review policy from here (doctrine 0.8.2)

Transcribed REQs (the ~75%): one round — fidelity + testability. Two
rounds only for the decision-bearing drafts above. A conflict between two
REQs that cannot state themselves without naming each other is a **merge
signal** — route it to /requirement-cleanup, never resolve it in place.
