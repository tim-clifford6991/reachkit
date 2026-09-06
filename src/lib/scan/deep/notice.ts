// BUILD §4.3 — the release notice: one sentence projected from the current
// report, never a stored flag.
//
// "A degraded pass still releases setup (zero proposals is legal, never
// faked)." (§4.3) A founder released off the back of a pass that degraded,
// or that never ended, arrives in the app owed one written sentence saying
// so — on whatever screen they land on, not only at the instant of
// release.
//
// **It is a projection, and that is the whole design.** Nothing here reads
// or writes a flag. The sentence is derived from the domain's *current*
// report every time it is asked for, so when a later pass moves the
// current-report pointer to a complete one, the sentence stops being
// returned — with nothing cleared, nothing expired and no second write to
// forget. A stored "show the degraded notice" boolean is exactly the thing
// that outlives the fact it describes.
//
// It states what could not be measured. It invents nothing: a complete
// report that found zero opportunities yields `null`, because "we found
// nothing for you" is §7's own line and not a measurement failure.
import type { CopyKey } from "@/lib/presentation/copy";
import { readCurrentReport } from "../report";
import type { StoredReport } from "../report";

export interface ReleaseNotice {
  key: CopyKey;
  vars: Record<string, string>;
  /** Which named parts of the pass went unmeasured, as internal handles.
   *  Carried as **data, not as a slot value**: turning a list of handles
   *  into a phrase is composition — a separator, an order and a
   *  conjunction — and composing a sentence is the one thing this file
   *  must not do. The owner's sentence stands on its own today; when they
   *  want the parts named inside it, the slot and its per-part keys are
   *  added then, filled from exactly this list. */
  parts: readonly string[];
}

/** The parts of the pass a founder is told about by name, in the order
 *  they run. Only the sections a degraded pass can actually leave
 *  unmeasured are listed — a section that always has a value cannot be
 *  named as missing.
 *
 *  `kind === "unmeasured"` and never `!== "measured"`: a `zero` section is
 *  a measurement whose answer was nothing (§6.6's cold start), and calling
 *  a cold start a failure is exactly the confusion `Measured<T>`'s three
 *  arms exist to prevent. */
const NAMED_PARTS: readonly { readonly part: string; readonly missing: (r: StoredReport) => boolean }[] =
  Object.freeze([
    { part: "market", missing: (r) => r.market.kind === "unmeasured" },
    { part: "questions", missing: (r) => r.questions.kind === "unmeasured" },
    { part: "answers", missing: (r) => r.aiAnswers === null },
    { part: "presence", missing: (r) => r.presence === null },
    { part: "rivals", missing: (r) => r.rivals.kind === "unmeasured" },
  ]);

/** Which named parts this report did not measure, as internal handles —
 *  never words a founder reads. The sentence that names them is the
 *  owner's, and it receives them through a slot. */
export function unmeasuredParts(report: StoredReport): readonly string[] {
  return NAMED_PARTS.filter((p) => p.missing(report)).map((p) => p.part);
}

/**
 * The one sentence that travels with the founder into the app, or `null`
 * when there is nothing to say.
 *
 * Three arms:
 *   - no current report at all → the measurement did not complete
 *   - a report that stopped short of complete → what could not be
 *     measured, with the unmeasured parts carried alongside
 *   - a complete report → `null`, however empty its findings are
 */
export async function releaseNotice(a: { domain: string }): Promise<ReleaseNotice | null> {
  const report = await readCurrentReport(a.domain);

  if (report === null || report.stoppedReason === "failed") {
    return { key: "setup.release.incomplete", vars: {}, parts: [] };
  }

  if (report.complete && report.stoppedReason === "complete") return null;

  return {
    key: "setup.release.unmeasured",
    vars: {},
    parts: unmeasuredParts(report),
  };
}
