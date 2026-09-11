---
description: Owner cockpit · Say what you want — the orchestrator drives every verb and stops only where your word is required
---

The one interface. I say what I want — or nothing at all — and this
drives the pipeline: classify, consult the state, dispatch the subagent
chains end to end, and stop only at an owner checkpoint. I never need to
know which verb comes next; that is this command's job.

## The loop

1. **Classify** the input per constitution §9: new requirement · change
   to a named artifact · question · feedback on built software ·
   architectural constraint. Echo the classification in one line each.
   No input? Report the state first — this is what `/status` did until
   0.12.0 folded it here: `factory-console next`'s headline verbatim,
   then `--check`'s error/warn counts and the coverage lines its notices
   carry (fan-out, volume, assumptions), then the open wave's work
   orders by status and what blocks them (`registry/generated/blocked.md`
   and `assumptions.md`, never re-derived by hand) — and the single most
   valuable next action. Then continue at 2.
2. **Consult the state**: run `factory-console next` from the project
   root (binary resolution per `commands/console.md`). Its headline plus
   the classification pick the segment.
3. **Drive the segment end to end** — the whole chain, not one step, and
   never a question between system verbs:
   - an ask → `/require`'s full flow (skeleton-first at corpus scale:
     journeys + laws + slot list to the checkpoint, then isolated fills);
     analyst → round one → fold → round two;
   - approved requirements without blueprints → `/expand-requirement`
     (skeleton phase, then parallel fills) → `/workorder`;
   - approved work with no wave → `/wave propose` (the row comes to the
     checkpoint);
   - an open wave → per work order, the preview gate above first, then
     `/implement`, which builds, runs that order's own tests and
     typecheck, merges into `wave/W<n>` and stops (0.13.2) — then the
     next order, until every one has merged. **`/validate`, `/regress`
     and the done audit do not run here**: all three run once, at
     `/wave close`, over the wave's merged result (constitution §3). This
     loop is still the one caller of `/validate` and `/regress`
     (constitution §4's routing map) — it calls them at close, once;
   - a `ui: yes` work order with no dated `Signed-off:` line → `/design
     preview WO-###`, whose published page lands in the checkpoint as a
     link for sign-off; once the owner has answered — on the page or in
     the session — the librarian reads it back and writes the line (rule
     7.3). This is a **stop**, not a preference: the loop does not reach
     `/implement` for that work order, and `factory-console next` will
     not name it either. The only way past is the owner's ruling,
     recorded by the librarian as `- <date> ruled — owner — <one line>`
     in the WO's own `## Log`;
   - a change to an existing artifact (§9's second class), or a commit
     under governed paths that names no work order (`untraced-change`) →
     `/sync`, the backward pass, before anything downstream moves;
   - reported problems with built software → `/feedback` triage.
   Rules 7.4 (vertical slices), 3.4 + two-passes-then-owner (review
   budget), and 4.3 (returns are deltas) govern throughout.
4. **Checkpoint — the only stop.** When the segment completes, or an
   owner gate blocks, present ONE batch, never a drip:
   - clarifying questions — rule 1.3 only: specific, decision-shaped,
     nothing an approved artifact or a defensible default answers;
   - approvals due — each in-review artifact, one line;
   - rulings due — each `/decide` item, one line per side;
   - previews awaiting sign-off — the page URL and version, one line on
     what each shows (the owner can answer in a comment there, or here);
   - the coverage line — `--check` errors/warns and `next`'s remaining
     stages, so comprehensiveness is visible, not asserted.
   The answers are owner decisions: apply them through the proper verbs
   (statuses, rulings recorded, sign-offs written), commit the batch —
   the owner accepted by answering — and return to step 2. Continue
   until the next checkpoint, or until `next` reports idle.

## What this never does

Write the corpus from this session (agents write; the PreToolUse gate
enforces it) · skip a stage gate · ask what an approved artifact already
answers · run a third review pass · fan horizontal past the open wave
(rule 7.4) · bury a decision inside prose instead of the checkpoint.

Input: $ARGUMENTS
