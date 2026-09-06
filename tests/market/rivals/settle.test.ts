// tests/market/rivals/settle.test.ts — BUILD §6.6 · §4.3
//
// One write, two columns, idempotent on the site id. `db()` is stubbed;
// no live database, and the `db` project is untouched by this file.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addRival, type RivalSet } from "../../../src/lib/market/setup/rivals.ts";
import { codeOf, importsOf } from "./source.ts";

interface RecordedUpdate {
  table: string;
  patch: Record<string, unknown>;
  eq: [string, string];
}

const recorded: RecordedUpdate[] = [];
let updateError: { message: string } | null = null;

function fakeDb() {
  return {
    from(table: string) {
      return {
        update(patch: Record<string, unknown>) {
          return {
            eq(column: string, value: string) {
              recorded.push({ table, patch, eq: [column, value] });
              return Promise.resolve({ error: updateError });
            },
          };
        },
      };
    },
  };
}

vi.mock("@/lib/db", () => ({ db: () => fakeDb() }));

let settleSetup: typeof import("../../../src/lib/market/rivals/settle.ts").settleSetup;

beforeEach(async () => {
  recorded.length = 0;
  updateError = null;
  vi.spyOn(console, "log").mockImplementation(() => {});
  ({ settleSetup } = await import("../../../src/lib/market/rivals/settle.ts"));
});

function setOf(entries: readonly { domain: string; origin: "suggested" | "typed" }[]): RivalSet {
  let set: RivalSet = [];
  for (const entry of entries) {
    const added = addRival(set, {
      domain: entry.domain,
      origin: entry.origin,
      ownDomain: "customer.com",
      resolves: true,
    });
    if (!added.ok) throw new Error(`fixture: ${entry.domain} was refused (${added.because})`);
    set = added.set;
  }
  return set;
}

describe('REQ-026 c13 — "the set compared against is exactly the rivals they accepted or typed"', () => {
  it("settleSetup/writes-exactly-the-chosen-set — element for element, each carrying its origin", async () => {
    const rivals = setOf([
      { domain: "one.com", origin: "suggested" },
      { domain: "two.com", origin: "typed" },
    ]);
    const out = await settleSetup({ siteId: "site-1", category: "project management", rivals });

    expect(out).toEqual({ ok: true });
    expect(recorded).toHaveLength(1);
    expect(recorded[0]!.table).toBe("sites");
    expect(recorded[0]!.eq).toEqual(["id", "site-1"]);
    expect(recorded[0]!.patch.competitors).toEqual([
      { domain: "one.com", origin: "suggested" },
      { domain: "two.com", origin: "typed" },
    ]);
  });

  it("settleSetup/stores-origin-rather-than-inferring-it — so a later domain change can clear the suggested and keep the typed", async () => {
    await settleSetup({
      siteId: "site-1",
      category: "c",
      rivals: setOf([{ domain: "typed.com", origin: "typed" }]),
    });
    const written = recorded[0]!.patch.competitors as { origin: string }[];
    expect(written[0]!.origin).toBe("typed");
  });
});

describe('REQ-026 c2 and c4 — "what they entered is the market the product uses from then on … never by re-inference"', () => {
  it("settleSetup/writes-the-stated-category — verbatim, unaltered and un-normalised", async () => {
    const category = "  Project Management Software  ";
    await settleSetup({ siteId: "site-1", category, rivals: [] });
    expect(recorded[0]!.patch.category).toBe(category);
  });

  it("settleSetup/never-re-infers — no model and no vendor is reachable from this module", () => {
    const imported = importsOf("settle.ts");
    expect(imported.filter((i) => i.includes("/llm") || i.includes("vendors"))).toEqual([]);
    expect(imported).toEqual(["@/lib/db", "../setup/rivals"]);
  });

  it("settleSetup/writes-only-the-two-columns", async () => {
    await settleSetup({ siteId: "site-1", category: "c", rivals: [] });
    expect(Object.keys(recorded[0]!.patch).sort()).toEqual(["category", "competitors"]);
  });
});

describe('REQ-026 c11 — "no competitors selected … setup completes"', () => {
  it("settleSetup/empty-set-is-written — as [], never skipped", async () => {
    const out = await settleSetup({ siteId: "site-1", category: "c", rivals: [] });
    expect(out).toEqual({ ok: true });
    expect(recorded).toHaveLength(1);
    expect(recorded[0]!.patch.competitors).toEqual([]);
  });
});

describe("one statement, idempotent on the site id", () => {
  it("settleSetup/is-idempotent-on-site-id — a resubmit leaves the state the first call left, and inserts nothing", async () => {
    const rivals = setOf([{ domain: "one.com", origin: "typed" }]);
    await settleSetup({ siteId: "site-1", category: "c", rivals });
    await settleSetup({ siteId: "site-1", category: "c", rivals });

    expect(recorded[0]).toEqual(recorded[1]);
    expect(recorded.every((r) => r.eq[1] === "site-1")).toBe(true);
    expect(codeOf("settle.ts")).not.toContain(".insert(");
  });

  it("settleSetup/a-failed-write-is-an-outcome-not-a-throw", async () => {
    updateError = { message: "row level security" };
    await expect(settleSetup({ siteId: "site-1", category: "c", rivals: [] })).resolves.toEqual({
      ok: false,
      because: "write_failed",
    });
  });
});
