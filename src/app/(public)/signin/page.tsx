// src/app/(public)/signin/page.tsx — SPEC §3, boards AuthSignIn, AuthCheckEmail, AuthExpired.
//
// One centred column with three arms — the request form, the answered arm,
// the dead-link arm — between the public header and footer. No password
// field, no social sign-in, no account control.
"use client";

import Link from "next/link";
import { CircleAlert, Clock, Send } from "lucide-react";
import { use, useActionState, useState, useSyncExternalStore } from "react";
import { Surface } from "@/ui/layout";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { DEAD_LINK_MARKER, LINK_QUERY_KEY } from "@/lib/account/identity/addresses";
import { SIGNIN_LINK_TTL_H } from "@/lib/config/constants";
import { sendLink } from "./actions";
import { EMAIL_FIELD, SIGN_IN_INITIAL, type SignInState } from "./state";

/** The autofill token and the keyboard the field asks for. */
const EMAIL_HINT = "email";

const SECTION = "px-4 pt-10 pb-14 sm:px-6 sm:pt-18 sm:pb-22";
const COLUMN = "mx-auto flex w-full min-w-0 max-w-120 flex-col gap-6";
const LEAD = "text-base-content/80 sm:text-lg";
const QUIET = "text-base-content/70";
const CARD = "card border border-base-300 bg-base-100 shadow-(--shadow-card) flex flex-col";
const FACT = "flex flex-col gap-0.5 py-3";
const MARK = "grid size-11 flex-none place-items-center rounded-box";
const ICON = { size: 24, strokeWidth: 1.75, "aria-hidden": true } as const;

/** The clock the copy is written in; the zone is left to the reader's browser. */
const TIME_LOCALE = "en-US";
const MS_PER_HOUR = 3_600_000;
const clock = (at: number): string => new Intl.DateTimeFormat(TIME_LOCALE, { hour: "numeric", minute: "2-digit" }).format(at);
const subscribeNever = () => () => {};

/** When the link stops, written only once the browser runs: a server render cannot know the reader's zone. */
function useLinkEnd(sentAt: number | undefined): string | undefined {
  const inBrowser = useSyncExternalStore(subscribeNever, () => true, () => false);
  if (!inBrowser || sentAt === undefined) return undefined;
  return clock(sentAt + SIGNIN_LINK_TTL_H * MS_PER_HOUR);
}

type SignInSearchParams = Partial<Record<typeof LINK_QUERY_KEY, string>>;

/** The one written line each answer reaches for. `none` is before any
 *  submission, when the screen answers nothing at all. */
const ANSWER_COPY_KEY = {
  none: undefined,
  invalid: "signin.address.invalid",
  requested: "signin.link_requested",
} as const satisfies Record<SignInState["answer"], CopyKey | undefined>;

/** A link here with no query clears the dead-link marker; `src/middleware.ts` redirects to the same path. */
const SIGN_IN_PATH = "/signin";

function isPromise<T>(value: Promise<T> | T | undefined): value is Promise<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

/** Accepts a real `searchParams` Promise (production) or an already-plain object (this file's own tests). */
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

  // What is in the field wins while they are typing; what the action carried back stands in before that.
  const value = typed ?? state.value;

  const deadLink = params[LINK_QUERY_KEY] === DEAD_LINK_MARKER;
  // A reader holding a dead link typed nothing here, so the field never echoes an address they did not enter.
  const fieldValue = deadLink ? (typed ?? "") : value;
  const answerKey = ANSWER_COPY_KEY[state.answer];
  const answer = answerKey === undefined ? undefined : copy(answerKey);
  // Every well-formed address gets the answered arm and the same line, whether or not it has an account (SPEC §3).
  const answered = state.answer === "requested";
  const until = useLinkEnd(state.sentAt);
  const refused = answer !== undefined && !answered;

  /** The one form, under whichever words the arm uses: the same door, however the reader arrived. */
  function askForLink(label: string, submit: string): React.JSX.Element {
    return (
      // `noValidate`: a malformed address gets the product's own sentence, not the browser's bubble.
      <form action={formAction} className={`${CARD} gap-4 p-6`} noValidate>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">{label}</span>
          <input
            type="email"
            autoComplete={EMAIL_HINT}
            inputMode={EMAIL_HINT}
            placeholder={copy("signin.field.placeholder")}
            className={refused ? "input input-error h-11 w-full" : "input h-11 w-full"}
            name={EMAIL_FIELD}
            value={fieldValue}
            onChange={(e) => setTyped(e.target.value)}
            aria-invalid={refused || undefined}
          />
        </label>
        {refused ? (
          <p className="flex items-start gap-2 text-sm text-error" aria-live="polite">
            <CircleAlert size={16} strokeWidth={1.75} className="mt-0.5 flex-none" aria-hidden />
            {answer}
          </p>
        ) : null}
        <button type="submit" className="btn btn-primary btn-block h-11 text-(length:--t-body)" disabled={pending} aria-busy={pending || undefined}>
          {pending ? <span className="loading loading-spinner loading-sm" aria-hidden /> : null}
          {submit}
        </button>
      </form>
    );
  }

  return (
    <Surface
      arms={{
        compact: { kind: "declared", note: "one centred column: the heading, one line and one card" },
        medium: { kind: "same-as-below" },
        wide: { kind: "same-as-below" },
      }}
    >
      <main className={SECTION}>
        <div className={COLUMN}>
          {deadLink ? (
            <>
              <span className={`${MARK} bg-(--warn-bg) text-warning`} data-tone="warning">
                <Clock {...ICON} />
              </span>
              <h1 className="t-hero">{copy("signin.expired.head")}</h1>
              <p className={LEAD}>{copy("signin.link_dead")}</p>
              {askForLink(copy("signin.expired.field"), copy("signin.expired.submit"))}
            </>
          ) : answered ? (
            <>
              <span className={`${MARK} bg-(--ok-bg) text-success`} data-tone="ok" data-testid="signin-chip">
                <Send {...ICON} />
              </span>
              <h1 className="t-hero">{copy("signin.sent.head")}</h1>
              <p role="status" aria-live="polite" className={LEAD}>
                {answer}
              </p>
              {/* The address is the one they typed, echoed back, never one this screen looked up. */}
              <div className={`${CARD} divide-y divide-base-300 px-6 py-5`} data-testid="signin-sent-facts">
                <p className={FACT}>
                  <span className={`text-sm ${QUIET}`}>{copy("signin.sent.to")}</span>
                  <span className="num break-all">{value}</span>
                </p>
                <p className={FACT}>
                  <span className={`text-sm ${QUIET}`}>{copy("signin.sent.subject")}</span>
                  <strong>{copy("mail.magicLink.subject")}</strong>
                </p>
                <p className={FACT}>
                  <span className={`text-sm ${QUIET}`}>{copy("signin.sent.until")}</span>
                  {/* Written by the reader's browser: blank on a server render, never a guessed zone. */}
                  <span>{until ? copy("signin.sent.until.time", { time: until }) : null}</span>
                </p>
              </div>
              <p className={`text-sm ${QUIET}`}>{copy("signin.sent.terms")}</p>
              <Link href={SIGN_IN_PATH} className="btn btn-soft btn-primary h-11 self-start">
                {copy("signin.sent.resend")}
              </Link>
            </>
          ) : (
            <>
              <h1 className="t-hero">{copy("signin.heading")}</h1>
              <p className={LEAD}>{copy("signin.body")}</p>
              {askForLink(copy("signin.field.label"), copy("signin.submit.label"))}
            </>
          )}
        </div>
      </main>
    </Surface>
  );
}
