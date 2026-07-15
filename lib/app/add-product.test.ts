// lib/app/add-product.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const findAppByUrl = vi.fn();
const findExistingScanForApp = vi.fn();
vi.mock("@/lib/scan/abuse", () => ({ findAppByUrl: (...a: unknown[]) => findAppByUrl(...a), findExistingScanForApp: (...a: unknown[]) => findExistingScanForApp(...a) }));

const scanRow = vi.fn();
vi.mock("@/lib/db/client", () => ({
  serverDb: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => scanRow() }) }) }) }),
}));

const NOW = new Date("2026-07-15T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

describe("resolveProductScan (invariant: ONE dedupe/staleness policy)", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("no app for the URL → fresh", async () => {
    findAppByUrl.mockResolvedValue(null);
    const { resolveProductScan } = await import("./add-product");
    expect(await resolveProductScan("https://x.com/", { paid: true, now: NOW })).toEqual({ kind: "fresh" });
  });

  it("done scan 4 days old → deepen (reuse; nudgi.ai's real case)", async () => {
    findAppByUrl.mockResolvedValue("app1");
    findExistingScanForApp.mockResolvedValue("scan1");
    scanRow.mockReturnValue({ data: { status: "done", created_at: daysAgo(4) } });
    const { resolveProductScan } = await import("./add-product");
    expect(await resolveProductScan("https://x.com/", { paid: true, now: NOW })).toEqual({ kind: "deepen", appId: "app1", scanId: "scan1" });
  });

  it("done scan 15 days old → rescan (never present stale data as current)", async () => {
    findAppByUrl.mockResolvedValue("app1");
    findExistingScanForApp.mockResolvedValue("scan1");
    scanRow.mockReturnValue({ data: { status: "done", created_at: daysAgo(15) } });
    const { resolveProductScan } = await import("./add-product");
    expect(await resolveProductScan("https://x.com/", { paid: true, now: NOW })).toEqual({ kind: "rescan", appId: "app1" });
  });

  it("exactly 14 days → deepen (boundary is inclusive)", async () => {
    findAppByUrl.mockResolvedValue("app1");
    findExistingScanForApp.mockResolvedValue("scan1");
    scanRow.mockReturnValue({ data: { status: "done", created_at: daysAgo(14) } });
    const { resolveProductScan } = await import("./add-product");
    expect((await resolveProductScan("https://x.com/", { paid: true, now: NOW })).kind).toBe("deepen");
  });

  it("app exists but no reusable scan (failed/stuck) → rescan", async () => {
    findAppByUrl.mockResolvedValue("app1");
    findExistingScanForApp.mockResolvedValue(null);
    const { resolveProductScan } = await import("./add-product");
    expect(await resolveProductScan("https://x.com/", { paid: true, now: NOW })).toEqual({ kind: "rescan", appId: "app1" });
  });

  it("a scan is already RUNNING → attach, never trigger a duplicate paid run", async () => {
    findAppByUrl.mockResolvedValue("app1");
    findExistingScanForApp.mockResolvedValue("scan1");
    scanRow.mockReturnValue({ data: { status: "collecting", created_at: daysAgo(0) } });
    const { resolveProductScan } = await import("./add-product");
    expect(await resolveProductScan("https://x.com/", { paid: true, now: NOW })).toEqual({ kind: "attach", appId: "app1", scanId: "scan1" });
  });

  it("free viewer NEVER rescans a stale scan (cost guard: free dedupe is unchanged)", async () => {
    findAppByUrl.mockResolvedValue("app1");
    findExistingScanForApp.mockResolvedValue("scan1");
    scanRow.mockReturnValue({ data: { status: "done", created_at: daysAgo(90) } });
    const { resolveProductScan } = await import("./add-product");
    expect(await resolveProductScan("https://x.com/", { paid: false, now: NOW })).toEqual({ kind: "attach", appId: "app1", scanId: "scan1" });
  });
});

import { classifyUrl } from "@/lib/scan/router";

describe("URL canonicalisation contract (classify BEFORE resolve)", () => {
  it("every variant of one domain canonicalises to ONE app key", () => {
    const variants = ["nudgi.ai", "https://nudgi.ai", "https://nudgi.ai/", "https://www.nudgi.ai/", "HTTPS://WWW.Nudgi.AI/pricing?utm=x"];
    const canon = variants.map((v) => classifyUrl(v).url);
    expect(new Set(canon).size).toBe(1);
    expect(canon[0]).toBe("https://nudgi.ai/");
  });

  it("resolveProductScan is called with the CANONICAL url, so lookups can't miss", async () => {
    findAppByUrl.mockResolvedValue(null);
    const { resolveProductScan } = await import("./add-product");
    await resolveProductScan(classifyUrl("WWW.Nudgi.AI/x?q=1").url, { paid: true, now: NOW });
    expect(findAppByUrl).toHaveBeenCalledWith("https://nudgi.ai/");
  });
});
