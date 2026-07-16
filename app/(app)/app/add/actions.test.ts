// app/(app)/app/add/actions.test.ts
//
// addProduct is the in-shell server action for /app/add. It ORCHESTRATES —
// auth, then addTrackedProduct (Task 3, already covers cap/already-tracked/
// paused/URL-canonicalisation), then setActiveApp, then redirect. This file
// pins the orchestration contract only: it does not re-test addTrackedProduct's
// own policy (lib/app/add-product.test.ts owns that).
//
// Every dependency is mocked so this file never touches real env/Supabase —
// same isolation approach as lib/app/add-product.test.ts.
import { describe, it, expect, vi, beforeEach } from "vitest";

// next/navigation's real redirect() throws to abort rendering; mock it the
// same way so `addProduct` genuinely stops executing at the call site (this
// is what makes the ordering assertions below meaningful, not just "was it
// called with these args").
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

function fd(url?: string): FormData {
  const f = new FormData();
  if (url !== undefined) f.set("url", url);
  return f;
}

describe("addProduct server action (orchestration contract)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redirectMock.mockImplementation((path: string) => {
      throw new RedirectSignal(path);
    });
  });

  it("empty url → inline error, never touches auth or the executor", async () => {
    const { addProduct } = await import("./actions");
    const result = await addProduct({ error: null }, fd(""));
    expect(result).toEqual({ error: "Enter your product's website address." });
    expect(requireUserMock).not.toHaveBeenCalled();
    expect(addTrackedProductMock).not.toHaveBeenCalled();
  });

  it("whitespace-only url also counts as empty", async () => {
    const { addProduct } = await import("./actions");
    const result = await addProduct({ error: null }, fd("   "));
    expect(result).toEqual({ error: "Enter your product's website address." });
  });

  it("missing url field entirely → inline error (form.get returns null)", async () => {
    const { addProduct } = await import("./actions");
    const result = await addProduct({ error: null }, fd());
    expect(result).toEqual({ error: "Enter your product's website address." });
  });

  it("unauthenticated → redirects to /login with a return path, never calls the executor", async () => {
    requireUserMock.mockRejectedValue(new AuthErrorMock());
    const { addProduct } = await import("./actions");
    await expect(addProduct({ error: null }, fd("example.com"))).rejects.toBeInstanceOf(RedirectSignal);
    expect(redirectMock).toHaveBeenCalledWith("/login?next=/app/add");
    expect(addTrackedProductMock).not.toHaveBeenCalled();
  });

  it("a non-AuthError from requireUser propagates uncaught (never mis-swallowed as a form error)", async () => {
    requireUserMock.mockRejectedValue(new Error("db unreachable"));
    const { addProduct } = await import("./actions");
    await expect(addProduct({ error: null }, fd("example.com"))).rejects.toThrow("db unreachable");
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("trims the submitted url before handing it to addTrackedProduct", async () => {
    requireUserMock.mockResolvedValue({ user: { id: "u1" } });
    addTrackedProductMock.mockResolvedValue({ appId: "app-1", scanId: "scan-1" });
    const { addProduct } = await import("./actions");
    await expect(addProduct({ error: null }, fd("  example.com  "))).rejects.toBeInstanceOf(RedirectSignal);
    expect(addTrackedProductMock).toHaveBeenCalledWith("u1", "example.com");
  });

  it("AddProductError's message becomes the inline form error verbatim (code→copy mapping)", async () => {
    requireUserMock.mockResolvedValue({ user: { id: "u1" } });
    addTrackedProductMock.mockRejectedValue(
      new AddProductErrorMock("cap", "You're tracking 3 of 3 products on growth. Upgrade or remove one to add another."),
    );
    const { addProduct } = await import("./actions");
    const result = await addProduct({ error: null }, fd("example.com"));
    expect(result).toEqual({ error: "You're tracking 3 of 3 products on growth. Upgrade or remove one to add another." });
    expect(setActiveAppMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("already_tracked AddProductError also surfaces inline, never a redirect", async () => {
    requireUserMock.mockResolvedValue({ user: { id: "u1" } });
    addTrackedProductMock.mockRejectedValue(new AddProductErrorMock("already_tracked", "You're already tracking this product."));
    const { addProduct } = await import("./actions");
    const result = await addProduct({ error: null }, fd("example.com"));
    expect(result).toEqual({ error: "You're already tracking this product." });
  });

  it("an unexpected (non-AddProductError) failure degrades to generic copy and logs, never leaks internals", async () => {
    requireUserMock.mockResolvedValue({ user: { id: "u1" } });
    addTrackedProductMock.mockRejectedValue(new Error("ECONNREFUSED 5432"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { addProduct } = await import("./actions");
    const result = await addProduct({ error: null }, fd("example.com"));
    expect(result).toEqual({ error: "Couldn't add that product. Please try again." });
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("ORDERING IS LOAD-BEARING: activates the app BEFORE redirecting (never after)", async () => {
    requireUserMock.mockResolvedValue({ user: { id: "u1" } });
    addTrackedProductMock.mockResolvedValue({ appId: "app-42", scanId: "scan-1" });
    const order: string[] = [];
    setActiveAppMock.mockImplementation(async (id: string) => {
      order.push(`activate:${id}`);
    });
    redirectMock.mockImplementation((path: string) => {
      order.push(`redirect:${path}`);
      throw new RedirectSignal(path);
    });
    const { addProduct } = await import("./actions");
    await expect(addProduct({ error: null }, fd("example.com"))).rejects.toBeInstanceOf(RedirectSignal);
    expect(order).toEqual(["activate:app-42", "redirect:/app/dashboard"]);
  });

  it("a null scanId (scan insert failed) is NOT an error — the app still links and the user still lands on the dashboard", async () => {
    requireUserMock.mockResolvedValue({ user: { id: "u1" } });
    addTrackedProductMock.mockResolvedValue({ appId: "app-42", scanId: null });
    const { addProduct } = await import("./actions");
    await expect(addProduct({ error: null }, fd("example.com"))).rejects.toBeInstanceOf(RedirectSignal);
    expect(setActiveAppMock).toHaveBeenCalledWith("app-42");
    expect(redirectMock).toHaveBeenCalledWith("/app/dashboard");
  });
});
