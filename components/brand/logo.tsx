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
      {/* 1:1 with the Claude Design mockup mark (ReachKit.dc.html). */}
      <rect width="28" height="28" rx="9" fill="#6E56F7" />
      <circle cx="14" cy="14" r="1.7" fill="#fff" />
      <path d="M14 19 A5 5 0 1 1 19 14" stroke="#fff" strokeWidth="1.7" fill="none" strokeLinecap="round" />
      <path d="M14 23 A9 9 0 1 1 23 14" stroke="#C3B2FF" strokeWidth="1.7" fill="none" strokeLinecap="round" />
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
