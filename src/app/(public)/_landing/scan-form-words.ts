// BUILD §3, REQ-001 c1 — the landing field's own sentences, resolved on the
// server (#988).
//
// `ScanForm` is a Client Component, because a field that answers without a
// page load has to be. What it is not is a reader of the copy registry: a
// `copy()` call in a client module puts `COPY` — every sentence in the
// product, merged — into the bundle a stranger downloads before reading the
// landing page. That was 39 kB of the 130 kB `/` was over its script budget
// by (#988).
//
// So the keys live here, in a module only Server Components import, and the
// form is handed eight already-written strings. It is the convention
// `GrowthLine` states for a chart's label and `FieldCta` has always taken
// for its own: "already a written string when it arrives".
//
// **The five refusal lines stay one per `DomainProblem`.** This file is
// still the single place that says which sentence a problem is told with —
// the `satisfies` keeps a sixth handle from arriving unwritten, exactly as
// it did when the map lived in `ScanForm.tsx`.
import { copy } from "@/lib/presentation/copy";
import type { DomainProblem } from "@/lib/scan/domain";

/** The five `DomainProblem` handles (`src/lib/scan/domain.ts`, WO-051) and
 *  the one landing-copy key each names: "one written line per
 *  DomainProblem". No sixth or fourth value exists; a value outside this
 *  list is treated as no problem at all. */
const PROBLEM_COPY_KEY = {
  empty: "landing.problem.empty",
  not_a_hostname: "landing.problem.not-a-hostname",
  ip_literal: "landing.problem.ip-literal",
  no_public_suffix: "landing.problem.no-public-suffix",
  too_long: "landing.problem.too-long",
} as const satisfies Record<DomainProblem, string>;

/** Everything `ScanForm` says, written. One object rather than eight props,
 *  so a caller cannot pass seven of them. */
export interface ScanFormWords {
  readonly fieldLabel: string;
  readonly placeholder: string;
  readonly submit: string;
  readonly problem: Readonly<Record<DomainProblem, string>>;
}

/** Server-side only: it reads the registry, which is the whole point.
 *
 *  `submit` is the one word a caller may replace. S8 draws the same field
 *  and the same action under a different word ("Scan it"), and a second
 *  copy of this form would be a second place the no-JavaScript path, the
 *  five refusal lines and the one named field live. */
export function scanFormWords(submitLabel?: string): ScanFormWords {
  const problem = {} as Record<DomainProblem, string>;
  for (const [handle, key] of Object.entries(PROBLEM_COPY_KEY)) {
    problem[handle as DomainProblem] = copy(key);
  }
  return {
    fieldLabel: copy("landing.field.label"),
    placeholder: copy("landing.field.placeholder"),
    submit: submitLabel ?? copy("landing.submit.label"),
    problem,
  };
}
