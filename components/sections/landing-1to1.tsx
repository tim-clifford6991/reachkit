/**
 * Landing sections rebuilt 1:1 to the Claude Design mockup (ReachKit.dc.html).
 * Static, server-rendered, token-driven. These replace the richer GSAP/bento
 * set-pieces on the homepage so the page matches the mockup exactly.
 */

import Link from "next/link";

const SECTION = "px-(--spacing-content-x)";

// ── 1. Problem beat ─────────────────────────────────────────────────────────
export function ProblemBeat() {
  return (
    <section className={`${SECTION} py-20 text-center`} aria-label="The problem">
      <div className="mx-auto max-w-2xl">
        <h2 className="text-3xl font-bold tracking-[var(--tracking-display)] sm:text-4xl" style={{ color: "var(--color-fg)" }}>
          You shipped a great product.{" "}
          <span style={{ color: "var(--color-muted)" }}>Nobody can find it.</span>
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed" style={{ color: "var(--color-muted)" }}>
          You poured months into your page. An SEO suite throws 200 metrics at you. ChatGPT
          makes things up. You just want to know: where am I invisible, and what do I fix first?
        </p>
      </div>
    </section>
  );
}

// ── 2. How it works (3 numbered cards) ──────────────────────────────────────
const STEPS = [
  {
    n: "01",
    title: "We read your live page",
    body: "Deterministic extraction of your live page — title, headings, schema, content. Fed to the model as evidence. No guessing.",
  },
  {
    n: "02",
    title: "We score 18 signals",
    body: "One Discoverability Score across Content, Outreach and SEO — each signal with a plain-English reason and exactly what moves it.",
  },
  {
    n: "03",
    title: "You ship & we verify",
    body: "A weekly queue ranked by impact. Mark a fix done and we re-fetch your page to confirm it before the score moves.",
  },
] as const;

export function HowItWorks() {
  return (
    <section className={`${SECTION} py-12`} aria-label="How it works">
      <div className="mx-auto grid max-w-5xl gap-5 sm:grid-cols-3">
        {STEPS.map((s) => (
          <div
            key={s.n}
            className="flex flex-col gap-3 rounded-2xl border p-6"
            style={{ borderColor: "var(--hairline)", background: "var(--color-surface)", boxShadow: "var(--elevation-sm)" }}
          >
            <span
              className="grid size-9 place-items-center rounded-lg font-mono text-xs font-bold"
              style={{ background: "var(--color-accent-subtle)", color: "var(--color-accent-400)" }}
            >
              {s.n}
            </span>
            <h3 className="text-base font-semibold" style={{ color: "var(--color-fg)" }}>
              {s.title}
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: "var(--color-muted)" }}>
              {s.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── 3. Verified action engine (dark band) ───────────────────────────────────
const QUEUE = [
  { title: "Add FAQ schema to pricing", state: "verified +4", tone: "done" },
  { title: "Claim G2 + Capterra listings", state: "verifying…", tone: "verifying" },
  { title: "Publish 3 comparison pages", state: "predicted +6", tone: "pending" },
] as const;

export function VerifiedActionEngine() {
  return (
    <section className={`${SECTION} py-8`} aria-label="The verified action engine">
      <div
        className="mx-auto max-w-5xl overflow-hidden rounded-3xl px-8 py-12 sm:px-12"
        style={{ background: "oklch(0.17 0.012 288)" }}
      >
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--color-accent-400)" }}>
              The verified action engine
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-[var(--tracking-display)]" style={{ color: "oklch(1 0 0)" }}>
              It doesn&apos;t just tell you. It checks your work.
            </h2>
            <ul className="mt-6 space-y-3">
              {[
                "Every fix ships with draft copy you can paste.",
                "Mark it done — we re-fetch your live page to confirm.",
                "Your score only moves on verified evidence.",
              ].map((b) => (
                <li key={b} className="flex items-start gap-3 text-sm" style={{ color: "oklch(0.85 0.01 290)" }}>
                  <span
                    className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full"
                    style={{ background: "var(--color-success-subtle)", color: "var(--color-success)" }}
                  >
                    ✓
                  </span>
                  {b}
                </li>
              ))}
            </ul>
          </div>

          {/* This week's queue mock */}
          <div
            className="rounded-2xl border p-5"
            style={{ background: "oklch(0.21 0.012 288)", borderColor: "oklch(1 0 0 / 0.08)" }}
          >
            <p className="mb-4 font-mono text-[10px] uppercase tracking-widest" style={{ color: "oklch(0.65 0.01 290)" }}>
              This week&apos;s queue
            </p>
            <div className="space-y-2.5">
              {QUEUE.map((q) => (
                <div
                  key={q.title}
                  className="flex items-center justify-between gap-3 rounded-xl px-3.5 py-3"
                  style={{ background: "oklch(0.25 0.012 288)" }}
                >
                  <span className="text-sm" style={{ color: "oklch(0.92 0.01 290)" }}>
                    {q.title}
                  </span>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold"
                    style={
                      q.tone === "done"
                        ? { background: "var(--color-success-subtle)", color: "var(--color-success)" }
                        : q.tone === "verifying"
                          ? { background: "var(--color-warning-subtle)", color: "var(--color-warning)" }
                          : { background: "var(--color-accent-subtle)", color: "var(--color-accent-400)" }
                    }
                  >
                    {q.state}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── 4. The honest comparison ────────────────────────────────────────────────
const COMPARE_ROWS = [
  { label: "Reads your live page", rk: "Yes", gpt: "Sometimes", suite: "Crawl only" },
  { label: "One clear score", rk: "Yes", gpt: "No", suite: "200 metrics" },
  { label: "Ranked, drafted fixes", rk: "Yes", gpt: "Generic", suite: "You dig" },
  { label: "Verifies the fix shipped", rk: "Yes", gpt: "No", suite: "No" },
  { label: "Built for one founder", rk: "Yes", gpt: "No", suite: "For agencies" },
] as const;

export function HonestComparison() {
  return (
    <section className={`${SECTION} py-16`} aria-label="The honest comparison">
      <div className="mx-auto max-w-4xl">
        <p className="text-center font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--color-accent-400)" }}>
          Why switch
        </p>
        <h2 className="mt-3 text-center text-3xl font-bold tracking-[var(--tracking-display)] sm:text-4xl" style={{ color: "var(--color-fg)" }}>
          The honest comparison
        </h2>

        <div
          className="mt-10 overflow-hidden rounded-2xl border"
          style={{ borderColor: "var(--hairline)", background: "var(--color-surface)" }}
        >
          {/* Header */}
          <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr] items-center gap-2 px-5 py-3" style={{ background: "var(--color-elevated)" }}>
            <span />
            <span className="rounded-md py-1 text-center text-xs font-semibold" style={{ background: "var(--color-accent-subtle)", color: "var(--color-accent-400)" }}>
              ReachKit
            </span>
            <span className="text-center text-xs" style={{ color: "var(--color-muted)" }}>A ChatGPT prompt</span>
            <span className="text-center text-xs" style={{ color: "var(--color-muted)" }}>An SEO suite</span>
          </div>
          {/* Rows */}
          {COMPARE_ROWS.map((r, i) => (
            <div
              key={r.label}
              className="grid grid-cols-[1.6fr_1fr_1fr_1fr] items-center gap-2 px-5 py-3.5 text-sm"
              style={{ borderTop: i === 0 ? "none" : "1px solid var(--hairline)" }}
            >
              <span style={{ color: "var(--color-fg)" }}>{r.label}</span>
              <span className="text-center font-semibold" style={{ color: "var(--color-success)" }}>{r.rk}</span>
              <span className="text-center" style={{ color: "var(--color-muted)" }}>{r.gpt}</span>
              <span className="text-center" style={{ color: "var(--color-muted)" }}>{r.suite}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── 5. Testimonials ─────────────────────────────────────────────────────────
const QUOTES = [
  { q: "I'd been guessing for a year. ReachKit gave me a ranked list in 90 seconds — and I'd shipped the first three by Friday.", name: "Mara K.", role: "indie SaaS", tint: "oklch(0.90 0.06 290)", fg: "var(--color-accent-400)" },
  { q: "The verification is the whole thing. It re-checked my page and told me my schema was malformed. No other tool caught that.", name: "Devon T.", role: "dev tools", tint: "oklch(0.90 0.06 60)", fg: "oklch(0.55 0.13 55)" },
  { q: "One number, the whole roadmap rides around. I share my score card every Friday — it's become my accountability ritual.", name: "Avi R.", role: "fintech", tint: "oklch(0.90 0.07 150)", fg: "var(--color-success)" },
] as const;

export function Testimonials() {
  return (
    <section className={`${SECTION} py-12`} aria-label="What founders say">
      <div className="mx-auto grid max-w-5xl gap-5 sm:grid-cols-3">
        {QUOTES.map((t) => (
          <figure
            key={t.name}
            className="flex flex-col gap-5 rounded-2xl border p-6"
            style={{ borderColor: "var(--hairline)", background: "var(--color-surface)", boxShadow: "var(--elevation-sm)" }}
          >
            <blockquote className="text-sm leading-relaxed" style={{ color: "var(--color-fg)" }}>
              “{t.q}”
            </blockquote>
            <figcaption className="mt-auto flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-full font-mono text-xs font-bold" style={{ background: t.tint, color: t.fg }}>
                {t.name.charAt(0)}
              </span>
              <span className="text-sm">
                <span className="font-semibold" style={{ color: "var(--color-fg)" }}>{t.name}</span>
                <span style={{ color: "var(--color-muted)" }}> · {t.role}</span>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

// ── 6. Built for you (audience cards) ───────────────────────────────────────
const AUDIENCE = [
  { title: "Indie hackers", body: "Ship → free scan → know exactly what to fix next. No agency, no retainer." },
  { title: "Solo SaaS founders", body: "One product, one score, one weekly queue. Distribution without a marketing hire." },
  { title: "Bootstrappers", body: "Every dollar counts. Skip the $400/mo SEO suite for the one number that matters." },
  { title: "AI-native builders", body: "You built fast. Now get found fast — grounded in your real page, not vibes." },
] as const;

export function AudienceCards() {
  return (
    <section className={`${SECTION} py-16`} aria-label="Built for you">
      <div className="mx-auto max-w-5xl">
        <p className="text-center font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--color-accent-400)" }}>
          Built for you
        </p>
        <h2 className="mt-3 text-center text-3xl font-bold tracking-[var(--tracking-display)] sm:text-4xl" style={{ color: "var(--color-fg)" }}>
          For founders who&apos;d rather ship than study SEO
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {AUDIENCE.map((a) => (
            <div
              key={a.title}
              className="flex flex-col gap-2.5 rounded-2xl border p-6"
              style={{ borderColor: "var(--hairline)", background: "var(--color-surface)" }}
            >
              <h3 className="text-base font-semibold" style={{ color: "var(--color-fg)" }}>{a.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--color-muted)" }}>{a.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── 7. Shareable score-card band ────────────────────────────────────────────
export function ScoreCardBand() {
  return (
    <section className={`${SECTION} py-16`} aria-label="Share your score">
      <div
        className="relative mx-auto flex max-w-5xl flex-col items-center gap-8 overflow-hidden rounded-3xl px-8 py-14 text-center lg:flex-row lg:justify-between lg:text-left"
        style={{ background: "radial-gradient(700px 300px at 80% 0%, oklch(0.62 0.20 288), oklch(0.50 0.20 285))" }}
      >
        <div className="max-w-md">
          <h2 className="text-3xl font-bold tracking-[var(--tracking-display)]" style={{ color: "oklch(1 0 0)" }}>
            A score worth sharing.
          </h2>
          <p className="mt-3 text-base leading-relaxed" style={{ color: "oklch(1 0 0 / 0.8)" }}>
            Post your Discoverability Score. Every share is a tiny billboard — and how the next
            founder finds the gap in their own listing.
          </p>
        </div>
        {/* Dark mini score card */}
        <div
          className="w-full max-w-xs rounded-2xl p-6 text-left"
          style={{ background: "oklch(0.17 0.012 288)", boxShadow: "0 24px 60px -22px oklch(0.20 0.08 285 / 0.6)" }}
        >
          <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "oklch(0.65 0.01 290)" }}>
            Discoverability
          </p>
          <p className="mt-1 font-mono tabular-nums" style={{ fontSize: "2.75rem", lineHeight: 1, color: "oklch(1 0 0)" }}>
            47
          </p>
          <span className="mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: "oklch(0.65 0.17 47 / 0.2)", color: "oklch(0.78 0.15 50)" }}>
            Hard to find
          </span>
          <p className="mt-3 text-xs" style={{ color: "oklch(0.7 0.01 290)" }}>
            bloom.io · top fix: ship comparison pages
          </p>
        </div>
      </div>
    </section>
  );
}

// ── 8. Final CTA ────────────────────────────────────────────────────────────
export function FinalCtaBand() {
  return (
    <section className={`${SECTION} pb-24 pt-8 text-center`} aria-label="Get started">
      <div className="mx-auto max-w-2xl">
        <h2 className="text-3xl font-bold tracking-[var(--tracking-display)] sm:text-4xl" style={{ color: "var(--color-fg)" }}>
          Find out how findable you are.
        </h2>
        <p className="mx-auto mt-4 max-w-md text-lg" style={{ color: "var(--color-muted)" }}>
          One scan. 90 seconds. No login. See your score and the 7 fixes that move it.
        </p>
        <Link
          href="/scan"
          className="mt-7 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-transform hover:-translate-y-px"
          style={{ background: "var(--gradient-accent)", color: "var(--color-accent-fg)", boxShadow: "var(--elevation-glow)" }}
        >
          Analyze my site →
        </Link>
      </div>
    </section>
  );
}
