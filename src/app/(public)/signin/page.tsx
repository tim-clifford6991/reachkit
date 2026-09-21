// src/app/(public)/signin/page.tsx — SPEC §3, `Canvas: Sign in`.
//
// One screen with three arms — the request form, the answered arm, the
// dead-link arm — drawn as one rounded card whose two halves are flush and
// equal height. No password field, no social sign-in, no account control.
"use client";

import Link from "next/link";
import { CircleCheck, Lock } from "lucide-react";
import { use, useActionState, useState } from "react";
import { Surface } from "@/ui/layout";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { BrandMark } from "@/app/_brand/Brand";
import { DEAD_LINK_MARKER, LINK_QUERY_KEY } from "@/lib/account/identity/addresses";
import { sendLink } from "./actions";
import { EMAIL_FIELD, SIGN_IN_INITIAL, type SignInState } from "./state";
import { SPECIMEN_SIGNIN } from "../_landing/specimen";

/** The layout, named once: one daisyUI card whose two halves meet flush
 *  and stretch to each other's height. */
const CARD = "card grid grid-cols-1 overflow-hidden border border-base-300 bg-base-100 shadow-sm lg:grid-cols-2";
const HALF = "flex items-center justify-center px-4 py-10 sm:px-8 sm:py-14 lg:p-14";
/**
 * The accent half: an accent **tint**, with the screen's own ink on it.
 *
 * It was a gradient (`--grad-accent`) over solid `--primary`, with white
 * text at 80%. #937 asks for the app's language, and the app draws no
 * gradient anywhere — but flat `--primary` was the wrong half of the fix:
 * `--primary-content` at 80% on a saturated ground is under the contrast
 * floor, which CI caught on this screen and on the two `/setup` addresses
 * that redirect to it.
 *
 * The 2026-09-20 board draws the half as a light accent tint carrying
 * ordinary ink, with the app's own white tile on top of it — which is both
 * what the product looks like and a ground its text passes against by
 * construction, because the ink is `--base-content` on a mostly-base
 * ground. No opacity is spent on any sentence here.
 */
const PANEL = `${HALF} bg-primary/10`;
const COLUMN = "flex w-full max-w-md flex-col gap-6";
const HEAD_GROUP = "flex flex-col gap-2";
const QUIET = "text-base-content/70";
const CHIP_WARN = "grid size-10 flex-none place-items-center rounded-field bg-warning/10 text-warning";
/** The tile on the tint: the app's own card, not a glass panel. */
const GLASS = "card bg-base-100 border-base-300 flex flex-col gap-3 border p-6";
/** The quiet ink on the tint — the same muted step the rest of the screen
 *  spends, because the ground is now a tint and not a fill. */
const ON_ACCENT_QUIET = "text-base-content/70";

/** The specimen the accent half shows: the reserved domain and the figures
 *  the approved set draws on it (ruling 5c).
 *
 *  **Read from `_landing/specimen.ts`, not written here** (#937). This
 *  route held its own three literals, which is a second home for "the
 *  number the product shows a stranger" and a second place for it to
 *  drift. That module is the product's one home for a drawn figure that
 *  measures nothing; it holds the hero's and now this panel's, each the
 *  drawing the owner approved for its own screen. */
const { domain: SPECIMEN_DOMAIN, score: SPECIMEN_SCORE, max: SPECIMEN_MAX } = SPECIMEN_SIGNIN;

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
      <form action={formAction} className="flex flex-col gap-3">
        {/* The address is the field's own placeholder, in the mono face at
            the `--t-sm` rung, and the same approved string is the field's
            accessible name. */}
        <input
          type="text"
          aria-label={copy("signin.field.placeholder")}
          placeholder={copy("signin.field.placeholder")}
          className="input w-full font-mono text-sm"
          name={EMAIL_FIELD}
          value={fieldValue}
          onChange={(e) => setTyped(e.target.value)}
        />
        {/* The screen's one solid primary, full width — and the only solid
            button on it. */}
        <button type="submit" className="btn btn-primary btn-block" disabled={pending} aria-busy={pending || undefined}>
          {label}
        </button>
      </form>
    );
  }

  return (
    // The screen is one column until the set opens it into two at 1024, so
    // the surface reads at `--w-wide` and gives the card the band's gutter.
    <Surface
      arms={{
        compact: { kind: "columns", count: 1 },
        medium: { kind: "columns", count: 2 },
        wide: { kind: "same-as-below" },
      }}
    >
      <main className="col-span-full">
        <div className={CARD}>
          <div className={HALF}>
            <div className={COLUMN}>
              {/* The brand sits inside the card on this route and no public
                  header stands above it: the screen's whole job is one
                  field, and a bar would put a control over it. */}
              <p className="flex items-center gap-2 text-lg font-extrabold tracking-tight" data-testid="signin-brand">
                <BrandMark />
                <span>{copy("chrome.wordmark")}</span>
              </p>

              {deadLink ? (
                /* The dead-link arm. The chip carries the warn tone — the
                   one thing that went wrong is the link they hold — and the
                   line is the same whatever the reason, read from a marker
                   that carries none. */
                <>
                  <span className={CHIP_WARN} data-tone="warn" data-testid="signin-chip">
                    <Lock size={20} strokeWidth={1.75} aria-hidden />
                  </span>
                  <div className={HEAD_GROUP}>
                    <h1>{copy("signin.expired.head")}</h1>
                    <p className={QUIET}>{copy("signin.link_dead")}</p>
                  </div>
                  {/* **The field, here** (#937, the 2026-09-20 board).
                      This arm used to offer a link back to an empty form,
                      which made a reader holding a dead link take two
                      steps to do the one thing the screen exists for. It
                      is the same form the first arm draws, under this
                      arm's own word — one form, so the two cannot come to
                      behave differently. */}
                  {askForLink(copy("signin.expired.submit"))}
                </>
              ) : answered ? (
                /* The answered arm. The address is the one they typed,
                   echoed back, never one this screen looked up. */
                /* The answered arm, as the 2026-09-20 board draws it: the
                   approved sentence in a daisyUI `alert alert-success`,
                   the terms under it, and the way back to the field. The
                   address is the one they typed, echoed back, never one
                   this screen looked up (§3: the copy is identical
                   whatever the address, so nothing here is a lookup). */
                <>
                  <div className={HEAD_GROUP}>
                    <h1>{copy("signin.sent.head")}</h1>
                  </div>
                  <div role="status" className="alert alert-success" data-testid="signin-chip">
                    <CircleCheck size={20} strokeWidth={1.75} aria-hidden />
                    <span aria-live="polite">{answer}</span>
                  </div>
                  <p className={`font-mono ${QUIET}`}>{copy("signin.sent.to", { address: value })}</p>
                  <p className={QUIET}>{copy("signin.sent.terms")}</p>
                  <Link href={SIGN_IN_PATH} className="btn btn-ghost self-start">
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
                  <p className={QUIET} aria-live="polite">
                    {answer}
                  </p>

                  <p className={`flex flex-wrap items-center gap-1 text-sm ${QUIET}`}>
                    <span>{copy("signin.new.prompt")}</span>
                    <Link href="/" className="link link-primary font-semibold">
                      {copy("signin.new.link")}
                    </Link>
                  </p>
                </>
              )}
            </div>
          </div>

          {/* The accent half. Every figure in it is the reserved domain's
              own — a declared example, never an invented number and never a
              stranger's real domain (ruling 5c). */}
          <div className={PANEL} data-testid="signin-panel">
            <div className={COLUMN}>
              <h2 className="text-primary">{copy("signin.panel.heading")}</h2>
              <div className={GLASS}>
                <p className={`font-mono ${ON_ACCENT_QUIET}`}>{SPECIMEN_DOMAIN}</p>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p>{copy("signin.panel.score-label")}</p>
                  <span className="badge badge-success font-mono">{copy("signin.panel.delta")}</span>
                </div>
                <p className="flex flex-wrap items-baseline gap-2 font-mono">
                  <span className="text-5xl font-bold">{SPECIMEN_SCORE}</span>
                  <span className={`text-xl ${ON_ACCENT_QUIET}`}>{`/${SPECIMEN_MAX}`}</span>
                </p>
                <progress
                  className="progress progress-primary w-full"
                  value={SPECIMEN_SCORE}
                  max={SPECIMEN_MAX}
                  aria-label={copy("signin.panel.score-label")}
                />
                <p className={ON_ACCENT_QUIET}>{copy("signin.panel.line")}</p>
              </div>
              {/* **Captioned as an example** (#937). Ruling 5c admitted the
                  *hero* component's figures without an example line, on the
                  footing that the approved set draws none there. This panel
                  is a different drawing and the 2026-09-20 board captions
                  it — a stranger looking at a score on a sign-in screen
                  should not have to wonder whose site it measured. The
                  domain is the sentence's own slot, filled from the same
                  fixture the figures come from. */}
              <p className="text-primary text-sm" data-testid="signin-panel-example">
                {copy("signin.panel.example", { domain: SPECIMEN_DOMAIN })}
              </p>
            </div>
          </div>
        </div>
      </main>
    </Surface>
  );
}
