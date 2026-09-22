// BUILD §4.1 — the copy-link control
//
// REQ-001 c7: the value it copies is the canonical address, with no token
// and no expiry — the same address any other visitor would reach. The URL
// is handed in, never composed here, so there is one place a report
// address is built.
//
// It is not a member of the `AddressControl` union: that union governs
// controls that *start a measurement* ("exactly one, or none"), and this
// starts none. It coexists with any arm of it.
//
// A Client Component only because the clipboard is a browser API. With no
// client runtime the control renders and does nothing — the address is
// still in the browser's own address bar, which is why this needs no
// no-JavaScript fallback of its own.
//
// daisyUI `btn btn-ghost btn-sm` in the route (DESIGN rule 1); lucide's
// copy glyph at 16px, stroke 1.75.
//
// **Its one sentence is handed in, like its one address** (#988). A
// `copy()` call in a Client Component puts the whole merged registry in the
// bundle; the caller is a Server Component and resolves
// `copy("copy-link.label")` there. The key is named once, at that call
// site, exactly as the address is composed once at its own.
"use client";

import type React from "react";
import { Copy } from "lucide-react";

export function CopyLink(p: { canonicalUrl: string; label: string }): React.JSX.Element {
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      onClick={() => {
        void navigator.clipboard?.writeText(p.canonicalUrl);
      }}
    >
      <Copy size={16} strokeWidth={1.75} aria-hidden />
      {p.label}
    </button>
  );
}
