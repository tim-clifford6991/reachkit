/**
 * WO-283: every test file that resets the one live scratch schema, declared
 * once so the `db` project's `include` and the `node` project's `exclude`
 * cannot diverge again — that divergence (four files hand-copied into both
 * lists while two more were added to neither) is the defect WO-276's
 * author of that order found and this order fixes. A listed path that matches no
 * file on disk (`tests/costs/**`, `tests/measure/verdict/constraint.test.ts`
 * before WO-276 and WO-277 respectively merge) is not an error: these are
 * glob patterns evaluated against whatever files exist, not a manifest
 * that must resolve. `constraint.test.ts` belongs here on the same
 * grounds as the rest — WO-277's author independently found the same
 * gap the same day (rule 4.2) and folded it into this list rather than
 * re-opening a second hand-maintained copy. `scripts/ci-changes.mjs` reads
 * it too, so a pull request that changes one of these files runs `schema · RLS`.
 */
export const LIVE_SCHEMA_TESTS = [
  "tests/db/baseline.test.ts",
  "tests/db/rls.test.ts",
  "tests/db/clients.test.ts",
  "tests/scan/free/admission-claim.test.ts",
  "tests/scan/free/schema.test.ts",
  "tests/account/columns.test.ts",
  "tests/costs/fetches-schema.test.ts",
  "tests/costs/context.test.ts",
  "tests/measure/verdict/constraint.test.ts",
  "tests/scan/report/schema.test.ts",
  // Issue #78, landed with #6: every suite that had to assert migration
  // *text* because this file was out of a feature PR's reach. Each is now a
  // live-schema suite, so the row is what makes it run at all.
  "tests/db/domainblocks.test.ts",
  "tests/mail/leads/migration.test.ts",
  "tests/opportunities/schema.test.ts",
  "tests/opportunities/verdicts/schema.test.ts",
  "tests/scan/weekly/schema.test.ts",
  "tests/publish/attempt/schema.test.ts",
  "tests/publish/publishable/schema.test.ts",
  "tests/publish/setup/schema.test.ts",
  // Issue #926: `site_profile_edits`, its four checks and the four RLS
  // policies this migration adds — which `tests/db/rls.test.ts` does not
  // apply, because it applies the baseline and the base policies only.
  "tests/site-profile/business-edits-schema.test.ts",
  // Issue #921: `publication_reads` — its two closed sets, the
  // insert-or-increment that is also the retention sweep, and the one
  // select-own policy this migration adds.
  "tests/publish/reads/schema.test.ts",
  // Issue #1004: `llm_mention_reads` and `llm_mentions` — one read per site
  // per Monday, the four statuses, the foreign key that makes a mention
  // without its week unrepresentable, and RLS on with no policy on either.
  "tests/mentions/schema.test.ts",
  // Issue #1069: `free_scan_listing` — what the gallery and the landing's
  // strip may show (never a removed or refused site) — and the logo checks.
  "tests/scan/gallery/listing.test.ts",
  // Issue 1433: `rescore_runs`, `report_md5` and the guarded `rescore_scan`.
  "tests/scan/report/rescore-schema.test.ts",
  // Issue 1455: every draft day, per site, and its once-a-date alert.
  "tests/publish/daily/days-schema.test.ts",
  // Issue 1958: one owner mail per failing job, error class and Berlin day.
  "tests/jobs/error-mails-schema.test.ts",
  // Issue 1483: no `public` function a session can execute unless
  // allow-listed, the closed default, and every policy's `(select auth.uid())`.
  "tests/db/function-privileges.test.ts",
  // Issue 1478: every ledger row's site, activity, draft and outcome, the
  // roll-ups derived from the ledger, `vendor_days` and `cost_site_day`.
  "tests/costs/attribution-schema.test.ts",
];
