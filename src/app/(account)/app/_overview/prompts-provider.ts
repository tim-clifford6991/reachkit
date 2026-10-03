// SPEC §4 (D22) · §6 (D19, #1162) — the one read of the tracked prompts'
// window for a request, shared by the Overview tile and the AI answers tab.
import { cache } from "react";
import { isReservedFixtureAccount, requireSetUpAccount } from "../_session/account";
import { assemblePrompts, type PromptsModel } from "./prompts-model";
import { FIXTURE_PROMPT_WINDOW } from "./prompts-fixture";

export const readPrompts = cache(async function readPrompts(): Promise<PromptsModel> {
  const account = await requireSetUpAccount();
  if (isReservedFixtureAccount(account)) return assemblePrompts(FIXTURE_PROMPT_WINDOW);

  const [{ readPromptWindow, weekStartFor }, { now }] = await Promise.all([
    import("@/lib/scan/weekly"),
    import("@/lib/config/now"),
  ]);
  // The rate is a headline, not the screen: a window that cannot be read
  // leaves the screens showing what they showed before, never an error.
  try {
    return assemblePrompts(
      await readPromptWindow({
        siteId: account.siteId,
        zone: account.timeZone,
        weekStart: weekStartFor({ at: now(), zone: account.timeZone }),
      })
    );
  } catch {
    return { kind: "none" };
  }
});
