/**
 * HeroScanDemo — the right-hand proof panel for the hero (§22.1).
 *
 * A static, server-rendered mock of a real scan result: score ring, subscore
 * bars, and the top fixes. Animation is pure CSS (reduced-motion-safe) so it
 * adds ZERO client JS above the fold — important for the (marketing) bundle
 * budget and LCP. Base styles are the final state; the entrance animation only
 * plays when motion is allowed, so reduced-motion users see the finished card.
 *
 * It is illustrative (a sample product), clearly framed as a preview — not a
 * claim about a specific real customer.
 */

const RING_CIRC = 326.7; // 2π·52
const SCORE = 47;
const RING_OFFSET = RING_CIRC * (1 - SCORE / 100); // ≈ 173

const SUBSCORES = [
  { label: "Content", value: 38, color: "var(--color-warning)" },
  { label: "Outreach", value: 52, color: "var(--color-accent)" },
  { label: "SEO", value: 41, color: "var(--color-accent)" },
] as const;

const FIXES = [
  "Title wastes 80 characters on branding no one searches",
  "Invisible for “budget tracker” — ~12k searches / mo",
  "Missing structured data (schema.org) on the landing page",
] as const;

export function HeroScanDemo() {
  return (
    <div
      className="reachkit-hero-demo relative w-full max-w-md rounded-2xl border p-6"
      style={{
        borderColor: "var(--hairline)",
        background: "var(--gradient-surface)",
        boxShadow: "var(--elevation-lg),var(--edge-highlight)",
      }}
      role="img"
      aria-label="Sample ReachKit scan result: a Discoverability Score of 47 out of 100 with the top fixes."
    >
      {/* Header — faux URL chip + complete pill */}
      <div className="mb-6 flex items-center justify-between">
        <span
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[11px]"
          style={{ background: "var(--fill-subtle)", color: "var(--color-muted)" }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: "var(--color-accent-400)" }}
            aria-hidden="true"
          />
          yourproduct.com
        </span>
        <span
          className="rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider"
          style={{ background: "var(--color-success-subtle)", color: "var(--color-success)" }}
        >
          Scan complete
        </span>
      </div>

      {/* Score ring + label */}
      <div className="mb-6 flex items-center gap-5">
        <div className="relative h-[120px] w-[120px] shrink-0">
          <svg width="120" height="120" viewBox="0 0 120 120" aria-hidden="true">
            <circle cx="60" cy="60" r="52" fill="none" stroke="var(--hairline)" strokeWidth="8" />
            <circle
              className="reachkit-hero-demo-ring"
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={RING_CIRC}
              strokeDashoffset={RING_OFFSET}
              transform="rotate(-90 60 60)"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="font-mono text-3xl font-semibold leading-none tabular-nums"
              style={{ color: "var(--color-fg)" }}
            >
              {SCORE}
            </span>
            <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              / 100
            </span>
          </div>
        </div>

        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Discoverability
          </p>
          <p className="text-lg font-semibold" style={{ color: "var(--color-fg)" }}>
            Fair — room to climb
          </p>
          <div className="mt-3 space-y-2">
            {SUBSCORES.map((s, i) => (
              <div key={s.label} className="flex items-center gap-2">
                <span className="w-14 shrink-0 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                  {s.label}
                </span>
                <span className="relative h-1 flex-1 overflow-hidden rounded-full" style={{ background: "var(--fill-subtle)" }}>
                  <span
                    className="reachkit-hero-demo-bar absolute inset-y-0 left-0 rounded-full"
                    style={{ width: `${s.value}%`, background: s.color, ["--bar-w" as string]: `${s.value}%`, ["--bar-i" as string]: i }}
                  />
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top fixes */}
      <div className="border-t pt-4" style={{ borderColor: "var(--hairline)" }}>
        <p className="mb-2.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Top fixes
        </p>
        <ul className="space-y-2">
          {FIXES.map((fix, i) => (
            <li
              key={fix}
              className="reachkit-hero-demo-fix flex items-start gap-2.5 text-[13px] leading-snug"
              style={{ color: "var(--color-fg)", ["--fix-i" as string]: i }}
            >
              <span
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: "var(--color-accent-400)" }}
                aria-hidden="true"
              />
              {fix}
            </li>
          ))}
        </ul>
      </div>

      {/* CSS-only entrance — reduced-motion-safe (base styles are the final state) */}
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .reachkit-hero-demo-ring {
            animation: reachkit-hero-ring 1.3s cubic-bezier(0.25, 0, 0, 1) 0.2s both;
          }
          .reachkit-hero-demo-bar {
            animation: reachkit-hero-bar 0.8s cubic-bezier(0.25, 0, 0, 1) both;
            animation-delay: calc(0.5s + var(--bar-i) * 0.12s);
          }
          .reachkit-hero-demo-fix {
            animation: reachkit-hero-fix 0.5s cubic-bezier(0.25, 0, 0, 1) both;
            animation-delay: calc(0.9s + var(--fix-i) * 0.12s);
          }
          @keyframes reachkit-hero-ring {
            from { stroke-dashoffset: ${RING_CIRC}; }
            to   { stroke-dashoffset: ${RING_OFFSET}; }
          }
          @keyframes reachkit-hero-bar {
            from { width: 0%; }
            to   { width: var(--bar-w); }
          }
          @keyframes reachkit-hero-fix {
            from { opacity: 0; transform: translateY(6px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        }
      `}</style>
    </div>
  );
}
