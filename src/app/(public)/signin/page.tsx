// src/app/(public)/signin/page.tsx — SPEC §3, `Canvas: Sign in`.
//
// One screen with three arms — the request form, the answered arm, the
// dead-link arm — in a full-width split between the public header and
// footer: the interaction on the left, and on the right a preview of what
// is waiting inside, drawn on an example business — under the inbox on the
// answered arm and under why links stop on the dead-link arm. Under the
// request arm, how signing in works. No password field, no social sign-in,
// no account control.
"use client";

import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Check,
  ChevronLeft,
  Clock,
  Eye,
  FileText,
  Info,
  LinkIcon,
  Mail,
  Search,
  Send,
  X,
  type LucideIcon,
} from "lucide-react";
import { use, useActionState, useState, useSyncExternalStore } from "react";
import { Surface } from "@/ui/layout";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { DEAD_LINK_MARKER, LINK_QUERY_KEY } from "@/lib/account/identity/addresses";
import { SIGNIN_LINK_TTL_H } from "@/lib/config/constants";
import { sendLink } from "./actions";
import { EMAIL_FIELD, SIGN_IN_INITIAL, type SignInState } from "./state";
import { SPECIMEN_SIGNIN, specimenSigninWeek } from "../_landing/specimen";

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
/** The preview's week, Monday first; Monday's page is the one going live. */
const WEEK = specimenSigninWeek();
const HEAD_GROUP = "flex flex-col gap-2";
const QUIET = "text-base-content/70";
/** The answered arm's mark: a success-tinted square, as `R7-S2` draws it. */
const CHIP_OK = "grid size-12 flex-none place-items-center rounded-box bg-success/10 text-success";
/** The preview on the tint: the app's own card, not a glass panel. */
const TILE = "card @container bg-base-100 flex flex-col gap-4 p-4 shadow-(--shadow-card) sm:p-5";
const WELL = "rounded-box bg-base-200 flex min-w-0 flex-col gap-1 p-3";
const ICON = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;
/** A card on the white half, holding the form or one of the answered arms' facts. */
const FACT_CARD = "card border border-base-300 bg-base-100 flex flex-col gap-3 p-4";
/** The dead-link arm's mark: a warning-tinted square beside the answered arm's success one. */
const CHIP_WARN = "grid size-12 flex-none place-items-center rounded-box bg-warning/10 text-warning";

/** The facts under the request button, each one a promise kept. */
const CHIPS = ["signin.chip.nopass", "signin.chip.link", "signin.chip.install"] as const satisfies readonly CopyKey[];

/** How signing in works, in the order the reader does it. */
const STEPS = [
  { head: "signin.how.email.head", line: "signin.how.email.line" },
  { head: "signin.how.open.head", line: "signin.how.open.line" },
  { head: "signin.how.in.head", line: "signin.how.in.line" },
] as const satisfies readonly { head: CopyKey; line: CopyKey }[];

/** The clock the copy is written in; the zone is left to the reader's browser. */
const TIME_LOCALE = "en-US";
const MS_PER_HOUR = 3_600_000;
const clock = (at: number): string => new Intl.DateTimeFormat(TIME_LOCALE, { hour: "numeric", minute: "2-digit" }).format(at);
const subscribeNever = () => () => {};

/** The send time and its end, written only once the browser runs: a server render cannot know the reader's zone. */
function useReaderClock(sentAt: number | undefined): { sent: string; until: string } | undefined {
  const inBrowser = useSyncExternalStore(subscribeNever, () => true, () => false);
  if (!inBrowser || sentAt === undefined) return undefined;
  return { sent: clock(sentAt), until: clock(sentAt + SIGNIN_LINK_TTL_H * MS_PER_HOUR) };
}

/** The three figures the preview shows, each under the word the app uses for it. */
const FIGURES = [
  { icon: Search, label: "signin.preview.google", value: SPECIMEN_SIGNIN.found, of: "signin.preview.google.of", vars: { live: SPECIMEN_SIGNIN.live } },
  { icon: Eye, label: "signin.preview.showing", value: SPECIMEN_SIGNIN.showing, of: "signin.preview.showing.of", vars: {} },
  { icon: LinkIcon, label: "signin.preview.ai", value: SPECIMEN_SIGNIN.linked, of: "signin.preview.ai.of", vars: { asked: SPECIMEN_SIGNIN.asked } },
] as const satisfies readonly { icon: LucideIcon; label: CopyKey; of: CopyKey; value: number; vars: Record<string, number> }[];

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
  const times = useReaderClock(state.sentAt);

  /** The one form this screen has, under whichever word the arm drawing it
   *  uses: *Send my sign-in link* on a first visit, *Send a new link* to a
   *  reader whose link is dead. One field, one submit, one action — §3's
   *  "sign-in copy is identical whatever the address" is about the words,
   *  and this is the other half of it: the same door, however you arrived. */
  function askForLink(label: string, facts: boolean): React.JSX.Element {
    return (
      // `noValidate`: a malformed address gets the product's own sentence, not the browser's bubble.
      <form action={formAction} className={FACT_CARD} noValidate>
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
          {pending ? <span className="loading loading-spinner loading-xs" aria-hidden /> : <Send {...ICON} />}
        </button>
        {/* Where the *value* was refused. The answered arm carries its own line. */}
        {answer === undefined || answered ? null : (
          <p className={QUIET} aria-live="polite">
            {answer}
          </p>
        )}
        {facts ? (
          <p className={`flex flex-wrap gap-x-4 gap-y-1 text-sm ${QUIET}`}>
            {CHIPS.map((key) => (
              <span key={key} className="flex items-center gap-1">
                <Check {...ICON} size={14} className="text-success" />
                {copy(key)}
              </span>
            ))}
          </p>
        ) : null}
        <p className={`flex flex-wrap items-center gap-1 text-sm ${QUIET}`}>
          <span>{copy("signin.new.prompt")}</span>
          <Link href="/" className="link link-primary font-semibold">
            {copy("signin.new.link")}
          </Link>
        </p>
      </form>
    );
  }

  /** What is waiting inside, on an example business. The answered arms draw it short, under the fuller caption. */
  function preview(short: boolean): React.JSX.Element {
    return (
      <section className={TILE} aria-labelledby="signin-preview">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="signin-preview" className="eyebrow">
            {copy("signin.preview.eyebrow")}
          </h2>
          <span className="badge badge-success badge-soft badge-sm">
            <Check {...ICON} size={12} />
            {copy("signin.preview.running")}
          </span>
        </div>
        {short ? null : (
          <div className="flex items-center gap-3">
            <span className="grid size-9 flex-none place-items-center rounded-box bg-primary/10 text-primary">
              <Building2 {...ICON} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{SPECIMEN_SIGNIN.business}</p>
              <p className={`font-mono text-xs wrap-anywhere ${QUIET}`}>{SPECIMEN_SIGNIN.address}</p>
            </div>
            <span className={`text-sm ${QUIET}`}>{copy("signin.preview.week", { week: SPECIMEN_SIGNIN.week })}</span>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2" data-testid="signin-preview-figures">
          {FIGURES.map(({ icon: Icon, label, value, of, vars }) => (
            <div key={label} className={WELL}>
              <span className="flex items-center gap-1 text-xs font-medium">
                <Icon {...ICON} size={14} className="flex-none text-primary" />
                {copy(label)}
              </span>
              <span className="figure text-3xl">{value}</span>
              <span className="text-xs">{copy(of, vars)}</span>
            </div>
          ))}
        </div>
        {short ? null : (
          <>
            <div className="flex flex-col gap-2">
              <p className="flex flex-wrap items-baseline justify-between gap-x-2">
                <span className="text-sm font-semibold">{copy("signin.preview.days.title")}</span>
                <span className={`text-xs ${QUIET}`}>{copy("signin.preview.days.pace", { pages: WEEK.length })}</span>
              </p>
              <ol className="grid grid-cols-4 gap-1 @sm:grid-cols-7" data-testid="signin-preview-week">
                {WEEK.map((day, index) => (
                  <li
                    key={day}
                    className={`flex min-w-0 flex-col items-center gap-1 rounded-box border p-1.5 text-xs ${
                      index === 0 ? "border-primary/30 bg-primary/10 text-primary" : "border-base-300"
                    }`}
                  >
                    <span className="font-mono">{day}</span>
                    <FileText {...ICON} size={14} />
                    <span className={index === 0 ? "font-semibold" : QUIET}>
                      {index === 0 ? SPECIMEN_SIGNIN.liveAt : copy("calendar.stage.planned")}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <p className="rounded-box bg-base-200 flex items-start gap-2 p-3 text-sm">
              <Info {...ICON} className="mt-0.5 flex-none" />
              <span>
                <strong>{copy("signin.preview.calm.head")}</strong> {copy("signin.preview.calm.line")}
              </span>
            </p>
          </>
        )}
        <p className={`text-xs ${QUIET}`} data-testid="signin-panel-example">
          {copy(short ? "signin.preview.example.inside" : "signin.preview.example")}
        </p>
      </section>
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
                <span className={CHIP_WARN} data-tone="warning">
                  <Clock size={20} strokeWidth={1.75} aria-hidden />
                </span>
                <div className={HEAD_GROUP}>
                  <h1>{copy("signin.expired.head")}</h1>
                  <p className={QUIET}>{copy("signin.link_dead")}</p>
                </div>
                {askForLink(copy("signin.expired.submit"), false)}
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
                <p className={`${WELL} text-sm wrap-anywhere`}>{copy("signin.sent.to", { address: value })}</p>
                <div className={FACT_CARD} data-testid="signin-sent-window">
                  <p className="flex items-center gap-2 font-semibold">
                    <Clock {...ICON} />
                    {copy("signin.sent.window")}
                  </p>
                  <progress className="progress progress-success" value={3} max={100} aria-hidden />
                  {/* Written by the reader's browser: blank on a server render, never a guessed zone. */}
                  <p className="flex flex-wrap justify-between gap-2 text-xs">
                    <span className="num font-semibold">
                      {times ? copy("signin.sent.at", { time: times.sent }) : null}
                    </span>
                    <span className={`num ${QUIET}`}>{times ? copy("signin.sent.until", { time: times.until }) : null}</span>
                  </p>
                  <p className={`text-sm ${QUIET}`}>{copy("signin.sent.terms")}</p>
                </div>
                <Link href={SIGN_IN_PATH} className="btn btn-soft btn-primary self-start">
                  {copy("signin.sent.resend")}
                </Link>
              </>
            ) : (
              <>
                <div className={HEAD_GROUP}>
                  <p className="eyebrow">{copy("signin.eyebrow")}</p>
                  <h1>{copy("signin.heading")}</h1>
                  <p className={QUIET}>{copy("signin.body")}</p>
                </div>
                {askForLink(copy("signin.submit.label"), true)}
              </>
            )}
          </div>
        </main>

        {/* The accent half: on the answered arms, the fact that answers them,
            then what a customer finds inside, drawn on an example business. */}
        <aside className={PANEL} data-testid="signin-panel">
          <div className={PANEL_COLUMN}>
            {deadLink ? (
              <section className={TILE} aria-labelledby="signin-why">
                <h2 id="signin-why" className="eyebrow">
                  {copy("signin.why.title")}
                </h2>
                <div className="flex flex-col gap-2">
                  <p className="flex items-center gap-2 font-semibold">
                    <Clock {...ICON} />
                    {copy("signin.why.window")}
                  </p>
                  <progress className="progress progress-warning" value={100} max={100} aria-hidden />
                  <p className="flex flex-wrap justify-between gap-2 text-xs">
                    <span className={QUIET}>{copy("signin.why.sent")}</span>
                    <span className="font-semibold">{copy("signin.why.stops")}</span>
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <p className="flex items-center gap-2 font-semibold">
                    <Mail {...ICON} />
                    {copy("signin.why.newest")}
                  </p>
                  <div className="grid grid-cols-1 gap-2 @sm:grid-cols-2">
                    <span className="rounded-box bg-base-200 flex items-center gap-2 p-3 text-sm">
                      <X {...ICON} className="flex-none text-error" />
                      <span>
                        <strong>{copy("signin.why.older.head")}</strong>
                        <br />
                        <span className={QUIET}>{copy("signin.why.older.line")}</span>
                      </span>
                    </span>
                    <span className="rounded-box bg-success/10 flex items-center gap-2 p-3 text-sm">
                      <Check {...ICON} className="flex-none text-success" />
                      <span>
                        <strong>{copy("signin.why.newer.head")}</strong>
                        <br />
                        <span className={QUIET}>{copy("signin.why.newer.line")}</span>
                      </span>
                    </span>
                  </div>
                </div>
                <p className={`text-sm ${QUIET}`}>{copy("signin.why.calm")}</p>
              </section>
            ) : answered ? (
              <section className={TILE} aria-labelledby="signin-inbox">
                <div className="flex flex-col items-center gap-4 @md:flex-row @md:items-start">
                  {/* The mail as it lands: daisyUI's phone, holding the inbox row the mail makes. */}
                  <div className="mockup-phone border-base-300 w-52 flex-none" aria-hidden>
                    <div className="mockup-phone-camera" />
                    <div className="mockup-phone-display bg-base-100 text-base-content flex flex-col gap-2 px-6 pt-12 pb-8 text-left text-xs">
                      <span className="flex justify-between text-primary">
                        <span className="flex items-center">
                          <ChevronLeft {...ICON} size={14} />
                          {copy("signin.inbox.mailboxes")}
                        </span>
                        <span>{copy("signin.inbox.edit")}</span>
                      </span>
                      <span className="text-2xl font-bold">{copy("signin.inbox.title")}</span>
                      <span className={`rounded-box bg-base-200 flex items-center gap-1 px-2 py-1 ${QUIET}`}>
                        <Search {...ICON} size={12} />
                        {copy("signin.inbox.search")}
                      </span>
                      <span className="border-b border-base-300 flex flex-col gap-0.5 py-2">
                        <span className="flex justify-between">
                          <strong>{copy("mail.shell.wordmark")}</strong>
                          <span className={QUIET}>{times?.sent}</span>
                        </span>
                        <span>{copy("mail.magicLink.subject")}</span>
                        <span className={QUIET}>{copy("signin.inbox.snippet")}</span>
                      </span>
                      <span className={`mt-auto text-center ${QUIET}`}>{copy("signin.inbox.updated")}</span>
                    </div>
                  </div>
                  <div className="flex min-w-0 flex-col gap-3">
                    <h2 id="signin-inbox" className="eyebrow flex items-center gap-1">
                      <Mail {...ICON} size={14} />
                      {copy("signin.inbox.eyebrow")}
                    </h2>
                    <p className="text-sm">{copy("signin.inbox.from")}</p>
                    <div className={WELL}>
                      <h3 className="eyebrow">{copy("signin.inbox.inside")}</h3>
                      <p className="font-semibold">{copy("mail.magicLink.heading")}</p>
                      <span className="badge badge-primary self-start" aria-hidden>
                        {copy("mail.magicLink.action")}
                      </span>
                      <p className={`text-xs ${QUIET}`}>{copy("signin.inbox.press")}</p>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}
            {preview(deadLink || answered)}
          </div>
        </aside>
      </div>

      {deadLink || answered ? null : (
        <section className="bg-base-100 px-4 pb-12 sm:px-8 lg:px-18" aria-labelledby="signin-how">
          <div className="rounded-box bg-base-200 mx-auto flex max-w-5xl flex-col gap-3 p-5">
            <h2 id="signin-how" className="eyebrow">
              {copy("signin.how.title")}
            </h2>
            <ol className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {STEPS.map(({ head, line }, index) => (
                <li key={head} className="flex items-start gap-3">
                  <span className="badge badge-primary badge-soft flex-none">{index + 1}</span>
                  <span className="flex flex-col">
                    <strong>{copy(head)}</strong>
                    <span className={`text-sm ${QUIET}`}>{copy(line)}</span>
                  </span>
                  {index < STEPS.length - 1 ? (
                    <ArrowRight {...ICON} size={20} className="mt-1 ms-auto hidden flex-none text-base-content/30 md:block" />
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}
    </Surface>
  );
}
