import type { Metadata } from "next";
import Link from "next/link";

import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Contact",
  description: "Get in touch with ReachKit — support, feedback, press, or partnership enquiries.",
  path: "/contact",
});

const SG = "var(--font-display)", JM = "var(--font-mono)";

const CHANNELS = [
  {
    label: "General & support",
    value: "hello@reachkit.app",
    href: "mailto:hello@reachkit.app",
    note: "Questions about your scan, your account, or billing. We aim to reply within one business day.",
  },
  {
    label: "On X",
    value: "@reachkit",
    href: "https://x.com/reachkit",
    note: "The fastest way to reach us for quick questions and product updates.",
    external: true,
  },
];

export default function ContactPage() {
  return (
    <main aria-label="Contact ReachKit" style={{ background: "#fff" }}>
      <section style={{ position: "relative", overflow: "hidden", background: "radial-gradient(1100px 480px at 50% -8%, #F2EEFF 0%, rgba(242,238,255,0) 62%), #fff" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "72px 28px 0" }}>
          <p style={{ fontFamily: JM, fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6E56F7", margin: 0 }}>
            Contact
          </p>
          <h1 style={{ fontFamily: SG, fontWeight: 700, fontSize: "clamp(2rem, 4.5vw, 3.4rem)", letterSpacing: "-0.02em", lineHeight: 1.04, color: "#14131A", margin: "16px 0 0", maxWidth: 700 }}>
            Talk to us
          </h1>
          <p style={{ fontSize: 17.5, lineHeight: 1.5, color: "#56535F", margin: "18px 0 0", maxWidth: 580 }}>
            We&apos;re a small team that reads everything. Whether it&apos;s a bug, a feature idea, a
            partnership, or a question about your report — get in touch.
          </p>
        </div>
      </section>

      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 28px 28px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {CHANNELS.map((c) => (
            <a
              key={c.label}
              href={c.href}
              {...(c.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              style={{ display: "flex", flexDirection: "column", gap: 6, background: "#fff", border: "1px solid #ECEAF3", borderRadius: 16, padding: "24px 26px", textDecoration: "none" }}
            >
              <span style={{ fontFamily: JM, fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#9A97A5" }}>
                {c.label}
              </span>
              <span style={{ fontFamily: SG, fontWeight: 700, fontSize: 18, letterSpacing: "-0.01em", color: "#6E56F7" }}>
                {c.value}
              </span>
              <span style={{ fontSize: 14.5, lineHeight: 1.5, color: "#56535F" }}>
                {c.note}
              </span>
            </a>
          ))}
        </div>

        <p style={{ fontSize: 14.5, lineHeight: 1.5, color: "#56535F", margin: "28px 0 0" }}>
          Looking for legal details? See the{" "}
          <Link href="/imprint" style={{ color: "#6E56F7", fontWeight: 600, textDecoration: "none" }}>
            Imprint
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
