// SPEC §2, issue 715 — the "Retry this part" control, on the card whose
// part a ceiling cut off.
//
// SPEC §2: "measured cards still render with 'Retry this part'". The owner's
// ruling of 2026-09-22 says what pressing it does — it "re-runs only that
// part inside the same budget" — and SPEC §1's 2026-09-20 line says what it
// may not do: be drawn and do nothing. This is that control.
//
// It posts the part to `POST /api/report/{domain}/retry` and then follows
// the re-measurement on the report itself, with the same named stages the
// scanning screen draws and the same ending event that asks the server to
// resolve the address again — so the fuller report replaces this one
// without a reload. That is exactly what `correction.tsx` beside it already
// does for the other re-measurement this screen can start, and it is the
// same component (`ScanProgress`) doing it, not a second copy.
//
// Every refusal the route answers is a handle, turned into a line here. No
// refusal sentence names a figure: the 12¢ cap and what is left of it are
// the scan module's, and a number restated here could drift from it.
//
// daisyUI in the route (DESIGN rule 1): `btn`, `alert`. The screen's one
// solid primary is the offer's Start, so this is an outline button.
"use client";

import { useState } from "react";
import { CircleAlert } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import type { CanonicalDomain } from "@/lib/scan/domain";
import type { RetryPart, RetryRefusal } from "@/lib/scan/retry";
import type { RetryPartResponse } from "@/app/api/report/[domain]/retry/route";
import { ScanProgress } from "./progress";

/** One written line per refusal the route can answer with. A total map, so
 *  a seventh refusal fails the build here rather than reaching a reader as
 *  a blank alert. The three that mean "this part is not missing" share one
 *  line because they are one fact to the reader: it is already measured. */
const REFUSAL_LINE: Readonly<Record<RetryRefusal, CopyKey>> = Object.freeze({
  no_budget_left: "retry-part.refused.no-budget",
  not_cut_off: "retry-part.refused.already-measured",
  part_present: "retry-part.refused.already-measured",
  no_current_report: "retry-part.refused.unavailable",
  domain_removed: "retry-part.refused.unavailable",
  scanning_unavailable: "retry-part.refused.unavailable",
});

type Step =
  | { kind: "idle"; refused: CopyKey | null }
  | { kind: "sending" }
  | { kind: "running"; scanId: string };

/** What a press came back with: the retry's own scan id, or the line to
 *  show. A network failure and a body that is not this route's shape both
 *  land on the same line — nothing was spent either way. */
async function submit(domain: CanonicalDomain, part: RetryPart): Promise<{ scanId: string } | { refused: CopyKey }> {
  try {
    const response = await fetch(`/api/report/${domain}/retry`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ part }),
    });
    const body = (await response.json()) as RetryPartResponse;
    if (body.ok) return { scanId: body.scanId };
    if ("refused" in body) return { refused: REFUSAL_LINE[body.refused] };
  } catch {
    // A network failure, or a body that is not the route's own shape.
  }
  return { refused: "retry-part.refused.unavailable" };
}

export function RetryPartControl(p: {
  domain: CanonicalDomain;
  part: RetryPart;
}): React.JSX.Element {
  const [step, setStep] = useState<Step>({ kind: "idle", refused: null });

  if (step.kind === "running") {
    return (
      <div className="text-base-content flex flex-col gap-2 text-sm" data-testid={`retry-${p.part}-running`}>
        <p>{copy("retry-part.running")}</p>
        <ScanProgress domain={p.domain} scanId={step.scanId} />
      </div>
    );
  }

  const onClick = async (): Promise<void> => {
    setStep({ kind: "sending" });
    const answer = await submit(p.domain, p.part);
    setStep("scanId" in answer ? { kind: "running", scanId: answer.scanId } : { kind: "idle", refused: answer.refused });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="card-actions">
        <button
          type="button"
          className="btn btn-outline btn-primary btn-sm"
          disabled={step.kind === "sending"}
          data-testid={`retry-${p.part}`}
          onClick={() => void onClick()}
        >
          {step.kind === "sending" ? <span className="loading loading-spinner loading-xs" aria-hidden /> : null}
          {copy("control.retry-part")}
        </button>
      </div>
      {step.kind === "idle" && step.refused !== null ? (
        <div role="alert" className="alert alert-warning text-sm">
          <CircleAlert size={20} strokeWidth={1.75} aria-hidden />
          <span>{copy(step.refused)}</span>
        </div>
      ) : null}
    </div>
  );
}
