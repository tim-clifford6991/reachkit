// UI-SPEC S8 — the account not-found screen (issue #372).
// src/app/(account)/not-found.tsx
//
// The `(account)` group's own `notFound()` boundary, in S8's shape. Two
// things differ from the public one, and both are the same difference: a
// customer who is signed in is not a stranger being sent to a report
// address.
//
//   - **the line** is `chrome.notfound.line.app`, not the set's. S8's own
//     line names `reachkit.app/scan/yourdomain.com`, which is where a
//     stranger's report lives and not where a customer's work is. The set
//     draws no account arm, so the line is the owner's and renders the
//     marker (12a, and the standing screen rule).
//   - **the control** is the quiet way back to the Overview, not a scan
//     field. Inside the app there is one place a lost customer is going.
//
// It renders inside `(account)/layout.tsx`, which is BUILD §4.3's setup
// gate and draws no chrome, so the screen is its own `Surface` root. The
// app shell's sidebar is `(account)/app/layout.tsx`'s and sits *below* this
// boundary; a 404 for `/app/nothing-here` never reached that layout, so
// there is no shell to keep and none is drawn.
//
// A Server Component: it reads no session of its own — the group layout
// above it already required one — and no store.
import type React from "react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { Btn } from "@/ui/components/Btn";
import { NotFoundScreen } from "@/app/_fallback/Fallback";

/** Owner-owed (12a) — see this file's header. */
const LINE: CopyKey = "chrome.notfound.line.app";

/** The one place a lost customer is going. */
const OVERVIEW = "/app";

const TEST_ID = "account-not-found";

export default function AccountNotFound(): React.JSX.Element {
  return (
    <NotFoundScreen
      line={<p>{copy(LINE)}</p>}
      action={
        <Btn href={OVERVIEW} label={copy("chrome.back-to-overview")} variant="tertiary" pill />
      }
      testId={TEST_ID}
    />
  );
}
