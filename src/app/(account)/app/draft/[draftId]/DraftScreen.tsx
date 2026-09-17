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
//     A refused save shows the customer precisely what a real outage
//     would show them, and tells them nothing false.
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
import { draftStore, type SaveBody } from "./save";
import { Editor, type EditorPane } from "./Editor";
import { PageRecordBlock } from "./PageRecordBlock";
import { TargetBlock } from "./TargetBlock";
import { factPresentIn } from "./grounded";
import { RenderedBody } from "./RenderedBody";
import { useDebounced } from "./useDebounced";
import { wordCount, type ClaimState, type DraftView } from "./model";
import type { RailCheck } from "./checks";

/** The three fields the founder edits (#789), as one value: the buffer, the
 *  text the store last confirmed, and the text the last check ran on are
 *  each one of these. */
type DraftText = Omit<SaveBody, "draftId">;

function sameText(a: DraftText, b: DraftText): boolean {
  return a.title === b.title && a.bodyMd === b.bodyMd && a.description === b.description;
}

/** What the last check found, and the text it found it on. */
interface Checked {
  text: DraftText;
  claim: ClaimState;
  recordedChecks: readonly RailCheck[];
  rulesFailed: boolean;
}

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
  const read: DraftText = { title: view.title, bodyMd: view.bodyMd, description: view.description };
  const [text, setText] = useState<DraftText>(read);
  const { bodyMd } = text;
  /** The text the store last confirmed. It starts as what was read, and
   *  only a successful save moves it — which is what makes the unsaved
   *  indicator honest. */
  const [savedText, setSavedText] = useState<DraftText>(read);
  /** The re-check the store last reported, starting from what was read. */
  const [checked, setChecked] = useState<Checked>({
    text: read,
    claim: view.claim,
    recordedChecks: view.recordedChecks,
    rulesFailed: view.rulesFailed,
  });
  /** When the store last confirmed a save, and whether the last attempt was
   *  refused. Both are set only from what the store answered — there is no
   *  optimistic arm, and "in flight" is not stored at all: a buffer that
   *  differs from the saved text with no refusal standing **is** a save on
   *  its way, and deriving it is what keeps the line from claiming a call
   *  that never went out. */
  const [savedAt, setSavedAt] = useState<Date | null>(view.lastSavedAt);
  const [refused, setRefused] = useState(false);

  const unsaved = !sameText(text, savedText);
  const settled = useDebounced(text, AUTOSAVE_DEBOUNCE_MS);

  const save = useCallback(
    (next: DraftText): void => {
      void draftStore
        .save({ draftId: view.draftId, ...next })
        .then((result) => {
          // Last write wins: what came back is the draft, and nothing is
          // merged into the buffer. A refusal moves nothing at all.
          if (result.ok) {
            setSavedText(next);
            setSavedAt(result.savedAt);
            setChecked({
              text: next,
              claim: result.claim,
              recordedChecks: result.recordedChecks,
              rulesFailed: result.rulesFailed,
            });
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
    if (sameText(settled, savedText)) return;
    save(settled);
  }, [settled, savedText, save]);

  // c6, "or leaves the view": the last buffer is flushed on unmount, past
  // the debounce. Refs, because the cleanup runs once and must see the text
  // as it stood when the customer left, not as it stood when the effect was
  // created — and they are written in an effect rather than during render,
  // which is where a ref may be touched at all.
  const textRef = useRef(text);
  const savedRef = useRef(savedText);
  useEffect(() => {
    textRef.current = text;
    savedRef.current = savedText;
  }, [text, savedText]);
  useEffect(() => {
    return () => {
      if (!sameText(textRef.current, savedRef.current)) save(textRef.current);
    };
  }, [save]);

  // Rule 3: the last outcome stands only while the text is the text it ran
  // against — and the re-check a save reports is that outcome from then on.
  const current = sameText(text, checked.text);
  const claim = current ? checked.claim : claimAfterSave();
  const recordedChecks = current ? checked.recordedChecks : [];
  /** #789: the saved text breaks a page rule and is held until a save passes. */
  const rulesHeld =
    current && checked.rulesFailed ? (
      <p role="alert" className="alert alert-warning text-sm" data-testid="draft-rules-held">
        {copy("draft.edit.rules-held")}
      </p>
    ) : null;
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
  /** A keystroke in any field is a new attempt: the refusal standing against
   *  the *previous* text is no longer what the store said about this one,
   *  and leaving it up would keep "could not save" on screen over a save
   *  that is about to run. */
  const edit = (change: Partial<DraftText>): void => {
    setText((prev) => ({ ...prev, ...change }));
    setRefused(false);
  };
  /** Leaving a field saves at once. Read from this render's own state, not
   *  from the refs: a blur can follow a keystroke inside one tick, before
   *  the effect that updates them has run. */
  const flush = (): void => {
    if (!sameText(text, savedText)) save(text);
  };

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
              <h1 className="card-title break-words text-2xl">{text.title}</h1>
              {saveLine === null ? null : (
                <span className="text-xs opacity-70" data-testid="draft-save-line">
                  {saveLine}
                </span>
              )}
            </div>
            {rulesHeld}
            <fieldset className="fieldset">
              <legend className="fieldset-legend">{copy("draft.edit.title-label")}</legend>
              <input
                type="text"
                className="input w-full"
                value={text.title}
                onChange={(e) => edit({ title: e.target.value })}
                onBlur={flush}
                data-testid="draft-editor-title"
              />
              <legend className="fieldset-legend">{copy("draft.edit.description-label")}</legend>
              <textarea
                className="textarea h-20 w-full"
                value={text.description}
                onChange={(e) => edit({ description: e.target.value })}
                onBlur={flush}
                data-testid="draft-editor-description"
              />
            </fieldset>
            <div className="divider my-0" />
            <Editor
              bodyMd={bodyMd}
              onChange={(next) => edit({ bodyMd: next })}
              onFlush={flush}
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
            onClick={() => setText(savedText)}
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
                <h1 className="card-title break-words text-2xl">{text.title}</h1>
                <p className="text-xs opacity-70" data-testid="draft-written">
                  {written}
                </p>
              </div>
              <div className="divider my-0" />
              {rulesHeld}
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

          {/* What this page is optimising for (issue 867) — the search, its
              demand and difficulty against this site's own ceiling, the band
              and where the AI engines stood. */}
          <TargetBlock target={view.target} />

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
          recordedChecks={recordedChecks}
          onEdit={() => setEditing(true)}
          onCommand={(command) => run(command, view.draftId)}
        />
      </div>
    </div>
  );
}
