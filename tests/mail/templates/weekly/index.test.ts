// The Monday mail leads with Overview's numbers (the simple model, owner
// 2026-10-19) — and REQ-063 c4's four things about each page.
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
const { omittedIndexes, isMeasuredEmpty } = await import(
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

const STEPS = ["draft.ladder.found", "draft.ladder.showing", "draft.ladder.first-page"] as const;

/** Every weekly number measured, on a hosted blog, in a week that is not a month's first. */
function numbers(over: Partial<WeeklyNumbers> = {}): WeeklyNumbers {
  return {
    live: measured(12, AT),
    planned: measured(7, AT),
    google: {
      steps: STEPS.map((name, i) => ({ name, count: measured([11, 5, 1][i]!, AT), of: 12 })),
      early: false,
      visits: measured(9, AT),
      climb: { search: "tankless water heater austin", from: 62, to: 24, climbing: true },
    },
    ai: { linked: measured(2, AT), asked: 12, reads: measured(14, AT) },
    ...over,
  };
}

const statsOf = (blocks: readonly MailBlock[]) =>
  blocks.filter((block): block is Extract<MailBlock, { block: "stats" }> => block.block === "stats");

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

describe("the numbers are Pages, Google and AI, then the pages, the week and the one button", () => {
  it("heading, the three groups and the climb, then the pages, the week and the button", () => {
    const blocks = full().blocks;
    expect(blocks.map((block) => block.block)).toEqual(["heading", "stats", "stats", "paragraph", "stats", "verdicts", "list", "action"]);
    expect(statsOf(blocks).map((group) => group.items.map((item) => item.label))).toEqual([
      ["mail.weekly.pages.live", "mail.weekly.pages.planned"],
      [...STEPS, "mail.weekly.google.visits"],
      ["mail.weekly.ai.linked", "mail.weekly.ai.reads"],
    ]);
    expect(blocks[at(blocks, "paragraph")]).toMatchObject({
      text: "mail.weekly.google.climb.climbing",
      vars: { search: "tankless water heater austin", from: "62", to: "24" },
    });
  });

  it("off a hosted blog there is no visits or reads row, not a row that says nothing", () => {
    const mail = buildWeekly({
      numbers: numbers({
        google: { steps: [], early: false, climb: null },
        ai: { linked: measured(2, AT), asked: 12 },
      }),
      pages: measured([], AT),
      next: measured([], AT),
    });
    expect(statsOf(mail.blocks).flatMap((group) => group.items.map((item) => item.label))).toEqual([
      "mail.weekly.pages.live",
      "mail.weekly.pages.planned",
      "mail.weekly.ai.linked",
    ]);
    expect(mail.blocks.find((block) => block.block === "paragraph")).toMatchObject({ text: "mail.weekly.google.climb.none" });
  });

  it("the month's figures are drawn only where the caller read them, under their own line", () => {
    const month = { score: { value: measured(31, AT), change: measured(4, AT) }, reputation: { value: measured(11, AT), answers: 184, weeks: 4 } };
    const blocks = buildWeekly({ numbers: numbers({ month }), pages: measured([], AT), next: measured([], AT) }).blocks;
    const last = statsOf(blocks).at(-1)!;
    expect(last.items.map((item) => item.label)).toEqual(["mail.weekly.month.score", "mail.weekly.month.reputation"]);
    expect(last.items[1]).toMatchObject({ note: { vars: { answers: "184", weeks: "4" } } });
    expect(blocks[blocks.indexOf(last) - 1]).toMatchObject({ block: "paragraph", text: "mail.weekly.month" });
    expect(JSON.stringify(full().blocks)).not.toContain("mail.weekly.month");
  });

  it("the mail's kind is registered, and it is one the customer may switch off", () => {
    expect(MAIL_KINDS.weekly.stoppable).toBe("toggle");
  });
});

describe("a number that was not measured says so; a list that was not measured omits its section", () => {
  it("an unmeasured step and an unasked question keep their rows and say so, in both bodies — never a zero", async () => {
    const gap = unmeasured<number>("undeterminable", AT);
    const mail = buildWeekly({
      numbers: numbers({
        google: { steps: STEPS.map((name) => ({ name, count: gap, of: 3 })), early: false },
        ai: { linked: unmeasured<number>("not_attempted", AT), asked: 0 },
      }),
      pages: measured([{ liveUrl: URL_A, standing: standing() }], AT),
      next: measured([{ targetQuery: "q" }], AT),
    });
    expect(omittedIndexes(mail.blocks)).toEqual([]);
    const composed = await composeMail({
      kind: "weekly",
      subject: mail.subject,
      blocks: mail.blocks,
      reason: mail.reason,
      measurement: { state: "complete" },
    });
    expect(composed.text).toContain(`${COPY["draft.ladder.found"]}: ${COPY["mail.weekly.number.unmeasured"]}`);
    expect(composed.text).toContain(`${COPY["mail.weekly.ai.linked"]}: ${COPY["mail.weekly.ai.early"]}`);
    expect(composed.text).not.toContain(`${COPY["mail.weekly.ai.linked"]}: 0`);
    expect(composed.html.split(COPY["mail.weekly.number.unmeasured"]).length - 1).toBe(3);
  });

  it("before any page shows in results, the steps past Found say it is too early instead of two zeros", () => {
    const blocks = buildWeekly({
      numbers: numbers({
        google: { steps: STEPS.map((name, i) => ({ name, count: i === 0 ? measured(2, AT) : measuredZero(0, AT), of: 3 })), early: true },
      }),
      pages: measured([], AT),
      next: measured([], AT),
    }).blocks;
    expect(statsOf(blocks)[1]!.items.map((item) => item.label)).toEqual(["draft.ladder.found"]);
    expect(blocks.find((block) => block.block === "paragraph")).toMatchObject({ text: "mail.weekly.google.early" });
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

  it("a page no stored search result held is said to be not seen, beside its verdict, and never not indexed (issue 1538)", () => {
    const mail = buildWeekly({
      numbers: numbers(),
      pages: measured(
        [
          { liveUrl: URL_A, standing: standing({ verdict: "not_working" }), indexState: "not_verified" as const },
          { liveUrl: URL_A, standing: standing(), indexState: "not_verified" as const },
        ],
        AT
      ),
      next: measured([], AT),
    });
    expect(verdictRows(mail.blocks)).toEqual([
      { subject: "mail.weekly.page.not_verified", subjectVars: { page: URL_A }, verdict: PAGE_VERDICTS.not_working },
      { subject: "mail.weekly.page", subjectVars: { page: URL_A }, verdict: PAGE_VERDICTS.working },
    ]);
    expect(COPY["mail.weekly.page.not_verified"]).not.toMatch(/not indexed/i);
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
      inOrder(body, [COPY["mail.weekly.heading"], COPY["mail.weekly.pages.live"], COPY["mail.weekly.next"], missed, actionMark, COPY["mail.reason.weekly"]]);
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
      for (const label of ["mail.weekly.pages.live", "mail.weekly.number.unmeasured", "mail.weekly.verdicts", "mail.weekly.next"] as const) {
        expect(body).not.toContain(COPY[label]);
      }
    }
  });
});
