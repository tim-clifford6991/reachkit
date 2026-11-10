// The static pages and how their policy names each inline script: by its hash, read from the built HTML
// (`./static-csp-adapter.mjs`), so no static page needs `'unsafe-inline'`.
import { createHash } from "node:crypto";

/** The public pages served static: no request value reaches their render. `src/middleware.ts`'s
 *  `matcher` restates these two lists as literals, because Next reads that `config` from source. */
const PAGES = "pricing|about|how-it-works|privacy|terms|imprint|compare|teardowns|tools";
const PAGES_UNDER = "compare|teardowns|answers";

/** Where the build's per-page policy is served: ReachKit's own hosts, and the local server a build
 *  is checked on. Never a customer's host, which the hosted edge answers. */
export const STATIC_HOSTS = "(?:(?:dev\\.)?reachkit\\.app|localhost|127\\.0\\.0\\.1)";

/** The static pages as a `headers()` source. */
export const STATIC_PAGES_SOURCE = `/((?:${PAGES})?|(?:${PAGES_UNDER})/[^/]+)`;

export const STATIC_PAGE = new RegExp(`^/(?:(?:${PAGES})?|(?:${PAGES_UNDER})/[^/]+)$`);

const EXECUTABLE = new Set(["", "text/javascript", "application/javascript", "module"]);

/** A browser hashes a script's text as it stands between the tags; JSON-LD and other data blocks never run. */
export function inlineScriptHashes(html) {
  const hashes = new Set();
  for (const [, attributes, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\ssrc\s*=/i.test(attributes)) continue;
    const type = /\stype\s*=\s*["']?([^"'\s>]*)/i.exec(attributes)?.[1].toLowerCase() ?? "";
    if (!EXECUTABLE.has(type)) continue;
    hashes.add(`'sha256-${createHash("sha256").update(body, "utf8").digest("base64")}'`);
  }
  return [...hashes];
}

/** The fixed policy with `'self'` widened by exactly these hashes. */
export function withHashes(policy, hashes) {
  return policy.replace(/script-src 'self'/, `script-src 'self' ${hashes.join(" ")}`);
}
