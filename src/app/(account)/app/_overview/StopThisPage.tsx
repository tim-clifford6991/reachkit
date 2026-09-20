// SPEC §4 (2026-09-20, #908) — "Stop this page", and the words it answers in.
//
// Two rulings of that date meet on this one button:
//
//   · **"Every action answers."** Stop confirms or refuses in words on
//     screen. There is no optimistic arm: the line is set from what the
//     machine answered, and while the call is in flight the control says so
//     by being busy rather than by claiming a result.
//   · **"Screens and mail say *Stop this page*."** "Veto" is the internal
//     word and the name of the mechanism, and it is not printed here.
//
// **It writes through the one seam.** `publishing.veto` is the calendar's
// declared machine (`calendar/publishing.ts`), which is the only path from a
// click to §9's `transition()`. This screen holds no second copy of the
// rule, checks no ownership of its own — the Server Function does, keyed on
// `(id, site_id)` — and decides nothing about which states may be stopped.
//
// **A stop changes the screen**, and the Server Function revalidates `/app`
// once the machine confirms: the card leaves, the head falls back to the
// series' own line and the week strip loses its review day. Nothing here
// mutates a model in place, and nothing is set before the answer arrives.
"use client";

import type React from "react";
import { useState, useTransition } from "react";
import { CircleCheck, CircleStop, CircleX } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { stopPage } from "./stop-actions";

/** What the machine last said. `idle` is "nothing has been asked yet" and is
 *  not a result: the line is drawn only once there is one. */
type Answer = "idle" | "stopped" | "refused";

export function StopThisPage(p: { draftId: string }): React.JSX.Element {
  const [answer, setAnswer] = useState<Answer>("idle");
  const [pending, startTransition] = useTransition();

  const stop = (): void => {
    // The Server Function revalidates `/app` on a stop, so the screen that
    // comes back no longer holds this card. Nothing is set optimistically:
    // the line below is whatever the machine answered.
    startTransition(async () => {
      setAnswer((await stopPage(p.draftId)) ? "stopped" : "refused");
    });
  };

  return (
    <div className="flex min-w-0 flex-col gap-2" data-testid="overview-stop">
      <button
        type="button"
        className="btn btn-outline btn-warning"
        onClick={stop}
        disabled={pending || answer === "stopped"}
        data-testid="overview-stop-action"
      >
        <CircleStop size={20} strokeWidth={1.75} aria-hidden />
        {copy("overview.waiting.stop")}
      </button>
      {answer === "idle" ? null : (
        <p
          role="status"
          className={`flex items-center gap-2 text-xs ${answer === "stopped" ? "text-success" : "text-error"}`}
          data-testid="overview-stop-answer"
        >
          {answer === "stopped" ? (
            <CircleCheck size={16} strokeWidth={1.75} aria-hidden />
          ) : (
            <CircleX size={16} strokeWidth={1.75} aria-hidden />
          )}
          {copy(answer === "stopped" ? "overview.waiting.stopped" : "overview.waiting.stop-refused")}
        </p>
      )}
    </div>
  );
}
