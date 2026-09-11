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
"use client";

import type React from "react";
import { Copy } from "lucide-react";
import { Btn } from "@/ui/components";
import { copy } from "@/lib/presentation/copy";

export function CopyLink(p: { canonicalUrl: string }): React.JSX.Element {
  return (
    <Btn
      label={copy("copy-link.label")}
      icon={<Copy size={14} strokeWidth={1.8} aria-hidden />}
      variant="ghost"
      size="sm"
      onClick={() => {
        void navigator.clipboard?.writeText(p.canonicalUrl);
      }}
    />
  );
}
