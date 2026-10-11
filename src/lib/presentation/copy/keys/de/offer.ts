// src/lib/presentation/copy/keys/de/offer.ts — the `offer` partition in German
// (SPEC §6, owner D66 of 2026-10-07, issue 1311): what a German site's
// founder and its report's reader are shown. Drafted (issue 759); the pull
// request lists every sentence for the owner to correct.
//
// One entry per key of `../offer.ts`, with the same `{slots}`. A key left out
// is shown in English.
import type { CopyTranslation } from "../../translated.ts";

export const OFFER_COPY_DE = {
  // Preis
  "price.vat_included": "inkl. MwSt.",
  "price.interval": "pro Monat, inkl. MwSt.",

  // Das Angebot auf dem Bericht
  "offer.cadence.page": "Für Ihre Website {value} eine Seite, neu oder aktualisiert",
  "offer.cadence.measure": "Ihre Auffindbarkeit wird {value} neu gemessen",
  "offer.cadence.movement": "Was sich bewegt hat, {value} in Ihrem Postfach",
  "offer.veto.window": "Jede Seite geht nach {value} von selbst online. Bis dahin können Sie sie bearbeiten oder stoppen – und jederzeit selbst kündigen",
  "offer.cancel_self_service": "Mit einem Klick kündigen, selbst.",
  "offer.close.heading": "Schließen Sie die Lücke – jeden Tag eine Seite.",
  "offer.start": "ReachKit starten",
  "offer.start.priced": "ReachKit starten €49",

  // Das Angebot auf der Preisseite
  "offer.pricing.page": "Jeden Tag eine Seite, neu oder aktualisiert, für Sie veröffentlicht",
  "offer.pricing.measure": "Wöchentliche Neumessung Ihres gesamten Marktes",
  "offer.pricing.movement": "Wöchentliche E-Mail dazu, was sich bewegt hat",
  "offer.pricing.veto": "{hours} Stunden, um jede Seite zu stoppen, bevor sie online geht",
  "plan.single": "Jeden Tag eine Seite",
  "offer.checkout.refused": "Der Bezahlvorgang konnte nicht gestartet werden. Versuchen Sie es gleich noch einmal.",

  // Die Werte der vier Zeilen oben
  "offer.cadence.page.value": "jeden Tag",
  "offer.cadence.measure.value": "jede Woche",
  "offer.cadence.movement.value": "jeden Montag",
  "offer.veto.window.value": "{hours} Stunden",
} as const satisfies CopyTranslation;
