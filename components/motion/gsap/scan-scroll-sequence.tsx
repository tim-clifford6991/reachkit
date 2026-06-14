"use client";

/**
 * ScanScrollSequence — §20.3 set piece 2
 *
 * "Watch a scan happen" — scroll-driven sequence.
 * As the user scrolls through the section, 4 scan stages reveal sequentially,
 * and a DiscoverabilityScore-style counter counts up from 0 to the final score.
 *
 * prefers-reduced-motion → all stages shown immediately, no animation.
 * GSAP lazy-imported on demand; section SSR'd as static HTML with all content
 * visible (no FOUC — CSS default is opacity:1, GSAP overrides only on hydrate).
 *
 * Uses native ScrollTrigger scrub (not Lenis-dependent) for maximum compatibility.
 */

import { useRef, useEffect, useState } from "react";
import { useGsap } from "./use-gsap-ref";

interface ScanStage {
  label: string;
  detail: string;
  icon: string;
}

const SCAN_STAGES: readonly ScanStage[] = [
  {
    label: "Fetching product page",
    detail: "Pulling metadata, screenshots, keyword density",
    icon: "↓",
  },
  {
    label: "Analysing SEO signals",
    detail: "Title, description, backlink profile, structured data",
    icon: "◐",
  },
  {
    label: "Mapping positioning gaps",
    detail: "Comparing against 6 000 competing apps in your category",
    icon: "◑",
  },
  {
    label: "Scoring discoverability",
    detail: "Weighting 18 signals → single number + ranked actions",
    icon: "●",
  },
] as const;

const DEMO_SCORE = 63;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StageRow({
  stage,
  index,
  active,
}: {
  stage: ScanStage;
  index: number;
  active: boolean;
}) {
  return (
    <div
      className="scan-stage flex items-start gap-4"
      data-stage={index}
      style={{ opacity: 1 }} // default visible for SSR / reduced-motion
    >
      {/* Icon indicator */}
      <div
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-sm"
        style={{
          background: active ? "var(--color-accent-subtle)" : "var(--fill-subtle)",
          border: active
            ? "1px solid var(--color-accent-900)"
            : "1px solid var(--hairline)",
          color: active ? "var(--color-accent-400)" : "var(--color-muted)",
          transition: "background 0.3s, color 0.3s, border-color 0.3s",
        }}
        aria-hidden="true"
      >
        {stage.icon}
      </div>

      {/* Text */}
      <div className="flex flex-col gap-0.5">
        <p
          className="text-sm font-medium"
          style={{
            color: active ? "var(--color-fg)" : "var(--color-muted)",
            transition: "color 0.3s",
          }}
        >
          {stage.label}
        </p>
        <p className="text-xs" style={{ color: "var(--color-muted)" }}>
          {stage.detail}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Score display
// ---------------------------------------------------------------------------

function ScoreDisplay({ score }: { score: number }) {
  const progress = score / 100;
  const circumference = 2 * Math.PI * 40;
  const offset = circumference * (1 - progress);

  return (
    <div
      className="score-display flex flex-col items-center gap-3"
      aria-label={`Discoverability score: ${score} out of 100`}
    >
      <div className="relative h-28 w-28">
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full -rotate-90"
          aria-hidden="true"
        >
          {/* Track */}
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="var(--fill-subtle)"
            strokeWidth="6"
          />
          {/* Progress */}
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="var(--color-accent-500)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="score-number font-mono text-3xl font-bold tabular-nums"
            style={{ color: "var(--color-accent-400)" }}
          >
            {score}
          </span>
          <span
            className="font-mono text-[9px] uppercase tracking-wider"
            style={{ color: "var(--color-muted)" }}
          >
            /100
          </span>
        </div>
      </div>
      <p
        className="font-mono text-[10px] uppercase tracking-widest"
        style={{ color: "var(--color-muted)" }}
      >
        Discoverability Score
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ScanScrollSequence() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [activeStage, setActiveStage] = useState(SCAN_STAGES.length - 1);
  const [displayScore, setDisplayScore] = useState(DEMO_SCORE);

  // Check reduced motion preference for initial state
  // Initialise from matchMedia directly — no effect needed for a one-time read
  const [reducedMotion] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useGsap(({ gsap, ScrollTrigger }) => {
    const section = sectionRef.current;
    if (!section) return;

    const stages = section.querySelectorAll<HTMLElement>(".scan-stage");
    const scoreNumber = section.querySelector<HTMLElement>(".score-number");
    const scoreDisplay = section.querySelector<HTMLElement>(".score-display");

    // Start all stages hidden (GSAP overrides SSR default)
    gsap.set(stages, { opacity: 0, x: -16 });
    gsap.set(scoreDisplay, { opacity: 0, scale: 0.9 });
    if (scoreNumber) scoreNumber.textContent = "0";

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: "top 70%",
        end: "bottom 30%",
        scrub: 0.8,
      },
    });

    // Reveal each stage
    stages.forEach((stage, i) => {
      tl.to(
        stage,
        { opacity: 1, x: 0, duration: 0.3, ease: "power2.out" },
        i * 0.25,
      );
      tl.call(() => setActiveStage(i), undefined, i * 0.25 + 0.1);
    });

    // Count up the score
    const scoreProxy = { val: 0 };
    tl.to(
      scoreProxy,
      {
        val: DEMO_SCORE,
        duration: 0.4,
        ease: "power2.out",
        onUpdate: () => {
          const v = Math.round(scoreProxy.val);
          setDisplayScore(v);
          if (scoreNumber) scoreNumber.textContent = String(v);
        },
      },
      0.7,
    );

    // Reveal score circle
    tl.to(scoreDisplay, { opacity: 1, scale: 1, duration: 0.3 }, 0.65);

    return () => {
      ScrollTrigger.getAll().forEach((t) => {
        if (t.trigger === section) t.kill();
      });
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="flex flex-col items-center gap-12 px-(--spacing-content-x) py-(--spacing-section-y)"
      aria-label="How a scan works"
    >
      {/* Header */}
      <div className="flex max-w-lg flex-col items-center gap-3 text-center">
        <p
          className="font-mono text-[10px] uppercase tracking-widest"
          style={{ color: "var(--color-accent-400)" }}
        >
          Watch a scan
        </p>
        <h2
          className="text-2xl font-bold tracking-tight sm:text-3xl"
          style={{ color: "var(--color-fg)", lineHeight: 1.15 }}
        >
          ~90 seconds from URL to clarity
        </h2>
        <p
          className="text-base leading-relaxed"
          style={{ color: "var(--color-muted)" }}
        >
          Paste your App Store link. ReachKit fetches, analyses, scores, and
          ranks 18 discoverability signals — then hands you a prioritised
          action list.
        </p>
      </div>

      {/* Sequence + score */}
      <div className="flex w-full max-w-2xl flex-col items-center gap-12 lg:flex-row lg:items-start lg:gap-16">
        {/* Stages */}
        <div className="flex flex-1 flex-col gap-6">
          {SCAN_STAGES.map((stage, i) => (
            <StageRow
              key={stage.label}
              stage={stage}
              index={i}
              active={reducedMotion ? true : i === activeStage}
            />
          ))}
        </div>

        {/* Score */}
        <div className="flex flex-col items-center gap-4">
          <ScoreDisplay score={reducedMotion ? DEMO_SCORE : displayScore} />
          <p
            className="max-w-[14rem] text-center text-xs leading-relaxed"
            style={{ color: "var(--color-muted)" }}
          >
            A real score from a real scan — not a mock-up. Yours will reflect
            your actual gaps.
          </p>
        </div>
      </div>
    </section>
  );
}
