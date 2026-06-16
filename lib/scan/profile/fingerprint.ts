/**
 * Deep domain profiling (M2) — homepage channel fingerprinting (PURE).
 *
 * Detects which distribution channels a company links to from its site (YouTube,
 * newsletter, dev.to, Medium, GitHub, podcast) by scanning hrefs. Cadence for
 * these is filled in later where a feed exists; fingerprinting just finds them.
 */

import type { ContentChannel, ChannelKind } from "./types";

interface Rule {
  kind: ChannelKind;
  label: string;
  re: RegExp;
}

const RULES: Rule[] = [
  { kind: "youtube", label: "YouTube", re: /https?:\/\/(?:www\.)?youtube\.com\/(?:@[\w.-]+|channel\/[\w-]+|c\/[\w-]+)/i },
  { kind: "newsletter", label: "Substack", re: /https?:\/\/[\w-]+\.substack\.com/i },
  { kind: "devto", label: "dev.to", re: /https?:\/\/dev\.to\/[\w-]+/i },
  { kind: "medium", label: "Medium", re: /https?:\/\/(?:[\w-]+\.)?medium\.com\/@?[\w-]+/i },
  { kind: "github", label: "GitHub", re: /https?:\/\/github\.com\/[\w-]+/i },
  { kind: "podcast", label: "Apple Podcasts", re: /https?:\/\/podcasts\.apple\.com\/[\w/-]+/i },
];

/**
 * Scan page HTML for outbound channel links, keeping one per kind. When
 * `brandToken` is given (the domain's root name), only links whose handle relates
 * to the brand are kept — this rejects third-party references (e.g. a Bootstrap
 * `github.com/twbs` link on an unrelated site) so we surface the company's OWN
 * channels, not whatever it happens to link to. PURE.
 */
export function detectChannels(html: string, brandToken?: string): ContentChannel[] {
  const token = brandToken?.trim().toLowerCase();
  const found = new Map<ChannelKind, ContentChannel>();
  for (const rule of RULES) {
    for (const m of html.matchAll(new RegExp(rule.re, "gi"))) {
      const url = m[0];
      if (token && token.length >= 3 && !url.toLowerCase().includes(token)) continue;
      found.set(rule.kind, { kind: rule.kind, label: rule.label, url });
      break; // first brand-matching link of this kind wins
    }
  }
  return [...found.values()];
}
