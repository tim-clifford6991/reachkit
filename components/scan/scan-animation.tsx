// A skeleton "page" card with a scan line sweeping top→bottom — the visual
// companion to the live checklist. Once the product name is known it peeks it.
// Respects prefers-reduced-motion.

const BARS = [62, 92, 78, 40, 88, 54, 70];

export function ScanAnimation({ productName }: { productName?: string | null }) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-6"
      style={{ borderColor: "var(--hairline)", background: "var(--color-surface)", minHeight: 300 }}
      aria-hidden="true"
    >
      {/* browser/window accent bar */}
      <div className="mb-5 h-1.5 w-full rounded-full" style={{ background: "var(--color-accent)" }} />

      {productName ? (
        <p className="mb-4 truncate font-mono text-sm" style={{ color: "var(--color-muted)" }}>
          {productName}
        </p>
      ) : (
        <div className="mb-4 h-4 w-1/3 rounded" style={{ background: "var(--fill-subtle)" }} />
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
            "linear-gradient(180deg, transparent, color-mix(in srgb, var(--color-accent) 20%, transparent), transparent)",
        }}
      />
      <style>{`
        @keyframes scanSweep { 0% { transform: translateY(-64px); } 100% { transform: translateY(300px); } }
        .scan-sweep { animation: scanSweep 2.2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .scan-sweep { animation: none; opacity: 0; } }
      `}</style>
    </div>
  );
}
