// SPEC §7 (owner, D46, 2026-10-04) — the content types the weekly mix leaves
// out for now. One predicate over the one list (`CONTENT_MIX.PAUSED_TYPES`),
// read by the ranking and by the count of unused supply, so a paused topic
// neither fills a day nor counts as a day of pages.
import { CONTENT_MIX } from "@/lib/config/constants";
import { contentTypeOf } from "./content-type";
import type { Opportunity } from "./types";

export function isPausedType(opportunity: Pick<Opportunity, "type" | "targetQuery">): boolean {
  const type = contentTypeOf(opportunity);
  return type !== null && CONTENT_MIX.PAUSED_TYPES.includes(type);
}
