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
//
// **The wait counts down, and the button waits with it** (issue 840). A
// press inside the floor starts a countdown to the moment the founder may
// ask again; the button is disabled until it reaches zero, then the line
// goes and the button comes back. "Nothing could be asked" says why: a
// deployment with no verification bound is told apart from a vendor that did
// not answer, and only the second tells the founder to try again.
//
// **Two steps, in order** (issue 856). The press asks public DNS first, and
// its line comes first: found and pointing here, found and pointing
// elsewhere (and where), or not yet. The domain list's line is the second
// step. Where the vendor says live, the DNS line is not drawn: the
// connection works, and a proxy's addresses are not worth a warning. A
// deployment with no verification bound says so only as the second step,
// in words that follow what the DNS step confirmed.
"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import type { PublicDns } from "@/lib/publish/destinations/hosted/dns-check";
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
      if (answer.because === "no_answer") {
        return { key: "settings.destination.check.could-not-ask", tone: NOT_ASKED, id: "could_not_ask" };
      }
      // Not set up on our side: the founder's part may already be done.
      return answer.dns?.state === "points_here"
        ? { key: "settings.destination.check.not-configured", tone: GOOD, id: "not_configured" }
        : { key: "settings.destination.check.not-configured.unconfirmed", tone: WAITING, id: "not_configured" };
    case "refused":
      if (answer.because === "no_host") return null;
      return { key: REFUSAL_COPY_KEY[answer.because], tone: NOT_ASKED, id: "refused" };
  }
}

/** The first step's line: what public DNS said about the record, or `null`
 *  where the press did not reach it, or the vendor has said live. */
function dnsLine(answer: Answer): { text: string; tone: string; id: PublicDns["state"] } | null {
  if (answer.outcome === "refused" || answer.dns === null) return null;
  if (answer.outcome === "asked" && answer.state === "live") return null;
  const dns = answer.dns;
  switch (dns.state) {
    case "points_here":
      return { text: copy("settings.destination.check.dns.points-here"), tone: GOOD, id: dns.state };
    case "points_elsewhere":
      return {
        text: copy("settings.destination.check.dns.points-elsewhere", { target: dns.target }),
        tone: WAITING,
        id: dns.state,
      };
    case "not_yet":
      return { text: copy("settings.destination.check.dns.not-yet"), tone: WAITING, id: dns.state };
    case "unknown":
      return { text: copy("settings.destination.check.dns.unknown"), tone: NOT_ASKED, id: dns.state };
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
  /** When, by this browser's clock, the founder may ask again — `null`
   *  while nothing is being waited out. Counted from the server's
   *  `askAgainInS` rather than its `askAgainAt`, so a clock that disagrees
   *  with the server's cannot stretch or skip the wait. */
  const [askAgainAt, setAskAgainAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (askAgainAt === null) return;
    const tick = setInterval(() => {
      const at = Date.now();
      setNow(at);
      if (at >= askAgainAt) setAskAgainAt(null);
    }, 1000);
    return () => clearInterval(tick);
  }, [askAgainAt]);

  const askAgainInS = askAgainAt === null ? 0 : Math.ceil((askAgainAt - now) / 1000);
  const waiting = askAgainAt !== null && askAgainInS > 0;

  async function press(): Promise<void> {
    setRunning(true);
    try {
      const next = await checkConnection({ draft: p.draft });
      if (next.outcome === "too_soon") {
        const at = Date.now();
        setNow(at);
        setAskAgainAt(at + next.askAgainInS * 1000);
      } else {
        setAskAgainAt(null);
        setAnswer(next);
      }
      p.onAnswer?.(next);
    } catch {
      // The press did not complete: nothing was asked, and the founder is
      // told so rather than left with whatever was shown before.
      setAskAgainAt(null);
      setAnswer({ outcome: "could_not_ask", because: "no_answer", dns: null });
    } finally {
      setRunning(false);
    }
  }

  const line = answer === null ? null : answerLine(answer);
  const dns = answer === null ? null : dnsLine(answer);

  return (
    <div className="flex min-w-0 flex-col gap-2" data-testid="check-connection">
      <button
        type="button"
        className={`btn btn-outline btn-sm self-start${waiting ? " btn-disabled" : ""}`}
        disabled={running || waiting}
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
      {dns === null ? null : (
        <div role="status" className={dns.tone} data-testid="check-connection-dns" data-dns={dns.id}>
          {dns.text}
        </div>
      )}
      {line === null ? null : (
        <div role="status" className={line.tone} data-testid="check-connection-answer" data-outcome={line.id}>
          {copy(line.key)}
        </div>
      )}
      {!waiting ? null : (
        <div role="status" className="alert alert-soft text-sm" data-testid="check-connection-too-soon">
          {copy("settings.destination.check.too-soon", { seconds: askAgainInS })}
        </div>
      )}
    </div>
  );
}
