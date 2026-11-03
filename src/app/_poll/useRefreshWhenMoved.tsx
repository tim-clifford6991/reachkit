// A waiting screen asks a small status route on a timer and re-renders the
// route only once the answer has moved, so an open tab never re-reads the
// whole page while nothing has changed.
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Polls `url` every `everyMs` until `untilMs`, skipping hidden tabs, and
 *  refreshes once `field` no longer reads `waiting`; a 5xx or a network
 *  error leaves the screen as it is. */
export function useRefreshWhenMoved(a: { url: string; everyMs: number; field: string; waiting: string | boolean; untilMs?: number }): void {
  const router = useRouter();
  const { url, everyMs, field, waiting, untilMs = Infinity } = a;
  useEffect(() => {
    const timer = setInterval(() => {
      if (Date.now() >= untilMs) {
        clearInterval(timer);
        return;
      }
      if (document.hidden) return;
      void fetch(url)
        .then(async (response) => (response.status >= 500 ? null : ((await response.json()) as Record<string, unknown>)))
        .then((body) => {
          if (body !== null && body[field] !== waiting) router.refresh();
        })
        .catch(() => undefined);
    }, everyMs);
    return () => clearInterval(timer);
  }, [router, url, everyMs, field, waiting, untilMs]);
}
