// src/lib/market/rivals/verify.ts — a rival's domain is checked before it
// is kept (SPEC §6, 2026-10-07, issue 1314).
//
// The rival conclusion names each product with the domain the model gives
// for it, and nothing checked that domain. The customer panel found two
// kinds of wrong: a domain no site answers at (two of one plumber's five
// rivals), and a real site that belongs to somebody else (Chili Piper,
// stored as `piper.com`). Every later step trusts the domain: the rival is
// sized by it, cited by it and linked by it.
//
// So each candidate's home page is read once, at no cost, and:
//
//   * a domain no site answers at is not that rival's;
//   * a page that answers and never says the rival's name is another
//     company's;
//   * a home page that sends its reader on to another domain, and names the
//     rival there, is the rival's at that domain (`mazars.co.uk` is Forvis
//     Mazars at `forvismazars.com`);
//   * either is put right where the rival's own domain can be found — a
//     domain this pass's top tens or AI answers hold whose label is the
//     rival's name, or the name itself as a `.com` or under the stated
//     ending — and that page says the name. Otherwise the rival is dropped.
//
// A page that could not be read at all (it refused this reader, or took too
// long) proves nothing against the domain, and the rival is kept.
//
// The judgement is pure; one function reads.
import { parse } from "node-html-parser";
import type { FetchOutcome } from "@/lib/egress/types";
import type { RivalConclusion } from "@/lib/market/infer/types";
import { isOwnDomain, isPlatformDomain, nameLetters, registrableDomain } from "./domains";

/** How long one home page may take, and the whole check. A pass's rival
 *  step has minutes; setup's has seconds. */
const READ_MS = 6_000;
const CHECK_MS = 10_000;
/** A page that says less than this many letters says too little to judge:
 *  a shell a script fills in, or a bot check. */
const PAGE_MIN_LETTERS = 200;

function labelOf(domain: string): string {
  return nameLetters(domain.replace(/^www\./, "").split(".")[0] ?? "");
}

/** What a home page says of whose it is: its title, the site name its head
 *  declares, and its body's text — as letters. */
function pageLetters(html: string): string {
  const root = parse(html, { comment: false });
  const declared = root
    .querySelectorAll('meta[property="og:site_name"], meta[property="og:title"], meta[name="application-name"]')
    .map((meta) => meta.getAttribute("content") ?? "");
  for (const element of root.querySelectorAll("script, style, template, noscript, svg")) element.remove();
  return nameLetters([root.querySelector("title")?.text ?? "", ...declared, (root.querySelector("body") ?? root).text].join(" "));
}

/** Whether a home page says this rival's name: the name itself, a name
 *  buyers search it under, or — for a name of three words or more whose
 *  domain begins with its first two — those two words. `null` where the
 *  page says too little to judge. */
export function pageNames(html: string, rival: Pick<RivalConclusion, "name" | "domain" | "searchNames">): boolean | null {
  const page = pageLetters(html);
  const names = [rival.name, ...(rival.searchNames ?? [])].map(nameLetters).filter((name) => name.length >= 3);
  if (names.some((name) => page.includes(name))) return true;
  const words = rival.name.trim().split(/\s+/);
  const lead = nameLetters(words.slice(0, 2).join(" "));
  if (words.length >= 3 && lead.length >= 6 && labelOf(rival.domain).startsWith(lead) && page.includes(lead)) return true;
  return page.length < PAGE_MIN_LETTERS ? null : false;
}

/**
 * Where a rival's own site may be, when the stated domain is not it: the
 * domains the pass's evidence holds whose label is the rival's name, then
 * the name as a `.com` and under the stated domain's own ending. Never the
 * stated domain again.
 */
export function domainGuesses(rival: Pick<RivalConclusion, "name" | "domain">, seen: Iterable<string>): string[] {
  const name = nameLetters(rival.name);
  if (name.length < 3) return [];
  const ending = rival.domain.split(".").slice(1).join(".");
  const guesses = [...[...seen].filter((domain) => labelOf(domain) === name), `${name}.com`, ...(ending === "" ? [] : [`${name}.${ending}`])];
  const out: string[] = [];
  for (const guess of guesses) {
    const domain = registrableDomain(guess);
    if (domain !== null && domain !== rival.domain && !out.includes(domain)) out.push(domain);
  }
  return out.slice(0, 3);
}

export type DomainVerdict = "named" | "another_site" | "no_site" | "unread";

/** What one read of a home page says of the domain. */
export function verdictOf(outcome: FetchOutcome, rival: Pick<RivalConclusion, "name" | "domain" | "searchNames">): DomainVerdict {
  if (outcome.ok) {
    // An answer that is no page — a rate limit, a bot check — and a page a
    // script has yet to fill say nothing of whose site it is.
    if (outcome.status < 200 || outcome.status > 299) return "unread";
    const named = pageNames(outcome.html, rival);
    return named === null ? "unread" : named ? "named" : "another_site";
  }
  // No address: no site. Anything else — a refusal, a reset, a timeout — is
  // a site that would not be read, which proves nothing against it.
  return outcome.reason === "dns" ? "no_site" : "unread";
}

export interface VerifiedRivals {
  rivals: RivalConclusion[];
  /** Rivals whose domain was put right: the stated one, and the one kept. */
  fixed: { name: string; from: string; to: string }[];
  /** Rivals dropped: no site, or another company's, and no domain found. */
  dropped: { name: string; domain: string; because: Exclude<DomainVerdict, "named" | "unread"> }[];
}

type Reader = (url: string, opts: { userAgent: "reachkit-measure"; timeoutMs: number; signal: AbortSignal }) => Promise<FetchOutcome>;

/**
 * The candidates whose domain stands, in the order given. It buys nothing,
 * and a page that could not be read keeps its candidate.
 */
export async function verifyRivalDomains(a: {
  rivals: readonly RivalConclusion[];
  /** The business's own domain: never a rival's. */
  own: string;
  /** Domains this pass's top tens and AI answers hold. */
  seen?: Iterable<string>;
  read?: Reader;
}): Promise<VerifiedRivals> {
  const fixed: VerifiedRivals["fixed"] = [];
  const dropped: VerifiedRivals["dropped"] = [];
  if (a.rivals.length === 0) return { rivals: [], fixed, dropped };
  const reader: Reader = a.read ?? (await import("@/lib/egress/safe-fetch")).safeFetch;
  const deadline = AbortSignal.timeout(CHECK_MS);
  /** The verdict on a domain, and the domain its home page was served from. */
  const home = async (domain: string, rival: RivalConclusion): Promise<{ verdict: DomainVerdict; at: string }> => {
    if (deadline.aborted) return { verdict: "unread", at: domain };
    try {
      const outcome = await reader(`https://${domain}/`, { userAgent: "reachkit-measure", timeoutMs: READ_MS, signal: deadline });
      return { verdict: verdictOf(outcome, { ...rival, domain }), at: registrableDomain(outcome.url) ?? domain };
    } catch {
      return { verdict: "unread", at: domain };
    }
  };
  const usable = (domain: string): boolean => !isOwnDomain(domain, a.own) && !isPlatformDomain(domain);
  const seen = [...(a.seen ?? [])];
  const checked = await Promise.all(
    a.rivals.map(async (rival): Promise<RivalConclusion | null> => {
      const { verdict, at } = await home(rival.domain, rival);
      if (verdict === "unread") return rival;
      if (verdict === "named") {
        // Its home page was served from another domain: that one is its site.
        if (at === rival.domain || !usable(at)) return rival;
        fixed.push({ name: rival.name, from: rival.domain, to: at });
        return { ...rival, domain: at };
      }
      for (const guess of domainGuesses(rival, seen)) {
        if (!usable(guess)) continue;
        const found = await home(guess, rival);
        if (found.verdict !== "named" || !usable(found.at)) continue;
        fixed.push({ name: rival.name, from: rival.domain, to: found.at });
        return { ...rival, domain: found.at };
      }
      dropped.push({ name: rival.name, domain: rival.domain, because: verdict });
      return null;
    })
  );
  // A domain put right may be one another candidate already holds.
  const taken = new Set<string>();
  const rivals = checked.filter((rival): rival is RivalConclusion => {
    if (rival === null || taken.has(rival.domain)) return false;
    taken.add(rival.domain);
    return true;
  });
  return { rivals, fixed, dropped };
}
