// SPEC §7 (R9, owner 2026-10-22) — *Stop this page* on a live page and *Put
// it back* inside its window, on Plan's *Published* list and on the page's
// own screen.
//
// One press stops: what Stop does is said beside the button before it is
// pressed, so nothing asks again. The press is the busy pattern
// (`docs/DESIGN.md`, 2026-10-02): disabled at once, a spinner in place of the
// icon, and one `sonner` answer when the write lands or is refused. The
// action revalidates Plan and the page, so the screen re-reads on its own.
//
// Every sentence arrives as a prop, read from the registry by the caller.
"use client";

import type React from "react";
import { useTransition } from "react";
import { ArchiveRestore, CircleStop } from "lucide-react";
import { say } from "../../../_toast/say";
import { putBackDraft, takeDownDraft } from "./publishing-actions";

export interface ControlWords {
  action: string;
  done: string;
  refused: string;
}

// E7's ghost in warning, with the board's light edge; full width on a phone.
const STOP = "btn btn-ghost btn-warning border-warning/30 min-h-11 max-sm:w-full";
const QUIET = "link link-warning link-hover inline-flex min-h-11 items-center gap-1.5 self-start text-sm no-underline";

export function TakeDownControl(p: {
  draftId: string;
  mode: "stop" | "put_back";
  words: ControlWords;
  /** The id of the line that says what the press does. */
  describedBy?: string;
  /** A quiet link under a list row, rather than a button. */
  quiet?: boolean;
}): React.JSX.Element {
  const [busy, startTransition] = useTransition();

  function press(): void {
    startTransition(async () => {
      let refused: string | null;
      try {
        refused = await (p.mode === "stop" ? takeDownDraft(p.draftId) : putBackDraft(p.draftId));
      } catch {
        refused = "unreachable";
      }
      say(refused === null ? p.words.done : p.words.refused, refused === null ? "ok" : "bad");
    });
  }

  const Icon = p.mode === "stop" ? CircleStop : ArchiveRestore;
  return (
    <button
      type="button"
      className={p.quiet === true ? QUIET : p.mode === "stop" ? STOP : "btn btn-soft min-h-11"}
      data-testid={p.mode === "stop" ? "take-down" : "put-back"}
      aria-describedby={p.describedBy}
      disabled={busy}
      onClick={press}
    >
      {busy ? <span className="loading loading-spinner loading-xs" aria-hidden /> : <Icon size={14} strokeWidth={1.75} aria-hidden />}
      {p.words.action}
    </button>
  );
}
