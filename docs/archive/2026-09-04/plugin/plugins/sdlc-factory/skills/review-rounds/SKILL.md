---
name: review-rounds
description: What each REVIEW(...) finding kind means, the two-round convention, and the readiness rule they gate. Used by the reviewer agent and consulted by any agent running its own round one before /review or an owner verb runs round two.
---

# Review

`/review` runs the reviewer agent (`agents/reviewer.md`)
against one artifact. It never rewrites prose and it never approves; it
only leaves typed findings as checkbox lines under the artifact's
`## Open questions` heading.

## The four kinds

- **`REVIEW(ambiguity)`** — a sentence with more than one plausible
  reading. Example: a REQ's acceptance criterion says "the export
  completes quickly" — quickly against what threshold, measured how?
- **`REVIEW(gap)`** — a case the artifact's own stated scope implies but
  never addresses. Example: a WO's file plan covers create and update for
  a record but its test plan has no case for delete, though the BP
  interface it inherits from lists a `DELETE` route.
- **`REVIEW(conflict with <ID>)`** — a contradiction with a named sibling
  or neighbour artifact. Example: `REVIEW(conflict with REQ-012)` on a
  REQ that promises free export while REQ-012 gates export behind a paid
  tier.
- **`REVIEW(untestable: <where>)`** — an acceptance criterion or interface
  line with no observable pass/fail. Example: "the UI feels responsive"
  names no measurement a test could assert against.

Each finding is one line, and each names where in the artifact it bites —
a criterion number, a section, a cited ID. The reviewer never batches
several unrelated worries into one line, and never rewrites the artifact
to resolve what it found — that fix belongs to the authoring agent.

## Two rounds before the owner reads a draft (rule 3.4)

Both rounds are dispatched by the owner's verb — no agent invokes another
agent (rule 3.4). Round one runs on the returned draft and its findings go
back to the author to fold in; round two runs on the folded result, before
the verb decides what to show the owner.

Worked example, exactly what `commands/require.md` does: the
requirements-analyst returns a draft; `/require` invokes the reviewer on
it (round one), hands any findings back to the analyst, then invokes the
reviewer again on the folded draft (round two). If the reviewer
adds nothing, `/require` presents the draft as **ready** to approve. If
the reviewer leaves any open `REVIEW(...)` lines — new ones, or ones round
one already left — `/require` lists every open line verbatim and presents
the draft as **not ready**.

**A draft carrying open `REVIEW(...)` lines is not presented as ready.**
Round one exists so the obvious findings never reach the owner at all;
round two exists because a draft can pick up a new conflict in the gap
between the two passes — a sibling artifact changing underneath it —
that round one could not have seen. Neither round approves anything;
only the owner's own `status: approved` does that.

**Transcribed drafts take one round.** A draft that faithfully transcribes
a cited, settled source (`skills/prd-writing/SKILL.md` — Transcribing a
settled spec) gets round one only — fidelity and testability; its
decisions were made where it cites, and a second round can only
re-litigate them. Reserve two rounds for the drafts that decide.

**A seam-conflict is a merge signal, not a finding to resolve.** When a
`REVIEW(conflict with <ID>)` sits between two artifacts that cannot state
themselves without naming each other, wording fixes will not close it — it
recurs every round until the artifacts merge. File the line once, name it
as a seam, and route it: `/requirement-cleanup` for requirements, the
architect for blueprints. *Measured live: 13 of 13 open conflicts on a
66-requirement corpus were seams.*

**A finding names what breaks.** Every `REVIEW(...)` line states what
fails for the user or the build if it stands unfixed. Style, tightening,
or restating a law that already binds the artifact is not a finding —
polish costs rounds, and rounds cost more than polish is worth.

**Two passes, then the owner.** An artifact reviewed twice in one phase
does not get a third pass: whatever still divides the author and the
reviewer goes to the owner as one batch — each item, one line per side.
*Measured on the first live corpus: the requirements phase burned 1.17M
output tokens before its stop conditions existed, and 115k after.*

## A clean pass

If the reviewer finds nothing, it writes nothing to the file — no empty
`## Open questions` heading, no "looks good" note — and says so in its
return instead. Silence in the file is indistinguishable from a review
that never ran; the return line is what makes a clean pass legible.

## A finding is deleted, never checked off

Per rule 2.1, an answered question is deleted, not ticked. The agent that
resolves a `REVIEW(...)` line — by fixing what it named, or by the owner
ruling it moot — deletes that line itself; the reviewer never comes back
to check its own box. The next review pass is how resolution is
confirmed: it finds nothing new to add where the fixed finding used to be.
Lines never accumulate into a log — an artifact's `## Open questions`
section only ever holds what is still true right now.
