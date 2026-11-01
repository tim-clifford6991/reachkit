// BUILD §12 — the `published` mail: "live URL + 24h checks", as a block list only (ADR-040).
// One message whichever outcome the check recorded (REQ-062 c5): a failure, a missing page or an unconfirmed check is never silence.
// The recorded outcome replaces the four checks: no `verdicts` block under `page_not_found` or `could_not_confirm`, which would read "none failed".
// A condition of the site is its own block with its own date, never a fifth check row (c5, c6).
import type { CopyKey } from "@/lib/presentation/copy";
import type { PublishedTelling } from "@/lib/publish/verify/telling";
import { CHECK_IDS, type CheckId } from "@/lib/publish/verify/checks";
import type { SiteConditionKind, VerifyChecks, VerifyOutcome } from "@/lib/publish/types";
import { measured, type Measured } from "@/lib/measure/measured";
import type { MailBlock, VerdictRow } from "../../blocks/types";

/** One subject per outcome, so a page nobody found is never announced as live. */
const SUBJECT: Readonly<Record<VerifyOutcome["outcome"], CopyKey>> = Object.freeze({
  found: "mail.published.subject",
  page_not_found: "mail.published.subject.not_found",
  could_not_confirm: "mail.published.subject.not_confirmed",
});
const PREHEADER = "mail.published.preheader" satisfies CopyKey;
const ADDRESS = "mail.published.address_label" satisfies CopyKey;
const ACTION = "mail.published.action" satisfies CopyKey;
const REASON = "mail.reason.published" satisfies CopyKey;
const CHECKS_LABEL = "mail.published.checks_label" satisfies CopyKey;
const CHECKS_EMPTY = "mail.published.checks_empty" satisfies CopyKey;

/** One subject per check: a `Record` over `CheckId`, so a fifth check needs its own name. */
const CHECK_NAME: Readonly<Record<CheckId, CopyKey>> = Object.freeze({
  reachable: "mail.published.check.reachable",
  indexable: "mail.published.check.indexable",
  sitemap: "mail.published.check.sitemap",
  aiReadable: "mail.published.check.ai_readable",
});

/** `check_not_measured` is never `check_failed`: that would blame the page for a condition of its site (REQ-062 c6). */
const CHECK_VERDICT = Object.freeze({
  passed: "mail.published.check_passed" satisfies CopyKey,
  failed: "mail.published.check_failed" satisfies CopyKey,
  notMeasured: "mail.published.check_not_measured" satisfies CopyKey,
});

const SITE_CONDITION_LINE: Readonly<Record<SiteConditionKind, CopyKey>> = Object.freeze({
  publishes_no_sitemap: "mail.published.site_condition.publishes_no_sitemap",
  robots_blocks_site: "mail.published.site_condition.robots_blocks_site",
});

/** The shell's US-English `SHELL_LOCALE`, restated since `src/lib` never imports `src/app`. */
const MAIL_LOCALE = "en-US";

/** REQ-062 c2: when the check ran, in the customer's zone, with the zone named so nobody has to guess. */
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
  readonly preheader: CopyKey;
  readonly blocks: readonly MailBlock[];
}

/** The `published` mail for one telling, dated in the site's own zone; the four outcomes are a `verdicts` block under `found` only. */
export function buildPublished(a: {
  telling: PublishedTelling;
  timeZone: string;
}): PublishedMail {
  const { telling } = a;
  const checkedAt = formatCheckedAt(telling.result.checkedAt, a.timeZone);

  const blocks: MailBlock[] = [
    // S20's shape: one line, the fact rows, one solid button, with the address in a row rather than the button.
    // No heading yet: S20 heads it with the page title, which `PublishedTelling` does not carry from the `publications` row.
    { block: "paragraph", text: telling.copy, vars: { checkedAt } },
    // The date is in the line above, so the address is the one fact row.
    { block: "facts", items: [{ label: ADDRESS, value: telling.liveUrl }] },
    { block: "action", label: ACTION, href: telling.liveUrl },
  ];

  if (telling.result.outcome === "found") {
    blocks.push({
      block: "verdicts",
      label: CHECKS_LABEL,
      // Always measured: the rows exist because the check ran.
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

  return { subject: SUBJECT[telling.result.outcome], preheader: PREHEADER, reason: REASON, blocks };
}
