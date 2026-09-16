// SPEC §2 · §8 (#787) — the free page card's one control.
//
// An email address and nothing else (REQ-010 c1), posted with the report's
// scan to `POST /api/lead`. The route answers with a copy key, which is the
// one line shown back: accepted, an address that is not one, or a store
// that could not take it. The page itself is written and mailed by the
// `lead/nurture` tick — nothing here waits for it.
//
// daisyUI in the route: `input`, `btn` (outline — the report's one solid
// primary is the offer's Start), `alert`.
"use client";

import { useState, type FormEvent } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";
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

export function LeadCapture(p: { scanId: string }): React.JSX.Element {
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
      <div role="status" className="alert alert-success alert-soft" data-lead="accepted">
        <CircleCheck size={20} strokeWidth={1.75} aria-hidden />
        <span>{copy(step.message)}</span>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-2" onSubmit={(event) => void onSubmit(event)} data-lead="form">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-base-content/60 text-sm">{copy("free-page.email.label")}</span>
          <input
            className="input w-full"
            type="email"
            name="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={copy("free-page.email.placeholder")}
          />
        </label>
        <button type="submit" className="btn btn-outline btn-primary" disabled={step.kind === "sending"}>
          {copy("free-page.submit")}
        </button>
      </div>
      {step.kind === "answered" ? (
        <div role="alert" className="alert alert-error alert-soft" data-lead="refused">
          <CircleAlert size={20} strokeWidth={1.75} aria-hidden />
          <span>{copy(step.message)}</span>
        </div>
      ) : null}
    </form>
  );
}
