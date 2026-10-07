// SPEC §5 (owner D65 of 2026-10-07, issue 1303) — what the knowledge base
// never keeps from a page, whatever the business.
//
// Found on reachkit.app, as an example of what any site's pages yield: its
// buyers' questions held "Why you should care" and "What to do next", which
// are section headings, and its audience held "Businesses" and "Companies",
// which name nobody. Two rules follow, and neither reads a market's words:
//
//   * A buyer's question is a question. A heading, a menu label or a button
//     is not one, even where it starts with "why" or "what".
//   * An audience names a kind of customer. A word for anyone who might buy
//     anything ("businesses", "customers", "users") does not.
//
// Pure. The page read applies both to what the model answered, and the
// merged base applies both again, so a page stored before this rule is
// cleaned without being read again. The founder's own answers are never
// judged: they are theirs (§5).

/** The marks a question ends with: Latin, full-width, Arabic. */
const QUESTION_END = /[?？؟]\s*["'”’)\]]*$/;

/** A question shorter than this many words is a label ("Why us?"). */
const QUESTION_MIN_WORDS = 3;

function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Whether a string a page read gave as a buyer's question is one: it ends
 * as a question does and is longer than a label. Where the page's own text
 * is at hand, a "question" the page carries only as a line without its
 * question mark is a heading the model dressed up, and is not kept.
 */
export function isBuyerQuestion(text: string, pageText?: string): boolean {
  const line = oneLine(text);
  if (!QUESTION_END.test(line)) return false;
  if (line.split(" ").length < QUESTION_MIN_WORDS) return false;
  if (pageText === undefined) return true;
  const bare = line.replace(QUESTION_END, "").trim();
  if (bare === "" || pageText.includes(line)) return true;
  const lines = pageText.split("\n").map(oneLine);
  return !lines.some((heading) => heading.toLocaleLowerCase() === bare.toLocaleLowerCase());
}

/** Words for anyone who buys anything, in the languages a site's pages are
 *  most often written in. A noun of this kind names no audience. */
const ANYBODY = new Set([
  // English
  "business", "businesses", "company", "companies", "customer", "customers", "user", "users", "client", "clients",
  "organization", "organizations", "organisation", "organisations", "people", "everyone", "anyone", "everybody",
  "anybody", "buyer", "buyers", "consumer", "consumers", "team", "teams", "brand", "brands", "firm", "firms",
  // German
  "unternehmen", "firma", "firmen", "betrieb", "betriebe", "kunde", "kunden", "kundinnen", "nutzer", "nutzerinnen",
  "benutzer", "anwender", "organisationen", "menschen", "leute", "jeder", "jede", "marken",
  // French
  "entreprise", "entreprises", "société", "sociétés", "clientes", "utilisateur", "utilisateurs", "gens", "marques",
  // Spanish, Portuguese, Italian
  "empresa", "empresas", "negocio", "negocios", "negócio", "negócios", "compañía", "compañías", "cliente", "clientes",
  "usuario", "usuarios", "usuário", "usuários", "utilizadores", "personas", "pessoas", "marcas", "azienda", "aziende",
  "impresa", "imprese", "clienti", "utenti", "persone",
  // Dutch
  "bedrijf", "bedrijven", "klant", "klanten", "gebruiker", "gebruikers", "mensen", "merken",
]);

/** Words that add no kind of customer to the noun beside them. */
const NO_KIND = new Set([
  "the", "and", "or", "of", "all", "any", "every", "each", "our", "your", "their", "its", "other", "various", "many",
  "most", "some", "size", "sizes", "kind", "kinds", "type", "types", "shape", "shapes", "alike", "like", "you", "who",
  "for", "with", "in", "to", "that", "alle", "aller", "und", "oder", "jeder", "größe", "größen", "art", "arten", "der",
  "die", "das", "les", "des", "et", "ou", "tous", "toutes", "taille", "tailles", "los", "las", "todos", "todas",
  "tamaño", "tamaños", "tutti", "tutte", "van", "elke", "een", "het", "del", "della", "delle", "dei",
]);

/**
 * Whether an audience a page read gave names a kind of customer: something
 * beside a word for anybody is left once the words that add nothing are
 * taken away. "Businesses" and "Companies of all sizes" name nobody;
 * "small businesses", "dental practices" and "Shopify stores" do.
 */
export function isSpecificAudience(text: string): boolean {
  const words = oneLine(text).toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  return words.some((word) => word.length > 1 && !ANYBODY.has(word) && !NO_KIND.has(word));
}
