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
// `deriveForPass`), inside the same cost context and the same `DEEP` cap
// the stages spent, on the report the pass just stored. A derivation that
// finds nothing is a normal return: §4.3 releases the founder either way
// and "zero proposals is legal, never faked".
import type { StageName } from "../stages";
import { dbAdmin } from "@/lib/db";
import { deriveForPass } from "@/lib/opportunities";
import { runScan } from "../run";
import type { ScanStatus } from "../store";
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
  stage: StageName | null,
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

/**
 * Runs one founder's onboarding pass and releases them.
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
}): Promise<{ scanId: string; status: ScanStatus; reason: ReleaseReason }> {
  // The timings belong to one pass, so the map is cleared before this one
  // rather than added to whatever a previous pass left — two passes'
  // instants in one map would state a stage that ran twice as one that ran
  // long. Cleared here and not on the first stage, because deciding "is
  // this the first" would mean naming the pipeline's stage order in this
  // file, which `run.test.ts` holds it not to.
  await recordStage(a.siteId, null, { reset: true });

  const result = await runScan({
    domain: a.domain,
    siteId: a.siteId,
    tier: "deep",
    onStage: (stage) => recordStage(a.siteId, stage),
    // Onboarding's pass runs on a payment that has just cleared, so the
    // gate is answered `true` here and never guessed at inside the
    // engine (`topUp`'s own rule, which the deep arm does not read).
    afterReport: async ({ report, cost }) => {
      await deriveForPass(cost, {
        tier: "deep",
        siteId: a.siteId,
        report,
        hasActiveAccess: true,
      });
    },
  });

  const reason = reasonFor(result.status);
  await releaseToApp({ siteId: a.siteId, reason });
  // The pass is over, so no step is under way. Cleared rather than left
  // pointing at `scoring`, which would read as "still scoring" to anyone
  // who asked after the release.
  await recordStage(a.siteId, null);

  return { scanId: result.scanId, status: result.status, reason };
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

