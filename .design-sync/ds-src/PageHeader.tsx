/* @mirrors - */
import * as React from "react";

/**
 * PageHeader — the shared marketing-page header used across the secondary pages
 * (About, Contact, Tools, Gallery, Compare, …): a soft radial-glow band with a
 * mono uppercase eyebrow, a display H1, and an optional subhead, left-aligned in
 * the 1180 content wrapper. Keeps every marketing page's header identical in
 * type, spacing and colour. Not a live 1:1 file — it factors the repeated header
 * markup out of the live inline pages.
 */
export interface PageHeaderProps {
  eyebrow: string;
  title: React.ReactNode;
  subhead?: React.ReactNode;
  titleMaxWidth?: number;
  /** Centered (marketing hubs — Tools/Gallery/Compare) vs left (About/Contact). */
  center?: boolean;
  /** Extra content (button rows) rendered under the subhead. */
  children?: React.ReactNode;
  padding?: string;
}

export function PageHeader({ eyebrow, title, subhead, titleMaxWidth = 760, center = false, children, padding = "72px 28px 0" }: PageHeaderProps) {
  const align = center ? "center" : "left";
  const mx = center ? "auto" : undefined;
  return (
    <section style={{ position: "relative", overflow: "hidden", background: "radial-gradient(1100px 480px at 50% -8%, var(--c-soft) 0%, transparent 62%), var(--c-surface)" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding, textAlign: align }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-action)" }}>{eyebrow}</div>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(2rem, 4.5vw, 3.4rem)", letterSpacing: "-0.03em", lineHeight: 1.08, color: "var(--c-ink)", margin: center ? "14px auto 0" : "14px 0 0", maxWidth: titleMaxWidth }}>{title}</h1>
        {subhead && <p style={{ fontSize: 17.5, lineHeight: 1.5, color: "var(--c-muted)", margin: center ? "18px auto 0" : "18px 0 0", maxWidth: 600, marginLeft: mx, marginRight: mx }}>{subhead}</p>}
        {children}
      </div>
    </section>
  );
}
