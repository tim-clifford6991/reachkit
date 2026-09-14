// SPEC §7 — the draft view's one client component: the whole draft to read,
// the grounded-fact highlight with its source line, the claim-check badge,
// Approve / Edit / Veto, "what happens if you do nothing", Markdown edit with
// live preview, and a back link to the calendar. daisyUI cards, badges and
// buttons in the route; lucide for the two glyphs.
//
// One component owns the four things that change on this screen — which
// arm is on display (read or edit), what the buffer holds,
// whether it has reached the store, and what the store last said — because
// all four answer to the same edit. Split across components they would need
// a shared store; here they are pieces of one state and a keystroke updates
// them together. The two arms' *markup* is below; the rail is
// `DecidePanel`, the two panes are `Editor`, and neither holds state.
//
// Five rules this component keeps, each of them a criterion rather than a
// preference:
//
//  1. **The body is never truncated** (c1). `RenderedBody` places the whole
//     of it; there is no budget, no "show more", no clamped height.
//  2. **The grounding follows the text** (c8). `present` is recomputed
//     against the buffer on every render, so the highlight survives an edit
//     that spared the fact and is gone the moment the fact is not there.
//     The fact itself is never rewritten to fit. The Checks rail reads the
//     same value, so a marked fact and a passed grounding row cannot
//     disagree.
//  3. **The badge drops the moment the text differs** (c9, §4.6's "drops
//     the claim-check badge until the check re-runs on save"). The stored
//     outcome is shown only while the buffer is byte-for-byte the text the
//     check ran against; the instant it is not, the badge is
//     `outstanding`. That is stricter than "on save" and deliberately so —
//     the rationale REQ-045 states is that the view "must never leave a
//     stale check result attached to text the customer has since altered",
//     and text altered but not yet saved is exactly that.
//  4. **A save that does not land loses nothing** (c7). The buffer is this
//     component's state and no code path here clears it except the
//     customer's own "Discard changes", which returns it to the text the
//     store last confirmed and never to something the store never saw.
//     Today every save is refused — `save.ts` is the declared seam and its
//     store is not built — so this screen shows the customer precisely
//     what a real outage would show them, and tells them nothing false.
//  5. **The save line states what happened, not what is intended.**
//     "saving…" while a call is in flight, "saved {time}" only after the
//     store answered and only while the buffer is that text, and the
//     could-not-save sentence after a refusal. There is no fourth arm and
//     no optimistic one.
"use client";

import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AUTOSAVE_DEBOUNCE_MS } from "@/lib/config/constants";
import { copy } from "@/lib/presentation/copy";
import { ArrowLeft, Copy } from "lucide-react";
import { formatCount, formatDate, formatDateTime, formatTime } from "../../_shell/format";
import { writtenLine } from "../../_shell/written";
import { publishing } from "../../calendar/publishing";
import { STAGE_FILTER_COPY_KEY, STAGE_OF, STAGE_TONE, TONE_BADGE } from "../../calendar/stages";
import { CLAIM_COPY_KEY, CLAIM_TONE, claimAfterSave } from "./claim";
import { CopyOut } from "./CopyOut";
import { DecidePanel } from "./DecidePanel";
import type { DraftCommand } from "./actions";
import { draftStore } from "./save";
import { Editor, type EditorPane } from "./Editor";
import { PageRecordBlock } from "./PageRecordBlock";
import { factPresentIn } from "./grounded";
import { RenderedBody } from "./RenderedBody";
import { useDebounced } from "./useDebounced";
import { wordCount, type DraftView } from "./model";

const EYEBROW = "text-xs font-semibold uppercase tracking-wide opacity-70";

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
  /** When the store last confirmed a save, and whether the last attempt was
   *  refused. Both are set only from what the store answered — there is no
   *  optimistic arm, and "in flight" is not stored at all: a buffer that
   *  differs from the saved text with no refusal standing **is** a save on
   *  its way, and deriving it is what keeps the line from claiming a call
   *  that never went out. */
  const [savedAt, setSavedAt] = useState<Date | null>(view.lastSavedAt);
  const [refused, setRefused] = useState(false);

  const unsaved = bodyMd !== savedBody;
  const settled = useDebounced(bodyMd, AUTOSAVE_DEBOUNCE_MS);

  const save = useCallback(
    (text: string): void => {
      void draftStore
        .save({ draftId: view.draftId, bodyMd: text })
        .then((result) => {
          // Last write wins: what came back is the draft, and nothing is
          // merged into the buffer. A refusal moves nothing at all.
          if (result.ok) {
            setSavedBody(text);
            setSavedAt(result.savedAt);
            setRefused(false);
            return;
          }
          setRefused(true);
        })
        .catch(() => {
          setRefused(true);
        });
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
  const grounded = factPresentIn(bodyMd, view.grounded.passage);
  // Whether generation recorded a grounding at all: three facts, and the
  // section below is drawn only where at least one of them exists (#268).
  const hasGrounding =
    view.grounded.passage !== "" || view.grounded.url !== "" || view.grounded.readAt !== null;

  const editedNote = view.authorship.edited
    ? writtenLine("draft.authorship.edited", {
        at: formatDate(view.authorship.firstEditedAt, view.timeZone),
      })
    : null;
  const matchedLine =
    claim.state === "failed" ? writtenLine("draft.claim.matched", { entry: claim.matchedEntry }) : null;

  /** The stage, spoken through the calendar's own projection so the two
   *  surfaces cannot call one state by two names. `null` for a state that
   *  occupies no date at all, which draws no chip rather than an unnamed
   *  one. */
  const stage = STAGE_OF[view.state];

  /** The claim badge, in every one of its four states — including the empty
   *  do-not-claim list, which states that there was nothing to check
   *  against and is never a silent pass (c3). The state is on the element
   *  as well as in the word, because two of the four words are the owner's
   *  and are not written yet. */
  const claimBadge = (
    <span
      className={`badge ${TONE_BADGE[CLAIM_TONE[claim.state]]}`}
      data-testid={`draft-claim-${claim.state}`}
    >
      {copy(CLAIM_COPY_KEY[claim.state])}
    </span>
  );

  const stageBadge =
    stage === null ? null : (
      <span className={`badge ${TONE_BADGE[STAGE_TONE[stage]]}`} data-testid={`draft-stage-${stage}`}>
        {copy(STAGE_FILTER_COPY_KEY[stage])}
      </span>
    );

  /** Criterion 2's source line: the address the fact was read from and the
   *  date it was read. Both are values, so they render in mono and need no
   *  sentence to be readable — and **no part of it is drawn without its
   *  fact** (issue #268). */
  const sourceLine =
    view.grounded.url === "" && view.grounded.readAt === null ? null : (
      <p className="my-2 flex flex-wrap gap-2 text-xs opacity-70" data-testid="draft-grounded">
        {view.grounded.url === "" ? null : (
          <a href={view.grounded.url} className="link num min-w-0 truncate" data-testid="draft-grounded-url">
            {view.grounded.url}
          </a>
        )}
        {view.grounded.readAt === null ? null : (
          <span className="num" data-testid="draft-grounded-read-at">
            {formatDate(view.grounded.readAt, view.timeZone)}
          </span>
        )}
      </p>
    );

  const body = (
    <RenderedBody
      bodyMd={bodyMd}
      markFact={grounded ? view.grounded.passage : null}
      source={sourceLine ?? undefined}
      data-testid="draft-body"
    />
  );

  /** The fact, printed as prose, for the one case the marked passage cannot
   *  carry it: an edit removed it from the body. A grounding the edit
   *  removed is never invisible (c8). */
  const droppedGrounding =
    hasGrounding && !grounded ? (
      <section className="flex flex-col gap-1" data-testid="draft-grounded-dropped">
        <h2 className={EYEBROW}>{copy("draft.grounded.title")}</h2>
        <p className="min-w-0 break-words" data-testid="draft-grounded-fact">
          {view.grounded.passage}
        </p>
        {sourceLine}
      </section>
    ) : null;

  // ── the edit arm ────────────────────────────────────────────────────
  if (editing) {
    const stateBadge = refused ? (
      <span className="badge badge-error" data-testid="draft-edit-state-unsaved">
        {copy("draft.edit.state.unsaved")}
      </span>
    ) : unsaved ? (
      <span className="badge badge-ghost" data-testid="draft-edit-state-edited">
        {copy("draft.edit.state.edited")}
      </span>
    ) : (
      claimBadge
    );

    const saveLine = refused
      ? copy("draft.unsaved")
      : unsaved
        ? copy("draft.edit.saving")
        : savedAt === null
          ? null
          : copy("draft.edit.saved", { at: formatTime(savedAt, view.timeZone) });

    return (
      <div className="flex min-w-0 flex-col gap-4" data-testid="draft-view">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav data-testid="draft-edit-back">
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditing(false)}>
              <ArrowLeft size={16} strokeWidth={1.75} aria-hidden />
              {copy("draft.edit.back")}
            </button>
          </nav>
          <span className="flex flex-wrap items-center gap-2" data-testid="draft-claim">
            {stageBadge}
            {stateBadge}
          </span>
        </div>

        <section className="card card-border bg-base-100 min-w-0" data-testid="draft-edit-card">
          <div className="card-body min-w-0 gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h1 className="card-title break-words text-2xl">{view.title}</h1>
              {saveLine === null ? null : (
                <span className="text-xs opacity-70" data-testid="draft-save-line">
                  {saveLine}
                </span>
              )}
            </div>
            <div className="divider my-0" />
            <Editor
              bodyMd={bodyMd}
              // A keystroke is a new attempt: the refusal standing against the
              // *previous* text is no longer what the store said about this
              // one, and leaving it up would keep "could not save" on screen
              // over a save that is about to run.
              onChange={(text) => {
                setBodyMd(text);
                setRefused(false);
              }}
              onFlush={() => {
                // Read from this render's own state, not from the refs: a blur
                // can follow a keystroke inside one tick, before the effect
                // that updates them has run.
                if (bodyMd !== savedBody) save(bodyMd);
              }}
              markFact={grounded ? view.grounded.passage : null}
              pane={pane}
              onPane={setPane}
            />
            <p className="text-sm opacity-70" data-testid="draft-edit-footnote">
              {copy("draft.edit.footnote")}
            </p>
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-sm btn-primary"
            data-testid="draft-edit-done"
            onClick={() => setEditing(false)}
          >
            {copy("draft.edit.done")}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            data-testid="draft-edit-discard"
            // Back to the text the store last confirmed — never to something
            // the store never saw.
            onClick={() => setBodyMd(savedBody)}
          >
            {copy("draft.edit.discard")}
          </button>
        </div>
      </div>
    );
  }

  // ── the read arm ────────────────────────────────────────────────────
  const written =
    view.writtenAt === null
      ? copy("draft.words", { words: formatCount(wordCount(bodyMd)) })
      : copy("draft.written", {
          at: formatDateTime(view.writtenAt, view.timeZone),
          words: formatCount(wordCount(bodyMd)),
        });

  return (
    <div className="flex min-w-0 flex-col gap-4" data-testid="draft-view">
      <nav data-testid="draft-back">
        <a href="/app/calendar" className="btn btn-sm btn-ghost">
          <ArrowLeft size={16} strokeWidth={1.75} aria-hidden />
          {copy("draft.back")}
        </a>
      </nav>

      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <article className="card card-border bg-base-100 min-w-0" data-testid="draft-card">
            <div className="card-body min-w-0 gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex min-w-0 flex-wrap items-center gap-2" data-testid="draft-claim">
                  {stageBadge}
                  {claimBadge}
                  {claim.state === "failed" ? (
                    // c11: the customer is told which entry held the draft.
                    // The entry is their own recorded text and renders as a
                    // value, whether or not the sentence beside it is written.
                    <span className="num text-sm" data-testid="draft-claim-entry">
                      {claim.matchedEntry}
                    </span>
                  ) : null}
                  {matchedLine === null ? null : <span className="text-sm">{matchedLine}</span>}
                </span>
                {/* REQ-093 c2's label, bound to the text it speaks for. */}
                <span className="badge badge-outline" data-testid="draft-generated-label">
                  {p.generatedLabel}
                </span>
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <h1 className="card-title break-words text-2xl">{view.title}</h1>
                <p className="text-xs opacity-70" data-testid="draft-written">
                  {written}
                </p>
              </div>
              <div className="divider my-0" />
              {body}
              {droppedGrounding}
              {/* Where the customer has edited, the note that keeps the
                  generated-content label from speaking for their words. */}
              {editedNote === null ? null : (
                <p className="text-xs opacity-70" data-testid="draft-edited-note">
                  {editedNote}
                </p>
              )}
              {/* c7: the change is unsaved and the customer is told so, in
                  the view, while their words stay in the buffer. */}
              {unsaved ? (
                <p className="text-xs opacity-70" data-testid="draft-unsaved">
                  {copy("draft.unsaved")}
                </p>
              ) : null}
            </div>
          </article>

          {/* What became of this page (issue #217) — absent rather than empty
              for a draft whose record could not be read. */}
          {view.record === null ? null : (
            <PageRecordBlock record={view.record} timeZone={view.timeZone} />
          )}

          {/* Copy-out is always shown — for a draft and a published page alike
              (c12). */}
          <section className="card card-border bg-base-100 min-w-0" data-testid="draft-copy-card">
            <div className="card-body min-w-0 gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className={`flex items-center gap-2 ${EYEBROW}`}>
                  <Copy size={20} strokeWidth={1.75} aria-hidden />
                  {copy("draft.copy.title")}
                </h2>
                <span className="badge badge-ghost h-auto whitespace-normal py-1 text-left">
                  {copy("draft.copy.note")}
                </span>
              </div>
              <CopyOut bodyMd={bodyMd} />
            </div>
          </section>
        </div>

        <DecidePanel
          view={view}
          grounded={grounded}
          claim={claim}
          onEdit={() => setEditing(true)}
          onCommand={(command) => run(command, view.draftId)}
        />
      </div>
    </div>
  );
}
