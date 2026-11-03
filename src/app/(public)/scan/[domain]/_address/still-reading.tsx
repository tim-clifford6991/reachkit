// SPEC §2 (owner, 2026-10-15, issue 1440) — "Still reading 3 searches…"
//
// The searches a free pass left unread are read by the `scan/finish-reads`
// job while this report is open. The line says so, and asks the small
// `reads` route every few seconds whether the job is done; only then is the
// route re-rendered, whose render carries no line and the new cells. It
// stops asking once the line's own window is over, so a job that never ran
// costs a few requests, not a tab that polls for ever.
//
// The sentence is rendered on the server and handed in: `copy()` on the
// client would ship the whole registry.
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** How often the route is asked again. */
const REFRESH_MS = 5_000;

export function StillReading(p: { line: string; untilMs: number; scanId: string }): React.JSX.Element {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => {
      if (Date.now() >= p.untilMs) {
        clearInterval(timer);
        return;
      }
      if (document.hidden) return;
      void fetch(`/api/scan/${encodeURIComponent(p.scanId)}/reads`)
        .then(async (response) => (response.ok ? ((await response.json()) as { finishing: boolean }) : null))
        .then((body) => {
          if (body?.finishing === false) router.refresh();
        })
        .catch(() => undefined);
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [router, p.untilMs, p.scanId]);
  return (
    <p role="status" className="col-span-full text-sm text-base-content/70" data-testid="report-finishing-reads">
      {p.line}
    </p>
  );
}
