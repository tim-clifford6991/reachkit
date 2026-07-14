"use client";

/**
 * Cookie-consent banner (launch P3). Analytics default to OFF: PostHog inits
 * with `opt_out_capturing_by_default` and captures nothing until the visitor
 * accepts here (GDPR/ePrivacy). The choice persists in localStorage; the banner
 * only shows while no choice exists. Essential cookies (auth/session) aren't
 * gated — only analytics.
 */

import { useState } from "react";
import { consentChoice, grantConsent, revokeConsent } from "@/lib/analytics";

export function CookieBanner() {
  // Client-only (mounted via a dynamic ssr:false wrapper), so reading
  // localStorage in the initializer is safe — no SSR flash / hydration mismatch.
  // Show only until the visitor has made a choice.
  const [show, setShow] = useState(() => consentChoice() === null);

  if (!show) return null;

  const decide = (accept: boolean) => {
    if (accept) grantConsent();
    else revokeConsent();
    setShow(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      style={{
        position: "fixed", left: 16, right: 16, bottom: 16, zIndex: 1000,
        maxWidth: 520, margin: "0 auto",
        background: "var(--c-surface)", color: "var(--c-ink)",
        border: "1px solid var(--c-line)", borderRadius: "var(--radius-lg)",
        boxShadow: "var(--elevation-3, 0 12px 40px rgba(0,0,0,0.18))",
        padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12,
        fontFamily: "var(--font-sans)",
      }}
    >
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "var(--c-muted)" }}>
        We use a few essential cookies to run ReachKit, and optional analytics cookies to understand
        product usage. Analytics stay off until you accept. See our{" "}
        <a href="/privacy" style={{ color: "var(--c-action)", fontWeight: 600, textDecoration: "none" }}>Privacy Policy</a>.
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => decide(false)}
          style={{ border: "1px solid var(--c-line)", background: "none", color: "var(--c-ink)", borderRadius: "var(--radius-full)", padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          Reject analytics
        </button>
        <button
          type="button"
          onClick={() => decide(true)}
          style={{ border: "none", background: "var(--c-action)", color: "var(--c-on-dark)", borderRadius: "var(--radius-full)", padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
        >
          Accept
        </button>
      </div>
    </div>
  );
}
