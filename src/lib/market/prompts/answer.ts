// src/lib/market/prompts/answer.ts — what one AI answer to a tracked prompt
// says about the site and its rivals (SPEC §6, owner D19, #1162).
//
// *Named* is the site's name or domain in the answer's text. *Linked* is
// one of its pages among the addresses the answer cited. A rival is named
// the same two ways. Never a position and never sentiment: neither has a
// member here.
//
// Pure: no I/O. *Named* is `namesSite`, the one rule the score's AI
// presence also reads (issue 1420).
import { namesSite, says } from "@/lib/measure/drivers";

export interface PromptAnswerReading {
  named: boolean;
  linked: boolean;
  /** The site's own pages the answer cited, without tracking parameters. */
  ownUrls: readonly string[];
  /** The market's rivals the answer named or cited, by domain. */
  rivals: readonly string[];
  /** The answer named or cited any product at all — D33's pre-check. */
  namesABrand: boolean;
}

function bare(host: string): string {
  return host.trim().toLowerCase().replace(/^www\./, "");
}

function within(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

/** An address without its tracking parameters and fragment, so one page
 *  cited by two engines is one page. */
export function pageOf(url: string): string | null {
  try {
    const parsed = new URL(url);
    for (const key of [...parsed.searchParams.keys()]) {
      if (key.toLowerCase().startsWith("utm_")) parsed.searchParams.delete(key);
    }
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

export function readPromptAnswer(a: {
  text: string;
  citedDomains: readonly string[];
  citedUrls: readonly string[];
  ownDomain: string;
  siteName: string;
  rivals: readonly { name: string; domain: string }[];
}): PromptAnswerReading {
  const own = bare(a.ownDomain);
  const cited = a.citedDomains.map(bare);
  const ownUrls = new Set<string>();
  for (const url of a.citedUrls) {
    const page = pageOf(url);
    if (page !== null && within(bare(new URL(page).hostname), own)) ownUrls.add(page);
  }
  const linked = ownUrls.size > 0 || cited.some((host) => within(host, own));
  const named = namesSite(a.text, a.siteName, own);

  const rivals: string[] = [];
  for (const rival of a.rivals) {
    const domain = bare(rival.domain);
    if (domain === own || rivals.includes(domain)) continue;
    if (says(a.text, rival.name) || says(a.text, domain) || cited.some((host) => within(host, domain))) rivals.push(domain);
  }
  return {
    named,
    linked,
    ownUrls: [...ownUrls],
    rivals,
    namesABrand: named || linked || rivals.length > 0 || cited.length > 0,
  };
}
