// TEMPORARY diagnostic for the landing CLS flake; removed before this PR is ready.
import { it } from "vitest";
import { getBaseURL, withPage } from "./browser";

function watch(settle: number) {
  return new Promise<unknown>((done) => {
    const out: unknown[] = [];
    const o = new PerformanceObserver((l) => {
      for (const e of l.getEntries() as unknown as { value: number; startTime: number; sources?: { node?: Element | null; previousRect: DOMRectReadOnly; currentRect: DOMRectReadOnly }[] }[]) {
        out.push({
          v: e.value.toFixed(4),
          t: Math.round(e.startTime),
          s: (e.sources ?? []).map((s) => `${s.node?.tagName}.${String((s.node as HTMLElement | null)?.className ?? "").slice(0, 40)} ${JSON.stringify([s.previousRect.x, s.previousRect.y, s.previousRect.width, s.previousRect.height].map(Math.round))}->${JSON.stringify([s.currentRect.x, s.currentRect.y, s.currentRect.width, s.currentRect.height].map(Math.round))}`),
        });
      }
    });
    o.observe({ type: "layout-shift", buffered: true });
    setTimeout(() => {
      o.disconnect();
      done({ out, fonts: [...document.fonts].filter((f) => f.status === "loaded").map((f) => `${f.weight}${f.style}`), sw: window.innerWidth - document.documentElement.clientWidth });
    }, settle);
  });
}

const DELAYS: Record<string, RegExp | null> = { none: null, woff2: /\.woff2/, js: /\/_next\/static\/chunks\/.*\.js/, css: /\.css/, spots: /\/offer\/spots/ };

for (const [name, re] of Object.entries(DELAYS)) {
  it(`diagnose / @1280 delay=${name}`, async () => {
    for (let i = 0; i < 3; i++) {
      const r = await withPage(1280, async (page) => {
        if (re) await page.route(re, async (route) => { await new Promise((d) => setTimeout(d, 1500)); await route.continue(); });
        await page.goto(`${getBaseURL()}/`, { timeout: 45_000 });
        return page.evaluate(watch, 2500);
      });
      console.log(`DIAG delay=${name} #${i}: ${JSON.stringify(r)}`);
    }
  }, 120_000);
}
