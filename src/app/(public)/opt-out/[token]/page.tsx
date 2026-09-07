// src/app/(public)/opt-out/[token]/page.tsx — BUILD §4.2
//
// The page behind the link every lead-directed mail carries. It applies the
// token on arrival and renders a total switch over the three things that
// can have happened — nothing else is on it: no control, no form, no field,
// no re-subscribe control, no navigation into the product, and the address
// is never echoed back, because an opt-out link forwarded to someone else
// must not disclose whose it was.
//
// Renders without a session, a cookie or a payment: `/opt-out/{token}` is
// on `PUBLIC_PATHS` and this file sits under `(public)`, whose layout
// declares nothing about sessions.
//
// Every sentence is a registry key. `optout.unavailable` is still owner-owed
// and renders the visible `TODO(copy)` marker (issue #261): a screen shows
// which line is waiting on the owner rather than going down over it, which
// is the standing rule for every owner-owed key a screen reads. It used to
// carry the empty value, whose `copy()` throw took this whole page with it
// on the one arm a reader reaches when the store is unavailable.
import type React from "react";
import { copy } from "@/lib/presentation/copy";
import { applyOptOutToken } from "@/lib/mail/leads";
import { Alert, Card } from "@/ui/components";
import { Surface } from "@/ui/layout";
import type { AlertTone } from "@/ui/components";
import type { Arm, Band } from "@/ui/layout";

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

/** `Card` requires a title and there is no sentence to put in one: the head
 *  of this card is the product's own name, which `mail.shell.wordmark`
 *  already holds — transcribed, not written, on the same footing as the
 *  em-dash another partition transcribes. Minting a second key for the same
 *  word would put an owner-owed blank at the head of the one page a reader
 *  reaches when they want mail to stop. */
const WORDMARK = "mail.shell.wordmark";

export default async function OptOutPage(p: {
  params: TokenParams | Promise<TokenParams>;
}): Promise<React.JSX.Element> {
  const { token } = await p.params;
  const applied = await applyOptOutToken(token);

  // Three arms, three tones, no fourth rendering and no default arm.
  const { tone, message }: { tone: AlertTone; message: string } =
    "email" in applied
      ? { tone: "ok", message: copy("optout.confirmed") }
      : applied.error === "invalid"
        ? { tone: "warn", message: copy("optout.invalid") }
        : { tone: "neutral", message: copy("optout.unavailable") };

  return (
    <Surface arms={ARMS}>
      <Card state="default" title={copy(WORDMARK)}>
        <Alert tone={tone} message={message} />
      </Card>
    </Surface>
  );
}
