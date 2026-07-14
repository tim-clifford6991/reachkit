"use client";

/**
 * The sidebar sign-out control (WS6). Replaces the bare `⏻` power glyph with a
 * LABELLED "Sign out" button that opens an are-you-sure confirmation before
 * actually signing out — so a stray click in the footer can't drop the session.
 *
 * Security is preserved: sign-out is still a POST to `/auth/signout` (never a
 * GET link that prefetch/hover could fire). The confirm's "Sign out" button
 * submits a hidden POST form; "Cancel" just closes the dialog.
 */

import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export function SignOutButton() {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <>
      {/* POST-only sign-out (hidden) — submitted on confirm. A GET link would let
          prefetch/hover sign the user out; keep it a form. */}
      <form ref={formRef} action="/auth/signout" method="post" style={{ display: "none" }} aria-hidden="true" />

      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          color: "var(--c-faint)", cursor: "pointer", background: "none", border: "none",
          padding: 0, fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 600, lineHeight: 1,
          whiteSpace: "nowrap",
        }}
      >
        <span aria-hidden="true" style={{ fontSize: 14 }}>⏻</span>
        Sign out
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Sign out?</DialogTitle>
          <DialogDescription>
            You&apos;ll be signed out of ReachKit. You&apos;ll need your email to sign back in.
          </DialogDescription>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex items-center justify-center rounded-full border border-[var(--c-line)] px-4 py-2 text-sm font-semibold text-[var(--c-ink)] hover:bg-[var(--c-fill)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => formRef.current?.submit()}
              className="inline-flex items-center justify-center rounded-full bg-[var(--c-action)] px-4 py-2 text-sm font-semibold text-[var(--c-on-dark)] hover:opacity-90"
            >
              Sign out
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
