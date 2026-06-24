"use client";

/**
 * CapturedShareButton — the results-screen "Share score" button + share modal
 * (dark violet-gradient score card + X / LinkedIn / Reddit / copy), styled 1:1
 * with the mockup. Drop-in for ResultsScreen's header.
 */

import { useEffect, useState } from "react";

const SG = "Space Grotesk", JM = "JetBrains Mono", PJ = "Plus Jakarta Sans";

export function CapturedShareButton({
  slug,
  score,
  bandLabel,
  siteLabel,
}: {
  slug: string;
  score: number;
  bandLabel: string;
  siteLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/report/${slug}` : `/report/${slug}`;
  const text = `My Discoverability Score is ${score}/100 (${bandLabel}). See how findable your product is:`;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const intents = {
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    reddit: `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`,
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop */
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: PJ, fontWeight: 600, fontSize: 13.5, color: "var(--c-action)", background: "var(--c-surface)", border: "1.5px solid #E2DBF7", borderRadius: 9, padding: "8px 14px", cursor: "pointer" }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6E56F7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
          <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" /><line x1="15.4" y1="6.5" x2="8.6" y2="10.5" />
        </svg>
        Share score
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "oklch(0.14 0.01 285 / 0.55)", backdropFilter: "blur(4px)" }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 380, overflow: "hidden", borderRadius: 18, background: "var(--c-surface)", boxShadow: "0 40px 90px -30px oklch(0.14 0.01 285 / 0.6)" }}>
            <div style={{ position: "relative", overflow: "hidden", padding: 28, textAlign: "center", background: "linear-gradient(150deg, var(--c-action) 0%, var(--c-dark2) 100%)" }}>
              <svg style={{ position: "absolute", right: -40, top: -40, opacity: 0.2 }} width="180" height="180" viewBox="0 0 180 180" aria-hidden>
                <circle cx="90" cy="90" r="40" fill="none" stroke="#fff" strokeWidth="1" />
                <circle cx="90" cy="90" r="62" fill="none" stroke="#fff" strokeWidth="1" />
                <circle cx="90" cy="90" r="84" fill="none" stroke="#fff" strokeWidth="1" />
              </svg>
              <p style={{ position: "relative", fontFamily: JM, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,0.7)" }}>Discoverability Score</p>
              <p style={{ position: "relative", marginTop: 8, fontFamily: JM, fontWeight: 700, fontSize: "3.25rem", lineHeight: 1, color: "#fff" }}>{score}<span style={{ fontSize: 20, color: "rgba(255,255,255,0.55)" }}>/100</span></p>
              <span style={{ position: "relative", marginTop: 10, display: "inline-block", borderRadius: 999, padding: "4px 12px", fontSize: 12, fontWeight: 700, background: "rgba(255,255,255,0.16)", color: "#fff" }}>{bandLabel}</span>
              <p style={{ position: "relative", marginTop: 10, fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{siteLabel}</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 18 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                <ShareLink href={intents.x} bg="#322E4A" label="Post on X" />
                <ShareLink href={intents.linkedin} bg="#0A66C2" label="LinkedIn" />
                <ShareLink href={intents.reddit} bg="#FF4500" label="Reddit" />
              </div>
              <button type="button" onClick={copy} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 10, border: "1px solid var(--c-line)", padding: "11px 14px", fontFamily: PJ, fontSize: 14, fontWeight: 600, color: "var(--c-ink)", background: "var(--c-surface)", cursor: "pointer" }}>
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
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10, padding: "10px 6px", fontFamily: SG, fontSize: 12.5, fontWeight: 600, color: "#fff", background: bg, textDecoration: "none" }}>
      {label}
    </a>
  );
}
