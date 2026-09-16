// tests/publish/destinations/hosted/hostname.test.ts — SPEC §5 (2026-09-12)
//
// The host a customer's pages are served at: whether it is free, whether it
// is on the project, which of §5's two words the customer reads, and how
// often the vendor is asked. Only the domain list's own verification reads
// "live" — a record can resolve at a host Vercel was never told about.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fakeDb } from "../../harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

type Answer =
  | { ok: true; attached: true; verified: boolean }
  | { ok: false; because: "not_configured" | "elsewhere" | "no_answer" };

const vendor = vi.hoisted(() => ({
  answer: { ok: true, attached: true, verified: false } as Answer,
  asked: [] as string[],
}));
vi.mock("@/lib/vendors/vercel/domains", () => ({
  addProjectDomain: async (hostname: string) => {
    vendor.asked.push(hostname);
    return vendor.answer;
  },
}));

function answers(answer: Answer): void {
  vendor.answer = answer;
}

const { hostnameTaken, syncHostname } = await import(
  "@/lib/publish/destinations/hosted/hostname"
);

beforeEach(() => {
  db.reset();
  vendor.asked.length = 0;
  answers({ ok: true, attached: true, verified: false });
});

const NOW = new Date("2026-09-12T12:00:00.000Z");
const AGES_AGO = "2026-09-10T00:00:00.000Z";

function sync(now: Date = NOW): Promise<"pending_dns" | "live"> {
  return syncHostname({ destinationId: "dest-1", hostname: "blog.example.com", now });
}

function seedDestination(over: Record<string, unknown> = {}): void {
  db.seed("destinations", [
    {
      id: "dest-1",
      site_id: "site-1",
      kind: "hosted",
      health: "expired",
      hostname: "blog.example.com",
      hostname_state: "pending_dns",
      deleted_at: null,
      ...over,
    },
  ]);
}

describe('§5 — "refusing an … already-taken label in one written line"', () => {
  it("a host another site already serves at is taken", async () => {
    seedDestination();
    await expect(
      hostnameTaken({ hostname: "blog.example.com", exceptSiteId: "site-2" })
    ).resolves.toBe(true);
  });

  it("**a founder's own host is not taken from them** — the row that a bare existence check fails", async () => {
    seedDestination();
    await expect(
      hostnameTaken({ hostname: "blog.example.com", exceptSiteId: "site-1" })
    ).resolves.toBe(false);
  });

  it("a host nobody holds is free", async () => {
    seedDestination();
    await expect(hostnameTaken({ hostname: "news.example.com" })).resolves.toBe(false);
  });

  it("a disconnected destination holds nothing: its host is free again", async () => {
    seedDestination({ deleted_at: "2026-09-11T00:00:00.000Z" });
    await expect(
      hostnameTaken({ hostname: "blog.example.com", exceptSiteId: "site-2" })
    ).resolves.toBe(false);
  });
});

describe("§5 — the hostname is attached, and the customer reads one of two words", () => {
  it("a host the domain list has not verified is waiting for DNS — and it is attached anyway", async () => {
    // A certificate is issued when the record resolves, which needs the host
    // on the project already: attaching only after DNS would deadlock.
    seedDestination();
    await expect(sync()).resolves.toBe("pending_dns");
    expect(vendor.asked).toEqual(["blog.example.com"]);
    expect(db.rows("destinations")[0]?.hostname_state).toBe("pending_dns");
  });

  it("**only the domain list's own verification reads live**", async () => {
    seedDestination();
    answers({ ok: true, attached: true, verified: true });
    await expect(sync()).resolves.toBe("live");
    expect(db.rows("destinations")[0]?.hostname_state).toBe("live");
  });

  it("issue #791 — live is health ok in the same write, and a host not verified leaves health to the check", async () => {
    seedDestination({ health_reason: "dns_unset", broken_mail_sent_at: AGES_AGO });
    await sync();
    expect(db.rows("destinations")[0]).toMatchObject({ hostname_state: "pending_dns", health: "expired" });

    answers({ ok: true, attached: true, verified: true });
    await sync(new Date(NOW.getTime() + 2 * 3_600_000));
    expect(db.rows("destinations")[0]).toMatchObject({
      hostname_state: "live",
      health: "ok",
      health_reason: null,
      broken_mail_sent_at: null,
      health_changed_at: "2026-09-12T14:00:00.000Z",
      last_checked_at: "2026-09-12T14:00:00.000Z",
    });
  });

  it("**a deployment with no token never reads live** — the row a resolved record would have lied about", async () => {
    // Nothing is attached, so a pointed record gets the platform's 404.
    seedDestination();
    answers({ ok: false, because: "not_configured" });
    await expect(sync()).resolves.toBe("pending_dns");
    expect(db.rows("destinations")[0]?.hostname_state).toBe("pending_dns");
  });

  it("a host another project holds is an answer, and it is not live", async () => {
    seedDestination({ hostname_state: "live" });
    answers({ ok: false, because: "elsewhere" });
    await expect(sync()).resolves.toBe("pending_dns");
  });

  it("a pass that could not ask leaves a served host live, and still stamps the date", async () => {
    seedDestination({ hostname_state: "live" });
    answers({ ok: false, because: "no_answer" });
    await expect(sync()).resolves.toBe("live");
    const row = db.rows("destinations")[0] ?? {};
    expect(row.hostname_state).toBe("live");
    expect(typeof row.hostname_checked_at).toBe("string");
  });

  it("**asked once an hour, not once a pass** — the scheduled path's cost", async () => {
    seedDestination();
    await sync();
    await sync(new Date(NOW.getTime() + 60_000));
    expect(vendor.asked).toEqual(["blog.example.com"]);
  });

  it("once the window has passed it asks again, which is how an unreachable save heals", async () => {
    seedDestination({ hostname_checked_at: AGES_AGO });
    answers({ ok: true, attached: true, verified: true });
    await expect(sync()).resolves.toBe("live");
    expect(vendor.asked).toEqual(["blog.example.com"]);
    expect(db.rows("destinations")).toHaveLength(1);
  });

  it("what the vendor answered never reaches the row — only the state and the date it was asked", async () => {
    seedDestination();
    await sync();
    const row = db.rows("destinations")[0] ?? {};
    expect(Object.keys(row)).not.toContain("vendor");
    expect(JSON.stringify(row)).not.toContain("verified");
    expect(typeof row.hostname_checked_at).toBe("string");
  });
});

// The schema half. `vitest.config.ts`'s `LIVE_SCHEMA_TESTS` list is the
// owner's, so a feature PR cannot add a live-schema suite; what it can do
// is assert the migration states what this module relies on, and verify it
// by hand against a scratch database (recorded in the PR).
describe("the migration this module reads and writes through", () => {
  const source = readFileSync(
    path.resolve(
      import.meta.dirname,
      "../../../../supabase/migrations/20260912120000_destinations_hostname.sql"
    ),
    "utf8"
  );

  it("a host is claimed by at most one live destination, in the database and not only here", () => {
    expect(source).toMatch(/create unique index destinations_one_live_hostname/);
    expect(source).toMatch(/where deleted_at is null and hostname is not null/);
  });

  it("the state column holds exactly the two words the customer reads", () => {
    expect(source).toMatch(/hostname_state in \('pending_dns', 'live'\)/);
  });

  it("the host commits in the same transaction as the mode and the destination", () => {
    expect(source).toMatch(/create or replace function apply_setup_choice\(/);
    expect(source).toMatch(/p_hostname text default null/);
    expect(source).toMatch(
      /insert into public\.destinations \(site_id, kind, config, health, hostname, hostname_state\)/
    );
    // Issue #384's hardening survives the redefinition: a function that
    // handed its path back to its caller is the advisor finding that
    // migration closed.
    expect(source).toMatch(/set search_path = ''/);
  });
});
