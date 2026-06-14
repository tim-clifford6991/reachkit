/**
 * Brand logo — a "reach / signal" mark: concentric arcs radiating from a point,
 * set in a rounded honey tile. Reads as broadcast/discoverability rather than a
 * bare letterform. Uses theme tokens so it adapts to light/dark.
 *
 * <LogoMark /> = just the tile glyph. <Wordmark /> = mark + "ReachKit".
 */

export function LogoMark({
  size = 28,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect width="28" height="28" rx="8" fill="var(--color-accent)" />
      <g
        stroke="var(--color-accent-fg)"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      >
        <path d="M14 19 A5 5 0 0 0 9 14" />
        <path d="M18 19 A9 9 0 0 0 9 10" />
      </g>
      <circle cx="9" cy="19" r="1.7" fill="var(--color-accent-fg)" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2.5 ${className ?? ""}`}>
      <LogoMark size={28} />
      <span
        className="text-lg font-semibold"
        style={{ fontFamily: "var(--font-display)", color: "var(--color-fg)" }}
      >
        ReachKit
      </span>
    </span>
  );
}
