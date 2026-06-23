import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Design directions", robots: { index: false } };

const VARIANTS = [
  {
    slug: "reachkit",
    name: "Violet",
    sub: "Discoverability · Violet",
    desc: "The new direction from the Claude Design mockup. Clean near-white surfaces, a vivid violet brand, ink near-black text, geometric Space Grotesk headlines. Confident, modern, analytics-product.",
    swatches: ["oklch(1 0 0)", "oklch(0.56 0.20 285)", "oklch(0.20 0.012 286)"],
  },
  {
    slug: "almanac",
    name: "Almanac",
    sub: "Editorial · Honey",
    desc: "Warm cream paper, ink-brown serif headlines, a honey/amber accent. Magazine-calm and human — Stripe/Notion clarity with the most soul.",
    swatches: ["oklch(0.975 0.012 80)", "oklch(0.66 0.13 66)", "oklch(0.28 0.02 60)"],
  },
  {
    slug: "sage",
    name: "Sage",
    sub: "Clean · Green",
    desc: "Warm off-white, charcoal sans, a muted sage-green accent. The most Notion/Stripe-like: hairline borders, whisper-soft shadows, disciplined.",
    swatches: ["oklch(0.965 0.008 120)", "oklch(0.55 0.09 150)", "oklch(0.27 0.015 150)"],
  },
  {
    slug: "clay",
    name: "Clay",
    sub: "Confident · Terracotta",
    desc: "Warm paper, heavy tight sans, a terracotta accent, rounder shapes and a more present shadow. Airy but the boldest, most distinctive of the three.",
    swatches: ["oklch(0.960 0.014 60)", "oklch(0.60 0.15 40)", "oklch(0.27 0.022 45)"],
  },
];

export default function DesignIndex() {
  return (
    <main
      className="min-h-screen px-6 py-16 sm:py-24"
      style={{
        background: "oklch(0.97 0.01 75)",
        color: "oklch(0.27 0.02 60)",
        fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <div className="mx-auto max-w-4xl">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "oklch(0.6 0.13 60)" }}>
          Pick a direction
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
          Three warm, airy directions for ReachKit
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed" style={{ color: "oklch(0.5 0.02 62)" }}>
          All three honour the brief: Stripe/Notion-clean, light&nbsp;+&nbsp;dark, warm earthy
          palette, oversized&nbsp;&amp;&nbsp;airy. Each is a live sample of the marketing page
          <em> and </em> the app dashboard. Open one, toggle light/dark (top-right), and switch
          between them from the pill nav. Tell me which to refine.
        </p>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {VARIANTS.map((v) => (
            <Link
              key={v.slug}
              href={`/design/${v.slug}`}
              className="group flex flex-col gap-4 rounded-3xl bg-white p-6 transition-transform hover:-translate-y-1"
              style={{ border: "1px solid oklch(0.89 0.014 72)", boxShadow: "0 10px 30px -14px oklch(0.4 0.05 60 / 0.2)" }}
            >
              <div className="flex gap-1.5">
                {v.swatches.map((s) => (
                  <span key={s} className="size-6 rounded-full" style={{ background: s, border: "1px solid oklch(0 0 0 / 0.06)" }} />
                ))}
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight">{v.name}</h2>
                <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "oklch(0.6 0.13 60)" }}>
                  {v.sub}
                </p>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: "oklch(0.5 0.02 62)" }}>
                {v.desc}
              </p>
              <span className="mt-auto text-sm font-semibold" style={{ color: "oklch(0.55 0.13 60)" }}>
                View {v.name} →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
