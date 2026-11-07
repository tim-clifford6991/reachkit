// BUILD §4.4 — the whole of what the shell states, in one shape.
//
// WO-154 `## Goal`, verbatim: "Assemble `ShellModel` in one request-cached
// read — the domain, a week count that counts measured weeks only, the
// waiting count, and either the next publish time or the first-match reason
// there is none."
//
// `assembleShell` is pure: facts in, model out. The reading of those facts
// is `provider.ts`'s, and today it reads a fixture (issue #9 builds the
// shell on fixture data; the queries arrive with §11's weekly measurement
// (#41) and §9's publishing (#45)). Keeping the assembly pure is what lets
// every REQ-040 criterion be decided by a test with no database at all.
import type { WorkStop } from "@/lib/presentation/stopped";
import { resolveNoPublish, type NoPublishCauses, type NoPublishReason } from "./nopublish";
import { weeksMeasured, type MeasuredWeek, type WeekCount } from "./weeks";

/** BUILD §4.3's two modes, named by the spec and never by a renderer. */
export type PublishingMode = "autopilot";

/** The next page to go live on its own: when, and what it is called. */
export interface NextPage {
  at: Date;
  title: string;
}

/** The next planned topic no page is written for yet: its site-local date (`YYYY-MM-DD`) and the search it targets. */
export interface NextTopic {
  on: string;
  topic: string;
}

/** What happens next where no page is scheduled and nothing holds publishing back: the next planned topic, else the
 *  Monday check, which always has a date. */
export type Upcoming = ({ kind: "topic" } & NextTopic) | { kind: "monday-check"; on: Date };

/** REQ-040 c3 and c4 as one closed union: the next page, or the reason there
 *  is none, or what happens next. No `next?: Date` — an optional field
 *  would let a renderer read "no time" as "not loaded yet". */
export type PublishingState =
  | ({ mode: PublishingMode; next: Date } & Pick<NextPage, "title">)
  | { mode: PublishingMode; next: null; because: NoPublishReason }
  | { mode: PublishingMode; next: null; because: null; upcoming: Upcoming };

/** SPEC §4 (2026-09-20, #908) — the *Waiting for you* card's whole subject:
 *  the page sitting in the customer's review, what it is called, and when it
 *  publishes if they do nothing. `null` for every other state — there is no
 *  "loading" arm and no empty card, because a card with nothing waiting in
 *  it is a control that cannot act (SPEC §4 of the same date). */
export interface WaitingPage {
  /** Its address is `/app/draft/{draftId}` — the review screen. */
  draftId: string;
  /** The page's own title. Model text, rendered as the calendar renders a
   *  day card's title, and clamped to two lines by the card. */
  title: string;
  /** When it goes live unless the customer stops it, or `null` where no
   *  time is set yet — then the card states the page and not a time it
   *  would have to invent. */
  goesLiveAt: Date | null;
}

export interface ShellModel {
  domain: string;
  /** Whether the site's own logo is stored, so its mark is the logo and not its first letter. */
  hasLogo: boolean;
  /** The zone every date and time the shell states is expressed in
   *  (REQ-073 c1: captured once, stored as one preference). */
  timeZone: string;
  weeks: WeekCount;
  /** The pages that need the customer, beside Overview's menu item (SPEC §4,
   *  2026-10-17, #1477): a page in review is on its way and is not one. `0`
   *  renders no count at all — the renderer's rule, but the number is stated
   *  here rather than being an absent field. */
  waiting: number;
  /** SPEC §4 (2026-09-20) — the one page the *Waiting for you* card is
   *  about, or `null`: the page in review, or one that needs the customer. */
  review: WaitingPage | null;
  /** SPEC §4 (2026-09-20) — where *Visit your blog* goes, or `null` where
   *  this site has no live blog of ours to visit and the shortcut is
   *  therefore not drawn. */
  blog: string | null;
  publishing: PublishingState;
  /** REQ-092 c3: the fact that ReachKit stopped its own work, or `null`.
   *  Stated on every app screen by `StoppedNotice` and by nothing else.
   *  `null` is the whole of "it stops stating it once the work resumes" —
   *  there is no dismissal flag and no cached banner to clear. */
  stopped: WorkStop | null;
}

/** Everything the shell reads, before it is a model. One shape, so a
 *  fixture and a future query answer the same question. */
export interface ShellFacts {
  domain: string;
  hasLogo: boolean;
  timeZone: string;
  mode: PublishingMode;
  weeks: readonly MeasuredWeek[];
  /** REQ-065's own clock (#41): when this domain's first weekly measurement
   *  is due. Read, never computed here. */
  firstDueOn: Date;
  /** The `needs_attention` drafts whose cause is critical for the customer
   *  (SPEC §4 2026-10-17, #1477; owner O7). A page in review is not counted. */
  waiting: number;
  /** The soonest page in review or needing the customer, for the side
   *  panel's card (SPEC §4, 2026-09-20). Read, never counted from. */
  review: WaitingPage | null;
  /** §9's hosted blog, where it is live, as an address a browser can open;
   *  `null` otherwise. */
  blog: string | null;
  /** The next page to go live on its own — a page in review at the time its
   *  customer was told, or one already past its window — or `null`. */
  next: NextPage | null;
  /** The next planned topic on a date no page is written for and no day was decided, or `null`. */
  nextTopic: NextTopic | null;
  noPublishCauses: NoPublishCauses;
  /** BUILD §6.5 / §11's stop, read per account and per day by BP-001's
   *  adapter (the cap-hit ledger over `fetches`, the kill switch, the last
   *  run's status) and assembled into the shape REQ-092 c2/c4/c6 fix. It
   *  carries no cause a renderer could leak — see
   *  `src/lib/presentation/stopped/stop.ts`. */
  stopped: WorkStop | null;
}

export function assembleShell(facts: ShellFacts): ShellModel {
  const weeks = weeksMeasured({
    domain: facts.domain,
    weeks: facts.weeks,
    firstDueOn: facts.firstDueOn,
  });

  return {
    domain: facts.domain,
    hasLogo: facts.hasLogo,
    timeZone: facts.timeZone,
    weeks,
    waiting: facts.waiting,
    review: facts.review,
    blog: facts.blog,
    publishing: publishingOf(facts),
    stopped: facts.stopped,
  };
}

/** A scheduled page outranks every cause but the stop; with none, the causes are
 *  resolved by `NO_PUBLISH_PRECEDENCE`, and with no cause the card names the
 *  next event, so it always says what happens next. */
function publishingOf(facts: ShellFacts): PublishingState {
  // REQ-092 c7 first: while ReachKit has stopped its own work, no publish
  // is scheduled — a time carried over from before the stop would be a
  // statement that the work is coming, which is the one thing the customer
  // must not be told. A stop is therefore a cause whether or not the
  // adapter also set the boolean, and it outranks a `next` that is still on
  // the row (ADR-011).
  const stopped = facts.stopped !== null || facts.noPublishCauses.reachkit_stopped;
  if (!stopped && facts.next !== null) return { mode: facts.mode, next: facts.next.at, title: facts.next.title };
  const causes: NoPublishCauses = { ...facts.noPublishCauses, reachkit_stopped: stopped };
  const because = resolveNoPublish(causes);
  if (because !== undefined) return { mode: facts.mode, next: null, because };
  const upcoming: Upcoming =
    facts.nextTopic !== null ? { kind: "topic", ...facts.nextTopic } : { kind: "monday-check", on: facts.firstDueOn };
  return { mode: facts.mode, next: null, because: null, upcoming };
}
