/**
 * Shared kit-idiom UI for the free /tools mini-checkers (W3): page header,
 * GET form, pass/warn/fail check list, and the closing full-scan CTA. All
 * server components — the tools ship zero client JS.
 */

import Link from "next/link";
import type { CheckState, ToolCheck } from "@/lib/tools/ai-visibility";

const SG = "var(--font-display)";
const JM = "var(--font-mono)";

/** Kit status colors — same bands the report gauge uses. */
export const STATE_COLOR: Record<CheckState, string> = {
  pass: "var(--c-band-findable)",
  warn: "var(--c-band-fair)",
  fail: "var(--c-band-invisible)",
};

export function ToolHeader({ title, intro }: { title: string; intro: string }) {
  return (
    <header>
      <p style={{ fontFamily: JM, fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-action)", margin: 0 }}>
        Free tool
      </p>
      <h1 style={{ fontFamily: SG, fontWeight: 700, fontSize: "clamp(1.7rem, 3.5vw, 2.4rem)", letterSpacing: "-0.02em", lineHeight: 1.1, color: "var(--c-ink)", margin: "12px 0 0" }}>
        {title}
      </h1>
      <p style={{ fontSize: 15.5, lineHeight: 1.55, color: "var(--c-muted)", margin: "12px 0 0", maxWidth: 560 }}>
        {intro}
      </p>
    </header>
  );
}

export function ToolForm({ defaultValue, buttonLabel = "Check" }: { defaultValue?: string; buttonLabel?: string }) {
  return (
    <form method="GET" style={{ marginTop: 24, display: "flex", gap: 10, flexWrap: "wrap" }}>
      <input
        name="url"
        type="text"
        defaultValue={defaultValue}
        placeholder="https://yoursite.com"
        aria-label="Website URL"
        style={{
          flex: "1 1 260px", height: 46, borderRadius: 12, border: "1px solid var(--c-line)",
          background: "var(--c-surface)", padding: "0 16px", fontSize: 15, color: "var(--c-ink)",
          fontFamily: "var(--font-sans)", outline: "none",
        }}
      />
      <button
        type="submit"
        style={{
          flex: "0 0 auto", height: 46, borderRadius: 12, border: "none", padding: "0 22px",
          background: "var(--c-action)", color: "var(--c-on-dark)", fontFamily: "var(--font-sans)",
          fontWeight: 600, fontSize: 15, cursor: "pointer",
        }}
      >
        {buttonLabel}
      </button>
    </form>
  );
}

export function CheckList({ checks }: { checks: readonly ToolCheck[] }) {
  return (
    <ul style={{ listStyle: "none", margin: "16px 0 0", padding: 0, border: "1px solid var(--c-line)", borderRadius: 14, overflow: "hidden" }}>
      {checks.map((c, i) => (
        <li
          key={c.label}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14,
            padding: "13px 16px", borderTop: i === 0 ? "none" : "1px solid var(--c-line)",
            background: "var(--c-surface)",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <span aria-hidden style={{ flex: "0 0 auto", width: 8, height: 8, borderRadius: 999, background: STATE_COLOR[c.state] }} />
            <span style={{ fontSize: 14.5, fontWeight: 600, color: "var(--c-ink)" }}>{c.label}</span>
          </span>
          <span style={{ fontFamily: JM, fontSize: 11.5, color: "var(--c-muted)", textAlign: "right" }}>
            <span className="sr-only">{c.state}: </span>
            {c.detail}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Closing conversion block: every tool funnels into the full scan. */
export function ScanCta({ url, line }: { url: string; line: string }) {
  return (
    <div style={{ marginTop: 20, border: "1px solid var(--c-tint-violet-line)", background: "var(--c-tint-violet)", borderRadius: 14, padding: "22px 24px", textAlign: "center" }}>
      <p style={{ fontSize: 14.5, lineHeight: 1.55, color: "var(--c-ink)", margin: 0 }}>{line}</p>
      <Link
        href={`/scan?url=${encodeURIComponent(url)}`}
        style={{
          display: "inline-flex", alignItems: "center", marginTop: 14, height: 40, padding: "0 20px",
          borderRadius: 11, background: "var(--c-action)", color: "var(--c-on-dark)",
          fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 14, textDecoration: "none",
        }}
      >
        Run the full scan →
      </Link>
    </div>
  );
}

/** Friendly inline note for fetch failures / rate limits / bad input. */
export function ToolNote({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ marginTop: 24, fontSize: 14.5, lineHeight: 1.55, color: "var(--c-muted)" }}>{children}</p>
  );
}

/** Shared page shell: centered column on the marketing surface. */
export function ToolShell({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ background: "var(--c-surface)" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "64px 28px 90px" }}>{children}</div>
    </main>
  );
}
