// TEMPORARY diagnostic for the landing CLS flake; removed before this PR is ready.
import { it } from "vitest";
import { getBaseURL, withPage } from "./browser";

function watch(settle: number) {
  return new Promise<unknown>((done) => {
    const out: unknown[] = [];
    let cls = 0;
    const o = new PerformanceObserver((l) => {
      for (const e of l.getEntries() as unknown as { value: number; startTime: number; sources?: { node?: Element | null; previousRect: DOMRectReadOnly; currentRect: DOMRectReadOnly }[] }[]) {
        cls += e.value;
        if (e.value < 0.01) continue;
        out.push({
          v: e.value.toFixed(4),
          t: Math.round(e.startTime),
          s: (e.sources ?? []).map((s) => `${s.node?.nodeName}.${String((s.node as HTMLElement | null)?.className ?? "").slice(0, 30)} ${JSON.stringify([s.previousRect.y, s.previousRect.height].map(Math.round))}->${JSON.stringify([s.currentRect.y, s.currentRect.height].map(Math.round))}`),
        });
      }
    });
    o.observe({ type: "layout-shift", buffered: true });
    setTimeout(() => {
      o.disconnect();
      done({ cls: cls.toFixed(4), out, expect: document.head.querySelector('link[rel="expect"]') !== null });
    }, settle);
  });
}

for (const rate of [4, 10, 20]) {
  for (const strip of [false, true]) {
    it(`diagnose / @1280 cpu x${rate} ${strip ? "without" : "with"} the render-blocking link`, async () => {
      const lines: string[] = [];
      for (let i = 0; i < 5; i++) {
        const r = await withPage(1280, async (page) => {
          const cdp = await page.context().newCDPSession(page);
          await cdp.send("Emulation.setCPUThrottlingRate", { rate });
          if (strip) {
            await page.route((u) => u.pathname === "/", async (route) => {
              const res = await route.fetch();
              await route.fulfill({ response: res, body: (await res.text()).replace(/<link rel="expect"[^>]*>/g, "") });
            });
          }
          await page.goto(`${getBaseURL()}/`, { timeout: 90_000 });
          return page.evaluate(watch, 3000);
        });
        lines.push(JSON.stringify(r));
      }
      console.log(`DIAG cpu x${rate} strip=${strip}:\n${lines.join("\n")}`);
    }, 300_000);
  }
}
