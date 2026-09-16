// SPEC §5 — the "check connection" press, as both screens that offer it
// render it: `/setup`, beside the record before the founder submits, and
// Settings, beside the record a host still waiting for DNS shows (#757).
//
// One block, so the two screens cannot drift (#754's lesson): one Server
// Function, one mapping from what it answered to the line the founder reads.
// daisyUI in place — `btn`, `loading`, `alert` — and no wrapper around them.
//
// **Three answers stay three.** "Live", "waiting for DNS" and "nothing could
// be asked" each have their own line, and the third is never drawn as the
// second. A press inside the floor asked nothing: the line from the last
// answer stays on screen, beside a line saying when the founder may ask
// again, so an old answer is never passed off as a new one.
"use client";

import type React from "react";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { checkConnection, type ConnectionCheck } from "./check-actions";

/** An answer that says something about the host, or that nothing could be
 *  asked — the one the founder keeps reading until a later press replaces
 *  it. */
type Answer = Extract<ConnectionCheck, { outcome: "asked" | "could_not_ask" | "refused" }>;

const GOOD = "alert alert-success alert-soft text-sm";
const WAITING = "alert alert-warning alert-soft text-sm";
const NOT_ASKED = "alert alert-error alert-soft text-sm";

/** The line for an answer, or `null` where there is nothing to say here —
 *  `no_host` is an account whose Settings card is redrawn without this
 *  block. `id` names the outcome for the suites, never for the founder. */
function answerLine(answer: Answer): { key: CopyKey; tone: string; id: string } | null {
  switch (answer.outcome) {
    case "asked":
      return answer.state === "live"
        ? { key: "settings.destination.check.live", tone: GOOD, id: "live" }
        : { key: "settings.destination.check.pending-dns", tone: WAITING, id: "pending_dns" };
    case "could_not_ask":
      return { key: "settings.destination.check.could-not-ask", tone: NOT_ASKED, id: "could_not_ask" };
    case "refused":
      if (answer.because === "no_host") return null;
      return { key: REFUSAL_COPY_KEY[answer.because], tone: NOT_ASKED, id: "refused" };
  }
}

/** A press refused before the vendor was asked. §5's two label refusals are
 *  the field's own lines; the address one is this press's. */
const REFUSAL_COPY_KEY = {
  not_a_label: "setup.destination.label.refused.invalid",
  taken: "setup.destination.label.refused.taken",
  address_unsaved: "setup.destination.check.address-unsaved",
} as const satisfies Record<string, CopyKey>;

export function CheckConnection(p: {
  /** `/setup`'s label and address before submit; `null` from Settings. */
  draft: { label: string; domain: string | null } | null;
  /** Told of each answer, so `/setup` can draw the record's own word from
   *  it. Settings passes none: its card is redrawn from the row. */
  onAnswer?: (answer: ConnectionCheck) => void;
}): React.JSX.Element {
  const [running, setRunning] = useState(false);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [askAgainInS, setAskAgainInS] = useState<number | null>(null);

  async function press(): Promise<void> {
    setRunning(true);
    try {
      const next = await checkConnection({ draft: p.draft });
      if (next.outcome === "too_soon") {
        setAskAgainInS(next.askAgainInS);
      } else {
        setAskAgainInS(null);
        setAnswer(next);
      }
      p.onAnswer?.(next);
    } catch {
      // The press did not complete: nothing was asked, and the founder is
      // told so rather than left with whatever was shown before.
      setAskAgainInS(null);
      setAnswer({ outcome: "could_not_ask" });
    } finally {
      setRunning(false);
    }
  }

  const line = answer === null ? null : answerLine(answer);

  return (
    <div className="flex min-w-0 flex-col gap-2" data-testid="check-connection">
      <button
        type="button"
        className="btn btn-outline btn-sm self-start"
        disabled={running}
        onClick={() => {
          void press();
        }}
        data-testid="check-connection-press"
      >
        {running ? (
          <span className="loading loading-spinner loading-xs" aria-hidden />
        ) : (
          <RefreshCw aria-hidden size={16} strokeWidth={1.75} />
        )}
        {copy("settings.destination.check.button")}
      </button>
      {line === null ? null : (
        <div role="status" className={line.tone} data-testid="check-connection-answer" data-outcome={line.id}>
          {copy(line.key)}
        </div>
      )}
      {askAgainInS === null ? null : (
        <div role="status" className="alert alert-soft text-sm" data-testid="check-connection-too-soon">
          {copy("settings.destination.check.too-soon", { seconds: askAgainInS })}
        </div>
      )}
    </div>
  );
}
