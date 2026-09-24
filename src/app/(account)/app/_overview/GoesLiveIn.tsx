// SPEC §4 2026-09-24 (#1070) — the review card's live *goes live in*.
//
// The sentence is the registry's and arrives written, cut around its one
// value (`before` · the time left · `after`), so this file composes no
// words; it only ticks the value once a second. The absolute time the page
// publishes at stays on the `<time>` element, where hovering it shows it.
//
// The server renders the time left at the moment it rendered; the browser
// takes over on its first tick, which is why the value alone suppresses the
// hydration warning — a second's drift is the point of a live clock, not a
// mismatch. Once the time has passed the line says the absolute time, as it
// did before the countdown, because "0s" is not a thing the page does.
"use client";

import type React from "react";
import { useEffect, useState } from "react";

const SECOND_MS = 1000;

/** `6h 12m 09s` — hours unpadded, minutes and seconds two digits. */
function left(ms: number): string {
  const total = Math.max(0, Math.floor(ms / SECOND_MS));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const two = (n: number): string => String(n).padStart(2, "0");
  return hours > 0 ? `${hours}h ${two(minutes)}m ${two(seconds)}s` : `${minutes}m ${two(seconds)}s`;
}

export function GoesLiveIn(p: {
  /** ISO instant the page publishes at. */
  at: string;
  /** That instant as the site's clock states it. */
  absolute: string;
  before: string;
  after: string;
  /** The line once the time has passed. */
  passed: string;
  /** The render's own clock, so the first paint agrees with the server. */
  now: number;
}): React.JSX.Element {
  const at = Date.parse(p.at);
  const [now, setNow] = useState(p.now);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), SECOND_MS);
    return () => clearInterval(tick);
  }, []);

  if (at - now <= 0) return <>{p.passed}</>;
  return (
    <>
      {p.before}
      <time dateTime={p.at} title={p.absolute} className="num font-semibold text-base-content" suppressHydrationWarning>
        {left(at - now)}
      </time>
      {p.after}
    </>
  );
}
