// UI-SPEC S8 — the public not-found screen (issue #372).
// src/app/(public)/not-found.tsx
//
// The `(public)` group's own `notFound()` boundary. It renders inside
// `(public)/layout.tsx`, so ruling 3a's header and footer are already
// around it — which is what S8 means by "footer": the way out of a 404 on
// a public address is the same chrome every other public page carries, and
// this file adds none of its own.
//
// **The control is the landing's own form, under S8's word.** The set draws
// a field and a solid "Scan it", and that is `ScanForm` with a different
// label: the same POST to `/api/scan`, the same no-JavaScript fallback, the
// same five refusal lines. REQ-001 c1's "exactly one text input and one
// submit control" is a promise about the landing and is kept here too —
// this screen has one of each.
//
// A Server Component: it reads no session, no cookie and no store.
import type React from "react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { AddressLine } from "@/app/_fallback/AddressLine";
import { NotFoundScreen } from "@/app/_fallback/Fallback";
import { ScanForm } from "./_landing/ScanForm";

/** S8's own line, and the shape of a report address it names. */
const LINE: CopyKey = "chrome.notfound.line";
const ADDRESS: CopyKey = "chrome.notfound.address";

/** A test hook, never a sentence — bound to a name for the same reason
 *  every other test id in `src/app/**` is (ADR-010 point 1). */
const TEST_ID = "public-not-found";

export default function PublicNotFound(): React.JSX.Element {
  return (
    <NotFoundScreen
      line={<AddressLine copyKey={LINE} address={copy(ADDRESS)} />}
      action={<ScanForm submitLabel={copy("chrome.notfound.cta")} />}
      testId={TEST_ID}
    />
  );
}
