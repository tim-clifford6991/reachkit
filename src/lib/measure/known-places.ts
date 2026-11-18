// A stored report as a page's place is read from it. A result behind a Google redirect has no known address, so it
// is never a page's row; where it may be the site's own page, the result says nothing of where that page stands.
import { googleWrapper, hidesOwnPage } from "@/lib/market/rivals/domains";
import { unmeasured } from "./measured";
import type { PlaceReport } from "./page-reading";

export function knownPlaces<R extends PlaceReport & { domain: string }>(report: R): R {
  const known = <T extends { url: string }>(rows: readonly T[]): T[] | null =>
    hidesOwnPage(rows, report.domain) ? null : rows.filter((row) => googleWrapper(row.url) === null);
  return {
    ...report,
    serps: report.serps.map((serp) => {
      const organic = serp.kind === "unmeasured" ? null : known(serp.value.organic);
      if (serp.kind === "unmeasured" || organic === null) return serp.kind === "unmeasured" ? serp : unmeasured("undeterminable", serp.at);
      return { ...serp, value: { ...serp.value, organic } };
    }),
    pageQuestions:
      report.pageQuestions === null
        ? null
        : { ...report.pageQuestions, rows: report.pageQuestions.rows.map((row) => (row.organic == null ? row : { ...row, organic: known(row.organic) })) },
  };
}
