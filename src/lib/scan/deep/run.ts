// BUILD §4.3 — the deep pass, and the named stages the waiting screen
// reads.
//
// "While the deep pass runs: progress screen; on completion straight to
// the app with the first draft already in the calendar. A degraded pass
// still releases setup (zero proposals is legal, never faked)." (§4.3)
//
// **There is no second pipeline here.** The deep pass is `runScan` at
// `tier: 'deep'` — one call, no stage list of its own, no ceiling of its
// own, no cost arithmetic of its own. What this file adds is the two
// things onboarding needs that the pipeline has no reason to know about:
// the founder's stage, written somewhere the waiting screen can read it,
// and the release latch, written once the pass ends whatever it ended as.
//
// **Why the stage is written to a row.** `src/lib/scan/stages.ts` carries
// transitions on an in-process event bus, and its own header says so: "if
// the job that runs `runScan` and the process that serves this route are
// ever different deployed instances, a second transport … replaces this
// bus". They are. The pass runs as `scan/run` on the job platform and the
// progress endpoint answers from the web process, so the founder's step
// travels through `sites.setup_stage` — six small writes for a pass that
// spends 30¢, and the only shape a duration could not travel in even if
// somebody wanted it to.
//
// A stage write that fails is swallowed. The pass is the thing being paid
// for; a founder briefly shown the previous step is a worse screen, and
// stopping a 30¢ measurement over it would be a worse product.
//
// **And the third thing: the pass's measurements become supply.** §7's
// derivation runs here rather than inside the pipeline because the
// pipeline branches on no tier and the free path derives nothing — the
// choice of *which* §7 entry point a pass uses belongs to the pass. The
// deep pass pursues a month of depth (`pursueDepth`, through
// `deriveForPass`), under the same `DEEP` cap the stages spent and counted
// in the same row's cost (issue 798), on the report the pass just stored —
// as a step of its own, after the pass's. A derivation that
// finds nothing is a normal return: §4.3 releases the founder either way
// and "zero proposals is legal, never faked".
import { FIRST_DRAFT_STAGE, type OnboardingStage } from "./progress";
import { dbAdmin } from "@/lib/db";
import { deriveForPass } from "@/lib/opportunities";
import { claimOnboardingPass, runScan, spendOnStoredReport } from "../run";
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

/**
 * The stage a founder is shown, and the instant it began.
 *
 * See this file's header for why the event bus cannot serve the first.
 * The second is issue #356: UI-SPEC S11 draws an elapsed time beside
 * every finished stage, and a duration the screen composed from its own
 * clock would be how long a tab was open rather than how long the work
 * took. So each entry is stamped as it happens and the screen subtracts
 * consecutive entries — `sites.setup_stage_times`.
 *
 * **Accumulated, never rewritten.** The map is merged rather than
 * replaced, so a stage's own instant survives the next five writes; the
 * clearing write at the end of the pass (`stage = null`) leaves it
 * standing, because a founder released into the app may still be shown
 * what their pass did.
 *
 * **`reset` starts a pass.** The map belongs to one pass, so the run
 * clears it before the first stage rather than adding to whatever a
 * previous pass left — two passes' timings in one map would state a
 * stage that ran twice as one that ran long.
 */
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
}

/** Runs one named piece of the pass durably, where the caller has a way
 *  to (the job's steps), and inline where it has none. Each piece's answer
 *  is plain data, so a piece already done is not run again on a retry. */
export type PassStep = <T>(name: string, body: () => Promise<T>) => Promise<T>;

const inline: PassStep = (_name, body) => body();

/**
 * Runs one founder's onboarding pass and releases them.
 *
 * **Three steps, not one** (issue 798): the pass itself, the opportunities
 * it derives, and the first draft with the release. Each is its own
 * invocation on the job platform, so no one of them has to fit the whole
 * onboarding inside the platform's ceiling on a request, and a later step
 * that fails is retried without buying the pass a second time.
 *
 * The release is written from the pass's own end state, and it is written
 * whatever that state is: a degraded pass and a failed one both release,
 * because §4.3 has no arm in which a founder is held. If the ten-minute
 * deadline already latched while this pass was running, `releaseToApp`
 * reports that earlier latch and this call changes nothing — the first
 * writer wins, so a pass that finishes late cannot put a founder back on
 * the progress screen.
 */
export async function runDeepPass(a: {
  siteId: string;
  domain: string;
  /** The work that belongs to onboarding after the scan and before the
   *  release — the first draft (issue #782). The founder is already in the
   *  app; the release is what clears their side panel, so it waits for the
   *  first page rather than announcing an app with none in it. A throw here
   *  never holds the release. */
  beforeRelease?: () => Promise<void>;
  step?: PassStep;
  /** A pass measured again now (issue 837): the row its request claimed is
   *  already running, so the onboarding row is not claimed again, and the
   *  stage the request wrote stands until the pipeline's first. The rest —
   *  the opportunities, the first draft, the latch already written — is the
   *  onboarding pass's own. */
  remeasure?: boolean;
}): Promise<{ scanId: string; status: ScanStatus; reason: ReleaseReason }> {
  const step = a.step ?? inline;

  const result = await step("deep-pass", () => measure(a));

  // The pass's measurements become supply, on the pass's own money and
  // under its own cap, from the report the first step stored. A derivation
  // that throws is logged: zero proposals is legal, never faked (§4.3).
  await step("opportunities", async () => {
    try {
      await spendOnStoredReport({ scanId: result.scanId, tier: "deep" }, async ({ report, cost }) => {
        await deriveForPass(cost, {
          tier: "deep",
          siteId: a.siteId,
          report,
          // Onboarding's pass runs on a payment that has just cleared, so
          // the gate is answered `true` here and never guessed at inside
          // the engine (`topUp`'s own rule, which the deep arm does not read).
          hasActiveAccess: true,
        });
      });
    } catch (error) {
      console.log(
        JSON.stringify({
          event: "after_report_failed",
          scanId: result.scanId,
          because: error instanceof Error ? error.message : String(error),
        })
      );
    }

    // The pass derived the paid voice; seed the customer's field from it, so
    // the first draft is written in it (issue 737). Setup could not: a
    // free-scan profile has no voice to adopt. Unstamped, and never over the
    // founder's own edit (`adoptVoiceText`); a failure costs a voice, never
    // the release.
    try {
      const { adoptVoiceText } = await import("@/lib/site-profile");
      await adoptVoiceText({ siteId: a.siteId, domain: a.domain });
    } catch {
      // Settings and the next weekly refresh read it again.
    }
    return null;
  });

  const reason = await step("first-draft", async () => {
    if (a.beforeRelease !== undefined) {
      await recordStage(a.siteId, FIRST_DRAFT_STAGE);
      try {
        await a.beforeRelease();
      } catch (error) {
        console.warn(JSON.stringify({ event: "before_release_failed", siteId: a.siteId, detail: String(error) }));
      }
    }

    const released = reasonFor(result.status);
    await releaseToApp({ siteId: a.siteId, reason: released });
    // The pass is over, so no step is under way. Cleared rather than left
    // pointing at `scoring`, which would read as "still scoring" to anyone
    // who asked after the release.
    await recordStage(a.siteId, null);
    return released;
  });

  return { scanId: result.scanId, status: result.status, reason };
}

/** The pass's first step: the row, the category and the one pipeline. */
async function measure(a: {
  siteId: string;
  domain: string;
  remeasure?: boolean;
}): Promise<{ scanId: string; status: ScanStatus }> {
  // The timings belong to one pass, so the map is cleared before this one
  // rather than added to whatever a previous pass left — two passes'
  // instants in one map would state a stage that ran twice as one that ran
  // long. Cleared here and not on the first stage, because deciding "is
  // this the first" would mean naming the pipeline's stage order in this
  // file, which `run.test.ts` holds it not to.
  //
  // A re-measure's request already cleared them and wrote the stage its
  // founder is shown (`remeasure.ts`), so a panel polling between the two
  // writes is never told the pass is over.
  if (a.remeasure !== true) await recordStage(a.siteId, null, { reset: true });

  // The row setup claimed when it accepted the address, or claimed now for
  // a founder whose address it never sought against — at the address setup
  // committed. The pass adopts it and inserts no second (owner ruling,
  // 2026-09-16). A throw here is the job's to retry: no pass without a row.
  if (a.remeasure !== true) await claimOnboardingPass({ siteId: a.siteId, domain: a.domain });

  // The category the founder confirmed at setup is the one the market is
  // searched on (#767); none stored, the pass seeds from the profile.
  const category = await readSiteCategory(a.siteId);

  return runScan({
    domain: a.domain,
    siteId: a.siteId,
    tier: "deep",
    ...(category === undefined ? {} : { category }),
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

