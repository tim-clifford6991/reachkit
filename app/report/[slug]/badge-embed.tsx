"use client";

/**
 * BadgeEmbed — §22 growth loop badge-embed snippet.
 *
 * Renders a copy-paste block with:
 *   - A Markdown snippet (for READMEs / GitHub)
 *   - An HTML <img> snippet (for websites / email)
 *   - Copy-to-clipboard button with Sonner confirmation toast
 *
 * The badge links back to /report/[slug] and uses the OG image as the badge
 * graphic (the same 1200×630 card, displayed small via width attr).
 *
 * This is the §22 growth loop: every badge posted on a README or landing page
 * is a DoFollow backlink + social proof pointing to the public report.
 */

import { useState } from "react";
import { toast } from "sonner";
import { SITE } from "@/lib/seo";

interface BadgeEmbedProps {
  slug: string;
  total: number;
}

export function BadgeEmbed({ slug, total }: BadgeEmbedProps) {
  const reportUrl = `${SITE.url}/report/${slug}`;
  const imageUrl = `${SITE.url}/report/${slug}/opengraph-image`;
  const altText = `ReachKit Discoverability Score: ${total}/100 — verified, not vanity`;

  const markdownSnippet = `[![${altText}](${imageUrl})](${reportUrl})`;
  const htmlSnippet = `<a href="${reportUrl}" target="_blank" rel="noopener">\n  <img src="${imageUrl}" alt="${altText}" width="600" />\n</a>`;

  const [activeTab, setActiveTab] = useState<"markdown" | "html">("markdown");
  const snippet = activeTab === "markdown" ? markdownSnippet : htmlSnippet;

  function copySnippet() {
    void navigator.clipboard.writeText(snippet).then(() => {
      toast.success("Snippet copied", {
        description: "Paste it in your README or site to share your score.",
        duration: 3000,
      });
    });
  }

  return (
    <div
      className="rounded-xl border"
      style={{
        borderColor: "var(--hairline)",
        background: "var(--color-surface)",
      }}
    >
      <div className="px-5 pb-5 pt-5">
        {/* Header */}
        <div className="mb-4">
          <p
            className="font-mono text-[10px] uppercase tracking-widest"
            style={{ color: "var(--color-muted)" }}
          >
            Share your score
          </p>
          <h2
            className="mt-0.5 text-base font-semibold"
            style={{ color: "var(--color-fg)" }}
          >
            Add to your README or site
          </h2>
          <p
            className="mt-1 text-sm leading-relaxed"
            style={{ color: "var(--color-muted)" }}
          >
            Every badge is a verified signal — your score is computed from
            real surface data, not self-reported metrics.
          </p>
        </div>

        {/* Tab toggle */}
        <div
          className="mb-3 flex gap-1 rounded-lg p-1"
          style={{ background: "var(--fill-subtle)" }}
          role="tablist"
          aria-label="Snippet format"
        >
          {(["markdown", "html"] as const).map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className="flex-1 rounded-md px-3 py-1.5 font-mono text-xs transition-colors"
              style={{
                background: activeTab === tab ? "var(--hairline)" : "transparent",
                color: activeTab === tab ? "var(--color-fg)" : "var(--color-muted)",
                border: "none",
                cursor: "pointer",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              {tab === "markdown" ? "Markdown" : "HTML"}
            </button>
          ))}
        </div>

        {/* Code block */}
        <div
          className="relative rounded-lg"
          style={{ background: "var(--fill-subtle)", border: "1px solid var(--hairline)" }}
        >
          <pre
            className="overflow-x-auto p-4 font-mono text-xs leading-relaxed"
            style={{
              color: "oklch(0.87 0 0)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              margin: 0,
            }}
          >
            {snippet}
          </pre>
        </div>

        {/* Copy button */}
        <button
          onClick={copySnippet}
          className="mt-3 w-full rounded-lg px-4 py-2.5 font-mono text-sm font-medium transition-colors"
          style={{
            background: "var(--color-accent-subtle)",
            border: "1px solid var(--color-accent-900)",
            color: "var(--color-accent-400)",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              "var(--color-accent-subtle)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              "var(--color-accent-subtle)";
          }}
        >
          Copy snippet
        </button>
      </div>
    </div>
  );
}
