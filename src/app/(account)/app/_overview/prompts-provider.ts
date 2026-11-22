// The one read of the tracked prompts' window for a request, shared by Rivals and Settings.
import { cache } from "react";
import { isReservedFixtureAccount, requireSetUpAccount } from "../_session/account";
import { assemblePrompts, type PromptsModel } from "./prompts-model";
import { FIXTURE_PROMPT_WINDOW } from "./prompts-fixture";

/** The window as the pass of `weekStart` read it: the month's reputation.
 *  `none` where that week is not given or cannot be read. */
export const readPromptsAt = cache(async function readPromptsAt(weekStart: string | null): Promise<PromptsModel> {
  const account = await requireSetUpAccount();
  if (isReservedFixtureAccount(account)) return assemblePrompts(FIXTURE_PROMPT_WINDOW);
  if (weekStart === null) return { kind: "none" };
  const { readPromptWindow } = await import("@/lib/scan/weekly");
  return readPromptWindow({ siteId: account.siteId, zone: account.timeZone, weekStart })
    .then((window) => assemblePrompts(window))
    .catch((): PromptsModel => ({ kind: "none" }));
});
