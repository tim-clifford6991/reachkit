# REQ-027 + REQ-026 — merged, 2026-08-31 (merge pass, merge 3)

## Survivor by count

Grep of front-matter `satisfies:`/`implements:` lines in `blueprints/` and
`work-orders/`: **REQ-026 — 0. REQ-027 — 0.** A tie, so the survivor is the lower
id: **REQ-026**. No reason to overrule.

Why one requirement: rivals derive from the market, on the same screen, in the
same act. REQ-027 criterion 1 could not name its own trigger without REQ-026 ("or
stated by them on the same screen (REQ-026)"), REQ-026's rationale named REQ-027
criterion 1 as turning on the same key, and REQ-027's open `REVIEW(gap)` was
about a sequence REQ-026 criterion 6 provides for. One decision chain.

## What happened

| id | before | after |
|---|---|---|
| REQ-026 | 6 criteria, `status: draft`, title "The founder confirms the market at setup" | 13 criteria, `status: draft`, `supersedes: [REQ-027]`, retitled "The founder settles the market at setup, and the rivals that derive from it" |
| REQ-027 | 5 criteria, `status: draft` | `status: superseded`, retired in place, file kept |

Priority: both Must. No priority change.

## Criterion provenance

| survivor | from | change |
|---|---|---|
| 1–6 | REQ-026 c1–c6 | none |
| 7 | REQ-027 c1 | "(REQ-026)" → "(criterion 3)" — the citation is now internal |
| 8 | REQ-027 c2 | none |
| 9 | REQ-027 c3 | none |
| 10 | REQ-027 c4 | none |
| 11 | REQ-027 c5 | none |
| 12 | **new** — closes REQ-027's `REVIEW(gap)` | see below |
| 13 | **new** — owner ruling T1 promotion | see below |

Nothing collapsed. REQ-026 c5 (setup will not proceed with no market) and
REQ-027 c4 (the rivals card says it is waiting on the market) read as neighbours
but are two different screens' behaviour on the same missing answer.

## Criterion 12 — the `REVIEW(gap)` line, and why I closed it

The line, verbatim as it stood on REQ-027:

> - [ ] REVIEW(gap): criterion 1 governs only which rivals are *offered* once the
>   account's domain has been replaced; nothing covers suggestions the founder had
>   already accepted before changing the site address on that same screen (the
>   sequence REQ-026 criterion 6 provides for), so rivals found for the replaced
>   domain can survive into the tracked set — the outcome REQ-021 criterion 12
>   forbids — and criterion 2's refusal of the founder's own site is never
>   re-applied to the address they have just given.

**The merge alone does not close it.** Putting both requirements in one file
removes the seam and gives the gap one owner, but no criterion in the union states
what happens to rivals already accepted when the address changes. So it is closed
by a new criterion, not by the merge, and the derivation is recorded here rather
than escalated (rules 1.1, 1.3): every element of criterion 12 is already fixed
elsewhere in the corpus and only the setup-screen statement of it was missing —
criterion 6 states the identical clearing rule for the market on the identical
event; REQ-021 criterion 12 already forbids the replaced domain's rivals being
presented as the account's; criterion 8 already refuses the founder's own site.
Criterion 12 puts them where a test can reach them. If the owner reads it as a new
promise rather than a restatement of three settled ones, the criterion is the
thing to strike and the `REVIEW(gap)` line comes back with it.

## Criterion 13 — the T1 promotion

REQ-027's non-goal "Adding a competitor to the tracked set later without the
founder choosing it" states a promise a customer would notice the absence of —
domains appearing in their weekly comparison that they never picked — and no
criterion in either file carried it. Under owner ruling T1 it becomes criterion
13, scoped to what this requirement owns: the set the founder leaves setup with.
Its shape follows criterion 4 exactly, which makes the same forward-looking
promise for the market and hands the after-setup half to REQ-071. The non-goal is
kept in the corpus's usual "criterion 13 carries it" form rather than deleted.

**What T1 does not reach, and I am flagging rather than acting on:** REQ-071
owns the competitors card after setup and has no equivalent criterion — its
criterion 3 says a domain the customer adds joins the set, but nothing there
promises the product adds none of its own. REQ-071 is outside this merge's scope
and I did not edit its criteria.

## Non-goals

Union of both lists, with:

- REQ-027's "More than five competitors" gaining the "criterion 9 carries it"
  tail the corpus uses elsewhere, since criterion 9 is the promise.
- REQ-027's "Adding a competitor to the tracked set later without the founder
  choosing it" rewritten around criterion 13 (above).
- One line taken from REQ-071's list — "How competitor suggestions are derived,
  scored or ranked (BUILD §6.6 — engine)" — added here because criterion 7 now
  requires suggestions and nothing in this file said the derivation is not its
  business.
- No other line dropped; nothing in either list was a disclaim ring to the other,
  and no other line failed T1.

## Front-matter

- `depends-on`: [REQ-025] ∪ [REQ-025] = [REQ-025]. No self-edge, no cycle.
- `rests-on`: neither carried a row.
- `supersedes: [REQ-027]`.

## Citations repointed

- `journeys/JN-002.md` step 6 `exercises: [REQ-027]` → `[REQ-026]`. Steps 5 and 6
  now both exercise REQ-026; both steps stay, because confirming a market and
  confirming rivals are two things the founder does.
- `requirements/REQ-021.md` criterion 9 ("REQ-027 criterion 2" → "REQ-026
  criterion 8") and criterion 11 ("REQ-027 criterion 1" → "REQ-026 criterion 7").
- `requirements/REQ-025.md` rationale: "REQ-026, REQ-027 and REQ-028" → "REQ-026's
  — the market and the competitors that derive from it — and REQ-028's".
- `requirements/REQ-070.md` non-goal: "(REQ-025, REQ-026, REQ-027)" → "(REQ-025,
  REQ-026)".
- `requirements/REQ-071.md` non-goal: "Confirming the initial set at setup
  (REQ-027)" → "(REQ-026)".
- `requirements/REQ-091.md` rationale ("REQ-027" → "REQ-026") and its non-goal
  ("REQ-027 criterion 5" → "REQ-026 criterion 11").
- `requirements/REQ-072.md` (already `status: superseded`) cites REQ-027 twice and
  was **not** edited — retired in place, its citations frozen as the record of
  what it said.
