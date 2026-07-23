import type { Metadata } from "next";
import Link from "next/link";
import { buildMetadata } from "@/lib/seo";
import { HeroFade } from "@/components/sections/hero-fade";

export const metadata: Metadata = buildMetadata({
  title: "Free SEO & AI visibility tools — check any website in seconds",
  description:
    "Free tools for founders: on-page SEO checker, AI visibility check (llms.txt, GPTBot & ClaudeBot access), and a Google/X/LinkedIn preview tester. No account needed.",
  path: "/tools",
});

interface Tool {
  name: string;
  blurb: string;
  href: string;
  cta: string;
}

const TOOLS: readonly Tool[] = [
  {
    name: "Discoverability Score",
    blurb:
      "Paste any App Store URL or website and get a 0–100 score across every signal we can measure from your live page — search, AI answers, content, competitors — plus your biggest gaps. Free, no account.",
    href: "/scan",
    cta: "Run a free scan →",
  },
  {
    name: "On-page SEO checker",
    blurb:
      "Check the 8 on-page signals search engines read first: title tag, meta description, structured data, canonical, headings, social tags, content depth and alt text.",
    href: "/tools/on-page-check",
    cta: "Check a page →",
  },
  {
    name: "AI visibility check",
    blurb:
      "Can ChatGPT, Claude and Perplexity actually see your product? Test llms.txt, robots.txt rules for AI crawlers, structured data, and whether your proposition is machine-readable.",
    href: "/tools/ai-visibility-check",
    cta: "Test AI visibility →",
  },
  {
    name: "Meta & social preview",
    blurb:
      "See exactly how your page renders as a Google result, an X card and a LinkedIn share — from your real title, description and og:image tags — plus what's missing.",
    href: "/tools/meta-preview",
    cta: "Preview a URL →",
  },
];

const SG = "var(--font-display)", JM = "var(--font-mono)";

export default function ToolsPage() {
  return (
    <main aria-label="Free tools" style={{ background: "var(--c-surface)" }}>
      <HeroFade padding="70px 28px 24px">
        <p style={{ fontFamily: JM, fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-action)", margin: 0 }}>Free tools</p>
        <h1 style={{ fontFamily: SG, fontWeight: 700, fontSize: "clamp(2rem, 4.5vw, 3.4rem)", letterSpacing: "-0.02em", lineHeight: 1.04, color: "var(--c-ink)", margin: "16px auto 0", maxWidth: 720 }}>
          Free tools to help you get found
        </h1>
        <p style={{ fontSize: 17.5, lineHeight: 1.5, color: "var(--c-muted)", margin: "18px auto 0", maxWidth: 560 }}>
          Single-purpose checkers that run on your live site — no signup, no email. Each one covers a slice of the full ReachKit Discoverability Score.
        </p>
      </HeroFade>

      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "20px 28px 80px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18 }}>
          {TOOLS.map((t) => (
            <Link key={t.name} href={t.href} style={{ textDecoration: "none" }}>
              <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--c-surface)", border: "1px solid var(--c-tint-violet-line)", borderRadius: 16, padding: "24px 24px 22px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <h2 style={{ fontFamily: SG, fontWeight: 700, fontSize: 17, letterSpacing: "-0.01em", color: "var(--c-ink)", margin: 0 }}>{t.name}</h2>
                  <span style={{ flex: "0 0 auto", fontFamily: JM, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "4px 9px", borderRadius: 999, background: "var(--c-soft)", color: "var(--c-action)" }}>Free</span>
                </div>
                <p style={{ flex: 1, fontSize: 14.5, lineHeight: 1.55, color: "var(--c-muted)", margin: "12px 0 0" }}>{t.blurb}</p>
                <span style={{ marginTop: 16, fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 14, color: "var(--c-action)" }}>{t.cta}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
