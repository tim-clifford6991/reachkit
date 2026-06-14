/**
 * Signal feed — v1.5-gated stub.
 *
 * §9.6: Daily signal feed feature is gated. This is a clean "coming soon"
 * empty state. Do NOT build the feed in Task 20.
 */

import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({ title: "Signal feed", path: "/app/feed" });

export default function FeedPage() {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div
        className="max-w-sm rounded-xl border px-8 py-10 text-center"
        style={{
          borderColor: "var(--hairline)",
          background: "var(--color-surface)",
        }}
      >
        {/* Icon placeholder */}
        <div
          className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full"
          style={{
            background: "oklch(0.70 0.13 66 / 0.12)",
            border: "1.5px solid var(--color-accent-900)",
          }}
          aria-hidden
        >
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
            <path d="M2 13a9 9 0 019-9" stroke="var(--color-accent-400)" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M2 9a5 5 0 015-5" stroke="var(--color-accent-400)" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="3" cy="13" r="1" fill="var(--color-accent-400)" />
          </svg>
        </div>

        <p
          className="font-mono text-[10px] uppercase tracking-widest"
          style={{ color: "var(--color-muted)" }}
        >
          Coming soon
        </p>
        <h1
          className="mt-2 text-base font-semibold"
          style={{ color: "var(--color-fg)" }}
        >
          Daily signal feed
        </h1>
        <p
          className="mt-2 text-sm leading-relaxed"
          style={{ color: "var(--color-muted)" }}
        >
          Your monitors will surface real-time signals — new reviews, community
          mentions, and keyword movements — as they happen. Available in v1.5.
        </p>
      </div>
    </div>
  );
}
