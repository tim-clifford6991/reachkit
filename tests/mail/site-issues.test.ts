// SPEC §9 in mail (#573) — the technical-issue counts reach the `report`
// mail and the `weekly` digest, and the figure a mail states is the one the
// report's card and the Overview's "Needs you" state for the same stored
// reading.
import { describe, expect, it } from "vitest";
import { applyEnvFixture } from "./env-fixture";
import type { SiteIssue, SiteIssuesSection } from "../../src/lib/site-issues/types";

applyEnvFixture();

const { buildReport } = await import("../../src/lib/mail/templates/report");
const { buildWeekly } = await import("../../src/lib/mail/templates/weekly");
const { composeMail } = await import("../../src/lib/mail/shell/compose");
const { issueRows } = await import("../../src/lib/mail/blocks/site-issues");
const { issueChanges } = await import("../../src/lib/site-issues/changes");
const { measured, unmeasured } = await import("../../src/lib/measure/measured");
const { COPY } = await import("../../src/lib/presentation/copy");
const { waitingIssues } = await import("../../src/app/(account)/app/_overview/alerts");
const { readingsOf } = await import("../../src/app/(public)/scan/[domain]/_problems/checks");
const { SITE_CHECK_TITLE } = await import("../../src/lib/presentation/site-issues");

const AT = new Date("2026-09-14T06:00:00.000Z");

const ran = (over: Partial<Extract<SiteIssue, { ran: true }>> & Pick<SiteIssue, "check">): SiteIssue => ({
  ran: true,
  count: 0,
  over: 40,
  unit: "pages",
  severity: "nothing_to_fix",
  doer: "free_fix",
  ...over,
});

function section(issues: readonly SiteIssue[]): SiteIssuesSection {
  return { pagesChecked: 40, stoppedBy: "complete", issues };
}

const LAST_MONDAY = section([
  ran({ check: "page_titles", count: 3, severity: "worth_fixing", doer: "reachkit_rewrites" }),
  ran({ check: "broken_links", count: 2, over: 120, unit: "links", severity: "worth_fixing" }),
  ran({ check: "phone_usability", count: 0 }),
  { check: "slow_pages", ran: false, because: "no_timed_reads" },
]);

// One fixed (broken links 2 → 0), one appeared (phone 0 → 12), one steady.
const THIS_MONDAY = section([
  ran({ check: "page_titles", count: 3, severity: "worth_fixing", doer: "reachkit_rewrites" }),
  ran({ check: "broken_links", count: 0, over: 118, unit: "links" }),
  ran({ check: "phone_usability", count: 12, severity: "critical" }),
  { check: "slow_pages", ran: false, because: "no_timed_reads" },
]);

function reportMail(issues: SiteIssuesSection | null) {
  const mail = buildReport({
    facts: { domain: "a.com", score: "62", band: "Hard to find", aiAnswers: "0 of 9", googleSearch: "0 of 12", limiting: null },
    href: "https://x/scan/a.com",
    removalAddress: "r@x",
    issues,
  });
  return composeMail({ kind: "report", subject: mail.subject, subjectVars: mail.subjectVars, blocks: mail.blocks, reason: mail.reason, reasonVars: mail.reasonVars });
}

describe("the report mail carries the counts the report counted", () => {
  it("one row per fault, titled as its card, in both bodies", () => {
    const composed = reportMail(THIS_MONDAY);
    for (const body of [composed.html, composed.text]) {
      expect(body).toContain(`3/40 · ${COPY["severity.mid"]}`);
      expect(body).toContain(`12/40 · ${COPY["severity.high"]}`);
    }
    // A zero is not a fault and a check that could not run states no figure.
    expect(issueRows(THIS_MONDAY).map((row) => row.label)).toEqual(["check.page-titles.title", "check.phone-usability.title"]);
  });

  it("a report with no checks carries no issue rows", () => {
    expect(issueRows(null)).toEqual([]);
    const facts = (s: SiteIssuesSection | null) =>
      buildReport({
        facts: { domain: "a.com", score: "62", band: "Hard to find", aiAnswers: "0 of 9", googleSearch: "0 of 12", limiting: null },
        href: "https://x",
        removalAddress: "r@x",
        issues: s,
      }).blocks.filter((b) => b.block === "facts").length;
    expect([facts(null), facts(section([ran({ check: "sitemap" })])), facts(THIS_MONDAY)]).toEqual([1, 1, 2]);
  });
});

describe("mail, report and dashboard agree for one measurement", () => {
  it("each fault's count and set match the report card and the Overview figure", () => {
    const mail = new Map(issueRows(THIS_MONDAY).map((row) => [row.label, row.value]));
    const cards = readingsOf(THIS_MONDAY, AT);
    const dashboard = waitingIssues(THIS_MONDAY, { measuredAt: AT, reportHref: "/scan/a.com" });

    expect(cards.phone_usability?.count).toEqual(measured(12, AT));
    expect(cards.page_titles?.count).toEqual(measured(3, AT));
    for (const issue of dashboard) {
      expect(mail.get(SITE_CHECK_TITLE[issue.check])?.startsWith(`${issue.count}/${issue.over} `)).toBe(true);
    }
    expect(dashboard.map((i) => i.check)).toEqual(["phone_usability"]);
  });
});

describe("the weekly digest carries what changed since last Monday", () => {
  const base = {
    scoreDelta: measured(1, AT),
    aiAnswersDelta: measured(0, AT),
    pages: measured([], AT),
    next: measured([], AT),
  };

  it("a fixed issue and a new one, each against last week's count", () => {
    const changes = issueChanges(THIS_MONDAY, LAST_MONDAY, AT);
    expect(changes.kind === "measured" && changes.value.map((c) => [c.check, c.from, c.to])).toEqual([
      ["broken_links", 2, 0],
      ["phone_usability", 0, 12],
    ]);

    const mail = buildWeekly({ ...base, issues: changes });
    const composed = composeMail({ kind: "weekly", subject: mail.subject, blocks: mail.blocks, reason: mail.reason, measurement: { state: "complete" } });
    for (const body of [composed.html, composed.text]) {
      expect(body).toContain(`2 → 0/118 · ${COPY["severity.low"]}`);
      expect(body).toContain(`0 → 12/40 · ${COPY["severity.high"]}`);
      expect(body).not.toContain("3/40");
    }
  });

  it("omits the section when either Monday stored no checks, or nothing moved", () => {
    const blocksWith = (issues: Parameters<typeof buildWeekly>[0]["issues"]) =>
      buildWeekly({ ...base, issues }).blocks.map((b) => b.block);
    const without = blocksWith(undefined);
    expect(issueChanges(THIS_MONDAY, null, AT).kind).toBe("unmeasured");
    expect(issueChanges(null, LAST_MONDAY, AT).kind).toBe("unmeasured");
    expect(blocksWith(issueChanges(THIS_MONDAY, null, AT))).toEqual(without);
    expect(blocksWith(unmeasured("not_attempted", AT))).toEqual(without);
    expect(blocksWith(issueChanges(THIS_MONDAY, THIS_MONDAY, AT))).toEqual(without);
    expect(blocksWith(issueChanges(THIS_MONDAY, LAST_MONDAY, AT))).toContain("facts");
  });
});
