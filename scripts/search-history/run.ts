// scripts/search-history/run.ts — `npm run search-history`: each live hosted page's weeks on its own search, from
// Search Console's history (up to 16 months, including the months before the property was verified). Read-only: it
// selects rows and asks Google, and writes nothing. 0¢.
import { gscAccounts, gscClient, type GscSend } from "@/lib/vendors/gsc";
import { pageSearchOf } from "@/lib/measure/page-reading";
import { publishDb } from "@/lib/publish/db";
import type { SearchVerification } from "@/lib/publish/destinations/hosted/search-engines";

const DAY_MS = 86_400_000;
const HISTORY_DAYS = 486;

interface PageRow {
  live_url: string | null;
  acceptance: unknown;
  drafts: { opportunities: { acceptance: unknown; target_query: string | null } | null } | null;
}

const day = (at: Date): string => at.toISOString().slice(0, 10);

/** The Monday a day falls in, `YYYY-MM-DD`. */
function weekOf(date: string): string {
  const at = new Date(`${date}T00:00:00Z`);
  return day(new Date(at.getTime() - ((at.getUTCDay() + 6) % 7) * DAY_MS));
}

export async function main(a: { site: string; now: Date; send?: GscSend; out?: (line: string) => void }): Promise<number> {
  const out = a.out ?? console.log;
  const db = publishDb();
  const { data: sites } = await db.from<{ id: string }>("sites").select("id").eq("domain", a.site).limit(1);
  const siteId = sites?.[0]?.id;
  if (siteId === undefined) return (out(`No site ${a.site}.`), 1);
  const { data: destinations } = await db
    .from<{ hostname: string | null; hostname_state: string | null; search_verification: SearchVerification | null }>("destinations")
    .select("hostname, hostname_state, search_verification")
    .eq("site_id", siteId)
    .eq("kind", "hosted")
    .is("deleted_at", null)
    .limit(1);
  const destination = destinations?.[0];
  const held = destination?.search_verification?.google;
  const account = gscAccounts().find((candidate) => candidate.client_email === held?.account);
  if (destination?.hostname_state !== "live" || destination.hostname === null) return (out(`${a.site} has no live hosted host.`), 1);
  if (account === undefined || held?.verifiedAt === undefined) {
    return (out(`${destination.hostname} is not read: ${account === undefined ? "no key for its Search Console account" : "not verified yet"}.`), 1);
  }

  const siteUrl = `https://${destination.hostname.trim().toLowerCase()}/`;
  const { data: pages } = await db
    .from<PageRow>("publications")
    .select("live_url, acceptance, drafts(opportunities(acceptance, target_query))")
    .eq("site_id", siteId)
    .not("published_at", "is", null)
    .is("unpublished_at", null);
  const client = gscClient(account, a.send);
  const start = day(new Date(a.now.getTime() - HISTORY_DAYS * DAY_MS));
  out(`${siteUrl} · ${start} to ${day(a.now)} · Search Console, each page on its own search. URL Inspection keeps no history.`);
  out(["page", "search", "week", "impressions", "clicks", "average place"].join("\t"));
  for (const page of pages ?? []) {
    if (page.live_url === null || !page.live_url.startsWith(siteUrl)) continue;
    const search = pageSearchOf(page.acceptance ?? page.drafts?.opportunities?.acceptance, page.drafts?.opportunities?.target_query);
    if (search === null) {
      out([page.live_url, "-", "-", "no search of its own", "", ""].join("\t"));
      continue;
    }
    const days = await client.history(siteUrl, page.live_url, search.trim().toLowerCase().replace(/\s+/g, " "), start, day(a.now));
    if (days === null || days.length === 0) {
      out([page.live_url, search, "-", days === null ? "not read" : "never shown", "", ""].join("\t"));
      continue;
    }
    const weeks = new Map<string, { impressions: number; clicks: number; placed: number }>();
    for (const row of days) {
      const week = weeks.get(weekOf(row.date)) ?? { impressions: 0, clicks: 0, placed: 0 };
      week.impressions += row.impressions;
      week.clicks += row.clicks;
      week.placed += row.position * row.impressions;
      weeks.set(weekOf(row.date), week);
    }
    for (const [week, w] of [...weeks].sort(([x], [y]) => x.localeCompare(y))) {
      const place = w.impressions === 0 ? "-" : (w.placed / w.impressions).toFixed(1);
      out([page.live_url, search, week, String(w.impressions), String(w.clicks), place].join("\t"));
    }
  }
  return 0;
}
