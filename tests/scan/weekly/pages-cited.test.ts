// Issue 1551 (owner, 2026-10-19; SEO review R5.1) — the Monday mail leads
// with the published pages' own questions an AI answer linked, read from
// the week's stored report, and names the mention rate as brand reputation.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";
import { fakeDb, type Row } from "../../publish/harness";
import type { MailBlock } from "../../../src/lib/mail/blocks/types";

applyEnvFixture();
const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

const { weekMovement } = await import("@/lib/scan/weekly");
const { buildWeekly } = await import("../../../src/lib/mail/templates/weekly");
const { measured, measuredZero } = await import("../../../src/lib/measure/measured");
const { COPY } = await import("../../../src/lib/presentation/copy");

const AT = new Date(Date.UTC(2026, 9, 19, 6, 0, 0));
const WEEK = "2026-10-19";

const answered = (citedDomains: string[]) => ({ kind: "answered", citedDomains, namesCustomer: citedDomains.includes("acme.test") });
const row = (search: string, cells: Record<string, unknown>[]) => ({
  publicationId: search,
  liveUrl: `https://content.acme.test/${search}`,
  question: { n: 13, wording: { kind: "generated", text: search }, search },
  cell: cells[0],
  engines: cells.map((cell, i) => ({ engine: ["ai_overview", "ai_mode", "chatgpt"][i], cell })),
});

beforeEach(() => {
  db.reset();
  db.seed("scans", [
    {
      id: "scan-1",
      site_id: "site-1",
      tier: "weekly",
      week_start: WEEK,
      status: "done",
      report: {
        version: 13,
        verdict: { scoreAndBand: { kind: "unmeasured", reason: "not_attempted", at: AT.toISOString() } },
        aiAnswers: null,
        pageQuestions: {
          measuredAt: AT.toISOString(),
          ownDomain: "acme.test",
          tracked: 15,
          cap: 24,
          retired: [],
          rows: [
            row("cited", [{ kind: "no_answer" }, answered(["docs.acme.test", "g2.com"]), { kind: "unmeasured", reason: "not_attempted" }]),
            row("named elsewhere", [answered(["g2.com"]), { kind: "no_answer" }, { kind: "no_answer" }]),
            row("unread", [{ kind: "unmeasured", reason: "undeterminable" }]),
          ],
        },
      },
    } as Row,
  ]);
});

describe("the pages' own questions cited, in the Monday mail", () => {
  it("counts the page questions whose answer links the site, over those read", async () => {
    const movement = await weekMovement({ siteId: "site-1", weekStart: WEEK, at: AT });
    expect(movement.pagesCited).toMatchObject({ kind: "measured", value: { cited: 1, asked: 2 } });
  });

  it("is the first number, beside a mention rate of zero named as brand reputation", () => {
    const mail = buildWeekly({
      numbers: {
        pageQuestions: { cited: measured(1, AT), asked: 2 },
        mentions: { kind: "count", mentioned: measuredZero(0, AT), answers: 40 },
        pagesCited: measuredZero(0, AT),
        weeks: 4,
        top20: measuredZero(0, AT),
      },
      pages: measured([], AT),
      next: measured([], AT),
    });
    const stats = mail.blocks.find((block) => block.block === "stats") as Extract<MailBlock, { block: "stats" }>;
    expect(stats.items[0]).toMatchObject({
      label: "mail.weekly.number.pageQuestions",
      value: { value: 1 },
      note: { text: "mail.weekly.number.pageQuestions.of", vars: { asked: "2" } },
    });
    expect(stats.items.at(-1)?.label).toBe("mail.weekly.number.mentionRate");
    expect(COPY["mail.weekly.number.mentionRate"]).toMatch(/^Brand reputation/);
  });
});
