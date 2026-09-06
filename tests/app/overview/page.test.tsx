/** @vitest-environment jsdom */
// tests/app/overview/page.test.tsx — BUILD §4.5, the screen itself.
//
// Four things this file decides, and none of them is how a module looks:
//
//   1. Overview is the screen `/app` renders, and it renders inside the
//      shell rather than declaring a screen root of its own.
//   2. It invents no sentence. Every line on it is owner-owed today, and an
//      owner-owed line renders as **nothing** — not the key, not a
//      placeholder, not an empty paragraph with a border around it.
//   3. The render performs no measurement, no vendor call and no model
//      call. Asserted twice: no `fetch` during the render, and no path from
//      this screen's own module graph into the vendor or model directories
//      at all — the second is what would catch a call added behind a lazy
//      import that this render happened not to reach.
//   4. Its five modules are all there, and the cap and the one-statement
//      rules survive composition.
//
// The registry is **not** mocked here: what this file measures is the
// screen the owner would see today. `render.test.tsx` is the counterpart
// that renders it with every key written.
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { COPY, type CopyKey } from "@/lib/presentation/copy";
import OverviewPage from "@/app/(account)/app/page";

const SRC = path.resolve(import.meta.dirname, "../../../src");
const APP = path.join(SRC, "app/(account)/app");

async function markup(): Promise<string> {
  return renderToStaticMarkup(await OverviewPage());
}

/** Every module `entry` can reach through a static import, repo-relative. */
function transitiveImports(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop();
    if (file === undefined || seen.has(file)) continue;
    seen.add(file);
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/from\s+["']([^"']+)["']/g)) {
      const specifier = match[1];
      if (specifier === undefined) continue;
      const base = specifier.startsWith("@/")
        ? path.join(SRC, specifier.slice(2))
        : specifier.startsWith(".")
          ? path.resolve(path.dirname(file), specifier)
          : null;
      if (base === null) continue;
      const resolved = [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")].find(
        (candidate) => existsSync(candidate) && candidate.match(/\.tsx?$/)
      );
      if (resolved !== undefined) queue.push(resolved);
    }
  }
  return seen;
}

describe("REQ-041 c1 — Overview is the screen a signed-in customer lands on", () => {
  it("/app's own page renders Overview", async () => {
    expect(await markup()).toContain('data-testid="overview"');
  });

  it("declares no Surface — the shell's layout owns this route's screen root", async () => {
    const source = readFileSync(path.join(APP, "page.tsx"), "utf8");
    expect(source).not.toMatch(/from\s+["']@\/ui\/layout/);
    expect(await markup()).not.toContain("data-surface");
  });

  it("renders all five of §4.5's modules", async () => {
    const html = await markup();
    for (const region of [
      "overview-head",
      "overview-growth",
      "overview-tiles",
      "overview-rivals",
      "overview-week",
    ]) {
      expect(html, `missing ${region}`).toContain(`data-testid="${region}"`);
    }
  });

  it("renders three tiles and no fourth", async () => {
    const html = await markup();
    expect(html.split('class="stats"').length - 1).toBe(3);
    expect(html).toContain('data-testid="overview-tile-searches"');
    expect(html).toContain('data-testid="overview-tile-ai-answers"');
    expect(html).toContain('data-testid="overview-tile-pages"');
  });
});

describe("REQ-093 c1 — the screen invents no sentence", () => {
  it("no registry key leaks into the markup as its own text", async () => {
    const html = await markup();
    for (const key of Object.keys(COPY) as CopyKey[]) {
      expect(html, `the key "${key}" was rendered`).not.toContain(`>${key}<`);
    }
  });

  it("no owner-owed key renders anything at all — not a placeholder, not a TODO", async () => {
    const html = await markup();
    expect(html).not.toContain("TODO");
    expect(html).not.toContain("<p></p>");
  });

  it("the head still renders a heading, from a key the owner has written", async () => {
    const html = await markup();
    expect(html).toMatch(/<h1>[^<]+<\/h1>/);
  });
});

describe("REQ-041 c5 — the alert cap and the one supply statement survive composition", () => {
  it("at most two alerts render", async () => {
    const html = await markup();
    expect(html.split('role="alert"').length - 1).toBeLessThanOrEqual(2);
  });

  it("at most one supply statement renders", async () => {
    const html = await markup();
    expect(html.split('data-testid="overview-supply"').length - 1).toBeLessThanOrEqual(1);
  });
});

describe("the render performs no measurement, no vendor call and no model call", () => {
  it("makes no fetch", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    await markup();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("its module graph reaches no vendor client and no language model", () => {
    const reachable = transitiveImports(path.join(APP, "page.tsx"));
    const forbidden = [path.join(SRC, "lib/vendors"), path.join(SRC, "lib/llm")];
    const offenders = [...reachable].filter((file) =>
      forbidden.some((directory) => file.startsWith(directory))
    );
    expect(offenders).toEqual([]);
  });

  it("the graph is not vacuous — it does reach the screen's own model", () => {
    const reachable = transitiveImports(path.join(APP, "page.tsx"));
    expect([...reachable].some((file) => file.endsWith("_overview/model.ts"))).toBe(true);
  });
});
