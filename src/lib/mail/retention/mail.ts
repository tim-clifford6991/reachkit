// SPEC §8, Retention (issue #569) — the shape the five retention templates
// return, and the one absolute-link construction they share. A leaf: the
// templates import it, and it imports none of them.
import { env } from "@/lib/config/env";
import type { CopyKey } from "@/lib/presentation/copy";
import type { MailBlock } from "../blocks/types";
import type { OptOutControl } from "../shell/compose";

export interface RetentionMail {
  readonly subject: CopyKey;
  readonly blocks: readonly MailBlock[];
  readonly reason?: CopyKey;
  /** Present on the kinds the address-wide opt-out stops. */
  readonly optOut?: OptOutControl;
}

/** Absolute, because a mail client resolves no relative path. */
export function appHref(path: string): string {
  return new URL(path, env.NEXT_PUBLIC_APP_URL).toString();
}
