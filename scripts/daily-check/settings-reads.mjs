// The daily check's Settings line: failed reads per read from `ops_events`, red at the threshold, "not measured" when the query gave nothing.
//
//   node scripts/daily-check/settings-reads.mjs --sql      prints the read-only query
//   node scripts/daily-check/settings-reads.mjs < rows.json prints the report section
//
// Stdin is the query's rows as a JSON array; empty or unparseable stdin means the source was unreachable.

/** One read failing this often in 24 h is red. */
export const RED_AT = 3;

export const SETTINGS_READS_SQL = `select read,
  count(*) filter (where at > now() - interval '24 hours') as last_24h,
  count(*) as last_7d
from ops_events
where kind = 'settings_read_failed' and at > now() - interval '7 days'
group by read
order by last_24h desc, last_7d desc, read;`;

/**
 * @param {readonly { read: string, last_24h: number | string, last_7d: number | string }[] | null} rows
 *   The query's rows, or `null` when the source could not be read.
 * @returns {string} The report section, in markdown.
 */
export function settingsReadsSection(rows) {
  const head = "### Settings reads (failed, from `ops_events`)";
  if (rows === null) return `${head}\n\nnot measured: the query did not answer.`;
  if (rows.length === 0) return `${head}\n\nnone in the last 7 d.`;
  const lines = rows.map((row) => {
    const day = Number(row.last_24h);
    const status = day >= RED_AT ? `**RED** (≥ ${RED_AT} in 24 h)` : "ok";
    return `| ${row.read} | ${day} | ${Number(row.last_7d)} | ${status} |`;
  });
  return [head, "", "| read | 24 h | 7 d | status |", "|---|---|---|---|", ...lines].join("\n");
}

/** @param {string} text */
export function parseRows(text) {
  try {
    const rows = JSON.parse(text);
    return Array.isArray(rows) ? rows : null;
  } catch {
    return null;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes("--sql")) {
    console.log(SETTINGS_READS_SQL);
  } else {
    let text = "";
    for await (const chunk of process.stdin) text += chunk;
    console.log(settingsReadsSection(parseRows(text)));
  }
}
