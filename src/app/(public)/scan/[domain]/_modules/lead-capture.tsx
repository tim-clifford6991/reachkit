// SPEC §2 · §8 (issue 787) — the free page card's one control.
//
// An email address and nothing else (REQ-010 c1), posted with the report's
// scan to `POST /api/lead`. The route answers with a copy key, which is the
// one line shown back: accepted, an address that is not one, or a store
// that could not take it. The page itself is written and mailed by the
// `lead/nurture` tick — nothing here waits for it.
//
// daisyUI in the route: `input`, `btn` (soft — the report's one solid
// primary is the offer's Start), `alert`.
"use client";

import { useState, type FormEvent } from "react";
import { CircleAlert, CircleCheck, Mail } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import type { LeadResponse } from "@/app/api/lead/route";

type Step = { kind: "idle" } | { kind: "sending" } | { kind: "answered"; ok: boolean; message: CopyKey };

async function post(scanId: string, email: string): Promise<{ ok: boolean; message: CopyKey }> {
  try {
    const response = await fetch("/api/lead", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scanId, email }),
    });
    return (await response.json()) as LeadResponse;
  } catch {
    return { ok: false, message: "lead.unavailable" };
  }
}

export function LeadCapture(p: { scanId: string; consent: string }): React.JSX.Element {
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<Step>({ kind: "idle" });

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setStep({ kind: "sending" });
    const answer = await post(p.scanId, email);
    setStep({ kind: "answered", ...answer });
  }

  if (step.kind === "answered" && step.ok) {
    return (
      <div role="status" className="alert alert-success alert-soft" data-testid="lead-accepted">
        <CircleCheck size={20} strokeWidth={1.75} aria-hidden />
        <span>{copy(step.message)}</span>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-2.5" onSubmit={(event) => void onSubmit(event)} data-testid="lead-form">
      <label className="flex min-w-0 flex-col gap-2">
        <span className="text-sm font-semibold">{copy("free-page.email.label")}</span>
        <input
          className="input w-full"
          type="email"
          name="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={copy("free-page.email.placeholder")}
        />
      </label>
      <button type="submit" className="btn btn-soft btn-primary" disabled={step.kind === "sending"}>
        <Mail size={16} strokeWidth={1.75} aria-hidden />
        {copy("free-page.submit")}
      </button>
      <p className="text-base-content/70 text-sm">{p.consent}</p>
      {step.kind === "answered" ? (
        <div role="alert" className="alert alert-error alert-soft" data-testid="lead-refused">
          <CircleAlert size={20} strokeWidth={1.75} aria-hidden />
          <span>{copy(step.message)}</span>
        </div>
      ) : null}
    </form>
  );
}
