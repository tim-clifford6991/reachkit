/**
 * AuthScorePanel — the right-hand decorative panel on the split-screen auth
 * page (per ReachKit.dc.html). A violet gradient field with a floating glass
 * "Discoverability Score" card. Server component, no interactivity. Hidden below
 * the lg breakpoint so mobile gets a clean single-column form.
 */
export function AuthScorePanel() {
  return (
    <aside
      className="relative hidden items-center justify-center overflow-hidden lg:flex"
      style={{
        background:
          "linear-gradient(150deg, oklch(0.56 0.205 286) 0%, oklch(0.46 0.185 282) 100%)",
      }}
      aria-hidden
    >
      {/* Soft ambient blooms */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(40% 40% at 78% 18%, oklch(1 0 0 / 0.18) 0%, transparent 70%), radial-gradient(50% 45% at 15% 88%, oklch(0 0 0 / 0.18) 0%, transparent 70%)",
        }}
      />

      <div className="relative flex max-w-sm flex-col gap-8 px-10">
        <h2
          className="text-3xl leading-tight"
          style={{ fontFamily: "var(--font-display)", color: "oklch(1 0 0)", letterSpacing: "-0.02em" }}
        >
          One number tells you how findable you are.
        </h2>

        {/* Glass score card */}
        <div
          className="rounded-2xl border p-6 backdrop-blur-md"
          style={{
            background: "oklch(1 0 0 / 0.12)",
            borderColor: "oklch(1 0 0 / 0.22)",
            boxShadow: "0 24px 60px -22px oklch(0.30 0.12 285 / 0.6)",
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: "oklch(1 0 0 / 0.85)" }}>
              Discoverability Score
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums"
              style={{ background: "oklch(0.72 0.15 150 / 0.25)", color: "oklch(0.92 0.12 150)" }}
            >
              ▲ +6
            </span>
          </div>

          <p
            className="mt-3 font-mono tabular-nums"
            style={{ fontSize: "3rem", lineHeight: 1, color: "oklch(1 0 0)" }}
          >
            47<span className="text-xl" style={{ color: "oklch(1 0 0 / 0.55)" }}>/100</span>
          </p>

          {/* Progress track at 47% */}
          <div
            className="mt-4 h-2 w-full overflow-hidden rounded-full"
            style={{ background: "oklch(1 0 0 / 0.18)" }}
          >
            <div
              className="h-full rounded-full"
              style={{ width: "47%", background: "oklch(1 0 0 / 0.9)" }}
            />
          </div>
          <p className="mt-3 text-xs" style={{ color: "oklch(1 0 0 / 0.7)" }}>
            Hard to find — and we&apos;ll show you the 7 fixes that move it.
          </p>
        </div>
      </div>
    </aside>
  );
}
