// SPEC §7 (2026-10-11, issue 1397) — the two numbers of the note that says
// how a published page was made, read off the page's own row. The sentences
// are `./made.ts`'s.
//
// Kept apart from them because the hosted store reads these and the
// middleware reaches the hosted store: this file imports nothing, so no
// copy and no renderer joins that graph.

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
 * records no fact from the site or no count of the rules it was held to. A
 * row written before that count was stored has none, and the page says
 * nothing rather than a number nobody stored; it gains the note when it is
 * next written.
 */
export function madeCounts(meta: Readonly<Record<string, unknown>> | null, domain: string): MadeCounts | null {
  const used = meta?.factsUsed;
  if (!Array.isArray(used)) return null;
  const facts = used.filter(
    (fact) => typeof fact === "object" && fact !== null && onSite((fact as { url?: unknown }).url, domain)
  ).length;
  if (facts === 0) return null;
  const stored = meta?.rulesChecked;
  if (typeof stored !== "number" || !Number.isInteger(stored) || stored < 2) return null;
  return { facts, rules: stored };
}
