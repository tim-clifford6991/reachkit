// SPEC §7 (issue 1532) — *Take down* on a live page and *Put back* inside
// its window, on Plan's *Published* list and on the page's own screen.
//
// The take-down asks once, in the page itself: the first press opens the
// question with its two answers beside the control, never a `confirm()`
// dialog. The put-back asks nothing — it undoes the customer's own act.
// The press is the busy pattern (`docs/DESIGN.md`, 2026-10-02): disabled at
// once, a spinner in place of the icon, and one `sonner` answer when the
// write lands or is refused. The screen re-reads on its own: the action
// revalidates Plan and the page.
//
// Every sentence arrives as a prop, read from the registry by the caller.
"use client";

import type React from "react";
import { useState, useTransition } from "react";
import { ArchiveRestore, EyeOff } from "lucide-react";
import { say } from "../../../_toast/say";
import { putBackDraft, takeDownDraft } from "./publishing-actions";

export interface TakeDownWords {
  action: string;
  question: string;
  confirm: string;
  keep: string;
  done: string;
  refused: string;
}

export interface PutBackWords {
  action: string;
  done: string;
  refused: string;
}

export function TakeDownControl(
  p: { draftId: string } & ({ mode: "take_down"; words: TakeDownWords } | { mode: "put_back"; words: PutBackWords })
): React.JSX.Element {
  const [asking, setAsking] = useState(false);
  const [busy, startTransition] = useTransition();

  function press(): void {
    startTransition(async () => {
      let refused: string | null;
      try {
        refused = await (p.mode === "take_down" ? takeDownDraft(p.draftId) : putBackDraft(p.draftId));
      } catch {
        refused = "unreachable";
      }
      setAsking(false);
      say(refused === null ? p.words.done : p.words.refused, refused === null ? "ok" : "bad");
    });
  }

  const spinner = <span className="loading loading-spinner loading-xs" aria-hidden />;

  if (p.mode === "put_back") {
    return (
      <button
        type="button"
        className="btn btn-sm btn-soft"
        data-testid="put-back"
        disabled={busy}
        onClick={press}
      >
        {busy ? spinner : <ArchiveRestore size={14} strokeWidth={1.75} aria-hidden />}
        {p.words.action}
      </button>
    );
  }

  if (!asking) {
    return (
      <button
        type="button"
        className="btn btn-sm btn-ghost btn-warning"
        data-testid="take-down"
        onClick={() => setAsking(true)}
      >
        <EyeOff size={14} strokeWidth={1.75} aria-hidden />
        {p.words.action}
      </button>
    );
  }

  return (
    <div role="group" aria-label={p.words.action} className="flex min-w-0 flex-col gap-2" data-testid="take-down-ask">
      <p className="min-w-0 text-sm wrap-anywhere">{p.words.question}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-sm btn-warning"
          data-testid="take-down-confirm"
          disabled={busy}
          onClick={press}
        >
          {busy ? spinner : <EyeOff size={14} strokeWidth={1.75} aria-hidden />}
          {p.words.confirm}
        </button>
        <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={() => setAsking(false)}>
          {p.words.keep}
        </button>
      </div>
    </div>
  );
}
