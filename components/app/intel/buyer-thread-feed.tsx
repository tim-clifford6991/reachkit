"use client";

/**
 * BuyerThreadFeed — the complete, filterable, keyboard-accessible feed of
 * buyer threads: every thread `IntentRecencyMap` plots as a dot, this feed
 * lists as a real row (title is a focusable button, not just a canvas point)
 * so the map's own honesty note holds — "use the list below for keyboard
 * access to each thread." Each row opens the same EvidenceDrawer subject the
 * map does, so clicking a dot or a row lands on identical evidence.
 *
 * Filter chips are a plain local `useState<Filter>` (no URL/query-param
 * sync — this is a page-local view control, not a shareable state) with a
 * live "N shown" count that updates as filters change. Engagement
 * (`▲score · N comments`) renders ONLY when `activity` is present on a
 * thread — never a fabricated "0" or em-dash placeholder (same honesty
 * rule as EvidenceDrawer's ThreadEvidence branch).
 */
import * as React from "react";
import { useMemo, useState } from "react";
import type { Pocket } from "@/components/app/intel/demand-view";
import { relativeDate } from "@/components/app/intel/demand-view";
import { useEvidenceDrawer } from "@/components/app/intel/evidence-drawer";
import { Badge, EvidenceLink } from "@/components/app/intel/kit";

type Thread = Pocket["topThreads"][number] & { surface: string };

const HIGH_INTENT_THRESHOLD = 0.8;
const LAST_30D_MS = 30 * 86_400_000;

type Filter = "all" | "high-intent" | "recent";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "high-intent", label: "🔥 High intent" },
  { key: "recent", label: "Last 30 days" },
];

// Stable surface → colour, matching the intel kit's Badge tone family (the
// same palette IntentRecencyMap uses, so a surface reads as one consistent
// colour across the map and this feed).
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

function isRecent(publishedAt?: string | null): boolean {
  if (!publishedAt) return false;
  const t = Date.parse(publishedAt);
  if (Number.isNaN(t)) return false;
  return Date.now() - t <= LAST_30D_MS;
}

const fmt = (n: number) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n ?? 0);

export function BuyerThreadFeed({ pockets }: { pockets: Pocket[] }): React.JSX.Element {
  const { open } = useEvidenceDrawer();
  const [filter, setFilter] = useState<Filter>("all");

  const threads = useMemo<Thread[]>(() => {
    const flat = pockets.flatMap((p) => p.topThreads.map((t) => ({ ...t, surface: p.surface })));
    return [...flat].sort((a, b) => {
      const ta = a.publishedAt ? Date.parse(a.publishedAt) : Number.NaN;
      const tb = b.publishedAt ? Date.parse(b.publishedAt) : Number.NaN;
      const va = Number.isNaN(ta) ? -Infinity : ta;
      const vb = Number.isNaN(tb) ? -Infinity : tb;
      return vb - va; // newest first, undated (NaN → -Infinity) last
    });
  }, [pockets]);

  const filtered = useMemo(() => {
    switch (filter) {
      case "high-intent":
        return threads.filter((t) => typeof t.intent === "number" && t.intent >= HIGH_INTENT_THRESHOLD);
      case "recent":
        return threads.filter((t) => isRecent(t.publishedAt));
      default:
        return threads;
    }
  }, [threads, filter]);

  if (threads.length === 0) {
    return <span style={{ fontSize: 13, color: "var(--c-faint)" }}>No community threads surfaced yet.</span>;
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
        <div role="group" aria-label="Filter threads" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(f.key)}
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "5px 12px",
                  borderRadius: "var(--radius-full)",
                  border: active ? "1px solid var(--c-action)" : "1px solid var(--c-line)",
                  background: active ? "var(--c-soft)" : "var(--c-surface)",
                  color: active ? "var(--c-action)" : "var(--c-muted)",
                  cursor: "pointer",
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--c-faint)", flexShrink: 0 }}>
          {filtered.length} shown
        </span>
      </div>

      {filtered.length === 0 ? (
        <span style={{ fontSize: 13, color: "var(--c-faint)" }}>No threads match this filter.</span>
      ) : (
        <ul
          style={{
            margin: 0,
            padding: 0,
            listStyle: "none",
            display: "flex",
            flexDirection: "column",
            gap: 2,
            maxHeight: 420,
            overflowY: "auto",
          }}
        >
          {filtered.map((t, i) => {
            const rel = relativeDate(t.publishedAt);
            const high = typeof t.intent === "number" && t.intent >= HIGH_INTENT_THRESHOLD;
            return (
              <li
                key={`${t.surface}-${t.url}-${i}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 4px",
                  borderBottom: "1px solid var(--c-line)",
                }}
              >
                <span
                  title={t.surface}
                  style={{
                    flexShrink: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--c-muted)",
                    background: "var(--c-fill)",
                    padding: "3px 9px",
                    borderRadius: "var(--radius-full)",
                    maxWidth: 120,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: colourFor(t.surface), flexShrink: 0 }} />
                  {t.surface}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    open({
                      kind: "thread",
                      title: t.title,
                      url: t.url,
                      surface: t.surface,
                      theme: t.theme,
                      publishedAt: t.publishedAt,
                      intent: t.intent,
                      activity: t.activity,
                    })
                  }
                  style={{
                    flex: "1 1 auto",
                    minWidth: 0,
                    textAlign: "left",
                    background: "none",
                    border: "none",
                    padding: 0,
                    font: "inherit",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--c-ink)",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {t.title}
                </button>

                {typeof t.intent === "number" && (
                  <Badge tone={high ? "red" : "neutral"} style={{ flexShrink: 0 }}>
                    {high ? "🔥 " : ""}intent {t.intent.toFixed(2)}
                  </Badge>
                )}

                {rel && (
                  <span style={{ flexShrink: 0, fontSize: 11, color: "var(--c-faint)" }}>{rel}</span>
                )}

                {t.activity != null && (
                  <span style={{ flexShrink: 0, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--c-faint)" }}>
                    ▲{fmt(t.activity.score)} · {fmt(t.activity.comments)}
                  </span>
                )}

                <EvidenceLink href={t.url} style={{ flexShrink: 0, fontSize: 11 }}>
                  open
                </EvidenceLink>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
