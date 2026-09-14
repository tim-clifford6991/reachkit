// src/app/(public)/opt-out/[token]/page.tsx — UI-SPEC S7, REQ-010 c11,
// BUILD §4.2 (issue #372)
//
// The page behind the link every lead-directed mail carries. It applies the
// token on arrival and renders a total switch over the three things that
// can have happened.
//
// One daisyUI card: a mail icon over "Opted out", the approved lines with the
// address inside the first, and a quiet "Back to ReachKit" (`btn-ghost`) —
// nothing on this page asks the reader to do anything, so it has no solid
// button.
//
// **Both of those are the set's own ruling and not an oversight of this
// build.** The address was suppressed here on the reasoning that "an
// opt-out link forwarded to someone else must not disclose whose it was";
// the owner's approved drawing of this screen shows the address, and
// UI-SPEC §S7 writes it out. Where UI-SPEC and BUILD §4 differ, UI-SPEC
// wins until §4's amendment lands (UI-SPEC's own header), and REQ-010 c11 —
// the criterion this page satisfies — asks for a working opt-out that stops
// every sequence and says nothing about echoing the address. The quiet link
// is the same ruling: "no navigation into the product" was this file's own
// rule, and the set draws one control.
//
// Renders without a session, a cookie or a payment: `/opt-out/{token}` is
// on `PUBLIC_PATHS` and this file sits under `(public)`, whose layout
// declares nothing about sessions but does draw ruling 3a's header and
// footer around this card.
//
// **Three arms, and the head says which.** Only one of the three opted
// anybody out, so only that one wears S7's "Opted out": a card that said it
// over "that unsubscribe link isn't valid any more" would contradict itself
// in its own head. The other two take `optout.head.unresolved`, which is
// owner-owed and renders the `TODO(copy)` marker — the standing rule for a
// screen (a mail keeps the throw; a screen shows which line is waiting and
// keeps working), and the rule `optout.unavailable` below it already lives
// by.
//
// Every sentence is a registry key.
import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import type { CopyKey } from "@/lib/presentation/copy";
import { applyOptOutToken } from "@/lib/mail/leads";
import { Surface } from "@/ui/layout";
import { AddressLine } from "@/app/_fallback/AddressLine";
import type { Arm, Band } from "@/ui/layout";
import { PUBLIC_ROUTE_SEO } from "../../_seo/routes";
import { staticMetadata } from "../../_seo/metadata";

/** Next hands a dynamic segment as a promise; the suite calls this
 *  component directly with a resolved object, the same direct-call
 *  convention `tests/app/layout.test.ts` uses. */
type TokenParams = { token: string };

/** One column at every band: the page is one card, and there is nothing to
 *  put beside it. */
const ARMS = {
  compact: { kind: "columns", count: 1 },
  medium: { kind: "columns", count: 1 },
  wide: { kind: "columns", count: 1 },
} as const satisfies Record<Band, Arm>;

/** The set's own confirmation, with the address inside it. */
const CONFIRMED: CopyKey = "optout.confirmed";

/** A test hook, never a sentence (ADR-010 point 1). */
const TEST_ID = "opt-out-card";

/** The way back the set draws, and where it goes. */
const HOME = "/";

/** The head and the line for what applying the token did. Total over the
 *  three arms — no default, and no fourth rendering. The confirmation's
 *  line is composed rather than resolved, because the set writes the
 *  address inside it in the mono face. */
function arm(applied: Awaited<ReturnType<typeof applyOptOutToken>>): {
  head: CopyKey;
  line: React.ReactNode;
} {
  if ("email" in applied) {
    return {
      head: "optout.head",
      line: <AddressLine copyKey={CONFIRMED} address={applied.email} />,
    };
  }
  const line: CopyKey = applied.error === "invalid" ? "optout.invalid" : "optout.unavailable";
  return { head: "optout.head.unresolved", line: <p>{copy(line)}</p> };
}

/** Issue #326: `noindex`, from this route's row in `_seo/routes.ts`. The
 *  path is the credential — a mail's one-use removal link — so an indexed
 *  `/opt-out/{token}` is that link published to everyone who can read a
 *  search result, which is issue #144's reasoning for the veto page
 *  holding identically here. The row's `{token}` spelling is passed as the
 *  path on purpose: the composer emits no canonical for a pattern, and a
 *  `<link rel="canonical">` would restate the token inside the document. */
export const metadata: Metadata = staticMetadata(PUBLIC_ROUTE_SEO.optOut);

export default async function OptOutPage(p: {
  params: TokenParams | Promise<TokenParams>;
}): Promise<React.JSX.Element> {
  const { token } = await p.params;
  const { head, line } = arm(await applyOptOutToken(token));

  return (
    <Surface arms={ARMS}>
      <main className="mx-auto w-full max-w-lg px-4 py-12 sm:py-16">
        <div className="card border border-base-300 bg-base-100" data-testid={TEST_ID}>
          <div className="card-body gap-4">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-base-content/60">
              <Mail size={16} strokeWidth={1.75} aria-hidden />
              {copy(head)}
            </p>
            {line}
            <div>
              <Link href={HOME} className="btn btn-ghost">
                {copy("chrome.back-to-reachkit")}
              </Link>
            </div>
          </div>
        </div>
      </main>
    </Surface>
  );
}
