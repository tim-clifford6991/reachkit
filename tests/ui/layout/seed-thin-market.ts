// A first-week site whose deep pass found no searches: `/app`'s market-too-small notice with its broader-market choice.
// Its address is declared in `seed.ts`'s `EMAIL_OF`, under the same user id.
import type { AppAccount } from "@/app/(account)/app/_session/account";
import { measured, measuredZero } from "@/lib/measure/measured";
import type { CanonicalDomain } from "@/lib/scan/domain";
import { assembleReport } from "@/lib/scan/store";
import { VERDICT, fullSections } from "../../scan/report/fixtures";
import { seedSite, sql, WEEK_ZERO_PUBLISHING } from "./seed";

export const THIN_MARKET_ACCOUNT: AppAccount = Object.freeze({
  userId: "00000000-0000-0000-0000-0000000000a8",
  siteId: "00000000-0000-0000-0000-0000000000b8",
  domain: "thinmarket.test",
  createdAt: new Date("2026-08-31T06:00:00.000Z"),
  timeZone: "America/New_York",
  mode: "autopilot",
});

export function seedThinMarketAccount(): void {
  const { siteId, domain } = THIN_MARKET_ACCOUNT;
  seedSite(THIN_MARKET_ACCOUNT, { drafts: [], publish: true, publishing: WEEK_ZERO_PUBLISHING });
  const at = new Date("2026-08-31T09:00:00.000Z");
  const report = assembleReport({
    ...fullSections(),
    domain: domain as CanonicalDomain,
    tier: "deep",
    verdict: { ...VERDICT, domain: domain as CanonicalDomain, measuredAt: at, scoreAndBand: { kind: "unmeasured", reason: "not_attempted", at } },
    questions: measuredZero([], at),
    ownRanked: measured(0, at),
    rivalSizes: { kind: "unmeasured", reason: "not_attempted", at },
    aiAnswers: null,
  });
  // Current, so `releaseNotice` reads it: a complete pass whose market held no question.
  sql(
    `update scans set is_current = true, report = '${JSON.stringify(report).replaceAll("'", "''")}'::jsonb, created_at = '${at.toISOString()}' ` +
      `where site_id = '${siteId}' and tier = 'deep';`
  );
}
