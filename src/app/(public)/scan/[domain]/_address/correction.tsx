// SPEC §2 — the report header's category correction (#786)
//
// "Not your market?" opens one inline field for the market in the
// visitor's own words, posts it to `POST /api/report/{domain}/correct`,
// and follows the rerun on the report itself: the same named stages the
// scanning screen draws, and the same ending event that asks the server to
// resolve the address again, so the corrected report replaces this one
// without a reload.
//
// **One correction per report** (SPEC §2). Whether the control is drawn
// at all is the offer's to say, decided on the server against the visit's
// clock (`resolve.ts`); this component only renders it. A correction
// already under way when the page was served names itself in one line —
// that visit does not hold the rerun's id, so it draws no stages.
//
// Every refusal the route answers is a handle, turned into a line here. No
// refusal sentence names an attempt count or the offer's age bound: both
// are the market module's, and a figure restated here could drift from it.
//
// daisyUI in the route (DESIGN rule 1): `btn`, `fieldset`, `input`, `join`,
// `alert`. The screen's one solid primary is the offer's Start, so every
// control here is ghost or outline.
"use client";

import { useState, type FormEvent } from "react";
import { CircleAlert } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import type { CanonicalDomain } from "@/lib/scan/domain";
import type { CorrectionOffer } from "@/lib/market/coherence/offer";
import type { CorrectReportResponse, CorrectionRefusal } from "@/app/api/report/[domain]/correct/route";
import { ScanProgress } from "./progress";

const REFUSAL_LINE: Readonly<Record<CorrectionRefusal, CopyKey>> = Object.freeze({
  in_progress: "correction.refused.running",
  already_running: "correction.refused.running",
  used: "correction.refused.used",
  exhausted: "correction.refused.used",
  already_used: "correction.refused.used",
  report_too_old: "correction.refused.too-old",
  domain_removed: "correction.refused.unavailable",
  no_current_report: "correction.refused.unavailable",
  scanning_unavailable: "correction.refused.unavailable",
});

type Step =
  | { kind: "closed" }
  | { kind: "open"; sending: boolean; refused: CopyKey | null }
  | { kind: "running"; scanId: string };

/** What a submission came back with: the rerun's id, or the line to show. */
async function submit(domain: CanonicalDomain, category: string): Promise<{ scanId: string } | { refused: CopyKey }> {
  try {
    const response = await fetch(`/api/report/${domain}/correct`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ category }),
    });
    const body = (await response.json()) as CorrectReportResponse;
    if (body.ok) return { scanId: body.scanId };
    if ("refused" in body) return { refused: REFUSAL_LINE[body.refused] };
  } catch {
    // A network failure, or a body that is not the route's own shape.
  }
  return { refused: "correction.refused.unavailable" };
}

export function CategoryCorrection(p: { domain: CanonicalDomain; offer: CorrectionOffer }): React.JSX.Element | null {
  const [step, setStep] = useState<Step>({ kind: "closed" });
  const [category, setCategory] = useState("");

  if (step.kind === "running") {
    return (
      <div className="text-base-content flex basis-full flex-col gap-2 text-sm" data-testid="correction-running">
        <p>{copy("correction.running")}</p>
        <ScanProgress domain={p.domain} scanId={step.scanId} />
      </div>
    );
  }

  if (!p.offer.offered) {
    return p.offer.because === "in_progress" ? (
      <p className="text-base-content basis-full text-sm" data-testid="correction-in-progress">
        {copy("correction.running")}
      </p>
    ) : null;
  }

  if (step.kind === "closed") {
    return (
      <button
        type="button"
        className="btn btn-ghost btn-xs"
        aria-expanded={false}
        onClick={() => setStep({ kind: "open", sending: false, refused: null })}
      >
        {copy("verdict.not-your-market")}
      </button>
    );
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const trimmed = category.trim();
    if (trimmed.length === 0) return;
    setStep({ kind: "open", sending: true, refused: null });
    const answer = await submit(p.domain, trimmed);
    setStep("scanId" in answer ? { kind: "running", scanId: answer.scanId } : { kind: "open", sending: false, refused: answer.refused });
  };

  return (
    <form className="text-base-content basis-full" onSubmit={(event) => void onSubmit(event)} data-testid="correction-open">
      <fieldset className="fieldset" disabled={step.sending}>
        <legend className="fieldset-legend">{copy("correction.field.label")}</legend>
        <div className="join w-full">
          <input
            className="input input-sm join-item min-w-0 flex-1"
            name="category"
            required
            autoFocus
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            aria-label={copy("correction.field.label")}
          />
          <button type="submit" className="btn btn-outline btn-sm join-item">
            {step.sending ? <span className="loading loading-spinner loading-xs" aria-hidden /> : null}
            {copy("correction.submit")}
          </button>
        </div>
        <p className="label">{copy("correction.line")}</p>
        <div>
          <button type="button" className="btn btn-ghost btn-xs" onClick={() => setStep({ kind: "closed" })}>
            {copy("correction.cancel")}
          </button>
        </div>
      </fieldset>
      {step.refused === null ? null : (
        <div role="alert" className="alert alert-warning text-sm">
          <CircleAlert size={20} strokeWidth={1.75} aria-hidden />
          <span>{copy(step.refused)}</span>
        </div>
      )}
    </form>
  );
}
