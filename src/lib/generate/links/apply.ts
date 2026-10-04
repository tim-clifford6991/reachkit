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
  a: {
    domain: string;
    targets: readonly LinkTarget[];
    groundedUrl: string;
    /** The customer's own pages the page's facts were read from (SPEC §7,
     *  D41): a fact is linked to its source, so a link to one of them
     *  stands. */
    factUrls?: readonly string[];
    /** `false` holds the text to the chosen pages without appending the
     *  ones it did not reach — for a line that is not the body (issue 1137:
     *  the page's closing line, laid out after the body's links). */
    appendMissing?: boolean;
    /** The heading of the section the unreached pages are listed under —
     *  the page's own section on how the business handles the question
     *  (SPEC §7, 2026-09-29: "with links to its product, pricing and the
     *  cluster's hub page"). Absent, or not found, they close the body. */
    appendUnder?: string;
  }
): string {
  const chosen = new Map<string, string>();
  for (const target of a.targets) {
    const key = urlKey(target.url);
    if (key !== null && !chosen.has(key)) chosen.set(key, target.url);
  }
  const grounded = urlKey(a.groundedUrl);
  const sources = new Set((a.factUrls ?? []).map(urlKey));
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
      if (key !== null && (key === grounded || sources.has(key))) return token;
      return label;
    });
  });

  const missing = a.targets.filter((target) => {
    const key = urlKey(target.url);
    if (key === null || linked.has(key)) return false;
    linked.add(key);
    return true;
  });
  if (missing.length === 0 || a.appendMissing === false) return lines.join("\n");

  const list = missing.map((target) => `- [${safeLabel(target.label)}](${safeHref(target.url)})`);
  const under = a.appendUnder === undefined ? -1 : lines.findIndex((line) => line.trim() === `## ${a.appendUnder}`);
  if (under >= 0) {
    // The end of that section: the next H2, or the end of the body.
    const next = lines.findIndex((line, index) => index > under && /^##[ \t]/.test(line));
    const end = next < 0 ? lines.length : next;
    const before = lines.slice(0, end).join("\n").replace(/\s+$/, "");
    const after = lines.slice(end).join("\n");
    return `${before}\n\n${list.join("\n")}\n${after === "" ? "" : `\n${after}`}`;
  }
  const body = lines.join("\n").replace(/\s+$/, "");
  return `${body}\n\n${list.join("\n")}\n`;
}

/** A label the inline grammar reads back as one link: no brackets, no
 *  line break. */
function safeLabel(label: string): string {
  return label.replace(/[[\]]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * An address the inline grammar reads back whole.
 *
 * **Both parentheses, since issue 929.** The hand-written grammar ended a
 * link at the first `)`, so encoding that one was enough. The parser is
 * CommonMark now (`src/lib/publish/render/markdown.ts`), and its rule is
 * different: an unwrapped destination may contain parentheses only in
 * **balanced** pairs, so a URL with a lone `(` — which
 * `https://…/widget_(v2)` becomes the moment its `)` is encoded — is not a
 * destination at all and the whole link reads as literal text.
 *
 * Encoding both leaves an address with no parentheses in it, which every
 * Markdown parser reads back the same way and which resolves to the same
 * URL. Whitespace is encoded for the reason it always was: a space ends a
 * destination in CommonMark too.
 */
function safeHref(url: string): string {
  return url.replace(/\(/g, "%28").replace(/\)/g, "%29").replace(/\s/g, "%20");
}
