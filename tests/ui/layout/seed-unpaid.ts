// A paying customer with a page in review and a running window: the one account whose billing the unpaid-times case
// moves, so no other layout file reads it mid-run. Its address is in `seed.ts`'s `EMAIL_OF`.
import type { AppAccount } from "@/app/(account)/app/_session/account";
import { seedSite, sql, WEEK_ZERO_PUBLISHING } from "./seed";

export const UNPAID_ACCOUNT: AppAccount = Object.freeze({
  userId: "00000000-0000-0000-0000-0000000000aa",
  siteId: "00000000-0000-0000-0000-0000000000ba",
  domain: "northsidebakery.test",
  createdAt: new Date("2026-08-31T06:00:00.000Z"),
  timeZone: "America/Chicago",
  mode: "autopilot",
});

export const UNPAID_DRAFT_ID = "00000000-0000-0000-0000-0000000000da";

export function seedUnpaidAccount(): void {
  seedSite(UNPAID_ACCOUNT, {
    drafts: [{ id: UNPAID_DRAFT_ID, state: "in_review", title: "Sourdough classes near you", scheduledIn: 1 }],
    publish: true,
    publishing: WEEK_ZERO_PUBLISHING,
  });
  // A window that runs past the sweep's clock, so a paid site states when the page goes live.
  sql(`update drafts set veto_deadline = '2026-09-09T12:00:00.000Z' where id = '${UNPAID_DRAFT_ID}';`);
}
