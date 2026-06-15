// A skeleton "page" card with a scan line sweeping top→bottom — the visual
// companion to the live checklist. Once the product name is known it peeks it.
// Respects prefers-reduced-motion.

const BARS = [62, 92, 78, 40, 88, 54, 70];

export function ScanAnimation({ productName, host }: { productName?: string | null; host?: string | null }) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border p-6"
      style={{ borderColor: "var(--hairline)", background: "var(--color-surface)", minHeight: 300 }}
      aria-hidden="true"
    >
      {/* Browser chrome — the actual site being scanned (favicon + domain), so the
          user has a live reference to what's being analysed. */}
      <div className="mb-4 flex items-center gap-2">
        {host ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://www.google.com/s2/favicons?domain=${host}&sz=64`}
              alt=""
              width={16}
              height={16}
              className="rounded-sm"
            />
            <span className="truncate font-mono text-xs" style={{ color: "var(--color-fg)" }}>
              {host}
            </span>
          </>
        ) : (
          <div className="h-4 w-1/3 rounded" style={{ background: "var(--fill-subtle)" }} />
        )}
      </div>
      <div className="mb-5 h-1 w-full rounded-full" style={{ background: "var(--color-accent)" }} />

      {productName && (
        <p className="mb-4 truncate font-mono text-sm" style={{ color: "var(--color-muted)" }}>
          {productName}
        </p>
      )}

      <div className="space-y-3.5">
        {BARS.map((w, i) => (
          <div key={i} className="h-3.5 rounded-lg" style={{ width: `${w}%`, background: "var(--fill-subtle)" }} />
        ))}
      </div>

      {/* Sweeping scan line */}
      <div
        className="scan-sweep pointer-events-none absolute inset-x-0 top-0 h-16"
        style={{
          background:
            "linear-gradient(180deg, transparent, color-mix(in oklch, var(--color-accent) 20%, transparent), transparent)",
        }}
      />
      <style>{`
        /* Overshoot the bottom (clipped by overflow-hidden) so the sweep never cuts
           off short if the card grows taller than its min-height. */
        @keyframes scanSweep { 0% { transform: translateY(-64px); } 100% { transform: translateY(440px); } }
        .scan-sweep { animation: scanSweep 2.4s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .scan-sweep { animation: none; opacity: 0; } }
      `}</style>
    </div>
  );
}
