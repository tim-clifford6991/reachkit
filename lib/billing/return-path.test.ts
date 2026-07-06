import { describe, it, expect } from "vitest";
import { safeReturnPath } from "./return-path";

describe("safeReturnPath", () => {
  it("accepts in-app paths", () => {
    expect(safeReturnPath("/app/settings")).toBe("/app/settings");
    expect(safeReturnPath("/app")).toBe("/app");
    expect(safeReturnPath("/app?upgraded=1")).toBe("/app?upgraded=1");
    expect(safeReturnPath("/app/plan")).toBe("/app/plan");
  });

  it("falls back for non-app or malformed paths", () => {
    expect(safeReturnPath("/login")).toBe("/app");
    expect(safeReturnPath("/")).toBe("/app");
    expect(safeReturnPath("app/settings")).toBe("/app"); // no leading slash
  });

  it("rejects open-redirect attempts", () => {
    expect(safeReturnPath("//evil.com")).toBe("/app");
    expect(safeReturnPath("/\\evil.com")).toBe("/app");
    expect(safeReturnPath("https://evil.com/app")).toBe("/app");
    expect(safeReturnPath("/app\n/x")).toBe("/app"); // control char
  });

  it("falls back for non-strings and honors a custom fallback", () => {
    expect(safeReturnPath(undefined)).toBe("/app");
    expect(safeReturnPath(null)).toBe("/app");
    expect(safeReturnPath(42)).toBe("/app");
    expect(safeReturnPath("/nope", "/app/settings")).toBe("/app/settings");
  });
});
