// scripts/replan/run.ts — `npm run replan`'s body: the site by its domain, its
// clock as the daily tick reads it, then `src/lib/scan/replan.ts`'s dry run and,
// with `--apply`, the commit.
import { dbAdmin } from "@/lib/db";
import { toPublishingSettings } from "@/lib/publish/settings/settings";
import { applyReplan, dryReplan, type WeekRow } from "@/lib/scan/replan";

interface SiteRow {
  id: string;
  timezone: string | null;
  veto_hours: number | null;
  publish_time: string | null;
}

export async function main(a: { domain: string; from: string | null; apply: boolean; now: Date }): Promise<number> {
  const sites = dbAdmin() as unknown as {
    from(t: string): { select(c: string): { eq(c: string, v: string): PromiseLike<{ data: SiteRow[] | null; error: { message: string } | null }> } };
  };
  const { data, error } = await sites.from("sites").select("id, timezone, veto_hours, publish_time").eq("domain", a.domain);
  if (error !== null) throw new Error(`sites: ${error.message}`);
  const site = data?.[0];
  if (site === undefined) throw new Error(`no site at ${a.domain}`);
  const settings = site.timezone === null ? null : toPublishingSettings({ mode: null, ...site });
  const clock = settings === null ? null : { siteId: site.id, timeZone: site.timezone!, publishTime: settings.publishTime, vetoHours: settings.vetoHours };
  const plan = await dryReplan(site.id, { now: a.now, clock, fingerprint: null, ...(a.from === null ? {} : { from: a.from }) });
  if (plan === null) {
    console.log(`${a.domain} has no committed week; nothing to re-plan.`);
    return 0;
  }
  console.log(`\n${a.domain} from ${plan.from}. Unmeasured in its stored pass: ${plan.unmeasured.join(", ") || "none"}.`);
  for (const [name, week] of [["Committed now", plan.before], ["Re-planned", plan.after]] as const) console.log(`\n${name}:\n${table(week)}`);
  if (plan.held !== null) console.log(`\nThe tick would hold this week: ${plan.held}.`);
  if (!a.apply) return 0;
  console.log(`\nCommitted ${await applyReplan(site.id, plan.from, a.now)} rows from ${plan.from}.`);
  return 0;
}

function table(week: readonly WeekRow[]): string {
  const rows = week.map((row) => `| ${row.date ?? "spare"} | ${row.search ?? "—"} | ${row.page} | ${row.type} | ${row.points ?? "—"} | ${row.state ?? "—"} |`);
  return ["| Day | Search | Page | Type | Points | Research |", "|---|---|---|---|---|---|", ...rows].join("\n");
}
