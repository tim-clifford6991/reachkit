// BUILD §12's `weekly` row — "score delta, AI answers delta, pages
// verdicts, next 3 — all values conditional: a missing number omits its
// section, never prints 0" — and REQ-063 c4's four things.
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

function full() {
  return buildWeekly({
    scoreDelta: measured(6, AT),
    aiAnswersDelta: measured(2, AT),
    // SPEC §8 (2026-09-20, #933): the four Overview numbers themselves,
    // beside the two deltas the week already carried.
    score: measured(62, AT),
    searches: measured(31, AT),
    searchesDelta: measured(4, AT),
    aiAnswers: measured(5, AT),
    pagesLive: measured(9, AT),
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

describe("§12's four sections, in §12's order", () => {
  it("score delta, AI answers delta, page verdicts, next 3", () => {
    // Issue #376, UI-SPEC S20: the shell's heading and its one line come
    // first — "Only what was measured. A number that was not measured is
    // not here." — and one solid button closes it. §12's four sections
    // keep their order between them.
    // #933 restyles it to the approved board: the score is the one number
    // up top with its change, the headline sentence says which way the week
    // went, and the other three numbers stand together. §12's four sections
    // keep their order between the shell's own head and its one button.
    expect(full().blocks.map((block) => block.block)).toEqual([
      "heading",
      "hero",
      "paragraph",
      "paragraph",
      "stats",
      "verdicts",
      "list",
      "action",
    ]);
  });

  it("the score leads with its change beside it, and the other three stand together", () => {
    const blocks = full().blocks;
    expect(blocks[at(blocks, "hero")]).toMatchObject({
      block: "hero",
      label: "mail.weekly.score",
      format: "integer",
      value: { kind: "measured", value: 62 },
      change: { kind: "measured", value: 6 },
    });
    const stats = blocks[at(blocks, "stats")] as Extract<MailBlock, { block: "stats" }>;
    expect(stats.items.map((item) => item.label)).toEqual([
      "mail.weekly.searches",
      "mail.weekly.aiAnswers",
      "mail.weekly.pagesLive",
    ]);
    // Each is a level with its own change — never a delta standing alone.
    expect(stats.items.every((item) => item.format === "integer")).toBe(true);
    expect(stats.items[1]?.change).toMatchObject({ kind: "measured", value: 2 });
  });

  it("the headline sentence is chosen by the direction the week actually went", () => {
    const line = (delta: number): unknown =>
      buildWeekly({
        scoreDelta: measured(delta, AT),
        aiAnswersDelta: measured(0, AT),
        pages: measured([], AT),
        next: measured([], AT),
      }).blocks[2];
    expect(line(4)).toMatchObject({ text: "mail.weekly.moved.up" });
    expect(line(-4)).toMatchObject({ text: "mail.weekly.moved.down" });
    expect(line(0)).toMatchObject({ text: "mail.weekly.moved.flat" });
    // A week that measured no score claims no direction.
    expect(
      buildWeekly({
        scoreDelta: unmeasured("not_attempted", AT),
        aiAnswersDelta: unmeasured("not_attempted", AT),
        pages: unmeasured("not_attempted", AT),
        next: unmeasured("not_attempted", AT),
      }).blocks[2]
    ).toMatchObject({ text: "mail.weekly.moved.flat" });
  });

  it("the mail's kind is registered, and it is one the customer may switch off", () => {
    expect(MAIL_KINDS.weekly.stoppable).toBe("toggle");
  });
});

describe("REQ-064 c1/c2 — a missing number omits its section, a measured zero prints", () => {
  it("a number nothing measured omits its own row, and takes nothing else with it", () => {
    const mail = buildWeekly({
      scoreDelta: unmeasured("not_attempted", AT),
      aiAnswersDelta: measured(2, AT),
      score: unmeasured("not_attempted", AT),
      aiAnswers: measured(5, AT),
      searches: unmeasured("not_attempted", AT),
      pagesLive: measured(9, AT),
      pages: measured([{ liveUrl: URL_A, standing: standing() }], AT),
      next: measured([{ targetQuery: "q" }], AT),
    });
    // The score was not measured, so the number up top goes — and only it.
    expect(omittedIndexes(mail.blocks)).toEqual([at(mail.blocks, "hero")]);
    // The group stays, with the row nothing measured left out of it.
    const stats = mail.blocks[at(mail.blocks, "stats")] as Extract<MailBlock, { block: "stats" }>;
    expect(keptStatRows(stats).map((item) => item.label)).toEqual([
      "mail.weekly.aiAnswers",
      "mail.weekly.pagesLive",
    ]);
  });

  it("a week that measured none of the four drops the whole group", () => {
    const gap = unmeasured<number>("not_attempted", AT);
    const mail = buildWeekly({
      scoreDelta: gap,
      aiAnswersDelta: gap,
      score: gap,
      aiAnswers: gap,
      searches: gap,
      pagesLive: gap,
      pages: measured([], AT),
      next: measured([], AT),
    });
    expect(omittedIndexes(mail.blocks)).toContain(at(mail.blocks, "stats"));
  });

  it("a measured zero delta is kept — no movement is a result", () => {
    const mail = buildWeekly({
      scoreDelta: measuredZero(0, AT),
      aiAnswersDelta: measuredZero(0, AT),
      score: measuredZero(0, AT),
      aiAnswers: measuredZero(0, AT),
      searches: measuredZero(0, AT),
      pagesLive: measuredZero(0, AT),
      pages: measured([], AT),
      next: measured([], AT),
    });
    expect(omittedIndexes(mail.blocks)).toEqual([]);
  });

  it("an unmeasured verdicts list omits the section; a measured empty one states its written line", () => {
    const unmeasuredPages = buildWeekly({
      scoreDelta: measured(1, AT),
      aiAnswersDelta: measured(1, AT),
      pages: unmeasured("not_attempted", AT),
      next: measured([], AT),
    });
    expect(omittedIndexes(unmeasuredPages.blocks)).toEqual([
      at(unmeasuredPages.blocks, "hero"),
      at(unmeasuredPages.blocks, "stats"),
      at(unmeasuredPages.blocks, "verdicts"),
    ]);

    const noPages = buildWeekly({
      scoreDelta: measured(1, AT),
      aiAnswersDelta: measured(1, AT),
      pages: measured([], AT),
      next: measured([], AT),
    });
    expect(omittedIndexes(noPages.blocks)).toEqual([
      at(noPages.blocks, "hero"),
      at(noPages.blocks, "stats"),
    ]);
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
      scoreDelta: measured(1, AT),
      aiAnswersDelta: measured(1, AT),
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
      scoreDelta: measured(1, AT),
      aiAnswersDelta: measured(1, AT),
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
      scoreDelta: measured(1, AT),
      aiAnswersDelta: measured(1, AT),
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
      scoreDelta: measured(1, AT),
      aiAnswersDelta: measured(1, AT),
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
      scoreDelta: measured(1, AT),
      aiAnswersDelta: measured(1, AT),
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
      scoreDelta: measured(1, AT),
      aiAnswersDelta: measured(1, AT),
      pages: measured([], AT),
      next: measured([], AT),
    });
    expect(nextRows(mail.blocks)).toEqual([]);
    expect(mail.blocks[at(mail.blocks, "list")]).toMatchObject({ emptyLine: "mail.weekly.next.none" });
  });
});

describe("no sentence is written here, and no model text reaches the mail", () => {
  it("every string the template speaks is a registry key, every mail sentence is written, and so are the verdict words", () => {
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
      scoreDelta: measured(6, AT),
      aiAnswersDelta: measured(2, AT),
      pages: measured([], AT),
      next: measured([{ targetQuery: "onboarding checklist" }], AT),
    });
    const composed = composeMail({
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
    const judged = composeMail({
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
  const compose = (mail: ReturnType<typeof full>, measurement: Parameters<typeof composeMail>[0]["measurement"]) =>
    composeMail({ kind: "weekly", subject: mail.subject, blocks: mail.blocks, reason: mail.reason, measurement: measurement! });
  const action = COPY["mail.weekly.action"];

  it("a partial week reads heading, line, sections, the missed-sections line, the one action, then the reason", () => {
    const { html, text } = compose(full(), { state: "partial", unmeasured: ["mail.section.rivals"] });
    const missed = COPY["mail.week_partly_measured"].split("{sections}")[0] ?? "";
    for (const [body, actionMark] of [[html, `>${action}</a>`], [text, action]] as const) {
      inOrder(body, [COPY["mail.weekly.heading"], COPY["mail.weekly.score"], COPY["mail.weekly.next"], missed, actionMark, COPY["mail.reason.weekly"]]);
    }
    expect([...html.matchAll(/<a href="/g)]).toHaveLength(1);
    expect(html).toMatch(/<td bgcolor="#[0-9a-f]{6}"[^>]*><a href=/);
    expect(html).not.toMatch(/\sclass="/);
  });

  it("an unmeasured week states no section and no figure — only the line with the next due date, then the action", () => {
    const gap = unmeasured<never>("undeterminable", AT);
    const mail = buildWeekly({ scoreDelta: gap, aiAnswersDelta: gap, pages: gap, next: gap });
    const { html, text } = compose(mail, { state: "none", nextDueOn: new Date("2026-09-14T06:00:00Z") });
    for (const body of [html, text]) {
      inOrder(body, [COPY["mail.weekly.heading"], "2026-09-14", action, COPY["mail.reason.weekly"]]);
      for (const label of ["mail.weekly.score", "mail.weekly.aiAnswers", "mail.weekly.verdicts", "mail.weekly.next"] as const) {
        expect(body).not.toContain(COPY[label]);
      }
    }
  });
});
