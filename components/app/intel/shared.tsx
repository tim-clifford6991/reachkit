"use client";

/**
 * Shared plumbing for the intel views: the fetch hook + a loading/error/empty
 * shell + number formatters. Styled in the kit's --c-* idiom (no foreign tokens).
 */
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

export function useIntel<T>(layer: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
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

  useEffect(() => { void load(); }, [load]);
  return { data, loading, error, reload: load };
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

export function IntelShell({ loading, error, hasData, children }: { loading: boolean; error: string | null; hasData: boolean; children: React.ReactNode }) {
  if (loading)
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "96px 0", textAlign: "center", color: "var(--c-muted)" }}>
        <span style={{ width: 24, height: 24, borderRadius: "var(--radius-full)", border: "2px solid var(--c-soft)", borderTopColor: "var(--c-action)", animation: "spin 0.8s linear infinite", display: "inline-block" }} />
        <p style={{ fontSize: 14, margin: 0 }}>Analyzing… first load can take up to a minute, then it&apos;s instant.</p>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  if (error) return <Notice sub={error}>Couldn&apos;t load this view</Notice>;
  if (!hasData) return <Notice sub="Pick your competitors to generate this report." cta={{ label: "Choose competitors", href: "/app/competitors" }}>No data yet</Notice>;
  return <>{children}</>;
}

export const fmt = (n: number) => (n ?? 0).toLocaleString();
export const fmtCompact = (n: number) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n ?? 0);
