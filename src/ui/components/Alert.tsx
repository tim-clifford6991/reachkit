// BUILD §2.2 — daisyUI `alert`, in its four tones.
// src/ui/components/Alert.tsx
//
// `components.md` §1, verbatim: "`alert`, four tones. `message` required; no
// default empty-state sentence" | "default. **An intended-empty state takes
// `neutral` or `ok`, never `bad`/`warn`** (§2.5: an empty queue is a success
// state)."
//
// Four tones, not `Tone`'s five: `accent` has no alert reading (an alert
// states a fact, never asks for emphasis), so `AlertTone` excludes it —
// the type itself, not a runtime check, is what keeps a caller from passing
// `accent`. `message` is required with no fallback (BP-018 decision 2).
"use client";

import type React from "react";
import type { Tone } from "../types";

export type AlertTone = Exclude<Tone, "accent">;

const TONE_CLASS: Record<AlertTone, string> = {
  neutral: "",
  ok: "alert-success",
  warn: "alert-warning",
  bad: "alert-error",
};

export function Alert(p: {
  tone: AlertTone;
  /** Required — no default empty-state sentence exists. */
  message: React.ReactNode;
}): React.JSX.Element {
  const cls = ["alert", TONE_CLASS[p.tone]].filter(Boolean).join(" ");
  return (
    <div role="alert" className={cls}>
      <span>{p.message}</span>
    </div>
  );
}
