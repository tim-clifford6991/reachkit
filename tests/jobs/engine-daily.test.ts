// tests/jobs/engine-daily.test.ts — BUILD §11, §9 (issue #173)
//
// The two seams that were `notBuilt`, at the seam itself: what each passes
// to the engine that owns the rule, and the one obligation the engine
// cannot discharge for itself.
//
// The rules are tested where they live (`tests/publish/daily/sites.test.ts`,
// `tests/publish/attempt/deliver.test.ts`). What is asserted here is the
// wiring: that `activeSites()` is the list and nothing else, that
// `publishApproved()` reports a hold and a failure as the step they stopped
// at rather than as a run that claims a page went out, and that the +24h
// check is enqueued for a delivery that produced an address and for no
// other — `src/lib/**` may not send job events (ARCHITECTURE rule 2), so
// this is the one place that enqueue can be.
import { beforeEach, describe, expect, it, vi } from "vitest";
// The seam statically imports the built engines, and through them
// `@/lib/db`, which parses the environment the moment it is imported.
import { applyEnvFixture } from "../mail/env-fixture";
import type { ApprovedDelivery } from "@/lib/publish/attempt/deliver";

applyEnvFixture();

const sitesForDailyTick = vi.fn<() => Promise<readonly { siteId: string; timeZone: string }[]>>();
const deliverApproved = vi.fn<() => Promise<ApprovedDelivery>>();
const sendJobEvent = vi.fn<(event: string, data: Record<string, unknown>) => Promise<void>>();

vi.mock("@/lib/publish/daily", () => ({ sitesForDailyTick: () => sitesForDailyTick() }));
vi.mock("@/lib/publish/attempt/deliver", () => ({ deliverApproved: () => deliverApproved() }));
vi.mock("@/jobs/client", () => ({
  sendJobEvent: (event: string, data: Record<string, unknown>) => sendJobEvent(event, data),
}));

// Imported after the fixture is applied, which a static import would be
// hoisted above.
const { activeSites, publishApproved } = await import("@/jobs/engine");

const ARGS = { draftId: "d1", destinationId: "dest-1" };

beforeEach(() => {
  sitesForDailyTick.mockReset();
  deliverApproved.mockReset();
  sendJobEvent.mockReset();
  sendJobEvent.mockResolvedValue(undefined);
});

describe("activeSites() is the list the engine owns, and nothing of its own", () => {
  it("hands back exactly what the engine answered", async () => {
    const sites = [{ siteId: "s1", timeZone: "America/New_York" }];
    sitesForDailyTick.mockResolvedValue(sites);
    expect(await activeSites()).toEqual(sites);
    expect(sitesForDailyTick).toHaveBeenCalledTimes(1);
  });

  it("an empty list is an empty list, never a throw", async () => {
    sitesForDailyTick.mockResolvedValue([]);
    await expect(activeSites()).resolves.toEqual([]);
  });
});

describe("publishApproved() reports what happened to the page", () => {
  it("a delivery with an address is done, and queues the +24h check for that publication", async () => {
    deliverApproved.mockResolvedValue({
      kind: "delivered",
      publicationId: "pub-1",
      verifyDue: true,
      alreadyPublished: false,
    });
    expect(await publishApproved(ARGS)).toEqual({ done: true });
    expect(sendJobEvent).toHaveBeenCalledWith("publish/verify", { publicationId: "pub-1" });
  });

  it("a delivery with no address queues no check — the address decides, never the kind (BP-049)", async () => {
    deliverApproved.mockResolvedValue({
      kind: "delivered",
      publicationId: "pub-1",
      verifyDue: false,
      alreadyPublished: false,
    });
    expect(await publishApproved(ARGS)).toEqual({ done: true });
    expect(sendJobEvent).not.toHaveBeenCalled();
  });

  it("a re-delivery that found the row already delivered queues nothing — its check went out the first time", async () => {
    deliverApproved.mockResolvedValue({
      kind: "delivered",
      publicationId: "pub-1",
      verifyDue: true,
      alreadyPublished: true,
    });
    expect(await publishApproved(ARGS)).toEqual({ done: true });
    expect(sendJobEvent).not.toHaveBeenCalled();
  });

  it("a held page names what held it, and is never reported as a run that published", async () => {
    deliverApproved.mockResolvedValue({ kind: "held", heldBy: "switch_off" });
    expect(await publishApproved(ARGS)).toEqual({ degraded: "held:switch_off" });
    expect(sendJobEvent).not.toHaveBeenCalled();
  });

  it("a failure names the reason it failed for, and queues no check", async () => {
    deliverApproved.mockResolvedValue({
      kind: "failed",
      reason: "credentials_invalid",
      decision: { kind: "needs_attention", because: "reason_needs_customer" },
    });
    expect(await publishApproved(ARGS)).toEqual({ degraded: "publish:credentials_invalid" });
    expect(sendJobEvent).not.toHaveBeenCalled();
  });

  it("neither a hold nor a failure throws — the tick carries on past a page that did not go out", async () => {
    for (const outcome of [
      { kind: "held", heldBy: "ceiling_day" },
      { kind: "failed", reason: "network", decision: { kind: "retry", dueAt: new Date(), retryNo: 1 } },
    ] as ApprovedDelivery[]) {
      deliverApproved.mockResolvedValue(outcome);
      await expect(publishApproved(ARGS)).resolves.toBeDefined();
    }
  });
});
