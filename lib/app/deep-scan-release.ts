/**
 * The onboarding Build step may release the user to the dashboard ONLY when the
 * DEEP scan pass is genuinely finished — never on a mere `done` event.
 *
 * A tier=full scan runs TWO passes against ONE scan row and emits a `done` for
 * EACH (free/lightweight pass first, deep pass second). The competitor pick can
 * mount the Build step BEFORE the free pass's `done` is even written, so any logic
 * that navigates on "the next `done`" fires on the FREE done and drops the user on
 * the dashboard while the deep pass is still running (the two-loading-screens bug,
 * both shipped forms of it — 2026-07-28).
 *
 * `scans.deepened_at` is the deep-pass sentinel (invariant #10): NULL through the
 * entire free-pass + deep-in-progress window, set exactly once when the deep pass
 * finishes — so it is race-free regardless of when the Build step mounts. A
 * terminal FAILURE also releases (invariant #9: never trap the user on a degraded
 * scan). This is the ONLY signal the Build step navigates on.
 */
export function deepReleaseReady(scan: {
  deepened_at: string | null;
  status: string | null;
}): boolean {
  return (
    scan.deepened_at != null || scan.status === "error" || scan.status === "degraded"
  );
}
