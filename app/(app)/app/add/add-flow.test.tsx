// app/(app)/app/add/add-flow.test.tsx
//
// Smoke render (repo idiom: renderToStaticMarkup, not jsdom). Pins the ENTRY of
// the 3-step flow — the URL step — so a broken import or a step-machine regression
// that hides the form is caught. The scanning→competitors transitions ride the
// SSE (`onFacts`) and CompetitorSetup, which are integration-tested
// (tests/integration/scan-stream.test.ts) and live-verified, not unit-driven here.
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
// The action module is imported transitively; its deps must not touch real env/DB.
vi.mock("@/lib/auth/server", () => ({ requireUser: vi.fn(), AuthError: class extends Error {} }));
vi.mock("@/lib/app/add-product", () => ({ addTrackedProduct: vi.fn(), AddProductError: class extends Error {} }));
vi.mock("@/lib/app/set-active-app", () => ({ setActiveApp: vi.fn() }));
vi.mock("@/lib/billing/entitlements", () => ({ entitlementsFor: vi.fn() }));

describe("AddFlow", () => {
  it("opens on the URL step: the intro, the product-URL field, and the Add button", async () => {
    const { AddFlow } = await import("./add-flow");
    const html = renderToStaticMarkup(<AddFlow />);
    expect(html).toContain("Product website");
    expect(html).toContain('name="url"');
    expect(html).toContain("Add product");
    // It must NOT open straight into scanning or competitors.
    expect(html).not.toContain("competitors");
  });
});
