// SPEC §4 (2026-09-20, #908) — the side panel's two shortcuts, under the
// menu and above the autopilot line: *Visit your blog* and *Help*.
//
// **Each is drawn only where it can act** (SPEC §4 of the same date: "a
// control that cannot act is not drawn"). The blog link needs a live hosted
// blog — a host the domain list has seen go live — so a site still waiting
// on its DNS record, or publishing to somebody else's WordPress, gets no
// link to a page that would answer nothing. Help is a mailbox a person
// reads, so it is always drawable.
//
// The blog opens in a new tab: it is the customer's own site, not another
// ReachKit screen, and losing the app to reach it is not what the shortcut
// is for. `rel` is the pair that keeps the opened page from reaching back.
import type React from "react";
import { CircleQuestionMark, ExternalLink } from "lucide-react";
import { copy } from "@/lib/presentation/copy";

/** The mailbox *Help* writes to. The product already prints this address in
 *  two of its own sentences (`setup.address.refused.unreachable` and the
 *  settings' connection line), so the shortcut goes where the copy already
 *  sends people rather than naming a second place. */
export const HELP_MAILTO = "mailto:hello@reachkit.app";

export function Shortcuts(p: { blog: string | null }): React.JSX.Element {
  return (
    // A daisyUI `menu`, not a second `<nav>` landmark: the three
    // destinations are the navigation, and two shortcuts beside them would
    // be a landmark with no name to tell it from the first.
    <ul className="menu w-full min-w-0 gap-1 p-0" data-testid="shell-shortcuts">
      {p.blog === null ? null : (
        <li>
          <a href={p.blog} target="_blank" rel="noreferrer noopener" data-testid="shell-blog-link">
            <ExternalLink size={20} strokeWidth={1.75} aria-hidden />
            <span className="truncate">{copy("shell.shortcut.blog")}</span>
          </a>
        </li>
      )}
      <li>
        <a href={HELP_MAILTO} data-testid="shell-help-link">
          <CircleQuestionMark size={20} strokeWidth={1.75} aria-hidden />
          <span className="truncate">{copy("shell.shortcut.help")}</span>
        </a>
      </li>
    </ul>
  );
}
