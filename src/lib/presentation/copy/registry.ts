// BUILD §2.5 — the closed partition list — every sentence the product speaks.
//
// Every sentence ReachKit speaks in its own voice is composed here from the
// `keys/*.ts` partitions. Each entry is the sentence itself; a `{name}` in it
// is a slot its caller fills. `COPY` is a frozen object literal in the
// bundle, never a fetch, a template store or an i18n catalogue (REQ-093
// criterion 5): with every language model unavailable, it still reads the
// same. A partition imports `CopyPartition` back with `import type`, which
// is erased, so the apparent import cycle is not a runtime one.
import { REPORT_COPY } from "./keys/report.ts";
import { OVERVIEW_COPY } from "./keys/overview.ts";
import { OVERVIEW_PAGES_COPY } from "./keys/overview-pages.ts";
import { CALENDAR_COPY } from "./keys/calendar.ts";
import { DRAFT_COPY } from "./keys/draft.ts";
import { SETTINGS_COPY } from "./keys/settings.ts";
import { SETUP_COPY } from "./keys/setup.ts";
import { PUBLISH_COPY } from "./keys/publish.ts";
import { DANGER_COPY } from "./keys/danger.ts";
import { MAIL_COPY } from "./keys/mail.ts";
import { OFFER_COPY } from "./keys/offer.ts";
import { BANDS_COPY } from "./keys/bands.ts";
import { LAWS_COPY } from "./keys/laws.ts";
import { SIGNIN_COPY } from "./keys/signin.ts";
import { CHROME_COPY } from "./keys/chrome.ts";
import { META_COPY } from "./keys/meta.ts";
import { REVIEW_COPY } from "./keys/review.ts";
import { OPS_COPY } from "./keys/ops.ts";
import { LANDING_COPY } from "./keys/landing.ts";

export type CopyPartition = Readonly<Record<string, string>>;

const ENTRIES = {
  ...REPORT_COPY,
  ...OVERVIEW_COPY,
  ...OVERVIEW_PAGES_COPY,
  ...CALENDAR_COPY,
  ...DRAFT_COPY,
  ...SETTINGS_COPY,
  ...SETUP_COPY,
  ...PUBLISH_COPY,
  ...DANGER_COPY,
  ...MAIL_COPY,
  ...OFFER_COPY,
  ...BANDS_COPY,
  ...LAWS_COPY,
  ...SIGNIN_COPY,
  ...CHROME_COPY,
  ...META_COPY,
  ...REVIEW_COPY,
  ...OPS_COPY,
  ...LANDING_COPY,
};

export type CopyKey = keyof typeof ENTRIES;

/** Every sentence the product speaks in its own voice. */
export const COPY: Readonly<Record<CopyKey, string>> = Object.freeze(ENTRIES);

/** The slot names a sentence holds, in the order they first appear. */
export function slotsOf(text: string): string[] {
  return [...new Set(Array.from(text.matchAll(/\{([A-Za-z0-9_]+)\}/g), (match) => match[1]!))];
}
