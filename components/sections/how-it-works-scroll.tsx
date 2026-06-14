"use client";

/**
 * HowItWorks — §21.1 section (Almanac).
 *
 * Calm, non-pinned 3-step walkthrough: Scan → Report → Engine. A sticky CSS
 * header on the left, three cards on the right that gently rise into view as
 * they scroll past (Motion `whileInView`, once). NO GSAP pin/scrub — the old
 * scroll-jacked version fought Lenis and felt jerky. This is smooth by default
 * and fully reduced-motion safe (no animation, static cards).
 *
 * Content renders in the initial client paint, so it's in the SSR HTML.
 */

import { useEffect, useRef } from "react";

/**
 * Reveal-on-scroll via a tiny IntersectionObserver (no Motion/GSAP — keeps the
 * marketing first-load lean). Adds [data-shown] to each [data-reveal] child as
 * it enters the viewport; the transition lives in globals.css.
 */
function useRevealOnScroll() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      items.forEach((el) => el.setAttribute("data-shown", ""));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.setAttribute("data-shown", "");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.12 }
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return ref;
}

interface Step {
  number: string;
  eyebrow: string;
  title: string;
  description: string;
  detail: string;
}

const STEPS: readonly Step[] = [
  {
    number: "01",
    eyebrow: "Scan",
    title: "Paste a URL. Get a score in 90 seconds.",
    description:
      "ReachKit fetches your App Store listing or website, extracts every discoverability signal, and runs it through 18 checks.",
    detail:
      "Keyword density · Title optimisation · Screenshot alt text · Metadata completeness · Category fit · Competitor gap · Backlink signal · Structured data · …and 10 more.",
  },
  {
    number: "02",
    eyebrow: "Report",
    title: "Four questions. One clear picture.",
    description:
      "The engine answers: who you're positioned for, what they search, where you're invisible, and what to fix first.",
    detail:
      "Each answer is grounded in evidence extracted directly from your live product page — no hallucinations, no generic advice.",
  },
  {
    number: "03",
    eyebrow: "Engine",
    title: "A weekly queue of ranked actions.",
    description:
      "Paid plans unlock the action engine: a prioritised to-do list that refreshes every week as you ship fixes and the market shifts.",
    detail:
      "Draft copy · Keyword suggestions · Verification on completion · Score delta after each action — so you always know what moved the needle.",
  },
] as const;

function StepCard({ step }: { step: Step }) {
  return (
    <div
      className="flex flex-col gap-4 rounded-2xl border p-8 shadow-[var(--elevation-sm),var(--edge-highlight)]"
      style={{ borderColor: "var(--hairline)", background: "var(--gradient-surface)" }}
    >
      <div className="flex items-center gap-3">
        <span
          className="font-mono text-2xl font-bold tabular-nums"
          style={{ color: "var(--color-accent-400)" }}
        >
          {step.number}
        </span>
        <span
          className="font-mono text-[10px] uppercase tracking-widest"
          style={{ color: "var(--color-muted)" }}
        >
          {step.eyebrow}
        </span>
      </div>

      <h3 className="text-lg font-semibold leading-snug" style={{ color: "var(--color-fg)" }}>
        {step.title}
      </h3>

      <p className="text-sm leading-relaxed" style={{ color: "var(--color-muted)" }}>
        {step.description}
      </p>

      <p
        className="rounded-xl p-3 font-mono text-xs leading-relaxed"
        style={{ background: "var(--fill-subtle)", color: "var(--color-muted)" }}
      >
        {step.detail}
      </p>
    </div>
  );
}

export function HowItWorksScroll() {
  const ref = useRevealOnScroll();

  return (
    <section
      className="px-(--spacing-content-x) py-(--spacing-section-y)"
      aria-label="How it works"
    >
      <div
        ref={ref}
        className="mx-auto grid w-full max-w-[var(--spacing-content-max)] grid-cols-1 gap-16 lg:grid-cols-[20rem_1fr] lg:gap-20"
      >
        {/* Left: sticky header (pure CSS — no scroll-jacking) */}
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHeader />
        </div>

        {/* Right: gently revealing step cards */}
        <div className="flex flex-col gap-5">
          {STEPS.map((step, i) => (
            <div key={step.number} data-reveal style={{ transitionDelay: `${i * 80}ms` }}>
              <StepCard step={step} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SectionHeader() {
  return (
    <div className="flex flex-col gap-3">
      <p
        className="font-mono text-[10px] uppercase tracking-widest"
        style={{ color: "var(--color-accent-400)" }}
      >
        How it works
      </p>
      <h2 className="text-3xl sm:text-4xl" style={{ color: "var(--color-fg)", lineHeight: 1.1 }}>
        Scan. Report. Engine.
      </h2>
      <p className="text-base leading-relaxed" style={{ color: "var(--color-muted)" }}>
        Three modules. One flywheel. From URL to a weekly action list.
      </p>
    </div>
  );
}
