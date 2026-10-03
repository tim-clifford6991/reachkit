// SPEC §6 (2026-09-29, D15, issue 1146) — a page that is close to being
// quoted. A leaf: the ranking and the drafting prompts both read it, and it
// reaches no store.
import { CLOSE_PAGE_POSITION_BAND } from "@/lib/config/constants";
import { canonicalUrl } from "./cluster";
import type { Opportunity, Shortfall } from "./types";

/** The update of a live page that ranks 4–20 for its target, or that a tracked AI answer cited in the last
 *  four weeks (`cited`, canonical addresses). Read off the row's own
 *  evidence and the stored answers; nothing is judged here. */
export function isCloseUpdate(o: Pick<Opportunity, "evidence">, cited: ReadonlySet<string> = new Set()): boolean {
  // The evidence is stored jsonb: a row that carries no shortfall or address is read
  // as not close, never thrown on.
  const evidence = o.evidence as Opportunity["evidence"] | undefined;
  if (evidence?.family !== "improve") return false;
  const shortfall = evidence.shortfall as Shortfall | undefined;
  const pageUrl = evidence.pageUrl as string | undefined;
  if (
    shortfall?.kind === "position" &&
    shortfall.position.kind === "measured" &&
    shortfall.position.value >= CLOSE_PAGE_POSITION_BAND.min &&
    shortfall.position.value <= CLOSE_PAGE_POSITION_BAND.max
  ) {
    return true;
  }
  return typeof pageUrl === "string" && cited.has(canonicalUrl(pageUrl));
}
