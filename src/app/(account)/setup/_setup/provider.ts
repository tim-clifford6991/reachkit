// BUILD §4.3 — the reads the setup screens make.
//
// The typed seam every `/setup` surface calls, and nothing else. What it
// reads behind the type is this issue's fixture; when §13's account rows
// (#42) and §6.3's deep pass land, only this file changes.
//
// `React.cache` is what makes it one read per request even though the page
// and the form each ask.
import { cache } from "react";
import { env } from "@/lib/config/env";
import { assembleSetup, type SetupScreenModel } from "./facts";
import { FIXTURE_PASS, FIXTURE_SETUP_FACTS, fixtureSetupStore } from "./fixture";
import type { PassProgress } from "./progress";
import type { SetupStore } from "../submit";
import type { ReportFacts } from "@/lib/market/setup/state";

export const readSetupScreen = cache(async function readSetupScreen(): Promise<SetupScreenModel> {
  return assembleSetup({
    ...FIXTURE_SETUP_FACTS,
    // §9's edge hostname is a deployment binding, never a string in a
    // card and never a fixture value in production.
    cnameTarget: env.HOSTED_EDGE_CNAME_TARGET,
  });
});

/** The deep pass's current state. One arm carries which step is running;
 *  the other carries that it ended, degraded or not. Neither carries a
 *  time. */
export const readPassProgress = cache(async function readPassProgress(): Promise<PassProgress> {
  return FIXTURE_PASS;
});

/** The writes completing setup makes. Returns the honest stub until #42's
 *  rows exist; the route handler holds no knowledge of which it got. */
export function setupStore(): SetupStore {
  return fixtureSetupStore();
}

/**
 * The completed report the product holds for one address, projected to the
 * three facts the market card needs (REQ-026 c1 versus c3).
 *
 * On fixtures this is the one address the fixture measured and nothing
 * else, which is what makes REQ-026 c6 visible in a preview rather than
 * only in a test: change the address away from it and the market card goes
 * empty, change it back and the inferred card returns.
 *
 * It is a fixture, not a stub around a missing read: `readCurrentReport(domain)`
 * landed with #25 and `StoredReport` carries `scanId` and `category`
 * directly. What is missing is the account — issue #14 builds both setup
 * screens on fixtures behind this seam, and a live read here would put a
 * database round-trip, and its failure mode, on the path a founder takes
 * every time they retype their address, before the rows that decide which
 * domain is theirs exist at all (#42). Swapping it in is this function's
 * body and nothing else:
 *
 *     const report = await readCurrentReport(domain);
 *     return report === null || report.category === null
 *       ? null
 *       : { scanId: report.scanId, category: report.category, rivals: [...] };
 *
 * The projection is deliberate and stays one — `ReportFacts` is not
 * `StoredReport`, for the cycle reason `src/lib/market/setup/state.ts`'s
 * header gives.
 */
export async function readReportFor(domain: string): Promise<ReportFacts | null> {
  const measured = FIXTURE_SETUP_FACTS.measured;
  return measured !== null && measured.domain === domain ? measured.report : null;
}
