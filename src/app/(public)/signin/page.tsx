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
/** The accent half. **Flat `--primary`, not a gradient** (#937): the app
 *  draws no gradient anywhere, and a panel that did would be the one
 *  surface on the site speaking a language the product does not. The tile
 *  inside it is the app's own — a label, the number over its denominator,
 *  a `progress`, and the estimated gain — which is what "in the app's
 *  language" means on this screen. */
const PANEL = `${HALF} bg-primary text-primary-content`;
const COLUMN = "flex w-full max-w-md flex-col gap-6";
const HEAD_GROUP = "flex flex-col gap-2";
const QUIET = "text-base-content/70";
const CHIP_WARN = "grid size-10 flex-none place-items-center rounded-field bg-warning/10 text-warning";
const GLASS = "flex flex-col gap-3 rounded-box border border-primary-content/30 bg-primary-content/10 p-6";
const ON_ACCENT_QUIET = "text-primary-content/80";

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
  const answerKey = ANSWER_COPY_KEY[state.answer];
  const answer = answerKey === undefined ? undefined : copy(answerKey);
  // Every well-formed address is the answered arm, with the same line —
  // whether or not it has an account (SPEC §3). A refusal of the value
  // itself keeps the form, with what they typed intact.
  const answered = state.answer === "requested";

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
                  {/* The way back to the field: a plain link to this screen
                      without the marker, so it works with no client runtime. */}
                  <Link href={SIGN_IN_PATH} className="btn btn-primary btn-block">
                    {copy("signin.expired.submit")}
                  </Link>
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

                  <form action={formAction} className="flex flex-col gap-3">
                    {/* The address is the field's own placeholder, in the
                        mono face at the `--t-sm` rung, and the same approved
                        string is the field's accessible name — `labelHidden`
                        carries it as `aria-label` rather than drawing it. */}
                    <input
                      type="text"
                      aria-label={copy("signin.field.placeholder")}
                      placeholder={copy("signin.field.placeholder")}
                      className="input w-full font-mono text-sm"
                      name={EMAIL_FIELD}
                      value={value}
                      onChange={(e) => setTyped(e.target.value)}
                    />
                    {/* The screen's one solid primary, full width — and the
                        only solid button on it. */}
                    <button type="submit" className="btn btn-primary btn-block" disabled={pending} aria-busy={pending || undefined}>
                      {copy("signin.submit.label")}
                    </button>
                  </form>

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
              <h2>{copy("signin.panel.heading")}</h2>
              <div className={GLASS}>
                <p className={`font-mono ${ON_ACCENT_QUIET}`}>{SPECIMEN_DOMAIN}</p>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p>{copy("signin.panel.score-label")}</p>
                  <span className="badge border-0 bg-base-content font-mono text-base-100">{copy("signin.panel.delta")}</span>
                </div>
                <p className="flex flex-wrap items-baseline gap-2 font-mono">
                  <span className="text-5xl font-bold">{SPECIMEN_SCORE}</span>
                  <span className={`text-xl ${ON_ACCENT_QUIET}`}>{`/${SPECIMEN_MAX}`}</span>
                </p>
                <progress
                  className="progress w-full text-primary-content"
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
              <p className={`text-sm ${ON_ACCENT_QUIET}`} data-testid="signin-panel-example">
                {copy("signin.panel.example", { domain: SPECIMEN_DOMAIN })}
              </p>
            </div>
          </div>
        </div>
      </main>
    </Surface>
  );
}
