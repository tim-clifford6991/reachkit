// src/lib/presentation/copy/keys/de/page.ts — what a page written for a
// German site, and the hosted blog it is published on, say in German (SPEC
// §6, owner D66 of 2026-10-07, issue 1311): the fixed headings, labels and
// lines of `../draft.ts` and `../publish.ts` that are printed on the
// customer's own domain. Drafted (issue 759); the pull request lists every
// sentence for the owner to correct.
//
// A key left out is shown in English.
import type { CopyTranslation } from "../../translated.ts";

export const PAGE_COPY_DE = {
  // The page's own body
  "body.sources.heading": "Quellen",
  "body.sources.read": "abgerufen am {date}",
  "body.table.option": "Anbieter",
  "body.table.pricing": "Preise",
  "body.table.does": "Leistung",
  "body.table.stated": "Was die eigene Seite sagt",
  "body.table.checked": "Preise zuletzt geprüft am {date}.",
  "body.table.custom": "Preis auf Anfrage",
  "body.table.currencies": "Die Preise stehen in der Währung, in der jeder Anbieter sie veröffentlicht; keiner wurde umgerechnet.",
  "body.table.baseline": "{name} (zum Vergleich)",
  "body.answer.heading": "Die kurze Antwort",
  "body.takeaways.heading": "Das Wichtigste in Kürze",
  "body.faq.heading": "Fragen, die Käufer stellen",
  "body.table.label": "Tabelle – seitlich scrollen, um alle Spalten zu sehen",
  "body.guides.heading": "Weitere Ratgeber von {publisher}",

  // Facts from the site's own measurement
  "fact.report.score": "ReachKit hat {domain} am {date} gemessen und mit einem Auffindbarkeits-Score von {score} von 100 bewertet.",
  "fact.report.answers": "Am {date} nannten KI-Antworten {domain} bei {count} von {total} Käuferfragen, die sie in der Messung von ReachKit beantworteten.",
  "fact.report.rival": "Am {date} zitierten KI-Antworten {rival} bei {count} von {total} Käuferfragen, die sie in der Messung von {domain} durch ReachKit beantworteten.",
  "fact.report.method": "Für die Messung von {domain} am {date} hat ReachKit die zehn obersten Google-Ergebnisse und die Antworten von {engines} gelesen; Perplexity wird nicht gemessen.",

  // The hosted blog
  "hosted.published": "veröffentlicht am {date} · von {publisher}",
  "hosted.updated": "veröffentlicht am {date} · aktualisiert am {updated} · von {publisher}",
  "hosted.source": "Quelle: {source} · abgerufen am {date}",
  "hosted.index.heading": "Artikel",
  "hosted.index.searchLabel": "Artikel durchsuchen",
  "hosted.index.searchSubmit": "Suchen",
  "hosted.index.empty": "Hier wurde noch nichts veröffentlicht.",
  "hosted.index.noMatch": "Kein Artikel passt zu „{query}“.",
  "hosted.visit": "{site} besuchen",
  "hosted.toc": "Auf dieser Seite",
  "hosted.readingTime": "{minutes} Min. Lesezeit",
  "hosted.about": "Über {publisher}",
  "hosted.about.author": "Geschrieben von {author}",
  "hosted.action.book": "Termin vereinbaren",
  "hosted.action.quote": "Angebot anfragen",
  "hosted.made": "Mit KI geschrieben, aus {facts} Fakten von {site}, und vor der Veröffentlichung anhand von {rules} Regeln geprüft.",
  "hosted.made.one": "Mit KI geschrieben, aus einem Fakt von {site}, und vor der Veröffentlichung anhand von {rules} Regeln geprüft.",
  "hosted.made.sources": "Die Quellen stehen unten.",
  "hosted.breadcrumb": "Navigationspfad",
  "hosted.index.description": "Artikel und Ratgeber von {publisher}.",
  "hosted.index.latest": "Neu",
  "hosted.index.pages": "Seiten mit Artikeln",
  "hosted.index.newer": "Neuere",
  "hosted.index.older": "Ältere",
  "hosted.index.pageOf": "Seite {page} von {pages}",
} as const satisfies CopyTranslation;
