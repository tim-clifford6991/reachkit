// src/lib/presentation/copy/keys/de/mail.ts — the `mail` partition in German
// (SPEC §6, owner D66 of 2026-10-07, issue 1311): what a German site's
// founder and its report's reader are shown. Drafted (issue 759); the pull
// request lists every sentence for the owner to correct.
//
// One entry per key of `../mail.ts`, with the same `{slots}`. A key left out
// is shown in English.
import type { CopyTranslation } from "../../translated.ts";

export const MAIL_COPY_DE = {
  // Abmeldeseite
  "optout.confirmed": "An {address} gehen keine Folge-E-Mails mehr – weder für diese Domain noch für eine andere. Die Seite, die Sie angefordert haben, gehört weiterhin Ihnen.",
  "optout.invalid": "Dieser Abmeldelink ist nicht mehr gültig. Antworten Sie auf eine beliebige E-Mail von ReachKit mit „stop“, dann beenden wir den Versand von Hand.",
  "optout.head": "Abgemeldet",
  "optout.head.unresolved": "Nicht abgemeldet",

  // Rahmen jeder E-Mail
  "mail.nothing_to_report": "Diese Woche gibt es nichts zu berichten.",
  "mail.week_unmeasured": "Diese Woche konnte nicht gemessen werden. Die nächste Messung ist fällig: {nextDue}.",
  "mail.week_partly_measured": "Ein Teil dieser Woche konnte nicht gemessen werden: {sections}. Diese Abschnitte werden weggelassen und nicht als null angezeigt.",
  "mail.section.on_page": "Ihre Seiten",
  "mail.section.market": "Ihr Markt",
  "mail.section.rankings": "Google-Suche",
  "mail.section.ai_answers": "KI-Antworten",
  "mail.section.rivals": "Mitbewerber",
  "mail.section.score": "Auffindbarkeits-Score",
  "mail.unsubscribe.label": "Diese E-Mail abschalten",
  "mail.optout.label": "Alle Folge-E-Mails abbestellen",

  // Die erste Seite
  "mail.firstPage.subject": "Ihre erste Seite: {title}",
  "mail.firstPage.target_search": "Zielsuchanfrage",
  "mail.firstPage.volume_label": "gesucht",
  "mail.firstPage.first_of_n": "Die vollständige Seite, fertig zum Kopieren, in Markdown und HTML. Das ist Seite 1 von {pagesFound}, die wir für Sie gefunden haben.",
  "mail.firstPageUnavailable.subject": "Diesmal keine Seite",
  "mail.firstPageUnavailable.no-page-to-write": "Die Seite, die Sie angefordert haben, kommt nicht: Der Bericht für diese Domain sieht keine Seite mehr vor, die geschrieben werden könnte, und es wird keine erfunden, um die Lücke zu füllen.",
  "mail.firstPageUnavailable.writing-failed": "Die Seite, die Sie angefordert haben, kommt nicht: ReachKit konnte sie nicht schreiben. An ihrer Stelle wurde nichts verschickt.",
  "mail.firstPageUnavailable.writing-refused": "Die Seite, die Sie angefordert haben, kommt nicht: Der geschriebene Text hat die eigenen Prüfungen von ReachKit nicht bestanden und wurde deshalb nicht verschickt.",
  "mail.firstPageUnavailable.delivery-failed": "Die Seite, die Sie angefordert haben, kommt nicht: Sie konnte nicht an die Adresse zugestellt werden, die Sie angegeben haben.",

  // Die drei Folge-E-Mails
  "mail.nurture.subject.1": "Die übrigen Seiten, die wir gefunden haben",
  "mail.nurture.subject.2": "Was sich ändert, sobald die Seiten online sind",
  "mail.nurture.subject.3": "Ein letzter Hinweis zu Ihrem Bericht",
  "mail.nurture.body.1": "Sie haben Seite 1 für {domain}. ReachKit schreibt die übrigen – eine Seite pro Tag, für Sie veröffentlicht, und jede Seite wartet 24 Stunden, damit Sie sie stoppen können, bevor sie online geht. €49 im Monat, jederzeit kündbar.",
  "mail.nurture.body.2": "Jede Seite, die ReachKit für {domain} schreibt, zielt auf eine Suchanfrage, die Ihre Mitbewerber bereits beantworten. Jeden Montag misst ReachKit Ihren gesamten Markt neu und sagt Ihnen, was sich bewegt hat – nur was gemessen wurde, nie eine Schätzung.",
  "mail.nurture.body.3": "Das ist die letzte Folge-E-Mail zu {domain}. Ihr Bericht und Ihre erste Seite gehören weiterhin Ihnen. Wenn Sie die übrigen Seiten geschrieben und veröffentlicht haben möchten: ReachKit kostet €49 im Monat und ist jederzeit kündbar.",

  // Erinnerung an die Einrichtung
  "mail.setupReminder.subject": "Schließen Sie Ihre Einrichtung ab",
  "mail.setupReminder.body": "Die Einrichtung wartet auf Sie: drei Fragen, dann wird Ihre erste Seite geschrieben.",
  "mail.setupReminder.action": "Einrichtung abschließen",

  // Antworten des Formulars auf dem Bericht
  "lead.accepted": "Verstanden. Ihre Seite wird geschrieben und geht an diese Adresse, sobald sie fertig ist.",
  "lead.invalid_address": "Das sieht nicht nach einer E-Mail-Adresse aus. Versuchen Sie es in der Form name@firma.de.",
  "lead.unavailable": "Ihre Adresse konnte gerade nicht gespeichert werden, deshalb wurde nichts verschickt. Versuchen Sie es in ein paar Minuten noch einmal.",
  "optout.unavailable": "Die Abmeldung konnte gerade nicht übernommen werden, deshalb hat sich nichts geändert. Rufen Sie den Link in ein paar Minuten noch einmal auf, oder antworten Sie auf eine beliebige E-Mail von ReachKit mit „stop“, dann beenden wir den Versand von Hand.",

  // Anmeldung und Konto
  "mail.magicLink.subject": "Ihr Anmeldelink",
  "mail.magicLink.body": "Ein Klick meldet Sie auf diesem Gerät an. Der Link funktioniert einmal und läuft nach 24 Stunden ab.",
  "mail.magicLink.action": "Anmelden",
  "mail.account.chase.subject": "Zahlung eingegangen",
  "mail.account.chase.link_ready": "Ihre Zahlung ist eingegangen und Ihr Konto ist eröffnet. Bisher hat sich niemand angemeldet – hier ist Ihr Zugang.",
  "mail.account.chase.not_open_yet": "Ihre Zahlung ist eingegangen. Ihr Konto ist noch nicht eröffnet; wir richten es gerade ein, und ein Anmeldelink folgt, sobald es so weit ist. Es wird nichts weiter abgebucht.",
  "mail.account.second_purchase.subject": "Eine zweite Zahlung",
  "mail.account.no_second_subscription": "Von dieser Adresse ist eine zweite Zahlung eingegangen, sie hat aber kein zweites Abonnement gekauft. Sie haben weiterhin ein Konto, eine Website und ein laufendes Abonnement; sonst wurde nichts angelegt.",
  "mail.account.reach_a_person": "Um einen Menschen zu erreichen, antworten Sie auf diese E-Mail.",
  "mail.account.address_moved.subject": "Anmeldung geändert",
  "mail.account.address_moved": "Ihr ReachKit-Konto meldet sich jetzt mit einer anderen E-Mail-Adresse an. Mit dieser Adresse ist keine Anmeldung mehr möglich, und alle E-Mails von ReachKit gehen jetzt an die neue Adresse.",

  // Die Montags-E-Mail
  "mail.weekly.subject": "Montag: Was sich diese Woche bewegt hat",
  "mail.weekly.score": "Auffindbarkeits-Score",
  "mail.weekly.aiAnswers": "KI-Antworten",
  "mail.weekly.mentionRate": "KI-Erwähnungsrate: {rate}% (wahrscheinlich {low}–{high}%). In den letzten {weeks} Wochen hat die KI Sie in {mentioned} von {answers} Antworten auf Ihre Käuferfragen genannt.",
  "mail.weekly.mentionCount": "Bisher hat die KI Sie in {mentioned} von {answers} Antworten auf Ihre Käuferfragen genannt. Eine Erwähnungsrate erscheint nach {weeks} Wochen mit diesen Fragen.",
  "mail.weekly.pagesCited": "Ihre Seiten, die in diesen Antworten zitiert wurden: {pages}.",
  "mail.weekly.moved.up": "Die Lücke schließt sich. Bisher ging es jede Woche aufwärts. Das hat sich bewegt.",
  "mail.weekly.moved.flat": "Ihr Score ist diese Woche gleich geblieben. Hier ist alles, was gemessen wurde.",
  "mail.weekly.moved.down": "Ihr Score ist diese Woche gesunken. Hier sehen Sie, was sich bewegt hat und was als Nächstes geschrieben wird.",
  "mail.weekly.searches": "Suchanfragen, bei denen Sie erscheinen",
  "mail.weekly.pagesLive": "Seiten online",
  "mail.weekly.needsYou": "Eine Seite braucht Sie: {page}.",
  "mail.weekly.needsYou.action": "Seite öffnen",
  "mail.weekly.nowNamed": "beobachtete Fragen, bei denen Sie jetzt genannt werden",
  "mail.weekly.verdicts": "bewertete Seiten",
  "mail.weekly.verdicts.none": "Noch keine Seiten veröffentlicht, also gibt es noch nichts zu bewerten.",
  "mail.weekly.next": "die nächsten drei",
  "mail.weekly.next.none": "Nichts als Nächstes: Es ist keine offene Gelegenheit mehr übrig, und der Plan wird nie künstlich aufgefüllt.",
  "mail.weekly.page.moved": "{page} · vorher {from}, jetzt {to} · gemessen {measuredAt}",
  "mail.weekly.page.moved_over": "{page} · vorher {from}, jetzt {to} über {weeks} Wochen · gemessen {measuredAt}",

  // Ende des Hostings
  "mail.account.hosting_end.access_ended.subject": "Ihr Zugang ist beendet",
  "mail.account.hosting_end.seven_days.subject": "Das Hosting endet bald",
  "mail.account.hosting_end.stops_on": "ReachKit liefert Ihre gehosteten Seiten ab dem {date} nicht mehr aus. Bis zu diesem Tag bleiben sie unverändert online.",
  "mail.account.hosting_end.export_stays": "Der Export Ihrer Inhalte bleibt danach verfügbar, ohne Enddatum.",

  // Entwurf fertig
  "mail.draftReady.autopilotWindow": "Veröffentlichung: {publishesAt}, sofern Sie nicht Nein sagen.",
  "mail.draftReady.autopilotZero": "Veröffentlichung: {publishesAt}. Es gibt keine Frist, in der Sie die Seite stoppen können.",
  "mail.draftReady.copilot": "Sie wird erst veröffentlicht, wenn Sie sie freigeben.",
  "mail.draftReady.dest.goesLiveThen": "Sie geht in diesem Moment auf {site} online und ist für alle lesbar. Sie wartet dort nicht als Entwurf.",
  "mail.draftReady.dest.goesLiveAtOnce": "Sie geht auf {site} online, sobald sie veröffentlicht wird, und ist für alle lesbar. Sie wartet dort nicht als Entwurf.",
  "mail.draftReady.dest.goesLiveOnApproval": "Sie geht erst auf {site} online, wenn Sie sie freigeben, und ist von da an für alle lesbar. Vorher gelangt nichts auf die Website.",
  "mail.draftReady.dest.cannotPublish": "So wie es jetzt eingerichtet ist, kann ReachKit nicht auf {site} veröffentlichen. Öffnen Sie Einstellungen › Veröffentlichen: Beim Veröffentlichungsziel steht dort, was zu ändern ist, bevor diese Seite online gehen kann.",
  "mail.draftReady.why.search": "Geschrieben für die Suchanfrage „{query}“.",
  "mail.draftReady.why.volume": "gesucht",
  "mail.draftReady.ready": "Ihre Seite ist bereit zum Lesen",
  "mail.draftReady.readAction": "Ganze Seite lesen",
  "mail.draftReady.stopNote": "„Diese Seite stoppen“ funktioniert direkt aus dieser E-Mail, ohne Anmeldung, bis die Seite online geht.",
  "mail.draftReady.fact.chances": "Ihre Chancen",
  "mail.draftReady.fact.writtenFrom": "geschrieben auf Grundlage von",
  "mail.draftReady.fact.others": "andere Websites",
  "mail.draftReady.fact.nobody": "niemand",
  "mail.draftReady.stopAction": "Diese Seite stoppen",

  // Seite veröffentlicht
  "mail.published.subject": "Ihre Seite, nach 24 Stunden geprüft",
  "mail.published.verified": "Unter ihrer Adresse online, Stand {checkedAt}.",
  "mail.published.not_found": "Keine Seite unter dieser Adresse, {checkedAt}.",
  "mail.published.not_confirmed": "Konnte nicht bestätigt werden, {checkedAt}.",
  "mail.published.address_label": "Adresse",
  "mail.published.verified_label": "bestätigt",
  "mail.published.checks_label": "24-Stunden-Prüfungen",
  "mail.published.checks_empty": "Es wurden keine Prüfergebnisse aufgezeichnet.",
  "mail.published.check.reachable": "erreichbar",
  "mail.published.check.indexable": "indexierbar",
  "mail.published.check.sitemap": "in der Sitemap",
  "mail.published.check.ai_readable": "für KI lesbar",
  "mail.published.check_passed": "bestanden",
  "mail.published.check_failed": "nicht bestanden",
  "mail.published.check_not_measured": "nicht bestätigt",
  "mail.published.site_condition.publishes_no_sitemap": "Ihre Website veröffentlicht keine Sitemap, Stand {foundAt}. Das betrifft die Website, nicht diese Seite, und es liegt bei Ihnen, das zu beheben.",
  "mail.published.site_condition.robots_blocks_site": "Die robots-Regeln Ihrer Website sperren KI-Crawler für die gesamte Website, Stand {foundAt}. Das betrifft die Website, nicht diese Seite, und es liegt bei Ihnen, das zu ändern.",

  // Konto gelöscht
  "mail.account.deleted.subject": "Konto gelöscht",
  "mail.account.deleted.still_live": "Seiten, die noch an einem Veröffentlichungsziel online sind, das ReachKit nicht erreichen konnte: {count}. Sie dort zu entfernen, liegt jetzt bei Ihnen – ReachKit kann das nicht mehr.",
  "mail.account.deleted.theirs_to_keep": "Jeder Beitrag, der noch auf Ihrer Website liegt, gehört Ihnen: Sie können ihn behalten oder entfernen.",
  "mail.account.deleted.wordpress.returned_to_draft": "Beiträge, die ReachKit in Ihrem WordPress veröffentlicht und jetzt wieder auf Entwurf gesetzt hat: {count}. Sonst wurde an ihnen nichts geändert. Sie finden sie gesammelt unter {place}.",
  "mail.account.deleted.wordpress.returned_to_draft.no_place": "Beiträge, die ReachKit in Ihrem WordPress veröffentlicht und jetzt wieder auf Entwurf gesetzt hat: {count}. Sonst wurde an ihnen nichts geändert. Sie liegen auf Ihrer Website; ReachKit kann dort nicht auf sie verweisen.",
  "mail.account.deleted.wordpress.named_for_removal": "Beiträge, die ReachKit in Ihrem WordPress angelegt und nie veröffentlicht hat: {count}. Niemand hat sie veröffentlicht, sie waren nie öffentlich, und es wurde nichts in sie geschrieben. Sie finden sie gesammelt unter {place}.",
  "mail.account.deleted.wordpress.named_for_removal.no_place": "Beiträge, die ReachKit in Ihrem WordPress angelegt und nie veröffentlicht hat: {count}. Niemand hat sie veröffentlicht, sie waren nie öffentlich, und es wurde nichts in sie geschrieben. Sie liegen auf Ihrer Website; ReachKit kann dort nicht auf sie verweisen.",
  "mail.account.deleted.wordpress.already_gone": "Beiträge, die nicht mehr auf Ihrer Website waren, als ReachKit sie zurücksetzen wollte: {count}. Es gab dort nichts zu ändern.",
  "mail.account.deleted.wordpress.unreachable": "Beiträge auf einer Website, die ReachKit nicht erreichen konnte: {count}. Sie sind dort möglicherweise noch online, und es wurde nichts in sie geschrieben. Sie finden sie gesammelt unter {place}.",
  "mail.account.deleted.wordpress.unreachable.no_place": "Beiträge auf einer Website, die ReachKit nicht erreichen konnte: {count}. Sie sind dort möglicherweise noch online, und es wurde nichts in sie geschrieben. ReachKit kann auf dieser Website nicht auf sie verweisen.",

  // Veröffentlichungsziel muss neu verbunden werden
  "mail.account.destinationBroken.subject": "Neu verbinden erforderlich",
  "mail.account.destinationBroken.body": "Ein Veröffentlichungsziel muss neu verbunden werden. Seiten werden zurückgehalten; sobald Sie neu verbinden, werden sie freigegeben.",
  "mail.account.destinationBroken.held": "zurückgehaltene Seiten",
  "mail.account.destinationBroken.action": "Neu verbinden",

  // Fußzeile: warum diese E-Mail ankam
  "mail.shell.plaintext_note": "Nur-Text-Fassung liegt bei",
  "mail.reason.magicLink": "Sie haben diesen Link auf reachkit.app/signin angefordert. Falls nicht, ignorieren Sie diese E-Mail.",
  "mail.reason.report": "Diese Website gehört Ihnen und Sie möchten, dass der Bericht entfernt wird? Schreiben Sie an {address}.",
  "mail.reason.firstPage": "Einmal verschickt, weil Sie es auf dem Bericht angefordert haben. Folge-E-Mails enthalten einen Abmeldelink.",
  "mail.reason.draftReady": "Tägliche E-Mail zu fertigen Entwürfen · abschalten unter Einstellungen › Benachrichtigungen.",
  "mail.reason.published": "E-Mail zu veröffentlichten Seiten · abschalten unter Einstellungen › Benachrichtigungen.",
  "mail.reason.weekly": "Montags-E-Mail zu den Veränderungen · abschalten unter Einstellungen › Benachrichtigungen.",
  "mail.reason.setupReminder": "Bis zu drei Erinnerungen, solange die Einrichtung nicht abgeschlossen ist · mit dem Abschluss der Einrichtung enden sie.",
  "mail.reason.nurture": "Alle Folge-E-Mails abbestellen: ein Link, jede Domain, endgültig.",

  // Der Bericht
  "mail.report.subject": "{domain} – Auffindbarkeits-Score {score}, {band}",
  "mail.report.heading": "Ihr Bericht ist fertig",
  "mail.report.body": "Das vollständige Ergebnis steht im Bericht, kostenlos und dauerhaft.",
  "mail.report.action": "Bericht öffnen",
  "mail.report.next": "Bei jedem Problem darin steht, wer es behebt, und die vollständige Methode ist dort nachzulesen, kostenlos.",
  "mail.report.fact.score": "Auffindbarkeits-Score",
  "mail.report.fact.aiAnswers": "KI-Antworten",
  "mail.report.fact.googleSearch": "Google-Suche",

  // Überschriften und Faktenzeilen
  "mail.magicLink.heading": "Bei ReachKit anmelden",
  "mail.magicLink.fact.for": "für",
  "mail.firstPage.fact.format": "Format",
  "mail.draftReady.body": "Wird morgen um 07:00 veröffentlicht, sofern Sie nicht Nein sagen.",
  "mail.draftReady.fact.search": "Suchanfrage",
  "mail.draftReady.fact.answeredBy": "wer heute antwortet",
  "mail.draftReady.fact.you": "Sie",
  "mail.published.body": "Nach 24 Stunden unter ihrer Adresse bestätigt.",
  "mail.published.action": "Seite ansehen",
  "mail.weekly.heading": "Was sich diese Woche bewegt hat",
  "mail.weekly.body": "Nur was gemessen wurde. Eine Zahl, die nicht gemessen wurde, steht hier nicht.",
  "mail.weekly.market.changed": "ReachKit misst Sie jetzt in der Kategorie {category}. {reason}",
  "mail.weekly.rival.added": "Neuer Mitbewerber: {rival}. {reason}",
  "mail.weekly.rival.dropped": "Wird nicht mehr als Mitbewerber gemessen: {rival}.",
  "mail.weekly.action": "Übersicht öffnen",
  "mail.nurture.action": "ReachKit starten €49",

  // Kundenbindung
  "mail.inactivity.subject": "Ihre Seiten werden weiterhin veröffentlicht",
  "mail.inactivity.line": "Sie haben sich seit einer Woche nicht angemeldet. ReachKit schreibt und veröffentlicht Ihre Seiten weiterhin, und jede Seite wartet darauf, dass Sie sie stoppen können, bevor sie online geht.",
  "mail.inactivity.action": "Anmelden",
  "mail.reason.inactivity": "Verschickt nach 7 Tagen ohne Anmeldung · mit einer Anmeldung endet das.",
  "mail.vetoReminder.subject": "Eine Seite wird bald veröffentlicht",
  "mail.vetoReminder.line": "„{page}“ wird veröffentlicht, wenn Sie die Seite nicht stoppen. Zeitpunkt: {closesAt}.",
  "mail.vetoReminder.action": "Diese Seite stoppen",
  "mail.reason.vetoReminder": "Verschickt, wenn weniger als 6 Stunden bleiben, um eine Seite zu stoppen.",
  "mail.paymentFailed.subject": "Ihre Zahlung ist fehlgeschlagen",
  "mail.paymentFailed.line": "Ihre letzte Zahlung über €49 für ReachKit ist fehlgeschlagen. Aktualisieren Sie Ihre Zahlungsdaten, um sie zu begleichen.",
  "mail.paymentFailed.action": "Zahlungsdaten aktualisieren",
  "mail.cancellation.subject": "Ihr Abonnement ist gekündigt",
  "mail.cancellation.line": "Sie behalten den vollen Zugang bis {accessEndsOn}, und es wird nichts weiter abgebucht.",
  "mail.winback.subject": "Machen Sie dort weiter, wo Sie aufgehört haben",
  "mail.winback.line": "ReachKit kann wieder Seiten für Ihre Website schreiben und veröffentlichen: eine pro Tag, und jede wartet darauf, dass Sie sie stoppen können, bevor sie online geht. €49 im Monat, jederzeit kündbar.",
  "mail.winback.action": "ReachKit fortsetzen",
  "mail.reason.winback": "Einmal verschickt, 30 Tage nach Ihrer Kündigung. Danach folgt keine weitere E-Mail.",
} as const satisfies CopyTranslation;
