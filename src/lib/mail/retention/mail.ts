// SPEC §8, Retention — the shape the retention templates return and their shared absolute link; a leaf the templates import.
import { env } from "@/lib/config/env";
import type { CopyKey } from "@/lib/presentation/copy";
import type { MailBlock } from "../blocks/types";
import type { OptOutControl } from "../shell/compose";

/** Each opens on its subject line as a heading, so the inbox row and the first line cannot differ. */
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
