/** @vitest-environment jsdom */
// SPEC §5 (2026-09-20, #908), #924 — the DNS record as its own step after
// setup.
//
// Three things are worth holding here, and each is a place the screen could
// mislead a founder: that the record's target is the deployment's own
// binding rather than a literal (the property `page.test.tsx` held while
// the record lived on the publishing step), that a founder with nothing to
// connect is sent on rather than shown an empty screen, and that *Do this
// later* is a real way out rather than a lesser one.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { applyEnvFixture } from "../../mail/env-fixture.ts";
import { COPY } from "@/lib/presentation/copy";

const redirect = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  redirect: (path: string) => redirect(path),
}));

/** The site the session names, and what its hosted row says. Module-level
 *  mutable state, so each test sets what it needs. */
const site = { id: "site-fixture", host: null as { hostname: string; state: string } | null };

vi.mock("@/app/(account)/setup/_setup/provider", () => ({
  readSetupSiteId: async () => site.id,
}));
vi.mock("@/lib/publish/destinations/hosted/hostname", () => ({
  hostedHostFor: async () => site.host,
}));

beforeAll(() => {
  applyEnvFixture();
});

beforeEach(() => {
  redirect.mockClear();
  site.id = "site-fixture";
  site.host = { hostname: "guides.example.com", state: "pending_dns" };
});

async function render(): Promise<Element> {
  const { default: Page } = await import("@/app/(account)/setup/connect/page");
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(await Page());
  return container;
}

describe("the record, on its own step", () => {
  it("points at the deployment's own edge binding, never a literal in a card", async () => {
    const tree = await render();
    const record = tree.querySelector('[data-testid="dns-record"]');
    expect(record).not.toBeNull();
    // The fixture env's `HOSTED_EDGE_CNAME_TARGET`.
    expect(record?.textContent).toContain("content.example.com");
    expect(record?.getAttribute("data-host")).toBe("guides.example.com");
  });

  it("names the host the record is for, as a value", async () => {
    const host = (await render()).querySelector('[data-testid="setup-connect-host"]');
    expect(host?.textContent).toBe("guides.example.com");
    expect(host?.className).toContain("num");
  });

  it("says how long it takes and that the first page is being written meanwhile", async () => {
    const tree = await render();
    expect(tree.querySelector('[data-testid="setup-connect-eyebrow"]')?.textContent).toBe(
      COPY["setup.connect.eyebrow"],
    );
    expect(tree.textContent).toContain(COPY["setup.connect.lead"]);
  });
});

describe("the step's name", () => {
  it("is the name setup's Connect step gives it, in the heading and the tab title", async () => {
    const { metadata } = await import("@/app/(account)/setup/connect/page");
    const name = COPY["setup.step.publishing.question"];
    expect((await render()).querySelector("h1")?.textContent).toBe(name);
    expect(metadata.title).toBe(`${name} · ReachKit`);
  });
});

describe("what happens as you do it", () => {
  it("is three states — reserved, waiting, live — with waiting the current one", async () => {
    const stages = [...(await render()).querySelectorAll('[data-testid="setup-connect-stage"]')];
    expect(stages.map((s) => s.getAttribute("data-state"))).toEqual([
      "done",
      "current",
      "pending",
    ]);
    const text = (await render()).textContent ?? "";
    for (const key of [
      "setup.connect.stage.reserved",
      "setup.connect.stage.waiting",
      "setup.connect.stage.live",
    ] as const) {
      expect(text).toContain(COPY[key]);
    }
  });
});

describe("doing it later", () => {
  it("is a real way out, and says why skipping is fine", async () => {
    const tree = await render();
    const later = tree.querySelector('[data-testid="setup-connect-later-action"]');
    expect(later?.getAttribute("href")).toBe("/app");
    expect(later?.textContent).toBe(COPY["setup.connect.later"]);
    expect(tree.querySelector('[data-testid="setup-connect-later"]')?.textContent).toBe(
      COPY["setup.connect.skipping"],
    );
  });
});

describe("a founder with nothing to connect", () => {
  it("is sent on where the blog is already live — not shown a step about nothing", async () => {
    site.host = { hostname: "guides.example.com", state: "live" };
    await render().catch(() => undefined);
    expect(redirect).toHaveBeenCalledWith("/app");
  });

  it("is sent on where there is no hosted destination at all", async () => {
    site.host = null;
    await render().catch(() => undefined);
    expect(redirect).toHaveBeenCalledWith("/app");
  });

  it("is sent on where the site row does not exist yet", async () => {
    site.id = "";
    await render().catch(() => undefined);
    expect(redirect).toHaveBeenCalledWith("/app");
  });
});
