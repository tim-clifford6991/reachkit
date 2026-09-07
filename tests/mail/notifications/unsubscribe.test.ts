// BUILD §4.7 — the kind-scoped unsubscribe link: one mail off, the other two untouched.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../env-fixture";
import { fakeDb, newState, type FakeDbState } from "./fake-db";

applyEnvFixture();

const state: FakeDbState = newState();
// Both exports, one fake: the notification store reads `users.notify`
// through `dbAdmin()` (#228 — `db()` is the anon key, and RLS
// `users_select_own` matches no row without a user JWT, so that read
// answered `absent` for everyone on every server path).
vi.mock("@/lib/db", () => ({
  db: () => fakeDbRef.current(),
  dbAdmin: () => fakeDbRef.current(),
}));
const fakeDbRef = { current: fakeDb(state) };

const { applyUnsubscribeToken, readUnsubscribeToken, unsubscribeTokenFor } = await import(
  "../../../src/lib/mail/notifications/unsubscribe"
);
const { readNotifyPrefs } = await import("../../../src/lib/mail/notifications/index");

const USER = "1b1f5c2e-0000-4000-8000-000000000001";

beforeEach(() => {
  state.rows = { [USER]: { notify: {} } };
  state.reads = [];
  state.writes = [];
  state.failRead = false;
  state.failWrite = false;
});

describe("BUILD §4.7 — the unsubscribe token", () => {
  it("round-trips the user and the kind it was signed for", () => {
    const token = unsubscribeTokenFor({ userId: USER, kind: "weekly" });
    expect(readUnsubscribeToken(token)).toEqual({ userId: USER, kind: "weekly" });
  });

  it("switches off exactly the kind it names, leaving the other two on", async () => {
    const token = unsubscribeTokenFor({ userId: USER, kind: "weekly" });
    await expect(applyUnsubscribeToken(token)).resolves.toEqual({ switchedOff: "weekly" });
    await expect(readNotifyPrefs(USER)).resolves.toEqual({
      "draft-ready": true,
      published: true,
      weekly: false,
    });
  });

  it("is idempotent — a second use of the same link succeeds again", async () => {
    const token = unsubscribeTokenFor({ userId: USER, kind: "published" });
    await expect(applyUnsubscribeToken(token)).resolves.toEqual({ switchedOff: "published" });
    await expect(applyUnsubscribeToken(token)).resolves.toEqual({ switchedOff: "published" });
    await expect(readNotifyPrefs(USER)).resolves.toEqual({
      "draft-ready": true,
      published: false,
      weekly: true,
    });
  });

  it("reading does not write — a link prefetch switches nothing off", () => {
    const token = unsubscribeTokenFor({ userId: USER, kind: "weekly" });
    expect(readUnsubscribeToken(token)).toEqual({ userId: USER, kind: "weekly" });
    expect(state.writes).toEqual([]);
    expect(state.reads).toEqual([]);
  });

  it("encodes no expiry, so a link found a year later still works", () => {
    const token = unsubscribeTokenFor({ userId: USER, kind: "weekly" });
    const [payload] = token.split(".") as [string];
    expect(Buffer.from(payload, "base64url").toString("utf8")).toBe(`${USER}:weekly`);
    expect(token).not.toMatch(/exp/i);
    // Nothing in the token is a timestamp: the payload is the two things
    // it names and no third field.
    expect(Buffer.from(payload, "base64url").toString("utf8").split(":")).toHaveLength(2);
  });

  it("a forged, truncated or re-signed token is invalid and writes nothing", async () => {
    const token = unsubscribeTokenFor({ userId: USER, kind: "weekly" });
    const forgedKind = `${Buffer.from(`${USER}:published`).toString("base64url")}.${token.split(".")[1]}`;
    for (const bad of [
      "",
      "nonsense",
      token.slice(0, -4),
      `${token}x`,
      forgedKind,
      token.split(".")[0] as string,
    ]) {
      expect(readUnsubscribeToken(bad), bad).toEqual({ error: "invalid" });
      await expect(applyUnsubscribeToken(bad), bad).resolves.toEqual({ error: "invalid" });
    }
    expect(state.writes).toEqual([]);
  });

  it("a token cannot name a kind outside the three", () => {
    const payload = Buffer.from(`${USER}:magic-link`).toString("base64url");
    expect(readUnsubscribeToken(`${payload}.${payload}`)).toEqual({ error: "invalid" });
  });

  it("a store outage is its own answer — the reader is not told their link is broken", async () => {
    state.failWrite = true;
    const token = unsubscribeTokenFor({ userId: USER, kind: "weekly" });
    await expect(applyUnsubscribeToken(token)).resolves.toEqual({ error: "unavailable" });
  });

  it("never reaches the address-wide suppression store", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const source = readFileSync(
      path.resolve(__dirname, "../../../src/lib/mail/notifications/unsubscribe.ts"),
      "utf8"
    );
    // ADR-042, as a dependency assertion rather than a review comment:
    // this module's import specifiers, not its prose.
    const specifiers = [...source.matchAll(/\bfrom\s+["']([^"']+)["']/g)].map((m) => m[1] as string);
    expect(specifiers.length).toBeGreaterThan(0);
    for (const specifier of specifiers) {
      expect(specifier, specifier).not.toMatch(/leads|suppress/i);
    }
  });
});
