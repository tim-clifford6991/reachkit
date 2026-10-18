// SPEC §7 (owner 2026-10-17, issue 1490) — which pages may state the site's
// own measurements. A leaf with no db, so the pipeline reads the policy
// without reaching the report read in `report-facts.ts`.
import type { ContentType } from "@/lib/opportunities/content-type";

/** Whether a page of this type may state the site's own measurements:
 *  only a research page may (issue 1490). */
export function reportFactsAllowed(type: ContentType): boolean {
  return type === "research";
}

/** The report sentences a stored page's pack held, where that page is not a
 *  research page (issue 1490): what its refresh may no longer state. Empty
 *  for a research page and for a row written before the pack. */
export function withheldReportPassages(meta: unknown): string[] {
  const pack = (meta as { pack?: { type?: unknown; facts?: unknown } } | null)?.pack;
  if (pack === undefined || pack === null || typeof pack.type !== "string" || !Array.isArray(pack.facts)) return [];
  if (reportFactsAllowed(pack.type as ContentType)) return [];
  return (pack.facts as { passage?: unknown; report?: unknown }[]).flatMap((fact) =>
    fact?.report === true && typeof fact.passage === "string" ? [fact.passage] : []
  );
}
