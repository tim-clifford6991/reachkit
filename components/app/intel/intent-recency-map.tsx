"use client";

/**
 * IntentRecencyMap — "where they hang out": a canvas dot-plot of buyer
 * threads, x = buyer intent (0 → 1, low ← → high), y = a gentle vertical
 * jitter (a horizontal beeswarm) purely to separate overlapping dots,
 * colour = surface (stable hash → palette), a ring marks high-intent
 * (>= .8) threads. Clicking a dot opens that thread in the EvidenceDrawer.
 *
 * Intent is the primary, meaningful axis: it's the one signal we reliably
 * have for every thread (LLM-scored 0–1). Thread `publishedAt` (recency) is
 * NOT plotted — Reddit 403s server-side and DataForSEO SERP returns no
 * timestamps for the vast majority of the Reddit-scoped demand set, so a
 * recency axis piles almost every dot into one degenerate column. Where a
 * thread DOES carry a date (rare — HN), it still surfaces in the evidence
 * drawer on click, just not on the map.
 *
 * Canvas only (no chart lib, bundle budget) — a plain <canvas> sized to its
 * container, devicePixelRatio-aware, redrawn on resize AND on light/dark
 * theme flips (a MutationObserver on <html data-theme>, since fill colours
 * are read from getComputedStyle at draw time, not hard-coded). Axis
 * captions + the surface legend are DOM chrome around the canvas (tokens
 * only, per repo convention) — the canvas itself only draws gridlines +
 * dots so hit-testing stays a simple 2D distance check.
 */
import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Pocket } from "@/components/app/intel/demand-view";
import { useEvidenceDrawer } from "@/components/app/intel/evidence-drawer";

type Thread = Pocket["topThreads"][number] & { surface: string };

const PAD = 28; // px inside the canvas reserved for gridline margins
const DOT_R = 4;
const HIGH_INTENT_R = 6;
const HIGH_INTENT_THRESHOLD = 0.8;
const HIT_R = 11; // click hit-test radius in CSS px
const BIN_PX = 9; // beeswarm collision-bin width (CSS px) along the intent axis
const JITTER_STEP = DOT_R * 2 + 3; // vertical spacing between stacked dots in the same bin

// Stable surface → colour palette. Matches the intel kit's Badge tone fg
// colours (already tuned readable in both themes) so surfaces read as the
// same "tone family" the rest of the app uses for tags.
const PALETTE = ["#6E56F7", "#1f9d5b", "#e0731c", "#3b6fe0", "#c98a12", "#e5484d", "#57536A"];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function colourFor(surface: string): string {
  const fallback = PALETTE[PALETTE.length - 1] ?? "#57536A";
  if (!surface) return fallback;
  return PALETTE[hashStr(surface) % PALETTE.length] ?? fallback;
}

interface Plotted {
  x: number; // CSS px
  y: number; // CSS px
  r: number;
  high: boolean;
  colour: string;
  thread: Thread;
}

function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export function IntentRecencyMap({ pockets }: { pockets: Pocket[] }): React.JSX.Element {
  const { open } = useEvidenceDrawer();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const plottedRef = useRef<Plotted[]>([]);
  const [themeTick, setThemeTick] = useState(0);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const threads = useMemo<Thread[]>(
    () => pockets.flatMap((p) => p.topThreads.map((t) => ({ ...t, surface: p.surface }))),
    [pockets],
  );

  const surfaces = useMemo(() => {
    const set = new Set<string>();
    threads.forEach((t) => t.surface && set.add(t.surface));
    return Array.from(set);
  }, [threads]);

  // Resize observer — keeps the canvas sized to its container.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box) setSize({ w: box.width, h: Math.max(220, Math.min(320, box.width * 0.42)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Theme-change observer — repaints when data-theme flips (light/dark
  // tokens resolve to different hex/oklch values read at draw time).
  useEffect(() => {
    const mo = new MutationObserver(() => setThemeTick((n) => n + 1));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
    return () => mo.disconnect();
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.w <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(size.w * dpr);
    canvas.height = Math.round(size.h * dpr);
    canvas.style.width = `${size.w}px`;
    canvas.style.height = `${size.h}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);

    const line = cssVar("--c-line", "#ECEAF3");
    const surface = cssVar("--c-surface", "#FFFFFF");

    const plotW = Math.max(1, size.w - PAD * 2);
    const plotH = Math.max(1, size.h - PAD * 2);
    const centerY = PAD + plotH / 2;

    // Gridlines — vertical only (0 / .25 / .5 / .75 / 1 intent columns) plus
    // a faint centre baseline. There is no meaningful y-axis to grid against
    // (y is jitter, not data), so horizontal bands would be misleading.
    ctx.strokeStyle = line;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const x = PAD + (plotW * i) / 4;
      ctx.beginPath();
      ctx.moveTo(x, PAD);
      ctx.lineTo(x, PAD + plotH);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(PAD, centerY);
    ctx.lineTo(PAD + plotW, centerY);
    ctx.stroke();

    // Beeswarm: bucket threads by their intent x-position, then stack dots
    // in each bucket alternating above/below centre so overlapping intent
    // scores fan out instead of piling on top of each other.
    const bins = new Map<number, number>(); // bin index -> dots placed so far
    const plotted: Plotted[] = threads.map((t) => {
      const intent = typeof t.intent === "number" ? Math.max(0, Math.min(1, t.intent)) : 0.4;
      const x = PAD + intent * plotW;
      const high = typeof t.intent === "number" && t.intent >= HIGH_INTENT_THRESHOLD;
      const bin = Math.round(x / BIN_PX);
      const seq = bins.get(bin) ?? 0;
      bins.set(bin, seq + 1);
      // 0, +1, -1, +2, -2, ... spreads a bin's dots symmetrically around centre
      const side = seq % 2 === 0 ? 1 : -1;
      const rank = Math.ceil(seq / 2);
      const offset = side * rank * JITTER_STEP;
      const y = Math.max(PAD + DOT_R, Math.min(PAD + plotH - DOT_R, centerY + offset));
      return { x, y, r: high ? HIGH_INTENT_R : DOT_R, high, colour: colourFor(t.surface), thread: t };
    });
    plottedRef.current = plotted;

    for (const p of plotted) {
      if (p.high) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r + 3, 0, Math.PI * 2);
        ctx.strokeStyle = p.colour;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.colour;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = surface;
      ctx.stroke();
    }
  }, [size, threads]);

  useEffect(() => { draw(); }, [draw, themeTick]);

  const nearestHit = useCallback((clientX: number, clientY: number): Plotted | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    let best: Plotted | null = null;
    let bestDist = HIT_R;
    for (const p of plottedRef.current) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d <= bestDist) { bestDist = d; best = p; }
    }
    return best;
  }, []);

  const onClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const hit = nearestHit(e.clientX, e.clientY);
    if (!hit) return;
    const t = hit.thread;
    open({ kind: "thread", title: t.title, url: t.url, surface: t.surface, theme: t.theme, publishedAt: t.publishedAt, intent: t.intent, activity: t.activity });
  }, [nearestHit, open]);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.style.cursor = nearestHit(e.clientX, e.clientY) ? "pointer" : "default";
  }, [nearestHit]);

  if (threads.length === 0) {
    return <div style={{ fontSize: 13, color: "var(--c-faint)", padding: "24px 0", textAlign: "center" }}>No community threads surfaced yet.</div>;
  }

  return (
    <div>
      <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
        <canvas
          ref={canvasRef}
          onClick={onClick}
          onMouseMove={onMouseMove}
          role="img"
          aria-label="Beeswarm plot of buyer threads by buyer intent; use the list below for keyboard access to each thread."
          style={{ display: "block", width: "100%" }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--c-faint)", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        <span>lower intent</span>
        <span>higher intent →</span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginTop: 10 }}>
        {surfaces.map((s) => (
          <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--c-muted)" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: colourFor(s), flexShrink: 0 }} />
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
