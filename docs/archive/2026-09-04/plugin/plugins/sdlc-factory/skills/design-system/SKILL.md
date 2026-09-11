---
name: design-system
description: Rules for any UI/UX work - tokens, components, preview-before-code gate. Use whenever a REQ, BP, WO, or code change involves user interface.
---

# Design System Discipline

Order of operations for any UI feature:
0. The WO declares `ui: yes` in its front-matter — exactly that key and
   value (0.8.0; the head-bullet `- UI: yes` is the pre-0.8.0 form and is
   no longer read). This is the field rule 7.3 is matched on; `true`, `n`
   and `touches` are not it, and a WO spelling it any other way is
   outside the gate.
1. BP node specifies the screen in words: data shown, primary action,
   states. A project that accumulates recurring screen shapes may keep its
   own `design/patterns.md`; the skeleton doesn't scaffold one until
   there's something to put in it.
2. Design-guardian (or planner via design-guardian) produces the PREVIEW
   SHEET: single-file HTML prototype, mock data, registry components only,
   tokens by name. Saved to
   sdlc-factory/docs/design/previews/WO-XXX.html — the record, versioned
   with the corpus.
2a. The design-guardian PUBLISHES that file as an artifact and records the
   page in two places: `- <date> preview — design-guardian — v<n> — <url>`
   in the work order's `## Log`, and the `Preview` cell of every
   components.md row the sheet registers. Same file path each revision, so
   the page keeps its URL and takes the next version. The owner opens a
   link, not a file on the machine that ran the agent — which is the whole
   reason this step exists. `preview-without-url` (warn) reports a
   `ui: yes` WO that reached `approved` or `done` with no such log line.
3. Owner reviews the page and gives the word there — a comment addressed
   to Claude, or a ruling in the session naming that URL. Changes iterate
   on the sheet and republish as a new version, never on production code.
   The LIBRARIAN reads the word back and writes the `Signed-off:` line
   (`agents/librarian.md`); silence is not a sign-off. Once it stands, the
   design-guardian flips that preview's rows in components.md from
   `proposed` to `approved`: a signed preview over a still-`proposed`
   registry is the table lagging its own gate.
4. Only then may the implementer write UI code — matching the approved
   preview. Deviation = validator REJECT. "Only then" is mechanical from
   0.13.1, not a reading order: `factory-console next` will not point at
   `/implement` for a `ui: yes` work order with no dated `Signed-off:`
   line, `/implement` refuses to dispatch one, and the implementer
   refuses to start (`agents/implementer.md` rule 1a). Past all three
   only by the owner's own ruling, recorded as `- <date> ruled — owner —
   <one line>` in the WO's `## Log`. A sheet drawn after the code is a
   description of what was built — it documents, it cannot have shaped
   anything, and `preview-without-url` keeps reporting the order until
   one is published either way.
5. Before the validator's verdict, the design-guardian runs its UI-fit
   pass (`agents/design-guardian.md`): placement against the journey map,
   navigation, related settings, and adjacent features it should connect
   to — written as `- [ ] REVIEW(placement): …` lines under the WO's own
   `## Open questions`, never a design-file edit. This is a
   recommendation, not a preview-gate defect: it never blocks the verdict
   the way a missed token or component does in step 4. The validator
   (`agents/validator.md`), dispatched next by `/validate`
   (`commands/validate.md`), counts what the pass left open and writes
   one `Placement:` line into its own TST report: `Placement: clean` when
   nothing is open, or `Placement: reviewed — <n> open questions` when
   something still is. The librarian's `done` gate requires this line on
   every `ui: yes` WO (`agents/librarian.md`) — a `ui: no` WO carries
   neither the pass nor the line.

## tokens.md readiness gate

`tokens.md` carries `Status: draft` until it is backfilled with real
values. **While it is `draft`, every UI WO is blocked** — there is no law
book yet for the design-guardian to enforce. Fill in the placeholders,
set `Status: <ready>`, then UI WOs may proceed. This is a project-startup
condition, not a standing rule about any particular project's tokens — a
fresh install starts here; don't assume any given corpus is still in it.

Hard rules (validators enforce):
- Tokens by name only; raw hex/px in UI code is a defect.
- Components from components.md only; new ones enter via `proposed` flow.
- No long LLM-generated text anywhere in the UI. Microcopy ≤ 1 sentence.
- Every data view specifies loading, empty, and error states.
- Simplicity: one primary action per screen; cut before you add.
