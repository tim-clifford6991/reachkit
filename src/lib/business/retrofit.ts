// src/lib/business/retrofit.ts — the reading of a business that a scan
// stored before the profile call was asked for it (issue 1470).
//
// Issue 1454 asked the one profile call for a business's lines, its kind and
// its reach. A scan stored before that holds none of the three, and a free
// scan is never scanned again. The owner's standing rule (SPEC §2,
// 2026-10-14) is that every new derivation reaches every stored scan at 0¢,
// so this reads them from what the scan already holds: its profile (the
// category, the offering type, the town), the place it measured in, the home
// page's structured data, its searches' maps, and on a paying site the
// market the paid pass concluded. It asks no model and buys nothing.
//
// It under-reports. A field the stored words do not decide is left unread,
// and the report says so; it is never guessed. In particular a category that
// names one line is one line: what else the business sells was never asked.
//
// Pure: no I/O, no clock.
import { OFFERINGS } from "@/lib/config/constants";
import { BUSINESS_KINDS, isBusinessKind, type BusinessKind } from "@/lib/market/kinds";
import type { Offering, Reach } from "@/lib/market/questions/profile-types";
import { readsLocal } from "@/lib/market/rivals/reach";
import type { MarketSerp } from "@/lib/market/views";
import { isPlaceholder } from "@/lib/measure/placeholder";

/** What a stored profile holds, as far as the reading goes. */
export interface StoredProfile {
  category?: unknown;
  offeringType?: unknown;
  town?: unknown;
  language?: unknown;
  offerings?: unknown;
  kind?: unknown;
  reach?: unknown;
}

/** The reading a stored profile gains: only what it lacks and the stored
 *  data decides. */
export interface Retrofit {
  offerings?: Offering[];
  kind?: BusinessKind;
  reach?: Reach;
}

/** A trade or firm word that, read alone as the whole of what named the
 *  kind, also names a product: a "builder" lays bricks or builds websites,
 *  an "agency" is a firm or a marketplace that books others' work. Such a
 *  word does not decide the kind on its own (issue 1474). */
const EITHER_WAY = /^(?:builders?|agency|agencies)$/iu;

/** Words that bound a word list, as `KIND_WORDS` bounds its rows. */
function wordsOf(words: string, flags = "iu"): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${words})(?![\\p{L}\\p{N}])`, flags);
}

/** Explicit signals of how the business is bought, wherever a phrase says
 *  them. Software is a product used, not a service carried out; online is
 *  bought from anywhere; in person is carried out where the customer is. */
const SOFTWARE_SIGNAL = wordsOf("software|saas|software-as-a-service|platforms?|apps?|applications?|api|plugins?|cloud-based|web-based|hosted");
const ONLINE_SIGNAL = wordsOf("online|internet");
const IN_PERSON_SIGNAL = wordsOf(
  "on-?site|on site|in-store|in store|in-person|in person|home visits?|site visits?|near (?:you|me)|call-?outs?|house calls?|walk-ins?|at your (?:home|door|premises)"
);

/**
 * The kind a phrase names, by the words a buyer uses for it. Each row is one
 * kind; a phrase that names several is read by the one it names last, which
 * in English is its head ("accounting software" is software, "software
 * consultancy" a firm). German names a trade inside a compound.
 */
const KIND_WORDS: readonly (readonly [BusinessKind, RegExp])[] = (
  [
    [
      "hospitality",
      "restaurants?|caf[eé]s?|coffee (?:shop|house|bar)s?|espresso bars?|wine bars?|cocktail bars?|pubs?|bistros?|brasserie|diners?|dining|brunch|pizzeria|takeaway|" +
        "hotels?|motels?|hostels?|guest ?houses?|bed and breakfast|b&b|venues?|gaststätte|kneipe",
    ],
    [
      "local-service",
      "plumb\\p{L}*|electricians?|electrical contractors?|roof\\p{L}*|hvac|locksmiths?|mechanics?|auto repair|repair shops?|cleaning services?|cleaners|" +
        "landscap\\p{L}*|gardeners?|removals|movers|decorators?|carpenters?|joinery|handyman|builders?|pest control|dental|dentists?|clinics?|physio\\p{L}*|" +
        "chiropract\\p{L}*|veterinar\\p{L}*|opticians?|salons?|barbers?|hairdressers?|spas?|gyms?|fitness studios?|personal trainers?|" +
        "tattoo (?:studio|parlou?r)s?|friseur\\p{L}*|zahnarzt\\p{L}*|klempner\\p{L}*|sanitär\\p{L}*|elektriker\\p{L}*",
    ],
    [
      "shop",
      "shops?|online stores?|retail|retailers?|e-?commerce|boutiques?|bakery|bakeries|florists?|butchers?|direct-to-consumer|" +
        "\\p{L}*bäckerei\\p{L}*|\\p{L}*backwaren|\\p{L}*konditorei\\p{L}*|\\p{L}*metzgerei\\p{L}*",
    ],
    [
      "professional-services",
      "accountants?|accountancy|accounting firms?|bookkeepers?|tax advis[eo]rs?|law firms?|lawyers?|solicitors?|attorneys?|legal services|" +
        "consultants?|consultancy|consultancies|consulting|agency|agencies|architects?|design studios?|financial advis[eo]rs?|professional services|" +
        "steuerberat\\p{L}*|\\p{L}*anwalt\\p{L}*|kanzlei",
    ],
    ["software", "software|saas|apps?|platforms?|api|plugins?|cloud-based|crm|erp|cms"],
    ["creator", "online courses?|courses?|lessons|newsletters?|e-?books?|tutorials|coaching programs?|masterclass(?:es)?"],
  ] as const
).map(([kind, words]) => [kind, wordsOf(words, "giu")] as const);

/** What a phrase is about, before what it is for or where: "software for
 *  restaurants" is software, "plumbers in Austin" plumbers. */
function headPart(text: string): string {
  return text.split(/\s(?:for|in|near|with|to|at|from|by)\s/iu)[0] ?? text;
}

/** What one phrase says of the kind: the kind its head names, whether that
 *  head decides it alone, and the explicit signals it carries. */
interface PhraseReading {
  kind: BusinessKind | null;
  /** Every kind the head names, its own among them ("café and bakery"
   *  names hospitality and a shop). */
  names: ReadonlySet<BusinessKind>;
  /** False where the head is a word that is a trade or a product
   *  (`EITHER_WAY`). */
  firm: boolean;
  software: boolean;
  inPerson: boolean;
}

function readPhrase(text: string): PhraseReading {
  const head = headPart(text);
  const found: { kind: BusinessKind; start: number; end: number; word: string }[] = [];
  for (const [kind, words] of KIND_WORDS) {
    for (const match of head.matchAll(words)) {
      const start = match.index ?? 0;
      found.push({ kind, start, end: start + match[0].length, word: match[0] });
    }
  }
  // A word inside a longer phrase of another row is that phrase's: the
  // "shop" of "coffee shop" names no shop.
  const words = found.filter(
    (one) => !found.some((other) => other !== one && other.start <= one.start && other.end >= one.end && other.end - other.start > one.end - one.start)
  );
  let best: (typeof words)[number] | null = null;
  for (const one of words) if (best === null || one.end > best.end) best = one;
  const names = new Set(words.map((one) => one.kind));
  return {
    kind: best?.kind ?? null,
    names,
    firm: best === null || !EITHER_WAY.test(best.word),
    software: SOFTWARE_SIGNAL.test(text) || ONLINE_SIGNAL.test(text),
    inPerson: IN_PERSON_SIGNAL.test(text),
  };
}

/** The kind a phrase names on its own, `null` where it names none or its
 *  head is a word that is a trade or a product. */
export function kindOfWords(text: string): BusinessKind | null {
  const read = readPhrase(text);
  return read.firm ? read.kind : null;
}

/**
 * The kind a stored category and offering type name together (issue 1474).
 * Where both name one kind by a word that decides it, it is that kind. A
 * word that is a trade or a product ("builder") stands only where the other
 * phrase names the same kind by a word that decides it, or the business
 * names a town or says it meets its customers in person. Two kinds where
 * one phrase also names the other's ("coffee shop", "café and bakery") are
 * the kind both name. Otherwise, where what stands is two kinds, or one
 * kind by such a word only, the explicit signals weigh it: a software,
 * platform, app or online signal in either phrase outweighs a trade carried
 * out in person; an in-person signal ("on site", "in store", "near you")
 * outweighs software or teaching. The one kind left decides; where none or
 * two are, the kind is unread.
 */
export function kindOfProfile(category: string, offeringType: string, town: boolean): BusinessKind | null {
  const phrases = [category, offeringType].filter((phrase) => phrase !== "" && !isPlaceholder(phrase)).map(readPhrase);
  const named = phrases.filter((phrase): phrase is PhraseReading & { kind: BusinessKind } => phrase.kind !== null);
  const software = phrases.some((phrase) => phrase.software);
  const inPerson = phrases.some((phrase) => phrase.inPerson);
  const stands = named.filter(
    (phrase) => phrase.firm || town || inPerson || named.some((other) => other !== phrase && other.firm && other.kind === phrase.kind)
  );
  const kinds = [...new Set(stands.map((phrase) => phrase.kind))];
  if (kinds.length === 1 && stands.every((phrase) => phrase.firm)) return kinds[0]!;
  const shared = kinds.filter((kind) => stands.every((phrase) => phrase.names.has(kind)));
  if (kinds.length > 1 && shared.length === 1) return shared[0]!;
  const weighed = kinds.filter((kind) => !((software && BUSINESS_KINDS[kind].inPerson) || (inPerson && !BUSINESS_KINDS[kind].placed)));
  return weighed.length === 1 ? weighed[0]! : null;
}

/** schema.org types that name a kind, as `parse.ts` keeps them (lower case).
 *  A plain Organization, LocalBusiness or Store says only that it is one. */
const SCHEMA_KINDS: Readonly<Record<string, BusinessKind>> = Object.freeze({
  restaurant: "hospitality",
  fastfoodrestaurant: "hospitality",
  cafeorcoffeeshop: "hospitality",
  barorpub: "hospitality",
  brewery: "hospitality",
  winery: "hospitality",
  foodestablishment: "hospitality",
  hotel: "hospitality",
  motel: "hospitality",
  hostel: "hospitality",
  bedandbreakfast: "hospitality",
  lodgingbusiness: "hospitality",
  resort: "hospitality",
  plumber: "local-service",
  electrician: "local-service",
  roofingcontractor: "local-service",
  hvacbusiness: "local-service",
  locksmith: "local-service",
  housepainter: "local-service",
  generalcontractor: "local-service",
  movingcompany: "local-service",
  autorepair: "local-service",
  autobodyshop: "local-service",
  dentist: "local-service",
  physician: "local-service",
  medicalclinic: "local-service",
  optician: "local-service",
  veterinarycare: "local-service",
  beautysalon: "local-service",
  hairsalon: "local-service",
  nailsalon: "local-service",
  dayspa: "local-service",
  exercisegym: "local-service",
  healthclub: "local-service",
  childcare: "local-service",
  drycleaningorlaundry: "local-service",
  tattooparlor: "local-service",
  bakery: "shop",
  florist: "shop",
  onlinestore: "shop",
  accountingservice: "professional-services",
  legalservice: "professional-services",
  attorney: "professional-services",
  notary: "professional-services",
  softwareapplication: "software",
  webapplication: "software",
  mobileapplication: "software",
});

/** The one kind the home page's structured data names, `null` where it
 *  names none or more than one. */
function kindOfSchema(types: readonly string[]): BusinessKind | null {
  const kinds = new Set(types.map((type) => SCHEMA_KINDS[type.toLowerCase()]).filter((kind) => kind !== undefined));
  return kinds.size === 1 ? [...kinds][0]! : null;
}

/** Words that stand at the end of a line of several ("payroll and HR
 *  software"), so each line before it takes them. */
const SHARED_HEADS = new Set<string>([...OFFERINGS.genericWords, "software", "platform", "platforms", "apps", "tools"]);

/** A word that makes a category one phrase about something, not a list. */
const NOT_A_LIST = /\s(?:for|in|of|with|near|to|from|by|at|on)\s/iu;

/**
 * The lines a stored category names. A category is several lines only where
 * it is a short English list ("payroll and HR software", "project management
 * and team collaboration") whose every part stands as a line: a shared last
 * word such as "software" or "services" is carried to the parts before it,
 * and otherwise a part of one word is read as a word describing the rest
 * ("residential and commercial plumbing") and the category is one line.
 * Each line is given an equal share: the site's own shares were never asked.
 */
export function linesOfCategory(category: string, language: string): Offering[] {
  const whole = category.trim();
  const one: Offering[] = [{ name: whole, category: whole, weight: 1 }];
  if (language !== "en" || NOT_A_LIST.test(` ${whole} `)) return one;
  const parts = whole
    .split(/\s*(?:,|;|\s&\s|\sand\s|\s\+\s|\s\/\s)\s*/iu)
    .map((part) => part.trim())
    .filter((part) => part !== "");
  if (parts.length < 2 || parts.length > 4 || parts.some((part) => part.split(/\s+/u).length > 4)) return one;
  const last = parts[parts.length - 1]!.split(/\s+/u);
  const head = last[last.length - 1]!;
  const shared = SHARED_HEADS.has(head.toLowerCase()) && last.length > 1;
  const lines: string[] = [];
  for (const part of parts) {
    const words = part.split(/\s+/u);
    const ends = SHARED_HEADS.has(words[words.length - 1]!.toLowerCase());
    if (shared && !ends) lines.push(`${part} ${head}`);
    else if (words.length > 1 || ends) lines.push(part);
    else return one;
  }
  const distinct = lines.filter((line, i) => lines.findIndex((other) => other.toLowerCase() === line.toLowerCase()) === i);
  if (distinct.length < 2) return one;
  const share = Math.floor(1000 / distinct.length) / 1000;
  return distinct.map((line, i) => ({
    name: line,
    category: line,
    weight: i === 0 ? Math.round((1 - share * (distinct.length - 1)) * 1000) / 1000 : share,
  }));
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * What a stored profile gains of the reading issue 1454 asks a new pass
 * for, from the stored data alone. Empty where it already holds all three,
 * or where nothing stored decides the rest.
 *
 * - **Lines.** The stored category's lines (`linesOfCategory`); none where
 *   the category is empty or a placeholder.
 * - **Kind.** A paying site's concluded market's kind, as the paid pass read
 *   it. Else the kind the category and the offering type name together
 *   (`kindOfProfile`), then the home page's structured data (one kind
 *   only). Else unread.
 * - **Reach.** A paying site's market: a place the founder gave or the
 *   pass settled is local; one read as selling nationally or online is international for a kind that
 *   is bought from anywhere (software, teaching) and national otherwise. A
 *   free scan: a kind bought from anywhere is international; a town
 *   measured or read, or an in-person trade in the structured data, is
 *   local (issue 1468's rule), as is a business met in person whose
 *   offering a map bears out. Else unread: a shop, a firm or a trade that
 *   names no town may sell across its country or beyond, and nothing stored
 *   says which.
 */
export function retrofitReading(a: {
  profile: StoredProfile;
  /** The pass measured in a town (`locale.place`). */
  measuredInTown: boolean;
  schemaTypes: readonly string[];
  serps: readonly MarketSerp[];
  /** A paying site's market: the kind and place its pass concluded
   *  (`sites.market.current`) and the place the founder gave (`area`). */
  market?: { kind?: unknown; serves?: unknown; area?: { place?: unknown } } | null;
}): Retrofit {
  const p = a.profile;
  const out: Retrofit = {};
  const category = text(p.category);
  const offeringType = text(p.offeringType);

  if (!Array.isArray(p.offerings) && category !== "" && !isPlaceholder(category)) {
    out.offerings = linesOfCategory(category, text(p.language) || "en");
  }

  const stored = isBusinessKind(p.kind) ? p.kind : null;
  const concluded = a.market?.kind;
  const kind =
    stored ??
    (isBusinessKind(concluded) ? concluded : null) ??
    kindOfProfile(category, offeringType, text(p.town) !== "" && !isPlaceholder(text(p.town))) ??
    kindOfSchema(a.schemaTypes);
  if (stored === null && kind !== null) out.kind = kind;

  if (p.reach !== "local" && p.reach !== "national" && p.reach !== "international") {
    const anywhere = kind !== null && !BUSINESS_KINDS[kind].placed;
    const market = a.market;
    const town = typeof p.town === "string" ? p.town : undefined;
    let reach: Reach | null;
    const served = market?.area !== undefined ? market.area.place : market?.serves;
    if (served !== undefined) {
      reach = served !== null ? "local" : anywhere ? "international" : "national";
    } else if (anywhere) {
      reach = "international";
    } else {
      // Issue 1468's rule, with the map read only for a business the
      // customer meets in person: a shop or a firm with a map on its
      // searches may still sell to anywhere (an online coffee roaster).
      const said = { measuredInTown: a.measuredInTown, profile: { ...(town === undefined ? {} : { town }), offeringType, category }, schemaTypes: a.schemaTypes };
      const inPerson = kind !== null && BUSINESS_KINDS[kind].inPerson;
      reach = readsLocal({ ...said, serps: [] }) || (inPerson && readsLocal({ ...said, serps: a.serps })) ? "local" : null;
    }
    if (reach !== null) out.reach = reach;
  }
  return out;
}
