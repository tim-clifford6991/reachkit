// SPEC §7 (owner, D51; issue 1266) — what a page's title is held to, read
// off its context pack.
//
// The writer is told it (`./write.ts`) and stage 4 checks it
// (`../rules/title.ts`) from this one reading, so the title a writer is
// asked for and the title the check passes are one description.
import { languagePack } from "@/lib/locale/language";
import { TITLE } from "@/lib/config/constants";
import { brandOf } from "@/lib/market/questions/select";
import type { TitleRuleInputs } from "../rules/title";
import type { ContextPack } from "./pack";

/** The market as the pack carries it (`sites.market`), read defensively:
 *  `searchTerm` is D49's, on a market concluded since it was built. */
interface PackMarket {
  searchTerm?: unknown;
  buyer?: unknown;
  rivals?: unknown;
}

const text = (value: unknown): string[] => (typeof value === "string" && value.trim() !== "" ? [value.trim()] : []);

export function titleRuleFor(pack: ContextPack, description: string): TitleRuleInputs {
  const market = (pack.business.market ?? {}) as PackMarket;
  const named = Array.isArray(market.rivals) ? market.rivals.flatMap((rival) => text((rival as { name?: unknown } | null)?.name)) : [];
  const domains = [...pack.business.rivals, ...pack.products.map((product) => product.domain)];
  return {
    type: pack.type,
    terms: [...new Set([...text(market.searchTerm), ...pack.target.searches, pack.target.question])],
    rivals: [...new Set([...named, ...domains.map(brandOf)])].filter((name) => name.length > 2),
    audience: [...text(market.buyer), ...(pack.profile?.knowledge?.audience ?? []).map((item) => item.text)],
    year: new Date(pack.builtAt).getUTCFullYear(),
    titles: pack.pages.flatMap((page) => text(page.title)),
    description,
    ...(pack.locale === undefined ? {} : { language: pack.locale.language }),
  };
}

/** The same reading, as the writer is told it. */
export function titleBrief(pack: ContextPack): Record<string, unknown> {
  const rule = titleRuleFor(pack, "");
  const dated = (TITLE.yearTypes as readonly string[]).includes(pack.type);
  return {
    searches: rule.terms,
    year: dated ? rule.year : null,
    rules: [
      `${TITLE.chars.min} to ${TITLE.chars.max} characters, counted: aim for 45 to 60.`,
      `One of \`searches\`, in the searcher's own words, starts within its first ${TITLE.headWords} words.`,
      "It carries one specific: a number, an AI engine's name, a rival's name, a price, who the page is for, or a question. A number in it is one the page bears out.",
      dated
        ? "It may carry `year`, in brackets or before a colon, never as its last word, and no other year."
        : "It carries no year.",
      `Never ${languagePack(pack.locale?.language ?? "en").title.banned.map((phrase) => `"${phrase}"`).join(", ")}, a square bracket, a pipe, or the same word twice.`,
      "It does not read like the title of any page in `pack.pages`.",
    ],
  };
}
