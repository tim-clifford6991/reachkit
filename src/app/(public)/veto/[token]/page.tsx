// BUILD §9 — GET /veto/{token}: the address the one veto link in the
// `draft-ready` mail lands on.
//
// §12 gives that mail "one veto link"; #142 built what the link redeems —
// a hashed, single-use, draft-bound token that performs exactly one
// transition. This file is the surface that redeems it for a reader who has
// no session, because a mail's reader has none: the link is the whole of
// the credential, and `/veto/:token` says so on `src/middleware.ts`'s one
// public allow-list.
//
// **One transition, and the page does not own it.** The redemption is
// `redeemVetoLink`'s, which marks the token used in the same statement that
// reads it. This file passes a segment and renders an arm; it holds no
// token knowledge, reads no state machine and writes nothing itself
// (`ARCHITECTURE.md` rule 1 — a thin adapter).
//
// **Redeeming is the arrival**, as it is behind `/opt-out/{token}`: there
// is no button to press. A reader who cannot press one must still be able
// to stop their page, and the token is single-use, so a mail client's
// prefetch costs at worst a page that does not publish — the direction
// REQ-057 c1 wants to be safe in.
//
// **Four arms, one written line, no fifth rendering and no default arm.**
// Nothing else is on the page: no control, no form, no field, no
// navigation into the product, and no draft, title or address is echoed
// back, because a stop link forwarded to someone else must disclose nothing
// about the page it was issued for.
//
// Every sentence is a registry key, all four owner-owed.
import type React from "react";
import type { Metadata } from "next";
import { copy } from "@/lib/presentation/copy";
import { redeemVetoLink } from "@/lib/publish/publishable";
import type { RedeemResult } from "@/lib/publish/publishable";
import { Alert, Card } from "@/ui/components";
import { Surface } from "@/ui/layout";
import type { AlertTone } from "@/ui/components";
import type { Arm, Band } from "@/ui/layout";

/** The redemption writes, so no response is ever shared or replayed: a
 *  cached confirmation would tell the next reader their page is stopped on
 *  the strength of someone else's click. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** ADR-002's reasoning holds here for a stricter reason than a report's: a
 *  token in an indexed URL is a stop link published to everyone. The meta
 *  half of the promise; `next.config.ts` carries the header half for this
 *  path, as it does for `/scan/:domain`. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/** Next hands a dynamic segment as a promise; the suite calls this
 *  component directly with a resolved object, the same direct-call
 *  convention `tests/app/opt-out/page.test.tsx` uses. */
type TokenParams = { token: string };

/** One column at every band: the page is one card, and there is nothing to
 *  put beside it. */
const ARMS = {
  compact: { kind: "columns", count: 1 },
  medium: { kind: "columns", count: 1 },
  wide: { kind: "columns", count: 1 },
} as const satisfies Record<Band, Arm>;

/** `Card` requires a title and there is no sentence to put in one: the head
 *  of this card is the product's own name, which `mail.shell.wordmark`
 *  already holds — transcribed, not written, exactly as `/opt-out/{token}`
 *  does it. */
const WORDMARK = "mail.shell.wordmark";

/**
 * The line, from what redeeming did. Total over `RedeemResult` — a refusal
 * that grows a fifth member fails to compile here rather than falling
 * through to a blank page.
 *
 * `expired` and `not_in_review` share a line. To the person holding the
 * link they are one fact — the moment to stop this page has passed — and
 * the difference between them is a fact about the page that this screen
 * holds no session to be told.
 */
function lineFor(result: RedeemResult): { tone: AlertTone; message: string } {
  if (result.ok) return { tone: "ok", message: copy("publish.veto.stopped") };
  switch (result.reason) {
    case "used":
      return { tone: "neutral", message: copy("publish.veto.alreadyUsed") };
    case "expired":
    case "not_in_review":
      return { tone: "warn", message: copy("publish.veto.expired") };
    case "unknown":
      return { tone: "warn", message: copy("publish.veto.unknown") };
  }
}

export default async function VetoPage(p: {
  params: TokenParams | Promise<TokenParams>;
}): Promise<React.JSX.Element> {
  const { token } = await p.params;
  const { tone, message } = lineFor(await redeemVetoLink(token));

  return (
    <Surface arms={ARMS}>
      <Card state="default" title={copy(WORDMARK)}>
        <Alert tone={tone} message={message} />
      </Card>
    </Surface>
  );
}
