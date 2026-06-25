import * as React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual emphasis. */
  variant?: "primary" | "secondary" | "ghost";
  /** Control size. */
  size?: "sm" | "md" | "lg";
}

const PADDING: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "7px 13px",
  md: "10px 18px",
  lg: "13px 24px",
};
const FONT: Record<NonNullable<ButtonProps["size"]>, number> = { sm: 13, md: 14, lg: 15 };

/**
 * ReachKit button. Primary is the violet action fill; secondary is a bordered
 * surface; ghost is text-only. Uses the design tokens for colour + radius.
 */
export function Button({ variant = "primary", size = "md", style, children, ...rest }: ButtonProps) {
  const base: React.CSSProperties = {
    fontFamily: "var(--font-sans)",
    fontWeight: 600,
    fontSize: FONT[size],
    padding: PADDING[size],
    borderRadius: "var(--radius-lg)",
    cursor: "pointer",
    lineHeight: 1.1,
    transition: "background 150ms, border-color 150ms",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  };
  const variants: Record<NonNullable<ButtonProps["variant"]>, React.CSSProperties> = {
    primary: { background: "var(--c-action)", color: "var(--c-on-dark)", border: "1px solid transparent" },
    secondary: { background: "var(--c-surface)", color: "var(--c-ink)", border: "1px solid var(--c-line)" },
    ghost: { background: "transparent", color: "var(--c-action)", border: "1px solid transparent" },
  };
  return (
    <button style={{ ...base, ...variants[variant], ...style }} {...rest}>
      {children}
    </button>
  );
}
