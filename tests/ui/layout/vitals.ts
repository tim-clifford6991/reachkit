// tests/ui/layout/vitals.ts
//
// Issue #332 `## Done when` row 1: "Lighthouse (or Playwright traces) on
// `/` and `/scan/example.com` at mobile and desktop in the layout job;
// budgets pinned in `constants.ts` … and the job fails on regression."
//
// **Playwright traces, not Lighthouse.** Lighthouse would be a dependency,
// and a dependency is the owner's to approve (`CLAUDE.md`: never "add a
// dependency … without asking"). Everything the three budgets need is
// already in the browser this suite drives: `largest-contentful-paint` and
// `layout-shift` are performance entries Chromium emits itself, and the
// script weight is the resource timeline's own `transferSize`. So this
// module reads its metrics off the same real Chromium tab, against the same
// built-and-served app `browser.ts` already stands up for the sweep — no
// second toolchain, no second build, and no second definition of "the app".
//
// `measureVitals` is closure-free for the reason `checks.ts` states in its
// own header: `page.evaluate()` serialises a function's source text and
// re-runs it inside the tab, where a reference to a sibling declared
// elsewhere in this module would be a `ReferenceError`. Every helper it
// needs is declared inside its own body.
//
// **What is deliberately not emulated.** No CPU or network throttling: the
// app is served from loopback by `next start`, so these are lab numbers on
// a machine nobody controls the speed of, and the budgets are the
// *product's* ceilings rather than a profile tuned to a runner. That makes
// the LCP gate a guard against gross regression — a render-blocking third
// party, a synchronous read on the landing page, a font that arrives a
// round trip late — and not a proxy for a customer's phone. The two
// measurements that are fully deterministic, the layout shift and the
// script weight, carry the rest of the signal. Every measured value is
// printed by `vitals.test.ts` whether it passes or fails, so the headroom
// is readable off a green run rather than only off a red one.

/** One page's measured vitals, as `measureVitals` returns them. */
export interface RawVitals {
  /** Largest Contentful Paint, ms from navigation start. `null` when the
   *  document produced no LCP candidate at all — reported rather than
   *  defaulted, because a `0` here would read as the fastest page there is. */
  lcpMs: number | null;
  /** Cumulative Layout Shift: the largest session window's sum, over
   *  shifts with no recent user input. */
  cls: number;
  /** Bytes of JavaScript this document transferred over the wire, headers
   *  included — `PerformanceResourceTiming.transferSize`, which is what a
   *  reader's connection actually spends and so what a budget in kB is
   *  about. Compressed, because `next start` compresses. */
  scriptBytes: number;
  /** How many script resources those bytes came from, so a budget that
   *  passes because nothing loaded cannot read as a pass. */
  scriptCount: number;
  /** What moved, worst first: one line per element the largest session
   *  window's shifts name as a source, with the score it carried. A CLS
   *  number with nothing attached to it is a number nobody can act on. */
  shiftSources: string[];
  /** Every `<link rel="preload" as="font">` href the document carries. */
  fontPreloads: string[];
  /** Images the document renders with no way to reserve their box: no
   *  `width`/`height` attribute pair and no computed `aspect-ratio`. Named
   *  by `src`, so a finding is actionable. */
  unsizedImages: string[];
}

/**
 * Reads the measurements off a document that has already loaded.
 *
 * Runs inside the tab. Both observers register with `buffered: true`, so
 * entries Chromium recorded before this function existed are delivered too
 * — which is why it can run *after* `page.goto` rather than having to be
 * injected before it. It then waits `settleMs` for anything still in flight
 * (a late LCP candidate, a shift caused by hydration) before disconnecting.
 *
 * CLS is the session-window score, not a running total: shifts are grouped
 * into windows that end after one second of quiet or five seconds of
 * elapsed time, and the score is the largest window's sum. That is the
 * metric the 0.1 budget is stated against; a plain sum would fail pages the
 * published threshold passes.
 */
export function measureVitals(settleMs: number): Promise<RawVitals> {
  return new Promise<RawVitals>((resolve) => {
    const shifts: { value: number; startTime: number; sources: string[] }[] = [];
    let lcpMs: number | null = null;

    const lcpObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) lcpMs = entry.startTime;
    });
    lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });

    const shiftObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
        // A shift the reader caused by interacting is not one the page owes
        // anyone; the metric excludes it and so does this.
        if (shift.hadRecentInput) continue;
        // `sources` names the elements whose start position changed
        // between the two frames. Described here, in the tab, because a
        // DOM node cannot cross `page.evaluate`'s serialisation.
        const withSources = shift as unknown as { sources?: { node?: Element | null }[] };
        const sources: string[] = [];
        for (const source of withSources.sources ?? []) {
          const node = source.node;
          if (!node) continue;
          const testId = node.getAttribute("data-testid");
          const className = typeof node.className === "string" ? node.className : "";
          const first = className.trim().split(/\s+/).filter(Boolean).slice(0, 2).join(".");
          sources.push(
            node.tagName.toLowerCase() +
              (node.id ? `#${node.id}` : "") +
              (testId ? `[data-testid=${testId}]` : "") +
              (first ? `.${first}` : "")
          );
        }
        shifts.push({ value: shift.value, startTime: shift.startTime, sources });
      }
    });
    shiftObserver.observe({ type: "layout-shift", buffered: true });

    window.setTimeout(() => {
      lcpObserver.disconnect();
      shiftObserver.disconnect();

      const GAP_MS = 1000;
      const WINDOW_MS = 5000;
      let cls = 0;
      let worst: typeof shifts = [];
      let windowSum = 0;
      let windowStart = 0;
      let previous = 0;
      let open = false;
      let current: typeof shifts = [];
      for (const shift of shifts) {
        const startsNewWindow =
          !open || shift.startTime - previous > GAP_MS || shift.startTime - windowStart > WINDOW_MS;
        if (startsNewWindow) {
          windowSum = shift.value;
          windowStart = shift.startTime;
          current = [shift];
          open = true;
        } else {
          windowSum += shift.value;
          current.push(shift);
        }
        previous = shift.startTime;
        if (windowSum > cls) {
          cls = windowSum;
          worst = current.slice();
        }
      }

      // One line per element, worst first: the same element usually moves
      // in several frames, and what a reader of the failure wants is which
      // element cost the most, not how many times it twitched.
      const byElement = new Map<string, number>();
      for (const shift of worst) {
        const named = shift.sources.length > 0 ? shift.sources : ["(no source reported)"];
        for (const source of named) {
          byElement.set(source, (byElement.get(source) ?? 0) + shift.value / named.length);
        }
      }
      const shiftSources = [...byElement.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([element, value]) => `${element} ${value.toFixed(4)}`);

      const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
      const scripts = resources.filter(
        (r) => r.initiatorType === "script" || /\.js(\?|$)/.test(r.name)
      );
      let scriptBytes = 0;
      for (const script of scripts) scriptBytes += script.transferSize;

      const fontPreloads: string[] = [];
      for (const link of Array.from(document.querySelectorAll('link[rel="preload"][as="font"]'))) {
        fontPreloads.push(link.getAttribute("href") ?? "");
      }

      const unsizedImages: string[] = [];
      for (const img of Array.from(document.images)) {
        const hasAttributePair =
          img.getAttribute("width") !== null && img.getAttribute("height") !== null;
        const ratio = window.getComputedStyle(img).aspectRatio;
        const hasRatio = ratio !== "" && ratio !== "auto";
        if (!hasAttributePair && !hasRatio) unsizedImages.push(img.getAttribute("src") ?? "(no src)");
      }

      resolve({
        lcpMs,
        cls,
        shiftSources,
        scriptBytes,
        scriptCount: scripts.length,
        fontPreloads,
        unsizedImages,
      });
    }, settleMs);
  });
}

/** Kilobytes of a thousand bytes — the unit `WEB_VITALS_BUDGET`'s
 *  `LANDING_SCRIPT_KB` is named in, and the one a network panel reports.
 *  One decimal, so a message reads like a measurement. */
export function kb(bytes: number): number {
  return Math.round((bytes / 1000) * 10) / 10;
}
