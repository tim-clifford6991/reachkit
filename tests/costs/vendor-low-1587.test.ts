// tests/costs/vendor-low-1587.test.ts — the daily balance read tells the
// owner once a Berlin day when DataForSEO credit runs out within two weeks,
// through the real obligation, the real vendor client and the real incident
// mail. The database is a small in-memory stand-in for the two relations
// read; DataForSEO answers from the recorded `user_data` fixture.
import "../generate/env";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubVendorFetch } from "../vendors/harness";

type Row = Record<string, unknown>;
const tables: { vendor_days: Row[]; cost_site_day: Row[] } = { vendor_days: [], cost_site_day: [] };

vi.mock("@/lib/db", () => {
  function builder(table: keyof typeof tables) {
    const filters: ((row: Row) => boolean)[] = [];
    let written: Row[] | null = null;
    const b: Record<string, unknown> = {
      select: () => b,
      eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), b),
      in: (c: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[c])), b),
      gte: (c: string, v: string) => (filters.push((r) => String(r[c]) >= v), b),
      lt: (c: string, v: string) => (filters.push((r) => String(r[c]) < v), b),
      upsert: (rows: Row[]) => ((written = rows), b),
      then: (resolve: (r: unknown) => void) => {
        if (written !== null) {
          const key = (r: Row) => [r.vendor, r.day, r.kind, r.domain].join("|");
          for (const row of written) {
            tables[table] = tables[table].filter((r) => key(r) !== key(row));
            tables[table].push({ ...row });
          }
          return resolve({ data: null, error: null });
        }
        resolve({ data: tables[table].filter((r) => filters.every((f) => f(r))), error: null });
      },
    };
    return b;
  }
  const client = { from: builder };
  return { db: () => client, dbAdmin: () => client };
});

const { vendorDayReading } = await import("@/jobs/vendor-days");
const { __setVendorTransportForTesting } = await import("@/lib/mail/vendor/resend");

const FIXTURE = JSON.parse(readFileSync(new URL("../vendors/fixtures/user-data.json", import.meta.url), "utf8")) as {
  tasks: { result: { money: { balance: number } }[] }[];
};

let mails: string[] = [];
let warnings: string[] = [];
let answer: () => unknown;

function balanceOf(cents: number): unknown {
  const body = structuredClone(FIXTURE);
  const money = body.tasks[0]?.result[0]?.money;
  if (money === undefined) throw new Error("the recorded user_data fixture carries no money");
  money.balance = cents / 100;
  return body;
}

/** Seven closed UTC days of DataForSEO estimate before `day`. */
function spendPerDay(cents: number, day: string): void {
  for (let back = 1; back <= 7; back++) {
    const d = new Date(Date.parse(`${day}T00:00:00Z`) - back * 86_400_000).toISOString().slice(0, 10);
    tables.cost_site_day.push({ day: d, vendor: "dataforseo", estimated_cents: String(cents) });
    // Another vendor's spend is not DataForSEO's.
    tables.cost_site_day.push({ day: d, vendor: "anthropic", estimated_cents: "99999" });
  }
}

const textOf = (mail: string | undefined): string => (JSON.parse(mail ?? "{}") as { text: string }).text;

async function tick(at: string): Promise<void> {
  vi.setSystemTime(new Date(at));
  for (const subject of await vendorDayReading.due()) {
    if (subject.startsWith("usage:")) await vendorDayReading.handOff(subject);
  }
}

beforeEach(() => {
  tables.vendor_days = [];
  tables.cost_site_day = [];
  mails = [];
  warnings = [];
  answer = () => FIXTURE;
  // Every request is a mail: the once-ness proven here is the product's, not the vendor's key.
  __setVendorTransportForTesting(async (payload) => {
    mails.push(payload);
    return { status: 200, headers: {}, body: JSON.stringify({ id: `mail-${mails.length}` }) };
  });
  stubVendorFetch(() => answer());
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation((line: unknown) => void warnings.push(String(line)));
});

afterEach(() => {
  __setVendorTransportForTesting(null);
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("the owner is told when DataForSEO credit runs out within two weeks", () => {
  it("a 900¢ balance gives one mail with the balance and the dashboard link", async () => {
    answer = () => balanceOf(900);
    await tick("2026-10-19T00:05:00Z");
    expect(mails).toHaveLength(1);
    const text = textOf(mails[0]);
    expect(text).toContain("$9.00");
    expect(text).toContain("https://app.dataforseo.com/");
    // No spend measured: days left is not written, never as 0.
    expect(text).not.toContain("Days left");
  });

  it("5,000¢ at 300¢ a day gives no mail", async () => {
    answer = () => balanceOf(5000);
    spendPerDay(300, "2026-10-19");
    await tick("2026-10-19T00:05:00Z");
    expect(mails).toHaveLength(0);
  });

  it("3,000¢ at 600¢ a day is five days left, and is told", async () => {
    answer = () => balanceOf(3000);
    spendPerDay(600, "2026-10-19");
    await tick("2026-10-19T00:05:00Z");
    expect(mails).toHaveLength(1);
    expect(textOf(mails[0])).toContain("Days left at last week's spend: 5\n");
  });

  it("2,000¢ at 200¢ a day is ten days left, inside the fortnight, and is told", async () => {
    answer = () => balanceOf(2000);
    spendPerDay(200, "2026-10-19");
    await tick("2026-10-19T00:05:00Z");
    expect(mails).toHaveLength(1);
    expect(textOf(mails[0])).toContain("Days left at last week's spend: 10\n");
  });

  it("3,000¢ at 200¢ a day is fifteen days left, and gives no mail", async () => {
    answer = () => balanceOf(3000);
    spendPerDay(200, "2026-10-19");
    await tick("2026-10-19T00:05:00Z");
    expect(mails).toHaveLength(0);
  });

  it("two runs on one day give one mail", async () => {
    answer = () => balanceOf(900);
    await tick("2026-10-19T00:05:00Z");
    await tick("2026-10-19T00:20:00Z");
    expect(mails).toHaveLength(1);
  });

  it("a late read and the next UTC day's read on one Berlin day give one mail, and the next Berlin day another", async () => {
    answer = () => balanceOf(900);
    await tick("2026-10-18T23:30:00Z");
    await tick("2026-10-19T00:05:00Z");
    expect(mails).toHaveLength(1);
    await tick("2026-10-20T00:05:00Z");
    expect(mails).toHaveLength(2);
  });
});

describe("a balance that was not read is never 0", () => {
  it("a read that throws sends no mail and logs vendor_balance_unread once", async () => {
    answer = () => {
      throw new Error("connect ECONNREFUSED");
    };
    await tick("2026-10-19T00:05:00Z");
    expect(mails).toHaveLength(0);
    expect(warnings.filter((line) => line.includes('"vendor_balance_unread"'))).toHaveLength(1);
  });

  it("an answer with no balance sends no mail and logs vendor_balance_unread once", async () => {
    answer = () => ({ tasks: [{ status_code: 20000, result: [{ money: {} }] }] });
    await tick("2026-10-19T00:05:00Z");
    expect(mails).toHaveLength(0);
    expect(warnings.filter((line) => line.includes('"vendor_balance_unread"'))).toHaveLength(1);
  });
});
