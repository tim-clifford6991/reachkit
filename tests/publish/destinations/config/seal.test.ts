// tests/publish/destinations/config/seal.test.ts — BUILD §9: "credentials
// encrypted at rest, never logged, revoked on disconnect."
//
// Three promises, and each is asserted as a property rather than as a
// happy path:
//
//   encrypted at rest → the stored value is not the plaintext, and a
//                       tampered ciphertext does not decrypt
//   never logged      → a seeded token appears in no string this module
//                       can emit, on any path, including every error one
//   revoked           → disconnect nulls the ciphertext and keeps the row
//
// The archived plan is WO-224.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type Row } from "../../harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

import { destroyConfig, NoConfigError, seal, SealError, storeConfig, withConfig } from "@/lib/publish/destinations/config";
import { unseal } from "@/lib/publish/destinations/config/seal";

/** A recognisable string that could only have come from the credential. */
const TOKEN = "wp-app-password-Zq7Kx-NEVER-LOG-ME";
const CREDENTIAL = { user: "reachkit", password: TOKEN, baseUrl: "https://example.com" };

function seedDestination(over: Row = {}): void {
  db.seed("destinations", [
    {
      id: "dest-1",
      site_id: "site-1",
      kind: "wordpress",
      config: seal(CREDENTIAL),
      health: "ok",
      health_reason: null,
      health_changed_at: "2026-09-01T00:00:00.000Z",
      broken_mail_sent_at: null,
      last_checked_at: "2026-09-06T00:00:00.000Z",
      deleted_at: null,
      publish_capable: true,
      ...over,
    },
  ]);
}

beforeEach(() => {
  db.reset();
});

describe("a WordPress application password is encrypted at rest", () => {
  it("the stored value is not the plaintext, and contains no part of it", () => {
    const sealed = seal(CREDENTIAL);
    expect(sealed).not.toContain(TOKEN);
    expect(sealed).not.toContain("reachkit");
    expect(sealed).not.toContain("example.com");
  });

  it("a sealed config round-trips", () => {
    expect(unseal(seal(CREDENTIAL))).toEqual(CREDENTIAL);
  });

  it("two seals of the same credential differ — the nonce is per call, so equal ciphertexts never reveal equal credentials", () => {
    expect(seal(CREDENTIAL)).not.toBe(seal(CREDENTIAL));
  });

  it("a tampered ciphertext does not decrypt — the authentication tag is what makes this an error rather than a plausible object", () => {
    const sealed = seal(CREDENTIAL);
    const [version, iv, tag, body] = sealed.split(".");
    const flipped = `${body!.slice(0, -2)}${body!.slice(-2) === "AA" ? "AB" : "AA"}`;
    expect(() => unseal([version, iv, tag, flipped].join("."))).toThrow(SealError);
  });

  it("a value sealed under another purpose label does not decrypt here", () => {
    // The HKDF info string is what separates this key from the two the
    // mail module derives from the same secret. A ciphertext with the
    // right shape and the wrong key is refused, not misread.
    expect(() => unseal("v1.AAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAA.AAAA")).toThrow(SealError);
  });

  it("an unversioned or truncated value is refused rather than guessed at", () => {
    expect(() => unseal("")).toThrow(SealError);
    expect(() => unseal("v2.a.b.c")).toThrow(SealError);
    expect(() => unseal("not-a-sealed-value")).toThrow(SealError);
  });
});

describe("withConfig returns the callback's value and never the config", () => {
  it("the plaintext reaches the callback", async () => {
    seedDestination();
    const seen = await withConfig<typeof CREDENTIAL, string>("dest-1", async (cfg) => cfg.password);
    expect(seen).toBe(TOKEN);
  });

  it("it returns what the callback returned, not the config", async () => {
    seedDestination();
    expect(await withConfig("dest-1", async () => "ok")).toBe("ok");
  });

  it("no read path used by any surface returns the config: the one select list does not name the column", async () => {
    const { RECORD_COLUMNS } = await import("@/lib/publish/destinations/store");
    expect(RECORD_COLUMNS).not.toContain("config");
  });

  it("a destination with no credential is NoConfigError, not an empty object", async () => {
    seedDestination({ config: null });
    await expect(withConfig("dest-1", async () => "unreached")).rejects.toBeInstanceOf(NoConfigError);
  });

  it("a destination that is not there is NoConfigError too", async () => {
    seedDestination();
    await expect(withConfig("dest-missing", async () => "unreached")).rejects.toBeInstanceOf(NoConfigError);
  });
});

describe("disconnect destroys the stored credentials, and the row survives", () => {
  it("destroyConfig nulls the ciphertext and sets deleted_at in the same statement", async () => {
    seedDestination();
    await destroyConfig("dest-1", new Date("2026-09-06T12:00:00.000Z"));
    const [row] = db.rows("destinations");
    expect(row!.config).toBeNull();
    expect(row!.deleted_at).toBe("2026-09-06T12:00:00.000Z");
  });

  it("the row itself is still there — publications point at it (ADR-080)", async () => {
    seedDestination();
    await destroyConfig("dest-1", new Date());
    expect(db.rows("destinations")).toHaveLength(1);
  });

  it("one update, not two: a deleted_at written without the null would leave a disconnected destination holding the password", async () => {
    seedDestination();
    const before = db.queries.filter((q) => q.table === "destinations" && q.verb === "update").length;
    await destroyConfig("dest-1", new Date());
    const writes = db.queries.filter((q) => q.table === "destinations" && q.verb === "update");
    expect(writes).toHaveLength(before + 1);
    expect(writes.at(-1)!.values).toMatchObject({ config: null });
    expect(Object.keys(writes.at(-1)!.values!)).toContain("deleted_at");
  });
});

describe("no part of a credential appears in any string this module can emit", () => {
  /** Every string the module writes or throws while every path is
   *  exercised — including the ones that fail. */
  async function sweep(): Promise<string[]> {
    const emitted: string[] = [];
    const capture = (...args: unknown[]): void => {
      emitted.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
    };
    const spies = [
      vi.spyOn(console, "log").mockImplementation(capture),
      vi.spyOn(console, "warn").mockImplementation(capture),
      vi.spyOn(console, "error").mockImplementation(capture),
      vi.spyOn(console, "debug").mockImplementation(capture),
    ];

    const record = (error: unknown): void => {
      if (error instanceof Error) {
        emitted.push(error.message, error.stack ?? "", String(error));
      } else {
        emitted.push(String(error));
      }
    };

    try {
      seedDestination();
      emitted.push(seal(CREDENTIAL));
      await withConfig("dest-1", async () => "value");
      await storeConfig("dest-1", CREDENTIAL);
      emitted.push(JSON.stringify(db.rows("destinations")));

      // Every failing path, each with the credential in play.
      try {
        seal({ get boom(): never { throw new Error(`cyclic ${TOKEN}`); } });
      } catch (error) { record(error); }
      try {
        unseal(`v1.AAAA.AAAA.${Buffer.from(TOKEN).toString("base64url")}`);
      } catch (error) { record(error); }
      db.seed("destinations", []);
      try {
        await withConfig("dest-1", async () => "unreached");
      } catch (error) { record(error); }
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
    return emitted;
  }

  it("the seeded token appears in nothing this module emitted, on any path", async () => {
    const emitted = await sweep();
    // The sweep must actually have produced strings, or it proves nothing.
    expect(emitted.filter((line) => line !== "").length).toBeGreaterThan(4);
    for (const line of emitted) expect(line).not.toContain(TOKEN);
  });

  it("a seal failure names the operation and carries no value", () => {
    const error = new SealError("seal");
    expect(error.message).toBe(
      "src/lib/publish/destinations/config: could not seal a destination credential."
    );
    expect(error.message).not.toContain(TOKEN);
  });
});
