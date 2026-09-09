// BUILD §4.6, UI-SPEC S16 and S17 — the draft view's one client component.
//
// "(full page render, grounded-fact highlight with its source line,
// claim-check badge, Approve/Edit/Veto, and the 'what happens if you do
// nothing' info box). Back link returns to the calendar."
//
// One component owns the four things that change on this screen — which
// arm is on display (S16's read or S17's edit), what the buffer holds,
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
import { Badge } from "@/ui/components/Badge";
import { Btn } from "@/ui/components/Btn";
import { PanelLayout } from "@/ui/components/custom";
import { CardHead, IdiomCard } from "@/ui/idiom";
import { formatCount, formatDate, formatDateTime, formatTime } from "../../_shell/format";
import { writtenLine } from "../../_shell/written";
import { publishing } from "../../calendar/publishing";
import { STAGE_FILTER_COPY_KEY, STAGE_OF, STAGE_TONE } from "../../calendar/stages";
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
  const grounded = factPresentIn(bodyMd, view.grounded.fact);
  // Whether generation recorded a grounding at all: three facts, and the
  // section below is drawn only where at least one of them exists (#268).
  const hasGrounding =
    view.grounded.fact !== "" || view.grounded.url !== "" || view.grounded.readAt !== null;

  const editedNote = view.authorship.edited
    ? writtenLine("draft.authorship.edited", {
        at: formatDate(view.authorship.firstEditedAt, view.timeZone),
      })
    : null;
  const matchedLine =
    claim.state === "failed" ? writtenLine("draft.claim.matched", { entry: claim.matchedEntry }) : null;

  /** §4.6's stage, spoken through the calendar's own projection so the two
   *  surfaces cannot call one state by two names. `null` for a state that
   *  occupies no date at all, which draws no chip rather than an unnamed
   *  one. */
  const stage = STAGE_OF[view.state];

  /** The claim badge, in every one of its four states — including the empty
   *  do-not-claim list, which states that there was nothing to check
   *  against and is never a silent pass (c3). The state is on the element
   *  as well as in the word, because two of the four words are the owner's
   *  and are not written yet: a test that could only read the rendered text
   *  could not tell two unwritten badges apart, and neither could a
   *  screenshot. */
  const claimBadge = (
    <span data-testid={`draft-claim-${claim.state}`}>
      <Badge tone={CLAIM_TONE[claim.state]}>{copy(CLAIM_COPY_KEY[claim.state])}</Badge>
    </span>
  );

  const stageBadge =
    stage === null ? null : (
      <span data-testid={`draft-stage-${stage}`}>
        <Badge tone={STAGE_TONE[stage]}>{copy(STAGE_FILTER_COPY_KEY[stage])}</Badge>
      </span>
    );

  /** Criterion 2's source line: the address the fact was read from and the
   *  date it was read. Both are values (§2.3), so they render in mono and
   *  need no sentence to be readable — and **no part of it is drawn
   *  without its fact** (issue #268): a draft generation recorded no
   *  grounding for has no address to print and no day to state. */
  const sourceLine =
    view.grounded.url === "" && view.grounded.readAt === null ? null : (
      <p className="rk-prov rk-doc-source flex flex-wrap gap-2" data-testid="draft-grounded">
        {view.grounded.url === "" ? null : (
          <a href={view.grounded.url} className="num" data-testid="draft-grounded-url">
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
      markFact={grounded ? view.grounded.fact : null}
      source={sourceLine ?? undefined}
      data-testid="draft-body"
    />
  );

  /** The fact, printed as prose, for the one case the marked passage cannot
   *  carry it: an edit removed it from the body. A grounding the edit
   *  removed is never invisible (c8), and the source line follows it here
   *  rather than in the document, because there is no longer a paragraph in
   *  the document it belongs under. */
  const droppedGrounding =
    hasGrounding && !grounded ? (
      <section className="flex flex-col gap-1" data-testid="draft-grounded-dropped">
        <p className="eyebrow rk-daypanel-eyebrow">{copy("draft.grounded.title")}</p>
        <p className="min-w-0 break-words" data-testid="draft-grounded-fact">
          {view.grounded.fact}
        </p>
        {sourceLine}
      </section>
    ) : null;

  // ── S17, the edit arm ───────────────────────────────────────────────
  if (editing) {
    const stateBadge = refused ? (
      <span data-testid="draft-edit-state-unsaved">
        <Badge tone="bad">{copy("draft.edit.state.unsaved")}</Badge>
      </span>
    ) : unsaved ? (
      <span data-testid="draft-edit-state-edited">
        <Badge tone="neutral">{copy("draft.edit.state.edited")}</Badge>
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
            <Btn
              label={copy("draft.edit.back")}
              variant="tertiary"
              size="sm"
              pill
              onClick={() => setEditing(false)}
            />
          </nav>
          <span className="flex flex-wrap items-center gap-2" data-testid="draft-claim">
            {stageBadge}
            {stateBadge}
          </span>
        </div>

        <IdiomCard
          pad="lg"
          testId="draft-edit-card"
          head={
            <div className="rk-head">
              <h1 className="rk-edit-title">{view.title}</h1>
              {saveLine === null ? null : (
                <span className="rk-prov" data-testid="draft-save-line">
                  {saveLine}
                </span>
              )}
            </div>
          }
        >
          <hr className="rk-daypanel-rule" />
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
            markFact={grounded ? view.grounded.fact : null}
            pane={pane}
            onPane={setPane}
          />
          <p className="explain" data-testid="draft-edit-footnote">
            {copy("draft.edit.footnote")}
          </p>
        </IdiomCard>

        <div className="flex flex-wrap gap-2">
          <span data-testid="draft-edit-done">
            <Btn
              label={copy("draft.edit.done")}
              variant="primary"
              size="sm"
              pill
              onClick={() => setEditing(false)}
            />
          </span>
          <span data-testid="draft-edit-discard">
            <Btn
              label={copy("draft.edit.discard")}
              variant="tertiary"
              size="sm"
              pill
              // Back to the text the store last confirmed — never to
              // something the store never saw, and never to a text the
              // customer has not been shown.
              onClick={() => setBodyMd(savedBody)}
            />
          </span>
        </div>
      </div>
    );
  }

  // ── S16, the read arm ───────────────────────────────────────────────
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
        <Btn href="/app/calendar" label={copy("draft.back")} variant="tertiary" size="sm" pill />
      </nav>

      <PanelLayout
        main={
          <div className="flex min-w-0 flex-col gap-5">
            <IdiomCard
              pad="lg"
              testId="draft-card"
              head={
                <div className="rk-head">
                  <span className="rk-head-l flex-wrap gap-2" data-testid="draft-claim">
                    {stageBadge}
                    {claimBadge}
                    {claim.state === "failed" ? (
                      // c11: the customer is told which entry held the
                      // draft. The entry is their own recorded text and
                      // renders as a value, so it is named whether or not
                      // the sentence beside it is written yet.
                      <span className="num" data-testid="draft-claim-entry">
                        {claim.matchedEntry}
                      </span>
                    ) : null}
                    {matchedLine === null ? null : <span>{matchedLine}</span>}
                  </span>
                  {/* REQ-093 c2's label, on the chip S16 draws for it. */}
                  <span className="rk-gen" data-testid="draft-generated-label">
                    {p.generatedLabel}
                  </span>
                </div>
              }
            >
              <div className="flex min-w-0 flex-col gap-2">
                <h1>{view.title}</h1>
                <p className="rk-prov" data-testid="draft-written">
                  {written}
                </p>
              </div>
              <hr className="rk-daypanel-rule" />
              {body}
              {droppedGrounding}
              {/* Where the customer has edited, the note that keeps the
                  generated-content label from speaking for their words. */}
              {editedNote === null ? null : (
                <p className="rk-prov" data-testid="draft-edited-note">
                  {editedNote}
                </p>
              )}
              {/* c7: the change is unsaved and the customer is told so, in
                  the view, while their words stay in the buffer. */}
              {unsaved ? (
                <p className="rk-prov" data-testid="draft-unsaved">
                  {copy("draft.unsaved")}
                </p>
              ) : null}
            </IdiomCard>

            {/* What became of this page (issue #217) — the page's own
                standing, under the page and outside the card the page is
                in, and absent rather than empty for a draft whose record
                could not be read. */}
            {view.record === null ? null : (
              <PageRecordBlock record={view.record} timeZone={view.timeZone} />
            )}

            {/* §9: "always shown" — for a draft and for a published page
                alike (c12). */}
            <IdiomCard
              testId="draft-copy-card"
              head={
                <CardHead
                  eyebrow={copy("draft.copy.title")}
                  pill={<span className="rk-srcchip">{copy("draft.copy.note")}</span>}
                />
              }
            >
              <CopyOut bodyMd={bodyMd} />
            </IdiomCard>
          </div>
        }
        panel={
          <DecidePanel
            view={view}
            grounded={grounded}
            claim={claim}
            onEdit={() => setEditing(true)}
            onCommand={(command) => run(command, view.draftId)}
          />
        }
      />
    </div>
  );
}
