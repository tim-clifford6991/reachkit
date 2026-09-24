// docs/DESIGN.md, *The calm layer*, "Motion" (owner, 2026-09-24, #1065 ·
// #1070): a big figure counts up in 1.4s, once, on first view, on the one
// easing — and under `prefers-reduced-motion` it is simply the figure.
//
// **The server draws the final figure.** This component is handed the text
// `renderValue` already made (`41`, `1,900`, `3×`) and renders exactly that;
// the count only runs after hydration, in a browser that allows motion, the
// first time the figure is on screen. So a server render, a reader with no
// script, a test and the layout gate (which renders reduced) all read the
// real number, and the count never decides what the number is.
//
// A text with no leading number is drawn as it is.
"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import { SHELL_LOCALE } from "../_shell/format";

const DURATION_MS = 1400;

/** `cubic-bezier(.2,.7,.2,1)` — the product's one easing (`--ease-calm`),
 *  solved for y at time x by bisection over the curve's parameter. */
function calm(x: number): number {
  const at = (t: number, a: number, b: number): number =>
    3 * a * t * (1 - t) ** 2 + 3 * b * t ** 2 * (1 - t) + t ** 3;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 20; i += 1) {
    const mid = (lo + hi) / 2;
    if (at(mid, 0.2, 0.2) < x) lo = mid;
    else hi = mid;
  }
  return at((lo + hi) / 2, 0.7, 1);
}

/** The leading number, how many decimals it is written with, and the rest. */
function split(text: string): { value: number; decimals: number; rest: string } | null {
  const match = /^(\d[\d,]*(?:\.(\d+))?)(.*)$/su.exec(text);
  if (match === null) return null;
  const value = Number(match[1]?.replaceAll(",", ""));
  if (!Number.isFinite(value)) return null;
  return { value, decimals: match[2]?.length ?? 0, rest: match[3] ?? "" };
}

export function CountUp(p: { text: string; className?: string }): React.JSX.Element {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(p.text);

  useEffect(() => {
    const parts = split(p.text);
    const node = ref.current;
    if (parts === null || node === null) return;
    // No observer or no media query (an old browser, a test's DOM): the
    // figure stands as the server drew it.
    if (typeof IntersectionObserver === "undefined" || typeof window.matchMedia !== "function") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const format = new Intl.NumberFormat(SHELL_LOCALE, {
      minimumFractionDigits: parts.decimals,
      maximumFractionDigits: parts.decimals,
    });
    let frame = 0;
    const run = (): void => {
      const start = performance.now();
      const step = (now: number): void => {
        const x = Math.min(1, (now - start) / DURATION_MS);
        setShown(x >= 1 ? p.text : `${format.format(parts.value * calm(x))}${parts.rest}`);
        if (x < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    };
    // Once, on first view: a figure below the fold counts when it arrives.
    const seen = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      seen.disconnect();
      run();
    });
    seen.observe(node);
    return () => {
      seen.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [p.text]);

  return (
    <span ref={ref} className={p.className}>
      {shown}
    </span>
  );
}
