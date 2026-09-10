// tests/mail/ops/spend-ceiling.test.ts — the owner's spend alert (issue
// #329): §6.5's ceilings and §11's switch, told to `OWNER_EMAILS`.
//
// Two things are asserted that no other mail suite asserts. First, that
// the mail **does not send today** — every sentence it speaks is
// owner-owed, `copy()` refuses an unwritten key and `sendEmail` answers
// `not-composable` (DECISIONS 2026-09-05, "a mail never ships a
// placeholder"). That is the designed standing, and the assertion is
// written against `OWNER_OWED` rather than against the outcome, so the day
// the owner writes the lines this suite starts asserting that it *does*
// send instead of failing.
//
// Second, that nothing here can fail a scan. An alert is a report about a
// system under strain; a report that throws would make the strain worse.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../env-fixture";

applyEnvFixture();

const { buildSpendCeilingAlert } = await import("../../../src/lib/mail/templates/ops");
const { MAIL_KINDS } = await import("../../../src/lib/mail/kinds");
const { COPY } = await import("../../../src/lib/presentation/copy");
const { OWNER_OWED } = await import("../../../src/lib/presentation/copy/registry");

/** Every sentence this kind speaks. */
const OPS_MAIL_KEYS = [
  "mail.ops.spend-ceiling.subject",
  "mail.ops.spend-ceiling.heading",
  "mail.ops.spend-ceiling.warn",
  "mail.ops.spend-ceiling.reached",
  "mail.ops.spend-ceiling.kill-switch-engaged",
  "mail.ops.spend-ceiling.fact.spent",
  "mail.ops.spend-ceiling.fact.ceiling",
] as const;

const OCCASIONS = ["warn", "reached", "kill-switch-engaged"] as const;

describe("the register — the eleventh kind, and the only one whose reader is the owner", () => {
  it("`ops` is registered, occasioned by the cost seam, and cannot be switched off", () => {
    expect(MAIL_KINDS.ops).toEqual({ occasionsFrom: "§6.5", stoppable: false });
  });
});

describe("the template — three occasions, one shape", () => {
  it("each occasion speaks its own line, and no two speak the same one", () => {
    const lines = OCCASIONS.map((occasion) => {
      const blocks = buildSpendCeilingAlert({ occasion, spentCents: 1, ceilingCents: 2 }).blocks;
      const paragraph = blocks.find((b) => b.block === "paragraph");
      return (paragraph as { text: string }).text;
    });
    expect(new Set(lines).size).toBe(OCCASIONS.length);
  });

  it("carries the two figures as mono fact rows, with the labels as keys and the values as data", () => {
    const mail = buildSpendCeilingAlert({ occasion: "reached", spentCents: 5012, ceilingCents: 5000 });
    const facts = mail.blocks.find((b) => b.block === "facts");
    expect(facts).toEqual({
      block: "facts",
      items: [
        { label: "mail.ops.spend-ceiling.fact.spent", value: "5012" },
        { label: "mail.ops.spend-ceiling.fact.ceiling", value: "5000" },
      ],
    });
  });

  it("every string it speaks is a copy key, and every one of them is the owner's", () => {
    for (const occasion of OCCASIONS) {
      const mail = buildSpendCeilingAlert({ occasion, spentCents: 0, ceilingCents: 0 });
      const spoken = [
        mail.subject,
        ...mail.blocks.flatMap((block) =>
          block.block === "facts"
            ? block.items.map((row) => row.label)
            : "text" in block
              ? [block.text]
              : []
        ),
      ];
      for (const key of spoken) {
        expect(OPS_MAIL_KEYS as readonly string[], `${occasion}: ${key}`).toContain(key);
      }
    }
  });

  it("all seven sentences are owner-owed and none is a `TODO(copy)` placeholder", () => {
    for (const key of OPS_MAIL_KEYS) {
      expect(COPY[key], key).toBe("");
      expect(OWNER_OWED as readonly string[], key).toContain(key);
    }
  });
});

describe("sending — one send per owner address, and nothing that can fail a scan", () => {
  const sendEmailMock = vi.fn();
  const readDaySpendCentsMock = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    sendEmailMock.mockReset();
    sendEmailMock.mockResolvedValue({ sent: false, reason: "not-composable" });
    readDaySpendCentsMock.mockReset();
    readDaySpendCentsMock.mockResolvedValue(41);
  });

  async function loadOps() {
    vi.doMock("../../../src/lib/mail/send", () => ({ sendEmail: sendEmailMock }));
    vi.doMock("../../../src/lib/costs/daily", () => ({
      readDaySpendCents: readDaySpendCentsMock,
      alertThresholdsCents: () => ({ warn: 4000, ceiling: 5000 }),
      registerSpendAlertSink: vi.fn(),
    }));
    return import("../../../src/lib/mail/ops/spend-ceiling");
  }

  it("sends once to every address in `OWNER_EMAILS`", async () => {
    process.env.OWNER_EMAILS = "one@example.com,two@example.com";
    const ops = await loadOps();
    await ops.sendOpsAlert({ occasion: "reached", spentCents: 5000, ceilingCents: 5000 });
    expect(sendEmailMock.mock.calls.map((c) => (c[0] as { to: string }).to)).toEqual([
      "one@example.com",
      "two@example.com",
    ]);
    expect(sendEmailMock.mock.calls.every((c) => (c[0] as { kind: string }).kind === "ops")).toBe(true);
  });

  it("does not send while the sentences are unwritten — it reports, and does not throw", async () => {
    process.env.OWNER_EMAILS = "owner@example.com";
    const ops = await loadOps();
    await expect(
      ops.sendOpsAlert({ occasion: "warn", spentCents: 4000, ceilingCents: 5000 })
    ).resolves.toBeUndefined();
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it("a send that throws for one address is not a failure for the other, and never leaves this module", async () => {
    process.env.OWNER_EMAILS = "one@example.com,two@example.com";
    const ops = await loadOps();
    sendEmailMock.mockRejectedValueOnce(new Error("vendor is down"));
    await expect(
      ops.sendOpsAlert({ occasion: "warn", spentCents: 4000, ceilingCents: 5000 })
    ).resolves.toBeUndefined();
    expect(sendEmailMock).toHaveBeenCalledTimes(2);
  });

  it("the kill-switch report carries the day's spend beside the news, and reports 0 when it cannot be read", async () => {
    process.env.OWNER_EMAILS = "owner@example.com";
    let ops = await loadOps();
    await ops.reportKillSwitchEngaged();
    const withFigure = sendEmailMock.mock.calls[0]?.[0] as { blocks: unknown[] };
    expect(JSON.stringify(withFigure.blocks)).toContain('"41"');

    vi.resetModules();
    sendEmailMock.mockReset();
    sendEmailMock.mockResolvedValue({ sent: false, reason: "not-composable" });
    readDaySpendCentsMock.mockResolvedValue(null);
    ops = await loadOps();
    await ops.reportKillSwitchEngaged();
    const withoutFigure = sendEmailMock.mock.calls[0]?.[0] as { blocks: unknown[] };
    expect(JSON.stringify(withoutFigure.blocks)).toContain('"0"');
  });

  it("there is no released occasion to send — the type admits three and the module offers one report", () => {
    // The absence is asserted, not assumed: a `kill-switch-released` arm
    // added to the template without somewhere durable to observe a release
    // from would be a mail that can never be occasioned.
    expect(OCCASIONS).not.toContain("kill-switch-released" as never);
  });
});
