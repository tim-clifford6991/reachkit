// Issue 1550 — Technical issues, at `/app/issues`.
//
// The account's own view of the checks the customer fixes (SPEC §9's "Free
// fix · 10 min"): each one names what it applies to and says what to do in
// one sentence. A needs-you item on Overview opens it at its check; it is
// never the public report, which is a sales page with a checkout on it.
// Read from the stored report, nothing re-checked. Not in the navigation.
// It declares no `Surface`: the shell's layout owns this route's screen root
// (`../layout.tsx`).
import type React from "react";
import type { Metadata } from "next";
import { copy } from "@/lib/presentation/copy";
import { requireSetUpAccount } from "../_session/account";
import { readIssues } from "./provider";
import { IssuesView } from "./view";

export const metadata: Metadata = { title: copy("meta.app.issues.title") };

export default async function IssuesPage(): Promise<React.JSX.Element> {
  const reading = await readIssues();
  const { timeZone } = await requireSetUpAccount();
  return <IssuesView reading={reading} timeZone={timeZone} />;
}
