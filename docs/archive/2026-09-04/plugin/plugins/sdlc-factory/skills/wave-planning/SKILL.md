---
name: wave-planning
description: How to propose, read, and close a wave — the cycle of work orders the corpus is currently building. Use for /wave propose/show/close, or when editing registry/waves.md.
---

# Wave Planning

A wave is one goal sentence and up to 8 work orders that together deliver
it. Smaller is fine; bigger means the goal isn't one thing yet — split it
into two waves rather than writing a longer sentence.

## The wave is the gate unit (0.13.2)

A wave is no longer just a batch of work: it is the unit every
corpus-reading gate runs over exactly once. At close, one validator pass
covers every order the row names against the merged `wave/W<n>` branch and
writes one `## TST-###` section with a `Validates:` line; one regression
sweep covers the union of those orders' impact; one librarian audit sets
`done` for all of them. An order proves only its own tests and typecheck
before it merges (constitution §3).

Two consequences for how a row is proposed. **The cap matters more.** Eight
orders is one validation pass over eight orders' criteria — a row that runs
long makes that pass long, and a rejected order at close blocks nothing
else but still has to be re-run inside the wave. **The row's first id is
load-bearing**: the wave's single validation section is written into that
order's body, so it should be an order that survives the wave (never one
likely to be carried or superseded).

## The record, in two places

`registry/waves.md` is the librarian's to write, same as every other
registry file (constitution §4's agent table) — consistent across all
three `/wave` actions: the planner *proposes* a row's text on `propose`
and returns it, the librarian *writes* it, exactly as the librarian
already owns `show`'s read and `close`'s write.

It holds one table, one row per wave:

```
| Wave | Goal | Work orders | Status |
|---|---|---|---|
| W1 | The cache reader ships | WO-001 (Must), WO-002 (Should) | open |
```

Every WO the row names also carries `wave: W1` in its own front-matter —
the same fact, declared twice, on purpose: neither side is derived from
the other, so the two can drift, and `wave-off-record` is the console
rule that checks whether they still agree. If you hand-edit either side,
edit both. `Work orders` is ordered — dependency order, the order a build
would actually run them in — not alphabetical or by-priority. Each id may
carry its MoSCoW word in parentheses right after it, exactly as written
above; the console reads the id and the word separately (`wos` stays bare
ids, the word lands in `priorities`) but the cell is written with both
together.

## Selecting the set

A candidate for the next wave is a work order that is `status: approved`
and carries no `wave:` at all (absent, not empty — a WO the planner cut
starts this way and stays this way until a wave claims it). Never a
`draft` or `in-review` WO: it hasn't cleared its own gate yet, and a wave
is a commitment to build, not a wishlist.

Order the set by `depends-on`: a WO never precedes anything it depends
on. Within that order, mark each with a MoSCoW word in parentheses after
the id — `WO-003 (Must)`, `WO-004 (Should)`, `WO-007 (Could)` — the
owner's read of what the wave still delivers its goal without, if
something slips. `Must` items are what the goal sentence promises;
everything else is stretch.

Cap at 8. A ninth candidate doesn't get dropped, it waits for the next
wave — proposing 8 is a judgment call about focus, not a hard technical
limit, and the planner states which candidates it left out and why.

## Closing

A wave closes only once every WO it names is accounted for, one of three
ways — never a silent partial close, and never a wave that closes because
most of it shipped:

- `status: done`.
- Explicitly named by the owner as **carried**: its `wave:` field is
  cleared back to absent, the same state a freshly-cut WO starts in, so
  the next `propose` can pick it up again — reordered, reprioritized, or
  split, as the work now warrants.
- `status: superseded`: **retired**, not done and never carried — the
  work isn't happening under this id any more, so there's nothing to
  carry. Accounted for on its own, without the owner naming it, and
  listed as retired in the close summary; its `wave:` is left untouched,
  and `/wave propose` never re-selects it (superseded was never a
  candidate status to begin with).

A `done` WO keeps its `wave:` — that's the historical record of which
wave shipped it, and `registry/waves.md`'s closed rows are the wave
history, never rewritten once closed.

## Never

- Never write a `wave:` value with no matching row in `registry/waves.md`
  — that's exactly what `wave-off-record` exists to catch.
- Never put a `draft` work order in a wave.
- Never close a wave with an unaccounted-for WO still in it, even if only
  one is missing.
- Never leave more than one `open` row at once — a WO is in at most one
  open wave, and the console reads "the current wave" as the last `open`
  row, singular.
