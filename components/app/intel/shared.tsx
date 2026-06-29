"use client";

/**
 * Shared plumbing for the intel views: the fetch hook + a loading/error/empty
 * shell + number formatters. Styled in the kit's --c-* idiom (no foreign tokens).
 */
import { useEffect, useState, useCallback } from "react";
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
 */
export function useIntel<T>(layer: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stages, setStages] = useState<IntelStage[]>([]);

  // Plain-fetch fallback used when EventSource fails or on manual reload.
  const fallbackFetch = useCallback(async () => {
    try {
      const res = await fetch(`/api/app/intel?layer=${layer}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
      setData(json as T);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setLoading(false);
    }
  }, [layer]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setStages([]);
    setData(null);

    let es: EventSource | null = null;
    let cancelled = false;

    try {
      es = new EventSource(`/api/app/intel/stream?layer=${layer}`);

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
            es?.close();
          } else if (msg.type === "error") {
            setError(msg.message ?? "failed");
            setLoading(false);
            es?.close();
          }
        } catch {
          /* ignore parse errors — malformed frame */
        }
      };

      es.onerror = () => {
        if (cancelled) return;
        es?.close();
        // EventSource failed (auth error, network, etc.) — fall back to plain fetch.
        void fallbackFetch();
      };
    } catch {
      // EventSource constructor threw (e.g. SSR context) — fall back immediately.
      void fallbackFetch();
    }

    return () => {
      cancelled = true;
      es?.close();
    };
  }, [layer, fallbackFetch]);

  // Manual reload bypasses the stream and uses the plain fetch (instant when cached).
  const reload = useCallback(() => {
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
