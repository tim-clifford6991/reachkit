// Canvas: Dashboard — the Discoverability Score, and the series beside it.
//
// The artboard draws one card here: the score with its delta and its band on
// the left, the searches series with its footnote pair on the right, and the
// date the reading was taken opposite the card's own label.
//
// Where the score is unmeasured there is no band: a band is a reading of a
// score, and naming one beside a dash would be a verdict on a measurement
// the product does not have.
import type React from "react";
import { Badge, Card, Stat } from "@/ui/components";
import { BAND_TONE } from "@/ui/bands";
import { SCORE_BANDS } from "@/lib/presentation/bands";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { formatDate } from "../_shell/format";
import { writtenLine } from "../_shell/written";
import { carriedBy, renderValue } from "./present";
import { statCarrier } from "./carry";
import { GrowthModule, growthSource } from "./GrowthModule";
import type { GrowthModule as GrowthModuleModel } from "./growth";
import type { ScoreModule } from "./model";
import { CARD_HEAD, CARD_LABEL, PROV, QUIET, SCORE_SPLIT, STACK } from "./style";

const SCORE_LABEL = "overview.tile.score.label" satisfies CopyKey;
const SCORE_TEST_ID = "overview-tile-score";

export function ScoreCard(p: {
  score: ScoreModule;
  growth: GrowthModuleModel;
  timeZone: string;
  /** Before the first weekly pass, the date the first reading is due — the
   *  same date the sidebar's domain block states, from one `firstDueOn`. */
  weekZero?: { firstDueOn: Date } | null;
}): React.JSX.Element {
  const label = copy(SCORE_LABEL);
  const value = renderValue(p.score.headline.value, SCORE_LABEL);
  const carried = carriedBy(p.score.headline, SCORE_LABEL);
  const weekZero = p.weekZero ?? null;
  const firstDue =
    weekZero === null
      ? null
      : writtenLine("overview.tile.score.first-due", {
          due: formatDate(weekZero.firstDueOn, p.timeZone),
        });
  const band =
    p.score.band === null ? null : (
      <Badge tone={BAND_TONE[p.score.band]}>{copy(SCORE_BANDS[p.score.band])}</Badge>
    );
  const source = growthSource(p.growth, p.timeZone);

  return (
    <section data-testid="overview-score">
      <Card
        state="default"
        title={
          <div className={CARD_HEAD}>
            <span className={CARD_LABEL}>
              <span className="eyebrow">{label}</span>
            </span>
            {source === null ? null : <span className={PROV}>{source}</span>}
          </div>
        }
      >
        <div className={SCORE_SPLIT}>
          <div className={STACK} data-testid={SCORE_TEST_ID}>
            {value.isDash ? (
              <Stat state="unmeasured" label={label} labelInHead reason={value.line ?? label} />
            ) : (
              <>
                <Stat
                  state={p.score.headline.value.kind === "zero" ? "measured-zero" : "measured"}
                  label={label}
                  labelInHead
                  carryBeside
                  value={value.text}
                  {...statCarrier(carried, band)}
                />
                {carried.kind === "goal" && carried.means !== null ? (
                  <p className={QUIET}>{carried.means}</p>
                ) : null}
              </>
            )}
            {firstDue === null ? null : <p className={QUIET}>{firstDue}</p>}
          </div>
          <GrowthModule growth={p.growth} timeZone={p.timeZone} />
        </div>
      </Card>
    </section>
  );
}
