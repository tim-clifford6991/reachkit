// BUILD §9 · UI-SPEC S6 — /veto/{token}: the address the one stop link in
// the `draft-ready` mail lands on.
//
// §12 gives that mail "one veto link"; #142 built what the link redeems — a
// hashed, single-use, draft-bound token that performs exactly one
// transition. This file is the surface that spends it for a reader who has
// no session, because a mail's reader has none: the link is the whole of the
// credential, and `/veto/:token` says so on `src/middleware.ts`'s one public
// allow-list.
//
// **Two arms, because the approved set draws two** (S6, issue #371): an
// *ask* — the page named, the search it targets, the site it goes to, the
// moment it publishes, over one solid control — and a *done*. Arriving reads;
// pressing stops.
//
// **That is a correctness fix, not only a fidelity one.** Until #371 this
// page redeemed on arrival, which put a write behind a GET: a mail scanner, a
// link preview or a prefetching client stops the customer's page without a
// person ever seeing it. The old shape reasoned that a prefetch "costs at
// worst a page that does not publish", and that is a real cost — the customer
// asked for a page a day and silently got none. Reading on GET and stopping
// on POST removes it, and the set is what settles the shape.
//
// **The page does not own the transition.** `redeemVetoLink` marks the token
// used in the same statement that reads it, and `previewVetoLink` reads
// without spending. This file passes a segment, renders an arm, and holds no
// token knowledge or state machine of its own (`ARCHITECTURE.md` rule 1).
//
// **What it discloses is what the mail already did.** The title, the search
// and its monthly volume, the site and the moment all reached this reader's
// inbox in the `draft-ready` mail the token came from — that mail states the
// volume on a why-row of its own; the set puts the same facts on the page so
// a person can tell which page they are stopping. Nothing about the account,
// and nothing about any other page.
//
// **Bounded, and it answers rather than hanging.** Both the read and the
// redemption sit on a public, unauthenticated address, so a database that is
// unreachable costs its reader a written line and not a page that never
// loads — see `DEADLINE_MS`.
import type React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Check, CircleQuestionMark, CircleStop, Clock, Info, Lock, MessageCircleWarning, type LucideIcon } from "lucide-react";
import { StopButton } from "./StopButton";
import { copy } from "@/lib/presentation/copy";
import { previewVetoLink, redeemVetoLink, vetoLinkPath } from "@/lib/publish/publishable";
import type { PreviewResult, VetoPreview } from "@/lib/publish/publishable";
import type { PlanReason } from "@/lib/opportunities/types";
import { whyLineOf } from "@/app/(account)/app/calendar/card-lines";
import { formatTime } from "@/app/(account)/app/_shell/format";
import { isPlannedStopToken, previewPlannedStop, stopPlannedPage, type PlannedPreview } from "@/lib/opportunities/stop";
import { formatMailDay } from "@/lib/mail/blocks/format";
import { PUBLIC_ROUTE_SEO } from "../../_seo/routes";
import { staticMetadata } from "../../_seo/metadata";
import { Surface } from "@/ui/layout";
import type { Arm, Band } from "@/ui/layout";

/** The redemption writes, so no response is ever shared or replayed: a
 *  cached confirmation would tell the next reader their page is stopped on
 *  the strength of someone else's click. The ask arm is uncached for the
 *  same reason in reverse — a stopped page must not still be offered. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** ADR-002's reasoning holds here for a stricter reason than a report's: a
 *  token in an indexed URL is a stop link published to everyone. The meta
 *  half of the promise; `next.config.ts` carries the header half for this
 *  path, as it does for `/scan/:domain`.
 *
 *  Since issue #326 the directive comes from this route's row in
 *  `_seo/routes.ts` rather than being written here, so it cannot disagree
 *  with the app host's sitemap; and the row's `{token}` spelling is passed
 *  as the path deliberately — the composer emits no canonical for a
 *  pattern, and a `<link rel="canonical">` on this page would publish the
 *  stop link into the document itself. */
export const metadata: Metadata = staticMetadata(PUBLIC_ROUTE_SEO.veto);

/**
 * How long either seam may take before the page answers anyway.
 *
 * Chosen here rather than pinned in `constants.ts` for the reason
 * `src/middleware.ts`'s `REMOVAL_READ_DEADLINE_MS` states of its own: it is a
 * property of this one request-path read, not a product bound anything else
 * reads, and a number in two files is wrong.
 *
 * A `catch` alone does not bound a hang: a request that never settles never
 * rejects. The deadline bounds *this page's waiting*, not the statement — a
 * redemption that lands after it still stopped the page, and what the reader
 * lost is the line saying so, not the stop.
 */
const DEADLINE_MS = 1_500;

/** Rejects when `work` has not settled inside the deadline, so the caller's
 *  own `catch` covers a hang the same way it covers a failure. The timer is
 *  cleared once the race is over: a page that answered in 40 ms must not
 *  leave a two-second handle behind on every request it serves. */
async function withDeadline<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("the veto seam timed out")), DEADLINE_MS);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * What the token is bound to, or why it cannot be shown.
 *
 * The unknown arm is the honest one for a read that failed or hung: its line
 * says this is not a link ReachKit can act on, and a link it could not act on
 * is exactly what the reader is holding.
 */
/** A veto link, or the Monday mail's link to a page not written yet. */
type Read =
  | { ok: true; preview: Omit<VetoPreview, "draftId"> }
  | Exclude<PreviewResult, { ok: true }>
  | { ok: false; reason: "written" };

async function preview(token: string): Promise<Read> {
  try {
    return isPlannedStopToken(token)
      ? asRead(await withDeadline(previewPlannedStop(token)))
      : await withDeadline(previewVetoLink(token));
  } catch {
    return { ok: false, reason: "unknown" };
  }
}

/** A planned page has no title or opening yet: its day names it. */
function asRead(read: PlannedPreview): Read {
  if (read.ok) {
    const { day, ...rest } = read.planned;
    return {
      ok: true,
      preview: {
        ...rest,
        title: copy("publish.veto.planned.title", { day: formatMailDay(day) }),
        excerpt: null,
        publishes: null,
        unconnected: false,
        mailedAt: null,
      },
    };
  }
  // A stopped planned day takes the week's next spare, so it draws no week.
  return read.reason === "used" ? { ok: false, reason: "used", title: null, domain: read.domain, excerpt: null, week: null } : read;
}

async function redeem(token: string): Promise<void> {
  try {
    await withDeadline<unknown>(isPlannedStopToken(token) ? stopPlannedPage(token) : redeemVetoLink(token));
  } catch {
    // The page re-reads the token on the way back and says what is true.
  }
}

/** Next hands a dynamic segment as a promise; the suite calls this component
 *  directly with a resolved object, the same direct-call convention
 *  `tests/app/opt-out/page.test.tsx` uses. */
type TokenParams = { token: string };
type Query = { done?: string };

/** The surface declares its own edges: the page is the Round 7 full-width
 *  split (`R7-S4`/`S5`, #1025) — the interaction on the left, the page it
 *  concerns on an accent half filling the right, between the public header
 *  and footer. `surface.css` gives a declared surface no gutter and no
 *  measure, and grows it to meet the footer. */
const ARMS = {
  compact: { kind: "declared", note: "full-width split: the interaction, then the page it concerns; two halves from 1024" },
  medium: { kind: "same-as-below" },
  wide: { kind: "same-as-below" },
} as const satisfies Record<Band, Arm>;

/** The marker the stop action redirects with. Not a claim on its own: the
 *  done arm renders only where the token also reads back as spent, so a
 *  `?done=1` on a live link shows the ask saying it is not stopped yet, and stops nothing. */
const DONE = "done";

/** The split, named once — the same two halves `/signin` draws. With no
 *  page to show (a refusal names none) the left half is the whole width. */
const SPLIT = "grid grid-cols-1 lg:grid-cols-2";
const SINGLE = "grid grid-cols-1";
const HALF = "flex items-center justify-center px-4 py-12 sm:px-8 lg:px-18 lg:py-16";
/** The accent half: a tint carrying the screen's own ink, never opacity on
 *  a saturated ground (the #937 contrast note on `/signin`). */
const PANEL = `${HALF} bg-primary/10`;
/** The interaction half: the white of the board, not the page ground. */
const FORM_HALF = `${HALF} bg-base-100`;
const COLUMN = "flex w-full max-w-100 flex-col gap-5";
const PANEL_COLUMN = "flex w-full max-w-lg flex-col gap-5";
const EYEBROW = "flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-base-content/70";
/** The stopped arm's mark: a success-tinted square, as `R7-S5` draws it. */
const CHIP = "grid size-12 flex-none place-items-center rounded-box";
const CHIP_OK = `${CHIP} bg-success/10 text-success`;
/** A link that could not be spent is not good news: a neutral square. */
const CHIP_QUIET = `${CHIP} bg-base-200 text-base-content/70`;
/** The window's two ends are dots, as the board draws them, not numbered steps. */
const DOT = "";

/**
 * The heading and line for a link that cannot be spent; only a spent link
 * says "Stopped", because only there was something stopped. Total over `VetoRefusal` — a
 * refusal that grows a fifth member fails to compile here rather than
 * falling through to a blank page.
 *
 * `expired` and `not_in_review` share a line. To the person holding the link
 * they are one fact — the moment to stop this page has passed — and the
 * difference between them is a fact about the page that this screen holds no
 * session to be told.
 */
function refusal(reason: Exclude<Read, { ok: true }>["reason"]): { head: string; line: string; icon: LucideIcon } {
  switch (reason) {
    case "used":
      return { head: copy("publish.veto.used.head"), line: copy("publish.veto.alreadyUsed"), icon: CircleStop };
    case "expired":
    case "not_in_review":
      return { head: copy("publish.veto.closed.head"), line: copy("publish.veto.expired"), icon: Clock };
    case "written":
      return { head: copy("publish.veto.closed.head"), line: copy("publish.veto.written"), icon: Clock };
    case "unknown":
      return { head: copy("publish.veto.unknown.head"), line: copy("publish.veto.unknown"), icon: CircleQuestionMark };
  }
}

/** The locale this page writes its moment and its volume in. DECISIONS
 *  2026-08-28 — "MVP is US-English only: one `SERP_LOCATION` constant" —
 *  spelled the way `Intl` spells it, the same derivation
 *  `src/lib/mail/blocks/format.ts` and `_shell/format.ts` each make at
 *  their own boundary. `src/lib` never imports `src/app` and this page is
 *  neither of theirs, so the pin is named once more here rather than
 *  reached for across a seam it may not cross. */
const PAGE_LOCALE = "en-US";

/**
 * How the moment is written: `Mon 19 Oct, 4:00 PM`, as the board draws it —
 * weekday, day, short month, then the clock as the app writes it, in the
 * zone the customer publishes in.
 *
 * **No ISO date and no zone suffix**, which is what this used to print. A
 * stop link is read in a mail client by a person deciding whether tomorrow
 * morning is soon; `2026-09-15 07:00 UTC` makes them do the arithmetic the
 * product already did. The zone is not dropped, it is *applied*: the
 * instant is rendered in `sites.timezone`, which is the same zone the
 * `draft-ready` mail this token came from stated it in, so the two agree
 * to the minute.
 *
 * Composed from parts rather than from a format string: every locale
 * pattern for this shape inserts commas the set does not draw, and the
 * order the set draws is fixed, not the locale's to choose.
 */
function writeMoment(publishes: { at: Date; timeZone: string }): string {
  return `${writeDay(publishes)}, ${formatTime(publishes.at, publishes.timeZone)}`;
}

/** `Mon 19 Oct`: the day half of `writeMoment`. */
function writeDay(at: { at: Date; timeZone: string }): string {
  const parts = new Intl.DateTimeFormat(PAGE_LOCALE, {
    timeZone: at.timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).formatToParts(at.at);
  const part = (type: Intl.DateTimeFormatPartTypes): string => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("weekday")} ${part("day")} ${part("month")}`;
}

/** The stored reason as the sentence's tail: its first letter lowered unless
 *  it opens an acronym ("AI answers…"), with a full stop. `null` states none. */
function writeReason(reason: PlanReason | null): string | null {
  const line = whyLineOf(reason);
  if (line === null) return null;
  const lowered = /^[A-Z][A-Z]/.test(line) ? line : line.charAt(0).toLowerCase() + line.slice(1);
  return `${lowered}.`;
}

/**
 * The window between the mail and the moment: the clock alone where both
 * fall on one day, as the board draws it, and the day too where they do not.
 */
function timeline(mailedAt: Date | null, publishes: { at: Date; timeZone: string }): { sent: string | null; live: string } {
  const sameDay = mailedAt !== null && writeDay({ at: mailedAt, timeZone: publishes.timeZone }) === writeDay(publishes);
  const write = (at: Date): string => (sameDay ? formatTime(at, publishes.timeZone) : writeMoment({ at, timeZone: publishes.timeZone }));
  return { sent: mailedAt === null ? null : write(mailedAt), live: write(publishes.at) };
}

/**
 * The set's search row: the search, and how often it is searched.
 *
 * A volume nobody measured leaves the search standing alone — never a
 * zero, which is REQ-004's trichotomy on this one row. A measured zero is
 * a result and prints as one, exactly as the `first-page` mail's own row
 * does with the same pair.
 */
function writeSearch(query: string, volume: number | null): React.JSX.Element {
  return (
    <>
      <span className="font-mono">{query}</span>
      {volume === null ? null : (
        <span className="ms-1">{copy("publish.veto.ask.row.volume", { volume: new Intl.NumberFormat(PAGE_LOCALE).format(volume) })}</span>
      )}
    </>
  );
}

/** Where a reader who has stopped a page is sent to reach their plan.
 *  Written here rather than imported: the sign-in screen's own copy of it
 *  lives in a Client Component, and a server page reaching into one for a
 *  string would pull the client module into this route's graph. */
const SIGN_IN_PATH = "/signin";

/**
 * The split: the interaction on the left, and — where there is a page to
 * show — that page on the accent half. A helper returning markup rather than
 * a component, so the two arms stay the only components this file draws.
 */
function split(left: React.ReactNode, panel: React.ReactNode | null): React.JSX.Element {
  return (
    <div className={panel === null ? SINGLE : SPLIT}>
      <main className={FORM_HALF}>
        <div className={COLUMN}>{left}</div>
      </main>
      {panel}
    </div>
  );
}

/**
 * The accent half: the page itself in a daisyUI `mockup-browser`, from the
 * draft the token is bound to. A draft that carries none of the three gets no
 * half. The opening is quoted as plain text, never rendered: this page has no session.
 */
function pagePanel(p: { domain: string | null; title: string | null; excerpt: string | null; stopped?: boolean }): React.JSX.Element | null {
  if (p.domain === null && p.title === null && p.excerpt === null) return null;
  return (
    <aside className={PANEL} data-testid="veto-panel">
      <div className={PANEL_COLUMN}>
        <div className="mockup-browser bg-base-100 shadow-(--shadow-card)">
          <div className="mockup-browser-toolbar">
            {/* The address is clamped by the box that holds it, in the UI
                face: a site name can be any length. */}
            <div className="border-base-300 bg-base-100 flex w-full min-w-0 items-center gap-2 rounded-full border px-3 py-1 text-sm">
              <Lock size={16} strokeWidth={1.75} className="flex-none" aria-hidden />
              <span className="truncate">{p.domain ?? ""}</span>
            </div>
          </div>
          <div className="border-base-300 flex flex-col gap-2 border-t p-4">
            {p.stopped ? (
              <span className="badge badge-ghost gap-1 self-start">
                <CircleStop size={16} strokeWidth={1.75} aria-hidden />
                {copy("publish.veto.panel.stopped")}
              </span>
            ) : null}
            {/* The page as it will read, not a heading of this screen. */}
            {p.title === null ? null : <p className={`font-bold ${p.stopped ? "text-base-content/70" : ""}`} data-testid="veto-page-title">{p.title}</p>}
            {p.excerpt === null ? null : (
              <p className="text-base-content/70 text-sm" data-testid="veto-excerpt">
                {p.excerpt}
              </p>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

/** The quiet way into the plan: a signed-out reader reaches it through `/signin`. */
function signInLink(): React.JSX.Element {
  return (
    <Link href={SIGN_IN_PATH} className="btn btn-soft btn-primary min-h-11 self-start">
      {copy("publish.veto.calendar")}
    </Link>
  );
}

/** The ask arm: what the board draws, in its own order. `failed` is the
 *  reader back from a stop that did not land; `planned` is the Monday mail's
 *  page not written yet. Both draw the board's short card: Stop, then the plan. */
function Ask(p: { token: string; it: Omit<VetoPreview, "draftId">; failed?: boolean; planned?: boolean }): React.JSX.Element {
  async function stop(): Promise<void> {
    "use server";
    // The page re-reads the token on the way back, so the reader is told what the store says now.
    await redeem(p.token);
    redirect(`${vetoLinkPath(p.token)}?${DONE}=1`);
  }

  // An unconnected address names no hour anywhere on the page (owner ruling Q11).
  const publishes = p.it.unconnected ? null : p.it.publishes;
  const head = p.it.unconnected
    ? copy("publish.veto.ask.head.unconnected")
    : publishes === null
      ? null
      : copy("publish.veto.ask.head", { when: writeMoment(publishes) });
  // The line naming the screen is its `<h1>` (#328): the title, or with none the eyebrow.
  const when = publishes === null ? null : writeMoment(publishes);
  // A failed stop states its moment once, in its own still-goes-live line.
  const restated = p.failed === true && when !== null && p.it.title !== null;
  const eyebrow = restated ? null : (head ?? (p.it.title === null ? copy("publish.veto.ask.action") : null));
  const Head = p.it.title === null ? "h1" : "p";
  const why = writeReason(p.it.reason);
  const span = publishes === null || restated ? null : timeline(p.it.mailedAt, publishes);
  const short = p.failed === true || p.planned === true;
  const stopForm = (
    <form action={stop} className="flex flex-col gap-2">
      {/* The screen's one solid button. */}
      <StopButton label={copy("publish.veto.ask.action")} block={!short} />
      {short ? null : <p className="text-base-content/70 text-sm">{copy("publish.veto.consequence")}</p>}
    </form>
  );

  return split(
    <>
      {eyebrow === null ? null : (
        <Head className={EYEBROW}>
          <Clock size={16} strokeWidth={1.75} aria-hidden />
          {eyebrow}
        </Head>
      )}
      {p.it.title === null ? null : <h1>{p.it.title}</h1>}
      {why === null ? null : (
        <p className="rounded-box bg-base-200 flex items-start gap-3 px-4 py-3 text-sm" data-testid="veto-why">
          <Info size={20} strokeWidth={1.75} className="text-primary flex-none" aria-hidden />
          <span>
            <strong>{copy("publish.veto.why")}</strong> {why}
          </span>
        </p>
      )}
      {p.it.query === null ? null : (
        <dl className="flex gap-3 text-sm">
          <dt className="text-base-content/70">{copy("publish.veto.ask.row.search")}</dt>
          <dd className="min-w-0">{writeSearch(p.it.query, p.it.volume)}</dd>
        </dl>
      )}
      {span === null ? null : (
        <ul className="steps w-full text-xs" data-testid="veto-timeline">
          {span.sent === null ? null : (
            <li className="step step-primary" data-content={DOT}>
              {copy("publish.veto.timeline.sent", { at: span.sent })}
            </li>
          )}
          <li className="step step-primary font-semibold" data-content={DOT}>
            {copy("publish.veto.ask.head", { when: span.live })}
          </li>
        </ul>
      )}
      {p.failed ? (
        <div role="alert" className="rounded-box border-base-300 flex flex-col gap-3 border p-4" data-testid="veto-failed">
          {/* Warn is edge and ink, never a fill. */}
          <span className={`${CHIP} border-warning text-warning border`} data-tone="warn" data-testid="veto-failed-chip">
            <MessageCircleWarning size={20} strokeWidth={1.75} aria-hidden />
          </span>
          <h2 className="text-xl">{copy("publish.veto.failed.head")}</h2>
          <p>{copy("publish.veto.failed")}</p>
          {when === null ? null : (
            <p className="rounded-box bg-base-200 flex items-center gap-2 px-3 py-2 text-sm">
              <Clock size={16} strokeWidth={1.75} className="flex-none" aria-hidden />
              <span>{copy("publish.veto.failed.still", { when })}</span>
            </p>
          )}
          {/* The board puts the retry and the way to the plan inside the card. */}
          <div className="flex flex-wrap gap-3">
            {stopForm}
            {signInLink()}
          </div>
        </div>
      ) : (
        stopForm
      )}
      {p.failed ? null : p.planned ? (
        signInLink()
      ) : (
        <p className="text-base-content/70 border-base-300 border-t pt-3 text-sm">
          {copy("publish.veto.ask.do-nothing")}
          <Link href={SIGN_IN_PATH} className="link link-primary ms-1 font-semibold">
            {copy("publish.veto.ask.signin")}
          </Link>
        </p>
      )}
    </>,
    p.planned ? null : pagePanel({ domain: p.it.domain, title: p.it.title, excerpt: p.it.excerpt })
  );
}

/**
 * The done arm, and the refusals that wear its shape.
 *
 * **The done arm is `R7-S5`**: a success mark, `Stopped` as the heading,
 * the line saying the page won't go live, what happens instead, and the
 * quiet control — beside the page that was stopped. It earns the success
 * tint: it answers something the reader has just done.
 *
 * **A refusal is a line, not a tinted block**: a link that was already used
 * or has expired is not a success, and warn is edge and ink, never a fill.
 * `unknown` and `expired` name no draft, so they draw no page beside them.
 */
function Told(p: {
  head: string;
  message: string;
  /** The page the token was bound to — only a spent token has one. */
  page: { title: string | null; domain: string | null; excerpt: string | null } | null;
  /** The reader pressed the control and it worked. A refusal reaches this
   *  component with `confirmed` unset. */
  confirmed?: boolean;
  /** A refusal's neutral mark, where the board draws one. */
  icon?: LucideIcon;
}): React.JSX.Element {
  const Icon = p.icon ?? null;
  return split(
    <>
      {p.confirmed ? (
        <>
          <span className={CHIP_OK} data-tone="ok" data-testid="veto-told">
            <Check size={20} strokeWidth={1.75} aria-hidden />
          </span>
          <div role="status" className="flex flex-col gap-2">
            <h1>{p.head}</h1>
            <p>{copy("publish.veto.done.line")}</p>
          </div>
        </>
      ) : (
        // As in `Ask` (#328): with no title in this column, the head is the screen's `<h1>`.
        <>
          {Icon === null ? null : (
            <span className={CHIP_QUIET} data-testid="veto-refused-chip">
              <Icon size={20} strokeWidth={1.75} aria-hidden />
            </span>
          )}
          <h1 className="text-xl">{p.head}</h1>
        </>
      )}
      <p data-testid="veto-message">
        {p.message}
      </p>
      {/* `/signin`, not the plan (#937): this page takes no session, so a link into the app hit a wall. */}
      {signInLink()}
    </>,
    p.page === null ? null : pagePanel({ stopped: p.confirmed === true, ...p.page })
  );
}

export default async function VetoPage(p: {
  params: TokenParams | Promise<TokenParams>;
  searchParams?: Query | Promise<Query>;
}): Promise<React.JSX.Element> {
  const { token } = await p.params;
  const query = p.searchParams === undefined ? {} : await p.searchParams;
  const result = await preview(token);

  // The done arm is told by two things agreeing: the reader came back from
  // the stop control, and the token now reads as spent. Either alone renders
  // what is true instead — a spent token reached cold says so, and `?done=1`
  // against a live one shows the ask, saying the page is not stopped yet.
  if (query[DONE] !== undefined && !result.ok && result.reason === "used") {
    return (
      <Surface arms={ARMS}>
        <Told
          confirmed
          head={copy("publish.veto.done.head")}
          page={{ title: result.title, domain: result.domain, excerpt: result.excerpt }}
          message={copy("publish.veto.stopped")}
        />
      </Surface>
    );
  }

  if (!result.ok) {
    const { head, line, icon } = refusal(result.reason);
    return (
      <Surface arms={ARMS}>
        <Told head={head} page={null} message={line} icon={icon} />
      </Surface>
    );
  }

  // Back from the control with the link still live: the stop did not land.
  return (
    <Surface arms={ARMS}>
      <Ask token={token} it={result.preview} failed={query[DONE] !== undefined} planned={isPlannedStopToken(token)} />
    </Surface>
  );
}
