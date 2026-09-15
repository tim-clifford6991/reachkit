// tests/publish/setup/apply.test.ts — BUILD §4.3, issue #36
//
// applySetupChoice(): two writes, one transaction, zero network calls, and
// never a fallback destination.
//
// The schema half — that `apply_setup_choice` exists, that it is one
// PL/pgSQL statement, that the deferred destination is written with an
// existing `health` value — moved to `schema.test.ts` when issue #6 added
// this feature's `LIVE_SCHEMA_TESTS` row (issue #78). It is asserted there
// against a live database instead of against the migration's text.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { applyEnvFixture } from "../../mail/env-fixture";
import { fakeDb, type FakeDb } from "../../scan/deep/fake-db";

applyEnvFixture();

let db: FakeDb = fakeDb();

vi.mock("@/lib/db", () => ({
  dbAdmin: () => db.client,
  db: () => db.client,
}));

/** The egress seam, stubbed to throw. Any DNS resolution, robots read or
 *  outbound byte from this path fails the suite rather than quietly
 *  slowing setup down. */
const egressReached = vi.fn(() => {
  throw new Error("applySetupChoice must make no network call");
});

vi.mock("@/lib/egress/dns", () => ({ resolvesInDns: egressReached }));
vi.mock("@/lib/egress/fetch", () => ({ safeFetch: egressReached }));

const { applySetupChoice } = await import("../../../src/lib/publish/setup/apply");

const SITE = "site-1";

const APPLY_SOURCE = readFileSync(
  path.resolve(import.meta.dirname, "../../../src/lib/publish/setup/apply.ts"),
  "utf8"
);
beforeEach(() => {
  egressReached.mockClear();
  db = fakeDb({ sites: [{ id: SITE, mode: "copilot" }], destinations: [] });
});

describe("§4.3 — the mode and the destination are two writes in one transaction", () => {
  it("both land, from one call", async () => {
    const applied = await applySetupChoice({
      siteId: SITE,
      destinationKind: "hosted",
      hostname: "content.example.com",
    });

    expect(applied).toEqual({ ok: true, destinationId: applied.destinationId, connected: false });
    // #476: setup takes no mode and always records autopilot.
    expect(db.tables.sites![0]!.mode).toBe("autopilot");
    expect(db.rpcCalls[0]!.args.p_mode).toBe("autopilot");
    expect(db.tables.destinations).toHaveLength(1);
    expect(db.tables.destinations![0]!.kind).toBe("hosted");
  });

  it("it is one round trip, so there is no instant at which one has landed and the other has not", async () => {
    await applySetupChoice({ siteId: SITE, destinationKind: "wordpress", hostname: null });
    expect(db.rpcCalls).toHaveLength(1);
    expect(db.rpcCalls[0]!.fn).toBe("apply_setup_choice");
  });

  it("the transaction is the database's, not a sequence of PostgREST requests", () => {
    // The function's own shape is `schema.test.ts`'s, against a live
    // database; what this file owns is that the module reaches for it and
    // never for a table.
    expect(APPLY_SOURCE).not.toMatch(/\.from\(/);
  });

  it("a site that does not exist is an error, never a half-applied setup", async () => {
    db = fakeDb({ sites: [], destinations: [] });
    await expect(
      applySetupChoice({ siteId: SITE, destinationKind: "hosted", hostname: "content.example.com" })
    ).rejects.toThrow(/destination id/);
    expect(db.tables.destinations).toEqual([]);
  });
});

describe("a host another site claimed is a typed refusal, not an error (issue 608)", () => {
  const violation = {
    data: null,
    error: { message: 'duplicate key value violates unique constraint "destinations_one_live_hostname"' },
  };

  it("the hostname index's violation throws HostnameTakenError, carrying the host", async () => {
    db.rpc = (async () => violation) as unknown as typeof db.rpc;
    const { HostnameTakenError } = await import("@/lib/publish/destinations/hosted/label");
    const attempt = applySetupChoice({
      siteId: SITE,
      destinationKind: "hosted",
      hostname: "blog.example.com",
    });
    await expect(attempt).rejects.toBeInstanceOf(HostnameTakenError);
    await expect(attempt).rejects.toMatchObject({ hostname: "blog.example.com" });
  });

  it("any other failure stays an ordinary error", async () => {
    db.rpc = (async () => ({ data: null, error: { message: "connection reset" } })) as unknown as typeof db.rpc;
    const { HostnameTakenError } = await import("@/lib/publish/destinations/hosted/label");
    const attempt = applySetupChoice({ siteId: SITE, destinationKind: "wordpress", hostname: null });
    await expect(attempt).rejects.toThrow(/connection reset/);
    await expect(attempt).rejects.not.toBeInstanceOf(HostnameTakenError);
  });
});

describe("REQ-028 c3 — a founder who uses WordPress can defer connecting it and setup still completes", () => {
  it("the destination row is created deferred, with no credential collected", async () => {
    const applied = await applySetupChoice({
      siteId: SITE,
      destinationKind: "wordpress",
      hostname: null,
    });

    expect(applied.ok).toBe(true);
    expect(applied.connected).toBe(false);
    const destination = db.tables.destinations![0]!;
    expect(destination.kind).toBe("wordpress");
    expect(destination.config).toBeNull();
    expect(destination.health).toBe("expired");
  });

  it("`health` is the destination's own, and this path never invents a fourth state", () => {
    // The value written is `schema.test.ts`'s assertion, against the live
    // `health` check; what this file owns is that the module's own code
    // names no health at all — the migration does. Its header comment
    // explains why, so the check runs against the statements alone.
    const code = APPLY_SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code).not.toContain("health");
  });
});

describe("REQ-028 c4 — setup completes with neither DNS nor WordPress set up", () => {
  it("zero network calls — the egress seam is never reached", async () => {
    await applySetupChoice({ siteId: SITE, destinationKind: "hosted", hostname: "content.example.com" });
    expect(egressReached).not.toHaveBeenCalled();
  });

  it("this module imports no egress, no vendor and no resolver at all", () => {
    const imports = APPLY_SOURCE.split("\n").filter((line) => line.startsWith("import "));
    expect(imports.join("\n")).not.toMatch(/egress|vendors|resolvesInDns|node:dns/);
    // The whole of what it imports, so a future addition is visible here
    // rather than merely un-matched by a pattern.
    expect(imports).toEqual([
      'import { dbAdmin } from "@/lib/db";',
      // Pure: the label rule and the collision error (issue 608).
      'import { HostnameTakenError } from "@/lib/publish/destinations/hosted/label";',
      'import type { DestinationKind, PublishingMode } from "./cards";',
    ]);
  });

  it("nothing here gates generation — the draft path does not import it", () => {
    const generators = ["src/lib/scan/run.ts", "src/lib/scan/deep/run.ts"];
    for (const file of generators) {
      const source = readFileSync(path.resolve(import.meta.dirname, "../../../", file), "utf8");
      expect(source).not.toContain("publish/setup/apply");
    }
  });
});

describe("REQ-028 c5 — nothing is published to any other destination", () => {
  it("the kind written is the kind chosen, for both kinds", async () => {
    for (const kind of ["hosted", "wordpress"] as const) {
      db = fakeDb({ sites: [{ id: SITE, mode: "autopilot" }], destinations: [] });
      await applySetupChoice({ siteId: SITE, destinationKind: kind, hostname: null });
      expect(db.tables.destinations![0]!.kind).toBe(kind);
    }
  });

  it("this module contains no fallback branch — no kind is substituted for another", () => {
    const code = APPLY_SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/"hosted"|"wordpress"/);
    expect(code).not.toMatch(/\bif\s*\([^)]*kind/);
  });

  it("`connected` is a literal false, so no caller can be written that waits on a connection", () => {
    expect(APPLY_SOURCE).toMatch(/connected:\s*false/);
    expect(APPLY_SOURCE).not.toMatch(/connected:\s*(true|boolean)/);
  });
});

describe("no engine setting is written here", () => {
  it("no veto window, publish time, brand voice or do-not-claim value is touched", () => {
    expect(APPLY_SOURCE).not.toMatch(/veto_hours|publish_time|voice_text|do_not_claim/);
  });
});
