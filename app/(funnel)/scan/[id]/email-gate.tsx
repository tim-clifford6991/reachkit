"use client";

import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
    } catch {
      setGateState({
        status: "error",
        message: "Network error. Please try again.",
      });
    }
  }

  if (gateState.status === "sent") {
    return (
      <div className="space-y-3 text-center">
        <p className="text-base font-medium text-foreground">
          Check your email — we sent a magic link to{" "}
          <span className="text-primary">{gateState.email}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          Click the link to unlock your full discoverability report.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
          <button
            type="button"
            className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
            onClick={() => submit(gateState.email)}
          >
            Resend email
          </button>
          <span className="text-muted-foreground/40" aria-hidden>
            ·
          </span>
          <button
            type="button"
            className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
            onClick={() => {
              setEmail("");
              setGateState({ status: "idle" });
              // Defer so the input re-renders before we focus
              setTimeout(() => inputRef.current?.focus(), 0);
            }}
          >
            Use a different email
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-3 sm:flex-row sm:items-start"
      onSubmit={(e) => {
        e.preventDefault();
        if (email.trim()) void submit(email.trim());
      }}
    >
      <div className="flex-1 space-y-1">
        <Input
          ref={inputRef}
          type="email"
          autoFocus
          autoComplete="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (gateState.status === "error") setGateState({ status: "idle" });
          }}
          aria-label="Your email address"
          aria-invalid={gateState.status === "error" || undefined}
          disabled={gateState.status === "loading"}
          className="h-9 text-sm"
        />
        {gateState.status === "error" && (
          <p className="text-xs text-destructive" role="alert">
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
        {gateState.status === "loading" ? "Sending…" : "Send my full report"}
      </Button>
    </form>
  );
}
