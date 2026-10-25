// SPEC §7 — the two numbers of the note on how a published page was made, read off its row; the sentences are `./made.ts`'s.
// It imports nothing because the middleware reaches the hosted store, which reads these, and no copy or renderer may join that graph.

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

/** The note's two numbers off `drafts.meta`, or `null` where the row has no fact from the site or no rule count,
 *  so the page says nothing rather than a number nobody stored. */
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
