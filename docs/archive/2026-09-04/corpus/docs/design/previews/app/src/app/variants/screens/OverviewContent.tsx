"use client";

/**
 * /app — Overview, BUILD.md §4.5's five modules, inside §4.4's shell.
 *
 * THIS IS THE WALKTHROUGH'S CONTENT, NOT A REDRAW. Same registered
 * components, same mock data, same module order, same states. Three
 * classes are added and they hold no value of their own — `v-modules`,
 * `v-tiles` and `v-tile` are each one --v-* token and nothing else.
 *
 * The walkthrough at /walk/app/overview is deliberately untouched: it is
 * the baseline the variants are compared against, and a baseline that
 * moved with the exploration would be no baseline.
 *
 * Every state the walkthrough carries is carried here, because rule 7.3
 * asks every data view for loading, empty and error and an aesthetic that
 * only survives the happy path has not been reviewed. `empty-queue` is the
 * one to look at under a colour or separation change.
 */
import { Num } from "@/components/Num";
import { Alert, Badge, Btn, Card, EmptyState, Stat } from "@/components/registry/primitives";
import { GoalDots, GrowthLine, GrowthLineNoMeasurement, RivalSparkline, WeekStrip } from "@/components/registry/charts";
import { FailedMeasurement, StaleWhileRemeasuring } from "@/components/proposed";
import { AppShell } from "@/components/walk/AppShell";
import { GROWTH, GROWTH_GAPPED, OVERVIEW, RIVALS, WEEK } from "@/mock/data";

export const OVERVIEW_VIEWS = [
  "measured",
  "first-week",
  "re-measuring",
  "failed",
  "empty-queue",
  "domain-changed",
] as const;

export type OverviewView = (typeof OVERVIEW_VIEWS)[number];

export function OverviewContent({ view }: { view: OverviewView }) {
  const growth =
    view === "first-week" ? (
      <GrowthLineNoMeasurement account={OVERVIEW.growthNoMeasurement} firstDue={OVERVIEW.growthFirstDue} />
    ) : view === "failed" ? (
      <FailedMeasurement line={OVERVIEW.failedMeasurement} />
    ) : (
      <GrowthLine
        points={view === "domain-changed" ? GROWTH_GAPPED : GROWTH}
        startNote={OVERVIEW.growthStart}
        goalNote={OVERVIEW.growthGoal}
      />
    );

  return (
    <AppShell current="Overview">
      <div className="v-modules">
        {/* 1 · head, backed by the chart directly under it */}
        <div className="row">
          <h1 className="rk-h1">{OVERVIEW.head}</h1>
          <Badge tone="ok">{OVERVIEW.headBadge}</Badge>
        </div>

        {/* 2 · growth chart */}
        <Card eyebrow={OVERVIEW.growthLabel} verdict={<span className="rk-h3">[chart description — owner&rsquo;s]</span>}>
          {view === "re-measuring" ? (
            <StaleWhileRemeasuring
              reMeasuringLine={OVERVIEW.reMeasuring}
              lastMeasurement={OVERVIEW.lastMeasurement}
            >
              {growth}
            </StaleWhileRemeasuring>
          ) : (
            growth
          )}
          {view === "domain-changed" ? (
            <p className="explain">[domain-changed line — owner&rsquo;s] · [change date]</p>
          ) : null}
        </Card>

        {/* 3 · three stat tiles — the data-presentation axis lands here.
            One column, then three at --breakpoint-md: the shell has no
            sidebar below --breakpoint-lg, so the content column is full
            width there and three tiles clear their own measure. */}
        <div className="grid grid-cols-1 md:grid-cols-3 v-tiles">
          <div className="v-tile">
            <Stat
              label={OVERVIEW.tiles.score.label}
              state={view === "first-week" ? "unmeasured" : "measured"}
              value={OVERVIEW.tiles.score.value}
              unmeasuredAccount={OVERVIEW.growthNoMeasurement}
              delta={<Badge tone="ok"><Num>{OVERVIEW.tiles.score.delta}</Num></Badge>}
            />
          </div>
          <div className="v-tile">
            <Stat
              label={OVERVIEW.tiles.ai.label}
              state="measured"
              value={OVERVIEW.tiles.ai.value}
              goal={<Badge tone="neutral">{OVERVIEW.tiles.ai.goal}</Badge>}
              extra={<GoalDots have={2} goal={6} />}
            />
          </div>
          <div className="v-tile">
            <Stat
              label={OVERVIEW.tiles.pages.label}
              state={view === "first-week" ? "measured-zero" : "measured"}
              value={OVERVIEW.tiles.pages.value}
              delta={<Badge tone="neutral">{OVERVIEW.tiles.pages.extra}</Badge>}
              extra={<p className="explain">{OVERVIEW.tiles.pages.young}</p>}
            />
          </div>
        </div>

        {/* 4 · how far ahead each rival is. The colour axis does NOT reach
            these marks: §2.4 closes the palette at two series colours. */}
        <Card eyebrow={OVERVIEW.rivalsLabel} verdict={<span className="rk-h3">[module verdict — owner&rsquo;s]</span>}>
          {RIVALS.map((r) =>
            view === "domain-changed" ? (
              <RivalSparkline
                key={r.name}
                arm="gapped"
                name={r.name}
                series={[r.series[0], r.series[1], null, r.series[3], r.series[4], r.series[5]]}
                endpoint={r.endpoint}
                account="[domain-changed line — owner&rsquo;s] · [change date]"
              />
            ) : (
              <RivalSparkline
                key={r.name}
                arm="absolute"
                name={r.name}
                series={r.series}
                endpoint={r.endpoint}
                delta={r.delta}
              />
            ),
          )}
          <p className="explain">{OVERVIEW.rivalsDim}</p>
        </Card>

        {/* 5 · this week */}
        <Card eyebrow={OVERVIEW.weekLabel} verdict={<span className="rk-h3">[module verdict — owner&rsquo;s]</span>} provenance="[measured · date]">
          <WeekStrip days={WEEK} />
          <div className="row">
            <Btn label={OVERVIEW.openCalendar} variant="ghost" size="sm" />
          </div>
          {view === "empty-queue" ? (
            <EmptyState tone="ok" message={OVERVIEW.emptyQueue} />
          ) : (
            <div className="stack-2">
              {OVERVIEW.alerts.map((a, i) => (
                <Alert
                  key={a.message}
                  tone={a.tone}
                  message={a.message}
                  action={<Btn label={a.action} variant={i === 0 ? "primary" : "ghost"} size="sm" />}
                />
              ))}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
