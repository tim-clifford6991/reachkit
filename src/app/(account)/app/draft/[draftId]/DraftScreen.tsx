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
//  1. **The body is never truncated** (c1). `PublishedPageView` places the
//     whole of it; there is no budget, no "show more", no clamped height.
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
import { useCallback, useEffect, useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import { AUTOSAVE_DEBOUNCE_MS, TIMING } from "@/lib/config/constants";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { copy } from "@/lib/presentation/copy";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import {
  formatCount,
  formatDate,
  formatDateTime,
  formatTime,
} from "../../_shell/format";
import { writtenLine } from "../../_shell/written";
import { COMMAND_TARGET, publishing } from "../../calendar/publishing";
import {
  STAGE_FILTER_COPY_KEY,
  STAGE_BEACON,
  STAGE_OF,
  STAGE_TONE,
  TONE_BADGE,
} from "../../calendar/stages";
import { say } from "../../../../_toast/say";
import { CLAIM_COPY_KEY, CLAIM_TONE, claimAfterSave } from "./claim";
import { DecidePanel } from "./DecidePanel";
import type { DraftCommand } from "./actions";
import { draftStore, type SaveBody } from "./save";
import { Editor, type EditorPane, type PreviewFrame } from "./Editor";
import { liveBreaks, type MarkInputs } from "./marks";
import { Check } from "lucide-react";
import { PageRecordBlock } from "./PageRecordBlock";
import { TargetBlock } from "./TargetBlock";
import { factPresentIn } from "./grounded";
import { PublishedPageView } from "./PublishedPageView";
import { WhatAddsCard, WhatPublishesCard, WrittenFromCard } from "./ReviewCards";
import { publishedCounts } from "./publishes";
import { useDebounced } from "./useDebounced";
import { NEEDS_YOU_COPY } from "@/lib/publish/record/lines";
import { PACK_NEED_COPY, wordCount, type ClaimState, type DraftView } from "./model";
import type { RailCheck } from "./checks";

/** The three fields the founder edits (#789), as one value: the buffer, the
 *  text the store last confirmed, and the text the last check ran on are
 *  each one of these. */
type DraftText = Omit<SaveBody, "draftId">;

function sameText(a: DraftText, b: DraftText): boolean {
  return (
    a.title === b.title &&
    a.bodyMd === b.bodyMd &&
    a.description === b.description
  );
}

/** What the last check found, and the text it found it on. */
interface Checked {
  text: DraftText;
  claim: ClaimState;
  recordedChecks: readonly RailCheck[];
  rulesFailed: boolean;
}

const EYEBROW = "eyebrow";

/** Between the meta line's two halves: the written line and the label. */
const META_SEPARATOR = " · ";

/** The two edited fields' ids. Constants rather than `useId`: there is one
 *  editor on this screen, and a stable id is what a `htmlFor` needs to be
 *  readable in a test and in a page source. */
const TITLE_FIELD_ID = "draft-edit-title";
const DESCRIPTION_FIELD_ID = "draft-edit-description";

/** The editor's two field labels, in the one key/value label style the page
 *  arm sets (#1072): sentence case, `text-sm`, the
 *  quiet ink. daisyUI's `fieldset-legend` stays for its row layout (the
 *  count sits at the row's end); its weight is the one thing overridden. */
const KEY_LABEL = "fieldset-legend text-sm font-normal text-base-content/70";

/** The writes this screen can ask for. All are §9 edges and go to the
 *  state machine through the seam. */
function ask(
  command: DraftCommand,
  draftId: string,
): ReturnType<typeof publishing.veto> {
  return publishing[command]({ draftId });
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
  /** SPEC §7's desktop/phone switch. The frame the preview is drawn in,
   *  and nothing else: the page inside it is the same three calls either
   *  way. */
  const [frame, setFrame] = useState<PreviewFrame>("desktop");
  const read: DraftText = {
    title: view.title,
    bodyMd: view.bodyMd,
    description: view.description,
  };
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
  /** SPEC §7 (2026-09-20, #908, issue #913) — the page's §9 state as this
   *  render believes it. On Approve or Stop it is the state the write asks
   *  for, so the stage chip and the rail's controls both change on the
   *  press; when the transition ends React drops it for whatever the
   *  server now reports, which after a refusal is the state the page never
   *  left. One value, because the chip and the controls are both
   *  projections of it and must not disagree. */
  const [state, expect] = useOptimistic(view.state);
  const [deciding, startDeciding] = useTransition();
  /** Which command the pending press is, so only its button spins (issue
   *  1196). The pending state itself is the transition's. */
  const [pressed, setPressed] = useState<DraftCommand | null>(null);

  /** What each decision says once the machine has answered. */
  function decisionLine(command: DraftCommand): string {
    if (command === "veto") return copy("draft.answer.veto");
    if (command === "skip") return copy("calendar.answer.skip");
    return copy("calendar.answer.regenerate");
  }

  /** One press: show the state the command asks for, ask for it, and say
   *  what came back. Neither arm is silent. */
  function decide(command: DraftCommand): void {
    setPressed(command);
    startDeciding(async () => {
      expect(COMMAND_TARGET[command]);
      const outcome = await ask(command, view.draftId);
      say(
        outcome.ok ? decisionLine(command) : copy("draft.answer.refused"),
        outcome.ok ? "ok" : "bad",
      );
    });
  }

  const unsaved = !sameText(text, savedText);
  const settled = useDebounced(text, AUTOSAVE_DEBOUNCE_MS);

  /** Set when *Done editing* is pressed with a save still on its way: the
   *  save that lands, or is refused, answers for the press (#1095). */
  const answerSaveRef = useRef(false);

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
            if (result.entered) {
              // #1180: the fix passed every rule and the page is in review
              // now. The save revalidated this route, so the stage and the
              // window arrive from the server.
              answerSaveRef.current = false;
              say(copy("draft.edit.entered-review"), "ok");
              return;
            }
            if (answerSaveRef.current) {
              answerSaveRef.current = false;
              say(copy("draft.edit.saved", { at: formatTime(result.savedAt, view.timeZone) }), "ok");
            }
            return;
          }
          setRefused(true);
          answerRefusal();
        })
        .catch(() => {
          setRefused(true);
          answerRefusal();
        });
      function answerRefusal(): void {
        if (!answerSaveRef.current) return;
        answerSaveRef.current = false;
        say(copy("draft.unsaved"), "bad");
      }
    },
    [view.draftId, view.timeZone],
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
  /** Issue 1252: the page was not written because its context pack was
   *  short. The cause's own sentence — the one the Plan and Overview state
   *  for this page — and, under it, what was missing. Gone once the page
   *  leaves `needs_attention`. */
  const packShort =
    view.packShort === undefined || state !== "needs_attention" ? null : (
      <div role="alert" className="alert alert-warning alert-vertical justify-items-start text-start text-sm" data-testid="draft-pack-short">
        <p className="min-w-0 wrap-anywhere">{copy(NEEDS_YOU_COPY.pack)}</p>
        {view.packShort.missing.length === 0 ? null : (
          <ul className="min-w-0 list-disc ps-5" data-testid="draft-pack-missing">
            {view.packShort.missing.map((need) => (
              <li className="min-w-0 wrap-anywhere" key={need}>
                {copy(PACK_NEED_COPY[need])}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  /** #789: the saved text breaks a page rule and is held until a save passes. */
  const rulesHeld =
    current && checked.rulesFailed ? (
      <p
        role="alert"
        className="alert alert-warning text-sm"
        data-testid="draft-rules-held"
      >
        {copy("draft.edit.rules-held")}
      </p>
    ) : null;
  // Rule 2: the highlight is a function of the buffer, never of a stored flag.
  const grounded = factPresentIn(bodyMd, view.grounded.passage);

  /**
   * What the editor's live rule pass reads (issue 932).
   *
   * The title travels with it because the frame rule reads a title, and the
   * founder edits one here: a page renamed after its business is a break
   * the moment it is typed, not the moment it is saved. The brief's
   * passages are the ones this screen already holds, as generation
   * recorded them.
   */
  const markInputs = useMemo<MarkInputs>(
    () => ({
      title: text.title,
      // The domain's own tokens, never a measured brand: `marks.ts` says
      // why this screen does not read a report to sharpen them.
      businessName: null,
      domain: view.domain,
      doNotClaim: view.ruleFacts.doNotClaim,
      rivals: view.ruleFacts.rivals,
      pageType: view.ruleFacts.pageType,
      brief: {
        // The brief's passages, off the record #931 already reads for
        // *Written from your business* — one `drafts.meta` key, read once.
        facts: view.writtenFrom.facts.map((fact) => fact.passage),
        queries: view.ruleFacts.queries,
        ...(view.writtenFrom.marketFacts === undefined ? {} : { marketFacts: view.writtenFrom.marketFacts }),
      },
    }),
    [text.title, view.domain, view.ruleFacts, view.writtenFrom]
  );

  /**
   * What the rules say about the buffer **as it now stands** (issue 932).
   *
   * `marks.ts` runs thirteen of the seventeen in this process, so the answer
   * is a render old rather than a save old. It is the editor's banner and
   * nothing else: it does not decide whether the page publishes — the
   * saved battery does that, and `rulesHeld` above is still the sentence
   * that speaks for it. A live break says *this text* is held; a recorded
   * one says *the saved text* is.
   */
  const breaks = useMemo(() => liveBreaks(bodyMd, markInputs), [bodyMd, markInputs]);

  /**
   * §7's banner, in the editor: one box, and it means *held*.
   *
   * **Either source holds the page.** A live break is one of the thirteen
   * `marks.ts` can decide as the founder types; a recorded one is the save
   * reporting a rule the editor cannot run (`grounding`, `near_duplicate`). Both are the same fact about the same page, so
   * they draw the same sentence under the same name — #789's
   * `draft.edit.rules-held`, unchanged, because what it says is still
   * exactly true.
   *
   * The green arm is only ever reached when **neither** has anything: a
   * page with one break and twelve passes is held, and "all your rules
   * hold" beside an underlined sentence would be the card contradicting
   * itself.
   */
  const rulesLive =
    breaks.length > 0 || (current && checked.rulesFailed) ? (
      <p role="alert" className="alert alert-warning text-sm" data-testid="draft-rules-held">
        {copy("draft.edit.rules-held")}
      </p>
    ) : (
      // Nothing broken is a zero state, so it is quiet (DESIGN.md, the calm
      // layer, #1095): a flat grey ground, a tick and the one line — not a
      // green alert for a page with nothing to report.
      <p
        className="rounded-box bg-base-200 flex items-start gap-2 px-4 py-3 text-sm"
        data-testid="draft-rules-ok"
      >
        <Check size={16} strokeWidth={1.75} className="text-success mt-0.5 shrink-0" aria-hidden />
        <span className="min-w-0">{copy("draft.editor.rules-ok")}</span>
      </p>
    );
  // Whether generation recorded a grounding at all: three facts, and the
  // section below is drawn only where at least one of them exists (#268).
  const hasGrounding =
    view.grounded.passage !== "" ||
    view.grounded.url !== "" ||
    view.grounded.readAt !== null;

  const editedNote = view.authorship.edited
    ? writtenLine("draft.authorship.edited", {
        at: formatDate(view.authorship.firstEditedAt, view.timeZone),
      })
    : null;
  const matchedLine =
    claim.state === "failed"
      ? writtenLine("draft.claim.matched", { entry: claim.matchedEntry })
      : null;

  /** The stage, spoken through the calendar's own projection so the two
   *  surfaces cannot call one state by two names. `null` for a state that
   *  occupies no date at all, which draws no chip rather than an unnamed
   *  one — and is what a stopped page reads as the moment Stop is pressed. */
  const stage = STAGE_OF[state];

  /** The claim badge, in every one of its four states — including the empty
   *  do-not-claim list, which states that there was nothing to check
   *  against and is never a silent pass (c3). The state is on the element
   *  as well as in the word, because two of the four words are the owner's
   *  and are not written yet. */
  const claimBadge = (
    <span
      className={`badge badge-soft ${TONE_BADGE[CLAIM_TONE[claim.state]]}`}
      data-testid={`draft-claim-${claim.state}`}
    >
      {/* *Checking claims* carries the loader glyph (board `R12-6-Page`),
          held still: the calm layer's one loop is the review dot. */}
      {claim.state === "outstanding" ? (
        <LoaderCircle size={12} strokeWidth={2.5} aria-hidden />
      ) : null}
      {copy(CLAIM_COPY_KEY[claim.state])}
    </span>
  );

  /** The stage badge, with the stage's dot — which pulses on *Your review*
   *  and *Live*, the calm layer's one loop (`STAGE_BEACON`). */
  const stageBadge =
    stage === null ? null : (
      <span
        className={`badge badge-soft ${TONE_BADGE[STAGE_TONE[stage]]}`}
        data-testid={`draft-stage-${stage}`}
      >
        <span
          className={`size-1.5 shrink-0 rounded-full bg-current ${STAGE_BEACON[stage]}`}
          aria-hidden
        />
        {copy(STAGE_FILTER_COPY_KEY[stage])}
      </span>
    );

  /** Criterion 2's source line: the address the fact was read from and the
   *  date it was read. Both are values, so they render in mono and need no
   *  sentence to be readable — and **no part of it is drawn without its
   *  fact** (issue #268).
   *
   *  The address sits in a **declared scroll box** rather than under
   *  `truncate`: the line is inside the page frame now (#931), and a value
   *  cut in half is a different value (`src/ui/type.css`, ADR-093 — the box
   *  changes, never the value). */
  const sourceLine =
    view.grounded.url === "" && view.grounded.readAt === null ? null : (
      <p
        className="my-2 flex flex-wrap gap-2 text-xs opacity-70"
        data-testid="draft-grounded"
      >
        {view.grounded.url === "" ? null : (
          <span className="min-w-0 max-w-full overflow-x-auto">
            <a
              href={view.grounded.url}
              className="link num"
              data-testid="draft-grounded-url"
            >
              {view.grounded.url}
            </a>
          </span>
        )}
        {view.grounded.readAt === null ? null : (
          <span className="num" data-testid="draft-grounded-read-at">
            {formatDate(view.grounded.readAt, view.timeZone)}
          </span>
        )}
      </p>
    );

  /**
   * The page as it publishes (#931).
   *
   * **The same HTML the hosted route serves**, in the customer's own frame —
   * `PublishedPageView` says how, and why there is no second renderer. It
   * replaces the dense in-card rendering this arm used to draw: a reviewer
   * approving a page is owed the page, not a transcription of it.
   *
   * `RenderedBody` is still the editor's: its preview sits inside a card
   * among other cards, where a `prose` measure would fight the card.
   */
  const body = (
    <PublishedPageView
      title={view.title}
      bodyMd={bodyMd}
      grounded={view.grounded}
      publisher={view.publisher}
      // Criterion 2's line, inside the article where the hosted route puts
      // it. What is *ours* — the generated-content label — stays in the card
      // head above the frame, because nothing of ours belongs on a page
      // about to stand on their domain.
      source={sourceLine}
    />
  );

  /** The fact, printed as prose, for the one case the marked passage cannot
   *  carry it: an edit removed it from the body. A grounding the edit
   *  removed is never invisible (c8). */
  const droppedGrounding =
    hasGrounding && !grounded ? (
      <section
        className="flex flex-col gap-1"
        data-testid="draft-grounded-dropped"
      >
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
  /**
   * *Done editing* answers (SPEC §4, "every action answers"; #1095): the
   * save confirmation is the product's one toast, never an animation of
   * its own. A save still on its way answers when it lands; a refused one
   * says so at once; a session with nothing saved in it says nothing,
   * because nothing was done.
   */
  const leaveEditor = (): void => {
    setEditing(false);
    if (refused) {
      say(copy("draft.unsaved"), "bad");
      return;
    }
    if (unsaved) {
      answerSaveRef.current = true;
      return;
    }
    if (savedAt !== null && savedAt !== view.lastSavedAt) {
      say(copy("draft.edit.saved", { at: formatTime(savedAt, view.timeZone) }), "ok");
    }
  };

  /**
   * SPEC §7's search result, as a reader meets one (issue 932).
   *
   * The address, the title and the description, in a result's own order,
   * drawn off the **buffer** so it moves as the founder types — which is
   * the only reading of "title and search-result description" that makes
   * the pane worth having. It is a rendering of their text and never a
   * verdict on it: no length score, no "too long", because nothing in §8
   * bounds either field and a bar that said otherwise would be this screen
   * inventing a rule.
   *
   * The address is the domain and stops there. A page in review has no
   * path — the destination decides the slug at publication — and a guessed
   * one under the word *address* would be the one invented fact on a pane
   * whose job is to show what publishes.
   */
  const searchResult = (
    <section className="card card-border bg-base-100 min-w-0" data-testid="draft-search-result">
      <div className="card-body min-w-0 gap-1">
        <h2 className={EYEBROW}>{copy("draft.editor.tab.search")}</h2>
        {/* A domain is a value: mono, and never rewritten to fit — the box
            scrolls instead (`src/ui/type.css`, ADR-093). */}
        <span className="num min-w-0 max-w-full overflow-x-auto text-xs opacity-70" tabIndex={0}>
          {view.domain}
        </span>
        <p className="text-primary min-w-0 text-lg wrap-anywhere" data-testid="draft-search-title">
          {text.title}
        </p>
        <p className="min-w-0 text-sm opacity-70 wrap-anywhere" data-testid="draft-search-description">
          {text.description}
        </p>
      </div>
    </section>
  );

  if (editing) {
    const stateBadge = refused ? (
      <span
        className="badge badge-error"
        data-testid="draft-edit-state-unsaved"
      >
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
          : copy("draft.edit.saved", {
              at: formatTime(savedAt, view.timeZone),
            });

    return (
      <div className="flex min-w-0 flex-col gap-4" data-testid="draft-view">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav data-testid="draft-edit-back">
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => setEditing(false)}
            >
              <ArrowLeft size={16} strokeWidth={1.75} aria-hidden />
              {copy("draft.edit.back")}
            </button>
          </nav>
          <span
            className="flex flex-wrap items-center gap-2"
            data-testid="draft-claim"
          >
            {stageBadge}
            {stateBadge}
          </span>
        </div>

        <section
          className="card card-border bg-base-100 min-w-0"
          data-testid="draft-edit-card"
        >
          <div className="card-body min-w-0 gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h1 className="card-title break-words text-2xl">{text.title}</h1>
              {saveLine === null ? null : (
                <span
                  className="text-xs text-base-content/70"
                  data-testid="draft-save-line"
                >
                  {saveLine}
                </span>
              )}
            </div>
            {rulesLive}
            {/* **`label`, not `legend`** (issue 932). daisyUI's
                `fieldset-legend` is a `<legend>`: it names the *group*, and
                a `<legend>` is not the accessible name of the control under
                it — axe reports both of these fields `label` (critical),
                which is a merge gate. The class is daisyUI's own and stays;
                the element it sits on is the one that can carry a name. */}
            <fieldset className="fieldset gap-2">
              <label className={KEY_LABEL} htmlFor={TITLE_FIELD_ID}>
                {copy("draft.edit.title-label")}
              </label>
              <input
                id={TITLE_FIELD_ID}
                type="text"
                className="input w-full"
                value={text.title}
                onChange={(e) => edit({ title: e.target.value })}
                onBlur={flush}
                data-testid="draft-editor-title"
              />
              <label className={KEY_LABEL} htmlFor={DESCRIPTION_FIELD_ID}>
                {copy("draft.edit.description-label")}
                {/* SPEC §7's "length count". A count and not a verdict:
                    nothing in §8 bounds a meta description, so a bar that
                    turned red at 160 would be this screen inventing a rule
                    the battery does not run. It is a number, so it is set
                    in the mono face and is never clamped. */}
                <span className="num ms-auto text-xs text-base-content/70" data-testid="draft-description-count">
                  {copy("draft.editor.description-count", {
                    n: formatCount(text.description.length),
                  })}
                </span>
              </label>
              <textarea
                id={DESCRIPTION_FIELD_ID}
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
              frame={frame}
              onFrame={setFrame}
              inputs={markInputs}
              searchResult={searchResult}
            />
            <p className="text-sm text-base-content/70" data-testid="draft-edit-footnote">
              {copy("draft.edit.footnote")}
            </p>
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-sm btn-primary"
            data-testid="draft-edit-done"
            onClick={leaveEditor}
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
    // **Room under the page for the Decide bar** (owner's review of #931).
    // Below `md` the three controls are fixed above the shell's dock
    // (`DecidePanel` says why there), so the last card would sit under them
    // without this. The shell already reserves the dock's own 4rem below
    // `lg` (`app/layout.tsx`: `pb-20`); this is the bar's height on top of
    // it, measured in Chromium at 390 rather than guessed — see the PR body.
    <div
      className="flex min-w-0 flex-col gap-4 max-md:pb-20"
      data-testid="draft-view"
    >
      <nav data-testid="draft-back">
        <Link href="/app/calendar" prefetch={true} className="btn btn-sm btn-ghost">
          <ArrowLeft size={16} strokeWidth={1.75} aria-hidden />
          {copy("draft.back")}
        </Link>
      </nav>

      {state === "generating" ? <Rewriting /> : null}

      {/* Board `R12-6-Page` (SPEC §7, 2026-09-24, #1072): the page and the
          cards under it on the left, the sticky Decide panel on the right
          from `xl`; one column, the panel under the page, below it. */}
      <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="flex min-w-0 flex-col gap-4">
          {/* The header: the status badges and one meta line, then the
              title. The title is drawn twice on purpose — here as the
              screen's heading, and in the frame as the page publishes it. */}
          <header className="flex min-w-0 flex-col gap-2" data-testid="draft-head">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
              <span
                className="flex min-w-0 flex-wrap items-center gap-2"
                data-testid="draft-claim"
              >
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
              </span>
              {/* One meta line: when it was written, how long it is, and
                  REQ-093 c2's label, bound to the text it speaks for. */}
              <p className="min-w-0 text-xs text-base-content/70 sm:ms-auto">
                <span data-testid="draft-written">{written}</span>
                <span aria-hidden>{META_SEPARATOR}</span>
                <span data-testid="draft-generated-label">{p.generatedLabel}</span>
              </p>
            </div>
            {matchedLine === null ? null : <p className="text-sm">{matchedLine}</p>}
            <h1 className="min-w-0 wrap-anywhere" data-testid="draft-title">
              {view.title}
            </h1>
          </header>

          {packShort}
          {rulesHeld}
          {body}
          {droppedGrounding}
          {/* Where the customer has edited, the note that keeps the
              generated-content label from speaking for their words. */}
          {editedNote === null ? null : (
            <p className="text-xs text-base-content/70" data-testid="draft-edited-note">
              {editedNote}
            </p>
          )}
          {/* c7: the change is unsaved and the customer is told so, in the
              view, while their words stay in the buffer. */}
          {unsaved ? (
            <p className="text-xs text-base-content/70" data-testid="draft-unsaved">
              {copy("draft.unsaved")}
            </p>
          ) : null}

          {/* What this page is for (issue 867) and how it reads in search
              results, sharing one card (board `R12-6-Page`). */}
          <TargetBlock
            target={view.target}
            title={view.title}
            description={view.description}
            publisher={view.publisher}
          />

          {/* SPEC §7's other two cards (#931): what the page stands on and
              where each sentence was read, and what actually leaves the
              building. The checks are `DecidePanel`'s. */}
          <WrittenFromCard writtenFrom={view.writtenFrom} timeZone={view.timeZone} />
          {/* What the page says that the web and the site do not (SPEC §7,
              D12, issue 1143). */}
          <WhatAddsCard adds={view.adds} />
          <WhatPublishesCard
            publisher={view.publisher}
            title={view.title}
            description={view.description}
            counts={publishedCounts(bodyMd)}
          />

          {/* What became of this page (issue #217) — absent rather than empty
              for a draft whose record could not be read. */}
          {view.record === null ? null : (
            <PageRecordBlock record={view.record} timeZone={view.timeZone} />
          )}
        </div>

        <DecidePanel
          view={view}
          state={state}
          deciding={deciding}
          pressed={deciding ? pressed : null}
          grounded={grounded}
          claim={claim}
          recordedChecks={recordedChecks}
          bodyMd={bodyMd}
          onEdit={() => setEditing(true)}
          onCommand={decide}
        />
      </div>
    </div>
  );
}

/**
 * Issue 1196: a page being written again is rewritten by the draft tick,
 * not by the press. While it is, the screen says so and re-reads itself at
 * the heartbeat, so the new draft appears when it lands rather than on the
 * next navigation. Mounted only in that state, so no other state of the
 * screen holds a router or a timer.
 */
function Rewriting(): React.JSX.Element {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), TIMING.progressHeartbeatS * 1000);
    return () => clearInterval(timer);
  }, [router]);
  return (
    <div role="status" aria-live="polite" className="alert text-sm" data-testid="draft-rewriting">
      <LoaderCircle size={20} strokeWidth={1.75} aria-hidden />
      <span className="min-w-0 wrap-anywhere">{copy("draft.rewriting")}</span>
    </div>
  );
}
