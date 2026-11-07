// SPEC §5 — the connect steps a buyer sends to whoever runs their web address: the record and the provider's steps
// exactly as the record block draws them (`guideView`), and no link into the buyer's account.
import { copy, type CopyKey } from "@/lib/presentation/copy";
import type { GuideView } from "@/lib/publish/destinations/hosted/dns-guide";
import type { CopyVars, MailBlock } from "../../blocks/types";

const SUBJECT = "mail.webPerson.subject" satisfies CopyKey;
const PREHEADER = "mail.webPerson.preheader" satisfies CopyKey;
const INTRO = "mail.webPerson.intro" satisfies CopyKey;
const DONE = "mail.webPerson.done" satisfies CopyKey;
const REASON = "mail.reason.webPerson" satisfies CopyKey;
const FULL_NAME = "setup.destination.guide.full-name" satisfies CopyKey;
const PROXY = "setup.destination.dnsProxy" satisfies CopyKey;

export interface WebPersonMail {
  readonly subject: CopyKey;
  readonly subjectVars: CopyVars;
  readonly preheader: CopyKey;
  readonly blocks: readonly MailBlock[];
  readonly reason: CopyKey;
  readonly reasonVars: CopyVars;
}

export function buildWebPersonMail(a: { domain: string; host: string; view: GuideView }): WebPersonMail {
  const domain = { domain: a.domain };
  return {
    subject: SUBJECT,
    subjectVars: domain,
    preheader: PREHEADER,
    reason: REASON,
    reasonVars: domain,
    blocks: [
      { block: "heading", text: SUBJECT, vars: domain },
      { block: "paragraph", text: INTRO, vars: domain },
      { block: "paragraph", text: a.view.where.key, vars: a.view.where.vars },
      {
        block: "facts",
        items: a.view.rows.map((row) => ({ label: row.label, value: "word" in row ? copy(row.word) : row.text })),
      },
      { block: "paragraph", text: FULL_NAME, vars: { host: a.host } },
      ...a.view.steps.map((step): MailBlock => ({ block: "paragraph", text: step.key, vars: step.vars })),
      ...(a.view.proxy ? [{ block: "paragraph", text: PROXY, tone: "quiet" } as const] : []),
      { block: "paragraph", text: DONE },
    ],
  };
}
