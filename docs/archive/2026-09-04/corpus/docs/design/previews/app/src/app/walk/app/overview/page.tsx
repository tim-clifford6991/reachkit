"use client";

import { useState } from "react";
import { Num } from "@/components/Num";
import { Alert, Badge, Btn, Card, EmptyState, Stat } from "@/components/registry/primitives";
import { GoalDots, GrowthLine, GrowthLineNoMeasurement, RivalSparkline, WeekStrip } from "@/components/registry/charts";
import { FailedMeasurement, StaleWhileRemeasuring } from "@/components/proposed";
import { AppShell } from "@/components/walk/AppShell";
import { StateBar, WalkBanner } from "@/components/chrome/WalkBanner";
import { Mono, Note, Stop } from "@/components/chrome/sheet";
import { GROWTH, GROWTH_GAPPED, OVERVIEW, RIVALS, WEEK } from "@/mock/data";

type View = "measured" | "first-week" | "re-measuring" | "failed" | "empty-queue" | "domain-changed";

export default function WalkOverview() {
  const [view, setView] = useState<View>("measured");

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
    <main className="pv-wrap">
      <WalkBanner
        screen="/app — Overview, the default view"
        spec="BUILD §4.5 · five modules, inside §4.4's shell"
        primaryAction="[read it — owner's] on today's pending page (module 5's alert)"
        proposed={["TabBar (narrow viewport)", "loading rule", "failed-measurement tone"]}
      >
        <div style={{ marginTop: "var(--s-3)" }}>
          <StateBar
            states={["measured", "first-week", "re-measuring", "failed", "empty-queue", "domain-changed"]}
            value={view}
            onChange={(s) => setView(s as View)}
          />
        </div>
      </WalkBanner>

      <AppShell current="Overview">
        <div className="stack-6">
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

          {/* 3 · three stat tiles */}
          {/* One column, then three at --breakpoint-md — the shell has no
              sidebar below --breakpoint-lg, so the content column is full
              width there and three tiles clear their own measure. */}
          <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: "var(--s-4)" }}>
            <div className="rk-card rk-card-body">
              <Stat
                label={OVERVIEW.tiles.score.label}
                state={view === "first-week" ? "unmeasured" : "measured"}
                value={OVERVIEW.tiles.score.value}
                unmeasuredAccount={OVERVIEW.growthNoMeasurement}
                delta={<Badge tone="ok"><Num>{OVERVIEW.tiles.score.delta}</Num></Badge>}
              />
            </div>
            <div className="rk-card rk-card-body">
              <Stat
                label={OVERVIEW.tiles.ai.label}
                state="measured"
                value={OVERVIEW.tiles.ai.value}
                goal={<Badge tone="neutral">{OVERVIEW.tiles.ai.goal}</Badge>}
                extra={<GoalDots have={2} goal={6} />}
              />
            </div>
            <div className="rk-card rk-card-body">
              <Stat
                label={OVERVIEW.tiles.pages.label}
                state={view === "first-week" ? "measured-zero" : "measured"}
                value={OVERVIEW.tiles.pages.value}
                delta={<Badge tone="neutral">{OVERVIEW.tiles.pages.extra}</Badge>}
                extra={<p className="explain">{OVERVIEW.tiles.pages.young}</p>}
              />
            </div>
          </div>

          {/* 4 · how far ahead each rival is */}
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

      <Note>
        <p style={{ margin: 0 }}>
          <strong>Max one headline number per module, and every value carries its delta or its
          goal, never bare.</strong> That is a data rule §4.5 states and a static sheet can only
          assert; here <Mono>Stat</Mono>&rsquo;s props are a union of{" "}
          <Mono>{"{ delta }"}</Mono> and <Mono>{"{ goal }"}</Mono>, so a bare value has no
          representation to pass. Drop one and the page does not build.
        </p>
      </Note>
      <Stop>
        <p style={{ margin: 0 }}>
          <Mono>empty-queue</Mono> is the state to look hardest at. It is <em>green</em>. Nothing
          on this screen turns red because there is no page today, and{" "}
          <Mono>EmptyState</Mono>&rsquo;s tone type would not let it.{" "}
          <Mono>domain-changed</Mono> is the other: the growth line breaks and every rival
          sparkline breaks with it, at the same date — and in that state the rivals lose their{" "}
          <Mono>was 276×</Mono> badges entirely, because the gapped variant has no{" "}
          <Mono>delta</Mono> prop to pass one to. <strong>The resize did not cost that.</strong>{" "}
          <Mono>RivalSparkline</Mono> was rebuilt on 2026-09-02 — a padded viewBox, a named-area
          grid, a floored plot column — and the gapped arm still has no <Mono>delta</Mono>{" "}
          member, which is REQ-071 c13&rsquo;s protection and the one thing a layout change was
          most likely to lose quietly.
        </p>
      </Stop>
    </main>
  );
}
