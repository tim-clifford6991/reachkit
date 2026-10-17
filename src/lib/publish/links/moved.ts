// SPEC §7 (2026-10-17, issue 1487) — a link to a page that moved.
//
// When a retargeted page moves to a new address, every live page of the
// site that linked the old one links the new one, by the words that name
// it now: the old words named the old topic. Code does it, as the rest of
// §7's *Links* does — no writer is asked, nothing is bought, and the
// sentence around the link is kept as it was.

const LINK_RE = /\[([^\]\n]*)\]\(([^)\s]+)\)/g;

/** The body with every link `from` answers for pointed at `to` and named
 *  `text`. Pure: the same body is returned where nothing linked there. */
export function withMovedLink(
  markdown: string,
  a: { from: (url: string) => boolean; to: string; text: string }
): { markdown: string; moved: number } {
  let moved = 0;
  const out = markdown.replace(LINK_RE, (token: string, _label: string, href: string) => {
    if (!a.from(href)) return token;
    moved += 1;
    return `[${a.text}](${a.to})`;
  });
  return { markdown: out, moved };
}
