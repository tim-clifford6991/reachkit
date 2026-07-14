"use client";

/**
 * The sidebar sign-out control (WS6). Replaces the bare `⏻` power glyph with a
 * LABELLED "Sign out" button that opens an are-you-sure confirmation before
 * actually signing out — so a stray click in the footer can't drop the session.
 *
 * Security is preserved: sign-out is still a POST to `/auth/signout` (never a
 * GET link that prefetch/hover could fire). The confirm's "Sign out" button
 * submits a hidden POST form; "Cancel" just closes the dialog.
 *
 * The confirm dialog is dynamically imported (it pulls the Base UI Dialog
 * primitive) so it stays out of the shared app-shell first-load chunk — this
 * control renders on every /app route.
 */

import { useRef, useState } from "react";
import dynamic from "next/dynamic";

const SignOutConfirm = dynamic(() => import("./sign-out-confirm").then((m) => m.SignOutConfirm), { ssr: false });

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

      {open && (
        <SignOutConfirm onCancel={() => setOpen(false)} onConfirm={() => formRef.current?.submit()} />
      )}
    </>
  );
}
