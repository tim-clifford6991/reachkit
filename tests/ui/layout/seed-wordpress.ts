// A SaaS whose WordPress was set up without its credentials, with its first page in review: `/app`'s WordPress connect
// state. Its address is declared in `seed.ts`'s `EMAIL_OF`, under the same user id.
import type { AppAccount } from "@/app/(account)/app/_session/account";
import { seedSite, sql, WEEK_ZERO_PUBLISHING } from "./seed";

export const WORDPRESS_UNCONNECTED_ACCOUNT: AppAccount = Object.freeze({
  userId: "00000000-0000-0000-0000-0000000000a7",
  siteId: "00000000-0000-0000-0000-0000000000b7",
  domain: "acmecrm.test",
  createdAt: new Date("2026-08-31T06:00:00.000Z"),
  timeZone: "Europe/London",
  mode: "autopilot",
});

export const WORDPRESS_UNCONNECTED_DRAFT_ID = "00000000-0000-0000-0000-0000000000d7";

export function seedWordPressUnconnectedAccount(): void {
  seedSite(WORDPRESS_UNCONNECTED_ACCOUNT, {
    drafts: [{ id: WORDPRESS_UNCONNECTED_DRAFT_ID, state: "in_review", title: "How teams pick a CRM for a five-person sales team", scheduledIn: 0 }],
    publishing: WEEK_ZERO_PUBLISHING,
  });
  sql(
    `insert into destinations (site_id, kind, config, health, health_reason) values ` +
      `('${WORDPRESS_UNCONNECTED_ACCOUNT.siteId}', 'wordpress', null, 'expired', 'never_connected');`
  );
}
