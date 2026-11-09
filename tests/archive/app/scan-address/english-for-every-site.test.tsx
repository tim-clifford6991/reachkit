// ReachKit's own screens and mail are English whatever a site is measured
// in (SPEC §6, owner 2026-10-15, issue 1443). A German site is still
// measured in Germany, in German (`tests/scan/run/run.test.ts`), and its own
// pages are still written in German (`tests/publish/render/made.test.ts`).
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { ReportView } from "@/app/(public)/scan/[domain]/_address/report-view";
import { FIXTURE_REPORT } from "@/app/(public)/scan/[domain]/_fixture/states";
import { composeMail } from "@/lib/mail/shell/compose";
import { copy } from "@/lib/presentation/copy";

const GERMAN = { country: "DE", language: "de" } as const;

describe("a German site is read in English", () => {
  it("its free report is English, and says in English where it was measured", () => {
    const html = renderToStaticMarkup(
      React.createElement(ReportView, {
        state: { report: { ...FIXTURE_REPORT, locale: GERMAN }, notice: null, control: { kind: "none" }, correction: { offered: true, as: "first" } },
      })
    );
    expect(html).toContain(copy("report.measurement.in", { country: "Germany", language: "German" }));
    expect(html).not.toMatch(/Deutschland|Deutsch\b/);
  });

  // A mail is composed with no language at all: the weekly, draft-ready and
  // published mails no longer read the site's locale.
  it("its mail is English", async () => {
    const mail = await composeMail({ kind: "report", subject: "mail.weekly.subject", blocks: [{ block: "heading", text: "mail.nothing_to_report" }] });
    expect(mail.subject).toBe(copy("mail.weekly.subject"));
    expect(mail.text).toContain(copy("mail.nothing_to_report"));
  });
});
