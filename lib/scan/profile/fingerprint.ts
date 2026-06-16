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
 * Scan page HTML for outbound channel links. Returns one channel per kind (first
 * match wins). The domain's own links (github.com/<brand> etc.) are exactly what
 * we want — these are the company's owned channels. PURE.
 */
export function detectChannels(html: string): ContentChannel[] {
  const found = new Map<ChannelKind, ContentChannel>();
  for (const rule of RULES) {
    if (found.has(rule.kind)) continue;
    const m = html.match(rule.re);
    if (m) {
      found.set(rule.kind, { kind: rule.kind, label: rule.label, url: m[0] });
    }
  }
  return [...found.values()];
}
