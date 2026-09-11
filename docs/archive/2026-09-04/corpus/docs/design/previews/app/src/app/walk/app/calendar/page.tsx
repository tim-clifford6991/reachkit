"use client";

import { useState } from "react";
import { Num } from "@/components/Num";
import { Badge, Btn, Join } from "@/components/registry/primitives";
import { CalendarGrid, DayPanel, type DayEntry, type Way } from "@/components/registry/surfaces";
import { AppShell } from "@/components/walk/AppShell";
import { StateBar, WalkBanner } from "@/components/chrome/WalkBanner";
import { Mono, Note, Stop } from "@/components/chrome/sheet";
import { CALENDAR } from "@/mock/data";

type View = "review" | "live" | "no-page" | "needs-you" | "supply-out";

const FULL: DayEntry[] = [
  { kind: "off", date: "28" },
  { kind: "off", date: "29" },
  { kind: "filled", date: "30", stage: "Live", tone: "ok", label: CALENDAR.pageTitle },
  { kind: "filled", date: "31", stage: "Live", tone: "ok", label: CALENDAR.pageTitle },
  { kind: "filled", date: "01", stage: "Your review", tone: "warn", label: CALENDAR.pageTitle, today: true },
  { kind: "filled", date: "02", stage: "Scheduled", tone: "neutral", label: CALENDAR.pageTitle },
  { kind: "filled", date: "03", stage: "Scheduled", tone: "neutral", label: CALENDAR.pageTitle },
  { kind: "filled", date: "04", stage: "Planned", tone: "neutral", label: CALENDAR.pageTitle },
  { kind: "empty", date: "05", account: CALENDAR.instruction, accountTone: "warn" },
  { kind: "filled", date: "06", stage: "Planned", tone: "neutral", label: CALENDAR.pageTitle },
  { kind: "filled", date: "07", stage: "Planned", tone: "neutral", label: CALENDAR.pageTitle },
  { kind: "filled", date: "08", stage: "Planned", tone: "neutral", label: CALENDAR.pageTitle },
  { kind: "filled", date: "09", stage: "Planned", tone: "neutral", label: CALENDAR.pageTitle },
  { kind: "filled", date: "10", stage: "Needs you", tone: "warn", label: CALENDAR.pageTitle },
];

const SUPPLY_OUT: DayEntry[] = FULL.map((e, i) =>
  i > 7 && e.kind !== "off"
    ? { kind: "empty" as const, date: e.date, account: CALENDAR.exhausted, accountTone: "neutral" as const }
    : e,
);

const OFFERED: Way[] = [
  {
    kind: "offered",
    label: CALENDAR.route1,
    addressKey: CALENDAR.addressKeyReadable,
    address: CALENDAR.publicAddress,
    primary: true,
  },
  {
    kind: "offered",
    label: CALENDAR.route2,
    addressKey: CALENDAR.addressKeyInWordpress,
    address: CALENDAR.wordpressAddress,
    primary: false,
  },
];

export default function WalkCalendar() {
  const [view, setView] = useState<View>("review");
  const [filter, setFilter] = useState(0);

  const entries = view === "supply-out" ? SUPPLY_OUT : FULL;

  const panel =
    view === "no-page" || view === "supply-out" ? (
      <DayPanel
        stage={<Badge tone="neutral">{CALENDAR.emptyDayLabel}</Badge>}
        date="[date]"
        account={CALENDAR.exhausted}
        provenance="[measured · date]"
      />
    ) : view === "live" ? (
      <DayPanel
        stage={<Badge tone="ok">Live</Badge>}
        date="[date]"
        heading={CALENDAR.pageTitle}
        why={CALENDAR.why}
        waysLabel={CALENDAR.waysLabel}
        ways={OFFERED}
        actions={<Btn label={CALENDAR.unpublish} variant="danger" size="sm" />}
        provenance={CALENDAR.provenance}
      />
    ) : view === "needs-you" ? (
      <DayPanel
        stage={<Badge tone="warn">Needs you</Badge>}
        date="[date]"
        heading={CALENDAR.pageTitle}
        why={CALENDAR.why}
        actions={<Btn label={CALENDAR.reconnectLabel} />}
        provenance={CALENDAR.provenance}
      />
    ) : (
      <DayPanel
        stage={<Badge tone="warn">Your review</Badge>}
        date="[date]"
        heading={CALENDAR.pageTitle}
        why={CALENDAR.why}
        actions={
          <div className="stack-2">
            <Btn label={CALENDAR.reviewAction} block />
            <div className="row">
              <Btn label={CALENDAR.moveLabel} variant="ghost" size="sm" />
              <Btn label={CALENDAR.vetoLabel} variant="danger" size="sm" />
            </div>
          </div>
        }
        provenance={CALENDAR.provenance}
      />
    );

  return (
    <main className="pv-wrap">
      <WalkBanner
        screen="/app — Calendar, with the day panel open"
        spec="BUILD §4.6 · today selected on open"
        primaryAction="[review action — owner's] in the day panel"
        proposed={[
          "--w-day-panel",
          "--grid-week",
          "--w-sidebar",
          "TabBar",
          "the month as a 7-row list below --breakpoint-md",
          "the day panel in flow below --breakpoint-xl",
        ]}
      >
        <div style={{ marginTop: "var(--s-3)" }}>
          <StateBar
            states={["review", "live", "no-page", "needs-you", "supply-out"]}
            value={view}
            onChange={(s) => setView(s as View)}
          />
        </div>
      </WalkBanner>

      <AppShell current="Calendar">
        <div className="stack-4">
          <div className="between">
            <h1 className="rk-h1">{CALENDAR.head}</h1>
            <Join>
              <button type="button" className="btn join-item btn-ghost btn-sm">
                {CALENDAR.prev}
              </button>
              <button type="button" className="btn join-item btn-ghost btn-sm">
                <Num>{CALENDAR.month}</Num>
              </button>
              <button type="button" className="btn join-item btn-ghost btn-sm">
                {CALENDAR.next}
              </button>
            </Join>
          </div>

          <div className="row">
            {CALENDAR.filters.map((f, i) => (
              <button
                key={f.label}
                type="button"
                className={`badge ${i === filter ? "tone-accent" : `tone-${f.tone}`}`}
                style={{ cursor: "pointer", borderWidth: "var(--border-hair)", borderStyle: "solid" }}
                onClick={() => setFilter(i)}
              >
                {f.label} <Num>{f.count}</Num>
              </button>
            ))}
          </div>

          {/* ONE panel, one layout, reflowed in CSS. It used to be rendered
              twice — once for wide, once for narrow — which is two DOM
              copies of one surface and two places for them to diverge.
              `.rk-cal-layout` is a column until --breakpoint-xl and a row
              above it; `.rk-panel` is full-width in flow until the same
              width and 290px sticky above it. Still not a drawer. */}
          <div className="rk-cal-layout">
            <div className="grow">
              <CalendarGrid entries={entries} />
            </div>
            {panel}
          </div>

          <p className="explain">{CALENDAR.footnote}</p>
        </div>
      </AppShell>

      <Note>
        <p style={{ margin: 0 }}>
          <strong>Today is selected on open</strong> and is the ringed cell in the grid —{" "}
          <Mono>01</Mono>, carrying the ruled dark <Mono>--ring-accent</Mono> when you switch
          themes. On the light ring value it read as a smudge in dark, which is why the ruling
          exists; you can now check that at real size.
        </p>
      </Note>
      <Stop>
        <p style={{ margin: 0 }}>
          <strong>What is found and what is proposed, at three widths.</strong> Drag the window
          from wide to phone and three things happen, and only one of them is a rule anyone
          wrote down. At <Mono>--breakpoint-xl</Mono> the day panel leaves its 290px sticky
          column and follows the grid full-width — <strong>proposed</strong>: §4.6 says
          &ldquo;beside the grid — not a drawer&rdquo; and says nothing about a viewport with no
          &ldquo;beside&rdquo; left, so this is a preview&rsquo;s answer and needs the surface
          blueprint&rsquo;s word. It is still not a drawer: nothing slides over anything.
          At <Mono>--breakpoint-lg</Mono> the sidebar hides and the tabs take over —{" "}
          <strong>found</strong>, §4.4 in its own words; only the width is derived. At{" "}
          <Mono>--breakpoint-md</Mono> the month stops being seven columns and becomes seven
          rows — <strong>proposed</strong>, for the same reason and needing the same word.{" "}
          <Mono>--w-cell-min</Mono> is what decides that last one: below it a cell cannot hold a
          date, the widest stage chip and a line of title without cutting one of them, and{" "}
          <Mono>--t-floor</Mono> refuses the other way out.
        </p>
      </Stop>
      <Note>
        <p style={{ margin: 0 }}>
          <Mono>supply-out</Mono> is REQ-043 c3 live: when opportunities run out, future days are
          empty and the empty state says so. <strong>The calendar is never padded</strong> — every
          cell in that state is an entry this page decided to pass, and the grid component has no
          code path that invents one.
        </p>
      </Note>
    </main>
  );
}
