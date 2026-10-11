// SPEC §7 (2026-10-11, issue 1397) — the two numbers of the note that says
// how a published page was made, read off the page's own row. The sentences
// are `./made.ts`'s.
//
// Kept apart from them because the hosted store reads these and the
// middleware reaches the hosted store: this file imports no copy and no
// renderer, so neither joins that graph.
import { HARD_RULES } from "@/lib/generate/rules/types";

export interface MadeCounts {
  /** Facts the page states or links that were read from the site itself. */
  facts: number;
  /** Rules the page was checked against before it could publish. */
  rules: number;
}

/** Whether `url` is an address on `domain` or on a host under it. */
function onSite(url: unknown, domain: string): boolean {
  if (typeof url !== "string") return false;
  try {
    const host = new URL(url).host.toLowerCase().replace(/^www\./, "");
    const site = domain.toLowerCase().replace(/^www\./, "");
    return host === site || host.endsWith(`.${site}`);
  } catch {
    return false;
  }
}

/**
 * The note's two numbers, read off `drafts.meta`, or `null` where the row
 * records no fact from the site. A row written before the rule count was
 * stored was held to the list as it stands, and a published page passed it:
 * the publishing engine admits no other.
 */
export function madeCounts(meta: Readonly<Record<string, unknown>> | null, domain: string): MadeCounts | null {
  const used = meta?.factsUsed;
  if (!Array.isArray(used)) return null;
  const facts = used.filter(
    (fact) => typeof fact === "object" && fact !== null && onSite((fact as { url?: unknown }).url, domain)
  ).length;
  if (facts === 0) return null;
  const stored = meta?.rulesChecked;
  const rules = typeof stored === "number" && Number.isInteger(stored) && stored > 1 ? stored : HARD_RULES.length;
  return { facts, rules };
}
