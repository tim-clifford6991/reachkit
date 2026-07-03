"use client";

/**
 * Shared plumbing for the intel views: the fetch hook + a loading/error/empty
 * shell + number formatters. Styled in the kit's --c-* idiom (no foreign tokens).
 */
import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";

export interface IntelStage {
  key: string;
  label: string;
  detail?: string;
  /** True once the next stage has arrived (this one is no longer the active step). */
  done: boolean;
}

/**
 * Fetches one intel layer via SSE streaming, with a plain-fetch fallback.
 *
 * On mount it opens an EventSource to /api/app/intel/stream?layer=<layer>.
 * - Each `stage` event appends to `stages` (marking the previous one done).
 * - The `done` event sets `data` and closes the stream.
 * - On any EventSource error it falls back to a plain fetch of /api/app/intel.
 *
 * The `stages` array lets IntelShell render live progress instead of a blind
 * spinner. When data is already cached the stream emits `done` almost instantly
 * with no stage events — IntelShell falls back to the simple spinner briefly.
 *
 * `opts.enabled` (default `true`) lets a caller defer the fetch entirely — while
 * disabled, no stream/fallback-fetch is started and `loading` stays false. Flip
 * it to `true` later (e.g. once a sibling layer has resolved) to kick off the
 * fetch at that point. Additive/non-breaking: omitting `opts` behaves exactly
 * as before.
 */
export function useIntel<T>(layer: string, opts: { enabled?: boolean } = {}) {
  const enabled = opts.enabled ?? true;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [stages, setStages] = useState<IntelStage[]>([]);

  // The currently-open stream, so reload() can close it before starting a new
  // request (else a late `done` frame from the old stream can overwrite the
  // reload result — last-write-wins race).
  const esRef = useRef<EventSource | null>(null);
  // True once the stream (or a fallback fetch) has delivered a terminal
  // frame — `done` (data set) or an explicit `error`. Guards the EventSource
  // `onerror` handler: the browser fires `onerror` when the SERVER closes the
  // connection after `done`, and without this guard that post-success error
  // would launch a redundant SECOND (cost-metered) gather and clobber good data.
  const settledRef = useRef(false);

  // Plain-fetch fallback used when EventSource fails or on manual reload.
  const fallbackFetch = useCallback(async () => {
    try {
      const res = await fetch(`/api/app/intel?layer=${layer}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
      setData(json as T);
      settledRef.current = true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setLoading(false);
    }
  }, [layer]);

  // Reset per-layer state during render (not in an effect) when `layer` changes.
  // This is React's documented "adjust state on prop change" pattern — it keeps
  // the reset-on-layer-switch behavior without a synchronous setState-in-effect
  // (which trips react-hooks/set-state-in-effect and causes cascading renders).
  const [renderedLayer, setRenderedLayer] = useState(layer);
  if (layer !== renderedLayer) {
    setRenderedLayer(layer);
    setData(null);
    setError(null);
    setStages([]);
    setLoading(true);
  }

  useEffect(() => {
    // Deferred: caller isn't ready for this layer yet (e.g. waiting on a
    // sibling layer to resolve first). Don't open a stream or fallback-fetch;
    // `loading` stays false (set from `enabled` at mount / reset above) until
    // this flips to true and the effect re-runs.
    if (!enabled) return;

    let es: EventSource | null = null;
    let cancelled = false;
    // Fresh stream for this layer — no terminal frame delivered yet. (Reset here,
    // not during render, since refs can't be mutated in the render phase.)
    settledRef.current = false;
    setLoading(true);

    try {
      es = new EventSource(`/api/app/intel/stream?layer=${layer}`);
      esRef.current = es;

      es.onmessage = (event: MessageEvent) => {
        if (cancelled) return;
        try {
          const msg = JSON.parse(String(event.data)) as {
            type: string;
            key?: string;
            label?: string;
            detail?: string;
            payload?: unknown;
            message?: string;
          };

          if (msg.type === "stage") {
            setStages((prev) => {
              // Mark the current active stage (last entry) as done when a new one arrives.
              const updated = prev.map((s, i) =>
                i === prev.length - 1 ? { ...s, done: true } : s,
              );
              return [...updated, { key: msg.key ?? "", label: msg.label ?? "", detail: msg.detail, done: false }];
            });
          } else if (msg.type === "done") {
            setData(msg.payload as T);
            setLoading(false);
            settledRef.current = true;
            es?.close();
          } else if (msg.type === "error") {
            setError(msg.message ?? "failed");
            setLoading(false);
            settledRef.current = true;
            es?.close();
          }
        } catch {
          /* ignore parse errors — malformed frame */
        }
      };

      es.onerror = () => {
        if (cancelled) return;
        es?.close();
        // If the stream already delivered a terminal frame, this `onerror` is
        // just the server closing the connection after completion — do NOT run a
        // second gather. Only fall back on a genuine pre-completion failure.
        if (settledRef.current) return;
        void fallbackFetch();
      };
    } catch {
      // EventSource constructor threw (e.g. SSR context) — fall back on the next
      // microtask so the fetch's setState isn't dispatched synchronously inside
      // the effect (which would trip react-hooks/set-state-in-effect).
      queueMicrotask(() => {
        if (!cancelled) void fallbackFetch();
      });
    }

    return () => {
      cancelled = true;
      es?.close();
      if (esRef.current === es) esRef.current = null;
    };
  }, [layer, fallbackFetch, enabled]);

  // Manual reload bypasses the stream and uses the plain fetch (instant when cached).
  const reload = useCallback(() => {
    // Close any still-open stream first so a late `done` frame can't overwrite
    // the reload result.
    esRef.current?.close();
    esRef.current = null;
    settledRef.current = false;
    setLoading(true);
    setError(null);
    setStages([]);
    setData(null);
    void fallbackFetch();
  }, [fallbackFetch]);

  return { data, loading, error, stages, reload };
}

function Notice({ children, sub, cta }: { children: React.ReactNode; sub?: string; cta?: { label: string; href: string } }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "56px 24px", textAlign: "center", border: "1px dashed var(--c-line)", borderRadius: "var(--radius-xl)", background: "var(--c-surface)" }}>
      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--c-ink)", margin: 0 }}>{children}</p>
      {sub && <p style={{ fontSize: 12.5, color: "var(--c-muted)", margin: 0, maxWidth: 360 }}>{sub}</p>}
      {cta && <Link href={cta.href} style={{ marginTop: 6, background: "var(--c-action)", color: "var(--c-on-dark)", fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 13, padding: "8px 14px", borderRadius: "var(--radius-lg)", textDecoration: "none" }}>{cta.label}</Link>}
    </div>
  );
}

/** Small spinner matching the existing kit style. */
function Spinner() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "96px 0", textAlign: "center", color: "var(--c-muted)" }}>
      <span style={{ width: 24, height: 24, borderRadius: "var(--radius-full)", border: "2px solid var(--c-soft)", borderTopColor: "var(--c-action)", animation: "spin 0.8s linear infinite", display: "inline-block" }} />
      <p style={{ fontSize: 14, margin: 0 }}>Analyzing&hellip; first load can take up to a minute, then it&apos;s instant.</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

/**
 * Loading shell for intel pages.
 *
 * - When no stages have arrived yet (warm load / pre-connect) shows a simple spinner.
 * - Once stages start arriving, replaces the spinner with a live stage list:
 *     check  Profiling your site
 *     spin   Finding & ranking competitors  Found 4 competitors
 *   Each completed step shows a static check; the active step shows a spinner.
 */
export function IntelShell({
  loading,
  error,
  hasData,
  stages = [],
  children,
}: {
  loading: boolean;
  error: string | null;
  hasData: boolean;
  stages?: IntelStage[];
  children: React.ReactNode;
}) {
  if (loading) {
    if (stages.length === 0) {
      // No stages yet — warm load or pre-connect. Show the familiar simple spinner.
      return <Spinner />;
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, padding: "72px 24px", textAlign: "left" }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 280, maxWidth: 360 }}>
          {stages.map((s) => (
            <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* Status indicator: spinner for active, check for completed. */}
              {s.done ? (
                <span style={{
                  width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, fontSize: 13, color: "var(--c-action)",
                }}>&#10003;</span>
              ) : (
                <span style={{
                  width: 18, height: 18, borderRadius: "var(--radius-full)",
                  border: "2px solid var(--c-soft)", borderTopColor: "var(--c-action)",
                  animation: "spin 0.8s linear infinite", display: "inline-block", flexShrink: 0,
                }} />
              )}
              <span style={{ fontSize: 13.5, color: s.done ? "var(--c-muted)" : "var(--c-ink)", lineHeight: 1.3 }}>
                {s.label}
                {s.detail && (
                  <span style={{ color: "var(--c-muted)", marginLeft: 6, fontSize: 12.5 }}>{s.detail}</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (error) return <Notice sub={error}>Couldn&apos;t load this view</Notice>;
  if (!hasData) return <Notice sub="Pick your competitors to generate this report." cta={{ label: "Choose competitors", href: "/app/competitors" }}>No data yet</Notice>;
  return <>{children}</>;
}

export const fmt = (n: number) => (n ?? 0).toLocaleString();
export const fmtCompact = (n: number) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n ?? 0);
