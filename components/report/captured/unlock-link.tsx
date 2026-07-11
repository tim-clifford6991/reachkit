"use client";

/**
 * UnlockLink — an INLINE clickable "unlock" call-to-action that starts the same
 * anonymous Stripe checkout as CapturedUnlockButton (`POST /api/scan/[id]/checkout`
 * → redirect to Stripe). Used to make every "🔒 unlock …" teaser across the free
 * report a real conversion surface, not dead text (the funnel's whole job).
 *
 * Renders as an accessible inline button styled like an action link. When no
 * scanId is available (e.g. the design/demo render), it degrades to a plain
 * non-interactive span so the copy still reads.
 */

import { useState, type ReactNode } from "react";

export function UnlockLink({
  scanId,
  children,
  plan = "solo",
}: {
  scanId?: string;
  children: ReactNode;
  plan?: "solo" | "growth";
}) {
  const [loading, setLoading] = useState(false);

  if (!scanId) {
    return <span style={{ color: "var(--c-action)", fontWeight: 700 }}>{children}</span>;
  }

  async function start() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/scan/${scanId}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string };
      if (res.ok && data.url) window.location.href = data.url;
      else setLoading(false);
    } catch {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={start}
      disabled={loading}
      style={{
        display: "inline",
        padding: 0,
        margin: 0,
        border: "none",
        background: "none",
        font: "inherit",
        color: "var(--c-action)",
        fontWeight: 700,
        cursor: "pointer",
        textDecoration: "underline",
        textUnderlineOffset: 2,
        opacity: loading ? 0.7 : 1,
      }}
    >
      {loading ? "Starting checkout…" : children}
    </button>
  );
}
