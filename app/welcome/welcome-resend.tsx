"use client";

/**
 * WelcomeResend — "Resend login link" for the post-checkout welcome page.
 *
 * Re-sends the magic link via the browser-initiated OTP flow (/api/auth/magic-link
 * → /auth/callback), which works in-browser. If the email is known (from the
 * Stripe session) it's pre-filled; otherwise the user types it.
 */

import { useState } from "react";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "sent" }
  | { status: "error"; message: string };

export function WelcomeResend({ email: known }: { email: string | null }) {
  const [email, setEmail] = useState(known ?? "");
  const [state, setState] = useState<State>({ status: "idle" });

  async function resend(value: string) {
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value, next: "/welcome" }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { message?: string };
        setState({ status: "error", message: b.message ?? "Could not resend — try again." });
        return;
      }
      setState({ status: "sent" });
    } catch {
      setState({ status: "error", message: "Network error — try again." });
    }
  }

  if (state.status === "sent") {
    return (
      <p className="text-sm" style={{ color: "var(--color-success)" }}>
        Sent — check your inbox.
      </p>
    );
  }

  return (
    <form
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        if (email.trim()) void resend(email.trim());
      }}
    >
      {!known && (
        <input
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (state.status === "error") setState({ status: "idle" });
          }}
          aria-label="Email address"
          className="h-10 w-full min-w-0 rounded-lg border border-input bg-transparent px-4 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      )}
      <button
        type="submit"
        disabled={state.status === "loading" || !email.trim()}
        className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg px-4 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50"
        style={{ background: "var(--fill-subtle)", color: "var(--color-fg)", border: "1px solid var(--hairline)" }}
      >
        {state.status === "loading" ? "Sending…" : "Resend login link"}
      </button>
      {state.status === "error" && (
        <p className="text-sm text-destructive" role="alert">
          {state.message}
        </p>
      )}
    </form>
  );
}
