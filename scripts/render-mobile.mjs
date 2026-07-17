/**
 * Mobile horizontal-overflow guard.
 *
 * WHY THIS EXISTS
 * ---------------
 * `render-smoke.mjs` renders every route in headless Chrome and asserts the DOM
 * is healthy — but it uses `--dump-dom`, which prints STATIC markup with no
 * computed layout, and it renders at Chrome's default (desktop) viewport. It
 * cannot see that a page overflows its width on a phone. The `html{overflow-x:
 * clip}` guard in globals.css hides that overflow visually, so nothing — not the
 * desktop smoke test, not a build, not a bundle check — catches a layout that is
 * broken on mobile. This guard is the missing machine check: it loads each route
 * at a real mobile viewport and FAILS if the document is wider than the screen.
 *
 * APPROACH
 * --------
 *   - Drive Chrome over the DevTools Protocol (CDP) — `--dump-dom` gives no
 *     layout, so we need a live page we can measure. We launch headless Chrome
 *     with `--remote-debugging-port=0`, read the ws endpoint from its stderr,
 *     and connect with Node's built-in global `WebSocket` (node >= 22 — NO new
 *     dependency).
 *   - Per route: `Emulation.setDeviceMetricsOverride` to the mobile width,
 *     `Page.navigate`, wait for load + a short settle (hydration), then
 *     `Runtime.evaluate` an assertion: `documentElement.scrollWidth <=
 *     innerWidth + 1`. On failure we also collect the OUTERMOST elements whose
 *     right edge exceeds the viewport, so the message names the offending node.
 *   - Runs each route at 390px (iPhone 12/13) and 360px (worst common Android).
 *   - Reuses the demo-scan seeder from render-shared.mjs for the report routes.
 *
 * PREREQUISITES (same as render-smoke — a pragmatic smoke test, not magic):
 *   - A server already running at BASE_URL (default http://localhost:3000).
 *   - System Chrome (or $CHROME_BIN / chromium on PATH).
 *   - SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY only to seed the two data routes.
 *
 * USAGE
 *   pnpm test:mobile
 *   BASE_URL=http://localhost:4000 pnpm test:mobile
 *   MOBILE_WIDTHS=390,360,320 pnpm test:mobile
 *   # authed /app/* too. MOBILE_AUTH_URL is a magic-link confirm URL whose
 *   # redirect chain sets the session cookie; mint one with
 *   # `node scripts/dev-auth-session.mjs` (local Supabase only):
 *   MOBILE_APP_ROUTES=1 MOBILE_AUTH_URL='http://localhost:3000/auth/confirm?...' pnpm test:mobile
 *
 * EXIT CODES
 *   0 — every route fits at every width
 *   1 — at least one route overflowed, or a hard prerequisite was missing
 */

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadEnvLocal, resolveChrome, seedDemoScan } from "./lib/render-shared.mjs";

loadEnvLocal();

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const WIDTHS = (process.env.MOBILE_WIDTHS ?? "390,360")
  .split(",")
  .map((w) => parseInt(w.trim(), 10))
  .filter((w) => Number.isFinite(w) && w > 0);
const VIEWPORT_HEIGHT = 844;
// A 1px tolerance absorbs sub-pixel rounding; anything beyond that is a real
// horizontal overflow a user would have to scroll sideways to see.
const OVERFLOW_TOLERANCE = 1;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Minimal CDP client over the browser-level WebSocket. Handles id/response
// correlation and one-shot event waits. Uses the flat session protocol
// (sessionId on every page-scoped command + event).
// ---------------------------------------------------------------------------

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.eventWaiters = [];
    ws.addEventListener("message", (ev) => this._onMessage(ev.data));
  }

  _onMessage(raw) {
    let msg;
    try {
      msg = JSON.parse(typeof raw === "string" ? raw : raw.toString());
    } catch {
      return;
    }
    if (msg.id && this.pending.has(msg.id)) {
      const { resolve, reject } = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.error.message} (${msg.error.code})`));
      else resolve(msg.result);
      return;
    }
    if (msg.method) {
      for (let i = this.eventWaiters.length - 1; i >= 0; i--) {
        const w = this.eventWaiters[i];
        if (w.method === msg.method && (!w.sessionId || w.sessionId === msg.sessionId)) {
          this.eventWaiters.splice(i, 1);
          w.resolve(msg.params);
        }
      }
    }
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify(payload));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 30_000);
    });
  }

  waitForEvent(method, sessionId, timeoutMs = 20_000) {
    return new Promise((resolve, reject) => {
      const waiter = { method, sessionId, resolve };
      this.eventWaiters.push(waiter);
      setTimeout(() => {
        const idx = this.eventWaiters.indexOf(waiter);
        if (idx !== -1) {
          this.eventWaiters.splice(idx, 1);
          reject(new Error(`CDP event timeout: ${method}`));
        }
      }, timeoutMs);
    });
  }
}

// The browser-context expression that measures overflow.
//
// NOTE: `html{overflow-x:clip}` in globals.css removes horizontal overflow from
// `documentElement.scrollWidth` — so a scrollWidth check alone reports 0 even
// when content spills past the screen. The clip only affects PAINTING, not
// layout, so `getBoundingClientRect()` still reports the true geometry. We
// therefore key the verdict on ELEMENT RECTS: any element whose right edge
// exceeds the viewport is a real overflow a user would have their layout broken
// by. Decorative bleed (position:absolute/fixed AND pointer-events:none, or
// aria-hidden) is intentionally clipped and excluded. scrollWidth is kept as a
// secondary signal for routes without the clip.
const OVERFLOW_EXPR = `(() => {
  const de = document.documentElement;
  // CRITICAL: measure against documentElement.clientWidth, NOT window.innerWidth.
  // With "width=device-width, initial-scale=1", a page whose content overflows
  // makes Chrome EXPAND the layout viewport, so window.innerWidth grows to match
  // the overflow (e.g. 425 on a 360px device) — using it as the reference makes
  // this check unfalsifiable on exactly the pages that are broken. clientWidth
  // (like visualViewport.width) stays at the real device width.
  const iw = de.clientWidth;
  const layoutW = window.innerWidth;
  const scrollW = Math.max(de.scrollWidth, document.body ? document.body.scrollWidth : 0);
  const tol = ${OVERFLOW_TOLERANCE};
  // An offender is EXCLUDED when its spill is intentional, not broken layout:
  //  - decorative: itself/an ancestor is aria-hidden, or absolutely/fixed
  //    positioned with pointer-events:none (hero glows, gradient bleeds);
  //  - contained by a real horizontal SCROLLER (an ancestor with overflow-x
  //    scroll/auto — a swipeable table/carousel the user can pan). Note we do
  //    NOT exclude for overflow-x:hidden/clip: that MASKS the overflow (content
  //    is cut off, not scrollable) — exactly the bug this guard exists to find;
  //  - marquee/off-screen rail scale: an element more than 3x the viewport wide
  //    is an animated ticker or duplicated-loop strip, never content meant to
  //    fit. (Real broken content — a fixed card, a too-wide table — stays well
  //    under 3x.) This drops the favicon marquee without hiding real breakage.
  const isExcluded = (el) => {
    // Walk the element itself and every ancestor up to <body>. Excluded if any
    // of them is decorative, a marquee-scale rail (>3x viewport wide), a
    // viewport-sized fixed overlay, or — for ancestors only — a real horizontal
    // scroller (overflow-x scroll/auto).
    let node = el;
    while (node && node !== document.body) {
      const cs = getComputedStyle(node);
      const w = node.getBoundingClientRect().width;
      if (node.getAttribute && node.getAttribute('aria-hidden') === 'true') return true;
      if ((cs.position === 'absolute' || cs.position === 'fixed') && cs.pointerEvents === 'none') return true;
      if (w > iw * 3) return true;
      // A position:fixed element sizes to the ICB (window.innerWidth), which on a
      // scrolling document includes the classic scrollbar that clientWidth
      // excludes. Such an element IS the viewport, not content overflowing it —
      // flagging it would be a phantom "scrollbar-width" failure on every page
      // with a fixed overlay. Only exclude while it is viewport-sized; a fixed
      // element genuinely WIDER than the ICB is still real breakage.
      if (cs.position === 'fixed' && w <= window.innerWidth + 1) return true;
      if (node !== el && (cs.overflowX === 'scroll' || cs.overflowX === 'auto')) return true;
      node = node.parentElement;
    }
    return false;
  };
  const els = Array.prototype.slice.call(document.querySelectorAll('body *'));
  const over = els.filter((el) => {
    const r = el.getBoundingClientRect();
    if (!(r.width > 0 && r.right > iw + tol)) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') return false;
    if (isExcluded(el)) return false;
    return true;
  });
  const overSet = new Set(over);
  const outermost = over.filter((el) => {
    let p = el.parentElement;
    while (p) { if (overSet.has(p)) return false; p = p.parentElement; }
    return true;
  });
  const describe = (el) => {
    const r = el.getBoundingClientRect();
    let cls = '';
    try { cls = (el.getAttribute('class') || '').slice(0, 70); } catch (e) {}
    let text = '';
    try { text = (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 42); } catch (e) {}
    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || '',
      cls,
      right: Math.round(r.right),
      width: Math.round(r.width),
      text,
    };
  };
  outermost.sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right);
  const worst = outermost.reduce((m, el) => Math.max(m, el.getBoundingClientRect().right - iw), 0);
  return { iw, layoutW, scrollW, worst: Math.round(worst), path: location.pathname, offenders: outermost.slice(0, 8).map(describe) };
})()`;

// ---------------------------------------------------------------------------
// Launch Chrome with remote debugging; resolve the browser ws endpoint.
// ---------------------------------------------------------------------------

function launchChrome(chromeBin) {
  const userDataDir = mkdtempSync(join(tmpdir(), "rk-mobile-chrome-"));
  const child = spawn(
    chromeBin,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--no-first-run",
      "--no-default-browser-check",
      "--remote-debugging-port=0",
      `--user-data-dir=${userDataDir}`,
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"] }
  );

  const wsEndpoint = new Promise((resolve, reject) => {
    let buf = "";
    const timer = setTimeout(() => reject(new Error("timed out waiting for Chrome DevTools endpoint")), 20_000);
    child.stderr.on("data", (d) => {
      buf += d.toString();
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) {
        clearTimeout(timer);
        resolve(m[1]);
      }
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Chrome exited early (code ${code}) before printing a DevTools endpoint`));
    });
  });

  return { child, userDataDir, wsEndpoint };
}

// ---------------------------------------------------------------------------
// Route table — public conversion/report surfaces always; authed /app/* behind
// a flag (they need a seeded session cookie via MOBILE_AUTH_COOKIE).
// ---------------------------------------------------------------------------

function buildRoutes(scanId) {
  const routes = [
    { path: "/" },
    { path: "/scan" },
    { path: "/pricing" },
    { path: "/teardowns" },
    { path: "/teardowns/bearable" },
    { path: "/privacy" },
  ];
  // /login only measures itself while signed OUT — an authed session redirects
  // it to /app/dashboard, so it would silently re-measure the dashboard.
  if (!process.env.MOBILE_AUTH_URL) routes.push({ path: "/login" });
  if (scanId) {
    routes.push({ path: `/scan/${scanId}/results` });
    routes.push({ path: `/report/${scanId}` });
  }
  if (process.env.MOBILE_APP_ROUTES) {
    for (const p of [
      "/app/dashboard",
      "/app/plan",
      "/app/audience/competitors",
      "/app/audience/customers",
      "/app/supply",
      "/app/demand",
      "/app/synthesis",
      "/app/progress",
      "/app/settings",
      "/app/billing",
      "/app/add",
      "/app/diagnostics",
    ]) {
      routes.push({ path: p, authed: true });
    }
  }
  return routes;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const chromeBin = resolveChrome();
  if (!chromeBin) {
    console.error("✗ Could not find a Chrome/Chromium binary.\n  Set CHROME_BIN, or install Google Chrome / Chromium on PATH.");
    process.exit(1);
  }
  console.log(`Chrome:   ${chromeBin}`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Widths:   ${WIDTHS.join(", ")}px`);

  try {
    await fetch(`${BASE_URL}/`, { signal: AbortSignal.timeout(5000) });
  } catch {
    console.error(`✗ No server reachable at ${BASE_URL}.\n  Start one first (e.g. \`pnpm dev\` or \`pnpm build && pnpm start\`), then re-run.`);
    process.exit(1);
  }

  const scanId = await seedDemoScan();
  const routes = buildRoutes(scanId);

  const { child, userDataDir, wsEndpoint } = launchChrome(chromeBin);
  let ws;
  const results = [];

  try {
    const endpoint = await wsEndpoint;
    ws = new WebSocket(endpoint);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", () => reject(new Error("failed to open CDP WebSocket")), { once: true });
    });
    const cdp = new CDP(ws);

    // One page target, reused across every route/width navigation.
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });

    await cdp.send("Page.enable", {}, sessionId);
    await cdp.send("Runtime.enable", {}, sessionId);
    await cdp.send("Network.enable", {}, sessionId);
    // Real phones use zero-width OVERLAY scrollbars. Headless Chrome draws a
    // classic ~16px one on any document that scrolls, and window.innerWidth
    // INCLUDES it while documentElement.clientWidth excludes it. That 16px then
    // leaks into every position:fixed element (they size to the ICB), producing
    // a phantom "16px overflow" on scrolling pages. Hiding scrollbars makes the
    // emulation match a device. (The --hide-scrollbars launch flag is ignored
    // under --headless=new; this CDP command is the one that actually applies.)
    await cdp.send("Emulation.setScrollbarsHidden", { hidden: true }, sessionId);

    // Authenticate ONCE up front: navigating the magic-link confirm URL runs a
    // redirect chain that sets the session cookie on this browser context, so
    // every later /app/* navigation is authed. Mint one with
    // `node scripts/dev-auth-session.mjs`.
    if (process.env.MOBILE_AUTH_URL) {
      const loaded = cdp.waitForEvent("Page.loadEventFired", sessionId, 25_000).catch(() => null);
      await cdp.send("Page.navigate", { url: process.env.MOBILE_AUTH_URL }, sessionId);
      await loaded;
      await wait(1500);
      console.log("[auth] session cookie established via MOBILE_AUTH_URL");
    }

    console.log(`\nMeasuring ${routes.length} route(s) at ${WIDTHS.length} width(s)...\n`);

    for (const route of routes) {
      const url = `${BASE_URL}${route.path}`;

      for (const width of WIDTHS) {
        await cdp.send(
          "Emulation.setDeviceMetricsOverride",
          { width, height: VIEWPORT_HEIGHT, deviceScaleFactor: 1, mobile: true },
          sessionId
        );

        let measure = null;
        let error = null;
        try {
          const loaded = cdp.waitForEvent("Page.loadEventFired", sessionId, 25_000);
          await cdp.send("Page.navigate", { url }, sessionId);
          await loaded;
          await wait(1200); // settle: hydration, client components, ssr:false imports
          // A client-side redirect can swap the document out from under the
          // eval (documentElement momentarily null). Retry rather than report a
          // phantom failure — a real error still surfaces on the last attempt.
          for (let attempt = 0; attempt < 3; attempt++) {
            const { result, exceptionDetails } = await cdp.send(
              "Runtime.evaluate",
              { expression: OVERFLOW_EXPR, returnByValue: true, awaitPromise: false },
              sessionId
            );
            if (!exceptionDetails && result?.value) {
              measure = result.value;
              error = null;
              break;
            }
            const desc = exceptionDetails?.exception?.description ?? exceptionDetails?.text ?? "no value returned";
            error = `eval error: ${desc}`;
            await wait(800);
          }
        } catch (err) {
          error = err.message;
        }

        // An auth-gated route that bounced to /login renders a page that
        // trivially fits — reporting that as a PASS would be a vacuous green
        // (the guard would "verify" a login screen, not the dashboard). Treat a
        // redirect away from an authed target as a hard error instead.
        if (!error && measure && route.authed && /^\/(login|auth)\b/.test(measure.path)) {
          error = `not authenticated — landed on ${measure.path} instead of ${route.path}. Mint a FRESH single-use link (node scripts/dev-auth-session.mjs) and set MOBILE_AUTH_URL.`;
        }

        // The verdict is element geometry vs the real screen width
        // (documentElement.clientWidth): any content box whose right edge passes
        // it is breakage a user sees. `scrollW` and `layoutW` are reported for
        // context but deliberately NOT part of the verdict — both are inflated by
        // the classic scrollbar headless draws on scrolling documents (innerWidth
        // includes it, clientWidth doesn't), which made them fire a phantom
        // ~16px failure on any page with a fixed overlay. The rect check is what
        // actually caught every real defect (the 240px app rail, the footer's
        // 624px grid, the 280px landing card, the unwrappable host).
        const pass = !error && measure != null && measure.offenders.length === 0;
        results.push({ path: route.path, width, pass, error, measure });
      }
    }
  } finally {
    try { ws?.close(); } catch { /* noop */ }
    try { child.kill("SIGKILL"); } catch { /* noop */ }
    try { rmSync(userDataDir, { recursive: true, force: true }); } catch { /* noop */ }
  }

  // ── Report ────────────────────────────────────────────────────────────────
  const pad = Math.max(...results.map((r) => r.path.length), 8);
  console.log("Route".padEnd(pad) + "  Width  Result  Detail");
  console.log("-".repeat(pad) + "  -----  ------  ------");
  for (const r of results) {
    let detail;
    if (r.error) detail = `error: ${r.error}`;
    else if (r.pass) detail = `fits vp ${r.measure.iw}px`;
    else if (r.measure.layoutW > r.measure.iw + OVERFLOW_TOLERANCE)
      detail = `page forces a ${r.measure.layoutW}px layout on a ${r.measure.iw}px screen (${r.measure.offenders.length} element(s) spill, worst +${r.measure.worst}px)`;
    else detail = `${r.measure.offenders.length} element(s) spill past vp ${r.measure.iw}px (worst +${r.measure.worst}px)`;
    console.log(`${r.path.padEnd(pad)}  ${String(r.width).padStart(3)}px  ${r.pass ? "  ✓   " : "  ✗   "}  ${detail}`);
  }

  const failures = results.filter((r) => !r.pass);
  console.log("");
  if (failures.length > 0) {
    console.error(`✗ ${failures.length}/${results.length} route×width combination(s) overflowed:\n`);
    for (const f of failures) {
      if (f.error) {
        console.error(`  ${f.path} @ ${f.width}px — ${f.error}`);
        continue;
      }
      console.error(`  ${f.path} @ ${f.width}px — ${f.measure.offenders.length} element(s) spill past the ${f.measure.iw}px viewport (worst +${f.measure.worst}px):`);
      for (const o of f.measure.offenders) {
        const cls = o.cls ? `.${o.cls.split(/\s+/).join(".")}` : "";
        const id = o.id ? `#${o.id}` : "";
        const txt = o.text ? `  “${o.text}”` : "";
        console.error(`      ↳ <${o.tag}${id}${cls}>  right=${o.right}px width=${o.width}px${txt}`);
      }
    }
    process.exit(1);
  }
  console.log(`✓ all ${results.length} route×width combination(s) fit within the viewport`);
  process.exit(0);
}

main().catch((err) => {
  console.error(`✗ render-mobile crashed: ${err.stack ?? err.message}`);
  process.exit(1);
});
