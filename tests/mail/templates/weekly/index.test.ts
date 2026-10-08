// SPEC §8 (2026-10-07, issue 1329) — the Monday mail leads with D22's four
// headline numbers — and REQ-063 c4's four things about each page.
//
// The template holds no conditional of its own: every value that can be
// absent enters as a `Measured<T>`, and which blocks are dropped is
// `blocks/omit.ts`'s one decision. So the assertions below are about the
// *block list* — a template that forgot the omission rule would have to
// have written a branch, and there is none to write.
import { describe, expect, it } from "vitest";
import { applyEnvFixture } from "../../env-fixture";
import type { ListRow, MailBlock, VerdictRow } from "../../../../src/lib/mail/blocks/types";
import type { CopyKey } from "../../../../src/lib/presentation/copy";
import type { WeeklyNumbers } from "../../../../src/lib/mail/templates/weekly";

applyEnvFixture();

const { buildWeekly } = await import("../../../../src/lib/mail/templates/weekly");
const { keptStatRows, omittedIndexes, isMeasuredEmpty } = await import(
  "../../../../src/lib/mail/blocks/omit"
);
const { MAIL_KINDS } = await import("../../../../src/lib/mail/kinds");
const { OWNER_OWED } = await import("../../../../src/lib/presentation/copy/registry");
const { COPY } = await import("../../../../src/lib/presentation/copy");
const { composeMail } = await import("../../../../src/lib/mail/shell/compose");
const { measured, measuredZero, unmeasured } = await import("../../../../src/lib/measure/measured");
const { PAGE_VERDICTS } = await import("../../../../src/lib/presentation/bands");

const AT = new Date("2026-08-31T06:00:00.000Z");
const URL_A = "https://content.example.com/best-onboarding-software";

function standing(over: Record<string, unknown> = {}) {
  return {
    kind: "verdict" as const,
    verdict: "working" as const,
    measuredAt: AT,
    movement: null,
    verifyNote: null,
    ...over,
  };
}

/** D22's four, all measured, on a hosted blog. */
function numbers(over: Partial<WeeklyNumbers> = {}): WeeklyNumbers {
  return {
    mentions: { kind: "rate", rate: measured(34, AT), low: 22, high: 48 },
    pagesCited: measured(3, AT),
    weeks: 4,
    top20: measured(5, AT),
    top20Change: measured(2, AT),
    aiVisits: { fetches: measured(12, AT), windowDays: 7 },
    ...over,
  };
}

function full() {
  return buildWeekly({
    numbers: numbers(),
    pages: measured([{ liveUrl: URL_A, standing: standing() }], AT),
    next: measured([{ targetQuery: "onboarding checklist" }], AT),
  });
}

/** The index of the first block of a kind. The mail's sections are named
 *  rather than counted since #933 gave it two more of them: a suite that
 *  counts positions fails on a section added beside the one it is about,
 *  which says nothing about the rule it is testing. */
function at(blocks: readonly MailBlock[], kind: MailBlock["block"]): number {
  const index = blocks.findIndex((block) => block.block === kind);
  if (index < 0) throw new Error(`no ${kind} block in this mail`);
  return index;
}


/** The two conditional sections, narrowed. A block that is not the arm it
 *  should be, or a list that came back unmeasured where the fixture
 *  measured one, is a failure of the template rather than something to
 *  read past. */
function verdictRows(blocks: readonly MailBlock[]): readonly VerdictRow[] {
  const block = blocks[at(blocks, "verdicts")];
  if (block?.block !== "verdicts") throw new Error("block 2 is not the verdicts section");
  if (block.items.kind === "unmeasured") throw new Error("the verdicts section came back unmeasured");
  return block.items.value;
}

function nextRows(blocks: readonly MailBlock[]): readonly ListRow[] {
  const block = blocks[at(blocks, "list")];
  if (block?.block !== "list") throw new Error("block 3 is not the next-three section");
  if (block.items.kind === "unmeasured") throw new Error("the next-three section came back unmeasured");
  return block.items.value;
}

describe("issue 1329 — the four numbers lead, and the score is not in the mail", () => {
  it("heading, the four numbers, then the pages, the next three and the one button", () => {
    expect(full().blocks.map((block) => block.block)).toEqual(["heading", "stats", "verdicts", "list", "action"]);
  });

  it("the numbers are D22's four in D22's order, and no block names the Discoverability Score", () => {
    const blocks = full().blocks;
    const stats = blocks[at(blocks, "stats")] as Extract<MailBlock, { block: "stats" }>;
    expect(stats.items.map((item) => item.label)).toEqual([
      "mail.weekly.number.mentionRate",
      "mail.weekly.number.pagesCited",
      "mail.weekly.number.top20",
      "mail.weekly.number.aiVisits",
    ]);
    expect(stats.items[0]).toMatchObject({ format: "percent", value: { value: 34 } });
    // The one change that is stored: the top-20 count against last Monday's.
    expect(stats.items.map((item) => item.change?.kind)).toEqual([undefined, undefined, "measured", undefined]);
    expect(JSON.stringify(blocks)).not.toMatch(/score/i);
  });

  it("before a rate may be shown the first number is the count and its sample (D58)", () => {
    const mail = buildWeekly({
      numbers: numbers({ mentions: { kind: "count", mentioned: measuredZero(0, AT), answers: 46 } }),
      pages: measured([], AT),
      next: measured([], AT),
    });
    const stats = mail.blocks[at(mail.blocks, "stats")] as Extract<MailBlock, { block: "stats" }>;
    expect(stats.items[0]).toMatchObject({
      format: "integer",
      value: { kind: "zero", value: 0 },
      note: { text: "mail.weekly.number.mentionRate.early", vars: { answers: "46" } },
    });
  });

  it("a site with no hosted blog has three numbers, not a fourth that says nothing", () => {
    const three = numbers();
    delete (three as { aiVisits?: unknown }).aiVisits;
    const mail = buildWeekly({ numbers: three, pages: measured([], AT), next: measured([], AT) });
    const stats = mail.blocks[at(mail.blocks, "stats")] as Extract<MailBlock, { block: "stats" }>;
    expect(stats.items).toHaveLength(3);
  });

  it("the mail's kind is registered, and it is one the customer may switch off", () => {
    expect(MAIL_KINDS.weekly.stoppable).toBe("toggle");
  });
});

describe("a number that was not measured says so; a list that was not measured omits its section", () => {
  it("an unmeasured headline number keeps its row and states the written line, in both bodies — never a zero", async () => {
    const gap = unmeasured<number>("undeterminable", AT);
    const mail = buildWeekly({
      numbers: numbers({ mentions: { kind: "rate", rate: gap, low: 0, high: 0 }, pagesCited: gap }),
      pages: measured([{ liveUrl: URL_A, standing: standing() }], AT),
      next: measured([{ targetQuery: "q" }], AT),
    });
    expect(omittedIndexes(mail.blocks)).toEqual([]);
    const stats = mail.blocks[at(mail.blocks, "stats")] as Extract<MailBlock, { block: "stats" }>;
    expect(keptStatRows(stats)).toHaveLength(4);

    const composed = await composeMail({
      kind: "weekly",
      subject: mail.subject,
      blocks: mail.blocks,
      reason: mail.reason,
      measurement: { state: "complete" },
    });
    const said = COPY["mail.weekly.number.unmeasured"];
    expect(composed.text).toContain(`${COPY["mail.weekly.number.mentionRate"]}: ${said}`);
    expect(composed.text).toContain(`${COPY["mail.weekly.number.pagesCited"]}: ${said}`);
    expect(composed.text).not.toContain(`${COPY["mail.weekly.number.mentionRate"]}: 0`);
    expect(composed.html.split(said).length - 1).toBe(2);
  });

  it("a measured zero is kept — nothing in the top 20 is a result", () => {
    const mail = buildWeekly({
      numbers: numbers({ top20: measuredZero(0, AT), top20Change: measuredZero(0, AT) }),
      pages: measured([], AT),
      next: measured([], AT),
    });
    expect(omittedIndexes(mail.blocks)).toEqual([]);
  });

  it("an unmeasured verdicts list omits the section; a measured empty one states its written line", () => {
    const unmeasuredPages = buildWeekly({
      numbers: numbers(),
      pages: unmeasured("not_attempted", AT),
      next: measured([], AT),
    });
    expect(omittedIndexes(unmeasuredPages.blocks)).toEqual([at(unmeasuredPages.blocks, "verdicts")]);

    const noPages = buildWeekly({ numbers: numbers(), pages: measured([], AT), next: measured([], AT) });
    expect(omittedIndexes(noPages.blocks)).toEqual([]);
    const verdicts = noPages.blocks[at(noPages.blocks, "verdicts")] as MailBlock;
    expect(isMeasuredEmpty(verdicts)).toBe(true);
    expect(verdicts).toMatchObject({ emptyLine: "mail.weekly.verdicts.none" });
  });
});

describe("REQ-063 c4 — each page's verdict, what moved, the date, and the interval", () => {
  it("a page with no movement takes the plain sentence", () => {
    const rows = verdictRows(full().blocks);
    expect(rows).toEqual([
      { subject: "mail.weekly.page", subjectVars: { page: URL_A }, verdict: PAGE_VERDICTS.working },
    ]);
  });

  it("a page that moved since the previous week carries both figures and the date it was measured", () => {
    const mail = buildWeekly({
      pages: measured(
        [
          {
            liveUrl: URL_A,
            standing: standing({
              movement: {
                previousWeek: "2026-08-24",
                spansWeeks: 1,
                from: measured(3, AT),
                to: measured(9, AT),
                declined: true,
              },
            }),
          },
        ],
        AT
      ),
      next: measured([], AT),
    });
    const [row] = verdictRows(mail.blocks);
    expect(row?.subject).toBe("mail.weekly.page.moved");
    // Both raw figures, in the order they were measured in: the decline is
    // shown and never replaced by the better earlier figure.
    expect(row?.subjectVars).toEqual({ page: URL_A, from: "3", to: "9", measuredAt: "2026-08-31" });
  });

  it("a change spanning more than a week takes the sentence that says so", () => {
    const mail = buildWeekly({
      pages: measured(
        [
          {
            liveUrl: URL_A,
            standing: standing({
              movement: {
                previousWeek: "2026-08-17",
                spansWeeks: 2,
                from: measured(3, AT),
                to: measured(4, AT),
                declined: true,
              },
            }),
          },
        ],
        AT
      ),
      next: measured([], AT),
    });
    const [row] = verdictRows(mail.blocks);
    expect(row?.subject).toBe("mail.weekly.page.moved_over");
    expect(row?.subjectVars).toMatchObject({ weeks: "2" });
  });

  it("a movement whose figures are not both measured states no change rather than a placeholder", () => {
    const mail = buildWeekly({
      pages: measured(
        [
          {
            liveUrl: URL_A,
            standing: standing({
              movement: {
                previousWeek: "2026-08-24",
                spansWeeks: 1,
                from: unmeasured("undeterminable", AT),
                to: measured(4, AT),
                declined: false,
              },
            }),
          },
        ],
        AT
      ),
      next: measured([], AT),
    });
    const [row] = verdictRows(mail.blocks);
    expect(row?.subject).toBe("mail.weekly.page");
  });
});

describe("ADR-071 point 3 — the two row-less standings are stated once for the week, never once per page", () => {
  it("a page the week could not decide, and a page in a week nobody measured, get no row", () => {
    const mail = buildWeekly({
      pages: measured(
        [
          { liveUrl: URL_A, standing: standing() },
          { liveUrl: "https://content.example.com/b", standing: { kind: "not_measured" } },
          { liveUrl: "https://content.example.com/c", standing: { kind: "no_week" } },
        ],
        AT
      ),
      next: measured([], AT),
    });
    const rows = verdictRows(mail.blocks);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.subjectVars?.page).toBe(URL_A);
  });

  it("a page no longer judgeable carries that word in place of the three", () => {
    const mail = buildWeekly({
      pages: measured(
        [
          {
            liveUrl: URL_A,
            standing: { kind: "not_judgeable", cause: "unpublished", lastJudgedWeek: "2026-08-24" },
          },
        ],
        AT
      ),
      next: measured([], AT),
    });
    const rows = verdictRows(mail.blocks);
    expect(rows[0]?.verdict).toBe(PAGE_VERDICTS.not_judgeable);
  });
});

describe("the next three, named by the search each targets", () => {
  it("one row per opportunity, carrying its search and nothing else", () => {
    const rows = nextRows(full().blocks);
    expect(rows).toEqual([{ label: "mail.weekly.next.item", vars: { search: "onboarding checklist" } }]);
  });

  it("the template pads nothing — an empty list stays empty and states its own line", () => {
    const mail = buildWeekly({
      pages: measured([], AT),
      next: measured([], AT),
    });
    expect(nextRows(mail.blocks)).toEqual([]);
    expect(mail.blocks[at(mail.blocks, "list")]).toMatchObject({ emptyLine: "mail.weekly.next.none" });
  });
});

describe("no sentence is written here, and no model text reaches the mail", () => {
  it("every string the template speaks is a registry key, every mail sentence is written, and so are the verdict words", async () => {
    const mail = full();
    const keys: CopyKey[] = [
      mail.subject,
      ...mail.blocks.flatMap((block): CopyKey[] => {
        if (block.block === "stat") return [block.label];
        if (block.block === "verdicts" || block.block === "list") {
          const rows: CopyKey[] =
            block.items.kind === "unmeasured"
              ? []
              : block.block === "verdicts"
                ? block.items.value.flatMap((row) => [row.subject, row.verdict])
                : block.items.value.map((row) => row.label);
          return [block.label, block.emptyLine, ...rows];
        }
        return [];
      }),
    ];
    // S20 wrote the heading, the one line, the button and the two stat
    // labels (ruling 11a, issue #376). Every other mail sentence it speaks
    // — its subject included, which is what stopped it being sent — was
    // owed until issue #458 filled the mail partition on the owner's
    // 2026-09-10 approval. The verdict words are not mail copy: they are
    // `keys/publish.ts`'s, which #459 filled on the same approval.
    const VERDICT_WORDS: readonly CopyKey[] = Object.values(PAGE_VERDICTS);
    const mailKeys = keys.filter((key) => !VERDICT_WORDS.includes(key));
    expect(mailKeys.length).toBeGreaterThan(0);
    for (const key of mailKeys) {
      expect(key.startsWith("mail."), key).toBe(true);
      expect(COPY[key], key).not.toBe("");
      expect(OWNER_OWED, key).not.toContain(key);
    }
    for (const key of VERDICT_WORDS) {
      expect(OWNER_OWED, `${key} is written now — a judged page composes`).not.toContain(key);
    }

    // So a week with no page to judge composes, where it used to be
    // refused on its subject…
    const noPages = buildWeekly({
      pages: measured([], AT),
      next: measured([{ targetQuery: "onboarding checklist" }], AT),
    });
    const composed = await composeMail({
      kind: "weekly",
      subject: noPages.subject,
      blocks: noPages.blocks,
      reason: noPages.reason,
      measurement: { state: "complete" },
    });
    expect(composed.subject).toBe(COPY["mail.weekly.subject"]);
    for (const body of [composed.html, composed.text]) {
      expect(body).toContain(COPY["mail.weekly.verdicts.none"]);
      expect(body).toContain("onboarding checklist");
    }

    // …and a week with a judged page composes too, and says the verdict
    // word it was refused on while the word was owed.
    const judged = await composeMail({
      kind: "weekly",
      subject: mail.subject,
      blocks: mail.blocks,
      reason: mail.reason,
      measurement: { state: "complete" },
    });
    for (const body of [judged.html, judged.text]) {
      expect(body).toContain(COPY["verdict.page.working"]);
    }
  });

  it("no page or opportunity is named by its title — a title is model-written and a mail does not speak it", () => {
    const serialised = JSON.stringify(full());
    // The two identifiers that do appear are an address and a search.
    expect(serialised).toContain(URL_A);
    expect(serialised).toContain("onboarding checklist");
    expect(serialised).not.toMatch(/"title"/);
  });
});

describe("#639 — the composed digest, as an inbox receives it", () => {
  const inOrder = (body: string, parts: readonly string[]): void => {
    const at = parts.map((part) => body.indexOf(part));
    expect(at.every((i) => i >= 0), `every part is present: ${at.join(",")}`).toBe(true);
    expect([...at].sort((x, y) => x - y)).toEqual(at);
  };
  const compose = async (mail: ReturnType<typeof full>, measurement: Parameters<typeof composeMail>[0]["measurement"]) =>
    composeMail({ kind: "weekly", subject: mail.subject, blocks: mail.blocks, reason: mail.reason, measurement: measurement! });
  const action = COPY["mail.weekly.action"];

  it("a partial week reads heading, line, sections, the missed-sections line, the one action, then the reason", async () => {
    const { html, text } = await compose(full(), { state: "partial", unmeasured: ["mail.section.rivals"] });
    const missed = COPY["mail.week_partly_measured"].split("{sections}")[0] ?? "";
    for (const [body, actionMark] of [[html, `>${action}</span>`], [text, action]] as const) {
      inOrder(body, [COPY["mail.weekly.heading"], COPY["mail.weekly.number.mentionRate"], COPY["mail.weekly.next"], missed, actionMark, COPY["mail.reason.weekly"]]);
    }
    expect([...html.matchAll(/<a href="/g)]).toHaveLength(1);
    // #934: the fill is on React Email's `Button` itself, not on a cell
    // wrapped around it. Still exactly one solid fill.
    expect(html).toMatch(/data-rk-action="primary"[^>]*background:#[0-9a-f]{6};color:#[0-9a-f]{6}/);
    expect(html).not.toMatch(/\sclass="/);
  });

  it("names the tracked questions that now name the site, each with its answer's address, in both bodies (D16)", async () => {
    const answerUrl = "https://www.google.com/search?q=crm+for+dentists";
    const mail = buildWeekly({
      pages: measured([], AT),
      next: measured([], AT),
      nowNamed: measured([{ search: "crm for dentists", answerUrl }], AT),
    });
    const { html, text } = await compose(mail, { state: "complete" });
    for (const body of [html, text]) {
      inOrder(body, [COPY["mail.weekly.nowNamed"], "crm for dentists"]);
    }
    expect(html).toContain(`href="${answerUrl}"`);
    expect(text).toContain(`crm for dentists: ${answerUrl}`);
  });

  it("an unmeasured week states no section and no figure — only the line with the next due date, then the action", async () => {
    const gap = unmeasured<never>("undeterminable", AT);
    const mail = buildWeekly({ pages: gap, next: gap });
    const { html, text } = await compose(mail, { state: "none", nextDueOn: new Date("2026-09-14T06:00:00Z") });
    for (const body of [html, text]) {
      inOrder(body, [COPY["mail.weekly.heading"], "2026-09-14", action, COPY["mail.reason.weekly"]]);
      for (const label of ["mail.weekly.number.mentionRate", "mail.weekly.number.unmeasured", "mail.weekly.verdicts", "mail.weekly.next"] as const) {
        expect(body).not.toContain(COPY[label]);
      }
    }
  });
});
