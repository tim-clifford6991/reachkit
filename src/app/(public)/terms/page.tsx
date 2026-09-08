// BUILD §3 — the terms page (issue #266).
// src/app/(public)/terms/page.tsx
//
// One of the three static legal routes the public footer links to. They
// exist so a footer link reaches a page rather than a 404, and each renders
// exactly two owner-owed strings: a title and a body.
//
// **The body is the owner's in the strongest sense the product has.** A
// privacy statement, a set of terms or an imprint drafted by anything but
// the owner is a legal claim nobody made, so neither is drafted here — not
// as a suggestion, not as a placeholder paragraph. Both keys carry the
// `TODO(copy)` marker, which renders, so the page and its chrome can be
// reviewed while the words are still owed.
//
// A Server Component that reads nothing: no session, no cookie, no store.
import type React from "react";
import { Surface } from "@/ui/layout";
import { copy } from "@/lib/presentation/copy";

export default function TermsPage(): React.JSX.Element {
  return (
    <Surface
      arms={{
        compact: { kind: "columns", count: 1 },
        medium: { kind: "same-as-below" },
        wide: { kind: "same-as-below" },
      }}
    >
      <main className="rk-legal">
        <h1>{copy("legal.terms.title")}</h1>
        <p>{copy("legal.terms.body")}</p>
      </main>
    </Surface>
  );
}
