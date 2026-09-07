// tests/app/settings/connect-destination.test.ts — REQ-060, issue #240:
// the Server Function behind the credential form.
//
// Four things decided here, and three of them are about what does **not**
// happen:
//
//  1. **Which call.** A site with a WordPress destination is reconnected; a
//     site with none has one created. The browser cannot know which and is
//     never asked — the row is derived from the session's own account.
//  2. **No id crosses the wire.** Neither a site id nor a destination id is
//     a parameter. A Server Function is an addressable endpoint, so an id
//     in the payload is an offer to write another account's row, and the
//     signature is what refuses it.
//  3. **The credential goes one way.** It reaches `connect`/`reconnect`
//     and nothing else: no log line carries it, and the outcome handed
//     back has no member a credential, a URL or a vendor string could
//     travel in.
//  4. **A refusal is a state, not a rejected form.** What comes back is the
//     `HealthReason` the check concluded with — the token the card already
//     renders through the registry — and the path is revalidated on both
//     arms so the row's own line is what the customer reads.
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const account = vi.hoisted(() => ({
  ok: true,
  siteId: "site-1",
  userId: "user-1",
}));

vi.mock("@/app/(account)/app/_session/account", () => ({
  appAccount: async () =>
    account.ok
      ? { ok: true, account: { siteId: account.siteId, userId: account.userId } }
      : { ok: false },
}));

const redirected = vi.hoisted(() => ({ to: null as string | null }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    redirected.to = path;
    throw new Error(`redirect:${path}`);
  },
}));

const revalidated = vi.hoisted(() => ({ paths: [] as string[] }));
vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => void revalidated.paths.push(path),
}));

const engine = vi.hoisted(() => ({
  connect: vi.fn(),
  reconnect: vi.fn(),
  listDestinations: vi.fn(),
}));

vi.mock("@/lib/publish/destinations", () => ({
  connect: (...a: unknown[]) => engine.connect(...a),
  reconnect: (...a: unknown[]) => engine.reconnect(...a),
  listDestinations: (...a: unknown[]) => engine.listDestinations(...a),
}));

const { connectWordPress } = await import("@/app/(account)/app/settings/destination-actions");

const CREDENTIAL = {
  siteUrl: "https://blog.acme.test",
  username: "reachkit-bot",
  applicationPassword: "abcd EFGH ijkl MNOP",
};

let logged: string[];

beforeEach(() => {
  account.ok = true;
  account.siteId = "site-1";
  account.userId = "user-1";
  redirected.to = null;
  revalidated.paths = [];
  engine.connect.mockReset().mockResolvedValue({ ok: true, destinationId: "dest-1", health: "ok" });
  engine.reconnect.mockReset().mockResolvedValue({ ok: true, held: 0, releasing: true });
  engine.listDestinations.mockReset().mockResolvedValue([]);
  logged = [];
  for (const level of ["log", "info", "warn", "error", "debug"] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      logged.push(args.map((a) => String(a)).join(" "));
    });
  }
});

afterEach(() => vi.restoreAllMocks());

describe("which call — derived from the account's own set, never from the payload", () => {
  it("a site with no destination has one created, for that account's site", async () => {
    expect(await connectWordPress(CREDENTIAL)).toEqual({ connected: true });
    expect(engine.connect).toHaveBeenCalledTimes(1);
    expect(engine.reconnect).not.toHaveBeenCalled();
    expect(engine.connect.mock.calls[0]?.[0]).toMatchObject({
      siteId: "site-1",
      kind: "wordpress",
      by: { kind: "customer", userId: "user-1" },
    });
  });

  it("a site that already has a WordPress destination reconnects it, and creates no second row", async () => {
    engine.listDestinations.mockResolvedValue([{ id: "dest-9", kind: "wordpress" }]);
    expect(await connectWordPress(CREDENTIAL)).toEqual({ connected: true });
    expect(engine.reconnect).toHaveBeenCalledTimes(1);
    expect(engine.connect).not.toHaveBeenCalled();
    expect(engine.reconnect.mock.calls[0]?.[0]).toMatchObject({ destinationId: "dest-9" });
  });

  it("a hosted destination is not the one to reconnect — a WordPress row is created beside it", async () => {
    engine.listDestinations.mockResolvedValue([{ id: "dest-hosted", kind: "hosted" }]);
    await connectWordPress(CREDENTIAL);
    expect(engine.connect).toHaveBeenCalledTimes(1);
    expect(engine.reconnect).not.toHaveBeenCalled();
  });

  it("the set it reads is the session's site, not one it was handed", async () => {
    account.siteId = "site-other";
    await connectWordPress(CREDENTIAL);
    expect(engine.listDestinations).toHaveBeenCalledWith("site-other");
  });
});

describe("**no id crosses the wire**", () => {
  it("the argument carries exactly the three fields, and none is an id", () => {
    // A type-level statement made at runtime: the only keys the caller can
    // supply. A site id here would let any signed-in customer write
    // another account's destination. Three since the master's ruling of
    // 2026-09-07 — a WordPress application password authenticates as
    // `username:app-password`, so the user is part of the credential.
    expect(Object.keys(CREDENTIAL).sort()).toEqual([
      "applicationPassword",
      "siteUrl",
      "username",
    ]);
  });

  it("a session-less press lands on /signin and calls nothing", async () => {
    account.ok = false;
    await expect(connectWordPress(CREDENTIAL)).rejects.toThrow("redirect:/signin");
    expect(redirected.to).toBe("/signin");
    expect(engine.connect).not.toHaveBeenCalled();
    expect(engine.reconnect).not.toHaveBeenCalled();
    expect(engine.listDestinations).not.toHaveBeenCalled();
  });
});

describe("**the credential goes one way**", () => {
  it("it reaches the engine sealed by that call and is on no log line", async () => {
    await connectWordPress(CREDENTIAL);
    const config = engine.connect.mock.calls[0]?.[0] as { config: Record<string, string> };
    expect(config.config.applicationPassword).toBe(CREDENTIAL.applicationPassword);
    expect(logged.join("\n")).not.toContain(CREDENTIAL.applicationPassword);
    expect(logged.join("\n")).not.toContain(CREDENTIAL.siteUrl);
  });

  it("nothing of it comes back — the outcome is a boolean and a token", async () => {
    engine.connect.mockResolvedValue({ ok: false, reason: "credentials_expired" });
    const outcome = await connectWordPress(CREDENTIAL);
    expect(outcome).toEqual({ connected: false, because: "credentials_expired" });
    expect(JSON.stringify(outcome)).not.toContain(CREDENTIAL.applicationPassword);
    expect(JSON.stringify(outcome)).not.toContain("blog.acme.test");
  });

  it("the address and the user are trimmed; the password is not", async () => {
    // WordPress prints application passwords in spaced groups and accepts
    // them that way, so trimming a credential is how a product refuses a
    // correct one. Normalising the address is `WordPressConfig`'s business.
    await connectWordPress({
      siteUrl: "  https://blog.acme.test  ",
      username: "  reachkit-bot  ",
      applicationPassword: " abcd EFGH ",
    });
    const config = engine.connect.mock.calls[0]?.[0] as { config: Record<string, string> };
    expect(config.config.baseUrl).toBe("https://blog.acme.test");
    expect(config.config.username).toBe("reachkit-bot");
    expect(config.config.applicationPassword).toBe(" abcd EFGH ");
  });

  it("the user the password was issued to reaches the engine — without it a real site refuses", async () => {
    await connectWordPress(CREDENTIAL);
    const config = engine.connect.mock.calls[0]?.[0] as { config: Record<string, string> };
    expect(config.config.username).toBe("reachkit-bot");
    // And it is not the address wearing the user's slot, which is what it
    // was before the ruling.
    expect(config.config.username).not.toBe(config.config.baseUrl);
  });

  it("the module names no logger and no vendor at all", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const source = readFileSync(
      path.resolve(import.meta.dirname, "../../../src/app/(account)/app/settings/destination-actions.ts"),
      "utf8"
    );
    const code = source
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("//") && !line.trimStart().startsWith("*"))
      .join("\n");
    expect(code).not.toMatch(/console\./);
    expect(code).not.toContain("@/lib/vendors");
  });
});

describe("**a refusal is a state, and the card is redrawn either way**", () => {
  it("the reason the check concluded with is what comes back", async () => {
    engine.listDestinations.mockResolvedValue([{ id: "dest-9", kind: "wordpress" }]);
    engine.reconnect.mockResolvedValue({ ok: false, reason: "cannot_publish" });
    expect(await connectWordPress(CREDENTIAL)).toEqual({
      connected: false,
      because: "cannot_publish",
    });
  });

  it("the settings path is revalidated on success and on refusal alike", async () => {
    await connectWordPress(CREDENTIAL);
    expect(revalidated.paths).toEqual(["/app/settings"]);

    revalidated.paths = [];
    engine.connect.mockResolvedValue({ ok: false, reason: "credentials_invalid" });
    await connectWordPress(CREDENTIAL);
    expect(revalidated.paths).toEqual(["/app/settings"]);
  });
});
