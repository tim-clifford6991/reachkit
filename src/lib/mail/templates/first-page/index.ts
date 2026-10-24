// BUILD §4.2 — the page a founder traded their address for, as a block list only (ADR-040); an unmeasured volume drops its block, never prints 0.
// Read ADR-041 before removing the opt-out: `stoppable: false` keeps suppression off the send, but REQ-010 c11 puts the opt-out in "any of
// these emails", so `optOut` is a required field and a lead mail without one is unrepresentable.
import { env } from "@/lib/config/env";
import type { Measured } from "@/lib/measure/measured";
import type { CopyKey } from "@/lib/presentation/copy";
import { formatStat } from "../../blocks/format";
import type { MailBlock } from "../../blocks/types";
import type { OptOutControl } from "../../shell/compose";
import { optOutTokenFor } from "../../leads/optout";

// Keys hoisted and checked by `satisfies CopyKey`, so the string-literal sweep never reads a key field as a written sentence.
const SUBJECT = "mail.firstPage.subject" satisfies CopyKey;
const TARGET_SEARCH = "mail.firstPage.target_search" satisfies CopyKey;
const FIRST_OF_N = "mail.firstPage.first_of_n" satisfies CopyKey;
const HEADING = "mail.firstPage.heading" satisfies CopyKey;
const REASON = "mail.reason.firstPage" satisfies CopyKey;

export interface LeadMail {
  readonly subject: CopyKey;
  /** The subject's own slots, where the set's subject names the page. */
  readonly subjectVars?: Readonly<Record<string, string | number>>;
  readonly blocks: readonly MailBlock[];
  /** UI-SPEC S20's footer line: why this mail arrived. */
  readonly reason?: CopyKey;
  readonly optOut: OptOutControl;
}

/** The public `/opt-out/{token}` page, absolute from the boot-validated binding: an inbox resolves no relative path. */
export function optOutHref(email: string): string {
  return new URL(`/opt-out/${optOutTokenFor(email)}`, env.NEXT_PUBLIC_APP_URL).toString();
}

/** The same stop as the RFC 8058 address a mail client POSTs to; its own address, since Next cannot serve a page and a handler from one segment. */
export function oneClickOptOutHref(email: string): string {
  return new URL(`/api/opt-out/${optOutTokenFor(email)}`, env.NEXT_PUBLIC_APP_URL).toString();
}

export function optOutControlFor(email: string): OptOutControl {
  // `mechanism` keeps ADR-042's address-wide opt-out and kind-scoped unsubscribe apart in front of the reader.
  return {
    href: optOutHref(email),
    oneClickHref: oneClickOptOutHref(email),
    mechanism: "opt-out",
  };
}

/** The set's row: the search and its measured monthly volume, written by `formatStat`. */
function searchValue(a: { targetQuery: string; volume: Measured<number> }): string {
  if (a.volume.kind === "unmeasured") return a.targetQuery;
  return `${a.targetQuery} · ${formatStat(a.volume, "perMonth")}`;
}

export function buildFirstPage(a: {
  email: string;
  pageTitle: string;
  markdown: string;
  targetQuery: string;
  volume: Measured<number>;
  pagesFound: number;
}): LeadMail {
  return {
    subject: SUBJECT,
    subjectVars: { title: a.pageTitle },
    reason: REASON,
    blocks: [
      // S20 heads the mail with the page's own title: the page is what the reader came for.
      { block: "heading", text: HEADING, vars: { title: a.pageTitle } },
      { block: "paragraph", text: FIRST_OF_N, vars: { pagesFound: a.pagesFound } },
      // The page arrives whole; `written: true` carries the generated-text label with it.
      { block: "pageBody", pageTitle: a.pageTitle, written: true, markdown: a.markdown },
      // S20's fact row: `target search · [search] · 2,400/mo`. A fact row cannot say "unmeasured", so an unmeasured volume
      // is left out here and the search stands alone, never with a zero (§12).
      { block: "facts", items: [{ label: TARGET_SEARCH, value: searchValue(a) }] },
    ],
    optOut: optOutControlFor(a.email),
  };
}
