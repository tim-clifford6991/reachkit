"use client";
// The landing's logo band (SPEC §1 Our own report only): the label paints with
// the page, the slides are read from `/scans/recent` so the static HTML names no
// third party, and the row drifts on until paused, slows on hover and stops on focus.
import type React from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Pause, Play } from "lucide-react";
import { SiteMark } from "@/ui/SiteMark";
import { LOGO_BAND } from "./sections";

type Slide = { domain: string; company: string };

const SKELETONS = Array.from({ length: LOGO_BAND.from }, (_, i) => i);

export function LogoBand(p: { label: string; pause: string; play: string }): React.JSX.Element {
  const row = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [slides, setSlides] = useState<readonly Slide[] | null>(null);
  const [paused, setPaused] = useState(false);
  // The CSS loop itself, driven through the browser's own Web Animations calls so a speed change never jumps; none under reduced motion.
  const loop = (): Animation | undefined => track.current?.getAnimations()[0];

  useEffect(() => {
    fetch("/scans/recent", { signal: AbortSignal.timeout(LOGO_BAND.wait) })
      .then((r) => (r.ok ? (r.json() as Promise<{ entries: Slide[] }>) : { entries: [] }))
      .then((body) => setSlides(body.entries))
      .catch(() => setSlides([]));
  }, []);

  useEffect(() => {
    if (paused) loop()?.pause();
    else if (!row.current?.contains(document.activeElement)) loop()?.play();
  }, [paused, slides]);

  const focus = (e: React.FocusEvent<HTMLDivElement>): void => {
    const a = loop();
    const lap = (track.current?.offsetWidth ?? 0) / 2;
    if (!a || !row.current || !lap) return;
    a.pause();
    const box = row.current.getBoundingClientRect();
    const r = e.target.getBoundingClientRect();
    const shift = r.left < box.left + 4 ? box.left + 4 - r.left : r.right > box.right - 4 ? box.right - 4 - r.right : 0;
    // Move the stopped loop until the focused logo is wholly in view: the browser cannot scroll back to a box translated off the left edge.
    if (shift) a.currentTime = Number(a.currentTime) - (shift / lap) * Number(a.effect?.getComputedTiming().duration);
  };

  const shown = slides === null || slides.length >= LOGO_BAND.from;
  // Without scripts no list will come, so the skeletons and Pause give way to the label alone.
  const noScript = slides === null ? "[@media(scripting:none)]:hidden" : "";

  return (
    <section className="pb-12 lg:pb-16">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4">
        <div className="flex items-center justify-center gap-2">
          <p className="text-lg font-bold">{p.label}</p>
          {shown && (
            <button
              type="button"
              className={`btn btn-ghost btn-xs min-h-6 min-w-6 motion-reduce:hidden ${noScript}`}
              aria-label={paused ? p.play : p.pause}
              onClick={() => setPaused(!paused)}
            >
              {paused ? <Play size={16} strokeWidth={1.75} aria-hidden /> : <Pause size={16} strokeWidth={1.75} aria-hidden />}
            </button>
          )}
        </div>
        {shown && (
          <div
            ref={row}
            role="region"
            aria-label={p.label}
            className={`carousel w-full py-1 motion-safe:overflow-hidden ${noScript}`}
            onMouseEnter={() => loop()?.updatePlaybackRate(0.25)}
            onMouseLeave={() => loop()?.updatePlaybackRate(1)}
            onFocus={focus}
            onBlur={(e) => {
              if (!paused && !e.currentTarget.contains(e.relatedTarget)) loop()?.play();
            }}
          >
            <div
              ref={track}
              className={`flex w-max flex-none gap-4 ${slides ? "motion-safe:animate-logos motion-safe:pr-4" : ""}`}
              style={slides ? { animationDuration: `${slides.length * 5}s` } : undefined}
            >
              {slides === null
                ? SKELETONS.map((i) => <div key={i} className="carousel-item skeleton h-20 w-32" />)
                : [...slides, ...slides].map((slide, i) => (
                    <div
                      key={i}
                      inert={i >= slides.length}
                      className={`carousel-item h-20 w-32 ${i >= slides.length ? "motion-reduce:hidden" : ""}`}
                    >
                      <Link
                        href={`/scan/${slide.domain}`}
                        prefetch={false}
                        className="card card-sm bg-base-100 shadow-(--shadow-card) size-full items-center justify-center"
                      >
                        <SiteMark domain={slide.domain} hasLogo size={48} />
                        <span className="sr-only">{slide.company}</span>
                      </Link>
                    </div>
                  ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
