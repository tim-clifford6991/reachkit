"use client";

/**
 * LoginForm — passwordless magic-link sign-in (Supabase OTP).
 *
 * Sends a magic link to the entered email; clicking it hits /auth/callback,
 * which exchanges the code for a session and redirects to /app. Same flow works
 * for returning and brand-new users, so it doubles as sign-up.
 */

import { useState } from "react";

// Native elements (no @base-ui) — keeps this otherwise-light page out of the
// heavier component bundle, mirroring ScanInput's approach.

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "sent"; email: string }
  | { status: "error"; message: string };

export function LoginForm({ next }: { next?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>({ status: "idle" });

  async function submit(value: string) {
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value, next }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { message?: string };
        setState({ status: "error", message: b.message ?? "Something went wrong. Please try again." });
        return;
      }
      setState({ status: "sent", email: value });
    } catch {
      setState({ status: "error", message: "Network error. Please try again." });
    }
  }

  if (state.status === "sent") {
    return (
      <div
        className="flex items-start gap-3 rounded-xl border px-5 py-4"
        style={{ borderColor: "var(--color-success-subtle)", background: "var(--color-success-subtle)" }}
      >
        <span
          className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full"
          style={{ background: "var(--color-success)", color: "var(--color-success-fg)" }}
          aria-hidden
        >
          ✓
        </span>
        <div className="space-y-0.5">
          <p className="text-sm font-medium" style={{ color: "var(--color-fg)" }}>
            Magic link sent
          </p>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            Check <span style={{ color: "var(--color-accent-400)" }}>{state.email}</span> and click the
            link to sign in.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (email.trim()) void submit(email.trim());
      }}
    >
      <input
        type="email"
        autoComplete="email"
        autoFocus
        placeholder="you@company.com"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (state.status === "error") setState({ status: "idle" });
        }}
        aria-label="Email address"
        aria-invalid={state.status === "error" || undefined}
        disabled={state.status === "loading"}
        className="h-[50px] w-full min-w-0 rounded-[12px] border bg-white px-4 text-base font-medium text-[#14131A] outline-none transition-colors placeholder:text-[#9A97A5] focus-visible:border-[#6E56F7] focus-visible:ring-4 focus-visible:ring-[#6E56F7]/15 disabled:opacity-60 border-[#ECEAF3]"
      />
      {state.status === "error" && (
        <p className="text-sm text-destructive" role="alert">
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={state.status === "loading"}
        className="inline-flex h-[50px] w-full items-center justify-center rounded-[12px] bg-[#6E56F7] px-5 text-sm font-semibold text-white outline-none transition-all hover:bg-[#5d46e8] active:scale-[0.99] focus-visible:ring-4 focus-visible:ring-[#6E56F7]/25 disabled:pointer-events-none disabled:opacity-70"
      >
        {state.status === "loading" ? "Sending…" : "Email me a magic link"}
      </button>
    </form>
  );
}
