"use client";

/**
 * ShareScoreButton — the score-card-in-the-wild distribution mechanic (§8).
 * Opens a share modal (per ReachKit.dc.html) with a dark gradient score card
 * preview and one-tap share to X / LinkedIn / Reddit, plus copy-link.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { bandFor } from "@/lib/scan/score-bands";

interface ShareScoreButtonProps {
  slug: string;
  /** Score total (0–100) for the preview card. Omit to fall back to copy-only. */
  score?: number;
  /** Product / domain name shown on the card. */
  productName?: string | null;
}

export function ShareScoreButton({ slug, score, productName }: ShareScoreButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // No score available → keep the original copy-only behaviour.
  const hasCard = typeof score === "number";

  const reportUrl =
    typeof window !== "undefined" ? `${window.location.origin}/report/${slug}` : `/report/${slug}`;

  const band = hasCard ? bandFor(score) : null;
  const shareText = hasCard
    ? `My Discoverability Score is ${score}/100 (${band?.label}). See how findable your product is:`
    : "See how findable your product is:";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(reportUrl);
      setCopied(true);
      toast.success("Report link copied — share your score.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — copy from the address bar instead.");
    }
  };

  const onTrigger = () => {
    if (hasCard) setOpen(true);
    else void copyLink();
  };

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const intents = {
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(reportUrl)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(reportUrl)}`,
    reddit: `https://www.reddit.com/submit?url=${encodeURIComponent(reportUrl)}&title=${encodeURIComponent(shareText)}`,
  };

  return (
    <>
      <button
        type="button"
        onClick={onTrigger}
        className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--fill-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        style={{ borderColor: "var(--hairline)", color: "var(--color-muted)" }}
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M11 5.5a2 2 0 1 0-1.9-2.6L6.3 4.5a2 2 0 1 0 0 3l2.8 1.6A2 2 0 1 0 11 7.4l-2.6-1.5a2 2 0 0 0 0-.3L11 5.5Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
        </svg>
        {copied ? "Copied!" : "Share score"}
      </button>

      {open && hasCard && band && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Share your Discoverability Score"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "oklch(0.14 0.01 285 / 0.55)", backdropFilter: "blur(4px)" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-2xl"
            style={{ background: "var(--color-surface)", boxShadow: "0 40px 90px -30px oklch(0.14 0.01 285 / 0.6)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Dark gradient score card */}
            <div
              className="relative overflow-hidden p-7 text-center"
              style={{
                background: "linear-gradient(150deg, oklch(0.56 0.205 286) 0%, oklch(0.30 0.10 285) 100%)",
              }}
            >
              {/* Concentric decoration */}
              <svg className="pointer-events-none absolute -right-10 -top-10 opacity-20" width="180" height="180" viewBox="0 0 180 180" aria-hidden>
                <circle cx="90" cy="90" r="40" fill="none" stroke="oklch(1 0 0)" strokeWidth="1" />
                <circle cx="90" cy="90" r="62" fill="none" stroke="oklch(1 0 0)" strokeWidth="1" />
                <circle cx="90" cy="90" r="84" fill="none" stroke="oklch(1 0 0)" strokeWidth="1" />
              </svg>
              <p className="relative font-mono text-[10px] uppercase tracking-widest" style={{ color: "oklch(1 0 0 / 0.7)" }}>
                Discoverability Score
              </p>
              <p className="relative mt-2 font-mono tabular-nums" style={{ fontSize: "3.5rem", lineHeight: 1, color: "oklch(1 0 0)" }}>
                {score}
                <span className="text-xl" style={{ color: "oklch(1 0 0 / 0.55)" }}>/100</span>
              </p>
              <span
                className="relative mt-3 inline-block rounded-full px-3 py-1 text-xs font-semibold"
                style={{ background: "oklch(1 0 0 / 0.16)", color: "oklch(1 0 0)" }}
              >
                {band.label}
              </span>
              {productName && (
                <p className="relative mt-3 text-xs" style={{ color: "oklch(1 0 0 / 0.7)" }}>
                  {productName}
                </p>
              )}
            </div>

            {/* Share actions */}
            <div className="flex flex-col gap-2 p-5">
              <div className="grid grid-cols-3 gap-2">
                <ShareLink href={intents.x} bg="oklch(0.20 0.01 285)" label="X" />
                <ShareLink href={intents.linkedin} bg="oklch(0.45 0.13 250)" label="LinkedIn" />
                <ShareLink href={intents.reddit} bg="oklch(0.63 0.21 35)" label="Reddit" />
              </div>
              <button
                type="button"
                onClick={copyLink}
                className="flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--fill-subtle)]"
                style={{ borderColor: "var(--hairline)", color: "var(--color-fg)" }}
              >
                {copied ? "Copied to clipboard ✓" : "Copy report link"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ShareLink({ href, bg, label }: { href: string; bg: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-center rounded-lg px-3 py-2.5 text-sm font-semibold text-white transition-transform hover:-translate-y-px"
      style={{ background: bg }}
    >
      {label}
    </a>
  );
}
