"use client";

/**
 * Submit button for the onboarding form. Uses `useFormStatus` so it disables
 * itself and shows pending copy while the `saveOnboarding` server action runs —
 * no spinner round-trip, no action-signature change. Must be a descendant of the
 * <form> whose action it reports on.
 */

import { useFormStatus } from "react-dom";

export function SubmitButton({ idleLabel }: { idleLabel: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-[image:var(--gradient-accent)] px-5 text-[0.9rem] font-semibold text-accent-fg shadow-[var(--elevation-glow)] transition-transform hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
    >
      {pending ? "Saving…" : idleLabel}
    </button>
  );
}
