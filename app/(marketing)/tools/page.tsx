import type { Metadata } from "next";
import Link from "next/link";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Free tools",
  description:
    "Free discoverability tools for solo founders — scan your App Store listing or website and get a Discoverability Score, no account needed.",
  path: "/tools",
});

interface Tool {
  name: string;
  blurb: string;
  href?: string;
  live: boolean;
}

const TOOLS: readonly Tool[] = [
  { name: "Discoverability Score", blurb: "Paste any App Store URL or website and get a 0–100 score across 18 signals, plus your biggest gaps — free, no account.", href: "/scan", live: true },
  { name: "ASO title & subtitle checker", blurb: "Grade your App Store title and subtitle for keyword coverage and wasted characters.", live: false },
  { name: "Keyword density checker", blurb: "See which keywords your listing actually ranks for vs. the queries your buyers type.", live: false },
  { name: "Metadata completeness audit", blurb: "Spot missing titles, descriptions, structured data and alt text holding your page back.", live: false },
  { name: "Competitor gap finder", blurb: "Compare your discoverability against the apps outranking you in your category.", live: false },
];

const SG = "var(--font-display)", JM = "var(--font-mono)";

export default function ToolsPage() {
  return (
    <main aria-label="Free tools" style={{ background: "var(--c-surface)" }}>
      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "70px 28px 24px", textAlign: "center" }}>
        <p style={{ fontFamily: JM, fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-action)", margin: 0 }}>Free tools</p>
        <h1 style={{ fontFamily: SG, fontWeight: 700, fontSize: "clamp(2rem, 4.5vw, 3.4rem)", letterSpacing: "-0.02em", lineHeight: 1.04, color: "var(--c-ink)", margin: "16px auto 0", maxWidth: 720 }}>
          Free tools to help you get found
        </h1>
        <p style={{ fontSize: 17.5, lineHeight: 1.5, color: "var(--c-muted)", margin: "18px auto 0", maxWidth: 560 }}>
          Start with a full Discoverability Score — free, no account. More focused checkers are on the way.
        </p>
      </section>

      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "20px 28px 80px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18 }}>
          {TOOLS.map((t) => {
            const inner = (
              <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--c-surface)", border: `1px solid ${t.live ? "#D9CEFB" : "var(--c-line)"}`, borderRadius: 16, padding: "24px 24px 22px", opacity: t.live ? 1 : 0.92 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <h2 style={{ fontFamily: SG, fontWeight: 700, fontSize: 17, letterSpacing: "-0.01em", color: "var(--c-ink)", margin: 0 }}>{t.name}</h2>
                  <span style={{ flex: "0 0 auto", fontFamily: JM, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "4px 9px", borderRadius: 999, background: t.live ? "var(--c-soft)" : "var(--c-fill)", color: t.live ? "var(--c-action)" : "var(--c-faint)" }}>{t.live ? "Free" : "Soon"}</span>
                </div>
                <p style={{ flex: 1, fontSize: 14.5, lineHeight: 1.55, color: "var(--c-muted)", margin: "12px 0 0" }}>{t.blurb}</p>
                {t.live && <span style={{ marginTop: 16, fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 14, color: "var(--c-action)" }}>Run a free scan →</span>}
              </div>
            );
            return t.href ? (
              <Link key={t.name} href={t.href} style={{ textDecoration: "none" }}>{inner}</Link>
            ) : (
              <div key={t.name}>{inner}</div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
