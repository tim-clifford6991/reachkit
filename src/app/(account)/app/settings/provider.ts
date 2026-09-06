// BUILD §4.7 — the one read Settings makes.
//
// The typed seam WO-179 calls `readSettings`. The screen calls it and nothing
// else; what it reads behind the type is this issue's fixture (`fixture.ts`)
// and, when the queries land, the one read of `sites`, `destinations` and
// `users` WO-179's file plan describes — one request-cached read, no second
// caller, no second shape.
//
// `React.cache` is what makes it one read per request even though the screen
// and any panel that later asks for itself would each ask: the page asks once
// and passes the model down today, and a later caller gets the same object
// rather than a second query. It is the same shape `_shell/provider.ts` uses,
// deliberately — two reads with two idioms is how a screen and its frame end
// up disagreeing about the site they are describing.
//
// WO-179 step 2: no measurement, no vendor call and no model call happens
// here or downstream of here. Nothing in this module's import graph reaches
// `src/lib/vendors`, `src/lib/llm` or `src/lib/egress`.
import { cache } from "react";
import { assembleSettings, type SettingsModel } from "./model";
import { FIXTURE_SETTINGS_FACTS } from "./fixture";

export const readSettings = cache(async function readSettings(): Promise<SettingsModel> {
  return assembleSettings(FIXTURE_SETTINGS_FACTS);
});
