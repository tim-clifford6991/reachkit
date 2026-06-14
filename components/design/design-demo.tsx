"use client";

/**
 * DesignDemo — a self-contained, themeable sample composition used to compare
 * candidate visual directions for ReachKit.
 *
 * It renders a representative slice of BOTH the marketing surface (nav, hero,
 * proof, features, pricing) and the app surface (a dashboard preview), styled
 * entirely through `--d-*` CSS custom properties. Each variant page supplies
 * the token values (light + dark) via a scoped <style> block; this component is
 * shared, so the variants differ only in their tokens, type and shape — an
 * honest apples-to-apples comparison.
 *
 * The light/dark toggle flips `data-mode` on the root; the variant's scoped CSS
 * keys its dark palette off `[data-mode="dark"]`. Nothing here touches the real
 * app's global theme.
 */

import { useState } from "react";
import Link from "next/link";
import {
  Sun,
  Moon,
  ArrowRight,
  Search,
  Target,
  FileText,
  Check,
  Sparkles,
} from "lucide-react";

const VARIANTS = [
  { slug: "almanac", label: "Almanac" },
  { slug: "sage", label: "Sage" },
  { slug: "clay", label: "Clay" },
] as const;

interface DesignDemoProps {
  /** Scoped class carrying this variant's --d-* tokens (e.g. "v-almanac"). */
  rootClassName: string;
  /** Variant slug for the active nav pill. */
  active: (typeof VARIANTS)[number]["slug"];
  name: string;
  tagline: string;
}

export function DesignDemo({ rootClassName, active, name, tagline }: DesignDemoProps) {
  const [mode, setMode] = useState<"light" | "dark">("light");

  return (
    <div
      className={`${rootClassName} demo-root min-h-screen`}
      data-mode={mode}
      style={{
        background: "var(--d-bg)",
        color: "var(--d-text)",
        fontFamily: "var(--d-font-body)",
      }}
    >
      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 backdrop-blur-xl sm:px-10"
        style={{
          background: "color-mix(in oklch, var(--d-bg) 78%, transparent)",
          borderBottom: "1px solid var(--d-border)",
        }}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="grid size-7 place-items-center rounded-lg text-[13px] font-bold"
            style={{ background: "var(--d-accent)", color: "var(--d-accent-fg)" }}
          >
            R
          </span>
          <span
            className="text-[17px]"
            style={{ fontFamily: "var(--d-font-display)", fontWeight: 600 }}
          >
            ReachKit
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Variant switcher */}
          <div
            className="hidden items-center gap-1 rounded-full p-1 sm:flex"
            style={{ background: "var(--d-bg-elev)", border: "1px solid var(--d-border)" }}
          >
            {VARIANTS.map((v) => (
              <Link
                key={v.slug}
                href={`/design/${v.slug}`}
                className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
                style={
                  v.slug === active
                    ? { background: "var(--d-accent)", color: "var(--d-accent-fg)" }
                    : { color: "var(--d-muted)" }
                }
              >
                {v.label}
              </Link>
            ))}
          </div>

          {/* Theme toggle */}
          <button
            type="button"
            onClick={() => setMode((m) => (m === "light" ? "dark" : "light"))}
            aria-label="Toggle light/dark"
            className="grid size-9 place-items-center rounded-full transition-colors"
            style={{ background: "var(--d-bg-elev)", border: "1px solid var(--d-border)" }}
          >
            {mode === "light" ? <Moon className="size-4" /> : <Sun className="size-4" />}
          </button>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <header className="mx-auto flex max-w-3xl flex-col items-center gap-7 px-6 pb-8 pt-20 text-center sm:pt-28">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium"
          style={{
            background: "var(--d-accent-subtle)",
            color: "var(--d-accent-strong)",
            border: "1px solid var(--d-accent-border)",
          }}
        >
          <Sparkles className="size-3.5" />
          Free · no account needed
        </span>

        <h1
          className="text-5xl leading-[1.04] sm:text-6xl lg:text-7xl"
          style={{
            fontFamily: "var(--d-font-display)",
            fontWeight: "var(--d-display-weight)" as unknown as number,
            letterSpacing: "var(--d-display-tracking)",
          }}
        >
          Find out why your
          <br />
          product isn&apos;t{" "}
          <span style={{ color: "var(--d-accent-strong)" }}>getting found</span>
        </h1>

        <p
          className="max-w-xl text-lg leading-relaxed"
          style={{ color: "var(--d-muted)" }}
        >
          Paste your App Store URL or website and get a Discoverability Score,
          positioning gaps, and a ranked action plan — in about ninety seconds.
        </p>

        {/* Scan input */}
        <div
          className="mt-2 flex w-full max-w-lg items-center gap-2 rounded-2xl p-2"
          style={{
            background: "var(--d-card)",
            border: "1px solid var(--d-border)",
            boxShadow: "var(--d-shadow)",
          }}
        >
          <input
            placeholder="https://your-product.com"
            className="flex-1 bg-transparent px-3 py-2 text-sm outline-none"
            style={{ color: "var(--d-text)" }}
          />
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-transform hover:-translate-y-px"
            style={{ background: "var(--d-accent)", color: "var(--d-accent-fg)" }}
          >
            Scan <ArrowRight className="size-4" />
          </button>
        </div>

        <p className="text-xs" style={{ color: "var(--d-faint)" }}>
          {tagline}
        </p>
      </header>

      {/* ── Proof chips ─────────────────────────────────────────────────── */}
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-2 px-6 pb-16">
        {[
          ["journaling app", 63],
          ["fitness tracker", 77],
          ["invoicing tool", 41],
          ["meditation app", 82],
        ].map(([label, score]) => (
          <span
            key={label}
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs"
            style={{ background: "var(--d-bg-elev)", color: "var(--d-muted)", border: "1px solid var(--d-border)" }}
          >
            <span
              className="size-1.5 rounded-full"
              style={{
                background:
                  (score as number) >= 70 ? "var(--d-good)" : (score as number) >= 50 ? "var(--d-accent)" : "var(--d-warn)",
              }}
            />
            {label} · {score} / 100
          </span>
        ))}
      </div>

      {/* ── Features ────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <h2
          className="mb-10 text-center text-3xl sm:text-4xl"
          style={{
            fontFamily: "var(--d-font-display)",
            fontWeight: "var(--d-display-weight)" as unknown as number,
            letterSpacing: "var(--d-display-tracking)",
          }}
        >
          Everything a solo founder needs
        </h2>
        <div className="grid gap-5 sm:grid-cols-3">
          {[
            { icon: Target, title: "Positioning Mirror", blurb: "Who your page actually targets vs. who you think it does." },
            { icon: Search, title: "Search Gap Analysis", blurb: "The queries your buyers type that you're invisible for." },
            { icon: FileText, title: "Ranked Action Steps", blurb: "Specific fixes, ordered by expected score impact." },
          ].map((f) => (
            <div
              key={f.title}
              className="flex flex-col gap-4 p-6 transition-transform hover:-translate-y-1"
              style={{
                background: "var(--d-card)",
                border: "1px solid var(--d-border)",
                borderRadius: "var(--d-radius-lg)",
                boxShadow: "var(--d-shadow-sm)",
              }}
            >
              <span
                className="grid size-11 place-items-center rounded-xl"
                style={{ background: "var(--d-accent-subtle)", color: "var(--d-accent-strong)" }}
              >
                <f.icon className="size-5" />
              </span>
              <h3 className="text-base font-semibold">{f.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--d-muted)" }}>
                {f.blurb}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── App dashboard preview ───────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <p
          className="mb-3 text-center text-xs font-medium uppercase tracking-widest"
          style={{ color: "var(--d-faint)" }}
        >
          Inside the app
        </p>
        <h2
          className="mb-10 text-center text-3xl sm:text-4xl"
          style={{
            fontFamily: "var(--d-font-display)",
            fontWeight: "var(--d-display-weight)" as unknown as number,
            letterSpacing: "var(--d-display-tracking)",
          }}
        >
          Your weekly distribution cockpit
        </h2>

        <div
          className="overflow-hidden"
          style={{
            background: "var(--d-card)",
            border: "1px solid var(--d-border)",
            borderRadius: "var(--d-radius-lg)",
            boxShadow: "var(--d-shadow)",
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr]">
            {/* Mini sidebar */}
            <aside
              className="hidden flex-col gap-1 p-4 sm:flex"
              style={{ background: "var(--d-bg-elev)", borderRight: "1px solid var(--d-border)" }}
            >
              <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--d-faint)" }}>
                ReachKit
              </p>
              {["Dashboard", "This week's plays", "What you offer", "Who it's for", "Where they are"].map((item, i) => (
                <span
                  key={item}
                  className="rounded-lg px-3 py-2 text-sm"
                  style={
                    i === 0
                      ? { background: "var(--d-accent-subtle)", color: "var(--d-accent-strong)", fontWeight: 600 }
                      : { color: "var(--d-muted)" }
                  }
                >
                  {item}
                </span>
              ))}
            </aside>

            {/* Main */}
            <div className="flex flex-col gap-6 p-6 sm:p-8">
              {/* Score */}
              <div className="flex items-center gap-6">
                <ScoreRing value={63} />
                <div>
                  <p className="text-sm" style={{ color: "var(--d-muted)" }}>
                    Discoverability score
                  </p>
                  <p className="text-3xl font-bold" style={{ fontFamily: "var(--d-font-display)" }}>
                    63<span className="text-lg" style={{ color: "var(--d-faint)" }}>/100</span>
                  </p>
                  <p className="mt-1 inline-flex items-center gap-1 text-xs" style={{ color: "var(--d-good)" }}>
                    ↑ +8 this week
                  </p>
                </div>
              </div>

              {/* Play cards */}
              <div className="flex flex-col gap-3">
                {[
                  { tag: "Quick win", title: "Rewrite your title tag to lead with the core query", min: "15m" },
                  { tag: "Medium", title: "Add an FAQ section targeting 3 long-tail searches", min: "45m" },
                ].map((p) => (
                  <div
                    key={p.title}
                    className="flex items-start justify-between gap-4 p-4 transition-transform hover:-translate-y-0.5"
                    style={{ background: "var(--d-bg-elev)", border: "1px solid var(--d-border)", borderRadius: "var(--d-radius)" }}
                  >
                    <div className="flex flex-col gap-1.5">
                      <span
                        className="w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                        style={{ background: "var(--d-accent-subtle)", color: "var(--d-accent-strong)" }}
                      >
                        {p.tag} · {p.min}
                      </span>
                      <p className="text-sm font-medium">{p.title}</p>
                    </div>
                    <span className="grid size-6 shrink-0 place-items-center rounded-full" style={{ border: "1.5px solid var(--d-border)" }}>
                      <Check className="size-3.5" style={{ color: "var(--d-muted)" }} />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <h2
          className="mb-10 text-center text-3xl sm:text-4xl"
          style={{
            fontFamily: "var(--d-font-display)",
            fontWeight: "var(--d-display-weight)" as unknown as number,
            letterSpacing: "var(--d-display-tracking)",
          }}
        >
          Free to scan. Paid to act.
        </h2>
        <div className="grid gap-5 sm:grid-cols-3">
          {[
            { name: "Free", price: "$0", note: "forever", feats: ["One scan", "Full report", "3 sample actions"], hi: false },
            { name: "Solo", price: "$29", note: "/ month", feats: ["Weekly queue", "Draft copy", "Verification", "Score history"], hi: true },
            { name: "Growth", price: "$99", note: "/ month", feats: ["3 apps", "Deeper tracking", "Priority support"], hi: false },
          ].map((t) => (
            <div
              key={t.name}
              className="flex flex-col gap-5 p-6"
              style={{
                background: t.hi ? "var(--d-accent-subtle)" : "var(--d-card)",
                border: t.hi ? "1.5px solid var(--d-accent)" : "1px solid var(--d-border)",
                borderRadius: "var(--d-radius-lg)",
                boxShadow: t.hi ? "var(--d-shadow)" : "var(--d-shadow-sm)",
              }}
            >
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--d-muted)" }}>{t.name}</p>
                <p className="mt-1 text-4xl font-bold" style={{ fontFamily: "var(--d-font-display)" }}>
                  {t.price}<span className="text-base font-normal" style={{ color: "var(--d-faint)" }}> {t.note}</span>
                </p>
              </div>
              <ul className="flex flex-col gap-2.5 text-sm">
                {t.feats.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="size-4" style={{ color: "var(--d-accent-strong)" }} />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="mt-auto rounded-xl px-4 py-2.5 text-sm font-semibold transition-transform hover:-translate-y-px"
                style={
                  t.hi
                    ? { background: "var(--d-accent)", color: "var(--d-accent-fg)" }
                    : { background: "var(--d-bg-elev)", color: "var(--d-text)", border: "1px solid var(--d-border)" }
                }
              >
                {t.name === "Free" ? "Scan your product" : `Start ${t.name}`}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer
        className="px-6 py-10 text-center text-xs"
        style={{ borderTop: "1px solid var(--d-border)", color: "var(--d-faint)" }}
      >
        Variant: <strong style={{ color: "var(--d-muted)" }}>{name}</strong> · toggle light/dark, top-right · this is a
        design sample, not the live app
      </footer>
    </div>
  );
}

// ── Score ring ──────────────────────────────────────────────────────────────
function ScoreRing({ value }: { value: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - value / 100);
  return (
    <div className="relative size-24 shrink-0">
      <svg viewBox="0 0 80 80" className="size-full -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="var(--d-border)" strokeWidth="7" />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="var(--d-accent)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <span
        className="absolute inset-0 grid place-items-center text-xl font-bold"
        style={{ fontFamily: "var(--d-font-display)" }}
      >
        {value}
      </span>
    </div>
  );
}
