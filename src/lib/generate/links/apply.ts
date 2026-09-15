// SPEC §7 Rules ("No link known to go nowhere", "one serialiser for
// screen, copy-as-HTML and copy-as-Markdown", 2026-09-12).
//
// Holds a finished body to the link list `select.ts` chose. The model is
// told the list; this is what makes it true of the page whatever the model
// did with it.
//
// **Two passes over the body's own Markdown, and nothing else.**
//
//   1. Every link into the customer's own site — an absolute address on
//      their domain, or a site-relative `/path` — that is not a chosen
//      target and not the grounded source is unwrapped to its label. A
//      path the model guessed is exactly the dead link the rule forbids. A
//      chosen target written relatively is rewritten absolute: the hosted
//      destination serves from a subdomain, where `/pricing` is not theirs.
//   2. Every chosen target the body still does not link is appended, one
//      list item each, labelled with the page's own heading.
//
// Links to anywhere else — a rival's page a figure is sourced from — pass
// untouched: those are the hard rules' business.
//
// The result is Markdown, written in the grammar the one renderer
// (`src/lib/publish/render/markdown.ts`) parses. It is stored as the
// draft's body, so the screen, copy-as-HTML, copy-as-Markdown and every
// destination read the same links from the same string.
import { onSite, urlKey, type LinkTarget } from "./select";

/** The renderer's inline grammar, code spans first so a link written
 *  inside backticks stays code. */
const CODE_OR_LINK_RE = /(`[^`]+`)|\[([^\]\n]*)\]\(([^)\s]+)\)/g;
const FENCE_RE = /^```/;

export function applyLinks(
  markdown: string,
  a: { domain: string; targets: readonly LinkTarget[]; groundedUrl: string }
): string {
  const chosen = new Map<string, string>();
  for (const target of a.targets) {
    const key = urlKey(target.url);
    if (key !== null && !chosen.has(key)) chosen.set(key, target.url);
  }
  const grounded = urlKey(a.groundedUrl);
  const linked = new Set<string>();

  let inFence = false;
  const lines = markdown.split("\n").map((line) => {
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      return line;
    }
    if (inFence) return line;
    return line.replace(CODE_OR_LINK_RE, (token: string, code: string | undefined, label: string, href: string) => {
      if (code !== undefined) return token;
      const absolute = href.startsWith("/") && !href.startsWith("//") ? `https://${a.domain}${href}` : href;
      if (!onSite(absolute, a.domain)) return token;
      const key = urlKey(absolute);
      const target = key === null ? undefined : chosen.get(key);
      if (key !== null && target !== undefined) {
        linked.add(key);
        return `[${label}](${safeHref(target)})`;
      }
      if (key !== null && key === grounded) return token;
      return label;
    });
  });

  const missing = a.targets.filter((target) => {
    const key = urlKey(target.url);
    if (key === null || linked.has(key)) return false;
    linked.add(key);
    return true;
  });
  if (missing.length === 0) return lines.join("\n");

  const body = lines.join("\n").replace(/\s+$/, "");
  const list = missing.map((target) => `- [${safeLabel(target.label)}](${safeHref(target.url)})`);
  return `${body}\n\n${list.join("\n")}\n`;
}

/** A label the inline grammar reads back as one link: no brackets, no
 *  line break. */
function safeLabel(label: string): string {
  return label.replace(/[[\]]/g, "").replace(/\s+/g, " ").trim();
}

/** An address the inline grammar reads back whole: it ends a link at the
 *  first `)` or whitespace, so both are percent-encoded. */
function safeHref(url: string): string {
  return url.replace(/\)/g, "%29").replace(/\s/g, "%20");
}
