// The re-score summary's account of the business's reading: what stored
// profiles gain, what stays unread, and which markets are withdrawn because
// they were read off no words of the site's own (`rescore-blank.ts`).
import { HOME_WORDLESS } from "@/lib/measure/blank-page";
import { BOT_PROTECTION } from "@/lib/measure/challenge";
import type { SiteWithdrawal } from "./rescore-blank";
import type { Row } from "./rescore-run";

/** Issue 1470: how many stored profiles gain each part of the business's
 *  reading, what they gain, and which stay unread. */
export function readingLines(rows: readonly Row[], sites: readonly SiteWithdrawal[] = []): string[] {
  const of = (because: string) => sites.filter((w) => w.because === because).length;
  const named = [...new Set(sites.map((w) => w.domain))].sort();
  const profiled = rows.filter(({ report }) => report.market.kind !== "unmeasured" && typeof report.market.value.profile === "object" && report.market.value.profile !== null);
  const gain = (key: "offerings" | "kind" | "reach") => profiled.filter((row) => row.result.reading[key] !== undefined);
  const tally = (values: readonly string[]): string =>
    [...values.reduce((m, v) => m.set(v, (m.get(v) ?? 0) + 1), new Map<string, number>())]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([v, n]) => `${v} ${n}`)
      .join(", ") || "none";
  // A profile that holds neither the field nor gains it: what the card says
  // is not read yet.
  const unread = (key: "kind" | "reach"): string[] => [
    ...new Set(
      profiled
        .filter(({ report, result }) => report.market.kind !== "unmeasured" && report.market.value.profile[key] === undefined && result.reading[key] === undefined)
        .map(({ report }) => report.domain)
    ),
  ];
  const lines = gain("offerings").map((row) => row.result.reading.offerings!.length);
  const several = [...new Set(gain("offerings").filter((row) => row.result.reading.offerings!.length > 1).map(({ report, result }) => `${report.domain} (${result.reading.offerings!.map((o) => o.category).join(" · ")})`))];
  const count = (pred: (row: Row) => boolean): number => rows.filter(pred).length;
  const kindUnread = unread("kind");
  const reachUnread = unread("reach");
  return [
    `- Scans with a stored profile: ${profiled.length} of ${rows.length}`,
    `- Gain their lines: ${lines.length} (one line ${lines.filter((n) => n === 1).length}, several ${lines.filter((n) => n > 1).length})${several.length === 0 ? "" : ` — ${several.join(", ")}`}`,
    `- Gain a kind: ${gain("kind").length} (${tally(gain("kind").map((row) => row.result.reading.kind!))})`,
    `- Gain a reach: ${gain("reach").length} (${tally(gain("reach").map((row) => row.result.reading.reach!))})`,
    `- Kind left unread, as nothing stored decides it: ${kindUnread.length === 0 ? "none" : kindUnread.join(", ")}`,
    `- Reach left unread, as nothing stored decides it: ${reachUnread.length === 0 ? "none" : reachUnread.join(", ")}`,
    `- Market withdrawn, read off no words of the site's: ${count(withdrawn())} (a protection's page: ${count(withdrawn(BOT_PROTECTION))}; a home page that says nothing: ${count(withdrawn(HOME_WORDLESS))})${withdrawnDomains(rows)}`,
    `- Paid sites' market withdrawn, read off no words of the site's: ${sites.length} (a protection's page: ${of(BOT_PROTECTION)}; a home page that says nothing: ${of(HOME_WORDLESS)})${named.length === 0 ? "" : `: ${named.join(", ")}`}`,
    ...[BOT_PROTECTION, HOME_WORDLESS].map((because) => scoreWithdrawnLine(rows, because)),
  ];
}

/** The reports whose shown score this pass withdraws, as their market was read off no words of the site's own. */
function scoreWithdrawnLine(rows: readonly Row[], because: string): string {
  const off = rows.filter(({ result: { before, after } }) => {
    const presence = after.verdict.factors.presence;
    return before.verdict.scoreAndBand.kind !== "unmeasured" && after.verdict.scoreAndBand.kind === "unmeasured" && presence.kind === "unmeasured" && presence.because === because;
  });
  const domains = [...new Set(off.map((row) => row.report.domain))].sort();
  return `- Score withdrawn (market not measured: ${because}): ${off.length} — ${domains.length === 0 ? "none" : domains.join(", ")}`;
}

/** Whether a row's market is withdrawn, for `because` where given. */
function withdrawn(because?: string): (row: Row) => boolean {
  return (row) =>
    row.result.changes.some((c) => c.path.length === 1 && c.path[0] === "market" && (because === undefined || (c.value as { because?: unknown } | null)?.because === because));
}

/** The domains whose market is withdrawn, so a dry run names them. */
function withdrawnDomains(rows: readonly Row[]): string {
  const domains = [...new Set(rows.filter(withdrawn()).map((row) => row.report.domain))].sort();
  return domains.length === 0 ? "" : `: ${domains.join(", ")}`;
}
