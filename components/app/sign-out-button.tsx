"use client";

/**
 * The sidebar sign-out control (WS6). Replaces the bare `⏻` power glyph with a
 * LABELLED "Sign out" button that asks for confirmation before signing out —
 * so a stray click in the footer can't drop the session.
 *
 * Security is preserved: sign-out is still a POST to `/auth/signout` (never a
 * GET link that prefetch/hover could fire). On confirm the hidden POST form is
 * submitted; on cancel nothing happens.
 *
 * The confirmation is the browser-native `confirm()` DELIBERATELY: this control
 * renders in `app-shell` on EVERY /app route, and the leanest app page
 * (/app/competitors) sits at exactly the 275 KB app-group budget with zero
 * headroom — a styled dialog's client machinery (state + the Base UI Dialog)
 * tips it over the ratchet. A native confirm adds ~zero bytes. Revisit with a
 * styled dialog if/when the app bundle is reduced (tracked follow-up).
 */

import { useRef } from "react";

export function SignOutButton() {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    // flexShrink:0 — this control sits beside a truncating name in the sidebar
    // footer; the NAME must give way, never the sign-out affordance.
    <form ref={formRef} action="/auth/signout" method="post" style={{ display: "flex", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => {
          if (window.confirm("Sign out of ReachKit? You'll need your email to sign back in.")) {
            formRef.current?.submit();
          }
        }}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          color: "var(--c-faint)", cursor: "pointer", background: "none", border: "none",
          padding: 0, fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 600, lineHeight: 1,
          whiteSpace: "nowrap",
        }}
      >
        <span aria-hidden="true" style={{ fontSize: 14 }}>⏻</span>
        Sign out
      </button>
    </form>
  );
}
