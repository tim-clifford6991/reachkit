// app/(app)/app/add/actions.test.ts
//
// addProduct is the in-shell server action for /app/add. It ORCHESTRATES —
// auth, then addTrackedProduct (already covers cap/already-tracked/paused/
// URL-canonicalisation), then setActiveApp — and RETURNS the result so the
// client 3-step flow (AddFlow) can advance (URL → scanning → competitors). It
// no longer redirects on success. This file pins the orchestration contract
// only; lib/app/add-product.test.ts owns the policy.
//
// Every dependency is mocked so this file never touches real env/Supabase.
import { describe, it, expect, vi, beforeEach } from "vitest";

// Only the UNAUTHENTICATED path still redirects (to /login). Mock it to throw,
// matching Next's real abort-on-redirect, so we can assert that path.
class RedirectSignal extends Error {
  constructor(public path: string) {
    super(`REDIRECT:${path}`);
  }
}
const redirectMock = vi.fn((path: string) => {
  throw new RedirectSignal(path);
});
vi.mock("next/navigation", () => ({ redirect: (path: string) => redirectMock(path) }));

const requireUserMock = vi.fn();
class AuthErrorMock extends Error {
  constructor(message = "authentication required") {
    super(message);
    this.name = "AuthError";
  }
}
vi.mock("@/lib/auth/server", () => ({
  requireUser: (...a: unknown[]) => requireUserMock(...a),
  AuthError: AuthErrorMock,
}));

const addTrackedProductMock = vi.fn();
class AddProductErrorMock extends Error {
  constructor(
    public code: "cap" | "already_tracked" | "invalid_url" | "paused",
    message: string,
  ) {
    super(message);
    this.name = "AddProductError";
  }
}
vi.mock("@/lib/app/add-product", () => ({
  addTrackedProduct: (...a: unknown[]) => addTrackedProductMock(...a),
  AddProductError: AddProductErrorMock,
}));

const setActiveAppMock = vi.fn();
vi.mock("@/lib/app/set-active-app", () => ({ setActiveApp: (...a: unknown[]) => setActiveAppMock(...a) }));

const entitlementsForMock = vi.fn();
vi.mock("@/lib/billing/entitlements", () => ({ entitlementsFor: (...a: unknown[]) => entitlementsForMock(...a) }));

// classifyUrl + hostname are pure — use the REAL ones so the host the flow
// hands to CompetitorSetup is the genuine canonicalisation, not a mock's guess.

describe("addProduct server action (orchestration contract)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redirectMock.mockImplementation((path: string) => {
      throw new RedirectSignal(path);
    });
    entitlementsForMock.mockResolvedValue({ active: false });
  });

  it("empty url → inline error, never touches auth or the executor", async () => {
    const { addProduct } = await import("./actions");
    expect(await addProduct("")).toEqual({ ok: false, error: "Enter your product's website address." });
    expect(requireUserMock).not.toHaveBeenCalled();
    expect(addTrackedProductMock).not.toHaveBeenCalled();
  });

  it("whitespace-only url also counts as empty", async () => {
    const { addProduct } = await import("./actions");
    expect(await addProduct("   ")).toEqual({ ok: false, error: "Enter your product's website address." });
  });

  it("unauthenticated → redirects to /login with a return path, never calls the executor", async () => {
    requireUserMock.mockRejectedValue(new AuthErrorMock());
    const { addProduct } = await import("./actions");
    await expect(addProduct("example.com")).rejects.toBeInstanceOf(RedirectSignal);
    expect(redirectMock).toHaveBeenCalledWith("/login?next=/app/add");
    expect(addTrackedProductMock).not.toHaveBeenCalled();
  });

  it("a non-AuthError from requireUser propagates uncaught (never mis-swallowed as a form error)", async () => {
    requireUserMock.mockRejectedValue(new Error("db unreachable"));
    const { addProduct } = await import("./actions");
    await expect(addProduct("example.com")).rejects.toThrow("db unreachable");
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("trims the url before addTrackedProduct, and returns the CANONICAL host for the competitor step", async () => {
    requireUserMock.mockResolvedValue({ user: { id: "u1" } });
    addTrackedProductMock.mockResolvedValue({ appId: "app-1", scanId: "scan-1" });
    const { addProduct } = await import("./actions");
    const res = await addProduct("  HTTPS://WWW.Example.com/pricing?utm=x  ");
    expect(addTrackedProductMock).toHaveBeenCalledWith("u1", "HTTPS://WWW.Example.com/pricing?utm=x");
    // hostname(classifyUrl(...).url) — www stripped, lowercased, path dropped.
    expect(res).toMatchObject({ ok: true, appId: "app-1", scanId: "scan-1", host: "example.com" });
  });

  it("paid viewer → result carries paid:true so the scanning step runs the deep narrative", async () => {
    requireUserMock.mockResolvedValue({ user: { id: "u1" } });
    addTrackedProductMock.mockResolvedValue({ appId: "app-1", scanId: "scan-1" });
    entitlementsForMock.mockResolvedValue({ active: true });
    const { addProduct } = await import("./actions");
    expect(await addProduct("example.com")).toMatchObject({ ok: true, paid: true });
  });

  it("AddProductError's message becomes the inline error verbatim, and NO app is activated", async () => {
    requireUserMock.mockResolvedValue({ user: { id: "u1" } });
    addTrackedProductMock.mockRejectedValue(
      new AddProductErrorMock("cap", "You're tracking 3 of 3 products on growth. Remove one in Settings to add another."),
    );
    const { addProduct } = await import("./actions");
    expect(await addProduct("example.com")).toEqual({
      ok: false,
      error: "You're tracking 3 of 3 products on growth. Remove one in Settings to add another.",
    });
    expect(setActiveAppMock).not.toHaveBeenCalled();
  });

  it("already_tracked AddProductError also surfaces inline", async () => {
    requireUserMock.mockResolvedValue({ user: { id: "u1" } });
    addTrackedProductMock.mockRejectedValue(new AddProductErrorMock("already_tracked", "You're already tracking this product."));
    const { addProduct } = await import("./actions");
    expect(await addProduct("example.com")).toEqual({ ok: false, error: "You're already tracking this product." });
  });

  it("an unexpected failure degrades to generic copy and logs, never leaks internals", async () => {
    requireUserMock.mockResolvedValue({ user: { id: "u1" } });
    addTrackedProductMock.mockRejectedValue(new Error("ECONNREFUSED 5432"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { addProduct } = await import("./actions");
    expect(await addProduct("example.com")).toEqual({ ok: false, error: "Couldn't add that product. Please try again." });
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("ORDERING IS LOAD-BEARING: activates the app BEFORE returning ok (setActiveApp no-ops for an unlinked app)", async () => {
    requireUserMock.mockResolvedValue({ user: { id: "u1" } });
    addTrackedProductMock.mockResolvedValue({ appId: "app-42", scanId: "scan-1" });
    const order: string[] = [];
    setActiveAppMock.mockImplementation(async (id: string) => void order.push(`activate:${id}`));
    const { addProduct } = await import("./actions");
    const res = await addProduct("example.com");
    expect(order).toEqual(["activate:app-42"]);
    expect(res).toMatchObject({ ok: true, appId: "app-42" });
  });

  it("a null scanId (scan insert failed) is returned as-is — NOT an error; AddFlow lands on the dashboard", async () => {
    requireUserMock.mockResolvedValue({ user: { id: "u1" } });
    addTrackedProductMock.mockResolvedValue({ appId: "app-42", scanId: null });
    const { addProduct } = await import("./actions");
    const res = await addProduct("example.com");
    expect(setActiveAppMock).toHaveBeenCalledWith("app-42");
    expect(res).toMatchObject({ ok: true, appId: "app-42", scanId: null });
  });
});
