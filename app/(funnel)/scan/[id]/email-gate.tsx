"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { funnel } from "@/lib/analytics";

interface EmailGateProps {
  scanId: string;
}

type GateState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "sent"; email: string }
  | { status: "error"; message: string };

export function EmailGate({ scanId }: EmailGateProps) {
  const [gateState, setGateState] = useState<GateState>({ status: "idle" });
  const [email, setEmail] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Fire gate_viewed once on mount
  useEffect(() => {
    funnel.gateViewed({ scan_id: scanId });
  }, [scanId]);

  async function submit(emailValue: string) {
    setGateState({ status: "loading" });
    try {
      const res = await fetch(`/api/scan/${scanId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailValue }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        setGateState({
          status: "error",
          message: body.message ?? "Something went wrong. Please try again.",
        });
        return;
      }
      setGateState({ status: "sent", email: emailValue });
      funnel.emailSubmitted({ scan_id: scanId });
    } catch {
      setGateState({
        status: "error",
        message: "Network error. Please try again.",
      });
    }
  }

  // ── Sent state — confirmation + resend / change email ──────────────────────
  if (gateState.status === "sent") {
    return (
      <div className="space-y-4">
        {/* Success message */}
        <div
          className="flex items-start gap-3 rounded-xl border px-4 py-3"
          style={{
            borderColor: "var(--color-success-subtle)",
            background: "var(--color-success-subtle)",
          }}
        >
          <CheckIcon />
          <div className="space-y-0.5">
            <p
              className="text-sm font-medium"
              style={{ color: "var(--color-fg)" }}
            >
              Magic link sent
            </p>
            <p className="text-xs" style={{ color: "var(--color-muted)" }}>
              Check{" "}
              <span style={{ color: "var(--color-accent-400)" }}>
                {gateState.email}
              </span>{" "}
              — click the link to unlock your full report.
            </p>
          </div>
        </div>

        {/* Resend + change email */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="text-xs underline underline-offset-4 transition-colors"
            style={{ color: "var(--color-muted)" }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.color =
                "var(--color-fg)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.color =
                "var(--color-muted)")
            }
            onClick={() => void submit(gateState.email)}
          >
            Resend email
          </button>
          <span style={{ color: "var(--hairline-strong)" }} aria-hidden>
            ·
          </span>
          <button
            type="button"
            className="text-xs underline underline-offset-4 transition-colors"
            style={{ color: "var(--color-muted)" }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.color =
                "var(--color-fg)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.color =
                "var(--color-muted)")
            }
            onClick={() => {
              setEmail("");
              setGateState({ status: "idle" });
              setTimeout(() => inputRef.current?.focus(), 0);
            }}
          >
            Use a different email
          </button>
        </div>
      </div>
    );
  }

  // ── Default: ONE email field + send button ─────────────────────────────────
  return (
    <form
      className="flex flex-col gap-3 sm:flex-row sm:items-start"
      onSubmit={(e) => {
        e.preventDefault();
        if (email.trim()) void submit(email.trim());
      }}
    >
      <div className="flex-1 space-y-1.5">
        <Input
          ref={inputRef}
          id="unlock-email"
          type="email"
          autoComplete="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (gateState.status === "error") setGateState({ status: "idle" });
          }}
          aria-label="Your email address"
          aria-invalid={gateState.status === "error" || undefined}
          aria-describedby={
            gateState.status === "error" ? "email-gate-error" : undefined
          }
          disabled={gateState.status === "loading"}
        />
        {gateState.status === "error" && (
          <p
            id="email-gate-error"
            className="text-xs text-destructive"
            role="alert"
          >
            {gateState.message}
          </p>
        )}
      </div>
      <Button
        type="submit"
        size="lg"
        disabled={gateState.status === "loading" || !email.trim()}
        className="shrink-0"
      >
        {gateState.status === "loading" ? (
          <span className="flex items-center gap-2">
            <SpinnerIcon />
            Sending…
          </span>
        ) : (
          "Send my full report →"
        )}
      </Button>
    </form>
  );
}

// ── Inline SVG icons ──────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className="mt-0.5 shrink-0"
    >
      <circle cx="8" cy="8" r="7" fill="oklch(0.72 0.17 155 / 0.2)" />
      <path
        d="M5 8l2 2 4-4"
        stroke="oklch(0.72 0.17 155)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      className="animate-spin"
    >
      <circle
        cx="7"
        cy="7"
        r="5.5"
        stroke="currentColor"
        strokeOpacity="0.3"
        strokeWidth="2"
      />
      <path
        d="M12.5 7a5.5 5.5 0 0 0-5.5-5.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
