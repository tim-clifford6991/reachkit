// The seven kinds UI-SPEC S20 draws, composed from fixtures (issue #376).
// tests/mail/preview/kinds.ts
//
// One place that builds every kind the approved set draws, so a preview and
// a test look at the same mails. `preview.test.ts` renders the five that
// compose and, when `MAIL_PREVIEW_OUT` names a directory, writes each one's
// HTML and plain-text twin into it. The other two are `NOT_PREVIEWABLE`
// below, with the reason — which is a finding about the product, not about
// this file.
//
// **This is what `scripts/live/mail-preview.sh` calls.** That script is
// issue #339's and `scripts/**` is owner-owned, so it is not added here;
// what it needs is a renderer that takes no database, no vendor and no
// clock, and this is it. The one line it wants is
// `MAIL_PREVIEW_OUT=… npx vitest run --project node tests/mail/preview`.
//
// The fixtures are the set's own figures where the set states them — 62 ·
// Hard to find, 0 of 9, 0 of 12 — because a preview that showed different
// numbers from the screen it is checked against would be checking nothing.
import { measured } from "../../../src/lib/measure/measured";
import type { ComposedMail } from "../../../src/lib/mail/shell/compose";
import type {
  DraftReadyPage,
  TellableTelling,
} from "../../../src/lib/mail/templates/draft-ready";

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

/** The seven the set draws, in its own order, plus the two the canvas
 *  draws on `MailWinback` (issue #641): the veto reminder is an arm of the
 *  `draft-ready` row and the payment-failed notice an arm of `account`,
 *  composed here so both are photographed beside their artboard. */
export const PREVIEW_KINDS = [
  "veto-reminder",
  "payment-failed",
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
    case "veto-reminder": {
      const { buildVetoReminder } = await import("../../../src/lib/mail/templates/draft-ready");
      // The canvas's own figures, so the preview checks the picture it is
      // held against rather than a second set of numbers.
      const mail = buildVetoReminder({
        page: { title: "Holiday pay rules for part-time staff" },
        query: "holiday pay for part-time staff",
        publishesAt: "in 6 h",
        facts: { asked: "1,900", answeredBy: "rival-one.example.net", site: "example.com" },
        stopHref: `${APP}/stop/preview`,
        calendarHref: `${APP}/app/calendar`,
      });
      return composeMail({ kind: "draft-ready", subject: mail.subject, subjectVars: mail.subjectVars, blocks: mail.blocks, reason: mail.reason });
    }
    case "payment-failed": {
      const { buildPaymentFailed } = await import("../../../src/lib/mail/templates/account");
      const mail = buildPaymentFailed({ href: `${APP}/app/settings/billing` });
      return composeMail({ kind: "account", subject: mail.subject, blocks: mail.blocks, reason: mail.reason });
    }
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
    default:
      return composeUnwritten(kind);
  }
}

/**
 * The four kinds that cannot be composed at all today.
 *
 * Not the fixture's fault: **their subjects are owner-owed and empty**, so
 * `copy()` throws and `composeMail` refuses — which means the product
 * cannot send either mail today, preview or not (`sendEmail` answers
 * `not-composable`). That is a finding, not a gap in this file.
 *
 * `published` and `weekly` are stopped by their subjects, and S20 writes
 * both — neither could be filled here. `published` heads on the page's
 * title and `PublishedTelling` carries only the live URL; `weekly` heads on
 * the score and its delta, and §12 lets both be unmeasured, while a subject
 * has no omission arm. Both are issue #388's.
 *
 * `nurture` is stopped by its body, and correctly: every string S20 draws
 * on that kind is bracketed, which under ruling 11a means the owner's. The
 * one sentence this issue could fill is its button.
 *
 * `first-page` is stopped by `mail.optout.label` — the label on the stop
 * link every lead mail carries. S20 draws no such label: the set puts the
 * *reason* in the footer ("Follow-up mail has an opt-out link") and leaves
 * the control's own word unwritten, so 11a approves nothing to fill it
 * with. Both lead mails have been uncomposable on this since the seam was
 * built; naming it here is the first time it is visible.
 *
 * They are named rather than skipped: `preview.test.ts` asserts this list
 * is exactly these three, so a fourth cannot join it silently.
 */
export const NOT_PREVIEWABLE: readonly PreviewKind[] = [
  "first-page",
  "nurture",
  "published",
  "weekly",
];

async function composeUnwritten(kind: PreviewKind): Promise<ComposedMail> {
  throw new Error(
    `composePreview(${kind}): not previewable — see NOT_PREVIEWABLE in tests/mail/preview/kinds.ts`
  );
}
