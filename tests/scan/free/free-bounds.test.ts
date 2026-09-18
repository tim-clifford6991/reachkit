// tests/scan/free/free-bounds.test.ts — the two free-path bounds issue 885
// adds (SPEC §2, 2026-09-18).
//
// What was already there is not re-tested here: `admission-check.test.ts`
// holds BP-012's order and its five original steps, and
// `admission-claim.test.ts` holds the claim and its race. This file is the
// two ways a script could still walk past all of them.
//
//  - **one network's day.** `checkHourly` bounds a network's *hour* — five
//    scans — and nothing bounded its day, so a script that waits ran 5 an
//    hour for 24 hours: 120 scans, 1440¢ at `CAPS.FREE_C`, more than half
//    the whole free path's worst case, from one address.
//  - **one domain's day.** The stored report that makes a repeat of one
//    address free is read at the report address (`resolve.ts` row 3) and
//    never here, and `POST /api/scan` calls straight into
//    `claimFreeScanSlot` — so one domain claimed from enough networks cost
//    12¢ every time, however many reports were already stored for it.
//
// The harness is a **row store**, not a per-step fixture: claims insert
// rows and the counting reads filter them, so "twenty scans from one
// network" is twenty claims rather than a number handed to the step under
// test. That is the only shape in which the last claim before a bound, the
// first refused after it, and the single owner alert between them can all
// be asserted at once.
import "../../generate/env";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FREE_BOUNDS } from "@/lib/config/constants";
import type { CanonicalDomain } from "@/lib/scan/domain";
import type { SpendAlert } from "@/lib/costs/daily";

type Row = Record<string, unknown>;

const { rows } = vi.hoisted(() => ({ rows: [] as Row[] }));

vi.mock("@/lib/db", () => ({ dbAdmin: () => client }));

const { admitFreeScan, claimFreeScanSlot, networkKeyOf } = await import("@/lib/scan/admission");
const { registerSpendAlertSink } = await import("@/lib/costs/daily");

// ── The row store, as a PostgREST-shaped builder ────────────────────────

let nextId = 0;

function builder(table: string) {
  const eq: [string, unknown][] = [];
  const gte: [string, unknown][] = [];
  let pending: Row | null = null;

  function matching(): Row[] {
    const held = table === "scans" ? rows : [];
    return held
      .filter((row) => eq.every(([column, value]) => row[column] === value))
      .filter((row) =>
        gte.every(([column, value]) => String(row[column]) >= String(value))
      )
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  }

  const self = {
    select: () => self,
    eq(column: string, value: unknown) {
      eq.push([column, value]);
      return self;
    },
    gte(column: string, value: unknown) {
      gte.push([column, value]);
      return self;
    },
    order: () => self,
    limit(n: number) {
      return {
        then(resolve: (value: { data: Row[]; error: null }) => unknown) {
          return Promise.resolve({ data: matching().slice(0, n), error: null }).then(resolve);
        },
      };
    },
    insert(row: Row) {
      pending = { id: `scan-${++nextId}`, created_at: new Date().toISOString(), ...row };
      rows.push(pending);
      return self;
    },
    single() {
      return Promise.resolve({ data: pending, error: null });
    },
  };
  return self;
}

const client = {
  from: (table: string) => builder(table),
  // The day's product-wide ledger (`fetches_spend_since`): nothing spent,
  // so the `daily` step's first question never refuses and what refuses
  // below can only be the bound under test.
  rpc: async () => ({ data: 0, error: null }),
} as unknown as ReturnType<typeof import("@/lib/db").dbAdmin>;

const START = new Date("2026-09-18T00:00:00.000Z");
const MINUTE_MS = 60_000;

/** A claim, and then the row it wrote is marked finished — a `running` row
 *  is the in-flight refusal for its own network, which is a different
 *  bound and is `admission-check.test.ts`'s. */
async function claim(domain: string, network: ReturnType<typeof networkKeyOf>) {
  const result = await claimFreeScanSlot({
    domain: domain as CanonicalDomain,
    network,
    fromIncompleteRescan: false,
  });
  for (const row of rows) if (row.status === "running") row.status = "done";
  return result;
}

const NETWORK_A = networkKeyOf("203.0.113.10");
const NETWORK_B = networkKeyOf("198.51.100.7");

beforeEach(() => {
  rows.length = 0;
  nextId = 0;
  registerSpendAlertSink(null);
  vi.useFakeTimers();
  vi.setSystemTime(START);
});

afterEach(() => {
  vi.useRealTimers();
  registerSpendAlertSink(null);
});

describe("one network's day (issue 885)", () => {
  /** Spaced so the hourly bound never bites: one claim every 65 minutes is
   *  at most one inside any hour, and twenty of them span 20.6 hours,
   *  still inside the 24-hour window the day bound counts over. A fresh
   *  domain each time, so the domain bound is not the thing refusing. */
  async function fillTheDay(network = NETWORK_A): Promise<void> {
    for (let i = 0; i < FREE_BOUNDS.scansPerIpPerDay; i++) {
      vi.setSystemTime(new Date(START.getTime() + i * 65 * MINUTE_MS));
      const result = await claim(`site-${i}.example.com`, network);
      expect(result.claimed, `claim ${i}`).toBe(true);
    }
  }

  it("a burst from one network is refused once it has had its day's scans", async () => {
    await fillTheDay();
    vi.setSystemTime(new Date(START.getTime() + FREE_BOUNDS.scansPerIpPerDay * 65 * MINUTE_MS));

    const refused = await claim("one-more.example.com", NETWORK_A);
    expect(refused.claimed).toBe(false);
    if (refused.claimed) throw new Error("unreachable");
    expect(refused.refusal).toMatchObject({ refuse: "network_daily" });
    // It promises a wait, and the wait is real: the oldest counted row ages
    // out of the window whatever anyone does.
    if (!("retryAfterSeconds" in refused.refusal)) throw new Error("unreachable");
    expect(refused.refusal.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("a different network is not refused — the bound is one network's, not the product's", async () => {
    await fillTheDay();
    vi.setSystemTime(new Date(START.getTime() + FREE_BOUNDS.scansPerIpPerDay * 65 * MINUTE_MS));

    expect((await claim("stranger.example.com", NETWORK_B)).claimed).toBe(true);
  });

  it("the owner is told once — by the claim that filled the bound, not by the refusals after it", async () => {
    const seen: SpendAlert[] = [];
    registerSpendAlertSink((alert) => seen.push({ ...alert }));

    await fillTheDay();
    expect(seen).toEqual([
      {
        crossed: "ceiling",
        spentCents: FREE_BOUNDS.scansPerIpPerDay * 12,
        ceilingCents: FREE_BOUNDS.scansPerIpPerDay * 12,
        subject: { kind: "free-scan", bound: "network-day" },
      },
    ]);

    // Still inside the window the twenty were counted over — a rolling 24
    // hours, so the wait the refusal promises is the oldest row ageing out
    // of it and not a stroke of midnight.
    for (let i = 0; i < 3; i++) {
      vi.setSystemTime(new Date(START.getTime() + (FREE_BOUNDS.scansPerIpPerDay * 65 + i) * MINUTE_MS));
      expect((await claim(`refused-${i}.example.com`, NETWORK_A)).claimed).toBe(false);
    }
    expect(seen).toHaveLength(1);
  });

  it("a check does not consume an allowance: asking is not claiming", async () => {
    await fillTheDay();
    const before = rows.length;
    await admitFreeScan({ domain: "one-more.example.com" as CanonicalDomain, network: NETWORK_A });
    await admitFreeScan({ domain: "one-more.example.com" as CanonicalDomain, network: NETWORK_A });
    expect(rows.length).toBe(before);
  });
});

describe("one domain's day (issue 885)", () => {
  const DOMAIN = "acme.example.com";

  /** Each from its own network, which is how the bound is reached in the
   *  first place: the per-network bounds never see the same key twice. */
  async function fillTheDomain(): Promise<void> {
    for (let i = 0; i < FREE_BOUNDS.scansPerDomainPerDay; i++) {
      vi.setSystemTime(new Date(START.getTime() + i * MINUTE_MS));
      const result = await claim(DOMAIN, networkKeyOf(`192.0.2.${i + 1}`));
      expect(result.claimed, `claim ${i}`).toBe(true);
    }
  }

  it("one address is measured only so many times a day, whoever asks", async () => {
    await fillTheDomain();
    const refused = await claim(DOMAIN, networkKeyOf("192.0.2.200"));
    expect(refused.claimed).toBe(false);
    if (refused.claimed) throw new Error("unreachable");
    expect(refused.refusal).toMatchObject({ refuse: "domain_daily" });
  });

  it("another address from the same stranger is not refused", async () => {
    await fillTheDomain();
    expect((await claim("other.example.com", networkKeyOf("192.0.2.200"))).claimed).toBe(true);
  });

  it("the owner is told once, naming the bound and never the address", async () => {
    const seen: SpendAlert[] = [];
    registerSpendAlertSink((alert) => seen.push({ ...alert }));
    await fillTheDomain();
    await claim(DOMAIN, networkKeyOf("192.0.2.200"));
    await claim(DOMAIN, networkKeyOf("192.0.2.201"));

    expect(seen).toEqual([
      {
        crossed: "ceiling",
        spentCents: FREE_BOUNDS.scansPerDomainPerDay * 12,
        ceilingCents: FREE_BOUNDS.scansPerDomainPerDay * 12,
        subject: { kind: "free-scan", bound: "domain-day" },
      },
    ]);
    expect(JSON.stringify(seen)).not.toContain(DOMAIN);
  });
});
