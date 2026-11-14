// SPEC §8, Onboarding mails — the two once-per-site notices after payment: setup done with what the first check found,
// then the address connected. Block lists only; each figure comes from a stored row, and an unmeasured one is left out, never 0.
import { measured, measuredZero } from "@/lib/measure/measured";
import type { CopyKey } from "@/lib/presentation/copy";
import type { FactRow, ListRow, MailBlock } from "../../blocks/types";
import { formatMailDay } from "../../blocks/format";
import type { AccountMail } from "../magic-link";

const REACH_A_PERSON = "mail.account.reach_a_person" satisfies CopyKey;
const SETUP_SUBJECT = "mail.account.setup_done.subject" satisfies CopyKey;
const SETUP_PREHEADER = "mail.account.setup_done.preheader" satisfies CopyKey;
const SETUP_FOUND = "mail.account.setup_done.found" satisfies CopyKey;
const SETUP_PARTIAL = "mail.account.setup_done.partial" satisfies CopyKey;
const SETUP_MARKET = "mail.account.setup_done.market" satisfies CopyKey;
const SETUP_RIVALS = "mail.account.setup_done.rivals" satisfies CopyKey;
const SETUP_SEARCHES = "mail.account.setup_done.searches" satisfies CopyKey;
const SETUP_DAY = "mail.account.setup_done.day" satisfies CopyKey;
const SETUP_WEEK_NONE = "mail.account.setup_done.week_none" satisfies CopyKey;
const SETUP_ACTION = "mail.account.setup_done.action" satisfies CopyKey;
const WEEK = "mail.weekly.next" satisfies CopyKey;
const WEEK_ITEM = "mail.weekly.next.item" satisfies CopyKey;
const CONNECTED_SUBJECT = "mail.account.connected.subject" satisfies CopyKey;
const CONNECTED_PREHEADER = "mail.account.connected.preheader" satisfies CopyKey;
const CONNECTED_BODY = "mail.account.connected.body" satisfies CopyKey;
const CONNECTED_BODY_NO_DAY = "mail.account.connected.body_no_day" satisfies CopyKey;

export interface SetupDoneInput {
  readonly domain: string;
  /** The market the founder confirmed, or `null` where none is stored. */
  readonly market: string | null;
  /** The rivals the founder chose; `null` where unreadable. */
  readonly rivals: readonly string[] | null;
  /** Searches waiting to be written; `null` where the pass did not measure them. */
  readonly searches: number | null;
  /** Whether the first check ended without measuring everything. */
  readonly partial: boolean;
  /** The committed week's dated pages, `YYYY-MM-DD` and search. */
  readonly week: readonly { readonly date: string; readonly search: string }[];
  readonly planHref: string;
  readonly at: Date;
}

export function buildSetupDone(a: SetupDoneInput): AccountMail {
  const facts: FactRow[] = [];
  if (a.market !== null) facts.push({ label: SETUP_MARKET, value: a.market });
  if (a.rivals !== null && a.rivals.length > 0) facts.push({ label: SETUP_RIVALS, value: a.rivals.join(", ") });
  const rows: ListRow[] = a.week.map((page) => ({
    lead: { text: SETUP_DAY, vars: { day: formatMailDay(page.date) } },
    label: WEEK_ITEM,
    vars: { search: page.search },
  }));
  const blocks: MailBlock[] = [
    { block: "paragraph", text: SETUP_FOUND, vars: { domain: a.domain } },
    ...(a.partial ? [{ block: "paragraph", text: SETUP_PARTIAL, tone: "quiet" } satisfies MailBlock] : []),
    // Empty or unmeasured is left out or said here, not by the shell, whose whole-mail line speaks of a week.
    ...(facts.length === 0 ? [] : [{ block: "facts", items: facts } satisfies MailBlock]),
    ...(a.searches === null
      ? []
      : [{ block: "stat", label: SETUP_SEARCHES, value: a.searches === 0 ? measuredZero(0, a.at) : measured(a.searches, a.at), format: "integer" } satisfies MailBlock]),
    { block: "heading", level: 2, text: WEEK },
    rows.length === 0
      ? { block: "paragraph", text: SETUP_WEEK_NONE }
      : { block: "list", items: measured(rows, a.at), emptyLine: SETUP_WEEK_NONE },
    { block: "action", label: SETUP_ACTION, href: a.planHref },
    { block: "notice", text: REACH_A_PERSON },
  ];
  return { subject: SETUP_SUBJECT, preheader: SETUP_PREHEADER, blocks };
}

/** The owner's line: where the pages go live, and from which day where the week holds one. */
export function buildConnected(a: { host: string; firstDay: string | null }): AccountMail {
  return {
    subject: CONNECTED_SUBJECT,
    preheader: CONNECTED_PREHEADER,
    blocks: [
      a.firstDay === null
        ? { block: "paragraph", text: CONNECTED_BODY_NO_DAY, vars: { host: a.host } }
        : { block: "paragraph", text: CONNECTED_BODY, vars: { host: a.host, day: formatMailDay(a.firstDay) } },
      { block: "notice", text: REACH_A_PERSON },
    ],
  };
}
