// src/lib/presentation/copy/keys/de/laws.ts — the `laws` partition in German
// (SPEC §6, owner D66 of 2026-10-07, issue 1311): what a German site's
// founder and its report's reader are shown. Drafted (issue 759); the pull
// request lists every sentence for the owner to correct.
//
// One entry per key of `../laws.ts`, with the same `{slots}`. A key left out
// is shown in English.
import type { CopyTranslation } from "../../translated.ts";

export const LAWS_COPY_DE = {
  // Angehaltene Arbeit
  "stopped.work.line": "ReachKit hat heute die eigene Arbeit angehalten, deshalb wurde keine Seite geschrieben. An Ihrem Markt hat sich nichts geändert.",
  "stopped.work.needs-nothing": "Sie müssen nichts tun – ReachKit macht von selbst weiter.",
  "stopped.work.resumes-on": "ReachKit macht voraussichtlich am {date} weiter.",
  "stopped.work.no-time-promised": "Wann die Arbeit weitergeht, wird nicht zugesagt.",
  "stopped.work.partial-pass": "Diese Seite wurde nach einem vorzeitig beendeten Durchlauf geschrieben – ein Teil der Messung dahinter wurde nicht durchgeführt.",

  // Nächste Veröffentlichung
  "next-publish.stopped": "ReachKit hat die eigene Arbeit angehalten, deshalb ist keine Seite eingeplant.",
  "next-publish.scheduled": "Nächste Seite geht online: {at}",
  "next-publish.paused": "Das Veröffentlichen ist ausgeschaltet.",
  "next-publish.nothing-approved": "Noch keine Seite bereit.",
  "next-publish.none-planned": "Noch keine Seite geplant.",

  // Von ReachKit geschriebener Text
  "generated.page.written": "von ReachKit erstellt · gekennzeichnet",
  "generated.page.proposed": "von ReachKit vorgeschlagen · noch nicht geschrieben · {pageTitle}",

  // Nicht gemessen
  "unmeasured.undeterminable": "{what}: konnte nicht gemessen werden – es kam nichts zurück, was sich lesen ließ.",
  "unmeasured.not-attempted": "{what}: nicht gemessen – der Scan endete vorzeitig, bevor er so weit war.",

  // Rahmen der App
  "shell.workspace": "Arbeitsbereich",
  "shell.nav.overview": "Übersicht",
  "shell.nav.plan": "Plan",
  "shell.nav.settings": "Einstellungen",
  "shell.panel.label": "Seitenleiste",
  "shell.panel.collapse": "Seitenleiste einklappen",
  "shell.panel.open": "Seitenleiste öffnen",
  "shell.frame.label": "Arbeitsbereich",
  "shell.waiting.head": "Bereit zum Lesen",
  "shell.waiting.goes-live": "Geht von selbst online: {when}. Bis dahin können Sie sie bearbeiten oder stoppen.",
  "shell.shortcut.blog": "Ihren Blog besuchen",
  "shell.shortcut.help": "Hilfe",
  "shell.publishing.mode.autopilot": "Autopilot",
  "shell.publishing.state.autopilot": "Veröffentlicht täglich",
  "shell.publishing.state.week-zero": "Erste Seite nach der ausführlichen Messung",
  "shell.onboarding.first-page": "Ihre erste Seite wird gerade geschrieben.",
  "shell.pass-step.done": "erledigt",
  "shell.pass-step.now": "jetzt",
  "shell.pass-step.next": "als Nächstes",

  // Stand einer Messung
  "shell.pass.remeasure-head": "Ihr Markt wird neu gemessen",
  "shell.pass.since": "Dieser Schritt hat um {time} begonnen.",
  "shell.pass.ended.done": "Messung um {time} abgeschlossen. Ihre Ansichten zeigen, was sie ergeben hat.",
  "shell.pass.ended.failed": "Messung um {time} fehlgeschlagen: Auf unserer Seite ist etwas schiefgegangen. Sie müssen nichts tun, die nächste Messung holt es nach.",
  "shell.pass.ended.site-unreadable": "Messung um {time} fehlgeschlagen: Wir konnten Ihre Website nicht lesen. Prüfen Sie, ob sie erreichbar ist, und starten Sie die Messung dann in den Einstellungen erneut.",
  "shell.pass.ended.time-ceiling": "Messung um {time} angehalten, weil die Zeit nicht gereicht hat. Was bis dahin gemessen wurde, wird angezeigt, und die nächste Messung ergänzt den Rest.",
  "shell.pass.ended.spend-ceiling": "Messung um {time} angehalten, weil sie ihre Ausgabengrenze erreicht hat. Was bis dahin gemessen wurde, wird angezeigt, und die nächste Messung ergänzt den Rest.",
  "shell.domain.measured-weeks": "Woche {weeks} · neu gemessen am {on}",
  "shell.domain.not-measured": "noch nicht gemessen · erstmals fällig am {due}",
} as const satisfies CopyTranslation;
