// A local business whose week planned a new page for tomorrow, filled instead by an update of a live page written from
// stored research: `/app/calendar`'s "Now an update" row and its panel line. Its address is in `seed.ts`'s `EMAIL_OF`.
import type { AppAccount } from "@/app/(account)/app/_session/account";
import { seedSite, sql, WEEK_ZERO_PUBLISHING } from "./seed";
import { scheduledFor } from "./seed-rows";

export const BECAME_UPDATE_ACCOUNT: AppAccount = Object.freeze({
  userId: "00000000-0000-0000-0000-0000000000a9",
  siteId: "00000000-0000-0000-0000-0000000000b9",
  domain: "harborplumbing.test",
  createdAt: new Date("2026-08-31T06:00:00.000Z"),
  timeZone: "America/Chicago",
  mode: "autopilot",
});

/** The date the plan changed on. */
export const BECAME_UPDATE_DAY = scheduledFor(1);

export function seedBecameUpdateAccount(): void {
  const { siteId } = BECAME_UPDATE_ACCOUNT;
  seedSite(BECAME_UPDATE_ACCOUNT, {
    drafts: [{ id: "00000000-0000-0000-0000-0000000000d9", state: "in_review", title: "Water heater repair in Austin", scheduledIn: 1, meta: { fallbackFor: "generate:no_opportunity", research: "stored" } }],
    publish: true,
    publishing: WEEK_ZERO_PUBLISHING,
  });
  // The row the week committed for that date: a new page, which the update took the place of.
  sql(
    `insert into opportunities (site_id, scan_id, type, family, target_query, target_ref, proposed_slug, title, volume, fit_band, effort, evidence, acceptance, plan_place, planned_for) ` +
      `select site_id, scan_id, type, family, 'tankless water heater cost', 'planned-1', 'planned-1', 'Tankless water heater cost', volume, fit_band, effort, evidence, acceptance, 1, '${BECAME_UPDATE_DAY}' ` +
      `from opportunities where site_id = '${siteId}' limit 1;`
  );
}
