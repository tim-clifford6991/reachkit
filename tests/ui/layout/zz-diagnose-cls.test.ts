// TEMPORARY diagnostic for the offer-bar flake; removed before this PR is ready.
import { it } from "vitest";
import { getBaseURL, withPage } from "./browser";

function init() {
  const w = window as unknown as { __frames: string[] };
  w.__frames = [];
  let last = "";
  const t0 = performance.now();
  const tick = () => {
    const bar = document.querySelector<HTMLElement>('[data-testid="offer-bar"]');
    const root = document.documentElement;
    const line = `bar=${bar ? `${bar.className.includes(" hidden") ? "hid" : "vis"}:${bar.offsetHeight}:${(bar.textContent ?? "").slice(0, 24)}` : "-"} inline=${root.style.getPropertyValue("--offer-bar-h")} pad=${getComputedStyle(root).paddingBottom} marker=${document.querySelectorAll("[data-offer-bar]").length} rs=${document.readyState}`;
    if (line !== last) w.__frames.push(`${Math.round(performance.now() - t0)} ${line}`);
    last = line;
    if (performance.now() - t0 < 10000) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const CASES: { name: string; cpu: number; spotsMs: number }[] = [
  { name: "plain", cpu: 1, spotsMs: 0 },
  { name: "spots+2s", cpu: 1, spotsMs: 2000 },
  { name: "cpu x6", cpu: 6, spotsMs: 0 },
  { name: "cpu x6 spots+2s", cpu: 6, spotsMs: 2000 },
];

for (const c of CASES) {
  it(`diagnose offer bar /pricing?checkout=limited @320 ${c.name}`, async () => {
    for (let i = 0; i < 6; i++) {
      const r = await withPage(320, async (page) => {
        await page.setViewportSize({ width: 320, height: 700 });
        if (c.cpu > 1) await (await page.context().newCDPSession(page)).send("Emulation.setCPUThrottlingRate", { rate: c.cpu });
        if (c.spotsMs > 0) await page.route(/\/offer\/spots/, async (route) => { await new Promise((d) => setTimeout(d, c.spotsMs)); await route.continue(); });
        await page.addInitScript(init);
        await page.goto(`${getBaseURL()}/pricing?checkout=limited`);
        await page.evaluate(() => {
          const action = document.querySelector("main .btn-primary.btn-lg");
          action?.scrollIntoView({ block: "start" });
          window.scrollBy(0, (action?.getBoundingClientRect().bottom ?? 0) + 1);
        });
        await page.waitForSelector('[data-testid="offer-bar"]:not(.hidden)', { timeout: 10_000 });
        const at = await page.evaluate(() => {
          const bar = document.querySelector<HTMLElement>('[data-testid="offer-bar"]');
          return `MEASURE bar=${bar?.offsetHeight} pad=${getComputedStyle(document.documentElement).paddingBottom}`;
        });
        await page.waitForTimeout(3000);
        return [at, ...(await page.evaluate(() => (window as unknown as { __frames: string[] }).__frames))];
      });
      console.log(`DIAG ${c.name} #${i}:\n${r.join("\n")}`);
    }
  }, 300_000);
}
