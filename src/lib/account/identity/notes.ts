// src/lib/account/identity/notes.ts — BUILD §4.7, REQ-077 c1
//
// The two note lines the account card carries, in the order the criterion
// names them: "one written line saying ReachKit sends a sign-in link rather
// than using a password, and one saying invoices and receipts go to the
// address held in the billing portal and are changed there ... not here."
//
// **A leaf with no runtime import, and that is load-bearing** — the same
// reason `./addresses.ts` is one. The card that renders these keys is a
// surface, and its fixture states them too; both would otherwise have to
// reach `./email-change.ts`, which pulls the mail seam, the link issuer and
// `@/lib/db` behind it. `@/lib/db` parses every environment binding the
// moment it is evaluated, so a screen's *fixture* would need a full server
// environment to be imported at all — and the layout build, the
// presentation sweeps and `next build`'s page-data collection would each go
// down with it. The only import below is a type, which is erased.
//
// `./email-change.ts` re-exports this, so every existing caller keeps its
// spelling and there is one list, not two.
//
// BP-061 named these `account.magic_link_note` and
// `account.invoices_go_to_billing` before any registry existed. The first is
// already on disk under the settings partition's own spelling
// (`settings.account.magic-link`, BUILD §4.7's "magic-link note"), so it is
// reused rather than duplicated; only the second was minted for REQ-077.
import type { CopyKey } from "@/lib/presentation/copy";

export const ACCOUNT_NOTE_KEYS = [
  "settings.account.magic-link",
  "settings.account.invoices-elsewhere",
] as const satisfies readonly CopyKey[];
