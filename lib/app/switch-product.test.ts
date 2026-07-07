import { afterEach, describe, expect, test, vi } from "vitest";
import { switchTrackedProduct } from "./switch-product";

// Configurable serverDb mock. `insertedAppId` is what apps.insert(...).single()
// returns; `appIds` is the user's current slot list; `updatedAppIds` captures
// the value written back to users.app_ids.
let insertedAppId = "new-app";
let appIds: string[] = [];
let updatedAppIds: string[] | null = null;

function makeDb() {
  return {
    from(table: string) {
      if (table === "apps") {
        return {
          insert: () => ({
            select: () => ({
              single: async () => ({ data: { id: insertedAppId }, error: null }),
            }),
          }),
        };
      }
      // users
      return {
        select: () => ({
          eq: () => ({ single: async () => ({ data: { app_ids: appIds }, error: null }) }),
        }),
        update: (payload: { app_ids: string[] }) => {
          updatedAppIds = payload.app_ids;
          return { eq: async () => ({ error: null }) };
        },
      };
    },
  };
}

vi.mock("@/lib/db/client", () => ({ serverDb: () => makeDb() }));

afterEach(() => {
  insertedAppId = "new-app";
  appIds = [];
  updatedAppIds = null;
});

describe("switchTrackedProduct", () => {
  test("replaces the old app in the tracked slot, preserving order and siblings", async () => {
    insertedAppId = "app-new";
    appIds = ["app-a", "app-old", "app-b"];

    const res = await switchTrackedProduct("u1", "app-old", "https://new.com", "web");

    expect(res.newAppId).toBe("app-new");
    expect(updatedAppIds).toEqual(["app-a", "app-new", "app-b"]);
  });

  test("solo user (single slot) ends up tracking only the new app", async () => {
    insertedAppId = "app-new";
    appIds = ["app-old"];

    await switchTrackedProduct("u1", "app-old", "https://new.com", "web");

    expect(updatedAppIds).toEqual(["app-new"]);
  });

  test("appends when the old id isn't in the list (defensive)", async () => {
    insertedAppId = "app-new";
    appIds = ["app-a"];

    await switchTrackedProduct("u1", "app-missing", "https://new.com", "web");

    expect(updatedAppIds).toEqual(["app-a", "app-new"]);
  });
});
