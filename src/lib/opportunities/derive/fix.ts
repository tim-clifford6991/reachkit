// BUILD §7 — the Fix family: an instruction, never a page.
//
// §7: "`unblock` — Any access gate fails — **instruction only, never
// generated, never automated**." That promise is a shape here, not a
// policy anyone has to enforce: an `unblock` is created with a null
// `targetQuery`, a null `fitBand` and a null `volume`, so it cannot be
// ranked (`rankOpen` excludes the Fix family), cannot fill a day
// (`nextForDay` reads the ranked head), cannot be counted as supply
// (`supplyDepth` excludes it), and carries no target search a generation
// pipeline could write against. A customer holding four outstanding
// instructions and no pages has zero days of pages, and is told so.
//
// Three of the five barriers are measured today:
//
//   robots_disallow    the robots policy disallows every reader.
//   blocked_ai_agent   the policy names an AI reader and disallows it —
//                      the same list the report's `blockedAgents` is
//                      derived from, read once and not recounted here.
//   noindex            the home document tells every reader not to index
//                      it.
//
// `login_wall` and `js_only` are members of the closed union and storable,
// and nothing produces them: the parser reads a fetched document and
// reports neither an auth redirect nor a body whose content arrives only
// after script execution (there is no headless browser — §6). A sixth
// barrier is a change to what the product measures, not a string a caller
// may pass.
import { EFFORT_BY_TYPE } from "@/lib/config/constants";
import type { StoredReport } from "@/lib/scan/report";
import { FAMILY_OF, noRejections, type Barrier } from "../types";
import { type Candidate, type DerivationResult } from "./candidate";

interface FixInput {
  siteId: string;
  scanId: string;
  report: StoredReport;
}

function unblockCandidate(a: FixInput, barrier: Barrier, foundOnUrl: string): Candidate {
  return {
    siteId: a.siteId,
    scanId: a.scanId,
    type: "unblock",
    family: FAMILY_OF.unblock,
    targetQuery: null,
    targetRef: foundOnUrl,
    title: null,
    volume: null,
    evidence: { family: "fix", barrier, foundOnUrl },
    acceptance: { form: "gate_cleared", gate: barrier },
    fitBand: null,
    // Written so the column's `not null` holds and the row is well-formed.
    // Nothing reads it: `rankScore` returns 0 for an `unblock` before it
    // ever reaches an effort term, and the Fix family is excluded from the
    // ranked set upstream of that.
    effort: EFFORT_BY_TYPE.answerable_page,
  };
}

export function fixCandidates(a: FixInput): DerivationResult {
  const { report } = a;
  const result: DerivationResult = { candidates: [], assessed: 0, rejected: noRejections() };

  const origin = report.robots.kind === "unmeasured" ? null : report.robots.value.origin;
  const pageUrl = report.onPage.kind === "unmeasured" ? null : report.onPage.value.url;

  if (report.robots.kind !== "unmeasured" && origin !== null) {
    const policy = report.robots.value;
    result.assessed += 1;
    if (policy.disallowsAll) {
      result.candidates.push(unblockCandidate(a, "robots_disallow", origin));
    } else if (report.blockedAgents.length > 0) {
      result.candidates.push(unblockCandidate(a, "blocked_ai_agent", origin));
    }
  }

  if (report.onPage.kind !== "unmeasured" && pageUrl !== null) {
    const facts = report.onPage.value;
    result.assessed += 1;
    if (facts.noindex && facts.noindexAppliesToEveryReader) {
      result.candidates.push(unblockCandidate(a, "noindex", pageUrl));
    }
  }

  return result;
}
