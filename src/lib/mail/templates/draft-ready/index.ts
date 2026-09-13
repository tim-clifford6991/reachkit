// BUILD §12 — the `draft-ready` mail: "daily: title, why-data, *publishes
// tomorrow 09:00 unless you say no*, one veto link".
//
// One directory per mail kind, named for the kind (ADR-040), holding a
// block list and nothing else: no shell, no send, no decision about
// whether there is a mail, and no sentence.
//
// **It is handed a telling and lays it out.** Which of §12's three things
// this mail says is `tellingFor`'s answer, not this file's: "here is the
// window you have to stop it", "there is no window, because you set none"
// and "nothing happens until you approve" are three different statements
// about the same page, and a mail that chose between them would be a
// second copy of the rule the `customer_told` guard reads.
//
// **Three arms in, three arms out, and no default.** The `Telling` union's
// fourth arm — `not_yet_tellable` — never reaches here: a page whose site
// states no time zone has no publish moment to name, so there is nothing
// to compose, and the occasion module refuses before this file is called.
// The switch below is exhaustive over the three that remain, so a fourth
// tellable arm would not compile rather than falling into a default that
// said the wrong one.
//
// **The stop link rides the telling and appears on exactly one arm.** Only
// `interval` carries a `stopAction`, because it is the only kind with an
// interval to stop the page inside (REQ-057 c7 — at a window of zero no
// link is issued, because a link would be an offer the product cannot
// keep). This file does not mint one, does not decide the window, and
// never renders an action with an empty token.
//
// ── §12's "title, why-data" (issue #183) ────────────────────────────────
//
// **The page's own title is model-written, and it travels in the body
// block that carries the `GeneratedText` label** — never in the subject,
// which stays registry copy. That is the owner's ruling, and it is what
// ADR-012 already requires of every other surface: model text reaches a
// customer with the label that identifies it as model text, or it does not
// reach them. `pageBody` is the block, and its label *is* the naming —
// `generated.page.written` takes the title as its slot, so the mail names
// the page in the one place the label cannot be separated from it.
//
// A subject line carrying the title would be the same words with the label
// stripped off, in the one part of a mail no reader can see the body of
// before deciding to open it. It is the plausible-but-wrong address for
// this, and it is closed here rather than left to a caller: `subject` is a
// `CopyKey` on this file's return type, so a title could not be put there
// without changing the shape.
//
// **The why-data is the opportunity's own evidence, stored at creation and
// read.** Never re-measured: §7 wrote the search and its volume when it
// chose this page, the draft screen renders that same stored evidence, and
// a mail that measured again would state a number the page was not chosen
// on. Two rows, because two are what the stored evidence has for a page
// that reaches review — the search the page targets and how often it is
// searched.
//
// A `fix` opportunity carries neither: its evidence is a barrier and a URL,
// and §9's "**Fix never automates**" means no fix page is drafted into
// review in the first place. So this file states no why-data for one
// rather than inventing a line for a page that cannot arrive — an absent
// section, not a sentence about nothing.
import type { CopyKey } from "@/lib/presentation/copy";
import type { Measured } from "@/lib/measure/measured";
import type { Telling } from "@/lib/publish/publishable";
import type { MailBlock } from "../../blocks/types";

const SUBJECT = "mail.draftReady.subject" satisfies CopyKey;
const HEADING = "mail.draftReady.heading" satisfies CopyKey;
const REASON = "mail.reason.draftReady" satisfies CopyKey;
const STOP_ACTION = "mail.draftReady.stopAction" satisfies CopyKey;
const WHY_SEARCH = "mail.draftReady.why.search" satisfies CopyKey;
const WHY_VOLUME = "mail.draftReady.why.volume" satisfies CopyKey;

// §10's veto reminder, as `Canvas: MailWinback` draws it. Every sentence
// but the eyebrow is a key this kind or the veto page already speaks — a
// second copy of "Stop this page" would be two sentences to keep in step.
const VETO_EYEBROW = "mail.vetoReminder.eyebrow" satisfies CopyKey;
const VETO_WINDOW = "mail.draftReady.autopilotWindow" satisfies CopyKey;
const VETO_GOES_LIVE = "mail.draftReady.dest.goesLiveThen" satisfies CopyKey;
const VETO_DO_NOTHING = "publish.veto.ask.do-nothing" satisfies CopyKey;
const VETO_CALENDAR = "publish.veto.calendar" satisfies CopyKey;
const FACT_ANSWERED_BY = "mail.draftReady.fact.answeredBy" satisfies CopyKey;
const FACT_SITE = "publish.veto.ask.row.site" satisfies CopyKey;

/** The page as the customer meets it: its model-written title and the body
 *  that title belongs to. The two travel together because the label the
 *  title is carried by is the block's own — a title without it would be
 *  model text with the label stripped off. */
export interface DraftReadyPage {
  readonly title: string;
  readonly markdown: string;
}

/** The three rows `Canvas: MailWinback` sets in the veto reminder's panel,
 *  each already written by the caller that measured it — a fact row states
 *  a value and formats none. */
export interface VetoReminderFacts {
  readonly asked: string;
  readonly answeredBy: string;
  readonly site: string;
}

/** §7's stored evidence for this page, as §12's "why-data". `volume` stays
 *  `Measured` so a search whose volume was never measured omits its row
 *  rather than printing a 0 — the same omission rule every other section
 *  of every other mail is held to. */
export interface DraftReadyWhy {
  readonly query: string;
  readonly volume: Measured<number>;
}

export interface DraftReadyMail {
  /** UI-SPEC S20's footer line: why this mail arrived. */
  readonly reason?: CopyKey;
  readonly subject: CopyKey;
  readonly subjectVars: Readonly<Record<string, string | number>>;
  readonly blocks: readonly MailBlock[];
}

/** The telling arms this mail can be composed from — every arm but the one
 *  that has no moment to name. Narrowed by type so the occasion module's
 *  refusal is not a rule this file has to trust. */
export type TellableTelling = Exclude<Telling, { kind: "not_yet_tellable" }>;

/**
 * The `draft-ready` mail for one telling.
 *
 * `publishesAt` is already written by the caller, in the customer's own
 * zone (REQ-073 c1: never a zone nobody stated). A template that formatted
 * a date would be a second date formatter, and the two would disagree the
 * first time either moved.
 *
 * `stopHref` is the absolute address of the veto route (#154), composed by
 * the caller from the token the telling carries. It is required on the
 * `interval` arm and refused on the others by the same union, so a mail
 * cannot offer a stop that does not exist and cannot omit one that does.
 */
export function buildDraftReady(a: {
  telling: TellableTelling;
  publishesAt?: string;
  stopHref?: string;
  /** The page this mail is about. Absent only where the draft carries no
   *  title yet, which is a page that cannot be in review. */
  page?: DraftReadyPage;
  /** §7's stored evidence. Absent for a `fix` page, which has none of this
   *  shape and cannot reach this mail anyway. */
  why?: DraftReadyWhy;
}): DraftReadyMail {
  const blocks: MailBlock[] = [];

  // S20's heading: the page's own title, which this kind — unlike
  // `published` — is handed.
  if (a.page !== undefined) {
    blocks.push({ block: "heading", text: HEADING, vars: { title: a.page.title } });
  }

  // §12's "title" — first, because it is what the mail is about, and
  // through the one carrier that keeps the `GeneratedText` label attached
  // to it. `written: true`: this page is written, not proposed.
  if (a.page !== undefined) {
    blocks.push({
      block: "pageBody",
      pageTitle: a.page.title,
      written: true,
      markdown: a.page.markdown,
    });
  }

  // §12's "publishes tomorrow 09:00 unless you say no" — whichever of the
  // three that is for this page. The date slot is on two of the three
  // keys; `copilot` names no moment because there is none to name until
  // the customer approves.
  blocks.push(
    a.telling.kind === "approval_only"
      ? { block: "paragraph", text: a.telling.copy }
      : { block: "paragraph", text: a.telling.copy, vars: { publishesAt: a.publishesAt ?? "" } }
  );

  // REQ-057 c9's destination clause, where the page is bound for a site
  // ReachKit does not serve. A `notice` and not a second paragraph: it is
  // a condition of their own site, said beside the telling rather than in
  // place of it — c9 keeps the date, the interval and the stop action
  // exactly as the other criteria set them.
  if (a.telling.destination !== null) {
    blocks.push({
      block: "notice",
      text: a.telling.destination.copy,
      vars: { site: a.telling.destination.site },
    });
  }

  // §12's "why-data" — §7's own evidence, read from the row it was stored
  // on. The volume is a `stat` and not a sentence with a number in it:
  // every numeral in this product is written by one formatter, and an
  // unmeasured one omits its row.
  if (a.why !== undefined) {
    blocks.push({ block: "paragraph", text: WHY_SEARCH, vars: { query: a.why.query } });
    blocks.push({ block: "stat", label: WHY_VOLUME, value: a.why.volume, format: "perMonth" });
  }

  // "one veto link" — one, on the one arm that has an interval to offer.
  if (a.telling.kind === "interval" && a.stopHref !== undefined) {
    blocks.push({ block: "action", label: STOP_ACTION, href: a.stopHref });
  }

  // The subject names the moment and the page. Both are already here —
  // the same two values the telling's own line spends — so a mail that
  // could be composed cannot fail on its subject.
  return {
    subject: SUBJECT,
    subjectVars: { publishesAt: a.publishesAt ?? "", title: a.page?.title ?? "" },
    reason: REASON,
    blocks,
  };
}

/**
 * §10's veto reminder — the retention touch at six hours left on an
 * unopened draft — in the sections `Canvas: MailWinback` draws: the page,
 * the window left, the evidence §7 chose it on, what going live means, and
 * the two ways out.
 *
 * **It is the `draft-ready` kind and not a twelfth row.** The reader's
 * switch is the daily draft-ready one, which is why the artboard's own
 * footer names that mail; a new register row would offer a second switch
 * for the same telling (ADR-042).
 *
 * **It carries no page body.** `buildDraftReady` is the mail that delivers
 * the draft, and this one is a reminder about a draft the customer already
 * has — the canvas draws the panel, not the page.
 *
 * Every value arrives already written: the window in the customer's own
 * zone, the volume through `formatStat`. A template that formatted one
 * would be a second formatter.
 */
export function buildVetoReminder(a: {
  page: { readonly title: string };
  query: string;
  publishesAt: string;
  facts: VetoReminderFacts;
  stopHref: string;
  calendarHref: string;
}): DraftReadyMail {
  return {
    subject: SUBJECT,
    subjectVars: { publishesAt: a.publishesAt, title: a.page.title },
    reason: REASON,
    blocks: [
      { block: "eyebrow", text: VETO_EYEBROW },
      { block: "heading", text: HEADING, vars: { title: a.page.title } },
      { block: "paragraph", text: VETO_WINDOW, vars: { publishesAt: a.publishesAt } },
      { block: "footnote", text: WHY_SEARCH, vars: { query: a.query } },
      {
        block: "facts",
        items: [
          { label: WHY_VOLUME, value: a.facts.asked },
          { label: FACT_ANSWERED_BY, value: a.facts.answeredBy },
          { label: FACT_SITE, value: a.facts.site },
        ],
      },
      { block: "footnote", text: VETO_GOES_LIVE, vars: { site: a.facts.site } },
      { block: "footnote", text: VETO_DO_NOTHING },
      {
        block: "action",
        label: STOP_ACTION,
        href: a.stopHref,
        secondary: { label: VETO_CALENDAR, href: a.calendarHref },
      },
    ],
  };
}
