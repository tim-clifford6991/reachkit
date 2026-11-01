// Every kind the product sends, composed from fixtures (issues #376, #339).
// tests/mail/preview/kinds.ts
//
// One place that builds them, so a preview and a test look at the same
// mails. The seven UI-SPEC S20 draws come first and all seven compose
// (issue #388): `NOT_PREVIEWABLE` is empty, and the switch below is
// exhaustive over `PREVIEW_KINDS`, so a kind cannot join the list without a
// fixture. SPEC §8's five retention mails and the four kinds the set does
// not draw follow, at the foot of the file.
//
// **This is what `npm run mail:samples` renders through** (issue #339). That
// script needs a renderer taking no database, no vendor and no clock, and
// this is it: every fixture below is a literal and `composeMail` is pure.
//
// The fixtures are the set's own figures where the set states them — 62 ·
// Hard to find, 0 of 9, 0 of 12 on the report, and the digest's ▲8, ▲1 and
// its two judged pages — because a preview that showed different numbers
// from the screen it is checked against would be checking nothing.
import { measured } from "../../../src/lib/measure/measured";
import type { ReactNode } from "react";
import type { MailKind } from "../../../src/lib/mail/kinds";
import type { ComposedMail, ComposeInput } from "../../../src/lib/mail/shell/compose";
import type {
  DraftReadyPage,
  TellableTelling,
} from "../../../src/lib/mail/templates/draft-ready";
import type { WeeklyPage } from "../../../src/lib/mail/templates/weekly";
import { COPY, type CopyKey } from "../../../src/lib/presentation/copy";
import type { PublishedTelling } from "../../../src/lib/publish/verify/telling";

const AT = new Date("2026-09-08T07:00:00.000Z");
const APP = "https://reachkit.example";

/** A composed fixture, plus the React Email document it was rendered from
 *  (#934). The document is what `emails/` hands the preview server, so the
 *  mail the owner opens in a browser is the mail these assertions ran
 *  against — the same argument `scripts/mail-samples.mjs` makes for the
 *  files it writes. */
export type PreviewMail = ComposedMail & { document: ReactNode };

/** `composeMail()` with the document kept. Returned as a function so every
 *  fixture below reads exactly as it did before: one `composeMail({...})`
 *  call per kind, and no second place a preview could be composed
 *  differently from a send. */
async function composer(): Promise<(input: ComposeInput) => Promise<PreviewMail>> {
  const { composeMailParts } = await import("../../../src/lib/mail/shell/compose");
  const { renderMailHtml } = await import("../../../src/lib/mail/shell/render");
  return async (input) => {
    const parts = composeMailParts(input);
    return { ...parts, html: await renderMailHtml(parts.document) };
  };
}

/** The autopilot arm of the draft-ready telling: a page with a window in
 *  which to stop it, which is the arm S20 draws. */
const PREVIEW_TELLING = {
  kind: "interval",
  copy: "mail.draftReady.autopilotWindow",
  publishesAt: AT,
  destination: null,
  stopAction: { token: "preview" },
} as unknown as TellableTelling;

const PREVIEW_PAGE: DraftReadyPage = {
  title: "How to choose onboarding software",
  markdown:
    "Pick the tool your team will actually open on day one: the one that fits how you " +
    "already work, not the one with the longest feature list.\n\n" +
    "The three that matter are what it costs per seat, whether it can be set up without " +
    "an implementation project, and what happens to your data when you leave.",
};

/** #933's fact block, as the board draws it: the search, who answers it
 *  today, the band this site was given for it, and the page the grounded
 *  passage was read from. */
const PREVIEW_WHY = {
  query: "onboarding software for small teams",
  volume: { kind: "measured" as const, value: 1900, at: AT },
  answeredBy: "other sites",
  chances: "Winnable",
  writtenFrom: "https://example.com/pricing",
};

/** The zone the `published` mail states its check in (REQ-062 c2) — the
 *  one the `published` suites use, so both read one time. */
const PREVIEW_ZONE = "America/New_York";

/** One picture carrying all three verdict words: a check that passed, one
 *  that failed, and one nobody could observe (REQ-062 c6). */
const PUBLISHED_TELLING: PublishedTelling = {
  publicationId: "preview",
  siteId: "preview-site",
  liveUrl: "https://example.com/how-to-choose-onboarding-software",
  result: {
    outcome: "found",
    checkedAt: AT,
    checks: {
      reachable: { kind: "measured", value: true, at: AT },
      indexable: { kind: "measured", value: false, at: AT },
      sitemap: { kind: "unmeasured", reason: "undeterminable", at: AT },
      aiReadable: { kind: "measured", value: true, at: AT },
    },
  },
  failed: ["indexable"],
  siteCondition: null,
  copy: "mail.published.verified",
};

/** The digest's own two judged pages: the first carries the set's movement
 *  ("was 31, now 18 · measured 8 Sep"), the second has none to state. */
const WEEKLY_PAGES: readonly WeeklyPage[] = [
  {
    liveUrl: "https://example.com/holiday-pay",
    standing: {
      kind: "verdict",
      verdict: "working",
      measuredAt: AT,
      movement: {
        previousWeek: "2026-09-01",
        spansWeeks: 1,
        from: measured(31, AT),
        to: measured(18, AT),
        declined: false,
      },
      verifyNote: null,
    },
  },
  {
    liveUrl: "https://example.com/payroll-for-five",
    standing: { kind: "verdict", verdict: "working", measuredAt: AT, movement: null, verifyNote: null },
  },
];

/** The board's sample week: Monday to Sunday from the Monday it is sent, the
 *  first three written out with why, and the publish time Plan states. */
const WEEK_DAYS = ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"];
const WEEKLY_CALENDAR = { days: WEEK_DAYS, today: WEEK_DAYS[0]!, time: "4:00 PM", planHref: `${APP}/app/calendar` };
const WEEKLY_NEXT = [
  ["emergency plumber austin", false, "calendar.reason.ai-gap"],
  ["toilet repair austin", true, "calendar.reason.near-page-one"],
  ["slab leak repair cost austin", false, "calendar.reason.asked"],
  ["water heater installation austin", false, null],
  ["drain cleaning austin", true, null],
  ["sewer line repair cost austin", false, null],
  ["gas leak plumber austin", false, null],
].map(([targetQuery, update, why], i) => ({
  targetQuery: targetQuery as string,
  day: WEEK_DAYS[i]!,
  update: update as boolean,
  ...(why === null ? {} : { why: COPY[why as CopyKey] }),
  stopHref: `${APP}/veto/preview-${i}`,
  editHref: `${APP}/app/calendar`,
}));

/** Where a `toggle` kind's stop control points: its own signed unsubscribe
 *  page — never the address-wide opt-out. */
const UNSUBSCRIBE = {
  href: `${APP}/unsubscribe/preview-token`,
  oneClickHref: `${APP}/api/unsubscribe/preview-token`,
  mechanism: "unsubscribe",
} as const;

/** The Monday mail's other two footer links. */
const WEEKLY_FOOTER = [
  { label: "mail.weekly.footer.pause", href: `${APP}/pause/preview-token` },
  { label: "mail.weekly.footer.settings", href: `${APP}/app/settings/mail` },
] as const;

/** The seven the set draws, in its own order. */
export const PREVIEW_KINDS = [
  "magic-link",
  "report",
  "first-page",
  "draft-ready",
  "published",
  "weekly",
  "nurture",
] as const;

export type PreviewKind = (typeof PREVIEW_KINDS)[number];

/** Composes one kind. Async because every template module is imported
 *  through the env fixture, as the rest of `tests/mail` does. */
export async function composePreview(kind: PreviewKind): Promise<PreviewMail> {
  const composeMail = await composer();

  switch (kind) {
    case "magic-link": {
      const { buildMagicLink } = await import("../../../src/lib/mail/templates/magic-link");
      const mail = buildMagicLink({ href: `${APP}/signin?t=preview`, address: "you@example.com" });
      return composeMail({ kind, subject: mail.subject, preheader: mail.preheader, blocks: mail.blocks, reason: mail.reason });
    }
    case "report": {
      const { buildReport } = await import("../../../src/lib/mail/templates/report");
      const mail = buildReport({
        facts: {
          domain: "example.com",
          score: "62",
          band: "Hard to find",
          aiAnswers: "0 of 9",
          googleSearch: "0 of 12",
          limiting: "presence",
        },
        href: `${APP}/scan/example.com`,
        removalAddress: "remove@reachkit.app",
      });
      return composeMail({
        kind,
        subject: mail.subject,
        subjectVars: mail.subjectVars,
        preheader: mail.preheader,
        blocks: mail.blocks,
        reason: mail.reason,
        reasonVars: mail.reasonVars,
      });
    }
    case "first-page": {
      const { buildFirstPage } = await import("../../../src/lib/mail/templates/first-page");
      const mail = buildFirstPage({
        email: "you@example.com",
        pageTitle: "How to choose onboarding software",
        markdown: "# How to choose onboarding software\n\nThe complete page, as written.",
        targetQuery: "best onboarding tools",
        volume: measured(2400, AT),
        pagesFound: 14,
      });
      return composeMail({
        kind,
        subject: mail.subject,
        preheader: mail.preheader,
        blocks: mail.blocks,
        reason: mail.reason,
        optOut: mail.optOut,
      });
    }
    case "draft-ready": {
      const { buildDraftReady } = await import("../../../src/lib/mail/templates/draft-ready");
      const mail = buildDraftReady({
        telling: PREVIEW_TELLING,
        publishesAt: "Tomorrow 07:00",
        stopHref: `${APP}/veto/preview`,
        readHref: `${APP}/app/draft/preview`,
        page: PREVIEW_PAGE,
        why: PREVIEW_WHY,
      });
      return composeMail({
        kind,
        subject: mail.subject,
        preheader: mail.preheader,
        blocks: mail.blocks,
        reason: mail.reason,
      });
    }
    case "published": {
      const { buildPublished } = await import("../../../src/lib/mail/templates/published");
      const mail = buildPublished({ telling: PUBLISHED_TELLING, timeZone: PREVIEW_ZONE });
      return composeMail({
        kind,
        subject: mail.subject,
        preheader: mail.preheader,
        blocks: mail.blocks,
        reason: mail.reason,
        optOut: UNSUBSCRIBE,
      });
    }
    case "weekly": {
      const { buildWeekly } = await import("../../../src/lib/mail/templates/weekly");
      const mail = buildWeekly({
        greeting: { name: "Dana", week: 3, business: "harborplumbing.example" },
        calendar: WEEKLY_CALENDAR,
        // Overview's numbers, on a hosted blog, in the first mail of a month.
        numbers: {
          live: measured(12, AT),
          planned: measured(7, AT),
          google: {
            steps: (["draft.ladder.found", "draft.ladder.showing", "draft.ladder.first-page"] as const).map((name, i) => ({
              name,
              count: measured([11, 5, 1][i]!, AT),
              of: 12,
            })),
            early: false,
            climbing: 2,
            visits: measured(9, AT),
            visitsBefore: measured(4, AT),
            climb: { search: "tankless water heater austin", from: 62, to: 24, climbing: true },
          },
          ai: { linked: measured(2, AT), asked: 12, reads: measured(14, AT) },
          month: {
            score: { value: measured(31, AT), change: measured(4, AT) },
            market: { value: measured(1, AT), of: 12, change: measured(1, AT) },
            reputation: { value: measured(11, AT), answers: 184, weeks: 4 },
          },
        },
        pages: measured(WEEKLY_PAGES, AT),
        next: measured(WEEKLY_NEXT, AT),
      });
      return composeMail({
        kind,
        subject: mail.subject,
        preheader: mail.preheader,
        blocks: mail.blocks,
        reason: mail.reason,
        measurement: { state: "complete" },
        optOut: UNSUBSCRIBE,
        footerLinks: WEEKLY_FOOTER,
      });
    }
    case "nurture": {
      const { buildNurture } = await import("../../../src/lib/mail/templates/nurture");
      const mail = buildNurture({ email: "you@example.com", domain: "example.com", touch: 1 });
      return composeMail({
        kind,
        subject: mail.subject,
        preheader: mail.preheader,
        blocks: mail.blocks,
        reason: mail.reason,
        optOut: mail.optOut,
      });
    }
  }
}

/** The same Monday send on a week nothing could be measured in — the second
 *  `weekly` card the set draws. Every section drops out and the whole-mail
 *  line says when the next measurement is due (§8's "a mail that still
 *  arrives when there was nothing to report"). */
export async function composeUnmeasuredWeek(): Promise<PreviewMail> {
  const composeMail = await composer();
  const { buildWeekly } = await import("../../../src/lib/mail/templates/weekly");
  const { unmeasured } = await import("../../../src/lib/measure/measured");
  const mail = buildWeekly({
    greeting: { name: "Dana", week: 3, business: "harborplumbing.example" },
    pages: unmeasured("not_attempted", AT),
    next: unmeasured("not_attempted", AT),
  });
  return composeMail({
    kind: "weekly",
    subject: mail.subject,
    preheader: mail.preheader,
    blocks: mail.blocks,
    reason: mail.reason,
    measurement: { state: "none", nextDueOn: new Date("2026-09-14T06:00:00.000Z") },
    optOut: UNSUBSCRIBE,
    footerLinks: WEEKLY_FOOTER,
  });
}

/** The draft-ready mail while a hosted address waits for its setting: no
 *  moment is named, and the record the Overview shows rides below the line. */
export async function composeWaitingForAddress(): Promise<PreviewMail> {
  const composeMail = await composer();
  const { buildDraftReady } = await import("../../../src/lib/mail/templates/draft-ready");
  const mail = buildDraftReady({
    telling: {
      ...PREVIEW_TELLING,
      destination: { says: "cannot_go_live_there", site: "help.harborplumbing.example", copy: "mail.draftReady.dest.addressNotConnected" },
    } as TellableTelling,
    stopHref: `${APP}/veto/preview`,
    readHref: `${APP}/app/draft/preview`,
    page: PREVIEW_PAGE,
    record: { type: "CNAME", name: "help", value: "hosted.example.net" },
  });
  return composeMail({ kind: "draft-ready", subject: mail.subject, preheader: mail.preheader, blocks: mail.blocks, reason: mail.reason });
}

/** SPEC §8's retention mails (issue 641). Their lines are owner-owed, so a
 *  preview shows each `TODO(copy)` marker where a sentence will go. */
export const RETENTION_PREVIEW_KINDS = [
  "payment-failed",
  "cancellation",
  "win-back",
] as const;

export async function composeRetentionPreview(
  kind: (typeof RETENTION_PREVIEW_KINDS)[number]
): Promise<PreviewMail> {
  const composeMail = await composer();
  const email = "you@example.com";
  const mail = await (async () => {
    switch (kind) {
      case "payment-failed":
        return (await import("../../../src/lib/mail/templates/payment-failed")).buildPaymentFailed();
      case "cancellation":
        return (await import("../../../src/lib/mail/templates/cancellation")).buildCancellation({
          accessEndsOn: "2026-10-08",
          refunded: false,
        });
      case "win-back":
        return (await import("../../../src/lib/mail/templates/win-back")).buildWinback({ email });
    }
  })();
  return composeMail({ kind, ...mail });
}

/** Empty since issue #388: every kind the set draws composes. The name
 *  stays, pinned by `preview.test.ts`, so a kind that stopped composing
 *  would have to be written down here to be skipped. */
export const NOT_PREVIEWABLE: readonly PreviewKind[] = [];

// ---------------------------------------------------------------------------
// Issue #339 — the four kinds outside the set's seven and the retention five.
//
// "Each kind seen in Gmail and Apple Mail" is a statement about the
// register, not about the approved set: a kind the set does not draw still
// leaves the product and still has to survive an inbox. These four are what
// is left once `PREVIEW_KINDS` and `RETENTION_PREVIEW_KINDS` are taken out
// of `MAIL_KINDS`, and `composeAnyKind` below is what holds the three lists
// to covering it.
// ---------------------------------------------------------------------------

/** The kinds the approved set does not draw. Two sequence mails, the
 *  account notice and the owner's own alert. */
export const REMAINING_PREVIEW_KINDS = [
  "first-page-unavailable",
  "setup-reminder",
  "account",
  "ops",
] as const;

/** The cause the unavailable notice states, as the already-resolved key its
 *  template takes. Named here rather than read from
 *  `FIRST_PAGE_UNAVAILABLE_COPY`: that map lives in `leads/giveaway.ts`,
 *  which imports the lead store and the send seam, and a renderer that
 *  takes no database is the whole point of this module. */
const PREVIEW_CAUSE = "mail.firstPageUnavailable.writing-refused" satisfies CopyKey;

export async function composeRemainingPreview(
  kind: (typeof REMAINING_PREVIEW_KINDS)[number]
): Promise<PreviewMail> {
  const composeMail = await composer();

  switch (kind) {
    case "first-page-unavailable": {
      const { buildFirstPageUnavailable } = await import(
        "../../../src/lib/mail/templates/first-page-unavailable"
      );
      const mail = buildFirstPageUnavailable({ email: "you@example.com", causeLine: PREVIEW_CAUSE });
      return composeMail({
        kind,
        subject: mail.subject,
        preheader: mail.preheader,
        blocks: mail.blocks,
        reason: mail.reason,
        optOut: mail.optOut,
      });
    }
    case "setup-reminder": {
      const { buildSetupReminder } = await import("../../../src/lib/mail/templates/setup-reminder");
      const mail = buildSetupReminder({ signInHref: `${APP}/signin?t=preview&next=/app/setup` });
      return composeMail({ kind, subject: mail.subject, preheader: mail.preheader, blocks: mail.blocks, reason: mail.reason });
    }
    case "account": {
      // The 15-minute chase with a link — SPEC §8's Onboarding row is where
      // this kind is sent on the paying path, and the arm that carries a
      // link is the one a founder who has just paid receives. The kind's
      // other arms (second purchase, address moved, hosting end, deleted
      // account, a broken destination) wear this same shell.
      const { buildChaseWithLink } = await import("../../../src/lib/mail/templates/account");
      const mail = buildChaseWithLink({ href: `${APP}/signin?t=preview` });
      return composeMail({ kind, subject: mail.subject, preheader: mail.preheader, blocks: mail.blocks, reason: mail.reason });
    }
    case "ops": {
      // §6.5's spend ceiling, which is the occasion the register row cites.
      // The incident alert beside it (issue #330) draws the same three
      // blocks, so one render answers for both.
      const { buildSpendCeilingAlert } = await import("../../../src/lib/mail/templates/ops");
      const mail = buildSpendCeilingAlert({ occasion: "reached", spentCents: 1240, ceilingCents: 1200 });
      return composeMail({ kind, subject: mail.subject, blocks: mail.blocks });
    }
  }
}

/** Every kind the product sends: the seven the set draws, SPEC §8's five
 *  retention mails, then the four above. `preview.test.ts` is what checks
 *  this covers `MAIL_KINDS` exactly. */
export const EVERY_MAIL_KIND = [
  ...PREVIEW_KINDS,
  ...RETENTION_PREVIEW_KINDS,
  ...REMAINING_PREVIEW_KINDS,
] as const;

function isPreviewKind(kind: MailKind): kind is PreviewKind {
  return (PREVIEW_KINDS as readonly string[]).includes(kind);
}

function isRetentionKind(kind: MailKind): kind is (typeof RETENTION_PREVIEW_KINDS)[number] {
  return (RETENTION_PREVIEW_KINDS as readonly string[]).includes(kind);
}

/** One kind of the register, composed. The two guards narrow what is left
 *  to `REMAINING_PREVIEW_KINDS`, so a row added to `MAIL_KINDS` with no
 *  fixture is a type error on the last line rather than a missing file at
 *  render time. */
export async function composeAnyKind(kind: MailKind): Promise<PreviewMail> {
  if (isPreviewKind(kind)) return composePreview(kind);
  if (isRetentionKind(kind)) return composeRetentionPreview(kind);
  return composeRemainingPreview(kind);
}
