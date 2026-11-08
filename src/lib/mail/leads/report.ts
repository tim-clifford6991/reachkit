// SPEC §8: the free-scan sequence's `report` mail, sent at capture because the report is stored and costs nothing to send.
import { env } from "@/lib/config/env";
import { shownLimitingOf } from "@/lib/measure/verdict";
import { copy } from "@/lib/presentation/copy";
import { SCORE_BANDS } from "@/lib/presentation/bands";
import { readStoredReport, type StoredReport } from "@/lib/scan/report";
import { sendEmail } from "../send";
import { buildReport, type ReportFacts } from "../templates/report";
import { leadStore } from "./store";

/** The report head's figures, written as the cards write them; a figure the report lacks is "not measured", never 0. */
export function reportFacts(report: StoredReport): ReportFacts {
  const reading = report.verdict.scoreAndBand;
  const notMeasured = copy("mail.report.notMeasured");
  const ai = report.aiAnswers;
  const google = report.presence;
  return {
    domain: report.domain,
    score: reading.kind === "unmeasured" ? notMeasured : String(reading.value.score),
    band: reading.kind === "unmeasured" ? null : copy(SCORE_BANDS[reading.value.band]),
    aiAnswers:
      ai === null || ai.answeredSearches === 0
        ? notMeasured
        : copy("report.figure.of", { count: String(ai.customerCitations), total: String(ai.answeredSearches) }),
    googleSearch:
      google === null || google.measuredSearches === 0
        ? notMeasured
        : copy("report.figure.of", { count: String(google.you.top10Count), total: String(google.measuredSearches) }),
    limiting: reading.kind === "unmeasured" ? null : shownLimitingOf(report.verdict),
  };
}

/** Never throws; `false` where there is no stored report or the send did not go. `period` is the scan, so a double submit shares one vendor key. */
export async function mailReport(a: { scanId: string; email: string; period: string }): Promise<boolean> {
  const read = await leadStore().scanReport(a.scanId);
  if (!read.ok || read.report === null) return false;
  let report: StoredReport;
  try {
    report = readStoredReport(read.report);
  } catch {
    return false;
  }

  const mail = buildReport({
    facts: reportFacts(report),
    href: new URL(`/scan/${encodeURIComponent(report.domain)}`, env.NEXT_PUBLIC_APP_URL).toString(),
    removalAddress: copy("removal.address"),
    issues: report.siteIssues,
  });
  const result = await sendEmail({
    kind: "report",
    to: a.email,
    subject: mail.subject,
    subjectVars: mail.subjectVars,
    preheader: mail.preheader,
    blocks: mail.blocks,
    reason: mail.reason,
    reasonVars: mail.reasonVars,
    period: a.period,
  });
  return result.sent;
}
