// BUILD §4.3: the deep pass is `runScan` at `tier: 'deep'`, with no stages, ceiling or cost arithmetic of its own.
// It adds what onboarding needs: the founder's stage on `sites.setup_stage`, because the job and the progress route run in different processes, and the release latch.
// A failed stage write is swallowed: the paid pass matters more than a briefly stale step.
// The pass's measurements become supply here (`deriveForPass`), not in the tier-blind pipeline, under the same `DEEP` cap and row cost. Zero proposals is legal, never faked.
import { FIRST_DRAFT_STAGE, type OnboardingStage } from "./progress";
import { WEEK_RESEARCH } from "@/lib/config/constants";
import { dbAdmin } from "@/lib/db";
import { sendOnboardingMails } from "@/lib/mail/onboarding";
import { cachedRivalRows, deriveForPass, planFirstWeek } from "@/lib/opportunities";
import { claimOnboardingPass, runScan, spendOnStoredReport } from "../run";
import { passRunning } from "../pass/row";
import type { ScanStatus } from "../store";
import { readSiteCategory } from "../site-category";
import { releaseToApp, type ReleaseReason } from "./release";

/** The pass's end state, as a release reason. Three of the latch's four
 *  triggers are exactly this map; the fourth (`deadline`) is the read
 *  path's and never passes through here. */
export function reasonFor(status: ScanStatus): ReleaseReason {
  if (status === "done") return "completed";
  if (status === "degraded") return "degraded";
  return "failed";
}

/** The stage a founder is shown and the instant it began (`sites.setup_stage_times`), stamped as it happens so the screen never composes a duration from its own clock.
 *  Merged, never replaced, and kept after the closing `stage = null`; `reset` clears it at a pass's start so two passes' timings never mix. */
async function recordStage(
  siteId: string,
  stage: OnboardingStage | null,
  opts: { reset?: boolean } = {}
): Promise<void> {
  try {
    const client = dbAdmin() as unknown as {
      from(table: string): {
        update(values: Record<string, unknown>): {
          eq(column: string, value: unknown): PromiseLike<{ error: { message: string } | null }>;
        };
      };
    };
    // Read-modify-write on one row the pass owns: the alternative is a
    // `jsonb_set` through the REST filter grammar, which this minimal
    // client shape does not carry. The pass is the only writer, so there
    // is no second hand to race with.
    const times = opts.reset === true ? {} : await stageTimes(siteId);
    const entered =
      stage === null ? times : { ...times, [stage]: new Date().toISOString() };
    await client
      .from("sites")
      .update({ setup_stage: stage, setup_stage_times: entered })
      .eq("id", siteId);
  } catch (error) {
    console.warn(
      JSON.stringify({ event: "setup_stage_not_recorded", siteId, stage, detail: String(error) })
    );
  }
  // The row is the record and the push is a courtesy: pushed after the write and outside its `try`, so a failed push cannot fail the pass.
  // Imported at the call, so the job platform's realtime half stays out of the engine's static graph.
  const { publishSetupStage } = await import("@/jobs/realtime");
  await publishSetupStage(siteId, stage);
}

/** Runs one named piece of the pass durably, where the caller has a way
 *  to (the job's steps), and inline where it has none. Each piece's answer
 *  is plain data, so a piece already done is not run again on a retry. */
export type PassStep = <T>(name: string, body: () => Promise<T>) => Promise<T>;

const inline: PassStep = (_name, body) => body();

/** Runs one founder's onboarding pass and releases them, in three job steps (the pass, its opportunities, the first draft and release),
 *  so none must fit the whole onboarding and a later retry does not re-buy the pass.
 *  The release is written whatever the pass ended as; if the deadline latched first, the first writer wins. */
export async function runDeepPass(a: {
  siteId: string;
  domain: string;
  /** Onboarding work after the scan and before the release (the first draft): the release clears the side panel, so it waits for the first page. A throw never holds the release. */
  beforeRelease?: () => Promise<void>;
  step?: PassStep;
  /** A pass measured again now: its row is already running, so the onboarding row is not claimed again and the request's stage stands until the pipeline's first. */
  remeasure?: boolean;
}): Promise<{ scanId: string; status: ScanStatus; reason: ReleaseReason }> {
  const step = a.step ?? inline;

  const result = await step("deep-pass", () => measure(a));
  // Nothing was measured, so no research is bought and no release or mail goes twice.
  if (result.scanId === "") return { scanId: "", status: result.status, reason: reasonFor(result.status) };

  // The pages the pass read become the knowledge base, one small call a page, on the pass's money; a failed read costs the base, never the pass.
  await step("knowledge-base", async () => {
    try {
      await spendOnStoredReport({ scanId: result.scanId, tier: "deep" }, async ({ cost }) => {
        const { buildKnowledge } = await import("@/lib/site-profile/knowledge/build");
        await buildKnowledge(cost, { siteId: a.siteId, domain: a.domain });
      });
    } catch (error) {
      console.log(
        JSON.stringify({
          event: "site_knowledge_failed",
          scanId: result.scanId,
          because: error instanceof Error ? error.message : String(error),
        })
      );
    }
    return null;
  });

  // The pass's measurements become supply, on the pass's own money and
  // under its own cap, from the report the first step stored. A derivation
  // that throws is logged: zero proposals is legal, never faked (§4.3).
  await step("opportunities", async () => {
    await afterDeepReport({ scanId: result.scanId, siteId: a.siteId, domain: a.domain, remeasure: a.remeasure === true });
    return null;
  });

  // The first week is researched like Monday's. Its best rows' own SERPs are posted now, so the voice step
  // and the first draft hide the queue's minutes; a row still queued at the commit is committed queued, never short.
  // Research never holds the release: a step that fails is logged and the week is committed from what is held.
  const week = { siteId: a.siteId, scanId: result.scanId }, held = <T>(body: () => Promise<T[]>) => body().catch((error: unknown) => (console.warn(JSON.stringify({ event: "first_week_research_failed", siteId: a.siteId, detail: String(error) })), []));
  const rows = await step("first-week-research", () => held(async () => (await import("../weekly/commit")).postFirstWeek({ ...week, now: new Date() })));

  await step("voice", async () => {
    // Seed the customer's voice from the pass's paid voice so the first draft is written in it; never over the founder's own edit, and a failure costs a voice, never the release.
    try {
      const { adoptVoiceText } = await import("@/lib/site-profile");
      await adoptVoiceText({ siteId: a.siteId, domain: a.domain });
    } catch {
      // Settings and the next weekly refresh read it again.
    }
    return null;
  });

  const { checkWeekResearch } = await import("@/lib/generate/research-queue");
  const checks: Awaited<ReturnType<typeof checkWeekResearch>> = [];
  for (let n = 0; n * WEEK_RESEARCH.batch < rows.length; n++) checks.push(...(await step(`first-week-check-${n}`, () => held(() => checkWeekResearch({ ...week, rows: rows.slice(n * WEEK_RESEARCH.batch, (n + 1) * WEEK_RESEARCH.batch), now: new Date() })))));

  const reason = await step("first-draft", async () => {
    if (a.beforeRelease !== undefined) {
      await recordStage(a.siteId, FIRST_DRAFT_STAGE);
      try {
        await a.beforeRelease();
      } catch (error) {
        console.warn(JSON.stringify({ event: "before_release_failed", siteId: a.siteId, detail: String(error) }));
      }
    }
    // After the first draft, which commits from its own date where it ran, reading the same checks from the cache,
    // so Plan has a week before the first evening either way. Never holds the release.
    try {
      await planFirstWeek(a.siteId, new Date(), new Map(checks));
      await (await import("../weekly/titles")).titleWeek(a.siteId, result.scanId);
      await (await import("../weekly/commit")).recordFirstWeek({ siteId: a.siteId, now: new Date(), rows, checks });
    } catch (error) {
      console.warn(JSON.stringify({ event: "first_week_not_planned", siteId: a.siteId, detail: String(error) }));
    }

    const released = reasonFor(result.status);
    await releaseToApp({ siteId: a.siteId, reason: released });
    // The pass is over, so no step is under way. Cleared rather than left
    // pointing at `scoring`, which would read as "still scoring" to anyone
    // who asked after the release.
    await recordStage(a.siteId, null);
    return released;
  });

  // Setup may have finished before the pass did; the mail is claimed once per site, so a re-measure sends nothing.
  await step("onboarding-mail", async () => {
    await sendOnboardingMails(a.siteId);
    return null;
  });

  // A first pass a ceiling stopped or that failed is measured again once, so its plan does not wait for Monday; a failure here never fails the pass.
  if (a.remeasure !== true) {
    await step("re-measure", async () => {
      const { remeasureCutShort } = await import("./remeasure");
      const start = await remeasureCutShort({ siteId: a.siteId, domain: a.domain, scanId: result.scanId }).catch((error: unknown) => String(error));
      if (start !== null) console.log(JSON.stringify({ event: "first_pass_remeasured", siteId: a.siteId, start }));
      return null;
    });
  }

  return { scanId: result.scanId, status: result.status, reason };
}

/** What a deep pass does with its stored report, on its own money: rivals re-checked, topics derived and pruned, health recorded last.
 *  One function, so `npm run pass -- --replay` runs the same steps in the same order. Never throws. */
export async function afterDeepReport(a: {
  scanId: string;
  siteId: string;
  domain: string;
  remeasure: boolean;
}): Promise<void> {
  try {
    await spendOnStoredReport({ scanId: a.scanId, tier: "deep" }, async ({ report, cost }) => {
      // The rivals, re-checked from this pass's own answers before anything is derived against them.
      const { recheckRivalsOf } = await import("../market-conclusion");
      await recheckRivalsOf({ siteId: a.siteId, domain: a.domain, cost, report, at: new Date() });
      try {
        await deriveForPass(cost, {
          tier: "deep",
          siteId: a.siteId,
          report,
          // Onboarding's pass runs on a payment that has just cleared, so
          // the gate is answered `true` here and never guessed at inside
          // the engine.
          hasActiveAccess: true,
          rivalRows: cachedRivalRows(a.siteId),
        });
      } finally {
        // The pass checks its own health last, against the rivals it leaves in force; only a re-measure asks the tracked prompts. Never throws.
        const { recordPassHealth } = await import("../health-record");
        await recordPassHealth({ scanId: a.scanId, siteId: a.siteId, domain: a.domain, report, asksPrompts: a.remeasure });
      }
    });
  } catch (error) {
    console.log(
      JSON.stringify({
        event: "after_report_failed",
        scanId: a.scanId,
        because: error instanceof Error ? error.message : String(error),
      })
    );
  }
}

/** The pass's first step: the row, the category and the one pipeline. */
async function measure(a: {
  siteId: string;
  domain: string;
  remeasure?: boolean;
}): Promise<{ scanId: string; status: ScanStatus }> {
  if (a.remeasure !== true) {
    // The row setup claimed, or claimed now at the address setup committed; the pass adopts it and inserts no second. A throw is the job's to retry.
    // A second send after the pass ended finds its own row ended, whatever re-measure runs beside it: it resets no stage and buys nothing.
    if (!(await passRunning(await claimOnboardingPass({ siteId: a.siteId, domain: a.domain })))) return { scanId: "", status: "failed" };
    // Cleared here, not on the first stage, so this file need not name the pipeline's stage order. A re-measure's request already cleared them and wrote its stage.
    await recordStage(a.siteId, null, { reset: true });
  }

  // The category the founder confirmed at setup is the one the market is searched on; none stored, the pass seeds from the profile.
  const category = await readSiteCategory(a.siteId);

  return runScan({
    domain: a.domain,
    siteId: a.siteId,
    tier: "deep",
    ...(category === undefined ? {} : { category }),
    concludesMarket: true,
    // A re-measure also asks the site's tracked buyer prompts, so the mention rate does not wait for Monday.
    ...(a.remeasure === true ? { asksTrackedPrompts: true } : {}),
    onStage: (stage) => recordStage(a.siteId, stage),
  });
}

/** The row's recorded entries, or an empty map where the column has none
 *  and where it could not be read — an unreadable map is not a claim that
 *  a stage took no time, and the screen draws nothing for a stage it has
 *  no instant for. */
async function stageTimes(siteId: string): Promise<Record<string, string>> {
  try {
    const client = dbAdmin() as unknown as {
      from(table: string): {
        select(columns: string): {
          eq(
            column: string,
            value: unknown
          ): {
            limit(n: number): PromiseLike<{
              data: { setup_stage_times: Record<string, string> | null }[] | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    };
    const { data } = await client
      .from("sites")
      .select("setup_stage_times")
      .eq("id", siteId)
      .limit(1);
    return data?.[0]?.setup_stage_times ?? {};
  } catch {
    return {};
  }
}

