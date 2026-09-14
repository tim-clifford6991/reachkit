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
import { Clock } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { previewVetoLink, redeemVetoLink, vetoLinkPath } from "@/lib/publish/publishable";
import type { PreviewResult, RedeemResult, VetoPreview } from "@/lib/publish/publishable";
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
async function preview(token: string): Promise<PreviewResult> {
  try {
    return await withDeadline(previewVetoLink(token));
  } catch {
    return { ok: false, reason: "unknown" };
  }
}

async function redeem(token: string): Promise<RedeemResult> {
  try {
    return await withDeadline(redeemVetoLink(token));
  } catch {
    return { ok: false, reason: "unknown" };
  }
}

/** Next hands a dynamic segment as a promise; the suite calls this component
 *  directly with a resolved object, the same direct-call convention
 *  `tests/app/opt-out/page.test.tsx` uses. */
type TokenParams = { token: string };
type Query = { done?: string };

/** One column at every band: the page is one card, headless — it starts at
 *  its own eyebrow, and the brand is in the bar. */
const ARMS = {
  compact: { kind: "columns", count: 1 },
  medium: { kind: "columns", count: 1 },
  wide: { kind: "columns", count: 1 },
} as const satisfies Record<Band, Arm>;

/** The marker the stop action redirects with. Not a claim on its own: the
 *  done arm renders only where the token also reads back as spent, so a
 *  hand-typed `?done=1` on a live link shows the ask arm and stops nothing. */
const DONE = "done";

/** One card at the form measure, and its eyebrow and row-label voice. */
const MAIN = "mx-auto w-full max-w-lg px-4 py-12 sm:py-16";
const EYEBROW = "flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-base-content/60";
const ROW_LABEL = "text-xs font-semibold uppercase tracking-wide text-base-content/60";

/**
 * The line for a link that cannot be spent. Total over `VetoRefusal` — a
 * refusal that grows a fifth member fails to compile here rather than
 * falling through to a blank page.
 *
 * `expired` and `not_in_review` share a line. To the person holding the link
 * they are one fact — the moment to stop this page has passed — and the
 * difference between them is a fact about the page that this screen holds no
 * session to be told.
 */
function refusalLine(reason: Exclude<PreviewResult, { ok: true }>["reason"]): string {
  switch (reason) {
    case "used":
      return copy("publish.veto.alreadyUsed");
    case "expired":
    case "not_in_review":
      return copy("publish.veto.expired");
    case "unknown":
      return copy("publish.veto.unknown");
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
 * How the moment is written: `Tue 2 Sep 07:00`, as the set draws it —
 * weekday, day, short month, time, in the zone the customer publishes in.
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
  const parts = new Intl.DateTimeFormat(PAGE_LOCALE, {
    timeZone: publishes.timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(publishes.at);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${part("weekday")} ${part("day")} ${part("month")} ${part("hour")}:${part("minute")}`;
}

/**
 * The set's search row: `[search] · 2,400/mo`.
 *
 * The volume is grouped and carries its unit, and `/mo` is no copy key for
 * the reason `src/lib/mail/blocks/format.ts` gives of its own: it is the
 * number's dimension, not the product speaking, on the same footing as a
 * currency symbol.
 *
 * A volume nobody measured leaves the search standing alone — never a
 * zero, which is REQ-004's trichotomy on this one row. A measured zero is
 * a result and prints as one, exactly as the `first-page` mail's own row
 * does with the same pair.
 */
function writeSearch(query: string, volume: number | null): string {
  if (volume === null) return query;
  return `${query} · ${new Intl.NumberFormat(PAGE_LOCALE).format(volume)}/mo`;
}

/** The ask arm: what the set draws, in its own order. */
function Ask(p: { token: string; it: VetoPreview }): React.JSX.Element {
  async function stop(): Promise<void> {
    "use server";
    // The write, behind an act. Its result is not read here: the page
    // re-reads the token on the way back, so what the reader is told is what
    // the store says now rather than what this call returned.
    await redeem(p.token);
    redirect(`${vetoLinkPath(p.token)}?${DONE}=1`);
  }

  const head =
    p.it.publishes === null
      ? copy("publish.veto.ask.action")
      : copy("publish.veto.ask.head", { when: writeMoment(p.it.publishes) });

  return (
    <main className={MAIN}>
      <div className="card border border-base-300 bg-base-100">
        <div className="card-body gap-4">
          <p className={EYEBROW}>
            <Clock size={16} strokeWidth={1.75} aria-hidden />
            {head}
          </p>
          {p.it.title === null ? null : <h1>{p.it.title}</h1>}
          <dl className="flex flex-col gap-2">
            {p.it.query === null ? null : (
              <div className="flex justify-between gap-3">
                <dt className={ROW_LABEL}>{copy("publish.veto.ask.row.search")}</dt>
                <dd className="font-mono text-sm">{writeSearch(p.it.query, p.it.volume)}</dd>
              </div>
            )}
            {p.it.domain === null ? null : (
              <div className="flex justify-between gap-3">
                <dt className={ROW_LABEL}>{copy("publish.veto.ask.row.site")}</dt>
                <dd className="font-mono text-sm">{p.it.domain}</dd>
              </div>
            )}
          </dl>
          <form action={stop}>
            {/* The screen's one solid button. */}
            <button type="submit" className="btn btn-primary btn-block">
              {copy("publish.veto.ask.action")}
            </button>
          </form>
          <p className="text-sm text-base-content/60">{copy("publish.veto.ask.do-nothing")}</p>
        </div>
      </div>
    </main>
  );
}

/**
 * The done arm, and the refusals that wear its shape.
 *
 * **A line, not a tinted block.** `Stopped` over the page's own title over
 * one small sentence over the quiet control, with no fill behind it: a
 * filled alert would put warn on a ground, and `--warn` is edge and ink.
 *
 * **The title is drawn where there is one.** The done arm has it, because
 * a spent token still says which page it was bound to; the refusals do not,
 * because `unknown` and `expired` name no draft.
 */
function Told(p: { head: string; title: string | null; message: string }): React.JSX.Element {
  return (
    <main className={MAIN}>
      <div className="card border border-base-300 bg-base-100">
        <div className="card-body gap-4">
          <p className={EYEBROW}>{p.head}</p>
          {p.title === null ? null : <h1>{p.title}</h1>}
          <p className="text-sm text-base-content/70">{p.message}</p>
          <div>
            <Link href="/app/calendar" className="btn btn-ghost">
              {copy("publish.veto.calendar")}
            </Link>
          </div>
        </div>
      </div>
    </main>
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
  // typed against a live one shows the ask.
  if (query[DONE] !== undefined && !result.ok && result.reason === "used") {
    return (
      <Surface arms={ARMS}>
        <Told
          head={copy("publish.veto.done.head")}
          title={result.title}
          message={copy("publish.veto.stopped")}
        />
      </Surface>
    );
  }

  if (!result.ok) {
    return (
      <Surface arms={ARMS}>
        <Told
          head={copy("publish.veto.done.head")}
          title={null}
          message={refusalLine(result.reason)}
        />
      </Surface>
    );
  }

  return (
    <Surface arms={ARMS}>
      <Ask token={token} it={result.preview} />
    </Surface>
  );
}
