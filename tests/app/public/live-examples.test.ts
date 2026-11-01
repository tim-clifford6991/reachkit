// The example report the landing and /about feature comes only from the
// approved list: ReachKit's own domain. The gallery is the database seam.
import "../../generate/env";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ listed: new Set<string>() }));

vi.mock("@/lib/publish/destinations/hosted/store", () => ({
  hostedSiteForDomain: async () => null,
  hostedHostOfSite: async () => null,
  livePagesForSite: async () => [],
}));
vi.mock("@/lib/scan/gallery", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/scan/gallery")>()),
  isListed: async (domain: string) => db.listed.has(domain),
}));

const { readLiveExamples } = await import("@/app/(public)/_how/examples");

beforeEach(() => {
  db.listed = new Set();
});

describe("the example report", () => {
  it("is reachkit.app while it is listed, whatever else is listed", async () => {
    db.listed = new Set(["podia.com", "example.com", "reachkit.app"]);
    expect((await readLiveExamples()).report).toBe("reachkit.app");
  });

  it("is none when only third-party reports are listed", async () => {
    db.listed = new Set(["podia.com", "example.com"]);
    expect((await readLiveExamples()).report).toBeNull();
  });
});
