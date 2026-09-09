// tests/ui/layout/seed.ts — BUILD §2, §4.3 (issue #193)
//
// The layout conformance job's database: the migrations, one account, and
// a session cookie a real sign-in would have produced.
//
// **Why this file exists.** Since #192 the four `/app` screens verify the
// session against the `users` row, so a fixture cookie no longer gets the
// sweep past `requireAppAccount()` — every `(account)` address answered
// `/signin` and the sweep measured the sign-in prompt at five widths and
// called it the screen (`tests/app/session/account.test.ts` recorded the
// loss). The substrate #164 put in the repository is what closes it: the
// same `postgres:18` service and `scripts/db-substrate/up.sh` the `db`
// vitest project runs against.
//
// **The account is `RESERVED_ACCOUNT`, and that is the point.** It is the
// same account the presentation sweeps sign in as (`tests/app/accounts.ts`),
// so the two sweeps measure one door rather than two. Every `/app` surface
// asks `isReservedFixtureAccount()` and draws its fixture for it, which is
// what makes the sweep *deterministic*: the screens are the real
// components in their real layout, filled with the densest content each
// can hold, and no provider makes a live read on the render path. A
// non-reserved account would put five widths × four screens behind every
// provider's database read, and a read that hangs is indistinguishable
// from a broken screen (the reason `gate-state.ts` bounds its own).
//
// **The session is minted through identity's own path**, not assembled
// here: `issueLink` writes a row, `redeemLink` spends it and returns the
// claims, and `sessionCookie` turns those claims into the cookie the
// redemption route sets. A cookie this file signed itself would prove the
// sweep can reach the screens and nothing about whether a real sign-in
// can.
// **One run, one database** (#220). `applyMigrations` below drops and
// rebuilds `public`, so two runs sharing a database delete each other's rows
// mid-flight: this file's seeded account vanishes and every `/app` address
// redirects to `/signin`, which reads exactly like a broken screen rather
// than like contention. Locally, start the substrate with
// `eval "$(scripts/db-substrate/up.sh --run)"` — it gives this worktree its
// own database and its own ports, and the constants below read them out of
// the environment. No lock is needed. CI passes no `--run` and needs none:
// one job, one runner, one `postgres:18` service container.
import { readdirSync } from "node:fs";
import path from "node:path";
import { LIVE_ACCOUNT, RESERVED_ACCOUNT, WEEK_ZERO_ACCOUNT } from "../../app/accounts";
import { VERDICT, fullSections } from "../../scan/report/fixtures";
import { bandRivalSize } from "@/lib/market/rivals/band";
import { measured } from "@/lib/measure/measured";
import type { CanonicalDomain } from "@/lib/scan/domain";
import { assembleReport } from "@/lib/scan/store";
import { previousWeekStart, weekStartFor } from "@/lib/scan/weekly";
import type { AppAccount } from "@/app/(account)/app/_session/account";
import {
  psql,
} from "../../db/substrate";
import {
  acceptanceFor,
  ACCESS_ENDS_ON,
  LIVE_DRAFTS,
  PUBLISHER_PAGE,
  scheduledFor,
  seededVolume,
  SETUP_COMPLETED_ON,
  sweepNow,
  writeEvidence,
} from "./seed-rows";


const ROOT = path.resolve(__dirname, "../../..");
const MIGRATIONS_DIR = path.join(ROOT, "supabase/migrations");


/**
 * The third account: paid, and **still in setup** (issue #272).
 *
 * `/setup` and `/setup/waiting` were photographed signed out only, and
 * signing the sweep in as either of the two accounts above does not fix
 * that — it removes the screens altogether. Both have `setup_completed_at`
 * set, and REQ-025 c4 is emphatic about what that means: "a founder who has
 * answered them is never asked again". `setupRedirectFor` sends `/setup` to
 * `/app` for them, and `waiting/release.ts` releases them off
 * `/setup/waiting` the moment `TIMING.deepReleaseMin` has passed since the
 * stamp — so a picture taken as the reserved account would be a picture of
 * `/app` under a setup name, and a picture of the waiting screen would stop
 * being one ten minutes into any run slow enough to reach it late.
 *
 * The state those two screens exist in is a founder who has paid and has
 * not finished setup, and this is that founder. `setup_completed_at` is
 * null, which is also what makes the pair **time-independent**: `isReleased`
 * returns unreleased without latching anything when the stamp is absent, so
 * the waiting screen renders the same frame on the first second of a run and
 * the last.
 */
export const SETUP_ACCOUNT: AppAccount = Object.freeze({
  userId: "00000000-0000-0000-0000-0000000000a3",
  siteId: "00000000-0000-0000-0000-0000000000b3",
  // A domain no fixture answers for, like the live account's: setup reads
  // the founder's own rows and has no fixture branch at all
  // (`_setup/provider.ts` says why — the domain is the thing being set).
  domain: "newco.test",
  createdAt: new Date("2026-09-05T06:00:00.000Z"),
  timeZone: "America/New_York",
  mode: "autopilot",
});

/**
 * The fifth account: the customer whose page the hosted edge serves
 * (issue #418).
 *
 * **A site of its own, and that is the point.** S19 is drawn from a
 * *published page*, and the sweep's four other accounts each hold a
 * different `/app` state that its baselines are the record of — adding a
 * live publication to any of them would move pictures this issue is not
 * about. This one exists only to be published from: nothing signs in as it,
 * no `/app` address is photographed through it, and its every value is
 * chosen so the hosted page draws its densest arm.
 *
 * `publisher.test` names the role rather than a brand, like `newco.test`
 * and `firstweek.test` — and the domain **is** the brand on this surface
 * (`HostedPublisher.name`: the one identity fact this product holds), so it
 * is what the bar, the byline and the footer say.
 */
export const PUBLISHER_ACCOUNT: AppAccount = Object.freeze({
  userId: "00000000-0000-0000-0000-0000000000a5",
  siteId: "00000000-0000-0000-0000-0000000000b5",
  domain: "publisher.test",
  createdAt: new Date("2026-08-17T06:00:00.000Z"),
  // A stated zone (REQ-073 c1), and the one the byline's date is written
  // in: `2026-09-04T09:00:00Z` is 4 Sep here, which is the day S19 draws.
  timeZone: "America/New_York",
  mode: "autopilot",
});

/**
 * The step the setup account's pass is on, and when each step began.
 *
 * `scoring` puts the pass on the **third** of UI-SPEC S11's five drawn rows
 * (`_setup/stages.ts`), which is the state the set draws: two rows finished
 * and timed, one under way, two still to come. A stage with rows on both
 * sides of it is the only one that photographs the finished arm and the
 * pending arm together; `passProgressFor` falls back to the first stage
 * when the column is null, which would leave four pending rows and nothing
 * to measure.
 *
 * The instants are what make the drawn durations real rather than typed: a
 * row's elapsed time is the gap between its own first handle and the next
 * row's, so `checking_your_presence` at 41 s closes row one and `scoring`
 * at 59 s closes row two 18 s later — the two figures S11 prints. Fixed
 * instants, so the picture is of one pass and not of the minute the sweep
 * ran in (the same rule the seed's other dates follow).
 */
const SETUP_STAGE = "scoring";
const SETUP_PASS_BEGAN = Date.UTC(2026, 8, 5, 9, 31, 0);
const setupStageAt = (secondsIn: number): string =>
  new Date(SETUP_PASS_BEGAN + secondsIn * 1000).toISOString();
const SETUP_STAGE_TIMES = {
  reading_your_site: setupStageAt(0),
  reading_access_rules: setupStageAt(9),
  reading_your_market: setupStageAt(17),
  checking_your_presence: setupStageAt(41),
  asking_the_twelve: setupStageAt(48),
  scoring: setupStageAt(59),
};

/** The measured report behind the setup account's address, and the score
 *  its column and its blob both have to state (`scans_verdict_score_consistency`).
 *  Fixed rather than derived: nothing on the setup screen renders either
 *  number, and a picture is only a baseline if it is the same every run. */
const SETUP_REPORT_AT = "2026-09-05T09:00:00.000Z";
const SETUP_REPORT_SCORE = 44;

/** Each account's own address. Never mailed: `issueLink` writes the row and
 *  this file redeems the token straight out of the returned URL. */
const EMAIL_OF: Readonly<Record<string, string>> = {
  [RESERVED_ACCOUNT.userId]: "layout-sweep@example.com",
  [LIVE_ACCOUNT.userId]: "layout-sweep-live@example.com",
  [SETUP_ACCOUNT.userId]: "layout-sweep-setup@example.com",
  [WEEK_ZERO_ACCOUNT.userId]: "layout-sweep-week0@example.com",
  [PUBLISHER_ACCOUNT.userId]: "layout-sweep-publisher@example.com",
};

/** Kept for the callers that named it before there were two accounts. */
const SEEDED_EMAIL = EMAIL_OF[RESERVED_ACCOUNT.userId] as string;

/** The draft row the seeded site owns. The sweep's `[draftId]` fixture is
 *  **not** this id and must not become it: `readDraft` answers the reserved
 *  account from `FIXTURE_DRAFTS`, whose `in_review` draft is the densest
 *  arm that address can render (`routes.ts` says why). This row exists so
 *  the seeded site is a whole site — an account with a scan, an
 *  opportunity and a page — rather than a shell with a session on it. */
const SEEDED_DRAFT_ID = "00000000-0000-0000-0000-0000000000d1";

/**
 * The publishing settings the live account has actually chosen (#228).
 *
 * Every one of these is a column `readSettings` used to spread off
 * `FIXTURE_SETTINGS_FACTS` for any account at all: until #228 the settings
 * screen stated the fixture's mode, veto window, publish time, voice and
 * do-not-claim list to a real customer. They are stated here so the live
 * pass renders **chosen** values rather than the columns' own defaults —
 * settings a customer never chose are what this seed exists to stop being
 * indistinguishable from settings they did.
 *
 * `copilot` rather than `autopilot`, and a window that is not 24 hours, so
 * the pair sentence the screen writes (`explainPair`) is a different one
 * from the reserved pass's and both arms get measured.
 */
/** One site's §4.7 publishing row, as these seeds write it. Named rather
 *  than `typeof LIVE_PUBLISHING`: the two accounts differ in mode, and a
 *  type taken off one literal makes the other's mode a compile error. */
interface PublishingRow {
  mode: string;
  vetoHours: number;
  publishTime: string;
  enabled: boolean;
  voiceText: string;
  doNotClaim: readonly string[];
  category: string;
  competitors: readonly string[];
}

/** UI-SPEC S13's sidebar draws the mode as **Autopilot** with the switch
 *  on, so the week-0 account's row says so. `LIVE_PUBLISHING` is copilot —
 *  which is the right arm for the live account's own screens, and the wrong
 *  picture for this one. Everything else is shared: the two accounts differ
 *  in what has been measured, not in how they are set up. */
const WEEK_ZERO_PUBLISHING = Object.freeze({
  mode: "autopilot",
  vetoHours: 24,
  publishTime: "07:00",
  enabled: true,
  voiceText: "Plain, specific, and never louder than the evidence.",
  doNotClaim: ["the fastest onboarding on the market"],
  category: "user onboarding software",
  competitors: ["asana.com", "notion.so"],
});

/** The publisher site's §4.7 row. Only `category` is drawn — it is S19's
 *  eyebrow, off `sites.category` — and the rest is stated because a site
 *  that has published a page has certainly answered setup. `competitors`
 *  and `doNotClaim` are this customer's own, not the live account's, so no
 *  reader can mistake the two sites for one. */
const PUBLISHER_PUBLISHING = Object.freeze({
  mode: "autopilot",
  vetoHours: 24,
  publishTime: "07:00",
  enabled: true,
  voiceText: "Plain, specific, and never louder than the evidence.",
  doNotClaim: ["the only onboarding tool you will ever need"],
  category: PUBLISHER_PAGE.category,
  competitors: ["appcues.com", "userpilot.com"],
});

const LIVE_PUBLISHING = Object.freeze({
  mode: "copilot",
  vetoHours: 36,
  publishTime: "07:30",
  enabled: true,
  voiceText: "Plain, specific, and never louder than the evidence.",
  doNotClaim: ["the fastest onboarding on the market"],
  category: "user onboarding software",
  competitors: ["asana.com", "notion.so"],
});

/** The live account's draft address — the one the live sweep renders. */
export const LIVE_DRAFT_ID = LIVE_DRAFTS[0]?.id as string;

/** UI-SPEC S13's one draft, the first page waiting on its customer. */
export const WEEK_ZERO_DRAFT_ID = "00000000-0000-0000-0000-0000000000d4";
/** The set's own first point: the deep pass read twelve searches. */
export const WEEK_ZERO_OWN_RANKED = 12;
/** The day the deep pass ran, as the card's chip states it. Fixed, so the
 *  baseline is a picture of one date and not of the day it was taken. */
const DEEP_PASS_ON = "2026-08-31";

/**
 * How many weekly measurements the live account carries (issue #213).
 *
 * Three, for the same reason `LIVE_DRAFTS` has three states: a series needs
 * more than a point to be a series, and `/app`'s two measurement tiles draw
 * a **delta** only where there is a previous week to compare against — the
 * denser arm, and therefore the one the layout law has to hold for. One
 * week would leave both tiles carrying a goal and would measure the wrong
 * frame.
 *
 * Fewer than `OVERVIEW_TRAILING_WEEKS` on purpose: the window is twelve, so
 * three measured weeks also exercises the padding the AI matrix does at the
 * front of a window a customer has not filled.
 */
const LIVE_MEASURED_WEEKS = 3;

/** The figures each seeded week carries, oldest first: a customer whose
 *  ranked count is rising and who is named in AI answers more often. Rising
 *  rather than flat because `/app`'s head states a direction, and a flat
 *  series draws the arm that says nothing moved. */
const LIVE_WEEK_FIGURES: readonly { ownRanked: number; citations: number }[] = Object.freeze([
  { ownRanked: 12, citations: 0 },
  { ownRanked: 28, citations: 1 },
  { ownRanked: 41, citations: 2 },
]);

/**
 * The rivals this account tracks, and what each week sized them at
 * (issue #223).
 *
 * **Two, and deliberately on different bands.** Against the latest own
 * count of 41 the bars are `max(100, 2×41) = 100` and
 * `max(500, 5×41) = 500`, so `bigcompetitor.com` lands `far` and
 * `similar.io` lands `middle` — which is the frame REQ-096 c6 is about: one
 * rival beyond reach among rivals that are not. Sizing both `far` would
 * make the sweep measure a module every row of which carries an offer,
 * which is not the ordinary screen.
 *
 * The counts fall week on week while the customer's own count rises, so the
 * ratio arm draws what §4.5 describes — a line pointing down.
 */
const LIVE_RIVALS: readonly { domain: string; weekly: readonly number[] }[] = Object.freeze([
  { domain: "bigcompetitor.com", weekly: Object.freeze([6500, 6400, 6318]) },
  { domain: "similar.io", weekly: Object.freeze([150, 145, 140]) },
]);
function sql(statement: string): void {
  psql(["-v", "ON_ERROR_STOP=1", "-c", statement]);
}

/**
 * Every migration, in name order, onto a fresh `public`.
 *
 * The whole set rather than a chosen few: this database is what the built
 * app itself talks to, and a screen reads whatever it reads. `supabase db
 * reset` is not available (owner ruling 2026-09-02, no Docker on the
 * owner's machine), and this is the same `psql` loop `scripts/db-substrate`
 * and every live-schema suite already use.
 */
export function applyMigrations(): void {
  sql("drop schema public cascade; create schema public; grant usage on schema public to anon, authenticated, service_role;");
  for (const file of readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith(".sql")).sort()) {
    psql(["-v", "ON_ERROR_STOP=1", "-f", path.join(MIGRATIONS_DIR, file)]);
  }
  reloadPostgrestSchemaCache();
}

/**
 * Waits until PostgREST is actually serving the schema that was just
 * applied.
 *
 * `NOTIFY` is asynchronous, so the reload is in flight when it returns and
 * a sleep would be a guess. This asks the one question that distinguishes
 * the old cache from the new — a table only these migrations create — and
 * stops as soon as it is answered.
 */
export async function waitForSchemaCache(timeoutMs = 30_000): Promise<void> {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (base === undefined || key === undefined) {
    throw new Error(
      "tests/ui/layout/seed.ts: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must name the substrate " +
        "before the layout sweep runs — the sweep signs in against it. `scripts/db-substrate/up.sh` " +
        "prints both."
    );
  }
  const deadline = Date.now() + timeoutMs;
  const url = `${base}/rest/v1/auth_links?select=token_hash&limit=1`;
  for (;;) {
    const answered = await fetch(url, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
      .then((response) => response.ok)
      .catch(() => false);
    if (answered) return;
    if (Date.now() > deadline) {
      throw new Error(
        "tests/ui/layout/seed.ts: PostgREST never picked up the migrated schema. It caches the " +
          "schema at connect and `up.sh` starts it before the migrations run, so a `NOTIFY pgrst, " +
          "'reload schema'` is what refreshes it — if that channel is disabled this will never pass."
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

/**
 * Tells PostgREST the schema changed.
 *
 * It caches the schema at connect, and `up.sh` starts it **before** these
 * migrations run — so without this every table created above is invisible
 * over REST and the first write answers `PGRST205: Could not find the
 * table 'public.auth_links' in the schema cache`. That is not a substrate
 * defect and not something a retry fixes: the vendor documents this
 * `NOTIFY` as the reload signal, and a schema that changed under a running
 * instance is exactly what it is for.
 *
 * Announced through the database rather than by signalling a process,
 * because the process is a container in CI and a native binary on a
 * machine without Docker, and `psql` reaches both the same way.
 */
function reloadPostgrestSchemaCache(): void {
  sql("notify pgrst, 'reload schema';");
}

/**
 * One account, exactly as §4.3 requires the sweep's account to be: a site
 * with a **stated** zone (REQ-073 c1 forbids one the customer never chose),
 * setup completed so the gate lets every `/app` address through, and access
 * that has not ended so `hasActiveAccess()` is true.
 *
 * Ids are `RESERVED_ACCOUNT`'s own, so the row the session names and the
 * account the presentation sweeps render as are the same account.
 */
export function seedAccount(): void {
  seedSite(RESERVED_ACCOUNT, { drafts: [{ id: SEEDED_DRAFT_ID, state: "in_review", title: "Best onboarding tools" }] });
}

/**
 * The second account, and the one the live branch is measured as (#206).
 *
 * `LIVE_ACCOUNT`'s domain is one no fixture answers for, so every `/app`
 * provider takes its database read rather than its fixture — which is the
 * whole point: until now no provider's live read was ever rendered under a
 * browser at any width. It gets drafts in three states, a publication and
 * a destination so each of those reads returns rows rather than an empty
 * arm.
 */
export function seedLiveAccount(): void {
  seedSite(LIVE_ACCOUNT, {
    drafts: LIVE_DRAFTS,
    publish: true,
    rivals: LIVE_RIVALS,
    publishing: LIVE_PUBLISHING,
  });
  seedMeasuredWeeks(LIVE_ACCOUNT);
}

/**
 * The customer in their first week (issue #353) — UI-SPEC S13.
 *
 * The deep pass has read their market once and no weekly pass has run, so
 * `/app` answers with the week-0 arm: the head's own line, the deep pass's
 * single point on the chart, three tiles stating when their readings
 * arrive, the rivals card stating when sizing arrives, and the sidebar's
 * "First page after the deep pass".
 *
 * **`seedMeasuredWeeks` is deliberately not called.** That function writes
 * `tier = 'weekly'` scans, which is exactly what this account must not
 * have — one weekly week and the screen is the ordinary arm.
 *
 * What it does need is a report on the **deep** scan `seedSite` already
 * writes: that row goes in report-less, and `deepPassReading` reads only a
 * deep scan that carries one. The reading is `ownRanked` 12, which is the
 * set's own first point.
 *
 * One draft in review, so "Needs you" has the first page in it — the set
 * draws exactly that, and it is the same panel S12 uses, so no second code
 * path is being pictured.
 */
export function seedWeekZeroAccount(): void {
  const { siteId, domain } = WEEK_ZERO_ACCOUNT;
  seedSite(WEEK_ZERO_ACCOUNT, {
    drafts: [{ id: WEEK_ZERO_DRAFT_ID, state: "in_review", title: "How teams pick an onboarding tool" }],
    publishing: WEEK_ZERO_PUBLISHING,
  });

  // The deep pass's own reading, on the deep scan `seedSite` wrote. Its
  // `scoreAndBand` is unmeasured: a deep pass reads the market, and the
  // weekly score is the weekly pass's — which is the whole reason S13's
  // score tile shows a dash with its first-due date under it. The
  // `scans_verdict_score_consistency` constraint is satisfied by leaving
  // the `score` column null beside it.
  const measuredAt = new Date(`${DEEP_PASS_ON}T09:00:00.000Z`);
  const base = fullSections();
  const report = assembleReport({
    ...base,
    domain: domain as CanonicalDomain,
    tier: "deep",
    verdict: {
      ...VERDICT,
      domain: domain as CanonicalDomain,
      measuredAt,
      scoreAndBand: { kind: "unmeasured", reason: "not_attempted", at: measuredAt },
    },
    ownRanked: measured(WEEK_ZERO_OWN_RANKED, measuredAt),
    rivalSizes: { kind: "unmeasured", reason: "not_attempted", at: measuredAt },
    aiAnswers: null,
  });
  sql(
    `update scans set report = '${JSON.stringify(report).replaceAll("'", "''")}'::jsonb, ` +
      `created_at = '${measuredAt.toISOString()}' ` +
      `where site_id = '${siteId}' and tier = 'deep';`
  );
}

/**
 * The customer whose page the hosted edge serves (issue #418).
 *
 * **What was broken.** `/hosted-page/{slug}` resolves its customer from the
 * `Host` header, and the sweep sent `content.example.com` — the reserved
 * account's domain, a site that has published nothing. The route did the
 * right thing and answered 404, so every capture of S19 was the not-found
 * screen and the CI render composed the approved hosted page beside an
 * empty white frame (#416's run). This seeds the page that host was
 * missing, on a site of its own so no other baseline moves.
 *
 * **Everything S19 draws comes from these rows**: the bar's name and the
 * footer line are the domain, the eyebrow is `sites.category`, the byline's
 * date is `publications.published_at` written in the site's zone, the body
 * is `drafts.body_md` with `grounded_fact`'s passage marked inside it, the
 * source line under it is that record's address and date, and the canonical
 * note is composed from the domain and the slug. Nothing on the surface is
 * a fixture branch: this is the same live read a visitor's request makes.
 *
 * The 404 arm keeps its own picture — `routes.ts`'s `HOST_FIXTURES` still
 * sends `content.example.com`, which still resolves to a site that has
 * published no page at this address.
 */
export function seedHostedPublisher(): void {
  seedSite(PUBLISHER_ACCOUNT, {
    drafts: [
      {
        id: PUBLISHER_PAGE.draftId,
        state: "published",
        title: PUBLISHER_PAGE.title,
        bodyMd: PUBLISHER_PAGE.bodyMd,
        meta: { faq: PUBLISHER_PAGE.faq },
        groundedFact: PUBLISHER_PAGE.grounded,
      },
    ],
    publish: true,
    published: { slug: PUBLISHER_PAGE.slug, at: PUBLISHER_PAGE.publishedAt },
    publishing: PUBLISHER_PUBLISHING,
  });
}

/**
 * The founder who is still in setup (issue #272), and the report their
 * address already has behind it.
 *
 * Written here rather than through `seedSite` because every one of that
 * function's promises is the opposite of what these two screens need: it
 * stamps `setup_completed_at` so the gate lets `/app` through, and it gives
 * the site a scan, an opportunity and a draft — a site that has been running
 * for a while. This account has paid, has answered nothing, and has a deep
 * pass under way. `plan_status` and `paid_through` are the reserved
 * account's, because a founder on the setup screen has certainly paid
 * (§4.3: "post-payment, once") and `hasActiveAccess()` has to be true for
 * them.
 *
 * The report is REQ-021 c6 versus c7: `readSetupScreen` reads the completed
 * report for the address this account will use, and with one there the
 * market card renders its inferred arm and the address field is filled —
 * the denser of the two, and therefore the one the layout law has to hold
 * for. Without it the screen is legal and emptier, which is a picture of
 * less.
 */
export function seedSetupAccount(): void {
  const { userId, siteId, domain, timeZone } = SETUP_ACCOUNT;
  const email = EMAIL_OF[userId];
  if (email === undefined) {
    throw new Error(`tests/ui/layout/seed.ts: no address is declared for the account ${userId}.`);
  }

  sql(
    `insert into users (id, email, plan_status, paid_through) values ` +
      `('${userId}', '${email}', 'active', '${ACCESS_ENDS_ON}');`
  );
  // No `setup_completed_at`, and that is the whole state: the gate reads
  // this column and nothing else to decide that this founder belongs on
  // `/setup`, and `isReleased` reads it to decide that no deadline has begun
  // to run.
  sql(
    `insert into sites (id, user_id, domain, timezone, setup_stage, setup_stage_times) values ` +
      `('${siteId}', '${userId}', '${domain}', '${timeZone}', '${SETUP_STAGE}', ` +
      `'${JSON.stringify(SETUP_STAGE_TIMES)}'::jsonb);`
  );

  const measuredAt = new Date(SETUP_REPORT_AT);
  const base = fullSections();
  const report = assembleReport({
    ...base,
    domain: domain as CanonicalDomain,
    tier: "deep",
    verdict: {
      ...VERDICT,
      domain: domain as CanonicalDomain,
      measuredAt,
      scoreAndBand: measured({ score: SETUP_REPORT_SCORE, band: "hard-to-find" }, measuredAt),
    },
  });
  // `is_current` is what `readCurrentReport` selects on — a stored report
  // no row flags as current is a report the setup screen cannot see.
  sql(
    `insert into scans (site_id, domain, tier, status, score, is_current, created_at, report) values ` +
      `('${siteId}', '${domain}', 'deep', 'done', ${SETUP_REPORT_SCORE}, true, ` +
      `'${measuredAt.toISOString()}', '${JSON.stringify(report).replaceAll("'", "''")}'::jsonb);`
  );
}

/**
 * The live account's measured weeks — §11's own rows, as the tick would
 * have written them (issue #213).
 *
 * **Why the sweep needs them.** `readOverviewFacts` reads the stored weekly
 * scans; a live account with none draws the unmeasured arm of both
 * measurement tiles, whose `stat-desc` is a whole sentence of product copy
 * and whose box that sentence overflows (#211). This sweep is here to
 * measure the layout of the screen a customer sees, and a customer with a
 * measured week is the ordinary one — so the account carries weeks, and the
 * densest arm of each tile is what gets measured.
 *
 * **The blob is the real one.** `assembleReport` over `fullSections()`
 * rather than a hand-written object: every screen reading this row reads a
 * report of the shape the pipeline actually stores, so a reader added later
 * finds the field it expects instead of a hole this file did not know to
 * fill.
 *
 * The Mondays are the site's own (`weekStartFor`), stepping back with
 * `previousWeekStart`, so the week keys here are the same ones the screen
 * computes when it reads them back.
 */
function seedMeasuredWeeks(account: AppAccount): void {
  const { domain, siteId, timeZone } = account;
  if (timeZone === null) {
    // A site with no stated zone has no local Monday, so no week could be
    // keyed for it (REQ-073 c1). `seedSite` above states one for every
    // account it writes, so this is a contradiction rather than a state.
    throw new Error(`tests/ui/layout/seed.ts: the account ${siteId} states no time zone.`);
  }
  // The sweep's own instant, not the wall clock (issue #305): the overview's
  // window ends at what the app calls today, and the app calls `SWEEP_NOW`
  // today, so the weeks written here are the weeks that screen draws — on
  // any day, including the Monday the wall clock would have moved them.
  const weeks: string[] = [weekStartFor({ at: sweepNow(), zone: timeZone })];
  while (weeks.length < LIVE_MEASURED_WEEKS) weeks.unshift(previousWeekStart(weeks[0] as string));

  for (const [index, weekStart] of weeks.entries()) {
    const figures = LIVE_WEEK_FIGURES[index] ?? LIVE_WEEK_FIGURES[LIVE_WEEK_FIGURES.length - 1]!;
    const measuredAt = new Date(`${weekStart}T09:00:00.000Z`);
    const base = fullSections();
    const score = 31 + index * 9;
    const report = assembleReport({
      ...base,
      domain: domain as CanonicalDomain,
      tier: "weekly",
      // Every date and every domain on the blob is this week's and this
      // account's: a report carrying the fixture's own domain would be a
      // row about somebody else, and `changeMarkers` reads the domain off
      // the scan to decide where a series breaks.
      verdict: {
        ...VERDICT,
        domain: domain as CanonicalDomain,
        measuredAt,
        scoreAndBand: measured({ score, band: "hard-to-find" }, measuredAt),
      },
      ownRanked: measured(figures.ownRanked, measuredAt),
      // §6.6's sizing for the week, with the band **derived** rather than
      // written down: `bandRivalSize` is the one place the two bars live,
      // so a seeded row cannot carry a band the product would not have
      // given it (issue #223).
      rivalSizes: measured(
        LIVE_RIVALS.map((rival) => {
          const rankedCount = rival.weekly[index] ?? (rival.weekly.at(-1) as number);
          return {
            domain: rival.domain,
            state: "sized" as const,
            rankedCount,
            band: bandRivalSize({ rivalRanked: rankedCount, ownRanked: figures.ownRanked }),
            at: measuredAt,
            current: true,
          };
        }),
        measuredAt
      ),
      aiAnswers:
        base.aiAnswers === null
          ? null
          : { ...base.aiAnswers, measuredAt, ownDomain: domain, customerCitations: figures.citations },
    });
    // `scans.score` is not decoration here: `scans_verdict_score_consistency`
    // makes the column and the blob's own `scoreAndBand` agree, so a row
    // with a measured score and a null column is refused by Postgres.
    sql(
      `insert into scans (site_id, domain, tier, status, score, week_start, created_at, report) values ` +
        `('${siteId}', '${domain}', 'weekly', 'done', ${score}, '${weekStart}', '${measuredAt.toISOString()}', ` +
        `'${JSON.stringify(report).replaceAll("'", "''")}'::jsonb);`
    );
  }
}

/**
 * One account with a whole site under it: a measured scan, an opportunity
 * off it, and the drafts the caller asked for. `publishing` states §9's and
 * §4.7's own settings where the caller has them; without it the columns'
 * defaults stand, which is what the reserved account wants (its screen is
 * drawn from its fixture and never reads them).
 *
 * §4.3's requirements are the same for both accounts — a **stated** zone
 * (REQ-073 c1 forbids one the customer never chose), setup completed so
 * the gate lets every `/app` address through, and access that has not
 * ended so `hasActiveAccess()` is true.
 */
function seedSite(
  account: AppAccount,
  opts: {
    /** `scheduledIn` is optional: the reserved account's single draft sits
     *  on no date (its screens are drawn from fixtures), and the live
     *  account's three carry one so the calendar has pages to draw. */
    drafts: readonly {
      id: string;
      state: string;
      title: string;
      scheduledIn?: number;
      /** The page's own body, where the caller has one. The default is a
       *  single line, which is all a `/app` screen ever renders of a draft;
       *  the hosted page renders the whole document, so its fixture states
       *  it (#418). */
      bodyMd?: string;
      /** `drafts.meta` and `drafts.grounded_fact` as the generator writes
       *  them. Absent for every `/app` account deliberately — #268's
       *  omitted arm is the one those baselines hold — and stated by the
       *  publisher, whose page draws the marked passage and its source. */
      meta?: Record<string, unknown>;
      groundedFact?: Record<string, unknown>;
    }[];
    publish?: boolean;
    /** The address the published draft went live at, and when. Without one
     *  the address is the draft's own id at the moment of seeding, which is
     *  all `/app`'s live reads need — and is neither a page slug nor a
     *  fixed date, so the hosted page states both (#418). */
    published?: { slug: string; at: string };
    rivals?: readonly { domain: string; weekly: readonly number[] }[];
    publishing?: PublishingRow;
  }
): void {
  const { userId, siteId, domain, timeZone } = account;
  const email = EMAIL_OF[userId];
  if (email === undefined) {
    throw new Error(`tests/ui/layout/seed.ts: no address is declared for the account ${userId}.`);
  }

  sql(
    `insert into users (id, email, plan_status, paid_through) values ` +
      `('${userId}', '${email}', 'active', '${ACCESS_ENDS_ON}');`
  );
  sql(
    `insert into sites (id, user_id, domain, timezone, setup_completed_at) values ` +
      `('${siteId}', '${userId}', '${domain}', '${timeZone}', '${SETUP_COMPLETED_ON}');`
  );

  const chosen = opts.publishing;
  if (chosen !== undefined) {
    sql(
      `update sites set mode = '${chosen.mode}', veto_hours = ${chosen.vetoHours}, ` +
        `publish_time = '${chosen.publishTime}', publishing_enabled = ${chosen.enabled}, ` +
        `voice_text = '${chosen.voiceText.replaceAll("'", "''")}', ` +
        `do_not_claim = '${JSON.stringify(chosen.doNotClaim).replaceAll("'", "''")}'::jsonb, ` +
        `category = '${chosen.category.replaceAll("'", "''")}', ` +
        `competitors = '${JSON.stringify(chosen.competitors).replaceAll("'", "''")}'::jsonb ` +
        `where id = '${siteId}';`
    );
  }

  const [scanId] = rows(
    `insert into scans (site_id, domain, tier, status) values ('${siteId}', '${domain}', 'deep', 'done') returning id;`
  );

  if (opts.rivals !== undefined && opts.rivals.length > 0) {
    // §4.7's competitors card, and the set §4.5's rival rows are drawn
    // from: the rows are the customer's own answer, so without this the
    // module renders nothing however many weeks were sized (issue #223).
    const list = JSON.stringify(opts.rivals.map((rival) => rival.domain));
    sql(`update sites set competitors = '${list}'::jsonb where id = '${siteId}';`);
  }

  for (const [index, draft] of opts.drafts.entries()) {
    const [opportunityId] = rows(
      `insert into opportunities (site_id, scan_id, type, family, target_query, target_ref, proposed_slug, title, volume, fit_band, effort, evidence, acceptance) values ` +
        // A Write row carries a search and a band; only a Fix row has neither
        // (`opportunities_fit_band_iff_not_fix`). One opportunity per draft,
        // because `opportunities_open_target_uniq` refuses a second open row
        // on the same target.
        //
        // `volume` the column and `volume` inside `evidence` are the same
        // number here, as §10 and `readOpportunity` between them require:
        // the column is what the sorts read, the measurement inside the
        // evidence is what a surface renders, and a seed that wrote one
        // without the other would be a row no scan could have produced.
        `('${siteId}', '${scanId}', 'answer_page', 'write', 'onboarding tools ${index}', 'target-${index}', 'slug-${index}', 'Onboarding tools ${index}', ${seededVolume(index)}, 'winnable', 0.50, '${writeEvidence(index)}'::jsonb, '${acceptanceFor(index)}'::jsonb) returning id;`
    );
    // **No `grounded_fact`, and that is the arm** (issue #268). Generation
    // writes the recorded fact into the `grounded_fact` column (§8 hard
    // rule 1, and issue #415 for where the draft view reads it); a draft
    // seeded without one records no grounding, which is what the draft view
    // used to render as an empty address beside `Dec 31, 1969`. Left empty
    // deliberately so the live sweep photographs the omitted arm rather
    // than only the fixture route's grounded one — the arm the finding was
    // raised against is the arm the baselines hold.
    //
    // The *other* half of #268 — a record with no scan behind it — cannot
    // be seeded at all: `opportunities.scan_id` is `not null references
    // scans (id)`, so no row here can point at a scan that is not there.
    // It is reachable in production through a deleted or unreadable
    // opportunity, and `tests/publish/record/record.test.ts` holds it
    // against the database double instead.
    const bodyMd =
      draft.bodyMd ??
      "A paragraph of body copy, so the draft view renders a page rather than an empty one";
    sql(
      `insert into drafts (id, opportunity_id, site_id, state, title, body_md, meta, grounded_fact, scheduled_for) values ` +
        `('${draft.id}', '${opportunityId}', '${siteId}', '${draft.state}', '${draft.title}', ` +
        `'${quote(bodyMd)}', ${jsonbOrNull(draft.meta)}, ${jsonbOrNull(draft.groundedFact)}, ` +
        `${draft.scheduledIn === undefined ? "null" : `'${scheduledFor(draft.scheduledIn)}'`});`
    );
  }

  if (opts.publish !== true) return;

  // The destination §4.7's card draws, and the publication the overview
  // counts as live. Both are reads that answered nothing before #206 — and
  // since #228 the settings card draws this row for every account but the
  // reserved one, so a live pass without it would measure an empty arm.
  sql(
    `insert into destinations (site_id, kind, config, health) values ('${siteId}', 'hosted', null, 'ok');`
  );
  const published = opts.drafts.find((draft) => draft.state === "published");
  if (published !== undefined) {
    const address = opts.published?.slug ?? published.id;
    const at = opts.published === undefined ? "now()" : `'${opts.published.at}'`;
    sql(
      `insert into publications (draft_id, site_id, destination, mode, live_url, published_at, delivery_state) values ` +
        `('${published.id}', '${siteId}', 'hosted', 'autopilot', 'https://content.${domain}/${address}', ${at}, 'delivered');`
    );
  }
}

/** A string as a SQL literal's body. One escape, used by every statement
 *  above that writes prose a fixture wrote rather than an identifier this
 *  file chose. */
function quote(value: string): string {
  return value.replaceAll("'", "''");
}

/** A jsonb column's value, or `null` where the caller stated none — never
 *  `'{}'`, which is a blob the generator never writes and which every
 *  reader downstream would have to tell apart from an absent one. */
function jsonbOrNull(value: Record<string, unknown> | undefined): string {
  return value === undefined ? "null" : `'${quote(JSON.stringify(value))}'::jsonb`;
}

function rows(statement: string): string[] {
  return psql(["-v", "ON_ERROR_STOP=1", "-Atc", statement])
    .split("\n")
    .filter((line) => line.length > 0);
}

/**
 * The `Cookie` header the sweep sends, minted through identity's own
 * issue → redeem → `sessionCookie` path against the seeded row.
 *
 * Throws rather than falling back. A sweep that quietly used a fixture
 * cookie would measure the sign-in prompt at four addresses and report a
 * clean run, which is exactly the failure #192 had to leave a marker for.
 */
export async function seededSessionCookie(
  account: AppAccount = RESERVED_ACCOUNT
): Promise<string> {
  const { issueLink, redeemLink, sessionCookie, SESSION_COOKIE_NAME } = await import(
    "@/lib/account/identity"
  );

  const issued = await issueLink({
    userId: account.userId,
    to: EMAIL_OF[account.userId] ?? SEEDED_EMAIL,
    purpose: "sign_in",
  });
  if (!issued.issued) {
    throw new Error(
      "tests/ui/layout/seed.ts: identity refused to issue a sign-in link against the seeded " +
        "account. The substrate is up (the migrations applied) but `identityStore()` could not " +
        "write — check SUPABASE_URL and the service-role key this process was given."
    );
  }

  // The token is the link's last segment — the only place the plaintext
  // ever exists, which is why `issueLink` hands back a URL and not a token.
  const token = new URL(issued.url).pathname.split("/").filter(Boolean).pop() ?? "";
  const redeemed = await redeemLink(token);
  if (!redeemed.ok) {
    throw new Error(
      `tests/ui/layout/seed.ts: the sign-in link this run issued would not redeem (${redeemed.reason}).`
    );
  }

  const cookie = sessionCookie(redeemed.session);
  return `${SESSION_COOKIE_NAME}=${cookie.value}`;
}

export {
  LIVE_ACCOUNT,
  LIVE_DRAFTS,
  LIVE_PUBLISHING,
  PUBLISHER_PAGE,
  RESERVED_ACCOUNT,
  SEEDED_DRAFT_ID,
  SEEDED_EMAIL,
  WEEK_ZERO_ACCOUNT,
};
