// SPEC §7 (2026-10-10, issue 1391) — "Live check at publish".
//
// Every address a page links — the customer's own pages, their articles,
// the public pages a market fact was read from — is asked once at the
// moment the page goes out, and the page that goes out links none that
// answered *gone*.
//
//   · A link into the customer's own site that is gone is unwrapped: the
//     sentence stands, the link does not. A listed link that was only the
//     link is taken out with its line.
//   · A source that is gone takes its claim with it: the sentence that
//     cites it, or the table row, is dropped — a market fact stands only
//     beside the page it was read from (§7, *Two pools of facts*).
//
// **Gone is 404 or 410, and nothing else.** A timeout, a 403 from a bot
// wall, a 500 and a name that did not resolve this minute are all answers
// about the asking, not about the page, and taking a sentence out for one
// of them would cut a true claim on a slow afternoon. Such a link is
// recorded `unchecked` and stays.
//
// The fetch is `safeFetch` — the one guarded way this product reads an
// address it did not mint. It has no `HEAD`; one bounded `GET` is the check.
import { CROSS_LINKS } from "@/lib/config/constants";
import { linksOf, renderOf, sourceBlocksOf, splitSentences } from "@/lib/generate/rules/text";
import { onSite, urlKey } from "@/lib/generate/links/select";

export type LinkStatus = "live" | "gone" | "unchecked";

export interface CheckedLink {
  url: string;
  status: LinkStatus;
  /** The HTTP status the address answered with, where it answered. */
  http: number | null;
}

/** One thing the check took out of the page. */
export interface RemovedLink {
  url: string;
  /** `site`: the link was unwrapped. `source`: its claim was dropped. */
  kind: "site" | "source";
  /** The words the link or the claim was. */
  text: string;
}

/** What `drafts.meta.linkCheck` holds. */
export interface LinkCheckRecord {
  at: string;
  links: CheckedLink[];
  removed: RemovedLink[];
}

export type AskAddress = (url: string) => Promise<{ status: number | null }>;

const askOnce: AskAddress = async (url) => {
  const { safeFetch } = await import("@/lib/egress");
  const answer = await safeFetch(url, {
    timeoutMs: CROSS_LINKS.CHECK_TIMEOUT_MS,
    userAgent: "reachkit-verify",
    respectRobots: false,
  });
  return { status: answer.ok ? answer.status : (answer.status ?? null) };
};

function statusOf(http: number | null): LinkStatus {
  if (http === 404 || http === 410) return "gone";
  return http !== null && http >= 200 && http < 400 ? "live" : "unchecked";
}

/** Each distinct address asked once, a few at a time, inside one budget.
 *  An address the budget did not reach is `unchecked`. Never throws. */
export async function checkLinks(urls: readonly string[], ask: AskAddress = askOnce): Promise<CheckedLink[]> {
  const distinct = new Map<string, string>();
  for (const url of urls) {
    const key = urlKey(url);
    if (key !== null && /^https?:\/\//i.test(url) && !distinct.has(key)) distinct.set(key, url);
  }
  const queue = [...distinct.values()];
  const out: CheckedLink[] = [];
  const until = Date.now() + CROSS_LINKS.CHECK_BUDGET_MS;
  const worker = async (): Promise<void> => {
    for (let url = queue.shift(); url !== undefined; url = queue.shift()) {
      let http: number | null = null;
      if (Date.now() < until) {
        try {
          http = (await ask(url)).status;
        } catch {
          http = null;
        }
      }
      out.push({ url, status: statusOf(http), http });
    }
  };
  await Promise.all(Array.from({ length: CROSS_LINKS.CHECK_CONCURRENCY }, worker));
  return out;
}

const LINK_RE = /\[([^\]\n]*)\]\(([^)\s]+)\)/g;
const MARKER_RE = /^[ \t]*(?:>[ \t]?|#{1,6}[ \t]+|(?:[-*+]|\d+[.)])[ \t]+)/;
const HEADING_RE = /^[ \t]*#{1,6}[ \t]+/;
const LIST_RE = /^[ \t]*(?:[-*+]|\d+[.)])[ \t]+/;
const ROW_RE = /^[ \t]*\|.*\|[ \t]*$/;
const DELIMITER_RE = /^[ \t]*\|(?:[ \t]*:?-{1,}:?[ \t]*\|)+[ \t]*$/;

/**
 * The page without its gone links. Pure: `gone` is the set of `urlKey`s the
 * check answered *gone* for.
 */
export function withoutGoneLinks(
  markdown: string,
  a: { domain: string; gone: ReadonlySet<string> }
): { markdown: string; removed: RemovedLink[] } {
  if (a.gone.size === 0) return { markdown, removed: [] };
  const removed: RemovedLink[] = [];
  const isGone = (url: string): boolean => {
    const key = urlKey(url);
    return key !== null && a.gone.has(key);
  };
  const goneSource = (fragment: string): string | null =>
    linksOf(fragment).find((url) => isGone(url) && !onSite(url, a.domain)) ?? null;
  /** Every gone link of the fragment unwrapped to its words. */
  const unwrapped = (fragment: string): string =>
    fragment.replace(LINK_RE, (token: string, label: string, href: string) => {
      if (!isGone(href)) return token;
      removed.push({ url: href, kind: onSite(href, a.domain) ? "site" : "source", text: renderOf(label).trim() });
      return label;
    });

  const edits: { from: number; to: number; text: string }[] = [];
  for (const block of sourceBlocksOf(markdown)) {
    if (!linksOf(block.raw).some(isGone)) continue;
    const lines = block.raw.split("\n");

    if (HEADING_RE.test(block.raw)) {
      edits.push({ from: block.from, to: block.to, text: unwrapped(block.raw) });
      continue;
    }
    if (lines.some((line) => ROW_RE.test(line))) {
      // A table: a row that cites a gone source is the claim, and goes. The
      // header row names columns and only loses the link.
      const kept = lines.flatMap((line, index) => {
        const url = goneSource(line);
        const header = DELIMITER_RE.test(lines[index + 1] ?? "");
        if (url !== null && ROW_RE.test(line) && !header && !DELIMITER_RE.test(line)) {
          removed.push({ url, kind: "source", text: renderOf(line.replace(/\|/g, " ")).replace(/\s+/g, " ").trim() });
          return [];
        }
        return [unwrapped(line)];
      });
      edits.push({ from: block.from, to: block.to, text: kept.join("\n") });
      continue;
    }

    const marker = MARKER_RE.exec(block.raw)?.[0] ?? "";
    const rest = block.raw.slice(marker.length);
    // A listed link that is nothing but the link: unwrapped it would be a
    // bare name in a list, so the line goes.
    const only = /^\[([^\]\n]*)\]\(([^)\s]+)\)[.]?$/.exec(rest.trim());
    if (LIST_RE.test(block.raw) && only !== null && isGone(only[2] ?? "")) {
      removed.push({ url: only[2] ?? "", kind: onSite(only[2] ?? "", a.domain) ? "site" : "source", text: renderOf(only[1] ?? "").trim() });
      edits.push({ from: block.from, to: block.to, text: "" });
      continue;
    }
    const kept = splitSentences(rest).flatMap((piece) => {
      const url = goneSource(piece);
      if (url !== null) {
        removed.push({ url, kind: "source", text: renderOf(piece).replace(/\s+/g, " ").trim() });
        return [];
      }
      return [unwrapped(piece)];
    });
    edits.push({ from: block.from, to: block.to, text: kept.join(" ").trim() === "" ? "" : marker + kept.join(" ") });
  }

  let out = markdown;
  for (const edit of edits.sort((x, y) => y.from - x.from)) out = out.slice(0, edit.from) + edit.text + out.slice(edit.to);
  // A list the check emptied leaves its heading over nothing at the end of
  // the page — the sources list is the last thing on it.
  out = out
    .replace(/\n{3,}/g, "\n\n")
    .replace(/(?:\n|^)[ \t]*#{1,6}[ \t]+[^\n]*\s*$/, (tail) => (edits.some((edit) => edit.text === "") ? "\n" : tail));
  return { markdown: out, removed };
}

/**
 * The whole check for one page: ask every address the body links, take the
 * gone ones out, and say what was found. Never throws — a check that could
 * not run leaves the page as it was written and records nothing removed.
 */
export async function checkPageLinks(a: {
  markdown: string;
  domain: string;
  at: Date;
  ask?: AskAddress;
}): Promise<{ markdown: string; record: LinkCheckRecord }> {
  const links = await checkLinks(linksOf(a.markdown), a.ask);
  const gone = new Set(
    links.filter((link) => link.status === "gone").map((link) => urlKey(link.url)).filter((key): key is string => key !== null)
  );
  const cleaned = withoutGoneLinks(a.markdown, { domain: a.domain, gone });
  return { markdown: cleaned.markdown, record: { at: a.at.toISOString(), links, removed: cleaned.removed } };
}
