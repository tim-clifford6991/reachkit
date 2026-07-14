"use client";

/**
 * The sign-out confirmation dialog (WS6) — split out of SignOutButton and
 * dynamically imported so the Base UI Dialog primitive stays OUT of the shared
 * app-shell first-load chunk (app-shell renders on every /app route; a static
 * import tipped the competitors page over its 275 KB budget). It mounts only
 * when the founder clicks "Sign out".
 */

import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export function SignOutConfirm({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-sm">
        <DialogTitle>Sign out?</DialogTitle>
        <DialogDescription>
          You&apos;ll be signed out of ReachKit. You&apos;ll need your email to sign back in.
        </DialogDescription>
        <DialogFooter>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center justify-center rounded-full border border-[var(--c-line)] px-4 py-2 text-sm font-semibold text-[var(--c-ink)] hover:bg-[var(--c-fill)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center justify-center rounded-full bg-[var(--c-action)] px-4 py-2 text-sm font-semibold text-[var(--c-on-dark)] hover:opacity-90"
          >
            Sign out
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
