import type { Metadata } from "next";
import Link from "next/link";

import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Contact",
  description: "Get in touch with ReachKit — support, feedback, press, or partnership enquiries.",
  path: "/contact",
});

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
    <main
      className="mx-auto max-w-2xl px-(--spacing-content-x) pb-(--spacing-section-y) pt-20 sm:pt-28"
      aria-label="Contact ReachKit"
    >
      <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--color-accent-400)" }}>
        Contact
      </p>
      <h1 className="mt-3 text-4xl sm:text-5xl" style={{ color: "var(--color-fg)", lineHeight: 1.08 }}>
        Talk to us
      </h1>
      <p className="mt-4 text-lg leading-relaxed" style={{ color: "var(--color-muted)" }}>
        We&apos;re a small team that reads everything. Whether it&apos;s a bug, a feature idea, a
        partnership, or a question about your report — get in touch.
      </p>

      <div className="mt-10 flex flex-col gap-4">
        {CHANNELS.map((c) => (
          <a
            key={c.label}
            href={c.href}
            {...(c.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="group flex flex-col gap-1 rounded-2xl border p-7 shadow-[var(--elevation-sm),var(--edge-highlight)] transition-transform hover:-translate-y-0.5 motion-reduce:transform-none"
            style={{ borderColor: "var(--hairline)", background: "var(--gradient-surface)" }}
          >
            <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--color-muted)" }}>
              {c.label}
            </span>
            <span className="text-lg font-semibold" style={{ color: "var(--color-accent-400)" }}>
              {c.value}
            </span>
            <span className="text-sm leading-relaxed" style={{ color: "var(--color-muted)" }}>
              {c.note}
            </span>
          </a>
        ))}
      </div>

      <p className="mt-8 text-sm" style={{ color: "var(--color-muted)" }}>
        Looking for legal details? See the{" "}
        <Link href="/imprint" className="font-medium" style={{ color: "var(--color-accent-400)" }}>
          Imprint
        </Link>
        .
      </p>
    </main>
  );
}
