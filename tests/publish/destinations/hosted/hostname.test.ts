// tests/publish/destinations/hosted/hostname.test.ts — SPEC §5 (2026-09-12)
//
// The host a customer's pages are served at: whether it is free, whether it
// is on the project, and which of §5's two words the customer reads.
//
// The rows that matter are the ones a plausible implementation gets wrong:
// a founder must not be told their **own** host is taken; the word must
// follow the **record resolving** and not the vendor's mood, because §5
// words it that way ("waiting for DNS until the record resolves and live
// after"); and the attachment must be made **whether or not** the record
// resolves, because the hostname has to be on the project before a
// certificate can be issued for it.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fakeDb } from "../../harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

const attached: string[] = [];
vi.mock("@/lib/vendors/vercel/domains", () => ({
  addProjectDomain: async (hostname: string) => {
    attached.push(hostname);
    return { ok: true, attached: true, verified: false };
  },
}));

const { hostnameTaken, syncHostname } = await import(
  "@/lib/publish/destinations/hosted/hostname"
);

beforeEach(() => {
  db.reset();
  attached.length = 0;
});

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
  it("a record that has not resolved is waiting for DNS — and the host is attached anyway", async () => {
    // The row that matters: a certificate is issued when the record
    // resolves, which cannot happen unless the host is already on the
    // project. An implementation that attached only once DNS was pointed
    // would deadlock every customer.
    seedDestination();
    await expect(
      syncHostname({ destinationId: "dest-1", hostname: "blog.example.com", resolves: false })
    ).resolves.toBe("pending_dns");
    expect(attached).toEqual(["blog.example.com"]);
    expect(db.rows("destinations")[0]?.hostname_state).toBe("pending_dns");
  });

  it("a record that resolves is live, and the row carries it", async () => {
    seedDestination();
    await expect(
      syncHostname({ destinationId: "dest-1", hostname: "blog.example.com", resolves: true })
    ).resolves.toBe("live");
    expect(db.rows("destinations")[0]?.hostname_state).toBe("live");
  });

  it("it is idempotent: a second sync attaches again and says the same thing", async () => {
    seedDestination();
    await syncHostname({ destinationId: "dest-1", hostname: "blog.example.com", resolves: true });
    await expect(
      syncHostname({ destinationId: "dest-1", hostname: "blog.example.com", resolves: true })
    ).resolves.toBe("live");
    expect(attached).toEqual(["blog.example.com", "blog.example.com"]);
    expect(db.rows("destinations")).toHaveLength(1);
  });

  it("what the vendor answered never reaches the row — only the state and the date it was asked", async () => {
    seedDestination();
    await syncHostname({ destinationId: "dest-1", hostname: "blog.example.com", resolves: false });
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
