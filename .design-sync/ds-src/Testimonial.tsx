import * as React from "react";

/** Testimonial — a bordered card with a founder quote + author row (violet avatar, name, role). Renders with no props. */
export interface TestimonialProps { quote?: string; author?: string; role?: string; avatarInitials?: string; }
function initialsOf(name: string): string { const p = name.trim().split(/\s+/).filter(Boolean); if (!p.length) return "?"; return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[p.length - 1][0]).toUpperCase(); }
export function Testimonial({ quote = "ReachKit surfaced three discoverability gaps we had no idea were costing us signups. We fixed the top two in an afternoon and watched our scan score jump.", author = "Sara Chen", role = "Founder, Nudgi", avatarInitials }: TestimonialProps) {
  const initials = avatarInitials ?? initialsOf(author);
  return (
    <figure style={{ margin: 0, maxWidth: 420, boxSizing: "border-box", background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-xl)", padding: "26px 26px 22px", fontFamily: "var(--font-sans)", display: "flex", flexDirection: "column", gap: 20 }}>
      <blockquote style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 18, lineHeight: 1.5, fontWeight: 500, color: "var(--c-ink)", letterSpacing: "-0.01em" }}>“{quote}”</blockquote>
      <figcaption style={{ display: "flex", alignItems: "center", gap: 13 }}>
        <div style={{ flex: "0 0 auto", width: 42, height: 42, borderRadius: "var(--radius-full)", background: "var(--c-soft)", color: "var(--c-action)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14.5 }}>{initials}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: 14.5, fontWeight: 700, color: "var(--c-ink)", lineHeight: 1.2 }}>{author}</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--c-muted)", lineHeight: 1.2 }}>{role}</span>
        </div>
      </figcaption>
    </figure>
  );
}
