"use client";

/**
 * Root render-crash boundary (P4). This catches errors thrown by the ROOT
 * layout itself — where `app/error.tsx` can't help because the layout (and its
 * `<html>`/`<body>` + globals.css import) never rendered. So this component must
 * supply its own document shell.
 *
 * Because globals.css may not have loaded, colours reference the design tokens
 * WITH neutral fallbacks (`var(--c-ink, #14121a)`) so it still reads correctly
 * on a cold crash. Also reports the error to PostHog (consent-gated, best-effort).
 */

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
    void import("@/lib/analytics").then((m) =>
      m.captureException(error, { boundary: "global", digest: error.digest }),
    );
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 18,
          padding: "0 28px",
          textAlign: "center",
          fontFamily: "var(--font-sans, system-ui, sans-serif)",
          background: "var(--c-surface, #ffffff)",
          color: "var(--c-ink, #14121a)",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-mono, ui-monospace, monospace)",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--c-action, #6e56f7)",
            margin: 0,
          }}
        >
          Something went wrong
        </p>
        <h1 style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 700, lineHeight: 1.05, margin: 0 }}>
          We hit an unexpected error
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.5, color: "var(--c-muted, #5b5670)", margin: 0, maxWidth: 440 }}>
          This one&apos;s on us. Try again — if it keeps happening, reload the page in a moment.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            background: "var(--c-action, #6e56f7)",
            color: "#fff",
            borderRadius: 10,
            padding: "11px 20px",
            fontSize: 14,
            fontWeight: 600,
            border: "none",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
