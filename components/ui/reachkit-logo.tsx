/**
 * ReachKitLogo — the brand mark (Glassy Bento, Logo A): a rounded amber-gradient
 * square holding an ascending-signal glyph (discoverability rising), beside the
 * "ReachKit" wordmark. Pure tokens — no new colours. `iconOnly` renders just the
 * square (collapsed rail).
 */

export function ReachKitLogo({
  iconOnly = false,
  size = 28,
}: {
  iconOnly?: boolean;
  size?: number;
}) {
  return (
    <span className="flex items-center gap-2">
      <span
        className="flex shrink-0 items-center justify-center"
        style={{
          width: size,
          height: size,
          borderRadius: "var(--radius-md)",
          background: "var(--gradient-accent, var(--color-accent-500))",
          boxShadow: "var(--edge-highlight)",
        }}
        aria-hidden
      >
        <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none">
          <rect x="4" y="14" width="3.6" height="6" rx="1.6" fill="var(--color-accent-fg)" fillOpacity="0.95" />
          <rect x="10.2" y="9" width="3.6" height="11" rx="1.6" fill="var(--color-accent-fg)" fillOpacity="0.95" />
          <rect x="16.4" y="4" width="3.6" height="16" rx="1.6" fill="var(--color-accent-fg)" fillOpacity="0.82" />
        </svg>
      </span>
      {!iconOnly && (
        <span className="text-sm font-semibold tracking-tight" style={{ color: "var(--color-fg)" }}>
          ReachKit
        </span>
      )}
    </span>
  );
}
