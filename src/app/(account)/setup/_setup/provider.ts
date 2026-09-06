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
