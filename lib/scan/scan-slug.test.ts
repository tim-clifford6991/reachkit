/**
 * scan-slug.test.ts — personal scan URLs (pure parts).
 */
import { describe, expect, test } from "vitest";
import { isScanUuid, slugForScan } from "./scan-slug";

describe("isScanUuid", () => {
  test("matches real scan UUIDs", () => {
    expect(isScanUuid("507486d6-9c4a-4d87-a9f3-2a0e91d9f10d")).toBe(true);
  });
  test("rejects domains", () => {
    expect(isScanUuid("nudgi.ai")).toBe(false);
    expect(isScanUuid("resend.com")).toBe(false);
  });
});

describe("slugForScan", () => {
  test("web scans slug to the bare domain (www stripped)", () => {
    expect(slugForScan({ storeUrl: "https://resend.com/", platform: "web", scanId: "u1" })).toBe("resend.com");
    expect(slugForScan({ storeUrl: "https://www.nudgi.ai/pricing", platform: "web", scanId: "u1" })).toBe("nudgi.ai");
  });
  test("app-store scans keep the scan UUID", () => {
    expect(slugForScan({ storeUrl: "https://apps.apple.com/us/app/x/id1", platform: "ios", scanId: "uuid-1" })).toBe("uuid-1");
  });
});
