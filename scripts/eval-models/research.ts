// The research group on the real set: the outside pages the product cited, read fresh by the product's own reader
// (robots respected, one pass, cached under the evaluation folder, never in the repository), then each topic's batch
// through the product's `readClaims` on each model. Every call is scored in code from its raw answer and its batch.
import { appendFileSync, chmodSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { admittedClaims, squash } from "@/lib/generate/pipeline/claims";
import { readClaims } from "@/lib/generate/pipeline/claims-read";
import { fetchPage, type MarketPageKind, type ReadPage, type Wanted } from "@/lib/generate/pipeline/research";
import { DEFAULT_LOCALE } from "@/lib/locale/locales";
import { passThrough } from "./context";
import { EVAL_DIR } from "./paths.mjs";
import type { Run } from "./transport";

const SET = path.join(EVAL_DIR, "research-set");
const CACHE = path.join(SET, "cache", "pages.jsonl");

/** A page as read: the product's `ReadPage`, its markup's publication day, and `null` text where it did not read. */
type Cached = Omit<ReadPage, "publishedAt"> & { publishedAt: string | null; unread?: string };
/** `topics.json`: each topic's search, its pages in the order a draft reads them, the words that place a claim on the
 *  topic, and the pages a careful editor would cite. `classes` names each page's source class. */
interface Topics {
  rivals: string[];
  classes: Record<string, "primary" | "research" | "editorial" | "vendor" | "rival">;
  topics: { id: string; search: string; keywords: string[]; editor: string[]; pages: { url: string; kind: MarketPageKind; product?: string }[] }[];
}

const readCache = (): Map<string, Cached> =>
  new Map(existsSync(CACHE) ? readFileSync(CACHE, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Cached).map((p) => [p.url, p]) : []);

/** One polite pass: each address not yet cached, in turn, a second apart, through the product's reader. */
export async function fetchSet(): Promise<number> {
  mkdirSync(path.dirname(CACHE), { recursive: true, mode: 0o700 });
  const cached = readCache();
  const urls = readFileSync(path.join(SET, "urls-2026-11-22.txt"), "utf8").split("\n").map((l) => l.trim()).filter((l) => /^https?:\/\//.test(l));
  for (const url of urls.filter((u) => !cached.has(u))) {
    const read = await fetchPage(url);
    const row: Cached = read === null ? { url, title: "", text: "", readAt: new Date().toISOString(), publishedAt: null, unread: "refused, failed or under the word floor" } : { ...read.page, sourced: undefined, publishedAt: read.page.publishedAt ?? null };
    appendFileSync(CACHE, `${JSON.stringify(row)}\n`, { mode: 0o600 });
    console.log(JSON.stringify({ url, read: row.unread === undefined, words: row.text.split(/\s+/).length, publishedAt: row.publishedAt }));
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  chmodSync(CACHE, 0o600);
  return 0;
}

const NUMBER = /\d[\d,.]*%?/g;
const PRICE = /[$€£]\s?\d|\d\s?(?:usd|eur)\b/i;
const YEAR = /\b(19|20)\d{2}\b/g;

/** Each named model (`today` is the product's own; none named is today alone), `repeat` times over every topic; one
 *  scored line per model call. Models are named one run at a time, so today is bought once however many follow. */
export async function runResearch(run: Run, models: string | null, repeat: number, emit: (line: object) => void): Promise<void> {
  const set = JSON.parse(readFileSync(path.join(SET, "topics.json"), "utf8")) as Topics;
  const pages = readCache();
  const today = new Date("2026-11-22T00:00:00Z");
  for (const model of (models ?? "today").split(",").filter(Boolean).map((m) => (m === "today" ? null : m))) {
    run.swap = model === null ? {} : { "generate.research": model };
    for (let r = 1; r <= repeat && run.halted === null; r++) {
      for (const topic of set.topics) {
        const batch: (ReadPage & Wanted)[] = topic.pages.flatMap((p) => {
          const read = pages.get(p.url);
          if (read === undefined || read.unread !== undefined) return [];
          // `unread` is undefined here, so the page carries nothing the product does not read.
          const { publishedAt, ...page } = read;
          return [{ ...page, kind: p.kind, ...(p.product === undefined ? {} : { product: p.product }), ...(publishedAt === null ? {} : { publishedAt }) }];
        });
        const calls: { value: unknown; stop: string | null; urls: string[]; ms: number; cents: number; tokensOut: number | null }[] = [];
        run.onAnswer = (_site, value, stop, _from, call) => {
          const urls = [...JSON.stringify(call.request.messages).matchAll(/\\"url\\":\\"([^\\]+)\\"/g)].map((m) => m[1] ?? "");
          calls.push({ value, stop, urls, ms: call.ms, cents: call.cents, tokensOut: call.tokensOut });
        };
        await readClaims(passThrough(), batch, { locale: DEFAULT_LOCALE, search: topic.search, rivals: set.rivals, today });
        run.onAnswer = undefined;
        for (const call of calls) {
          const sent = call.urls.map((url) => batch.find((p) => p.url === url)).filter((p): p is ReadPage & Wanted => p !== undefined);
          const raw = ((call.value as { claims?: unknown } | null)?.claims ?? null) as { page: number; quote: string; year: number | null; about: string; plan: string | null; rival: string | null }[] | null;
          const claims = Array.isArray(raw) ? raw.filter((c) => typeof c?.quote === "string") : [];
          const admitted = Array.isArray(raw) ? admittedClaims(claims as never, sent, today, set.rivals) : [];
          const scored = claims.map((c) => {
            const page = sent[c.page - 1];
            const text = page === undefined ? "" : squash(page.text);
            const quote = squash(c.quote);
            const numbers = quote.match(NUMBER) ?? [];
            const years = (quote.match(YEAR) ?? []).map(Number);
            const pageYear = page?.publishedAt === undefined ? null : new Date(page.publishedAt).getUTCFullYear();
            return {
              url: page?.url ?? null,
              cls: page === undefined ? null : (set.classes[page.url] ?? "vendor"),
              verbatim: page !== undefined && text.includes(quote),
              elsewhere: page !== undefined && !text.includes(quote) && sent.some((p) => squash(p.text).includes(quote)),
              numeric: numbers.length > 0,
              numbersOnPage: numbers.every((n) => text.includes(n)),
              price: PRICE.test(quote) || c.about === "price",
              onTopic: topic.keywords.some((k) => quote.toLowerCase().includes(k)),
              dated: pageYear !== null,
              year: c.year,
              yearOk: c.year === null ? null : years.length > 0 ? years.includes(c.year) : pageYear === null || c.year <= pageYear,
              statistic: /\d+(\.\d+)?\s?%|\d[\d,]{3,}/.test(quote) && c.about === "other",
            };
          });
          emit({
            topic: topic.id,
            model: model ?? "today",
            repeat: r,
            stop: call.stop,
            ms: call.ms,
            cents: call.cents,
            tokensOut: call.tokensOut,
            parsed: Array.isArray(raw),
            pages: sent.map((p) => ({ url: p.url, cls: set.classes[p.url] ?? "vendor", editor: topic.editor.includes(p.url), dated: p.publishedAt !== undefined })),
            claims: scored,
            admitted: admitted.map((f) => ({ url: f.url, cls: set.classes[f.url] ?? "vendor", onTopic: topic.keywords.some((k) => f.passage.toLowerCase().includes(k)), editor: topic.editor.includes(f.url) })),
          });
        }
      }
    }
  }
}
