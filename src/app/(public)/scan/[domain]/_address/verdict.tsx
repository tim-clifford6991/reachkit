// BUILD §4.1 module 1 — the verdict strip
//
// The score, its band word, the domain and the date it was measured, and
// one written line naming the factor holding the score down.
//
// **No driver mini-bars and no factor value, anywhere** (DECISIONS
// 2026-09-03, superseding §4.1's own header-strip wording). The line names
// the limiting factor without stating that factor's value, its weight, or
// how the score is put together — and `Verdict` carries no `factors`
// member, so there is no value here to render by mistake.
//
// The unmeasured arm renders the dash, **no band element at all**, still
// names the domain and the date, and carries one line per factor with no
// value, saying which of the two reasons applies to each. A measured zero
// is a zero: `renderMeasured`'s own trichotomy decides which, and it is
// not re-implemented here.
import type React from "react";
import { Badge, Card } from "@/ui/components";
import type { Tone } from "@/ui/types";
import { copy } from "@/lib/presentation/copy";
import { LIMITING_LINES, SCORE_BANDS } from "@/lib/presentation/bands";
import type { BandHandle } from "@/lib/measure/bands";
import type { Verdict } from "@/lib/measure/verdict";
import type { ScoreFactorName } from "@/lib/measure/score";
import type { CopyKey } from "@/lib/presentation/copy";
import { CopyLink } from "./copy-link";
import { dash, Num, unmeasuredLineFor } from "./measured";

/** The factor's own name, for the `{what}` slot of the two unmeasured
 *  lines. `LIMITING_LINES` holds the *sentence* about a factor and is a
 *  different thing; conflating them would put a whole sentence inside
 *  another sentence's slot. */
const FACTOR_NAMES: Readonly<Record<ScoreFactorName, CopyKey>> = Object.freeze({
  foundations: "verdict.factor.foundations",
  answerability: "verdict.factor.answerability",
  presence: "verdict.factor.presence",
});

/** The band is a written word first; the tone only agrees with it. Red is
 *  the customer's own problem being shown to them (`BUILD.md` §2.5), which
 *  "Invisible" is. */
const BAND_TONE: Readonly<Record<BandHandle, Tone>> = Object.freeze({
  invisible: "bad",
  "hard-to-find": "warn",
  findable: "ok",
  dominant: "ok",
});

/** REQ-004 c3: one line naming every factor that has no value, and for
 *  each, which of the two reasons applies — never calling a factor the
 *  scan never attempted a missing one. The count follows
 *  `Verdict.missing`'s own length exactly; it is never padded or
 *  truncated. */
function MissingFactors(p: { verdict: Verdict }): React.JSX.Element | null {
  if (p.verdict.missing.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      {p.verdict.missing.map((m) => (
        <p key={m.factor}>
          {copy(unmeasuredLineFor({ kind: "unmeasured", reason: m.reason, at: p.verdict.measuredAt }), {
            what: copy(FACTOR_NAMES[m.factor]),
          })}
        </p>
      ))}
    </div>
  );
}

export function VerdictStrip(p: {
  verdict: Verdict;
  category: string | null;
  /** Already formatted by the one caller that owns the report's one date. */
  measuredOn: string;
  /** REQ-001 c7: the canonical address, no token, no expiry. Rendered as
   *  a control here and carried out of this file, not composed in it. */
  canonicalUrl: string;
}): React.JSX.Element {
  const { verdict } = p;
  const scoreAndBand = verdict.scoreAndBand;

  return (
    <Card
      state="default"
      title={
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="text-xs font-normal opacity-60">
            <Num>{copy("report.measured-at", { domain: verdict.domain, date: p.measuredOn })}</Num>
          </div>
          <CopyLink canonicalUrl={p.canonicalUrl} />
        </div>
      }
    >
      <div className="flex flex-wrap items-baseline gap-3">
        {/* A block, not an inline `span`: an inline box is sized from its
            own font's metrics, and JetBrains Mono is taller at the same
            size than the UI face, so a mono child inside an inline parent
            overflows it by a pixel or two. A block wrapper takes the line
            box's height, which is the child's. */}
        <div className="text-5xl font-bold">
          <Num unmeasured={scoreAndBand.kind === "unmeasured"}>
            {scoreAndBand.kind === "unmeasured" ? dash() : scoreAndBand.value.score}
          </Num>
        </div>
        {scoreAndBand.kind === "unmeasured" ? null : (
          <Badge tone={BAND_TONE[scoreAndBand.value.band]}>
            {copy(SCORE_BANDS[scoreAndBand.value.band])}
          </Badge>
        )}
        {p.category === null ? null : <Badge tone="neutral">{p.category}</Badge>}
      </div>

      {verdict.limiting.kind === "factor" ? (
        <p>{copy(LIMITING_LINES[verdict.limiting.factor])}</p>
      ) : null}
      <MissingFactors verdict={verdict} />
    </Card>
  );
}
