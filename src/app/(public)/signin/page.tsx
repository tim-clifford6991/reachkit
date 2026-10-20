// src/app/(public)/signin/page.tsx — SPEC §3, `Canvas: Sign in`.
//
// One screen with three arms — the request form, the answered arm, the
// dead-link arm — drawn as the Round 7 boards draw them (`R7-S1`…`S3`,
// #1025): a full-width split between the public header and footer, the
// interaction on the left and the accent panel filling the right half top
// to bottom. No password field, no social sign-in, no account control.
"use client";

import Link from "next/link";
import { Send } from "lucide-react";
import { use, useActionState, useState } from "react";
import { Surface } from "@/ui/layout";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { DEAD_LINK_MARKER, LINK_QUERY_KEY } from "@/lib/account/identity/addresses";
import { sendLink } from "./actions";
import { EMAIL_FIELD, SIGN_IN_INITIAL, type SignInState } from "./state";
import { SPECIMEN_SIGNIN } from "../_landing/specimen";

/** The autofill token and the keyboard the field asks for. */
const EMAIL_HINT = "email";

/** The layout, named once: two halves edge to edge, no border and no
 *  radius (#1025 — #986 drew them as one rounded card at the wide measure,
 *  which the owner rejected). The surface declares its own edges, so the
 *  split runs to the viewport and grows to meet the footer; the grid's
 *  one row stretches both halves to the same height. */
const SPLIT = "grid grid-cols-1 lg:grid-cols-2";
const HALF = "flex items-center justify-center px-4 py-12 sm:px-8 lg:px-18 lg:py-16";
/**
 * The accent half: an accent **tint**, with the screen's own ink on it.
 *
 * `--primary-content` on a saturated ground is under the contrast floor
 * (#937), so the half is a light tint carrying ordinary ink, with the
 * app's own white tile on top of it — a ground its text passes against by
 * construction. No opacity is spent on any sentence here.
 */
const PANEL = `${HALF} bg-primary/10`;
/** The interaction half: the white of the board, not the page ground. */
const FORM_HALF = `${HALF} bg-base-100`;
const COLUMN = "flex w-full max-w-100 flex-col gap-5";
const PANEL_COLUMN = "flex w-full max-w-lg flex-col gap-5";
const HEAD_GROUP = "flex flex-col gap-2";
const QUIET = "text-base-content/70";
/** The answered arm's mark: a success-tinted square, as `R7-S2` draws it. */
const CHIP_OK = "grid size-12 flex-none place-items-center rounded-box bg-success/10 text-success";
/** The tile on the tint: the app's own card, not a glass panel. */
const TILE = "card bg-base-100 flex flex-col gap-3 p-6 shadow-(--shadow-card)";

/** The specimen the accent half shows: the reserved domain and the figures
 *  the approved set draws on it (ruling 5c), read from `_landing/specimen.ts`
 *  — the product's one home for a drawn figure that measures nothing. */
const {
  domain: SPECIMEN_DOMAIN,
  score: SPECIMEN_SCORE,
  max: SPECIMEN_MAX,
  answers: SPECIMEN_ANSWERS,
} = SPECIMEN_SIGNIN;

/** One dot of the tile's grid, by what the answer did. A named rival is
 *  daisyUI's quiet `status`; the reader's own is the primary one; an answer
 *  that names nobody here is an empty ring. */
const DOT = {
  named: "status status-lg",
  you: "status status-lg status-primary",
  unnamed: "inline-block size-3 rounded-full border-2 border-primary/30",
} as const satisfies Record<(typeof SPECIMEN_ANSWERS)[number], string>;

type SignInSearchParams = Partial<Record<typeof LINK_QUERY_KEY, string>>;

/** The one written line each answer reaches for. `none` is before any
 *  submission, when the screen answers nothing at all. */
const ANSWER_COPY_KEY = {
  none: undefined,
  invalid: "signin.address.invalid",
  requested: "signin.link_requested",
} as const satisfies Record<SignInState["answer"], CopyKey | undefined>;

/** This screen's own address, for the two controls that lead back to its
 *  form: a link to `/signin` with no query clears the dead-link marker, and
 *  it is the same value `src/middleware.ts` redirects to. */
const SIGN_IN_PATH = "/signin";

function isPromise<T>(value: Promise<T> | T | undefined): value is Promise<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

/** Accepts a real `searchParams` Promise (production) or an already-plain
 *  object (this file's own tests), on the terms `src/app/(public)/page.tsx`
 *  established: it calls `use()` conditionally on the caller's own shape. */
function useSignInSearchParams(
  searchParams: Promise<SignInSearchParams> | SignInSearchParams | undefined
): SignInSearchParams {
  if (isPromise(searchParams)) return use(searchParams);
  return searchParams ?? {};
}

export default function SignInPage(props: {
  searchParams?: Promise<SignInSearchParams> | SignInSearchParams;
}): React.JSX.Element {
  const params = useSignInSearchParams(props.searchParams);
  const [state, formAction, pending] = useActionState(sendLink, SIGN_IN_INITIAL);
  const [typed, setTyped] = useState<string | undefined>(undefined);

  // What is in the field wins while they are typing, and what the action
  // carried back stands in for it on the pass where there is no client
  // runtime to have typed into.
  const value = typed ?? state.value;

  const deadLink = params[LINK_QUERY_KEY] === DEAD_LINK_MARKER;
  // **The dead-link arm's field starts empty.** A reader who followed a
  // link that no longer works has typed nothing, so there is nothing of
  // theirs to carry forward — and `state.value` on that pass is whatever
  // the last action happened to hold, which is an address this screen
  // would then be echoing at a reader who never entered it. REQ-098 c7's
  // line is the same whatever the reason; so is its field. What they type
  // here is kept, because that is theirs.
  const fieldValue = deadLink ? (typed ?? "") : value;
  const answerKey = ANSWER_COPY_KEY[state.answer];
  const answer = answerKey === undefined ? undefined : copy(answerKey);
  // Every well-formed address is the answered arm, with the same line —
  // whether or not it has an account (SPEC §3). A refusal of the value
  // itself keeps the form, with what they typed intact.
  const answered = state.answer === "requested";

  /** The one form this screen has, under whichever word the arm drawing it
   *  uses: *Send my sign-in link* on a first visit, *Send a new link* to a
   *  reader whose link is dead. One field, one submit, one action — §3's
   *  "sign-in copy is identical whatever the address" is about the words,
   *  and this is the other half of it: the same door, however you arrived. */
  function askForLink(label: string): React.JSX.Element {
    return (
      // `noValidate`: a malformed address gets the product's own sentence, not the browser's bubble.
      <form action={formAction} className="flex flex-col gap-3" noValidate>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">{copy("signin.field.label")}</span>
          <input
            type="email"
            autoComplete={EMAIL_HINT}
            inputMode={EMAIL_HINT}
            placeholder={copy("signin.field.placeholder")}
            className="input w-full font-mono text-sm"
            name={EMAIL_FIELD}
            value={fieldValue}
            onChange={(e) => setTyped(e.target.value)}
          />
        </label>
        {/* The screen's one solid primary, full width — and the only solid
            button on it. */}
        <button type="submit" className="btn btn-primary btn-block" disabled={pending} aria-busy={pending || undefined}>
          {label}
        </button>
      </form>
    );
  }

  return (
    // The surface declares its own edges: the split is the viewport's width
    // and fills what the header and footer leave (`surface.css`).
    <Surface
      arms={{
        compact: { kind: "declared", note: "full-width split: the form, then the accent panel; two halves from 1024" },
        medium: { kind: "same-as-below" },
        wide: { kind: "same-as-below" },
      }}
    >
      <div className={SPLIT}>
        <main className={FORM_HALF}>
          <div className={COLUMN}>
            {deadLink ? (
              /* The dead-link arm (`R7-S3`). The line is the same whatever
                 the reason, read from a marker that carries none, and the
                 field is right here: one form, under this arm's own word. */
              <>
                <div className={HEAD_GROUP}>
                  <h1>{copy("signin.expired.head")}</h1>
                  <p className={QUIET}>{copy("signin.link_dead")}</p>
                </div>
                {askForLink(copy("signin.expired.submit"))}
              </>
            ) : answered ? (
              /* The answered arm (`R7-S2`). The address is the one they
                 typed, echoed back, never one this screen looked up (§3:
                 the copy is identical whatever the address). */
              <>
                <span className={CHIP_OK} data-tone="ok" data-testid="signin-chip">
                  <Send size={20} strokeWidth={1.75} aria-hidden />
                </span>
                <div className={HEAD_GROUP}>
                  <h1>{copy("signin.sent.head")}</h1>
                  <p role="status" aria-live="polite" className={QUIET}>
                    {answer}
                  </p>
                </div>
                <p className={`font-mono text-sm ${QUIET}`}>{copy("signin.sent.to", { address: value })}</p>
                <p className={`text-sm ${QUIET}`}>{copy("signin.sent.terms")}</p>
                <Link href={SIGN_IN_PATH} className="btn btn-soft btn-primary self-start">
                  {copy("signin.sent.resend")}
                </Link>
              </>
            ) : (
              <>
                <div className={HEAD_GROUP}>
                  <h1>{copy("signin.heading")}</h1>
                  <p className={QUIET}>{copy("signin.body")}</p>
                </div>

                {askForLink(copy("signin.submit.label"))}

                {/* Where the *value* was refused. The answered arm above
                    carries its own line. */}
                {answer === undefined ? null : (
                  <p className={QUIET} aria-live="polite">
                    {answer}
                  </p>
                )}

                <p className={`flex flex-wrap items-center gap-1 text-sm ${QUIET}`}>
                  <span>{copy("signin.new.prompt")}</span>
                  <Link href="/" className="link link-primary font-semibold">
                    {copy("signin.new.link")}
                  </Link>
                </p>
              </>
            )}
          </div>
        </main>

        {/* The accent half, the same on every arm. Every figure in it is the
            reserved domain's own — a declared example, never an invented
            number and never a stranger's real domain (ruling 5c). */}
        <aside className={PANEL} data-testid="signin-panel">
          <div className={PANEL_COLUMN}>
            <h2 className="text-primary">{copy("signin.panel.heading")}</h2>
            <div className={TILE}>
              <p className="eyebrow">{copy("signin.panel.score-label")}</p>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="figure text-5xl">{SPECIMEN_SCORE}</span>
                <span className={`font-mono ${QUIET}`}>{`/ ${SPECIMEN_MAX}`}</span>
                <span className="badge badge-success ms-auto self-center">{copy("signin.panel.delta")}</span>
              </div>
              <progress
                className="progress progress-primary w-full"
                value={SPECIMEN_SCORE}
                max={SPECIMEN_MAX}
                aria-label={copy("signin.panel.score-label")}
              />
              <p className={`text-sm ${QUIET}`}>{copy("signin.panel.line")}</p>
              <div className="divider my-0" />
              {/* The second row (#1025): who AI answers name, four
                  questions by four answers. The grid is a picture the
                  sentence beside it explains, so it is hidden from the
                  accessibility tree and the sentence is read instead. */}
              <div className="flex items-center gap-4">
                <div className="grid flex-none grid-cols-4 gap-2" aria-hidden data-testid="signin-panel-answers">
                  {SPECIMEN_ANSWERS.map((kind, i) => (
                    <span key={i} className={DOT[kind]} data-answer={kind} aria-hidden />
                  ))}
                </div>
                <p className={`text-xs ${QUIET}`}>{copy("signin.panel.answers")}</p>
              </div>
            </div>
            {/* **Captioned as an example** (#937): a stranger looking at a
                score on a sign-in screen should not have to wonder whose
                site it measured. The domain is the sentence's own slot,
                filled from the same fixture the figures come from. */}
            <p className="text-primary text-sm" data-testid="signin-panel-example">
              {copy("signin.panel.example", { domain: SPECIMEN_DOMAIN })}
            </p>
          </div>
        </aside>
      </div>
    </Surface>
  );
}
