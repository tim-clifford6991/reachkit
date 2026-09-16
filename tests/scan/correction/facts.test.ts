// tests/scan/correction/facts.test.ts — BUILD §6.7
//
// The stored side of the one market correction: the facts the offer is
// decided from, the conditional write that moves the state forward, and
// the seam the re-measurement is reached through. No live Postgres — the
// two clients are mocked at `@/lib/db`, the one entry point any code may
// hold.
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface Call {
  table: string;
  select?: string;
  update?: Record<string, unknown>;
  eq: [string, string][];
  is: [string, boolean][];
  limit?: number;
}

const calls: Call[] = [];
let answer: (call: Call) => { data: unknown[] | null; error: { message: string } | null };

function builder(call: Call) {
  const chain = {
    select(columns: string) {
      call.select = columns;
      return chain;
    },
    update(values: Record<string, unknown>) {
      call.update = values;
      return chain;
    },
    eq(column: string, value: string) {
      call.eq.push([column, value]);
      return chain;
    },
    is(column: string, value: boolean) {
      call.is.push([column, value]);
      return chain;
    },
    limit(n: number) {
      call.limit = n;
      return chain;
    },
    then<T>(resolve: (r: unknown) => T) {
      return Promise.resolve(answer(call)).then(resolve);
    },
  };
  return chain;
}

/** The removal list has one reader in the product — the admission order's
 *  own first step (REQ-002 c4) — so this suite doubles that reader rather
 *  than a second query of its own. */
const isDomainRemoved = vi.fn<(domain: string) => Promise<boolean>>();
vi.mock("@/lib/scan/admission", () => ({
  isDomainRemoved: (domain: string) => isDomainRemoved(domain),
}));

vi.mock("@/lib/db", () => ({
  dbAdmin: () => ({
    from(table: string) {
      const call: Call = { table, eq: [], is: [] };
      calls.push(call);
      return builder(call);
    },
  }),
}));

const { advanceCorrectionState, correctionRunner, readCorrectionFacts, registerCorrectionRunner } = await import(
  "../../../src/lib/scan/correction.ts"
);

type Domain = Parameters<typeof readCorrectionFacts>[0];
const DOMAIN = "customer.com" as Domain;

function marketBlob(category: unknown, kind = "measured"): unknown {
  return { market: { kind, at: "2026-09-05T00:00:00.000Z", value: { profile: { category } } } };
}

beforeEach(() => {
  calls.length = 0;
  registerCorrectionRunner(null);
  answer = () => ({ data: [], error: null });
  isDomainRemoved.mockReset();
  isDomainRemoved.mockResolvedValue(false);
});

describe("readCorrectionFacts — the domain's one current report, or nothing", () => {
  it("reads the current scan row and the removal list, and returns the five facts the offer needs", async () => {
    answer = () => ({
      data: [
        {
          id: "scan-1",
          created_at: "2026-09-04T09:00:00.000Z",
          correction_state: "failed_once",
          report: marketBlob("user onboarding software"),
        },
      ],
      error: null,
    });

    const facts = await readCorrectionFacts(DOMAIN);
    expect(facts).toEqual({
      scanId: "scan-1",
      measuredAt: new Date("2026-09-04T09:00:00.000Z"),
      category: "user onboarding software",
      correctionState: "failed_once",
      domainRemoved: false,
    });

    const scans = calls.find((c) => c.table === "scans");
    expect(scans?.eq).toEqual([["domain", "customer.com"]]);
    expect(scans?.is).toEqual([["is_current", true]]);
  });

  it("returns null where the domain has no current report — no report is invented to carry an offer", async () => {
    expect(await readCorrectionFacts(DOMAIN)).toBeNull();
  });

  it("reports a removed domain, through the product's one reader of the removal list", async () => {
    answer = () => ({
      data: [{ id: "s", created_at: "2026-09-04T09:00:00.000Z", correction_state: "none", report: null }],
      error: null,
    });
    isDomainRemoved.mockResolvedValue(true);
    expect((await readCorrectionFacts(DOMAIN))?.domainRemoved).toBe(true);
    expect(isDomainRemoved).toHaveBeenCalledWith("customer.com");
  });

  it("a removal list that cannot be read is not evidence of a removal", async () => {
    answer = () => ({
      data: [{ id: "s", created_at: "2026-09-04T09:00:00.000Z", correction_state: "none", report: null }],
      error: null,
    });
    isDomainRemoved.mockRejectedValue(new Error('relation "domain_blocks" does not exist'));
    expect((await readCorrectionFacts(DOMAIN))?.domainRemoved).toBe(false);
  });

  it("this module opens no second reader of the removal list", () => {
    const source = readFileSync(
      path.resolve(import.meta.dirname, "../../../src/lib/scan/correction.ts"),
      "utf8"
    );
    expect(source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "")).not.toContain("domain_blocks");
  });
});

describe("The category is read from the stored blob, and never guessed into existence", () => {
  const cases: [string, unknown][] = [
    ["no report at all", null],
    ["a report with no market section", {}],
    ["a market that was not measured", { market: { kind: "unmeasured", reason: "not_attempted" } }],
    ["a market with no profile", { market: { kind: "measured", value: {} } }],
    ["a category that is not a string", marketBlob(42)],
    ["an empty category", marketBlob("")],
  ];

  it.each(cases)("%s reads as `not reached`, never as a default category", async (_name, report) => {
    answer = () => ({
      data: [{ id: "s", created_at: "2026-09-04T09:00:00.000Z", correction_state: "none", report }],
      error: null,
    });
    expect((await readCorrectionFacts(DOMAIN))?.category).toBeNull();
  });

  it("a measured-zero market still carries its category", async () => {
    answer = () => ({
      data: [
        { id: "s", created_at: "2026-09-04T09:00:00.000Z", correction_state: "none", report: marketBlob("a category", "zero") },
      ],
      error: null,
    });
    expect((await readCorrectionFacts(DOMAIN))?.category).toBe("a category");
  });
});

describe("A stored state outside the machine's six members", () => {
  it("reads as `exhausted` — an unreadable attempt count spends nothing further", async () => {
    answer = () => ({
      data: [{ id: "s", created_at: "2026-09-04T09:00:00.000Z", correction_state: "who knows", report: null }],
      error: null,
    });
    expect((await readCorrectionFacts(DOMAIN))?.correctionState).toBe("exhausted");
  });
});

describe("advanceCorrectionState — one conditional write, so two submissions cannot both win", () => {
  it("updates only where the stored state is still the one the decision was made against", async () => {
    answer = () => ({ data: [{ id: "scan-1" }], error: null });
    expect(await advanceCorrectionState({ scanId: "scan-1", from: "none", to: "running" })).toBe(true);

    const call = calls.at(-1);
    expect(call?.update).toEqual({ correction_state: "running" });
    expect(call?.eq).toEqual([
      ["id", "scan-1"],
      ["correction_state", "none"],
    ]);
  });

  it("returns false where another submission already moved the state", async () => {
    answer = () => ({ data: [], error: null });
    expect(await advanceCorrectionState({ scanId: "scan-1", from: "none", to: "running" })).toBe(false);
  });
});

describe("The re-measurement seam", () => {
  it("answers null while no pipeline has registered — nothing is stranded in a running state", () => {
    expect(correctionRunner()).toBeNull();
  });

  it("hands back exactly the pipeline that registered", async () => {
    const fake = vi.fn(async () => ({
      scanId: "scan-2",
      finished: Promise.resolve({ scanId: "scan-2", status: "done" as const }),
    }));
    registerCorrectionRunner(fake);
    expect(correctionRunner()).toBe(fake);
    registerCorrectionRunner(null);
  });
});
