// src/lib/account/identity/outcomes.ts — BUILD §13
//
// What issuing and redeeming answer, and the one line a dead link speaks.
//
// A file of its own so that `links.ts` (which redeems) and
// `email-change-complete.ts` (which finishes the `email_change` half of a
// redemption) can share one union without importing each other — the same
// break-the-cycle-at-file-granularity move ADR-092 records for the
// publishing leaves. Types alone would not need it; `logLink` and
// `DEAD_LINK_KEY` are values, and a value import is a real edge.
import type { LinkPurpose } from "./store";

/** The one sentence the sign-in screen speaks for a link that no longer
 *  works (REQ-098 c7) — one key for all three reasons, deliberately: "that
 *  line and the time it takes are the same whatever the reason, so someone
 *  holding a link that is not theirs learns nothing about whether the
 *  address it was issued for has an account". */
export const DEAD_LINK_KEY = "signin.link_dead" as const;

export type IssuedLink =
  | {
      issued: true;
      url: string;
      expiresAt: Date;
      /** The SHA-256 the row was written under. Returned so a caller that
       *  must remember *which* link it is waiting on —
       *  `users.pending_email_token_hash` is the only one — can, without
       *  the plaintext being handed anywhere but the mail. */
      tokenHash: string;
    }
  | { issued: false; reason: "vendor" };

export interface SessionClaimsToWrite {
  readonly userId: string;
  readonly siteId: string | null;
  readonly issuedAt: Date;
}

export type RedeemedLink =
  | {
      ok: true;
      purpose: LinkPurpose;
      userId: string;
      session: SessionClaimsToWrite;
      /** Whether this redemption was the first time anybody signed in to
       *  this account — REQ-024 criterion 4's "setup if it is unfinished,
       *  otherwise onward into the product". Read from the stamp's own
       *  write, so it cannot disagree with the column the chase reads. */
      firstSignIn: boolean;
      /** `email_change` only: whether the one `account` mail REQ-077 c3
       *  owes the old address actually left. The change stands either way
       *  (BP-061: "reverting an address the customer has already proved
       *  would lock them out of the account they just moved"). */
      noticeToOldAddress?: "sent" | "failed";
    }
  | { ok: false; reason: "expired" | "spent" | "unknown"; lineKey: typeof DEAD_LINK_KEY };

/**
 * BP-061 `## NFR budget`: "one event per issue, redeem and change, carrying
 * `userId`, `purpose` and outcome — never the address, never the token."
 * The parameter shape below has no field either could be put in, which is
 * what makes that assertable rather than remembered.
 */
export function logLink(event: {
  event: string;
  userId: string | undefined;
  purpose: LinkPurpose | undefined;
  outcome: string;
}): void {
  console.info(JSON.stringify(event));
}

/** Every refusal is this shape, and the reason never reaches a customer. */
export function deadLink(
  reason: "expired" | "spent" | "unknown",
  a: { userId?: string; purpose?: LinkPurpose }
): RedeemedLink {
  logLink({ event: "auth_link_redeemed", userId: a.userId, purpose: a.purpose, outcome: reason });
  return { ok: false, reason, lineKey: DEAD_LINK_KEY };
}
