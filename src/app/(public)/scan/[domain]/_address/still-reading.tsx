// SPEC §2 (owner, 2026-10-15, issue 1440) — "Still reading 3 searches…"
//
// The searches a free pass left unread are read by the `scan/finish-reads`
// job while this report is open. The line says so, and the route is asked
// again every few seconds until the job has rewritten the report, whose
// render then carries no line and the new cells. It stops asking once the
// line's own window is over, so a job that never ran costs a few requests,
// not a tab that polls for ever.
//
// The sentence is rendered on the server and handed in: `copy()` on the
// client would ship the whole registry.
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** How often the route is asked again. */
const REFRESH_MS = 5_000;

export function StillReading(p: { line: string; untilMs: number }): React.JSX.Element {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => {
      if (Date.now() >= p.untilMs) {
        clearInterval(timer);
        return;
      }
      router.refresh();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [router, p.untilMs]);
  return (
    <p role="status" className="col-span-full text-sm text-base-content/70" data-testid="report-finishing-reads">
      {p.line}
    </p>
  );
}
