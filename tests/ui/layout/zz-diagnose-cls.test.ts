// TEMPORARY diagnostic for the landing CLS flake; removed before this PR is ready.
import { it } from "vitest";
import { getBaseURL, withPage } from "./browser";

function init() {
  const w = window as unknown as { __frames: string[] };
  w.__frames = [];
  let last = "";
  const t0 = performance.now();
  const tick = () => {
    const m = document.querySelector<HTMLElement>(".mockup-browser");
    const l = document.querySelector<HTMLElement>("#landing-field .flex.min-w-0");
    const h1 = document.querySelector<HTMLElement>("#landing-field h1");
    const fonts = [...document.fonts].filter((f) => f.status === "loaded").map((f) => `${f.weight}${f.style[0]}`).join(",");
    const sheets = [...document.styleSheets].length;
    const line = `${document.readyState} m=${m ? `${m.getBoundingClientRect().width.toFixed(0)}x${m.offsetHeight} kids=${m.querySelectorAll("*").length}` : "-"} l=${l ? `${l.getBoundingClientRect().width.toFixed(0)}x${l.offsetHeight}` : "-"} h1=${h1 ? h1.offsetHeight : "-"} ff=${h1 ? getComputedStyle(h1).fontFamily.slice(0, 30) : ""} fonts=${fonts} sheets=${sheets} vw=${innerWidth}`;
    if (line !== last) w.__frames.push(`${Math.round(performance.now() - t0)} ${line}`);
    last = line;
    if (performance.now() - t0 < 8000) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  new PerformanceObserver((l) => {
    for (const e of l.getEntries() as unknown as { value: number; startTime: number }[]) if (e.value > 0.01) w.__frames.push(`SHIFT ${e.value.toFixed(4)} @${Math.round(e.startTime)}`);
  }).observe({ type: "layout-shift", buffered: true });
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) w.__frames.push(`PAINT ${e.name} @${Math.round(e.startTime)}`);
  }).observe({ type: "paint", buffered: true });
}

for (const strip of [false]) {
  it(`diagnose / @1280 cpu x20 ${strip ? "without" : "with"} the render-blocking link`, async () => {
    for (let i = 0; i < 15; i++) {
      const r = await withPage(1280, async (page) => {
        const cdp = await page.context().newCDPSession(page);
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: 20 });
        await page.addInitScript(init);
        if (strip) {
          await page.route((u) => u.pathname === "/", async (route) => {
            const res = await route.fetch();
            await route.fulfill({ response: res, body: (await res.text()).replace(/<link rel="expect"[^>]*>/g, "") });
          });
        }
        await page.goto(`${getBaseURL()}/`, { timeout: 90_000 });
        await page.waitForTimeout(4000);
        return page.evaluate(() => (window as unknown as { __frames: string[] }).__frames);
      });
      if (r.some((f) => f.startsWith("SHIFT"))) console.log(`DIAG strip=${strip} #${i}:\n${r.join("\n")}`);
      else console.log(`DIAG strip=${strip} #${i}: no shift`);
    }
  }, 300_000);
}
