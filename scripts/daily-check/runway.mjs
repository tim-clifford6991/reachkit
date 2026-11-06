// The daily check's Runway section: per set-up site, the new-page topics ready, the pages drafted ahead,
// and the class of every empty day in the last 7, so a defect is told from a site that ran out.
//
//   node scripts/daily-check/runway.mjs --sql       prints the read-only query
//   node scripts/daily-check/runway.mjs < rows.json prints the report section
//
// Stdin is the query's rows as a JSON array; empty or unparseable stdin means the source was unreachable.
import { parseRows } from "./settings-reads.mjs";

/** Under this many topics and pages ahead, a site in its first 30 days is red. */
export const RED_UNDER = 3;
/** Under this many, any site is a warning. */
export const WARN_UNDER = 7;
const YOUNG_DAYS = 30;

// An empty day's open rows are read as of the day; their readiness is the row's current one, the only one stored.
export const RUNWAY_SQL = `select s.id as site_id, s.domain,
  (select count(*) from opportunities o
    where o.site_id = s.id and o.status = 'open' and o.ready and o.family in ('write', 'earn')
      and not exists (select 1 from drafts d where d.opportunity_id = o.id)) as ready_left,
  (select count(*) from drafts d
    where d.site_id = s.id and d.scheduled_for > current_date and d.state not in ('skipped', 'needs_attention')) as drafted_ahead,
  (select current_date - min(p.published_at)::date from publications p where p.site_id = s.id) as days_since_first_live,
  coalesce((select jsonb_object_agg(k.class, k.days) from (
    select c.class, count(*) as days
    from draft_days d
    cross join lateral (
      select count(*) as rows, count(*) filter (where o.unready_reason = 'no_grounding_fact') as ungrounded
      from opportunities o
      where o.site_id = d.site_id and o.family in ('write', 'earn')
        and o.created_at <= coalesce(d.decided_at, d.publish_date + 1)
        and (o.status = 'open' or o.status_changed_at > coalesce(d.decided_at, d.publish_date + 1))
    ) open
    cross join lateral (select case
      when d.reason = 'generate:rules' then 'rules'
      when d.reason in ('generate:vendor_funds', 'generate:budget', 'generate:time')
        or d.reason ~ '^generate:step_failed:.*(cap|time)' then 'budget'
      when d.reason like 'generate:step_failed:%' then 'step_failed'
      when d.reason = 'generate:no_opportunity' and open.rows = 0 then 'no_opportunity_empty'
      when d.reason = 'generate:no_opportunity' and open.rows = open.ungrounded then 'grounding_failed'
      when d.reason = 'generate:no_opportunity' then 'no_opportunity_ready_rows'
      when d.outcome = 'no_page' then 'other: ' || coalesce(d.reason, 'no_page')
      else 'other: ' || d.outcome || coalesce(':' || d.reason, '')
    end as class) c
    where d.site_id = s.id and d.publish_date > current_date - 7 and d.publish_date <= current_date
      and d.outcome is not null and d.outcome <> 'drafted'
    group by c.class
  ) k), '{}'::jsonb) as empty_days_7d,
  short.at as supply_short_at,
  short.read as supply_short_dry
from sites s
join users u on u.id = s.user_id
left join lateral (
  select e.at, e.read from ops_events e
  where e.site_id = s.id and e.kind = 'supply_short'
  order by e.at desc limit 1
) short on true
where s.setup_completed_at is not null and u.deleted_at is null
order by s.domain;`;

/**
 * @typedef {{ domain: string, ready_left: number | string, drafted_ahead: number | string,
 *   days_since_first_live: number | string | null, empty_days_7d: Record<string, number | string> | string | null,
 *   supply_short_at: string | null, supply_short_dry: string | null }} RunwayRow
 */

/** @param {RunwayRow} row */
function runwayOf(row) {
  return Number(row.ready_left) + Number(row.drafted_ahead);
}

/** @param {RunwayRow["empty_days_7d"]} days */
function emptyDays(days) {
  const byClass = typeof days === "string" ? JSON.parse(days) : (days ?? {});
  const named = Object.entries(byClass).map(([name, count]) => `${name} ${Number(count)}`);
  return named.length === 0 ? "none" : named.join(", ");
}

/** @param {RunwayRow} row */
function status(row) {
  const runway = runwayOf(row);
  const young = row.days_since_first_live === null || Number(row.days_since_first_live) < YOUNG_DAYS;
  if (young && runway < RED_UNDER) return `**RED** (< ${RED_UNDER} in the first ${YOUNG_DAYS} d)`;
  return runway < WARN_UNDER ? `WARN (< ${WARN_UNDER})` : "ok";
}

/**
 * @param {readonly RunwayRow[] | null} rows The query's rows, or `null` when the source could not be read.
 * @returns {string} The report section, in markdown.
 */
export function runwaySection(rows) {
  const head = "### Runway (new-page topics ready, pages drafted ahead, empty days in 7 d)";
  if (rows === null) return `${head}\n\nnot measured: the query did not answer.`;
  if (rows.length === 0) return `${head}\n\nno set-up site.`;
  const sorted = [...rows].sort((a, b) => runwayOf(a) - runwayOf(b) || a.domain.localeCompare(b.domain));
  const lines = sorted.map((row) => {
    const live = row.days_since_first_live === null ? "no live page" : `${Number(row.days_since_first_live)} d`;
    const short = row.supply_short_at === null ? "not measured" : `${row.supply_short_at.slice(0, 10)} (dry: ${row.supply_short_dry})`;
    return `| ${row.domain} | ${Number(row.ready_left)} | ${Number(row.drafted_ahead)} | ${live} | ${emptyDays(row.empty_days_7d)} | ${short} | ${status(row)} |`;
  });
  return [head, "", "| site | ready | drafted ahead | live for | empty days (7 d) | supply short | status |", "|---|---|---|---|---|---|---|", ...lines].join("\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes("--sql")) {
    console.log(RUNWAY_SQL);
  } else {
    let text = "";
    for await (const chunk of process.stdin) text += chunk;
    console.log(runwaySection(parseRows(text)));
  }
}
