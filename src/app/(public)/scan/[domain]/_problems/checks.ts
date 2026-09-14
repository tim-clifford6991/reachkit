// SPEC §9 — the technical checks beside the three problem cards.
//
// Eight checks, closed, in SPEC §9's order, each with its title and who
// fixes it (the 2026-09-14 ruling). "AI readers blocked" is the ninth and
// stays the existing `blocked_readers` card.
//
// The counts are the scan engine's (#570). This file reads what the engine
// hands it and invents nothing: a check the engine did not report is
// `not_run` — absent with one why-line (SPEC §9), never a zero and never "Nothing to
// fix". Severity arrives with the count; no threshold is restated here.
//
// Copyable lines exist only where the line is fixed text: the viewport meta
// line and the robots `Sitemap:` line. Neither can block a crawler.
import type { Measured } from "@/lib/measure/measured";
import type { CopyKey } from "@/lib/presentation/copy";
import type { Severity } from "./model";

export type TechnicalCheck =
  | "page_titles"
  | "meta_descriptions"
  | "noindex_pages"
  | "sitemap"
  | "slow_pages"
  | "broken_links"
  | "phone_usability"
  | "structured_data";

export const CHECK_ORDER: readonly TechnicalCheck[] = Object.freeze([
  "page_titles",
  "meta_descriptions",
  "noindex_pages",
  "sitemap",
  "slow_pages",
  "broken_links",
  "phone_usability",
  "structured_data",
]);

export type Doer = "free_fix" | "reachkit_writes" | "reachkit_rewrites";

export const DOER_KEY: Readonly<Record<Doer, CopyKey>> = Object.freeze({
  free_fix: "check.doer.free-fix",
  reachkit_writes: "check.doer.reachkit-writes",
  reachkit_rewrites: "check.doer.reachkit-rewrites",
});

/** SPEC §9, 2026-09-14. */
const CHECK: Readonly<Record<TechnicalCheck, { title: CopyKey; doer: Doer }>> = Object.freeze({
  page_titles: { title: "check.page-titles.title", doer: "reachkit_rewrites" },
  meta_descriptions: { title: "check.meta-descriptions.title", doer: "reachkit_rewrites" },
  noindex_pages: { title: "check.noindex-pages.title", doer: "free_fix" },
  sitemap: { title: "check.sitemap.title", doer: "free_fix" },
  slow_pages: { title: "check.slow-pages.title", doer: "free_fix" },
  broken_links: { title: "check.broken-links.title", doer: "free_fix" },
  phone_usability: { title: "check.phone-usability.title", doer: "free_fix" },
  structured_data: { title: "check.structured-data.title", doer: "reachkit_writes" },
});

/** What the engine reports for one check. `sitemapUrl` is the address the
 *  site's sitemap is served at, where the engine found one to point to. */
export interface CheckReading {
  count: Measured<number>;
  severity: Measured<Severity>;
  sitemapUrl?: string;
}

export type CheckReadings = Partial<Readonly<Record<TechnicalCheck, CheckReading>>>;

export type CheckFix =
  | { kind: "not_run" } // the engine reported nothing for this check
  | { kind: "unknown" } // reported, and unmeasured
  | { kind: "none_needed" } // a measured zero
  | { kind: "paste"; lines: readonly string[] }
  | { kind: "doer_only" }; // measured, and nothing fixed to paste

export interface CheckCard {
  check: TechnicalCheck;
  title: CopyKey;
  doer: CopyKey;
  reading: CheckReading | null;
  fix: CheckFix;
}

// HTML and robots.txt protocol text, pasted as-is — not sentences a person
// reads, so not copy keys (the same footing as `unblock.ts`'s directives).
export const VIEWPORT_LINE = '<meta name="viewport" content="width=device-width, initial-scale=1">';
const SITEMAP_FIELD = "Sitemap";

function linesFor(check: TechnicalCheck, reading: CheckReading): readonly string[] {
  if (check === "phone_usability") return [VIEWPORT_LINE];
  if (check === "sitemap" && reading.sitemapUrl !== undefined) {
    return [`${SITEMAP_FIELD}: ${reading.sitemapUrl}`];
  }
  return [];
}

function fixFor(check: TechnicalCheck, reading: CheckReading | null): CheckFix {
  if (reading === null) return { kind: "not_run" };
  if (reading.count.kind === "unmeasured") return { kind: "unknown" };
  if (reading.count.kind === "zero") return { kind: "none_needed" };
  const lines = linesFor(check, reading);
  return lines.length === 0 ? { kind: "doer_only" } : { kind: "paste", lines };
}

export function checkCardsOf(readings: CheckReadings): readonly CheckCard[] {
  return CHECK_ORDER.map((check): CheckCard => {
    const reading = readings[check] ?? null;
    return {
      check,
      title: CHECK[check].title,
      doer: DOER_KEY[CHECK[check].doer],
      reading,
      fix: fixFor(check, reading),
    };
  });
}
