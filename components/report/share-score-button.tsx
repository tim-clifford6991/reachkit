"use client";

/**
 * ShareScoreButton — copies the public report URL to the clipboard (the
 * score-card-in-the-wild distribution mechanic, §8). Toast on success.
 */

import { useState } from "react";
import { toast } from "sonner";

export function ShareScoreButton({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = `${window.location.origin}/report/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Report link copied — share your score.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — copy from the address bar instead.");
    }
  };

  return (
    <button
      type="button"
      onClick={share}
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--fill-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      style={{ borderColor: "var(--hairline)", color: "var(--color-muted)" }}
    >
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M11 5.5a2 2 0 1 0-1.9-2.6L6.3 4.5a2 2 0 1 0 0 3l2.8 1.6A2 2 0 1 0 11 7.4l-2.6-1.5a2 2 0 0 0 0-.3L11 5.5Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
      </svg>
      {copied ? "Copied!" : "Share score"}
    </button>
  );
}
