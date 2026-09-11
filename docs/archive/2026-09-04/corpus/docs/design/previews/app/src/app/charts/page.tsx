"use client";

import { Num } from "@/components/Num";
import { Badge, Card, Stat } from "@/components/registry/primitives";
import { AiDotMatrix } from "@/components/registry/surfaces";
import {
  GoalDots,
  GrowthLine,
  GrowthLineNoMeasurement,
  PresenceBars,
  RivalSparkline,
  WeekStrip,
} from "@/components/registry/charts";
import { Mono, Note, P, ScrollX, Section, SheetHead, Stage, Stop, Sub } from "@/components/chrome/sheet";
import { GROWTH, GROWTH_GAPPED, MATRIX_ROWS, OVERVIEW, REPORT, RIVALS, WEEK } from "@/mock/data";

const RIVAL_GAPPED = [276, 240, null, 150, 110, 78];

export default function ChartsPage() {
  return (
    <main className="pv-wrap">
      <SheetHead
        title="The closed chart inventory — live"
        carries="WO-035 (charts) + WO-036 · both unsigned · all five components.md §3 rows are proposed"
      >
        <P>
          Five forms, and a sixth is a design-artifact approval first. Inline SVG with hand-sized
          viewBoxes and no chart library. Two series colours and no third:{" "}
          <Mono>--chart-you</Mono> is always the customer, <Mono>--chart-rival</Mono> is everyone
          else. No chart component in this app accepts a colour or a tone prop, so the rule is held
          by the type and not by discipline.
        </P>
      </SheetHead>

      <Section n="1" title="GrowthLine">
        <P>
          Weekly points, each with its own measurement date. Area and line in{" "}
          <Mono>--chart-you</Mono>, endpoint labelled, one axis, faint gridlines at three values,
          tooltip on every mark. Hover a point — that is the mark tooltip §2.4 requires, and it is
          the first time it has been judgeable.
        </P>
        <Stage label="series">
          <div className="rk-card rk-card-body">
            <p className="eb">{OVERVIEW.growthLabel}</p>
            <GrowthLine points={GROWTH} startNote={OVERVIEW.growthStart} goalNote={OVERVIEW.growthGoal} />
          </div>
        </Stage>
        <Sub title="Gapped series — never carried forward, never interpolated" />
        <P>
          An unmeasured week is a <strong>break</strong> with that week&rsquo;s own account beside
          it. The path restarts after every gap, so no measured value is ever joined across a
          missing one. The break is a dashed <Mono>--ink-3</Mono> rule, never a series colour: a
          third stroke colour reads as a third series against §2.4.
        </P>
        <Stage label="gapped series — week 3 is missing">
          <div className="rk-card rk-card-body">
            <p className="eb">{OVERVIEW.growthLabel}</p>
            <GrowthLine points={GROWTH_GAPPED} startNote={OVERVIEW.growthStart} goalNote={OVERVIEW.growthGoal} />
            <p className="explain">[domain-changed line — owner&rsquo;s] · [change date]</p>
          </div>
        </Stage>
        <Sub title="No measurement at all" />
        <Stage label="one written line carrying the first-due date, in place of the chart">
          <div className="rk-card rk-card-body">
            <p className="eb">{OVERVIEW.growthLabel}</p>
            <GrowthLineNoMeasurement
              account={OVERVIEW.growthNoMeasurement}
              firstDue={OVERVIEW.growthFirstDue}
            />
          </div>
        </Stage>
        <Note>
          <p style={{ margin: 0 }}>
            Not an empty chart with no points in it, and not a spinner. The chart is{" "}
            <em>absent</em> and one written line stands where it was.
          </p>
        </Note>
      </Section>

      <Section n="2" title="RivalSparkline — and the gapped pair, drawn together">
        <P>
          Per rival: name, falling series, endpoint. <strong>The props accept no tone at all</strong>,
          so &ldquo;rival strength is neutral gray, never red&rdquo; cannot be broken by a prop —
          the type has no member to break it with. Two arms: absolute, used while the
          customer&rsquo;s count is <Num>0</Num>, and ratio, which unlocks at ranked ≥ <Num>10</Num>.
          Never a ratio at zero: a division by zero reads as broken.
        </P>
        <Stage label="absolute · with its delta badge">
          <div className="rk-card rk-card-body">
            <p className="eb">{OVERVIEW.rivalsLabel}</p>
            {RIVALS.map((r) => (
              <RivalSparkline
                key={r.name}
                arm="absolute"
                name={r.name}
                series={r.series}
                endpoint={r.endpoint}
                delta={r.delta}
              />
            ))}
            <p className="explain">{OVERVIEW.rivalsDim}</p>
          </div>
        </Stage>
        <Sub title="Gapped — components.md §4 gap 6, in three parts" />
        <P>
          REQ-071 c13 requires every chart or series spanning a domain change to break at it and
          state that the domain changed. A rival distance is named in that clause explicitly, and{" "}
          <Mono>RivalSparkline</Mono> carried no break at all. Drawing it produced three parts, not
          one — and all three are enforced in the type here, not described.
        </P>
        <Stage label="the gapped pair: GrowthLine and RivalSparkline, at the same change date">
          <div className="rk-card rk-card-body">
            <GrowthLine points={GROWTH_GAPPED} startNote={OVERVIEW.growthStart} goalNote={OVERVIEW.growthGoal} />
            <div className="hr" />
            <RivalSparkline
              arm="gapped"
              name={RIVALS[0].name}
              series={RIVAL_GAPPED}
              endpoint={RIVALS[0].endpoint}
              account="[domain-changed line — owner&rsquo;s] · [change date]"
            />
          </div>
        </Stage>
        <ScrollX>
        <table className="pv-table">
          <thead>
            <tr>
              <th>Part</th>
              <th>How it is held</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="m">a · the break</td>
              <td>
                A dashed <Mono>--ink-3</Mono> rule through the plot — never a series colour, because
                a third stroke colour reads as a third series.
              </td>
            </tr>
            <tr>
              <td className="m">b · the account</td>
              <td>
                A <strong>required</strong> node beside the row. A sparkline whose drawable plot
                is 120×32 has nowhere to carry the statement criterion 13 demands, so the gapped
                variant&rsquo;s type makes <Mono>account</Mono> non-optional. The 2026-09-02
                resize did not change that: the viewBox is 132×44 now, but the twelve extra units
                are padding, and padding carries no sentence.
              </td>
            </tr>
            <tr>
              <td className="m">c · no delta badge</td>
              <td>
                <Mono>delta</Mono> is <strong>absent from the gapped variant&rsquo;s type</strong>.
                §4.5 pairs each rival with a <Mono>was 276×</Mono> badge, which is a direction
                computed over a span; c13 forbids one spanning the change date and forbids restating
                it over a shorter span. Omitting it by convention is not testable —{" "}
                <em>refusing the prop is</em>, and here the compiler refuses it.
              </td>
            </tr>
          </tbody>
        </table>
        </ScrollX>
      </Section>

      <Section n="3" title="PresenceBars">
        <P>
          One bar per domain, direct-labelled with name and value. The customer is the accent, every
          rival is neutral gray. <Mono>you</Mono> is a boolean, not a colour: a rival has no way to
          be rendered red.
        </P>
        <Stage label="bars — and zero for the customer, which is a measurement">
          <Card eyebrow="[card eyebrow]" verdict={<span className="rk-h3">[chart description — owner&rsquo;s]</span>} provenance={REPORT.googleSourceChip}>
            <PresenceBars rows={REPORT.presence} max={12} />
          </Card>
        </Stage>
        <Note>
          <p style={{ margin: 0 }}>
            The customer&rsquo;s bar reads <Num>0/12</Num> and is <em>rendered</em>, at zero width,
            with its label — never an error, never an omission. §2.5 permits red for exactly this
            case, the customer&rsquo;s own problem shown to them, and the bar chart still does not
            spend it: the row is accent, and the fact is the number.
          </p>
        </Note>
      </Section>

      <Section n="4" title="AiDotMatrixChart">
        <P>
          The chart form of <Mono>AiDotMatrix</Mono> over the <strong>same cell type, imported and
          never re-declared</strong> (rule 7.1: one capability, one shape). It adds the goal dots
          and nothing else — there is no second cell definition anywhere in this app.
        </P>
        <Stage label="the matrix, and the tile's dot row with its dashed goal dots">
          <div className="stack-3">
            <Card eyebrow={REPORT.aiSourceChip} verdict={<span className="rk-h3">[chart description — owner&rsquo;s]</span>}>
              <AiDotMatrix rows={MATRIX_ROWS} countLine={REPORT.denominator} />
            </Card>
            <div className="rk-card rk-card-body">
              <Stat
                label={OVERVIEW.tiles.ai.label}
                state="measured"
                value={OVERVIEW.tiles.ai.value}
                goal={<Badge tone="neutral">{OVERVIEW.tiles.ai.goal}</Badge>}
                extra={<GoalDots have={2} goal={6} />}
              />
            </div>
          </div>
        </Stage>
      </Section>

      <Section n="5" title="WeekStrip">
        <P>
          Seven days, each direct-labelled with its date through the mono utility, in the
          customer&rsquo;s own time zone. A day with nothing measured renders as a{" "}
          <strong>labelled empty mark, never a gap</strong>.
        </P>
        <Stage label="done · today · to-come · nothing measured">
          <div className="rk-card rk-card-body">
            <p className="eb">{OVERVIEW.weekLabel}</p>
            <WeekStrip days={WEEK} />
            <p className="prov">[measured · date]</p>
          </div>
        </Stage>
        <Stop>
          <p style={{ margin: 0 }}>
            <strong>This is where the type scale used to run out, and now does not.</strong> Both
            HTML sheets reached below 11px to fit a written label into a cell this narrow, and the
            open question was whether the cell gets more room or the scale gets a floor. The
            answer as of 2026-09-02 is <em>both</em>: <Mono>--t-floor</Mono> is 11px and no text
            in the product goes under it, and <Mono>--w-cell-min</Mono> is 96px, which is the
            width a cell needs to hold a date, the widest stage chip and a line of label at the
            floor. Seven cells cannot both clear 96px and fit a phone, so below{" "}
            <Mono>--breakpoint-md</Mono> the strip is seven rows rather than seven columns — the
            same rule the calendar grid takes, from the same token.{" "}
            <strong>That reflow is proposed and needs the surface blueprint&rsquo;s word.</strong>{" "}
            Drag your window narrower and watch it turn; nothing shrinks and nothing is cut.
          </p>
        </Stop>
      </Section>

      <Section n="6" title="The inventory is closed at five">
        <P>
          Nothing on this page is a sixth form. The report header&rsquo;s three driver mini-bars are{" "}
          <Mono>Progress</Mono>, registered as such so a chart is not minted for them; the goal dots
          are the dot-matrix cell type with a dashed border. A genuinely new chart form is a
          design-artifact approval first, and this app proposes none.
        </P>
      </Section>
    </main>
  );
}
