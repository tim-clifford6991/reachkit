"use client";

/**
 * Setup overlay · Step 3 — "calculating your data". A full staged-progress
 * experience in the intel-kit idiom (big percent ring + live stage checklist),
 * driven by the REAL supply gather: it opens the same SSE the dashboard uses
 * (via `useIntel("supply")`) and renders each `stage` event as a checklist row.
 *
 * Finishes on `done`, on `error`, or after a 90s soft-timeout (the dashboard's
 * own IntelShell keeps streaming the rest) — then holds a brief "your dashboard
 * is ready" beat and calls `onComplete` (the overlay refreshes the server
 * layout, which recomputes setupState → "ready" and unmounts the overlay).
 *
 * `hasDomain=false` (no scanned app yet) skips the SSE entirely and finishes
 * after a short beat — there's nothing to benchmark until the first scan.
 */

import { useEffect, useRef, useState } from "react";
import { useIntel } from "@/components/app/intel/shared";

const SG = "var(--font-display)", PJ = "var(--font-sans)", JM = "var(--font-mono)";

const SOFT_TIMEOUT_S = 90;
const READY_BEAT_MS = 1800;

function Ring({ pct }: { pct: number }) {
  const size = 168, sw = 12, r = (size - sw) / 2, c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Progress ${Math.round(clamped)}%`}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--c-fill)" strokeWidth={sw} />
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke="var(--c-action)" strokeWidth={sw} strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - clamped / 100)}
            style={{ transition: "stroke-dashoffset 600ms ease" }}
          />
        </g>
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: JM, fontWeight: 700, fontSize: 36, letterSpacing: "-0.02em", color: "var(--c-ink)", lineHeight: 1 }}>{Math.round(clamped)}%</span>
        <span style={{ fontFamily: JM, fontSize: 10.5, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--c-faint)", marginTop: 5 }}>calculating</span>
      </div>
    </div>
  );
}

export function SetupCalculatingStep({
  hasDomain,
  onComplete,
}: {
  hasDomain: boolean;
  onComplete: () => void;
}) {
  // The real dashboard data-load: same SSE stream (and cache) the intel pages
  // use, so this step both SHOWS progress and genuinely pre-warms the data.
  const { data, error, stages } = useIntel<unknown>("supply", { enabled: hasDomain });

  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 0.5), 500);
    return () => clearInterval(t);
  }, []);

  // Terminal condition — real completion, failure, or the soft timeout. With no
  // domain there's nothing to load: settle after a short beat.
  const settled = hasDomain
    ? data != null || error != null || elapsed >= SOFT_TIMEOUT_S
    : elapsed >= 1.5;
  const degraded = hasDomain && settled && data == null;

  // Hold the "ready" beat, then hand back to the overlay (which refreshes the
  // server layout → setupState becomes "ready" → the overlay unmounts).
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => {
    if (!settled) return;
    const t = setTimeout(() => onCompleteRef.current(), READY_BEAT_MS);
    return () => clearTimeout(t);
  }, [settled]);

  // Progress: stage arrivals push it forward; a slow time-based easing keeps it
  // alive between events; terminal state pins 100.
  const stagePct = Math.min(88, stages.length * 11);
  const timePct = 90 * (1 - Math.exp(-elapsed / 35));
  const pct = settled ? 100 : Math.max(4, stagePct, timePct);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "8px 0 4px" }}>
      <style>{`@keyframes rk-setup-spin{to{transform:rotate(360deg)}}`}</style>

      <h1 style={{ fontFamily: SG, fontWeight: 700, fontSize: 24, letterSpacing: "-0.01em", color: "var(--c-ink)", margin: 0 }}>
        {settled ? "Your dashboard is ready" : "Calculating your discoverability data…"}
      </h1>
      <p style={{ fontFamily: PJ, fontSize: 13.5, lineHeight: 1.55, color: "var(--c-muted)", margin: "8px 0 0", maxWidth: 440 }}>
        {settled
          ? degraded
            ? "We'll keep crunching in the background — your dashboard picks it up live."
            : "Benchmarks locked in. Opening your dashboard…"
          : hasDomain
            ? "We're benchmarking you against your chosen competitors — channels, keywords, content. The first pass can take a minute; after this it's instant."
            : "Setting up your workspace…"}
      </p>

      <div style={{ marginTop: 26 }}>
        <Ring pct={pct} />
      </div>

      {/* Live stage checklist — real events from the supply gather stream. */}
      {hasDomain && (
        <div style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 12, minWidth: 260, maxWidth: 400, textAlign: "left" }}>
          {stages.length === 0 && !settled && (
            <StageRow active label="Connecting to your data…" />
          )}
          {stages.map((s) => (
            <StageRow key={s.key} active={!s.done && !settled} done={s.done || settled} label={s.label} detail={s.detail} />
          ))}
          {settled && <StageRow done label="Dashboard assembled" />}
        </div>
      )}
    </div>
  );
}

function StageRow({ label, detail, done, active }: { label: string; detail?: string; done?: boolean; active?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {done ? (
        <span style={{ width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 13, color: "var(--c-action)" }}>&#10003;</span>
      ) : active ? (
        <span style={{ width: 18, height: 18, borderRadius: "var(--radius-full)", border: "2px solid var(--c-soft)", borderTopColor: "var(--c-action)", animation: "rk-setup-spin 0.8s linear infinite", display: "inline-block", flexShrink: 0 }} />
      ) : (
        <span style={{ width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ width: 6, height: 6, borderRadius: "var(--radius-full)", background: "var(--c-line)" }} />
        </span>
      )}
      <span style={{ fontFamily: PJ, fontSize: 13.5, color: done ? "var(--c-muted)" : "var(--c-ink)", lineHeight: 1.3 }}>
        {label}
        {detail && <span style={{ color: "var(--c-muted)", marginLeft: 6, fontSize: 12.5 }}>{detail}</span>}
      </span>
    </div>
  );
}
