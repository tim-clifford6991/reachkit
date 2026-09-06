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

/** One column, one value, no clock. See this file's header for why the
 *  event bus cannot serve this. */
async function recordStage(siteId: string, stage: StageName | null): Promise<void> {
  try {
    const client = dbAdmin() as unknown as {
      from(table: string): {
        update(values: Record<string, unknown>): {
          eq(column: string, value: unknown): PromiseLike<{ error: { message: string } | null }>;
        };
      };
    };
    await client.from("sites").update({ setup_stage: stage }).eq("id", siteId);
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
