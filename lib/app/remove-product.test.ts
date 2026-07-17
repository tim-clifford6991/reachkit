import { beforeEach, expect, test, vi } from "vitest";

beforeEach(() => vi.resetModules());

function db(appIds: string[]) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: { app_ids: appIds }, error: null });
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn().mockReturnValue({ eq: updateEq });
  const select = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) });
  const from = vi.fn().mockReturnValue({ select, update });
  return { serverDb: vi.fn().mockReturnValue({ from }), update, from };
}

test("removeTrackedProduct unlinks the app, leaving the shared apps row intact", async () => {
  const d = db(["app-1", "app-2"]);
  vi.doMock("@/lib/db/client", () => ({ serverDb: d.serverDb }));
  const { removeTrackedProduct } = await import("./remove-product");

  await removeTrackedProduct("user-1", "app-1");

  // Unlink ONLY. `apps` is keyed by URL GLOBALLY — two users tracking one URL
  // share an app_id (spec 2026-07-15 Risks), so deleting the row would destroy
  // another user's scans. Unlink is the whole operation.
  expect(d.update).toHaveBeenCalledWith({ app_ids: ["app-2"] });
  expect(d.from).not.toHaveBeenCalledWith("apps");
  expect(d.from).not.toHaveBeenCalledWith("scans");
});

test("removing an app the user does not track is refused (never silently no-ops)", async () => {
  const d = db(["app-2"]);
  vi.doMock("@/lib/db/client", () => ({ serverDb: d.serverDb }));
  const { removeTrackedProduct, RemoveProductError } = await import("./remove-product");

  await expect(removeTrackedProduct("user-1", "app-1")).rejects.toThrow(RemoveProductError);
  expect(d.update).not.toHaveBeenCalled();
});
