/* @mirrors app/(marketing)/contact/page.tsx */
import * as React from "react";
import { NavBar } from "./NavBar";
import { PageHeader } from "./PageHeader";
import { Footer } from "./Footer";

/**
 * ContactScreen — the `/contact` page: NavBar, a left-aligned PageHeader
 * ("Contact" · "Talk to us" + subhead), two clickable channel cards
 * (hello@reachkit.app · @reachkit), the Imprint footnote, then the footer.
 * Mirrors the live inline page.
 */
export interface ContactScreenProps {
  _unused?: never;
}

const CHANNELS = [
  { href: "mailto:hello@reachkit.app", label: "General & support", value: "hello@reachkit.app", note: "Questions about your scan, your account, or billing. We aim to reply within one business day." },
  { href: "https://x.com/reachkit", label: "On X", value: "@reachkit", note: "The fastest way to reach us for quick questions and product updates." },
];

export function ContactScreen() {
  return (
    <div style={{ background: "var(--c-surface)", fontFamily: "var(--font-sans)", color: "var(--c-ink)" }}>
      <NavBar />
      <PageHeader eyebrow="Contact" title="Talk to us" titleMaxWidth={700} subhead="We're a small team that reads everything. Whether it's a bug, a feature idea, a partnership, or a question about your report — get in touch." />
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 28px 28px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {CHANNELS.map((c) => (
            <a key={c.value} href={c.href} style={{ display: "flex", flexDirection: "column", gap: 6, background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 16, padding: "24px 26px", textDecoration: "none" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--c-faint)" }}>{c.label}</span>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, color: "var(--c-action)" }}>{c.value}</span>
              <span style={{ fontSize: 14.5, lineHeight: 1.5, color: "var(--c-muted)" }}>{c.note}</span>
            </a>
          ))}
        </div>
        <p style={{ marginTop: 28, fontSize: 14.5, color: "var(--c-muted)" }}>Looking for legal details? See the <a href="/imprint" style={{ color: "var(--c-action)", fontWeight: 600, textDecoration: "none" }}>Imprint</a>.</p>
      </div>
      <Footer />
    </div>
  );
}
