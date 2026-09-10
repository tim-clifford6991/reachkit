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
const { omittedIndexes, isMeasuredEmpty } = await import("../../../../src/lib/mail/blocks/omit");
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
    pages: measured([{ liveUrl: URL_A, standing: standing() }], AT),
    next: measured([{ targetQuery: "onboarding checklist" }], AT),
  });
}


/** The two conditional sections, narrowed. A block that is not the arm it
 *  should be, or a list that came back unmeasured where the fixture
 *  measured one, is a failure of the template rather than something to
 *  read past. */
function verdictRows(blocks: readonly MailBlock[]): readonly VerdictRow[] {
  const block = blocks[4];
  if (block?.block !== "verdicts") throw new Error("block 2 is not the verdicts section");
  if (block.items.kind === "unmeasured") throw new Error("the verdicts section came back unmeasured");
  return block.items.value;
}

function nextRows(blocks: readonly MailBlock[]): readonly ListRow[] {
  const block = blocks[5];
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
    expect(full().blocks.map((block) => block.block)).toEqual([
      "heading",
      "paragraph",
      "stat",
      "stat",
      "verdicts",
      "list",
      "action",
    ]);
  });

  it("the two deltas carry the delta format — a delta, not a level", () => {
    const [, , score, ai] = full().blocks;
    expect(score).toMatchObject({ block: "stat", label: "mail.weekly.score", format: "delta" });
    expect(ai).toMatchObject({ block: "stat", label: "mail.weekly.aiAnswers", format: "delta" });
  });

  it("the mail's kind is registered, and it is one the customer may switch off", () => {
    expect(MAIL_KINDS.weekly.stoppable).toBe("toggle");
  });
});

describe("REQ-064 c1/c2 — a missing number omits its section, a measured zero prints", () => {
  it("an unmeasured delta omits its stat entirely, and takes nothing else with it", () => {
    const mail = buildWeekly({
      scoreDelta: unmeasured("not_attempted", AT),
      aiAnswersDelta: measured(2, AT),
      pages: measured([{ liveUrl: URL_A, standing: standing() }], AT),
      next: measured([{ targetQuery: "q" }], AT),
    });
    expect(omittedIndexes(mail.blocks)).toEqual([2]);
  });

  it("a measured zero delta is kept — no movement is a result", () => {
    const mail = buildWeekly({
      scoreDelta: measuredZero(0, AT),
      aiAnswersDelta: measuredZero(0, AT),
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
    expect(omittedIndexes(unmeasuredPages.blocks)).toEqual([4]);

    const noPages = buildWeekly({
      scoreDelta: measured(1, AT),
      aiAnswersDelta: measured(1, AT),
      pages: measured([], AT),
      next: measured([], AT),
    });
    expect(omittedIndexes(noPages.blocks)).toEqual([]);
    expect(isMeasuredEmpty(noPages.blocks[4] as MailBlock)).toBe(true);
    expect(noPages.blocks[4]).toMatchObject({ emptyLine: "mail.weekly.verdicts.none" });
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
    expect(mail.blocks[5]).toMatchObject({ emptyLine: "mail.weekly.next.none" });
  });
});

describe("no sentence is written here, and no model text reaches the mail", () => {
  it("every string the template speaks is a registry key, every mail sentence is written, and only the verdict words still stop it", () => {
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
    // `keys/publish.ts`'s, #458 did not fill them, and they are still owed.
    const VERDICT_WORDS: readonly CopyKey[] = Object.values(PAGE_VERDICTS);
    const mailKeys = keys.filter((key) => !VERDICT_WORDS.includes(key));
    expect(mailKeys.length).toBeGreaterThan(0);
    for (const key of mailKeys) {
      expect(key.startsWith("mail."), key).toBe(true);
      expect(COPY[key], key).not.toBe("");
      expect(OWNER_OWED, key).not.toContain(key);
    }
    for (const key of VERDICT_WORDS) {
      expect(OWNER_OWED, `${key} is written now — a judged page composes`).toContain(key);
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

    // …and a week with a judged page is still refused, on the verdict word.
    expect(() =>
      composeMail({
        kind: "weekly",
        subject: mail.subject,
        blocks: mail.blocks,
        reason: mail.reason,
        measurement: { state: "complete" },
      })
    ).toThrow(/verdict\.page\.working/);
  });

  it("no page or opportunity is named by its title — a title is model-written and a mail does not speak it", () => {
    const serialised = JSON.stringify(full());
    // The two identifiers that do appear are an address and a search.
    expect(serialised).toContain(URL_A);
    expect(serialised).toContain("onboarding checklist");
    expect(serialised).not.toMatch(/"title"/);
  });
});
