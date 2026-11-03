// A waiting screen asks a small status route on a timer and re-renders the
// route only when the answer says the work has moved, so an open tab never
// re-reads the whole page while nothing has changed.
"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/** Polls `url` every `everyMs` until `untilMs`, skipping hidden tabs; a 5xx or
 *  network error leaves the screen as it is. */
export function useRefreshWhenMoved(url: string, everyMs: number, moved: (body: unknown) => boolean, untilMs = Infinity): void {
  const router = useRouter();
  const movedRef = useRef(moved);
  movedRef.current = moved;
  useEffect(() => {
    const timer = setInterval(() => {
      if (Date.now() >= untilMs) {
        clearInterval(timer);
        return;
      }
      if (document.hidden) return;
      void fetch(url)
        .then(async (response) => (response.status >= 500 ? undefined : ((await response.json()) as unknown)))
        .then((body) => {
          if (body !== undefined && movedRef.current(body)) router.refresh();
        })
        .catch(() => undefined);
    }, everyMs);
    return () => clearInterval(timer);
  }, [router, url, everyMs, untilMs]);
}
