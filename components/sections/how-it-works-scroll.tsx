"use client";

/**
 * HowItWorksScroll — §20.3 set piece 3 (§21.1 section)
 *
 * Pinned scroll-through of the 3 modules: Scan → Report → Engine.
 * ScrollTrigger pin keeps the left panel fixed while the right content
 * steps through each module as the user scrolls.
 *
 * SSR: all three steps are in the HTML (accessible, indexable). GSAP enhances
 * on hydrate. prefers-reduced-motion → shows all steps stacked, no pin/scroll.
 *
 * GSAP/ScrollTrigger is lazy-imported via useGsap — never in the initial chunk.
 */

import { useRef, useState, useEffect } from "react";
import { useGsap } from "@/components/motion/gsap/use-gsap-ref";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Step {
  number: string;
  eyebrow: string;
  title: string;
  description: string;
  detail: string;
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Step card (static content — renders server-side)
// ---------------------------------------------------------------------------

function StepCard({ step, active }: { step: Step; active: boolean }) {
  return (
    <div
      className="how-step flex flex-col gap-4 rounded-xl border p-6 transition-all duration-300"
      data-step-card
      style={{
        borderColor: active ? "var(--color-accent-900)" : "oklch(1 0 0 / 0.08)",
        background: active ? "oklch(0.60 0.18 255 / 0.04)" : "var(--color-surface)",
      }}
    >
      {/* Number + eyebrow */}
      <div className="flex items-center gap-3">
        <span
          className="font-mono text-2xl font-bold tabular-nums"
          style={{ color: "var(--color-accent-900)" }}
        >
          {step.number}
        </span>
        <span
          className="font-mono text-[10px] uppercase tracking-widest"
          style={{ color: active ? "var(--color-accent-400)" : "var(--color-muted)" }}
        >
          {step.eyebrow}
        </span>
      </div>

      {/* Title */}
      <h3
        className="text-lg font-bold leading-snug"
        style={{ color: "var(--color-fg)" }}
      >
        {step.title}
      </h3>

      {/* Description */}
      <p className="text-sm leading-relaxed" style={{ color: "var(--color-muted)" }}>
        {step.description}
      </p>

      {/* Detail — mono, evidence-style */}
      <p
        className="rounded-lg border p-3 font-mono text-xs leading-relaxed"
        style={{
          borderColor: "oklch(1 0 0 / 0.06)",
          background: "oklch(1 0 0 / 0.02)",
          color: "var(--color-muted)",
        }}
      >
        {step.detail}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------

export function HowItWorksScroll() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [activeStep, setActiveStep] = useState(0);
  // Initialise from matchMedia directly — no effect needed for a one-time read
  const [reducedMotion] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useGsap(({ gsap, ScrollTrigger }) => {
    const section = sectionRef.current;
    if (!section) return;

    const stepCards = section.querySelectorAll<HTMLElement>("[data-step-card]");
    const leftPanel = section.querySelector<HTMLElement>("[data-panel-left]");

    if (!leftPanel || stepCards.length === 0) return;

    // Create a timeline that scrubs through the 3 steps
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: "top top",
        end: `+=${window.innerHeight * 2}`,
        pin: true,
        scrub: 0.6,
        anticipatePin: 1,
      },
    });

    // Step 1 → active on enter (already active by default)
    // Step 2 → reveal at 33% scroll
    tl.call(() => setActiveStep(1), undefined, 0.33);
    // Step 3 → reveal at 66% scroll
    tl.call(() => setActiveStep(2), undefined, 0.66);

    // Animate step cards: inactive ones fade slightly
    stepCards.forEach((card, i) => {
      tl.to(
        card,
        {
          opacity: i <= 0 ? 1 : 0.4,
          duration: 0.01,
        },
        0,
      );
    });

    // Dummy progress value to drive scrub callbacks
    const proxy = { val: 0 };
    tl.to(proxy, {
      val: 1,
      duration: 1,
      onUpdate() {
        const v = proxy.val;
        if (v < 0.33) {
          setActiveStep(0);
          stepCards.forEach((c, i) => {
            (c as HTMLElement).style.opacity = i === 0 ? "1" : "0.4";
          });
        } else if (v < 0.66) {
          setActiveStep(1);
          stepCards.forEach((c, i) => {
            (c as HTMLElement).style.opacity = i === 1 ? "1" : "0.4";
          });
        } else {
          setActiveStep(2);
          stepCards.forEach((c, i) => {
            (c as HTMLElement).style.opacity = i === 2 ? "1" : "0.4";
          });
        }
      },
    });

    return () => {
      ScrollTrigger.getAll().forEach((t) => {
        if (t.trigger === section) t.kill();
      });
    };
  }, []);

  if (reducedMotion) {
    // Reduced motion: static stacked layout
    return (
      <section
        className="flex flex-col items-center gap-12 px-[--spacing-content-x] py-[--spacing-section-y]"
        aria-label="How it works"
      >
        <SectionHeader />
        <div className="flex w-full max-w-2xl flex-col gap-6">
          {STEPS.map((step) => (
            <StepCard key={step.number} step={step} active />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section
      ref={sectionRef}
      className="flex flex-col items-center gap-0 px-[--spacing-content-x]"
      aria-label="How it works"
      style={{ overflow: "hidden" }}
    >
      <div
        className="flex w-full max-w-[var(--spacing-content-max)] flex-col gap-12 py-[--spacing-section-y] lg:flex-row lg:items-start lg:gap-20"
      >
        {/* Left panel: fixed heading + step indicator */}
        <div
          data-panel-left
          className="flex-shrink-0 lg:sticky lg:top-24 lg:w-64 lg:self-start"
        >
          <SectionHeader />
          {/* Step indicator dots */}
          <div className="mt-8 hidden flex-col gap-3 lg:flex" aria-hidden="true">
            {STEPS.map((step, i) => (
              <div key={step.number} className="flex items-center gap-3">
                <div
                  className="h-2 w-2 rounded-full transition-all duration-300"
                  style={{
                    background:
                      i === activeStep
                        ? "var(--color-accent-500)"
                        : "oklch(1 0 0 / 0.12)",
                    transform: i === activeStep ? "scale(1.5)" : "scale(1)",
                  }}
                />
                <span
                  className="font-mono text-[10px] uppercase tracking-widest transition-colors duration-300"
                  style={{
                    color:
                      i === activeStep
                        ? "var(--color-accent-400)"
                        : "var(--color-muted)",
                  }}
                >
                  {step.eyebrow}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel: step cards */}
        <div className="flex flex-1 flex-col gap-5">
          {STEPS.map((step, i) => (
            <StepCard key={step.number} step={step} active={i === activeStep} />
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
      <h2
        className="text-2xl font-bold tracking-tight sm:text-3xl"
        style={{ color: "var(--color-fg)", lineHeight: 1.15 }}
      >
        Scan. Report. Engine.
      </h2>
      <p className="text-sm leading-relaxed" style={{ color: "var(--color-muted)" }}>
        Three modules. One flywheel. From URL to weekly action list.
      </p>
    </div>
  );
}
