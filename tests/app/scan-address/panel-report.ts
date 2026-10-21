// The customer panel's stored free reports, read as the report screen reads
// them. Not a suite. 0¢: nothing is measured.
import { readFileSync } from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ReportView } from "@/app/(public)/scan/[domain]/_address/report-view";
import { readStoredReport, type StoredReport } from "@/lib/scan/report";

/** A SaaS and a local business, each from the walk that stored it. */
export const PANEL = {
  saas: { walk: "2026-10-15-1449-after", domain: "savvycal.com" },
  local: { walk: "2026-10-15", domain: "austinplumbery.com" },
} as const;

export function panelReport(which: keyof typeof PANEL): StoredReport {
  const { walk, domain } = PANEL[which];
  const file = path.resolve(import.meta.dirname, `../../../docs/walk/free/${walk}.json`);
  const sites = (JSON.parse(readFileSync(file, "utf8")) as { sites: { domain: string; stored: { scan: { report: unknown } } | null }[] }).sites;
  const site = sites.find((s) => s.domain === domain && s.stored !== null);
  if (site === undefined) throw new Error(`no stored report for ${domain} in ${walk}`);
  return readStoredReport(site.stored!.scan.report);
}

export function renderReport(report: StoredReport): string {
  return renderToStaticMarkup(
    React.createElement(ReportView, {
      state: { report, notice: null, control: { kind: "none" }, correction: { offered: true, as: "first" } },
    })
  );
}
