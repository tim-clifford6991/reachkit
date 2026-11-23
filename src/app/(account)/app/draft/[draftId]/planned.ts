// SPEC §7 *A page's screen* — the open update the committed plan holds for a live page, which How It's Doing names
// beside "Not moving". Stored rows only.
import { addressOf } from "@/lib/measure/page-reading";
import { whySentenceOf } from "../../calendar/card-lines";
import type { LiveFacts } from "./model";

/** Its day and the plan's own reason; a failed read draws the plain next step. */
export async function plannedUpdateOf(siteId: string, url: string): Promise<LiveFacts["planned"]> {
  try {
    // Lazily: the opportunities barrel resolves `@/lib/db`, which the reserved account never reaches.
    const { committedWeek } = await import("@/lib/opportunities");
    const day = (await committedWeek(siteId)).days.find((each) => each.opportunity.type === "refresh_page" && addressOf(each.opportunity.targetRef) === addressOf(url));
    return day === undefined ? null : { on: day.date, reason: whySentenceOf(day.opportunity.planReason) };
  } catch {
    return null;
  }
}
