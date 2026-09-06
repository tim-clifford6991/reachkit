// BUILD §4.6 — the draft view's one client component.
//
// "(full page render, grounded-fact highlight with its source line,
// claim-check badge, Approve/Edit/Veto, and the 'what happens if you do
// nothing' info box). Back link returns to the calendar."
//
// One component owns the three things that change on this screen — which
// body is on display (read or edit), what the buffer holds, and whether it
// has reached the store — because all three answer to the same edit. Split
// across components they would need a shared store; here they are three
// pieces of one state and a keystroke updates them together.
//
// Four rules this component keeps, each of them a criterion rather than a
// preference:
//
//  1. **The body is never truncated** (c1). `RenderedBody` places the whole
//     of it; there is no budget, no "show more", no clamped height.
//  2. **The grounding follows the text** (c8). `present` is recomputed
//     against the buffer on every render, so the highlight survives an edit
//     that spared the fact and is gone the moment the fact is not there.
//     The fact itself is never rewritten to fit.
//  3. **The badge drops the moment the text differs** (c9, §4.6's "drops
//     the claim-check badge until the check re-runs on save"). The stored
//     outcome is shown only while the buffer is byte-for-byte the text the
//     check ran against; the instant it is not, the badge is
//     `outstanding`. That is stricter than "on save" and deliberately so —
//     the rationale REQ-045 states is that the view "must never leave a
//     stale check result attached to text the customer has since altered",
//     and text altered but not yet saved is exactly that.
//  4. **A save that does not land loses nothing** (c7). The buffer is this
//     component's state and no code path here clears it; a refusal leaves
//     the unsaved indicator standing and the next pause tries again.
//     Today every save is refused — `save.ts` is the declared seam and its
//     store is not built — so this screen shows the customer precisely
//     what a real outage would show them, and tells them nothing false.
"use client";

import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AUTOSAVE_DEBOUNCE_MS } from "@/lib/config/constants";
import { copy } from "@/lib/presentation/copy";
import { Alert } from "@/ui/components/Alert";
import { Badge } from "@/ui/components/Badge";
import { Btn } from "@/ui/components/Btn";
import { formatDate, formatDateTime } from "../../_shell/format";
import { writtenLine } from "../../_shell/written";
import { publishing } from "../../calendar/publishing";
import { CLAIM_COPY_KEY, CLAIM_TONE, claimAfterSave } from "./claim";
import { CopyOut } from "./CopyOut";
import { draftActionsFor, type DraftCommand } from "./actions";
import { draftStore } from "./save";
import { Editor, type EditorPane } from "./Editor";
import { factPresentIn } from "./grounded";
import { RenderedBody } from "./RenderedBody";
import { useDebounced } from "./useDebounced";
import type { DraftView } from "./model";

/** The two writes this screen can ask for. Both are §9 edges and both go to
 *  the state machine through the seam; a refusal rejects with
 *  `PublishingRefusedError`, and this handler deliberately tells the
 *  customer nothing: there is no registry sentence for a refused write, and
 *  inventing one is what the copy law forbids. The rejection is the
 *  developer's signal; the screen stays as it was. */
function run(command: DraftCommand, draftId: string): void {
  const asked =
    command === "approve" ? publishing.approve({ draftId }) : publishing.veto({ draftId });
  void asked.catch(() => undefined);
}

export function DraftScreen(p: {
  view: DraftView;
  /** REQ-093 c2's label, resolved on the server by the one sink for model
   *  text (`renderGenerated`) and carried here as a plain string. */
  generatedLabel: string;
}): React.JSX.Element {
  const { view } = p;
  const [editing, setEditing] = useState(false);
  const [pane, setPane] = useState<EditorPane>("markdown");
  const [bodyMd, setBodyMd] = useState(view.bodyMd);
  /** The text the store last confirmed. It starts as what was read, and
   *  only a successful save moves it — which is what makes the unsaved
   *  indicator honest. */
  const [savedBody, setSavedBody] = useState(view.bodyMd);

  const unsaved = bodyMd !== savedBody;
  const settled = useDebounced(bodyMd, AUTOSAVE_DEBOUNCE_MS);

  const save = useCallback(
    (text: string): void => {
      void draftStore
        .save({ draftId: view.draftId, bodyMd: text })
        .then((result) => {
          // Last write wins: what came back is the draft, and nothing is
          // merged into the buffer. A refusal moves nothing at all.
          if (result.ok) setSavedBody(text);
        })
        .catch(() => undefined);
    },
    [view.draftId]
  );

  // c6, the pause: one save per settled buffer, never one per keystroke.
  useEffect(() => {
    if (settled === savedBody) return;
    save(settled);
  }, [settled, savedBody, save]);

  // c6, "or leaves the view": the last buffer is flushed on unmount, past
  // the debounce. Refs, because the cleanup runs once and must see the text
  // as it stood when the customer left, not as it stood when the effect was
  // created — and they are written in an effect rather than during render,
  // which is where a ref may be touched at all.
  const bodyRef = useRef(bodyMd);
  const savedRef = useRef(savedBody);
  useEffect(() => {
    bodyRef.current = bodyMd;
    savedRef.current = savedBody;
  }, [bodyMd, savedBody]);
  useEffect(() => {
    return () => {
      if (bodyRef.current !== savedRef.current) save(bodyRef.current);
    };
  }, [save]);

  // Rule 3: the stored outcome stands only while the text is the text it
  // ran against.
  const claim = bodyMd === view.bodyMd ? view.claim : claimAfterSave();
  // Rule 2: the highlight is a function of the buffer, never of a stored flag.
  const grounded = factPresentIn(bodyMd, view.grounded.fact);

  const doNothingLine =
    view.doNothing.publishesAt === null
      ? writtenLine(view.doNothing.key)
      : writtenLine(view.doNothing.key, {
          at: formatDateTime(view.doNothing.publishesAt, view.timeZone),
        });
  const editedNote = view.authorship.edited
    ? writtenLine("draft.authorship.edited", {
        at: formatDate(view.authorship.firstEditedAt, view.timeZone),
      })
    : null;
  const matchedLine =
    claim.state === "failed" ? writtenLine("draft.claim.matched", { entry: claim.matchedEntry }) : null;

  return (
    <div className="flex min-w-0 flex-col gap-4" data-testid="draft-view">
      <nav>
        <a href="/app/calendar" data-testid="draft-back">
          {copy("draft.back")}
        </a>
      </nav>

      <h1>{view.title}</h1>

      {/* The claim-check badge, in every one of its four states — including
          the empty do-not-claim list, which states that there was nothing
          to check against and is never a silent pass (c3). */}
      <div className="flex flex-wrap items-center gap-2" data-testid="draft-claim">
        {/* The state is on the element as well as in the word, because the
            four words are the owner's and are not written yet: a test that
            could only read the rendered text could not tell four unwritten
            badges apart, and neither could a screenshot. */}
        <span data-testid={`draft-claim-${claim.state}`}>
          <Badge tone={CLAIM_TONE[claim.state]}>{copy(CLAIM_COPY_KEY[claim.state])}</Badge>
        </span>
        {claim.state === "failed" ? (
          // c11: the customer is told which entry held the draft. The
          // entry is their own recorded text and renders as a value, so it
          // is named whether or not the sentence beside it is written yet.
          <span className="num break-words" data-testid="draft-claim-entry">
            {claim.matchedEntry}
          </span>
        ) : null}
        {matchedLine === null ? null : <span>{matchedLine}</span>}
      </div>

      {/* c4: approve, edit and veto, all without leaving the view. Which of
          them is offered is projected from §9's transition table, so this
          screen and the calendar's day panel cannot disagree for one state. */}
      <div className="flex flex-wrap gap-2" data-testid="draft-actions">
        {draftActionsFor(view.state).map((action) => (
          <span key={action.key} data-testid={`draft-action-${action.key}`}>
            <Btn
              label={copy(action.key)}
              variant={action.kind === "edit" ? "ghost" : "primary"}
              size="sm"
              onClick={
                action.kind === "edit" ? () => setEditing(true) : () => run(action.command, view.draftId)
              }
            />
          </span>
        ))}
      </div>

      {/* §4.6's "what happens if you do nothing" info box. The time is a
          value and renders whether or not the sentence around it has been
          written; under copilot there is no time, because nothing happens. */}
      <Alert
        tone="neutral"
        message={
          <span className="flex flex-col gap-1" data-testid="draft-do-nothing">
            <span className="font-bold">{copy("draft.do-nothing.title")}</span>
            {view.doNothing.publishesAt === null ? null : (
              <span className="num" data-testid="draft-do-nothing-at">
                {formatDateTime(view.doNothing.publishesAt, view.timeZone)}
              </span>
            )}
            {doNothingLine === null ? null : <span>{doNothingLine}</span>}
          </span>
        }
      />

      {/* c2: the source line — the address the fact was read from and the
          date it was read. Both are values (§2.3), so they render in mono
          and need no sentence to be readable. The fact itself is printed
          here only when it is *not* marked in the body, so a grounding the
          edit removed is never invisible. */}
      <section className="flex flex-col gap-1" data-testid="draft-grounded">
        <p className="eyebrow">{copy("draft.grounded.title")}</p>
        {grounded ? null : (
          <p className="min-w-0 break-words" data-testid="draft-grounded-fact">
            {view.grounded.fact}
          </p>
        )}
        <p className="rk-prov flex flex-wrap gap-2">
          <a href={view.grounded.url} className="num" data-testid="draft-grounded-url">
            {view.grounded.url}
          </a>
          <span className="num" data-testid="draft-grounded-read-at">
            {formatDate(view.grounded.readAt, view.timeZone)}
          </span>
        </p>
      </section>

      {/* REQ-093 c2's label, and — where the customer has edited — the note
          that keeps it from speaking for their words. */}
      <p className="rk-prov" data-testid="draft-generated-label">
        {p.generatedLabel}
      </p>
      {editedNote === null ? null : (
        <p className="rk-prov" data-testid="draft-edited-note">
          {editedNote}
        </p>
      )}

      {/* c7: the change is unsaved and the customer is told so, in the view,
          while their words stay in the buffer. */}
      {unsaved ? (
        <p data-testid="draft-unsaved">{copy("draft.unsaved")}</p>
      ) : null}

      {editing ? (
        <Editor
          bodyMd={bodyMd}
          onChange={setBodyMd}
          onFlush={() => {
            // Read from this render's own state, not from the refs: a blur
            // can follow a keystroke inside one tick, before the effect
            // that updates them has run.
            if (bodyMd !== savedBody) save(bodyMd);
          }}
          markFact={grounded ? view.grounded.fact : null}
          pane={pane}
          onPane={setPane}
        />
      ) : (
        <RenderedBody
          bodyMd={bodyMd}
          markFact={grounded ? view.grounded.fact : null}
          data-testid="draft-body"
        />
      )}

      {/* §9: "always shown" — for a draft and for a published page alike. */}
      <CopyOut bodyMd={bodyMd} />
    </div>
  );
}
