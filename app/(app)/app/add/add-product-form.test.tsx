// app/(app)/app/add/add-product-form.test.tsx
//
// Render test (this repo's idiom: renderToStaticMarkup, not jsdom/Playwright).
// AddProductForm imports the real ./actions module (the "use server" directive
// is inert under Vitest — it's a plain import), so actions.ts's own transitive
// deps need the same mocks as actions.test.ts to avoid touching real env/DB.
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({
  requireUser: vi.fn(),
  AuthError: class AuthError extends Error {},
}));
vi.mock("@/lib/app/add-product", () => ({
  addTrackedProduct: vi.fn(),
  AddProductError: class AddProductError extends Error {
    constructor(
      public code: string,
      message: string,
    ) {
      super(message);
    }
  },
}));
vi.mock("@/lib/app/set-active-app", () => ({ setActiveApp: vi.fn() }));

describe("AddProductForm", () => {
  it("renders a labeled url field and an enabled submit button, no error initially", async () => {
    const { AddProductForm } = await import("./add-product-form");
    const html = renderToStaticMarkup(<AddProductForm onAdded={() => {}} />);
    expect(html).toContain("Product website");
    expect(html).toContain('name="url"');
    expect(html).toContain("Add product");
    expect(html).not.toContain('role="alert"');
  });

  it("submit is enabled (not stuck pending) on first render", async () => {
    const { AddProductForm } = await import("./add-product-form");
    const html = renderToStaticMarkup(<AddProductForm onAdded={() => {}} />);
    expect(html).not.toContain("disabled=\"\"");
  });

  it("uses only design tokens for color — no raw hex on the submit button", async () => {
    // Guards the CLAUDE.md "tokens only, never raw hex" rule for the one
    // element most likely to regress toward a literal color during a tweak.
    const { AddProductForm } = await import("./add-product-form");
    const html = renderToStaticMarkup(<AddProductForm onAdded={() => {}} />);
    const buttonStyleMatch = html.match(/<button[^>]*style="([^"]*)"/);
    expect(buttonStyleMatch).not.toBeNull();
    expect(buttonStyleMatch![1]).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });
});
