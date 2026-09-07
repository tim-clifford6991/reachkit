// tests/app/setup/gate-state.test.ts — BUILD §4.3, issue #133
//
// The reading half of the incomplete-setup gate: the session names the
// account, `sites.setup_completed_at` says how far through setup it is,
// and everything that is neither of those answers `null`.
//
// `gate.test.ts` owns the redirect matrix this feeds. What is asserted
// here is the one thing that file mocks away: that the state comes from
// the signed-in account and from the store's own `readProgress`, not from
// a fixture and not from a second query.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";
import type { Session } from "@/lib/account/identity";
import type { SetupProgressState, SetupStore } from "@/app/(account)/setup/submit";

applyEnvFixture();

let session: Session | null = null;
const readProgress = vi.fn<(userId: string) => Promise<SetupProgressState>>();

vi.mock("@/lib/account/identity", () => ({
  currentSession: async () => session,
}));

vi.mock("@/app/(account)/setup/_setup/store", () => ({
  liveSetupStore: (): Pick<SetupStore, "readProgress"> => ({ readProgress }),
}));

const { readSetupGateState, resetSetupGateReader } = await import(
  "@/app/(account)/setup/gate-state"
);

const PAID_AT = new Date(Date.UTC(2026, 8, 5, 9, 30, 0));
const COMPLETED_AT = new Date(Date.UTC(2026, 8, 6, 11, 0, 0));

beforeEach(() => {
  resetSetupGateReader();
  readProgress.mockReset();
  session = { userId: "user-1", siteId: "site-1" };
});

describe("the account is the session's, and the state is that account's own row", () => {
  it("an unfinished founder reads as unfinished, for the account the session names", async () => {
    readProgress.mockResolvedValue({ complete: false, siteId: "site-1", paidAt: PAID_AT });
    await expect(readSetupGateState()).resolves.toEqual({
      complete: false,
      siteId: "site-1",
      paidAt: PAID_AT,
    });
    expect(readProgress).toHaveBeenCalledWith("user-1");
  });

  it("a finished founder reads as finished", async () => {
    readProgress.mockResolvedValue({ complete: true, siteId: "site-1", completedAt: COMPLETED_AT });
    await expect(readSetupGateState()).resolves.toEqual({
      complete: true,
      siteId: "site-1",
      completedAt: COMPLETED_AT,
    });
  });

  it("asks about the asking account and no other — the user id is never a parameter of the caller's", async () => {
    readProgress.mockResolvedValue({ complete: false, siteId: "s", paidAt: PAID_AT });
    session = { userId: "someone-else", siteId: "their-site" };
    await readSetupGateState();
    expect(readProgress).toHaveBeenCalledWith("someone-else");
  });
});

describe("what cannot be answered is null, never a guess at incomplete", () => {
  it("no session — a forged, expired or ended cookie names nobody", async () => {
    session = null;
    await expect(readSetupGateState()).resolves.toBeNull();
    expect(readProgress).not.toHaveBeenCalled();
  });

  it("no site row — provisioning has not run, which is not a statement about setup", async () => {
    // `/setup` reads the same missing row, so redirecting there would be a
    // screen that cannot render instead of one that can.
    readProgress.mockRejectedValue(new Error("setup store: no site for user-1"));
    await expect(readSetupGateState()).resolves.toBeNull();
  });

  it("a database that will not answer is null, and the request is served", async () => {
    readProgress.mockRejectedValue(new Error("connection refused"));
    await expect(readSetupGateState()).resolves.toBeNull();
  });
});
