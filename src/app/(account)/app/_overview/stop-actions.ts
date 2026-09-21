// SPEC §4 (2026-09-20, #908) — the Server Function behind "Stop this page".
//
// The Overview's own transport between the button's click and §9's one
// mover. It holds no engine logic: `publishing.veto` is the calendar's
// declared machine (`../calendar/publishing.ts`), which is the only path
// from any screen to `transition()`, and a second copy of that rule here is
// exactly how two screens come to disagree about what may be stopped.
//
// **Ownership is the machine's to check, not this file's.** `vetoDraft`
// already refuses a draft this account does not own — a `select` keyed on
// `(id, site_id)` — so the id arriving from the browser reaches nothing it
// should not.
//
// **It answers with a boolean, never a sentence.** The two written lines are
// the registry's and the screen's; a refusal's own word is the machine's and
// belongs in a rejection a developer reads, not in a string composed here.
//
// **The screen is revalidated on a stop**, so the card leaves, the head
// falls back to the series' own line and the week strip loses its review
// day. A `"use server"` module may export only async functions, so that is
// the whole of this file.
"use server";

import { revalidatePath } from "next/cache";
import { TAB_HREF } from "./tabs";
import { publishing } from "../calendar/publishing";

export async function stopPage(draftId: string): Promise<boolean> {
  try {
    await publishing.veto({ draftId });
  } catch {
    return false;
  }
  revalidatePath(TAB_HREF.overview);
  return true;
}
