import { describe, it, expect } from "vitest";
import { safeRelativePath } from "./safe-redirect";

describe("safeRelativePath — open-redirect guard (CWE-601)", () => {
  it("keeps genuine in-app relative paths", () => {
    expect(safeRelativePath("/app")).toBe("/app");
    expect(safeRelativePath("/app/billing")).toBe("/app/billing");
    expect(safeRelativePath("/app/dashboard?tab=1")).toBe("/app/dashboard?tab=1");
  });

  it("REJECTS protocol-relative + backslash tricks that startsWith('/') lets through", () => {
    // The exact vuln: these all start with "/" but resolve to another origin.
    for (const evil of ["//evil.com", "//evil.com/app", "/\\evil.com", "/\\/evil.com"]) {
      expect(safeRelativePath(evil), evil).toBe("/app");
    }
  });

  it("rejects absolute URLs, non-strings, and control-char smuggling", () => {
    expect(safeRelativePath("https://evil.com")).toBe("/app");
    expect(safeRelativePath("javascript:alert(1)")).toBe("/app");
    expect(safeRelativePath(null)).toBe("/app");
    expect(safeRelativePath(undefined)).toBe("/app");
    expect(safeRelativePath("/app\nHost: evil")).toBe("/app");
  });

  it("honours a custom fallback", () => {
    expect(safeRelativePath("//evil.com", "/login")).toBe("/login");
  });
});
