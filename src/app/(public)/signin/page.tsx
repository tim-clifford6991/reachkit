// src/app/(public)/signin/page.tsx — SPEC §3, `Canvas: Sign in`.
//
// One screen with three arms — the request form, the answered arm, the
// dead-link arm — drawn as one rounded card whose two halves are flush and
// equal height. No password field, no social sign-in, no account control.
"use client";

import Link from "next/link";
import { Lock, Mail, TrendingUp } from "lucide-react";
import { use, useActionState, useState } from "react";
import { Btn } from "@/ui/components/Btn";
import { Input } from "@/ui/components/Input";
import { Surface } from "@/ui/layout";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { DEAD_LINK_MARKER, LINK_QUERY_KEY } from "@/lib/account/identity/addresses";
import { Progress } from "@/ui/components/Progress";
import { sendLink } from "./actions";
import { EMAIL_FIELD, SIGN_IN_INITIAL, type SignInState } from "./state";

/** The layout, named once (issue #549). Tailwind utilities over the
 *  approved tokens: one card at `--r-box` clipping two halves that meet
 *  flush, each half stretched to the other's height by the grid row. */
const CARD =
  "grid grid-cols-1 overflow-hidden rounded-(--r-box) border border-base-300 bg-base-100 shadow-sm lg:grid-cols-2";
/** The band's own air inside each half: the inline step the screen had
 *  before the card, so a 320 viewport keeps its content in its box. */
const HALF =
  "flex items-center justify-center px-(--s-4) py-(--s-6) sm:px-(--s-5) sm:py-(--s-7) lg:p-(--s-7)";
const PANEL = `${HALF} bg-primary bg-(image:--grad-accent) text-primary-content`;
/** A half's own column: the set's form measure, its groups `--s-5` apart. */
const COLUMN = "flex w-full max-w-(--w-form) flex-col gap-(--s-5)";
const HEAD_GROUP = "flex flex-col gap-(--s-2)";
/** The field and its control, `--s-3` apart. `[&_input]:w-full` is what
 *  fills the column: daisyUI's `.input` caps its own width at 20rem. */
const FORM = "flex flex-col gap-(--s-3) [&_input]:w-full";
const WORDMARK = "flex items-center gap-(--s-2) font-extrabold tracking-[-0.02em]";
const MARK =
  "inline-flex size-(--s-5) flex-none items-center justify-center rounded-(--r-field) bg-primary text-primary-content";
const CHIP =
  "inline-flex size-(--s-6) flex-none items-center justify-center rounded-(--r-field) bg-(--accent-bg) text-primary";
const CHIP_WARN =
  "inline-flex size-(--s-6) flex-none items-center justify-center rounded-(--r-field) bg-(--warn-bg) text-(color:--warn)";
const QUIET = "text-(color:--ink-2)";
const NEW_LINE = `flex flex-wrap items-center gap-(--s-1) text-(length:--t-sm) ${QUIET}`;

/** The accent half. `--on-accent` at 12% and 28% is the glass pair, reached
 *  as the theme's own `primary-content` at those two alphas. */
const ON_ACCENT_QUIET = "text-(color:--on-accent-quiet)";
const PANEL_H = "font-bold leading-[1.25] tracking-[-0.02em] text-balance";
const GLASS =
  "flex flex-col gap-(--s-3) rounded-(--r-box) border border-primary-content/28 bg-primary-content/12 p-(--s-5) lg:p-(--s-6)";
/** The row wraps, because the pill cannot: `num` is unlayered (`type.css`)
 *  and its `nowrap` outranks any utility, so at 320 the pill takes its own
 *  line rather than leaving the glass card. */
const BETWEEN = "flex flex-wrap items-center justify-between gap-(--s-3)";
const PILL =
  "num max-w-full rounded-(--r-pill) bg-base-content px-(--s-2) py-(--s-1) text-(length:--t-xs) text-base-100";
const FIGURE = "flex flex-wrap items-baseline gap-(--s-2)";
const FIGURE_BIG = "num font-bold tracking-[-0.02em] text-(length:--h1) sm:text-(length:--t-num-big)";
const FIGURE_OF = `num text-(length:--h3) ${ON_ACCENT_QUIET}`;

/** The specimen the accent half shows: the reserved domain and the figures
 *  the approved set draws on it (ruling 5c). Constants, because this screen
 *  renders before there is a session, a scan or a store to read. */
const SPECIMEN_DOMAIN = "example.com";
const SPECIMEN_SCORE = 47;
/** The score is out of one hundred. */
const SPECIMEN_MAX = 100;

type SignInSearchParams = Partial<Record<typeof LINK_QUERY_KEY, string>>;

/** The one written line each answer reaches for. `none` is before any
 *  submission, when the screen answers nothing at all. */
const ANSWER_COPY_KEY = {
  none: undefined,
  invalid: "signin.address.invalid",
  sent: "signin.link_sent",
  payment_held: "signin.payment_held",
  no_account: "signin.no_account",
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
  // An address that was answered — whichever of the three answers it got —
  // is the *sent* arm: one shape, one control, the answer's own line inside
  // it, so the frame says nothing the line does not. A refusal of the value
  // itself keeps the form, with what they typed intact.
  const answered =
    state.answer === "sent" || state.answer === "payment_held" || state.answer === "no_account";

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
              <p className={WORDMARK} data-testid="signin-brand">
                <span className={MARK} aria-hidden>
                  <TrendingUp size={15} strokeWidth={2} aria-hidden />
                </span>
                <span>{copy("chrome.wordmark")}</span>
              </p>

              {deadLink ? (
                /* The dead-link arm. The chip carries the warn tone — the
                   one thing that went wrong is the link they hold — and the
                   line is the same whatever the reason, read from a marker
                   that carries none. */
                <>
                  <span className={CHIP_WARN} data-tone="warn" data-testid="signin-chip">
                    <Lock size={16} strokeWidth={1.8} aria-hidden />
                  </span>
                  <div className={HEAD_GROUP}>
                    <h1>{copy("signin.expired.head")}</h1>
                    <p className={QUIET}>{copy("signin.link_dead")}</p>
                  </div>
                  {/* The way back to the field: a plain link to this screen
                      without the marker, so it works with no client runtime. */}
                  <Btn
                    href={SIGN_IN_PATH}
                    label={copy("signin.expired.submit")}
                    variant="primary"
                    pill
                    block
                  />
                </>
              ) : answered ? (
                /* The answered arm. The address is the one they typed,
                   echoed back, never one this screen looked up. */
                <>
                  <span className={CHIP} data-testid="signin-chip">
                    <Mail size={16} strokeWidth={1.8} aria-hidden />
                  </span>
                  <div className={HEAD_GROUP}>
                    <h1>{copy("signin.sent.head")}</h1>
                    <p className={QUIET} aria-live="polite">
                      {answer}
                    </p>
                    <p className={`num ${QUIET}`}>{copy("signin.sent.to", { address: value })}</p>
                  </div>
                  <Btn
                    href={SIGN_IN_PATH}
                    label={copy("signin.sent.resend")}
                    variant="tertiary"
                    pill
                  />
                </>
              ) : (
                <>
                  <div className={HEAD_GROUP}>
                    <h1>{copy("signin.heading")}</h1>
                    <p className={QUIET}>{copy("signin.body")}</p>
                  </div>

                  <form action={formAction} className={FORM}>
                    {/* The address is the field's own placeholder, in the
                        mono face at the `--t-sm` rung, and the same approved
                        string is the field's accessible name — `labelHidden`
                        carries it as `aria-label` rather than drawing it. */}
                    <Input
                      label={copy("signin.field.placeholder")}
                      labelHidden
                      mono
                      placeholder={copy("signin.field.placeholder")}
                      name={EMAIL_FIELD}
                      value={value}
                      onChange={setTyped}
                    />
                    {/* The screen's one solid primary, full width — and the
                        only solid button on it. */}
                    <Btn
                      type="submit"
                      label={copy("signin.submit.label")}
                      variant="primary"
                      pill
                      block
                      inFlight={pending}
                    />
                  </form>

                  {/* Where the *value* was refused. The answered arm above
                      carries its own line. */}
                  <p className={QUIET} aria-live="polite">
                    {answer}
                  </p>

                  <p className={NEW_LINE}>
                    <span>{copy("signin.new.prompt")}</span>
                    <Link href="/" className="font-semibold text-primary">
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
              <h2 className={PANEL_H}>{copy("signin.panel.heading")}</h2>
              <div className={GLASS}>
                <p className={`num ${ON_ACCENT_QUIET}`}>{SPECIMEN_DOMAIN}</p>
                <div className={BETWEEN}>
                  <p>{copy("signin.panel.score-label")}</p>
                  <span className={PILL}>{copy("signin.panel.delta")}</span>
                </div>
                <p className={FIGURE}>
                  <span className={FIGURE_BIG}>{SPECIMEN_SCORE}</span>
                  <span className={FIGURE_OF}>{`/${SPECIMEN_MAX}`}</span>
                </p>
                <Progress
                  value={SPECIMEN_SCORE}
                  max={SPECIMEN_MAX}
                  onAccent
                  label={copy("signin.panel.score-label")}
                />
                {/* One line under the bar, and no second one: 5c admits the
                    specimen without a source date or an example line. */}
                <p className={ON_ACCENT_QUIET}>{copy("signin.panel.line")}</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </Surface>
  );
}
