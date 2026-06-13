"use client";

/**
 * PlaysBuckets — client-side interactive piece of the plays queue (Task 21a).
 *
 * Renders the three effort buckets (quickWins / medium / longPlay) with
 * tick-off and URL-verify controls. Optimistic UI: completed cards are
 * immediately moved to a "verifying…" state without waiting for the
 * API response. Sonner toasts on success/error.
 *
 * Motion: reduced-motion safe. Transitions use CSS-based opacity only
 * when prefers-reduced-motion is active.
 */

import { useState, useCallback } from "react";
import { toast } from "sonner";
import type { WeeklyPlanAction } from "@/lib/scan/weekly-plan";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CardState =
  | { status: "idle" }
  | { status: "verify-input"; url: string }
  | { status: "verifying" }
  | { status: "done" };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function effortLabel(effortMin: number | null): string {
  const m = effortMin ?? 30;
  if (m < 30) return "Quick win";
  if (m <= 120) return "Medium";
  return "Long play";
}

function effortColor(effortMin: number | null): string {
  const m = effortMin ?? 30;
  if (m < 30) return "var(--color-success)";
  if (m <= 120) return "var(--color-accent-500)";
  return "var(--color-warning)";
}

function categoryLabel(cat: string): string {
  if (cat === "seo_aso") return "SEO / ASO";
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

function formatDeadline(deadline: string | null): string | null {
  if (!deadline) return null;
  const d = new Date(deadline);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

// ---------------------------------------------------------------------------
// Single action card
// ---------------------------------------------------------------------------

function ActionCard({ action }: { action: WeeklyPlanAction }) {
  const [state, setState] = useState<CardState>({ status: "idle" });

  const accentColor = effortColor(action.effortMin);
  const isDone = state.status === "done";
  const isVerifying = state.status === "verifying";

  const handleComplete = useCallback(async () => {
    // For verify_url actions, ask for URL first (we can't know the method from
    // the plan shape, but offer the verify-url flow universally — it's optional)
    if (state.status === "idle") {
      setState({ status: "verify-input", url: "" });
      return;
    }

    if (state.status !== "verify-input") return;

    const verifyUrl = state.url.trim();

    // Optimistic: mark verifying immediately
    setState({ status: "verifying" });

    try {
      const body: { verify_url?: string } = {};
      if (verifyUrl.length > 0) body.verify_url = verifyUrl;

      const res = await fetch(`/api/action/${action.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        const msg =
          res.status === 402
            ? "Upgrade required to mark plays complete."
            : (data.message ?? "Something went wrong.");
        toast.error(msg);
        setState({ status: "idle" });
        return;
      }

      setState({ status: "done" });
      toast.success("Action marked complete — verification queued.");
    } catch {
      toast.error("Network error — please try again.");
      setState({ status: "idle" });
    }
  }, [action.id, state]);

  const handleSkipUrl = useCallback(() => {
    setState({ status: "verify-input", url: "" });
    void (async () => {
      setState({ status: "verifying" });
      try {
        const res = await fetch(`/api/action/${action.id}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!res.ok) {
          toast.error("Could not mark action complete.");
          setState({ status: "idle" });
          return;
        }
        setState({ status: "done" });
        toast.success("Action marked complete — verification queued.");
      } catch {
        toast.error("Network error — please try again.");
        setState({ status: "idle" });
      }
    })();
  }, [action.id]);

  return (
    <div
      className="space-y-3 rounded-lg px-4 py-3.5 transition-opacity"
      style={{
        border: "1px solid oklch(1 0 0 / 0.08)",
        opacity: isDone ? 0.45 : 1,
      }}
      aria-disabled={isDone}
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        {/* Tick control */}
        <button
          type="button"
          aria-label={isDone ? "Completed" : `Mark "${action.title}" complete`}
          disabled={isDone || isVerifying}
          onClick={
            state.status === "idle"
              ? () => setState({ status: "verify-input", url: "" })
              : undefined
          }
          className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2"
          style={{
            borderColor: isDone
              ? "var(--color-success)"
              : isVerifying
              ? "var(--color-accent-500)"
              : "oklch(1 0 0 / 0.20)",
            background: isDone
              ? "var(--color-success)"
              : isVerifying
              ? "oklch(0.60 0.18 255 / 0.15)"
              : "transparent",
            color: isDone ? "oklch(0.10 0 0)" : "var(--color-accent-400)",
          }}
        >
          {isDone ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
              <path
                d="M2 5l2.5 2.5L8 2.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : isVerifying ? (
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              aria-hidden
              className="animate-spin"
            >
              <circle
                cx="5"
                cy="5"
                r="3.5"
                stroke="currentColor"
                strokeOpacity="0.3"
                strokeWidth="1.5"
              />
              <path
                d="M8.5 5a3.5 3.5 0 0 0-3.5-3.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          ) : null}
        </button>

        {/* Title */}
        <p
          className="flex-1 text-sm font-medium leading-snug"
          style={{
            color: isDone ? "var(--color-muted)" : "var(--color-fg)",
            textDecoration: isDone ? "line-through" : "none",
          }}
        >
          {action.title}
        </p>

        {/* Effort badge */}
        <span
          className="shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] tabular-nums"
          style={{
            borderColor: `${accentColor.replace(")", " / 0.25)")}`,
            color: accentColor,
          }}
        >
          {action.effortMin !== null ? `${action.effortMin}m` : "—"}
        </span>
      </div>

      {/* Meta row: category + deadline */}
      <div className="flex items-center gap-2 pl-8">
        <span
          className="rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider"
          style={{
            background: "oklch(1 0 0 / 0.04)",
            color: "var(--color-muted)",
            border: "1px solid oklch(1 0 0 / 0.07)",
          }}
        >
          {categoryLabel(action.category)}
        </span>
        {action.deadline && (
          <span
            className="font-mono text-[10px]"
            style={{ color: "oklch(1 0 0 / 0.30)" }}
          >
            by {formatDeadline(action.deadline)}
          </span>
        )}
        {action.scoreComponent && (
          <span
            className="font-mono text-[10px]"
            style={{ color: accentColor }}
          >
            → {action.scoreComponent}
          </span>
        )}
      </div>

      {/* Why */}
      {action.why && (
        <p
          className="pl-8 text-xs leading-relaxed"
          style={{ color: "var(--color-muted)" }}
        >
          {action.why}
        </p>
      )}

      {/* Draft */}
      {action.draft && (
        <div
          className="ml-8 rounded-lg px-3 py-2.5"
          style={{ background: "oklch(1 0 0 / 0.04)" }}
        >
          <p
            className="mb-1 font-mono text-[10px] uppercase tracking-wider"
            style={{ color: "var(--color-muted)" }}
          >
            Draft — edit before using
          </p>
          <p
            className="whitespace-pre-wrap font-mono text-xs leading-relaxed"
            style={{ color: "oklch(0.87 0 0)" }}
          >
            {action.draft}
          </p>
        </div>
      )}

      {/* Verify URL input — shown after tick */}
      {state.status === "verify-input" && (
        <div className="ml-8 space-y-2">
          <p
            className="font-mono text-[10px] uppercase tracking-wider"
            style={{ color: "var(--color-muted)" }}
          >
            Link to what you shipped (optional)
          </p>
          <div className="flex gap-2">
            <input
              type="url"
              value={state.url}
              onChange={(e) =>
                setState({ status: "verify-input", url: e.target.value })
              }
              placeholder="https://…"
              aria-label="URL to verify"
              className="h-8 flex-1 rounded-lg border bg-transparent px-3 text-xs outline-none transition-colors focus-visible:ring-2"
              style={{
                borderColor: "oklch(1 0 0 / 0.12)",
                color: "var(--color-fg)",
              }}
            />
            <button
              type="button"
              onClick={() => void handleComplete()}
              className="h-8 shrink-0 rounded-lg px-3 text-xs font-medium transition-colors"
              style={{
                background: "var(--color-accent-600)",
                color: "var(--color-accent-fg)",
              }}
            >
              Done
            </button>
            <button
              type="button"
              onClick={() => void handleSkipUrl()}
              className="h-8 shrink-0 rounded-lg border px-3 text-xs transition-colors"
              style={{
                borderColor: "oklch(1 0 0 / 0.12)",
                color: "var(--color-muted)",
              }}
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* Verifying state banner */}
      {state.status === "verifying" && (
        <p
          className="pl-8 font-mono text-[10px] uppercase tracking-wider"
          style={{ color: "var(--color-accent-400)" }}
        >
          Verifying…
        </p>
      )}

      {/* Done state banner */}
      {isDone && (
        <p
          className="pl-8 font-mono text-[10px] uppercase tracking-wider"
          style={{ color: "var(--color-success)" }}
        >
          Complete — verification queued
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bucket
// ---------------------------------------------------------------------------

interface BucketProps {
  label: string;
  sublabel: string;
  actions: WeeklyPlanAction[];
  accentColor: string;
}

function Bucket({ label, sublabel, actions, accentColor }: BucketProps) {
  if (actions.length === 0) return null;

  return (
    <section
      aria-labelledby={`bucket-${label.replace(/\s+/g, "-").toLowerCase()}`}
      className="rounded-xl border"
      style={{
        borderColor: "oklch(1 0 0 / 0.09)",
        background: "var(--color-surface)",
      }}
    >
      <div className="px-5 pt-5">
        <div className="mb-4 flex items-baseline gap-2">
          <p
            id={`bucket-${label.replace(/\s+/g, "-").toLowerCase()}`}
            className="font-mono text-[10px] uppercase tracking-widest"
            style={{ color: accentColor }}
          >
            {label}
          </p>
          <p
            className="font-mono text-[10px]"
            style={{ color: "var(--color-muted)" }}
          >
            {sublabel}
          </p>
          <span
            className="ml-auto font-mono text-[10px] tabular-nums"
            style={{ color: "var(--color-muted)" }}
          >
            {actions.length}
          </span>
        </div>

        <div className="space-y-3 pb-5">
          {actions.map((action) => (
            <ActionCard key={action.id} action={action} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

interface PlaysBucketsProps {
  quickWins: WeeklyPlanAction[];
  medium: WeeklyPlanAction[];
  longPlay: WeeklyPlanAction[];
}

export function PlaysBuckets({
  quickWins,
  medium,
  longPlay,
}: PlaysBucketsProps) {
  return (
    <div className="space-y-4">
      <Bucket
        label="Quick wins"
        sublabel="under 30 min"
        actions={quickWins}
        accentColor="var(--color-success)"
      />
      <Bucket
        label="Medium effort"
        sublabel="30–120 min"
        actions={medium}
        accentColor="var(--color-accent-500)"
      />
      <Bucket
        label="Long play"
        sublabel="over 120 min"
        actions={longPlay}
        accentColor="var(--color-warning)"
      />
    </div>
  );
}
