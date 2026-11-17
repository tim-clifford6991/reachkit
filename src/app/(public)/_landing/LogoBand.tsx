"use client";
// The landing's logo band (SPEC §1 Our own report only): the label paints with
// the page, the slides are read from `/scans/recent` so the static HTML names no
// third party, and the row moves one slide every 5 s until hovered, focused or paused.
import type React from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Pause, Play } from "lucide-react";
import { SiteMark } from "@/ui/SiteMark";
import { LOGO_BAND } from "./sections";

type Slide = { domain: string; company: string };

const EVERY_MS = 5000;
const SKELETONS = Array.from({ length: LOGO_BAND.from }, (_, i) => i);

export function LogoBand(p: { label: string; pause: string; play: string }): React.JSX.Element {
  const row = useRef<HTMLDivElement>(null);
  const [slides, setSlides] = useState<readonly Slide[] | null>(null);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    fetch("/scans/recent")
      .then((r) => (r.ok ? (r.json() as Promise<{ entries: Slide[] }>) : { entries: [] }))
      .then((body) => setSlides(body.entries))
      .catch(() => setSlides([]));
  }, []);

  const shown = slides === null || slides.length >= LOGO_BAND.from;
  useEffect(() => {
    if (slides === null || !shown || paused || hovered || focused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      const el = row.current;
      const first = el?.firstElementChild;
      if (!el || !first) return;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
      const step = first.getBoundingClientRect().width + parseFloat(getComputedStyle(el).columnGap || "0");
      el.scrollTo({ left: atEnd ? 0 : el.scrollLeft + step, behavior: "smooth" });
    }, EVERY_MS);
    return () => window.clearInterval(id);
  }, [slides, shown, paused, hovered, focused]);

  return (
    <section className="pb-12 lg:pb-16">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4">
        <div className="flex items-center justify-center gap-2">
          <p className="text-lg font-bold">{p.label}</p>
          {shown && (
            <button
              type="button"
              className="btn btn-ghost btn-xs min-h-6 min-w-6 motion-reduce:hidden"
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
            tabIndex={0}
            aria-label={p.label}
            className="carousel carousel-center w-full gap-4 py-1"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onFocus={() => setFocused(true)}
            onBlur={(e) => setFocused(e.currentTarget.contains(e.relatedTarget))}
          >
            {slides === null
              ? SKELETONS.map((i) => <div key={i} className="carousel-item skeleton h-14 w-48" />)
              : slides.map((slide) => (
                  <div key={slide.domain} className="carousel-item">
                    <Link href={`/scan/${slide.domain}`} prefetch={false} className="card card-sm bg-base-100 shadow-(--shadow-card)">
                      <span className="card-body flex-row items-center gap-3">
                        <SiteMark domain={slide.domain} hasLogo size={32} />
                        <span className="max-w-40 truncate font-semibold">{slide.company}</span>
                      </span>
                    </Link>
                  </div>
                ))}
          </div>
        )}
      </div>
    </section>
  );
}
