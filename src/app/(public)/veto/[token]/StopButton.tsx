"use client";

import type React from "react";
import { useFormStatus } from "react-dom";
import { CircleStop } from "lucide-react";

/** The stop submit: it spins and is disabled while pressed, and never says
 *  Stopped itself, because only the re-read page knows the store agreed. */
export function StopButton(p: { label: string }): React.JSX.Element {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary btn-block" disabled={pending} aria-busy={pending || undefined}>
      {pending ? (
        <span className="loading loading-spinner loading-xs" aria-hidden />
      ) : (
        <CircleStop size={20} strokeWidth={1.75} aria-hidden />
      )}
      {p.label}
    </button>
  );
}
