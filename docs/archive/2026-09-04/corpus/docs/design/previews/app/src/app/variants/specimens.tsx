"use client";

/**
 * THE SPECIMENS THE DIMENSION COMPARISON RENDERS.
 *
 * One small piece of the product per axis, so a position can be judged
 * against the other positions on the SAME axis with nothing else moving.
 * That is the whole difference between this page and the five full-screen
 * variants: there, several things move at once and you judge a result;
 * here, one thing moves and you judge a decision.
 *
 * Every specimen is registered components over mock data. No copy is
 * written here — every string comes from src/mock/data.ts, which carries
 * the bracketed convention for the sentences only the owner may write.
 */
import { Num } from "@/components/Num";
import { Badge, Btn, Card, EmptyState, Stat, Toggle } from "@/components/registry/primitives";
import { GoalDots } from "@/components/registry/charts";
import { Sidebar } from "@/components/registry/surfaces";
import { DESTINATIONS, OVERVIEW, SHELL } from "@/mock/data";
import type { SpecimenKind } from "./axes";

/** Density · separation · radius · type · colour all land on this one. */
export function CardSpecimen() {
  return (
    <Card
      eyebrow={OVERVIEW.weekLabel}
      verdict={
        <span className="row" style={{ alignItems: "baseline" }}>
          <span className="rk-num-big">
            <Num>{OVERVIEW.tiles.score.value}</Num>
          </span>
          <Badge tone="ok">
            <Num>{OVERVIEW.tiles.score.delta}</Num>
          </Badge>
        </span>
      }
      provenance="[measured · date]"
    >
      <p className="explain">{OVERVIEW.tiles.pages.young}</p>
      {/* §2.5: an empty queue is a SUCCESS state. It is on every specimen
          on purpose — it is the thing a "cleaner" position would break
          first, and here it can be checked by looking. */}
      <EmptyState tone="ok" message={OVERVIEW.emptyQueue} />
      <div className="row">
        <Btn label={OVERVIEW.alerts[0].action} size="sm" />
        <Btn label={OVERVIEW.openCalendar} variant="ghost" size="sm" />
      </div>
    </Card>
  );
}

/** The data-presentation axis. §4.5 module 3, unchanged. */
export function TilesSpecimen() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 v-tiles">
      <div className="v-tile">
        <Stat
          label={OVERVIEW.tiles.score.label}
          state="measured"
          value={OVERVIEW.tiles.score.value}
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
          state="measured"
          value={OVERVIEW.tiles.pages.value}
          delta={<Badge tone="neutral">{OVERVIEW.tiles.pages.extra}</Badge>}
        />
      </div>
    </div>
  );
}

/**
 * The chrome axis. §4.4's shell, at the width where it exists at all —
 * below --breakpoint-lg the sidebar is hidden and top tabs take over, so
 * this specimen is a desktop specimen and says so.
 */
export function ShellSpecimen() {
  return (
    <div className="rk rk-shell v-specimen-shell">
      <div className="rk-shell-body">
        <div className="hidden lg:flex">
          <Sidebar
            domainBlock={
              <div className="stack-1">
                <div className="row">
                  <span className="rk-dot" />
                  <span className="t-sm" style={{ fontWeight: 700 }}>
                    <Num>{SHELL.domain}</Num>
                  </span>
                </div>
                <p className="prov">{SHELL.week}</p>
              </div>
            }
            destinations={DESTINATIONS.map((d) => ({
              label: d,
              count: d === "Calendar" ? SHELL.counts.Calendar : 0,
              current: d === "Overview",
            }))}
            publishingState={
              <div className="sunk stack-2">
                <p className="eb">{SHELL.publishing.state}</p>
                <p className="prov">
                  <Num>{SHELL.publishing.next}</Num>
                </p>
                <Toggle label={SHELL.publishing.toggleLabel} checked onChange={() => undefined} />
              </div>
            }
          />
        </div>
        <div className="rk-main">
          <p className="eb" style={{ marginBottom: "var(--s-2)" }}>
            {OVERVIEW.weekLabel}
          </p>
          <p className="explain">[desktop only — below --breakpoint-lg §4.4 hides the sidebar]</p>
        </div>
      </div>
    </div>
  );
}

export function Specimen({ kind }: { kind: SpecimenKind }) {
  if (kind === "tiles") return <TilesSpecimen />;
  if (kind === "shell") return <ShellSpecimen />;
  return <CardSpecimen />;
}
