// The seven kinds UI-SPEC S20 draws, composed from fixtures (issue #376).
// tests/mail/preview/kinds.ts
//
// One place that builds every kind the approved set draws, so a preview and
// a test look at the same mails. All seven compose (issue #388):
// `NOT_PREVIEWABLE` is empty, and the switch below is exhaustive over
// `PREVIEW_KINDS`, so a kind cannot join the list without a fixture.
//
// **This is what `scripts/live/mail-preview.sh` calls.** That script is
// issue #339's and `scripts/**` is owner-owned, so it is not added here;
// what it needs is a renderer that takes no database, no vendor and no
// clock, and this is it. The one line it wants is
// `MAIL_PREVIEW_OUT=… npx vitest run --project node tests/mail/preview`.
//
// The fixtures are the set's own figures where the set states them — 62 ·
// Hard to find, 0 of 9, 0 of 12 on the report, and the digest's ▲8, ▲1 and
// its two judged pages — because a preview that showed different numbers
// from the screen it is checked against would be checking nothing.
import { measured } from "../../../src/lib/measure/measured";
import type { ComposedMail } from "../../../src/lib/mail/shell/compose";
import type {
  DraftReadyPage,
  TellableTelling,
} from "../../../src/lib/mail/templates/draft-ready";
import type { WeeklyPage } from "../../../src/lib/mail/templates/weekly";
import type { PublishedTelling } from "../../../src/lib/publish/verify/telling";

const AT = new Date("2026-09-08T07:00:00.000Z");
const APP = "https://reachkit.example";

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
  markdown: "# How to choose onboarding software\n\nThe page, as written.",
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

/** The set's own next three, in its order. */
const WEEKLY_NEXT = [
  { targetQuery: "payroll software for five people" },
  { targetQuery: "holiday pay rules for part-time staff" },
  { targetQuery: "how to run payroll without an accountant" },
];

/** Where a `toggle` kind's stop control points: Settings › Notifications,
 *  the customer's own three switches — never the address-wide opt-out. */
const UNSUBSCRIBE = { href: `${APP}/app/settings`, mechanism: "unsubscribe" } as const;

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
export async function composePreview(kind: PreviewKind): Promise<ComposedMail> {
  const { composeMail } = await import("../../../src/lib/mail/shell/compose");

  switch (kind) {
    case "magic-link": {
      const { buildMagicLink } = await import("../../../src/lib/mail/templates/magic-link");
      const mail = buildMagicLink({ href: `${APP}/signin?t=preview`, address: "you@company.com" });
      return composeMail({ kind, subject: mail.subject, blocks: mail.blocks, reason: mail.reason });
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
        },
        href: `${APP}/scan/example.com`,
        removalAddress: "remove@reachkit.app",
      });
      return composeMail({
        kind,
        subject: mail.subject,
        subjectVars: mail.subjectVars,
        blocks: mail.blocks,
        reason: mail.reason,
        reasonVars: mail.reasonVars,
      });
    }
    case "first-page": {
      const { buildFirstPage } = await import("../../../src/lib/mail/templates/first-page");
      const mail = buildFirstPage({
        email: "you@company.com",
        pageTitle: "How to choose onboarding software",
        markdown: "# How to choose onboarding software\n\nThe complete page, as written.",
        targetQuery: "best onboarding tools",
        volume: measured(2400, AT),
        pagesFound: 14,
      });
      return composeMail({
        kind,
        subject: mail.subject,
        subjectVars: mail.subjectVars,
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
        page: PREVIEW_PAGE,
      });
      return composeMail({
        kind,
        subject: mail.subject,
        subjectVars: mail.subjectVars,
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
        blocks: mail.blocks,
        reason: mail.reason,
        optOut: UNSUBSCRIBE,
      });
    }
    case "weekly": {
      const { buildWeekly } = await import("../../../src/lib/mail/templates/weekly");
      const mail = buildWeekly({
        scoreDelta: measured(8, AT),
        aiAnswersDelta: measured(1, AT),
        pages: measured(WEEKLY_PAGES, AT),
        next: measured(WEEKLY_NEXT, AT),
      });
      return composeMail({
        kind,
        subject: mail.subject,
        blocks: mail.blocks,
        reason: mail.reason,
        measurement: { state: "complete" },
        optOut: UNSUBSCRIBE,
      });
    }
    case "nurture": {
      const { buildNurture } = await import("../../../src/lib/mail/templates/nurture");
      const mail = buildNurture({ email: "you@company.com", domain: "example.com", touch: 1 });
      return composeMail({
        kind,
        subject: mail.subject,
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
export async function composeUnmeasuredWeek(): Promise<ComposedMail> {
  const { composeMail } = await import("../../../src/lib/mail/shell/compose");
  const { buildWeekly } = await import("../../../src/lib/mail/templates/weekly");
  const { unmeasured } = await import("../../../src/lib/measure/measured");
  const mail = buildWeekly({
    scoreDelta: unmeasured("not_attempted", AT),
    aiAnswersDelta: unmeasured("not_attempted", AT),
    pages: unmeasured("not_attempted", AT),
    next: unmeasured("not_attempted", AT),
  });
  return composeMail({
    kind: "weekly",
    subject: mail.subject,
    blocks: mail.blocks,
    reason: mail.reason,
    measurement: { state: "none", nextDueOn: new Date("2026-09-14T06:00:00.000Z") },
    optOut: UNSUBSCRIBE,
  });
}

/** Empty since issue #388: every kind the set draws composes. The name
 *  stays, pinned by `preview.test.ts`, so a kind that stopped composing
 *  would have to be written down here to be skipped. */
export const NOT_PREVIEWABLE: readonly PreviewKind[] = [];
