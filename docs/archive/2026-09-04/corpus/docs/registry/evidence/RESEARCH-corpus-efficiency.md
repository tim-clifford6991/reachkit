# Evidence — where the corpus's words are, and which of them rule 2.5 refuses

Measured **2026-09-03** on `research/efficiency` at `06666c1`, from
`factory-console --check`'s own `corpus-volume` and `work-order-fanout`
notices plus a word count over the corpus tree. Every figure below is
reproducible from the two commands named in §1.

Bears on: rule 2.5 (a document that says what the code will say is a defect),
rule 2.6 (a work order is a slice, never a file), rule 2.1 (the seams-aware
cap), rule 2.4 (one claim, one home).

**No work order was touched.** This file is a reading, and the consolidation
column is a proposal for W3, not a change.

## 1. What the console measures

`node .claude/factory/console/bin/factory-console.mjs --check`, verbatim from
its notices:

> · corpus-volume: **774,711 live words in 434 files** (excluded: design 2,
> design/previews/app 1, docs root 1, registry 3, registry/evidence 19,
> registry/generated 5, requirements/history 43) · **46 approved REQ** ·
> **16,842 words/approved REQ** · WO lines median 126 / p90 213 / max 592 ·
> **5.5 WO/approved REQ**

> · work-order-fanout: 46 approved requirements measured · 0 reach no work
> order · 55 work orders reach no approved requirement through
> implements/satisfies and are outside this measure · **median 5, p90 9**

Both fire as `WARN`. The volume budget is 6,000 words per approved
requirement, so the corpus stands at **2.8× budget**; the fanout floor is 6,
and **14 approved requirements exceed it** — heaviest REQ-056 (12), REQ-003
(11), then REQ-001, REQ-002, REQ-010, REQ-050, REQ-055 at 9 each.

**The number that forced rule 2.5 has been passed.** The constitution's §0
records **14,824** words per approved requirement "on the second live corpus,
at zero lines of code — the cost every subagent pays on every turn, and the
one the factory had never measured". This corpus is at **16,842**, 14% past
the measurement the rule was written from, with rule 2.5 in force throughout.

## 2. Where the words are

| Type | Files | Words | Share of live corpus | Mean |
|---|---|---|---|---|
| **Work orders** | 262 | **487,789** | **63%** | 1,862 |
| Blueprints | 63 | 151,204 | 20% | 2,400 |
| Requirements | 72 | 74,055 | 10% | 1,029 |
| Decisions | 31 | 56,966 | 7% | 1,838 |

Rule 2.6's own diagnosis reproduces almost exactly: it was written from "253
work orders for 46 approved requirements, median five each … larger than the
first corpus's whole implementation, before a line of it existed". This corpus
has **262 work orders for 46 approved requirements, median five each**.

### 2.1 Inside the work orders — two different heavy shapes

Words under each heading of all 262 work orders, classified by what the
heading is for:

| | Words | Share of WO words |
|---|---|---|
| **Plan** — Steps · File plan · Interfaces · Test plan · Out of scope · Acceptance | **310,027** | **65%** |
| **Record** — Verdict · Criterion-by-criterion · Regression · Log · `rests-on` dispositions · deviation reviews · mutation narration · self-certification | 103,178 | 22% |
| Everything else | 61,081 | 13% |

**310,027 words of plan is 40% of the entire live corpus** — and it is exactly
what rule 2.5 names: "a signature the module will declare, a schema the
migration will state, a step the implementer will take anyway — written once,
in the code, and cited from the artifact by anchor (rule 5.3)". The corpus is
2.8× its budget and this one category is 1.1× the whole budget on its own.

The **record** is the minority corpus-wide and the majority in the heaviest
files — WO-272 is 72% record, WO-058 68%, WO-267 66%, WO-275 64%. That is a
shape **rule 2.5 does not name**. The rule refuses a document that says what
the code *will* say; these say what the run *did* say, which the test output
already says. Rule 2.5's three legitimate contents are what the product
promises, why the shape was chosen, and *how work moves* — a 900-word verdict
narrating a passing suite is not how work moves.

## 3. The ten heaviest work orders

Words, and what the weight restates. `plan`/`record` is the split from §2.1.

| # | WO | Words | Status | Where the weight sits | Restates |
|---|---|---|---|---|---|
| 1 | **WO-267** — the Supabase substrate | 8,672 | done | 5,543 record (66%): criterion-by-criterion 1,166 · regression 940 · test plan 854 · log 745 · dispositions 506 | **code** — the migration and its tests, narrated a second time |
| 2 | **WO-041** — the copy registry `COPY`/`copy()` | 7,820 | done | steps 800 · test plan 755 · file plan 571 · deviation verification 520 | **blueprint** — BP-020's closed-set contract restated as steps, then **code** in a 3,527-word record |
| 3 | **WO-269** — the layout law, `Surface` and its suite | 6,646 | done | log 854 · file plan 783 · criterion-by-criterion 698 · regression 555 | **blueprint** — BP-018's `BANDS`/`Arm`/`Surface` interface and ADR-093's six decisions |
| 4 | **WO-272** — `users.notify` and `sites.timezone` | 6,092 | done | 4,279 record (72%): verdict 822 · log 679 · defect narration 462 | **code** — two nullable columns, at 6,092 words |
| 5 | **WO-058** — `claimFreeScanSlot` | 5,954 | done | 3,980 record (68%): verdict 907 · deviation review 547 · new-finding 512 | **code** — one transaction, plus BP-023's own decision text |
| 6 | **WO-275** — `npm test` file parallelism | 5,626 | done | 3,531 record (64%): provenance 712 · log 702 · verdict 647 · runtime probe 608 | **code** — a vitest config change and the probe proving it |
| 7 | **WO-062** — `POST /api/scan` | 5,158 | approved | verdict 855 · test plan 853 · dispositions 545 · rule-4.2 finding 407 | **requirement** — REQ-001/REQ-003's admission criteria re-derived at the route |
| 8 | **WO-057** — `admitFreeScan` | 4,700 | done | test plan 794 · dispositions 638 · criterion-by-criterion 491 | **requirement** — REQ-002/REQ-003's six-step admission order, restated as steps |
| 9 | **WO-205** — `judgeWeek`, `readWeek`, the digest | 4,484 | approved | test plan 1,223 · file plan 837 · **interfaces 569** · steps 568 | **blueprint**, admittedly — its `## Interfaces` opens *"Consumes (verbatim from the blueprints named)"* and copies BP-045 and BP-050 types **with their doc comments** |
| 10 | **WO-002** — route-group skeleton and fonts | 4,476 | done | 2,853 record (64%): deviation verification 454 · verdict 412 · log 395 | **code** — a directory layout and a font import |

WO-205 is the clearest case in the corpus because it says so itself: a section
headed *"Consumes (verbatim from the blueprints named)"* is rule 2.4's second
copy declared in its own heading. The fix is rule 5.3's — cite `path + symbol`,
not the symbol's body.

## 4. The ten heaviest requirements

Rule 2.1's soft budget is **~12 acceptance criteria**. Four of these ten exceed
it. Words per criterion is the sharper reading: it is where a criterion has
stopped stating behaviour and started specifying mechanism.

| # | REQ | Words | Crit | AC words | w/crit | Longest | Restates |
|---|---|---|---|---|---|---|---|
| 1 | **REQ-071** — changing domain, market or rivals | 2,248 | **18** | 1,521 | 85 | c12, 247w | **blueprint** — c13 restates c12's whole rendering enumeration for a second trigger date ("on criterion 12's terms — no change figure, no joined line, trend arrow, rising or falling colour or slope"), and the enumeration is BP-018/BP-038's vocabulary, not a promise |
| 2 | **REQ-056** — publish states, no duplicate post | 2,239 | **16** | 1,477 | 92 | c16, 284w | **blueprint** — c16 walks four WordPress unpublish outcomes; BP-045's ten states and fifteen transitions are where a branch table belongs |
| 3 | **REQ-099** — the landing page | 1,955 | 8 | 659 | 82 | c1, 144w | **blueprint** — c1 specifies a 320×480 floor, first paint, no clipping, and names **ADR-093's bands and type floor** by name; that law is BP-018's and its conformance suite is WO-269's |
| 4 | **REQ-043** — the calendar and day panel | 1,942 | 12 | 775 | 65 | c12, 210w | **blueprint** — c12 enumerates the day panel's two routes and the record-derived cases that suppress each, which is BP-039's model |
| 5 | **REQ-001** — one field, one public address | 1,940 | **18** | 1,288 | 72 | c14, 138w | **requirement** — six criteria past the budget; c14–c17's incomplete-report and re-scan arms are REQ-003's and REQ-094's cases seen from the address |
| 6 | **REQ-097** — Stripe owns billing | 1,627 | 6 | 536 | **89** | c4, 138w | **nothing — the counter-example.** c4 is a negative promise about customer-visible behaviour ("ReachKit sends no mail on that occasion … neither its subject nor its body states an amount charged or due"). Long because the promise is, not because a mechanism leaked in |
| 7 | **REQ-094** — correcting the market | 1,624 | 7 | 1,065 | **152** | c7, 224w | **blueprint** — the densest criteria in the corpus; c7 is a four-branch retry state machine written as prose, which is BP-028's correction state |
| 8 | **REQ-057** — nothing publishes unapproved | 1,597 | 9 | 993 | 110 | c9, 248w | **itself** — c9 opens "when any telling **criteria 1, 7 or 8** require about that page is sent", so its entire body is a modifier re-stating three of its own siblings for one destination kind |
| 9 | **REQ-010** — a page for an email address | 1,576 | **14** | 897 | 64 | c12, 142w | **blueprint** — c12's sequencing invariants (at most one running, delivery order, a 7-day drop, a 14-day outer bound) are a scheduler contract; BP-029 already pins `SEQUENCE_START_DEADLINE_DAYS` and the retry ladder |
| 10 | **REQ-003** — the scan ends at a bounded moment | 1,572 | 12 | 846 | 71 | c12, 170w | **itself** — c12 restates c6 and c7's refusals for one more address state, and REQ-001 c13–c17 hold that address's other states |

The requirements are not the corpus's weight problem — 74,055 words, 10% of
live — but they are where the *seams* are, and a seam is what rule 2.6 says
turns one work order into five.

## 5. Consolidation candidates for W3

Ranked by words recovered against risk. None of these is a discard: rule 2.6's
merge test carries criteria and file plans verbatim and keeps the replaced
orders `superseded`.

| # | Candidate | Recovers | Rule | Risk |
|---|---|---|---|---|
| 1 | **Work-order plan sections cite blueprints by anchor instead of copying them.** WO-205's `## Interfaces` is the declared case; the pattern is corpus-wide | up to **310,027 w** (40% of live corpus), realistically the `Interfaces` and `File plan` share of it | 2.5, 5.3 | **low** — a citation that rots is caught by the console's `stale-blueprint` check, which already runs |
| 2 | **Cap the post-implementation record.** A verdict states the outcome, the counts, and what discriminated; the narration of each criterion and each mutation is the test file's | ~**103,178 w**, concentrated in the twenty heaviest | 2.5 (extended — the rule names "will say", not "did say") | **medium** — this is the corpus's audit trail; the constraint is a shape, not a deletion, and §8's mutation discipline must survive it |
| 3 | **Merge the 14 fanned-out requirements' work orders** on rule 2.6's own test: two orders that cannot state their goal and stop condition without citing each other are one | ~40 work orders' overhead; REQ-056 (12), REQ-003 (11), five at 9 | 2.6 | **medium** — a set that cannot merge inside a day goes back to the architect, which is the rule's own escape |
| 4 | **REQ-071 c12/c13 state the no-movement rule once**, with two trigger dates, rather than twice | ~250 w, and one seam | 2.4 | **low** — one edit, `/requirement-cleanup`'s territory |
| 5 | **REQ-057 c9 and REQ-003 c12 fold into the criteria they modify** | ~400 w, two seams | 2.4 | **low** — same |
| 6 | **REQ-001 and REQ-056 exceed rule 2.1's ~12** and are the two candidates where a *second behaviour* is plausibly present | — | 2.1 | **medium** — the rule warns against splitting where the halves must cite each other; REQ-001's address states may be one behaviour |

**What is not a candidate.** REQ-097 is long and legitimately so (§4, row 6).
The 55 work orders the fanout notice excludes ("reach no approved requirement
through implements/satisfies") are a traceability question, not a volume one.
And per rule 2.2a, nothing here proposes restructuring an artifact merely for
being long: every row above names the claim that has two homes.

## Why this sits here and not in a work order

The directive that produced it says to touch no work order, and rule 2.1 puts
a measurement in `registry/evidence/` rather than in the artifacts it measures.
The one finding that would change an artifact's own text — rule 2.5 not
reaching the post-implementation record — is §5 row 2 and is a proposal for
W3, not a REVIEW line on 262 files.
