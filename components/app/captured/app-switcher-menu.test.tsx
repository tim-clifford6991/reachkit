// components/app/captured/app-switcher-menu.test.tsx
//
// Guard for the /app/add routing fix: the switcher's "+ Add product" control
// must never point at the PUBLIC /scan funnel again — that pushes a paying
// user into the entitlement-blind PublicReport (always redacts to free,
// always shows "Unlock full report") for a product they already pay for.
//
// The target <Link> lives inside `{open && (...)}` (useState(false) by
// default) — this repo has no jsdom/testing-library (vitest.config.ts is
// environment: "node", no fireEvent available) to click it open, so a
// renderToStaticMarkup pass can only ever see the CLOSED menu. The closed
// smoke-render below still guards against a hard crash; the href regression
// itself is guarded the same way Task 5's own verification step does
// (`grep -c '"/scan"' app-switcher-menu.tsx` — expect 0) but as a durable
// automated test instead of a manual command.
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/app/set-active-app", () => ({ setActiveApp: vi.fn() }));
vi.mock("@/components/app/checkout-button", () => ({
  CheckoutButton: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
}));

const SOURCE = readFileSync(new URL("./app-switcher-menu.tsx", import.meta.url), "utf8");

describe("AppSwitcher — Add product control (in-shell routing)", () => {
  it("closed-menu smoke render never crashes", async () => {
    const { AppSwitcher } = await import("./app-switcher-menu");
    const html = renderToStaticMarkup(
      <AppSwitcher
        apps={[{ id: "a1", name: "example.com" }]}
        activeId="a1"
        appName="example.com"
        appInitial="E"
        plan="Growth"
        canAddApp={true}
        addAppUpgradePlan={null}
      />,
    );
    expect(html).toContain("example.com");
  });

  it("the Add-product link resolves to /app/add when a slot is free (never the public /scan funnel)", () => {
    expect(SOURCE).toContain('href={canAddApp ? "/app/add" : "/app/billing"}');
  });

  it("no reference to the public /scan funnel remains anywhere in the switcher", () => {
    expect(SOURCE).not.toContain('"/scan"');
  });
});
