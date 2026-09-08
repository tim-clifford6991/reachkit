// BUILD §12 — the `published` mail: "live URL + 24h checks".
//
// One directory per mail kind, named for the kind (ADR-040), holding a
// block list and nothing else: no shell, no formatter of its own beyond the
// one date it states, no vendor knowledge and no sentence.
//
// **One message on the same occasion, whichever of the three outcomes the
// one check recorded** (REQ-062 c5). A failed check is never a reason to
// send nothing, and neither is an absent page nor an unconfirmed check.
// Nothing in this file decides whether there is a mail — it is handed a
// telling and it lays it out.
//
// **The recorded outcome goes in place of the four outcomes, never
// alongside them.** Under `page_not_found` and `could_not_confirm` there is
// no `verdicts` block at all: those arms carry no check outcomes, and a
// block of four rows beside them would read as "four checks, none failed",
// which is the opposite of what was recorded.
//
// **A condition of the site is named separately from the page's own
// outcomes** (c5, c6) — its own block, with its own date, never a fifth row
// among the four checks.
import type { CopyKey } from "@/lib/presentation/copy";
import type { PublishedTelling } from "@/lib/publish/verify/telling";
import { CHECK_IDS, type CheckId } from "@/lib/publish/verify/checks";
import type { SiteConditionKind, VerifyChecks } from "@/lib/publish/types";
import { measured, type Measured } from "@/lib/measure/measured";
import type { MailBlock, VerdictRow } from "../../blocks/types";

const SUBJECT = "mail.published.subject" satisfies CopyKey;
const ADDRESS = "mail.published.address_label" satisfies CopyKey;
const ACTION = "mail.published.action" satisfies CopyKey;
const VERIFIED = "mail.published.verified" satisfies CopyKey;
const REASON = "mail.reason.published" satisfies CopyKey;
const CHECKS_LABEL = "mail.published.checks_label" satisfies CopyKey;
const CHECKS_EMPTY = "mail.published.checks_empty" satisfies CopyKey;

/** One subject line per check, named once each. A `Record` over `CheckId`,
 *  so a fifth check could not be added without its own name. */
const CHECK_NAME: Readonly<Record<CheckId, CopyKey>> = Object.freeze({
  reachable: "mail.published.check.reachable",
  indexable: "mail.published.check.indexable",
  sitemap: "mail.published.check.sitemap",
  aiReadable: "mail.published.check.ai_readable",
});

/** Three words, and the third is its own word.
 *
 *  `check_not_measured` is never `check_failed`: a check ReachKit could not
 *  observe is not a check this page failed, and saying so would blame the
 *  page for a condition of the site it sits in (REQ-062 c6). */
const CHECK_VERDICT = Object.freeze({
  passed: "mail.published.check_passed" satisfies CopyKey,
  failed: "mail.published.check_failed" satisfies CopyKey,
  notMeasured: "mail.published.check_not_measured" satisfies CopyKey,
});

const SITE_CONDITION_LINE: Readonly<Record<SiteConditionKind, CopyKey>> = Object.freeze({
  publishes_no_sitemap: "mail.published.site_condition.publishes_no_sitemap",
  robots_blocks_site: "mail.published.site_condition.robots_blocks_site",
});

/** The locale the shell states dates in — `src/app/(account)/app/_shell/
 *  format.ts`'s `SHELL_LOCALE`, which `src/lib/**` may not import (a lib
 *  module never reaches into `src/app`). One value, written the way `Intl`
 *  spells DECISIONS 2026-08-28's US-English ruling. */
const MAIL_LOCALE = "en-US";

/** REQ-062 criterion 2: the moment the check ran, in the time zone the
 *  customer set. Numeric and with the zone named — a time with no zone
 *  beside it is a time the customer has to guess about. */
export function formatCheckedAt(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(MAIL_LOCALE, {
    timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(at);
}

function verdictOf(check: Measured<boolean>): CopyKey {
  if (check.kind === "unmeasured") return CHECK_VERDICT.notMeasured;
  return check.value ? CHECK_VERDICT.passed : CHECK_VERDICT.failed;
}

function verdictRows(checks: VerifyChecks): VerdictRow[] {
  return CHECK_IDS.map((id) => ({
    subject: CHECK_NAME[id],
    verdict: verdictOf(checks[id]),
  }));
}

export interface PublishedMail {
  /** UI-SPEC S20's footer line: why this mail arrived. */
  readonly reason?: CopyKey;
  readonly subject: CopyKey;
  readonly blocks: readonly MailBlock[];
}

/**
 * The `published` mail for one telling.
 *
 * `timeZone` is the site's own, so the date reads in the zone the customer
 * set (REQ-062 c2). The four outcomes travel as a `verdicts` block — the
 * one arm of the mail vocabulary that pairs a subject with a written
 * verdict — under `found`, and under no other arm.
 */
export function buildPublished(a: {
  telling: PublishedTelling;
  timeZone: string;
}): PublishedMail {
  const { telling } = a;
  const checkedAt = formatCheckedAt(telling.result.checkedAt, a.timeZone);

  const blocks: MailBlock[] = [
    // S20's shape: one line, the fact rows, one solid button. The address
    // moves from the button's label into a fact row — the set puts the
    // address where it can be read and the button where it can be pressed.
    //
    // **No heading, and that is a gap, not a choice.** S20 heads this mail
    // on the page's own title ("[page title 4] is live") and
    // `PublishedTelling` carries no title: it is read from the
    // `publications` row, which has the live URL and not the page. Giving
    // it one is a query change with a schema test behind it, so it is
    // issue #388's rather than smuggled into a mail PR.
    { block: "paragraph", text: telling.copy, vars: { checkedAt } },
    {
      block: "facts",
      items: [
        { label: ADDRESS, value: telling.liveUrl },
        { label: VERIFIED, value: checkedAt },
      ],
    },
    { block: "action", label: ACTION, href: telling.liveUrl },
  ];

  if (telling.result.outcome === "found") {
    blocks.push({
      block: "verdicts",
      label: CHECKS_LABEL,
      // Always a measured list: the four rows exist because the check ran
      // and produced them. `measuredZero` is not the arm — an empty list of
      // checks is not a thing this mail can be handed.
      items: measured(verdictRows(telling.result.checks), telling.result.checkedAt),
      emptyLine: CHECKS_EMPTY,
    });
  }

  if (telling.siteCondition !== null) {
    blocks.push({
      block: "notice",
      text: SITE_CONDITION_LINE[telling.siteCondition.kind],
      vars: { foundAt: formatCheckedAt(telling.siteCondition.foundAt, a.timeZone) },
    });
  }

  return { subject: SUBJECT, reason: REASON, blocks };
}
