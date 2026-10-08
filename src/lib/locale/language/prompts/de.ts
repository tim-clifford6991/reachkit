// src/lib/locale/language/prompts/de.ts — the tracked buyer prompts for
// each kind of business that is not software, in German (SPEC §6, owner
// D69 of 2026-10-07, issue 1318). Software keeps the set it had (`../de.ts`).
//
// The same split and the same subjects as `./en.ts`.
//
// **How they are worded.** A German question word takes the noun's gender
// ("welcher Klempner", "welche Bäckerei", "welches Restaurant"), and the
// market's name is whatever buyers search. So the name stands first, before
// a colon, and the question follows it: "Bäckerei in Düsseldorf: Wer hat
// die besten Bewertungen?" reads right for any noun. "Sie" throughout (D66).
//
// Every sentence here is drafted (issue 759) and listed in the pull request.
import type { BusinessKind } from "@/lib/market/kinds";
import type { PromptWording } from "../types";

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim().replace(/[.?!]+$/, "");
}

/** Nouns keep their capital in German, so the head is never lower-cased. */
const buyerHead = (buyer: string): string => clean(buyer).split(/\s*,\s*|\s+(?:die|welche|deren|denen)\s+/)[0] ?? "";

/** A market's name opens the sentence, and it is a noun. */
const named = (text: string): string => (text === "" ? text : text[0]!.toUpperCase() + text.slice(1));

const comparison: PromptWording["comparison"] = {
  compare: (first, second, category) => `${category}: Wie schneidet ${first} im Vergleich zu ${second} ab?`,
  alternatives: (first, buyer) => `Was sind die besten Alternativen zu ${first}${buyer === "" ? "" : ` für ${buyer}`}?`,
  better: (second, third, category) => `${category}: ${second} oder ${third} – wen würden Sie wählen?`,
  value: (category, first, second, third) => `${category}: Wer bietet das bessere Preis-Leistungs-Verhältnis – ${first}, ${second} oder ${third}?`,
};

const branded: PromptWording["branded"] = {
  what: (name, category) => `${category}: Ist ${name} eine gute Wahl?`,
  alternative: (name, first, category) => `${category}: Ist ${name} eine gute Alternative zu ${first}?`,
};

export const DE_PROMPTS: Readonly<Record<Exclude<BusinessKind, "software">, PromptWording>> = Object.freeze({
  // Notfälle, Kosten und Vertrauen.
  "local-service": {
    category: {
      best: (category) => `${category}: Wen können Sie empfehlen, und warum?`,
      recommended: (synonym) => `${synonym}: Wen empfehlen Kunden vor Ort wirklich?`,
      newTo: (category) => `${category}: Worauf sollte ich achten, wenn ich zum ersten Mal jemanden beauftrage?`,
      worthPaying: (category) => `${category}: Wer ist sein Geld wert, und warum?`,
      bestReviewed: (category) => `${category}: Wer hat die besten Bewertungen?`,
      shortlist: (category) => `${category}: Wen sollte ich in die engere Wahl nehmen?`,
    },
    useCases: [
      (name) => `${name}: Wer hilft im Notfall noch am selben Tag?`,
      (name) => `${name}: Wer nennt vorab einen festen Preis?`,
      (name) => `${name}: Wer hat auch abends oder am Wochenende Termine?`,
      (name) => `${name}: Bei wem kann ich mich auf fachgerechte Arbeit verlassen?`,
      (name) => `${name}: Wer übernimmt auch kleine Aufträge zu einem fairen Preis?`,
      (name) => `${name}: Wer gibt eine Garantie auf die Arbeit?`,
      (name) => `${name}: Wer nimmt diese Woche noch neue Kunden an?`,
    ],
    persona: [
      (buyer, category) => `Wir sind ${buyer}. ${category}: Wer passt am besten zu uns?`,
      (buyer, category) => `${category}: Wen empfehlen Sie für ${buyer}?`,
      (buyer, category) => `${category}: Zu wem gehen ${buyer} immer wieder?`,
      (buyer, category) => `Ich frage für ${buyer}. ${category}: An wen sollten sie sich wenden?`,
    ],
    comparison,
    problem: [
      (category) => `Ich brauche heute noch Hilfe. ${category}: Auf wen ist kurzfristig Verlass?`,
      (category) => `Meine letzte Erfahrung war schlecht. ${category}: Wer arbeitet wirklich zuverlässig?`,
      (category) => `${category}: Wen sollte ich zuerst anrufen, und was sollte ich vorher fragen?`,
    ],
    branded,
    buyerHead,
    named,
  },
  // Produkte, Geschenke und Preis.
  shop: {
    category: {
      best: (category) => `${category}: Wo kaufen Sie am liebsten, und warum?`,
      recommended: (synonym) => `${synonym}: Welche Adressen werden wirklich empfohlen?`,
      newTo: (category) => `Ich kaufe zum ersten Mal. ${category}: Wo sollte ich anfangen?`,
      worthPaying: (category) => `${category}: Wo lohnt es sich, etwas mehr zu bezahlen, und warum?`,
      bestReviewed: (category) => `${category}: Wer hat die besten Kundenbewertungen?`,
      shortlist: (category) => `${category}: Welche Geschäfte sollte ich zuerst vergleichen?`,
    },
    useCases: [
      (name) => `${name}: Wo finde ich ein schönes Geschenk?`,
      (name) => `${name}: Wo kaufe ich gut bei kleinem Budget?`,
      (name) => `${name}: Wer liefert schnell?`,
      (name) => `${name}: Wer stellt noch selbst und in kleinen Mengen her?`,
      (name) => `${name}: Wo finde ich etwas für einen besonderen Anlass?`,
      (name) => `${name}: Wo werde ich beim Aussuchen gut beraten?`,
      (name) => `${name}: Welcher unabhängige Laden ist besser als die großen Ketten?`,
    ],
    persona: [
      (buyer, category) => `Wir sind ${buyer}. ${category}: Wo sollten wir kaufen?`,
      (buyer, category) => `${category}: Was empfehlen Sie für ${buyer}?`,
      (buyer, category) => `${category}: Wo kaufen ${buyer} am liebsten?`,
      (buyer, category) => `Ich kaufe für ${buyer}. ${category}: Wo werde ich fündig?`,
    ],
    comparison,
    problem: [
      (category) => `Mein letzter Kauf war eine Enttäuschung. ${category}: Auf wen ist Verlass?`,
      (category) => `Ich brauche es schnell. ${category}: Wer hat es rechtzeitig da?`,
      (category) => `Ich kann mich nicht entscheiden. ${category}: Wer hat die beste Auswahl, und worauf sollte ich achten?`,
    ],
    branded,
    buyerHead,
    named,
  },
  // Anlässe, Gerichte und Viertel.
  hospitality: {
    category: {
      best: (category) => `${category}: Wohin würden Sie gehen, und warum?`,
      recommended: (synonym) => `${synonym}: Was empfehlen Einheimische wirklich?`,
      newTo: (category) => `${category}: Was empfehlen Sie für den ersten Besuch?`,
      worthPaying: (category) => `${category}: Was ist seinen Preis wert, und warum?`,
      bestReviewed: (category) => `${category}: Was loben Gäste am meisten?`,
      shortlist: (category) => `${category}: Welche Adressen gehören auf meine Liste?`,
    },
    useCases: [
      (name) => `${name}: Was eignet sich für einen Geburtstag oder Jahrestag?`,
      (name) => `${name}: Wo ist Platz für eine größere Gruppe?`,
      (name) => `${name}: Wohin geht man für die Spezialität des Hauses?`,
      (name) => `${name}: Was empfehlen Sie wegen Viertel und Atmosphäre?`,
      (name) => `${name}: Wo wird gut auf Vegetarier und Allergiker geachtet?`,
      (name) => `${name}: Wo bekomme ich auch kurzfristig noch etwas?`,
      (name) => `${name}: Was passt zu einem geschäftlichen Anlass?`,
    ],
    persona: [
      (buyer, category) => `Wir sind ${buyer}. ${category}: Was passt am besten zu uns?`,
      (buyer, category) => `${category}: Was empfehlen Sie für ${buyer}?`,
      (buyer, category) => `${category}: Wohin gehen ${buyer} immer wieder?`,
      (buyer, category) => `Ich buche für ${buyer}. ${category}: Was sollte ich wählen?`,
    ],
    comparison,
    problem: [
      (category) => `Ich bin spät dran. ${category}: Wo bekomme ich heute Abend noch etwas?`,
      (category) => `Mein letzter Besuch war eine Enttäuschung. ${category}: Wo werde ich nicht enttäuscht?`,
      (category) => `${category}: Was sollte ich für einen besonderen Anlass buchen, und worauf sollte ich achten?`,
    ],
    branded,
    buyerHead,
    named,
  },
  // Passung, Honorar und Vertrauen.
  "professional-services": {
    category: {
      best: (category) => `${category}: Wen können Sie empfehlen, und warum?`,
      recommended: (synonym) => `${synonym}: Wen empfehlen Mandanten und Kunden wirklich?`,
      newTo: (category) => `${category}: Worauf sollte ich achten, wenn ich zum ersten Mal jemanden beauftrage?`,
      worthPaying: (category) => `${category}: Wer ist sein Honorar wert, und warum?`,
      bestReviewed: (category) => `${category}: Wer hat den besten Ruf bei seinen Kunden?`,
      shortlist: (category) => `${category}: Wen sollte ich in die engere Wahl nehmen?`,
    },
    useCases: [
      (name) => `${name}: Wer nimmt auch kleine Unternehmen als Kunden an?`,
      (name) => `${name}: Wer nennt vorab ein festes Honorar?`,
      (name) => `${name}: Wem kann ich einen komplizierten Fall anvertrauen?`,
      (name) => `${name}: Wer kann in ein bis zwei Wochen anfangen?`,
      (name) => `${name}: Wo habe ich einen festen Ansprechpartner?`,
      (name) => `${name}: Wer eignet sich für ein erstes Projekt mit kleinem Budget?`,
      (name) => `${name}: Wer kann Ergebnisse für Unternehmen wie meines vorweisen?`,
    ],
    persona: [
      (buyer, category) => `Wir sind ${buyer}. ${category}: Wer passt am besten zu uns?`,
      (buyer, category) => `${category}: Wen empfehlen Sie für ${buyer}?`,
      (buyer, category) => `${category}: Wen beauftragen ${buyer} üblicherweise?`,
      (buyer, category) => `Ich berate ${buyer}. ${category}: An wen sollten sie sich wenden?`,
    ],
    comparison,
    problem: [
      (category) => `Wir sind mit unserem jetzigen Dienstleister unzufrieden. ${category}: Mit wem sollten wir stattdessen sprechen?`,
      (category) => `Bei uns läuft eine Frist ab. ${category}: Wer kann kurzfristig übernehmen?`,
      (category) => `${category}: Mit wem sollte ich zuerst sprechen, und was sollte ich vor der Unterschrift fragen?`,
    ],
    branded,
    buyerHead,
    named,
  },
  // Niveau, Zeit und ob es das Geld wert ist.
  creator: {
    category: {
      best: (category) => `${category}: Was können Sie empfehlen, und warum?`,
      recommended: (synonym) => `${synonym}: Was empfehlen Lernende dieses Jahr wirklich?`,
      newTo: (category) => `Ich fange bei null an. ${category}: Womit sollte ich beginnen?`,
      worthPaying: (category) => `${category}: Was ist sein Geld wert, und warum?`,
      bestReviewed: (category) => `${category}: Was bewerten ehemalige Teilnehmer am besten?`,
      shortlist: (category) => `${category}: Was sollte ich in die engere Wahl nehmen?`,
    },
    useCases: [
      (name) => `${name}: Was lässt sich abends neben einem Vollzeitjob schaffen?`,
      (name) => `${name}: Was eignet sich für absolute Anfänger?`,
      (name) => `${name}: Womit komme ich schnell zu einem echten Projekt?`,
      (name) => `${name}: Was kann ich einmalig kaufen, ohne Abo?`,
      (name) => `${name}: Was ist dieses Jahr noch aktuell?`,
      (name) => `${name}: Was bringt mich im Beruf weiter?`,
      (name) => `${name}: Was kann ich kostenlos testen, bevor ich bezahle?`,
    ],
    persona: [
      (buyer, category) => `Wir sind ${buyer}. ${category}: Was passt am besten zu uns?`,
      (buyer, category) => `${category}: Was empfehlen Sie für ${buyer}?`,
      (buyer, category) => `${category}: Was bewerten ${buyer} besonders gut?`,
      (buyer, category) => `Ich betreue ${buyer}. ${category}: Was sollte ich ihnen empfehlen?`,
    ],
    comparison,
    problem: [
      (category) => `Ich fange immer wieder an und höre auf. ${category}: Was hält mich bei der Stange?`,
      (category) => `Mit kostenlosen Anleitungen komme ich nicht weiter. ${category}: Was hilft mir darüber hinaus?`,
      (category) => `${category}: Womit sollte ich anfangen, und was sollte ich vor dem Kauf wissen?`,
    ],
    branded,
    buyerHead,
    named,
  },
});
