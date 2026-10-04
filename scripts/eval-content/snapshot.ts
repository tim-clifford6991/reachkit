// scripts/eval-content/snapshot.ts — one domain of the evaluation set, as a
// committed file.
//
// A snapshot holds what the pipeline reads for a domain and nothing else:
//
//   * `report` — the stored report of the domain's scan, verbatim as
//     `scans.report` holds it. `readStoredReport` upgrades and revives it, as
//     the product does.
//   * `siteProfile` / `site` — the `site_profiles` and `sites` rows, where
//     the domain has them. `null` is a domain nobody has crawled or signed up.
//   * `pages` — the pages the domain's free scans read, as `readDomainText`
//     returns them: the stored HTML of each `fetches` row, through the
//     product's own `visibleText`, the latest read of each address.
//
// This box's service key is a placeholder, so the script cannot read the
// database itself. A snapshot is taken through the Supabase connector, as a
// JSON file of the shape `Export` below, and stored with
// `npm run eval:content -- --snapshot <domain> --from <export.json>`:
//
//   select id, tier, status, finished_at, report from scans
//     where domain = '<domain>' and report is not null
//     order by (status = 'done') desc, finished_at desc limit 1;
//   select site_name, products, claims, voice from site_profiles where domain = '<domain>';
//   select voice_text, do_not_claim from sites where domain = '<domain>';
//   select f.payload->>'url' as url, f.payload->>'readAt' as "readAt", f.payload->>'html' as html
//     from fetches f join scans s on s.id = f.scan_id
//     where f.source = 'egress.safeFetch' and s.tier = 'free' and s.domain = '<domain>'
//       and f.payload ? 'html';
//
// Every later run grades against the same stored text, so a change in the
// score is a change in the pipeline and not in the site. The only write is
// this file's, under `scripts/eval-content/snapshot/`.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { visibleText } from "@/lib/measure/parse";
import { derivePurpose } from "@/lib/site-profile/purpose";
import type { InventoryRow, VoiceSummary } from "@/lib/site-profile/types";

export interface SnapshotPage {
  url: string;
  readAt: string;
  title: string;
  h1: string;
  text: string;
}

export interface Snapshot {
  domain: string;
  /** The scan whose report this is. */
  scan: { id: string; tier: string; status: string; finishedAt: string };
  report: unknown;
  siteProfile: { siteName: string | null; products: string[]; claims: string[]; voice: VoiceSummary | null } | null;
  site: { voiceText: string | null; doNotClaim: string[] } | null;
  /** `sites.market`, where the export carried it (#1164): the market the
   *  site holds now, which a stored report's own reading may be older than. */
  market?: unknown;
  pages: SnapshotPage[];
}

/** What `--from` reads: the snapshot, with each page as its stored HTML. */
export type Export = Omit<Snapshot, "domain" | "pages"> & { pages: { url: string; readAt: string; html: string }[] };

export const SNAPSHOT_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), "snapshot");

/** `name` is the domain, or the name a frozen copy was stored under
 *  (`--as`), so a round keeps its own snapshot while the set's moves on. */
export function snapshotPath(name: string): string {
  return path.join(SNAPSHOT_DIR, `${name}.json`);
}

export function readSnapshot(name: string): Snapshot {
  return JSON.parse(readFileSync(snapshotPath(name), "utf8")) as Snapshot;
}

/** The crawl's inventory, as the link selector reads it, built from the
 *  snapshot's pages by the product's own purpose rule. */
export function inventoryOf(snapshot: Snapshot): InventoryRow[] {
  return snapshot.pages.map((page) => ({
    url: page.url,
    title: page.title,
    h1: page.h1,
    purpose: derivePurpose({ url: page.url, title: page.title, h1: page.h1 }),
  }));
}

function firstInner(html: string, tag: "title" | "h1"): string {
  const match = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "i").exec(html);
  return match === null ? "" : visibleText(match[1] ?? "");
}

/** `--snapshot <domain> --from <export.json> [--as <name>]`. Sitemaps are
 *  not pages. */
export function takeSnapshot(domain: string, from: string, as: string = domain): Snapshot {
  const exported = JSON.parse(readFileSync(from, "utf8")) as Export;
  const latest = new Map<string, { url: string; readAt: string; html: string }>();
  for (const row of exported.pages) {
    if (row.url.endsWith(".xml")) continue;
    const held = latest.get(row.url);
    if (held === undefined || held.readAt < row.readAt) latest.set(row.url, row);
  }
  const pages = [...latest.values()]
    .sort((a, b) => (a.url < b.url ? -1 : 1))
    .map((row) => ({
      url: row.url,
      readAt: new Date(row.readAt).toISOString(),
      title: firstInner(row.html, "title"),
      h1: firstInner(row.html, "h1"),
      text: visibleText(row.html),
    }));
  const snapshot: Snapshot = { domain, ...exported, pages };
  writeFileSync(snapshotPath(as), `${JSON.stringify(snapshot, null, 2)}\n`);
  return snapshot;
}
