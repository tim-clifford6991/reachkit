// src/lib/market/prompts/answer.ts — what one AI answer to a tracked prompt
// says about the site and its rivals (SPEC §6, owner D19, #1162).
//
// *Named* is the site's name or domain in the answer's text, unless it may be
// another business's. *Linked* is a page the site serves among the addresses
// the answer cited. A rival is named
// the same two ways. Never a position and never sentiment: neither has a
// member here.
//
// Pure: no I/O. *Named* is `namesSite`, the one rule the score's AI
// presence also reads (issue 1420).
//
// Issue 1539: what the answer states of the business — a price, a count, a
// country — is read here too (`./misstated.ts`), so the stored row can be
// held against the site's own facts later without the answer's prose.
import type { Language } from "@/lib/locale/locales";
import { namesSite, possiblyAnother, says } from "@/lib/measure/drivers";
import { isHomeUrl } from "@/lib/market/rivals/domains";
import { statementsOf, type AnswerStatement } from "./misstated";

export interface PromptAnswerReading {
  named: boolean;
  linked: boolean;
  /** The site's own pages the answer cited, without tracking parameters. */
  ownUrls: readonly string[];
  /** The market's rivals the answer named or cited, by domain. */
  rivals: readonly string[];
  /** The addresses it cited that hold "alternative", in any language the
   *  word is spelt so ("alternatives", "alternativen") — issue 1520. */
  alternatives: readonly string[];
  /** The pages it cited on other sites, their homes left out: where a
   *  competitor's page that AI links is read from. */
  cited: readonly string[];
  /** Issue 1539: the prices, counts and countries it gave the business. */
  states: readonly AnswerStatement[];
  /** It named a local business without its town while another cited site carries the name, so `named` is false. */
  possiblyOther: boolean;
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

/** The pages `citedUrls` holds on other sites than `ownDomain`, each once
 *  and none a site's home. */
export function citedPagesOf(citedUrls: readonly string[], ownDomain: string): string[] {
  const own = bare(ownDomain);
  const pages = new Set<string>();
  for (const url of citedUrls) {
    const page = pageOf(url);
    if (page !== null && !within(bare(new URL(page).hostname), own) && !isHomeUrl(page)) pages.add(page);
  }
  return [...pages];
}

/** ChatGPT read the page while answering but did not link it; `null` where the answer kept no reads, so unknown is never "not found". */
export function foundNotLinked(
  answer: { readonly citedUrls?: readonly string[]; readonly retrievedUrls?: readonly string[] },
  pageUrl: string
): boolean | null {
  if (answer.retrievedUrls === undefined || answer.citedUrls === undefined) return null;
  const page = pageOf(pageUrl);
  const holds = (urls: readonly string[]) => page !== null && urls.some((url) => pageOf(url) === page);
  return holds(answer.retrievedUrls) && !holds(answer.citedUrls);
}

/** The market's rivals an answer named or cited, by domain: the one reading a tracked prompt's and a page question's answers share. */
export function rivalsNamed(a: { text: string; citedDomains: readonly string[]; ownDomain: string; rivals: readonly { name: string; domain: string }[] }): string[] {
  const own = bare(a.ownDomain);
  const cited = a.citedDomains.map(bare);
  const rivals: string[] = [];
  for (const rival of a.rivals) {
    const domain = bare(rival.domain);
    if (domain === own || rivals.includes(domain)) continue;
    if (says(a.text, rival.name) || says(a.text, domain) || cited.some((host) => within(host, domain))) rivals.push(domain);
  }
  return rivals;
}

/** The address as one page, whatever its scheme, `www.`, query or trailing slash. */
function pathKey(url: string): string {
  try {
    const parsed = new URL(url);
    return `${bare(parsed.hostname)}${parsed.pathname.replace(/\/+$/u, "")}`;
  } catch {
    return url;
  }
}

/** What an answer counts for: a link only to a page the site serves (`pages`; none known keeps every link), and a name another business may
 *  carry (`possiblyAnother`) not at all. */
export function countedFor(a: {
  named: boolean;
  linked: boolean;
  ownUrls: readonly string[];
  text: string;
  hosts: readonly string[];
  ownDomain: string;
  siteName: string | null;
  town?: string;
  pages?: readonly string[] | null;
}): { named: boolean; linked: boolean; ownUrls: string[]; possiblyOther: boolean } {
  const served = a.pages == null || a.pages.length === 0 ? null : new Set(a.pages.map(pathKey));
  const ownUrls = served === null ? [...a.ownUrls] : a.ownUrls.filter((url) => served.has(pathKey(url)));
  const linked = ownUrls.length > 0 || (a.linked && a.ownUrls.length === 0);
  const possiblyOther = a.named && !linked && possiblyAnother(a);
  return { named: a.named && !possiblyOther, linked, ownUrls, possiblyOther };
}

export function readPromptAnswer(a: {
  text: string;
  citedDomains: readonly string[];
  citedUrls: readonly string[];
  ownDomain: string;
  siteName: string;
  rivals: readonly { name: string; domain: string }[];
  /** The language the answer was asked in; absent is English. */
  language?: Language;
  /** The one place a local business serves, where it serves one. */
  town?: string;
  /** The pages the site serves; `null` where none are known. */
  pages?: readonly string[] | null;
}): PromptAnswerReading {
  const own = bare(a.ownDomain);
  const cited = a.citedDomains.map(bare);
  const ownUrls = new Set<string>();
  for (const url of a.citedUrls) {
    const page = pageOf(url);
    if (page !== null && within(bare(new URL(page).hostname), own)) ownUrls.add(page);
  }
  const counted = countedFor({
    ...a,
    named: namesSite(a.text, a.siteName, own),
    linked: ownUrls.size > 0 || cited.some((host) => within(host, own)),
    ownUrls: [...ownUrls],
    hosts: [...cited, ...a.citedUrls],
  });
  const { named, linked } = counted;

  const rivals = rivalsNamed({ ...a, citedDomains: cited });
  const alternatives = [...new Set(a.citedUrls.flatMap((url) => pageOf(url) ?? []))].filter((page) =>
    /alternativ/u.test(page.toLowerCase())
  );
  return {
    named,
    linked,
    ownUrls: counted.ownUrls,
    rivals,
    alternatives,
    cited: citedPagesOf(a.citedUrls, own),
    possiblyOther: counted.possiblyOther,
    states: named ? statementsOf({ text: a.text, siteName: a.siteName, ownDomain: own, rivals: a.rivals, language: a.language ?? "en" }) : [],
  };
}
