// SPEC §6 (owner ruling 2026-09-17, issue 837) — the Server Function behind
// the thin-market choice: the founder's category in, a pass measured again
// now, or the one line saying why not.
//
// Whether a pass may start, the saved category and the send are
// `@/lib/scan/deep/remeasure`'s; this reads one field, names the account from
// the session — never a site id the browser sent — and writes the answer.
//
// **A `"use server"` module may export only async functions**, so the state,
// its initial value and the field's wire name live in `./remeasure`.
"use server";

import { revalidatePath } from "next/cache";
import type { CopyKey } from "@/lib/presentation/copy";
import { formatDateTime } from "./format";
import { writtenLine } from "./written";
import { REMEASURE_CATEGORY_FIELD, type RemeasureState } from "./remeasure";

function refused(key: CopyKey, vars?: Record<string, string>): RemeasureState {
  return { answer: "refused", line: writtenLine(key, vars) ?? "" };
}

export async function remeasureAction(_previous: RemeasureState, form: FormData): Promise<RemeasureState> {
  const raw = form.get(REMEASURE_CATEGORY_FIELD);
  const category = typeof raw === "string" ? raw.trim() : "";
  if (category === "") return refused("setup.remeasure.refused.empty");

  // A missing session goes to sign-in and a missing zone to its own screen,
  // as every account screen is sent (`requireSetUpAccount`).
  const { isReservedFixtureAccount, requireSetUpAccount } = await import("../_session/account");
  const account = await requireSetUpAccount();
  if (isReservedFixtureAccount(account)) return { answer: "idle" };

  const { startRemeasure } = await import("@/lib/scan/deep/remeasure");
  const started = await startRemeasure({ siteId: account.siteId, domain: account.domain, category });
  if (started.started) {
    // The whole app re-reads: the shell's panel now names the pass's step.
    revalidatePath("/app", "layout");
    return { answer: "started" };
  }
  if (started.because === "running") return refused("setup.remeasure.refused.running");
  return refused("setup.remeasure.refused.daily-limit", {
    time: formatDateTime(started.nextAt, account.timeZone),
  });
}
