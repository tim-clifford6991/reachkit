/**
 * PlaysPreview — top 2–3 actions from the weekly plan for the dashboard.
 *
 * Server component. Shows effort bucket badge, title, why, and a "View all
 * plays" link to /app/plays (full queue in Task 21). Honours §7.2 rule 5
 * honesty note. Compact: no drafts shown here (full plays page has drafts).
 */

import Link from "next/link";
import type { WeeklyPlanAction } from "@/lib/scan/weekly-plan";

interface PlaysPreviewProps {
  plays: WeeklyPlanAction[];
  weekOf: string;
  scoreDelta: number;
  carryoverCount: number;
  honestyNote: string | null;
  userIsPaid: boolean;
}

// Effort label from effortMin
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

// Format weekOf (YYYY-MM-DD Monday) as "Week of Jun 9"
function formatWeekOf(weekOf: string): string {
  const d = new Date(`${weekOf}T00:00:00.000Z`);
  return `Week of ${d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`;
}

export function PlaysPreview({
  plays,
  weekOf,
  scoreDelta,
  carryoverCount,
  honestyNote,
  userIsPaid,
}: PlaysPreviewProps) {
  return (
    <section
      aria-labelledby="plays-preview-heading"
      className="rounded-2xl border shadow-[var(--elevation-sm),var(--edge-highlight)]"
      style={{
        borderColor: "var(--hairline)",
        background: "var(--gradient-surface)",
      }}
    >
      <div className="px-7 py-6">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <p
                className="font-mono text-[10px] uppercase tracking-widest"
                style={{ color: "var(--color-muted)" }}
              >
                {formatWeekOf(weekOf)}
              </p>
              {scoreDelta !== 0 && (
                <span
                  className="font-mono text-[10px] tabular-nums"
                  style={{
                    color:
                      scoreDelta > 0
                        ? "var(--color-success)"
                        : "var(--color-danger)",
                  }}
                >
                  {scoreDelta > 0 ? "+" : ""}
                  {scoreDelta} score
                </span>
              )}
            </div>
            <h2
              id="plays-preview-heading"
              className="mt-0.5 text-base font-semibold"
              style={{ color: "var(--color-fg)" }}
            >
              This week&apos;s plays
            </h2>
          </div>

          <Link
            href="/app/plays"
            className="shrink-0 font-mono text-xs transition-colors"
            style={{ color: "var(--color-accent-400)" }}
            aria-label="View all plays for this week"
          >
            View all
          </Link>
        </div>

        {/* Anti-vanity honesty note */}
        {honestyNote && (
          <div
            className="mb-4 rounded-lg px-3 py-2.5"
            style={{
              background: "var(--color-warning-subtle)",
              borderLeft: "2px solid var(--color-warning)",
            }}
          >
            <p className="text-xs leading-relaxed" style={{ color: "var(--color-fg)" }}>
              {honestyNote}
            </p>
          </div>
        )}

        {/* Play cards */}
        <div className="space-y-3">
          {plays.map((play) => (
            <PlayCard key={play.id} play={play} userIsPaid={userIsPaid} />
          ))}
        </div>

        {/* Carryover note */}
        {carryoverCount > 0 && (
          <p
            className="mt-3 font-mono text-xs"
            style={{ color: "var(--color-muted)" }}
          >
            +{carryoverCount} carried over from previous week
          </p>
        )}

        {/* Upgrade nudge for free users */}
        {!userIsPaid && (
          <div
            className="mt-4 rounded-lg px-4 py-3 text-center"
            style={{
              background: "var(--color-accent-subtle)",
              border: "1px solid var(--color-accent-900)",
            }}
          >
            <p className="text-xs" style={{ color: "var(--color-muted)" }}>
              Upgrade to unlock draft copy for each play
            </p>
            <Link
              href="/app/billing"
              className="mt-1.5 inline-block font-mono text-xs font-medium"
              style={{ color: "var(--color-accent-400)" }}
            >
              Upgrade to Solo
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

// ── Individual play card ────────────────────────────────────────────────────

function PlayCard({
  play,
  userIsPaid: _userIsPaid,
}: {
  play: WeeklyPlanAction;
  userIsPaid: boolean;
}) {
  const color = effortColor(play.effortMin);
  const label = effortLabel(play.effortMin);

  return (
    <div
      className="space-y-1.5 rounded-lg px-4 py-3 transition-[transform,box-shadow,border-color] duration-200 ease-revolut hover:-translate-y-0.5 hover:border-[var(--color-accent-900)] hover:shadow-[var(--elevation-md),var(--edge-highlight)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      style={{ border: "1px solid var(--hairline)" }}
    >
      {/* Effort badge + title */}
      <div className="flex items-start gap-2">
        <span
          className="mt-0.5 shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider"
          style={{
            color,
            background: `${color.replace(")", " / 0.1)")}`,
            border: `1px solid ${color.replace(")", " / 0.2)")}`,
          }}
        >
          {label}
          {play.effortMin !== null && (
            <span className="ml-1 opacity-70">{play.effortMin}m</span>
          )}
        </span>
      </div>
      <p className="text-sm font-medium leading-snug" style={{ color: "var(--color-fg)" }}>
        {play.title}
      </p>
      {play.why && (
        <p className="text-xs leading-relaxed" style={{ color: "var(--color-muted)" }}>
          {play.why}
        </p>
      )}
    </div>
  );
}
