// src/lib/locale/language/de.ts — German (SPEC §6, owner D66, issue 1311).
//
// Drafted wording (issue 759): every sentence a buyer or a founder can read
// from this file is listed in the pull request for the owner to correct.
//
// Two things German does that English does not, and both are handled here
// and nowhere else. It joins words ("Sauerteigbrot"), so a word of a search
// is the business's own where it holds one of the business's words. And a
// noun's article and ending follow its gender, which a template cannot
// know, so every template below asks in a form that needs neither.
import { DE_PROMPTS } from "./prompts/de";
import type { LanguagePack } from "./types";

function sentenceCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim().replace(/[.?!]+$/, "");
}

/** Nouns keep their capital in German, so the head is never lower-cased. */
function buyerHead(buyer: string): string {
  return clean(buyer).split(/\s*,\s*|\s+(?:die|welche|deren|denen)\s+/)[0] ?? "";
}

const QUESTIONS: ReadonlyArray<readonly [RegExp, (m: RegExpMatchArray) => string]> = Object.freeze([
  [/^(?:beste[rsnm]?|die besten|der beste|das beste) (.+)$/, (m) => `Was sind die besten Empfehlungen für ${m[1]}?`],
  [/^(.+?) (?:vs|versus) (.+)$/, (m) => `${sentenceCase(m[1] ?? "")} oder ${m[2]} – was ist besser?`],
  [/^(.+?) alternativen?$/, (m) => `Welche Alternativen gibt es zu ${m[1]}?`],
  [/^top (?:\d+ )?(.+)$/, (m) => `Was sind die Top-Empfehlungen für ${m[1]}?`],
  [/^(.+?) (?:kosten|preise?)$/, (m) => `Was kostet ${m[1]}?`],
  [/^was (ist|sind) (.+)$/, (m) => `Was ${m[1]} ${m[2]}?`],
]);

const UMLAUTS: Readonly<Record<string, string>> = { ä: "a", ö: "o", ü: "u", ß: "ss" };
const ENDINGS = ["ern", "em", "er", "en", "es", "e"] as const;
const STEM_MIN = 4;

/** A word without its plural or case ending, umlauts flattened: "Bäckereien"
 *  and "Bäckerei" are one word, as are "Preise" and "Preis". A final "s"
 *  goes only after a consonant that takes one, so "Preis" keeps its own. */
function stem(token: string): string {
  const plain = token.replace(/[äöüß]/g, (letter) => UMLAUTS[letter] ?? letter);
  for (const ending of ENDINGS) {
    if (plain.endsWith(ending) && plain.length - ending.length >= STEM_MIN) return plain.slice(0, -ending.length);
  }
  if (/[bdfghklmnrt]s$/.test(plain) && plain.length - 1 >= STEM_MIN) return plain.slice(0, -1);
  return plain;
}

/** A list of words and each one's stem: the code that reads a search with
 *  its language meets the stem, the code that reads it without meets the
 *  word. */
function withStems(words: readonly string[]): Set<string> {
  return new Set(words.flatMap((word) => [word, stem(word)]));
}

export const DE: LanguagePack = {
  language: "de",
  pages: {
    paths: {
      legal: ["datenschutz", "datenschutzerklaerung", "datenschutzerklärung", "agb", "widerruf", "widerrufsbelehrung", "widerrufsrecht", "rechtliches", "nutzungsbedingungen", "haftungsausschluss"],
      contact: ["kontakt", "anfahrt", "hilfe"],
      pricing: ["preise", "preis", "preisliste", "tarife", "kosten"],
      about: ["ueber-uns", "über-uns", "uber-uns", "unternehmen", "geschichte", "karriere", "stellenangebote"],
      blog: ["aktuelles", "neuigkeiten", "magazin", "ratgeber", "presse"],
      features: ["funktionen", "leistungen", "so-funktionierts", "vorteile"],
      product: ["produkte", "produkt", "loesungen", "lösungen", "sortiment", "angebot", "angebote", "dienstleistungen", "service"],
      docs: ["dokumentation", "anleitung", "anleitungen", "hilfe"],
      customers: ["kunden", "referenzen", "fallstudien", "erfolgsgeschichten"],
      reviews: ["bewertungen", "kundenstimmen", "erfahrungen"],
    },
    headings: {
      legal: ["datenschutzerklärung", "datenschutz", "allgemeine geschäftsbedingungen", "agb", "widerrufsbelehrung", "nutzungsbedingungen"],
      contact: ["kontakt", "so erreichen sie uns", "anfahrt"],
      pricing: ["preise", "preisliste", "unsere tarife", "was es kostet"],
      about: ["über uns", "unsere geschichte", "unser team", "wer wir sind", "karriere"],
      blog: ["aktuelles", "neuigkeiten", "pressemitteilung", "fallstudie"],
      features: ["funktionen", "so funktioniert", "leistungen"],
      product: ["unsere produkte", "unser sortiment", "lösungen", "unsere leistungen"],
    },
  },
  shapes: {
    best: "beste[rsnm]?",
    versus: "im vergleich zu",
    alternatives: "alternativen",
    price: "preise?|preisen|kosten|kostet|preisliste|tarife?",
    integration: "integrationen|schnittstellen?",
    askStart: "wie|warum|wieso|weshalb",
    pain: "probleme?|fehler|funktioniert nicht|geht nicht|beheben|reparieren|kaputt|defekt|störung(?:en)?",
    howToStart: "wie (?:kann|können|mach\\p{L}*|geht|funktioniert|erstell\\p{L}*|bekomm\\p{L}*|find\\p{L}*|man|ich|wird|werden|lange|oft|viel)",
    solution: "plattform(?:en)?|programme?|anbieter|lösung(?:en)?",
    informationalStart: "was (?:ist|sind|bedeutet)|warum|wieso|wer|wann|wo",
    definition: "definitionen|bedeutung",
    compare: "vergleich(?:e|en)?|vergleichen|erfahrungen|erfahrungsberichte?|bewertungen|testsieger",
    guideStart: "wie (?:kann|können|mach\\p{L}*|erstell\\p{L}*|richte|installier\\p{L}*|man|ich)",
    guide: "schritt für schritt|schritte|einrichten|einrichtung|installieren|konfigurieren|anleitung(?:en)?|checkliste|vorlagen?|selber machen|selbst machen",
    insights: "neuigkeiten|aktuell(?:e[sn]?)?|neu in|änderungen|neuerungen|diese[sn]? (?:jahr|monat|woche)",
    research: "statistik(?:en)?|zahlen|daten|studien?|bericht|umfragen?|forschung",
    documentationStart: "was ist|was sind|wie funktioniert|wie funktionieren",
    documentation: "dokumentation|doku|referenz|erklärt|erklärung|bedeutung|leitfaden|ratgeber|funktionen|schnittstellen?",
    format: "vergleich(?:e|en)?|alternativen|integrationen|vorlagen?",
    asksPrice: "kosten|kostet|preise?|teuer|günstig\\p{L}*|billig\\p{L}*|wie viel|wieviel",
  },
  stopWords: new Set([
    "der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem", "einer", "eines",
    "und", "oder", "für", "mit", "ohne", "von", "vom", "zu", "zum", "zur", "in", "im", "an", "am",
    "auf", "aus", "bei", "nach", "über", "unter", "um", "ist", "sind", "sein", "mein", "meine",
    "dein", "deine", "unser", "unsere", "ihr", "ihre", "es", "ich", "du", "wir", "sie", "man",
    "kann", "können", "als", "auch", "nicht", "dass",
  ]),
  genericTokens: withStems([
    "beste", "bester", "bestes", "besten", "top", "vs", "versus", "alternative", "alternativen",
    "vergleich", "vergleichen", "erfahrungen", "bewertungen", "test", "testsieger", "software",
    "tool", "tools", "app", "apps", "plattform", "programm", "anbieter", "lösung", "wie", "was",
    "warum", "welche", "welcher", "welches", "wer", "wann", "wo", "online", "preis", "preise",
    "kosten", "kostet", "tarif", "ratgeber", "anleitung", "beispiel", "vorlage", "liste", "nähe",
    "neu", "gut", "günstig", "kaufen", "bestellen", "funktioniert", "problem", "fehler",
    "beheben", "kaputt", "defekt", "empfehlung", "empfehlungen",
  ]),
  priceFiller: new Set(["preis", "preise", "kosten", "kostet", "wie", "viel", "wieviel", "was", "ist", "der", "die", "das", "ein", "eine", "tarif", "tarife"]),
  priceWords: withStems(["preis", "preise", "kosten", "kostet", "tarif", "tarife"]),
  // Drafted (issue 1449); the owner may correct the lists.
  offering: {
    before: new Set(["für", "in", "im", "nahe", "mit", "bei", "beim", "von", "vom", "an", "am", "um", "zum", "zur"]),
    local: new Set(["nähe", "umgebung", "lokal", "stadt", "zentrum", "innenstadt", "geöffnet", "offen", "heute", "jetzt", "24", "stunden", "notdienst", "günstig"]),
    providers: (
      "dienst service reparatur installation montage reinigung wartung austausch lieferung laden geschäft café restaurant " +
      "bäckerei konditorei bar salon praxis studio firma betrieb fachbetrieb agentur berater beratung handwerker " +
      "frühstück brunch mittagessen mittagstisch abendessen"
    ).split(" "),
  },
  stem,
  title: {
    filler: new Set(
      ("der die das den dem des ein eine einen einem einer und oder aber für mit ohne von vom zu zum zur in im an am auf aus bei nach " +
        "über unter um ist sind war wird werden kann können ich du wir sie ihr es man mein dein unser als auch nicht wie was wer wo " +
        "wann warum welche welcher welches beste besten bester bestes top vs so").split(" ")
    ),
    asksStart: "wie|was|warum|wieso|weshalb|welche[rsnm]?|wer|wann|wo|kann|können|ist|sind|lohnt|sollte|braucht|brauche",
    free: "kostenlos|kostenfrei|gratis",
    serial: "folge|episode|ep|ausgabe|heft|band|bd|kapitel|staffel|teil",
    // Drafted (issue 759): the German counterparts of D51's banned patterns.
    banned: [
      "fragen, beantwortet",
      "fragen beantwortet",
      "käuferfragen",
      "ultimative",
      "alles, was sie wissen müssen",
      "alles, was du wissen musst",
      "alles was sie wissen müssen",
      "alles was du wissen musst",
      "entfesseln",
      "entdecken sie",
      "umfassend",
      "kompletter leitfaden",
      "vollständiger leitfaden",
    ],
    // Drafted (issue 1389): the German counterparts of the English tropes.
    tropes: ["(?:entfessel|entmystifizier|navigier)\\p{L}*", "warum .+ wichtig(?: ist| sind)?", "in der heutigen", "in zeiten von"],
    tropeSamples: ["entfesseln", "entmystifizieren", "warum X wichtig ist", "in der heutigen … Welt"],
    double: "(?:wie|so) [^:(]*? (?:und|&)",
  },
  supports(token, support) {
    if (support.has(token)) return true;
    if (token.length < STEM_MIN) return false;
    for (const known of support) {
      if (known.length >= STEM_MIN && (token.includes(known) || known.includes(token))) return true;
    }
    return false;
  },

  alternativesSearch: (name) => `${name} alternative`,
  versusSearch: (first, second) => `${first} vs ${second}`,
  priceSearch: (name) => `${name} preise`,
  forBuyerSearch: (name, buyer) => `${name} für ${buyer}`,
  jobSearch: (job) => `wie kann man ${job}`,
  studySearch: (target) => `${target} Statistik Studie`,
  guidanceSearch: (target) => `${target} offizielle Anleitung`,

  question(keyword) {
    const text = keyword.trim().replace(/\s+/g, " ");
    const lower = text.toLowerCase();
    for (const [pattern, build] of QUESTIONS) {
      const match = lower.match(pattern);
      if (match) return build(match);
    }
    return `${sentenceCase(text)}?`;
  },
  prompts: {
    ...DE_PROMPTS,
    software: {
    category: {
      best: (category) => `Was sind aktuell die besten Anbieter für ${category}, und worin ist jeder gut?`,
      recommended: (synonym) => `Welche Anbieter für ${synonym} werden dieses Jahr wirklich empfohlen?`,
      newTo: (category) => `Ich kenne mich mit ${category} noch nicht aus. Welche Anbieter sollte ich mir zuerst ansehen?`,
      worthPaying: (category) => `Welche Anbieter für ${category} sind ihr Geld wert, und warum?`,
      bestReviewed: (category) => `Welche Anbieter für ${category} bekommen die besten Bewertungen von ihren Kunden?`,
      shortlist: (category) => `Welche Anbieter für ${category} sollte man beim ersten Kauf in die engere Wahl nehmen?`,
    },
    useCases: [
      (name) => `Welche Anbieter für ${name} passen zu einem kleinen Budget?`,
      (name) => `Welche Anbieter für ${name} kann ich ohne Agentur nutzen?`,
      (name) => `Welche Anbieter für ${name} eignen sich für ein Ein-Personen-Team?`,
      (name) => `Welche Anbieter für ${name} lassen sich an einem einzigen Tag einrichten?`,
      (name) => `Welche Anbieter für ${name} kommen ohne eigene Entwickler aus?`,
      (name) => `Welche Anbieter für ${name} eignen sich für eine ganz neue Website?`,
      (name) => `Welche Anbieter für ${name} bieten eine kostenlose Testphase?`,
    ],
    persona: [
      (buyer, category) => `Wir sind ${buyer}. Welcher Anbieter für ${category} passt am besten zu uns?`,
      (buyer, category) => `Welche Anbieter für ${category} sind für ${buyer} gemacht?`,
      (buyer, category) => `Was nutzen ${buyer} tatsächlich für ${category}?`,
      (buyer, category) => `Ich arbeite mit ${buyer}. Welchen Anbieter für ${category} sollte ich ihnen empfehlen?`,
    ],
    comparison: {
      compare: (first, second, category) => `Wie schneidet ${first} im Vergleich zu ${second} bei ${category} ab?`,
      alternatives: (first, buyer) => `Was sind die besten Alternativen zu ${first}${buyer === "" ? "" : ` für ${buyer}`}?`,
      better: (second, third, category) => `${second} oder ${third}: Was ist die bessere Wahl für ${category}?`,
      value: (category, first, second, third) => `Wer bietet bei ${category} das bessere Preis-Leistungs-Verhältnis: ${first}, ${second} oder ${third}?`,
    },
    problem: [
      (category) => `Ich komme mit ${category} nicht weiter. Welche Anbieter können das lösen?`,
      (category) => `Nichts, was ich für ${category} ausprobiert habe, funktioniert. Was sollte ich als Nächstes versuchen?`,
      (category) => `Wie komme ich bei ${category} am schnellsten zu Ergebnissen, und welche Anbieter übernehmen das für mich?`,
    ],
    branded: {
      what: (name, category) => `Was ist ${name}, und taugt es etwas für ${category}?`,
      alternative: (name, first, category) => `Ist ${name} eine gute Alternative zu ${first} für ${category}?`,
    },
    buyerHead,
    },
  },
  buyerPrompts: {
    best: (name) => `Was sind die besten Anbieter für ${name}?`,
    forBuyer: (category, buyer) => `Welcher Anbieter für ${category} ist der beste für ${buyer}?`,
    job: (job) => `Wer hilft mir bei diesem Anliegen: ${job}?`,
    alternatives: (rival) => `Was sind die besten Alternativen zu ${rival}?`,
  },
};
