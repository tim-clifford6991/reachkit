"use client";

import { Num } from "@/components/Num";
import { Badge, Btn, Toggle } from "@/components/registry/primitives";
import {
  AiDotMatrix,
  CalendarGrid,
  DayPanel,
  type DayEntry,
  Sidebar,
  type Way,
} from "@/components/registry/surfaces";
import { FailedMeasurement, StaleWhileRemeasuring } from "@/components/proposed";
import { Flag, Mono, Note, P, Section, SheetHead, Stage, Stop, Sub } from "@/components/chrome/sheet";
import { CALENDAR, DESTINATIONS, MATRIX_ROWS, SHELL } from "@/mock/data";

/* The month, with all four empty-day accounts and no padding anywhere. Every
   cell in this array was decided by this caller: the grid invents none. */
const MONTH: DayEntry[] = [
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
  { kind: "empty", date: "07", account: CALENDAR.exhausted, accountTone: "neutral" },
  { kind: "empty", date: "08", account: CALENDAR.exhausted, accountTone: "neutral" },
  { kind: "empty", date: "09", account: CALENDAR.exhausted, accountTone: "neutral" },
  { kind: "empty", date: "10", account: CALENDAR.cause, accountTone: "neutral" },
];

const EMPTY_MONTH: DayEntry[] = ["01", "02", "03", "04", "05", "06", "07"].map((d) => ({
  kind: "empty" as const,
  date: d,
  account: CALENDAR.exhausted,
  accountTone: "neutral" as const,
}));

const BOTH_WAYS: Way[] = [
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

const WITHHELD: Way[] = [
  BOTH_WAYS[0],
  { kind: "withheld", label: CALENDAR.route2, account: CALENDAR.leadsNowhere },
];

const NOT_APPLICABLE: Way[] = [BOTH_WAYS[0], { kind: "not-applicable" }];

function DomainBlock() {
  return (
    <div className="stack-1">
      <div className="row">
        <span className="rk-dot" />
        <span className="t-sm" style={{ fontWeight: 700 }}>
          <Num>{SHELL.domain}</Num>
        </span>
      </div>
      <p className="prov">{SHELL.week}</p>
    </div>
  );
}

function PublishingCard() {
  return (
    <div className="sunk stack-2">
      <p className="eb">{SHELL.publishing.state}</p>
      <p className="prov">
        <Num>{SHELL.publishing.next}</Num>
      </p>
      <Toggle label={SHELL.publishing.toggleLabel} checked onChange={() => undefined} />
    </div>
  );
}

export default function SurfacesPage() {
  return (
    <main className="pv-wrap">
      <SheetHead
        title="The four custom surfaces — live"
        carries="WO-033 (surfaces) + WO-034 · both unsigned · all four components.md §2 rows are proposed"
      >
        <P>
          BUILD §2.2 admits custom CSS for exactly five things: the calendar grid, the day panel,
          the AI dot-matrix, chart SVGs and the sidebar — nothing else. These are four of the five.
          Two of these contracts are <strong>widenings still recorded as open gaps</strong> (§4 gap
          1, §4 gap 7) and are drawn widened, which is what a widening is for — not as settled.
        </P>
      </SheetHead>

      <Section n="1" title="Sidebar">
        <P>
          Width <Mono>--w-sidebar</Mono> <Flag>proposed</Flag>, sticky. Destinations are a required
          prop — the three are BP-037&rsquo;s tuple, not this component&rsquo;s. The
          publishing-state line is a required node. The component names no destination and no state
          wording of its own.
        </P>
        <Stage label="a destination with a count · a destination with none (0 renders no count at all)">
          {/* `.row-3` wraps: the 222px sidebar and the note beside it stack
              rather than the note being crushed to nothing at a narrow
              viewport. The sidebar itself keeps --w-sidebar — it is the
              specimen, and a specimen that resized would not be one. */}
          <div className="row-3" style={{ alignItems: "stretch" }}>
            <Sidebar
              domainBlock={<DomainBlock />}
              destinations={[
                { label: DESTINATIONS[0], current: true },
                { label: DESTINATIONS[1], count: SHELL.counts.Calendar },
                { label: DESTINATIONS[2], count: 0 },
              ]}
              publishingState={<PublishingCard />}
            />
            <div className="grow" style={{ padding: "var(--s-4)" }}>
              <p className="explain">
                Settings carries <Num>0</Num> and therefore carries no count element at all —
                not a zero, not a dot. Look at the third row.
              </p>
            </div>
          </div>
        </Stage>
        <Note>
          <p style={{ margin: 0 }}>
            <strong>Sticky is now real.</strong> The sheets could draw the sidebar but not its
            behaviour; scroll <Mono>/walk/app/overview</Mono> and the sticky/scroll relationship
            with the page is the thing being judged.
          </p>
        </Note>
      </Section>

      <Section n="2" title="CalendarGrid — and the four empty-day accounts">
        <P>
          Columns <Mono>--grid-week</Mono> <Flag>proposed</Flag>; the <Mono>minmax</Mono> is
          load-bearing. One entry per date, and <Mono>label</Mono> is required on a filled day: a
          day can never render as a coloured cell alone. The grid <strong>performs no
          padding</strong> — there is no code path in the component that invents a cell. Every cell
          below, including the two out-of-month ones, was decided by the caller.
        </P>
        <Stage label="a month with every stage, today ringed, and four different empty days">
          <CalendarGrid entries={MONTH} />
        </Stage>
        <Note>
          <p style={{ margin: 0 }}>
            Every empty day carries <strong>exactly one</strong> account and none of them is red.
            Exhausted supply is neutral <Mono>--ink-2</Mono>; an outstanding instruction is{" "}
            <Mono>--warn</Mono> because something is asked of the customer; the fourth is a cause
            line. <Mono>--bad</Mono> appears nowhere on this grid, and the empty-day tone type
            admits only <Mono>neutral</Mono> and <Mono>warn</Mono>, so it cannot.
          </p>
        </Note>
        <Stop>
          <p style={{ margin: 0 }}>
            <strong>Below <Mono>--breakpoint-md</Mono> the month is seven ROWS, and that is
            PROPOSED.</strong> <Mono>--w-cell-min</Mono> is 96px — a date, the widest registered
            stage chip (&ldquo;Your review&rdquo;) and one line of title at{" "}
            <Mono>--t-floor</Mono>, with <Mono>--s-2</Mono> either side. Seven of those need
            728px including page padding, which no phone has, and the two ways out are both
            refused: type under the floor, or a chip cut off by its own cell. So the columns go
            and the entries stay, in date order. §4.6 fixes the grid and says nothing about this
            width, so it needs the surface blueprint&rsquo;s word. Nothing about the contract
            moves — it is a rule in <Mono>.rk-cal</Mono>, the component has no second markup path,
            and <strong>the grid still invents no cell</strong>.
          </p>
        </Stop>
        <Sub title="A month with no page in it at all" />
        <P>
          §2.5: an empty queue is a success state, and an intended-empty state never takes{" "}
          <Mono>--bad</Mono> or <Mono>--warn</Mono>. This is the live case, not the theoretical
          one: exhausted supply empties every future day. Designed, never blank — and not a verdict
          that running out is fine.
        </P>
        <Stage label="exhausted supply">
          <div className="stack-3">
            <CalendarGrid entries={EMPTY_MONTH} />
            <div className="sunk stack-1">
              <p className="t-sm">{CALENDAR.exhausted}</p>
              <p className="prov">[measured · date]</p>
            </div>
          </div>
        </Stage>
      </Section>

      <Section n="3" title="DayPanel">
        <P>
          Width <Mono>--w-day-panel</Mono> <Flag>proposed</Flag>, sticky beside the grid,{" "}
          <strong>not a drawer</strong> — at and above <Mono>--breakpoint-xl</Mono>, which is the
          width where a 290px column and the grid at its own cell floor both fit. The panel
          supplies no string and no default action: heading, account, the five &ldquo;why this
          page&rdquo; rows, the ways-through list and the actions all arrive as required props.
        </P>
        <Stop>
          <p style={{ margin: 0 }}>
            <strong>Below <Mono>--breakpoint-xl</Mono> the panel is a full-width block following
            the grid, in flow, not sticky — and that is PROPOSED.</strong> §4.6 fixes 290px,
            sticky, beside the grid, not a drawer; it says nothing about a viewport with no
            &ldquo;beside&rdquo; left. This is a preview&rsquo;s answer and it needs the surface
            blueprint&rsquo;s word. It is still not a drawer: nothing slides over anything and
            nothing is dismissed. The behaviour is entirely in <Mono>.rk-panel</Mono> — there is
            no second markup path and no <Mono>narrow</Mono> prop, so the data contract this
            section is drawing is unchanged by it.
          </p>
        </Stop>
        <P>
          <strong>One primary action.</strong> For a delivered page it is the first way through —
          the page as a visitor sees it. The second way through is a ghost button beside it, and
          unpublish sits under a rule, subordinate, because it is destructive and is not what the
          customer came for.
        </P>
        <Stage label="a delivered page, both ways through offered · a day holding no page">
          <div className="row-3" style={{ alignItems: "flex-start" }}>
            <DayPanel
              stage={<Badge tone="ok">Live</Badge>}
              date="[date]"
              heading={CALENDAR.pageTitle}
              why={CALENDAR.why}
              waysLabel={CALENDAR.waysLabel}
              ways={BOTH_WAYS}
              actions={<Btn label={CALENDAR.unpublish} variant="danger" size="sm" />}
              provenance={CALENDAR.provenance}
            />
            <DayPanel
              stage={<Badge tone="neutral">{CALENDAR.emptyDayLabel}</Badge>}
              date="[date]"
              account={CALENDAR.exhausted}
              provenance="[measured · date]"
            />
          </div>
        </Stage>
        <Note>
          <p style={{ margin: 0 }}>
            The empty panel has <strong>one account and no second one</strong>, no ways-through list
            — there is no page to reach — and <strong>no publish or approve action, not even a
            disabled one</strong>: an action that cannot succeed is not offered at all. It has no
            primary action, and that is correct. &ldquo;One primary action per screen&rdquo; is a
            ceiling, not a floor.
          </p>
        </Note>
      </Section>

      <Section n="4" title="The ways-through slot — three cases per route, not two">
        <P>
          REQ-043 c12 promises two routes to a delivered page, <em>offered separately</em>, and
          where ReachKit&rsquo;s own record says a route leads nowhere, the detail says so{" "}
          <em>in place of</em> that way rather than offering it. Drawing it surfaced a case the
          widening did not name: a route can be <strong>offered</strong>, <strong>withheld with its
          account</strong>, or <strong>not applicable at all</strong> — and the third is not the
          second. A page delivered to the hosted blog has no WordPress route to withhold, and
          rendering a leads-nowhere account for it states a fact about a destination the customer
          never chose. It renders as <em>nothing</em>, and the list is one item long.
        </P>
        <Stage label="a · offered   ·   b · withheld with its account   ·   c · not applicable">
          <div className="row-3" style={{ alignItems: "flex-start" }}>
            <DayPanel
              stage={<Badge tone="ok">Live</Badge>}
              date="[date]"
              heading={CALENDAR.pageTitle}
              waysLabel={CALENDAR.waysLabel}
              ways={BOTH_WAYS}
              provenance={CALENDAR.provenance}
            />
            <DayPanel
              stage={<Badge tone="ok">Live</Badge>}
              date="[date]"
              heading={CALENDAR.pageTitle}
              waysLabel={CALENDAR.waysLabel}
              ways={WITHHELD}
              provenance={CALENDAR.provenance}
            />
            <DayPanel
              stage={<Badge tone="ok">Live</Badge>}
              date="[date]"
              heading={CALENDAR.pageTitle}
              waysLabel={CALENDAR.waysLabel}
              ways={NOT_APPLICABLE}
              provenance={CALENDAR.provenance}
            />
          </div>
        </Stage>
        <Note>
          <p style={{ margin: 0 }}>
            The withheld route has <strong>no button, disabled or otherwise</strong> — the account
            renders in place of the way through. The not-applicable route renders nothing, and the
            union is closed, so a caller cannot leave a route&rsquo;s disposition undefined and get
            a fourth case by accident. In the middle panel the same address stays visible under the{" "}
            <em>was-published-at</em> key — the second half of REQ-056 c6&rsquo;s two-key pair —
            except that <strong>both keys of that pair are still unwritten</strong>, so both render
            as their bracketed labels.
          </p>
        </Note>
      </Section>

      <Section n="5" title="AiDotMatrix — three cell states, and whose row it is">
        <P>
          components.md §4 gap 1, drawn as widened. Three states, not two:{" "}
          <strong>cited</strong>, <strong>not-cited</strong>, <strong>muted</strong> — a question
          with no AI answer at all, which §6.2 says is <em>never</em> a miss. And row identity is
          part of the contract, because §4.1 rings the customer&rsquo;s own empty row and fills
          rivals&rsquo; gray. A boolean can hold neither.
        </P>
        <Stage label="rivals' rows filled gray · the customer's row empty and red-ringed · muted cells in both">
          <AiDotMatrix rows={MATRIX_ROWS} countLine="[denominator line — owner&rsquo;s]" />
        </Stage>
        <Note>
          <p style={{ margin: 0 }}>
            Column <Num>6</Num> is muted on every row: nobody was cited because there was no AI
            answer to be cited in. It is dashed and sunk, and it is <em>not</em> the customer&rsquo;s
            red. Hover any cell for its required label — no legend-only mode exists, and the written
            count renders alongside, caller-supplied.
          </p>
        </Note>
        <Stop>
          <p style={{ margin: 0 }}>
            Red on the customer&rsquo;s row is the one place <Mono>--bad</Mono> is correct here:
            §2.5 reserves red for the customer&rsquo;s own problem shown to them, and{" "}
            <Mono>0/12</Mono> is named in that clause. A rival&rsquo;s miss is simply an empty cell.
          </p>
        </Stop>
      </Section>

      <Section n="6" title="The proposed loading rule">
        <P>
          Rule 7.3 requires every data view to specify loading, and no registered primitive carries
          one. <Mono>components.md</Mono> §6 records a proposal and keeps it out of every{" "}
          <Mono>States</Mono> cell, because that cell is what a signature moves. Here it is,
          running, and marked <Flag>proposed</Flag> wherever it appears.
        </P>
        <Stage label="re-measuring — the last measurement stays on screen and says which one it is">
          <StaleWhileRemeasuring
            reMeasuringLine="[re-measuring line — owner&rsquo;s]"
            lastMeasurement="[last good measurement · date]"
          >
            <CalendarGrid entries={MONTH.slice(0, 7)} />
          </StaleWhileRemeasuring>
        </Stage>
        <Stage label="a failed measurement — warn, never bad">
          <FailedMeasurement line="[measurement failed line — owner&rsquo;s]" />
        </Stage>
        <Note>
          <p style={{ margin: 0 }}>
            Never a skeleton (<Mono>Table</Mono>&rsquo;s rule, generalised), never a spinner or an
            indeterminate bar (REQ-003 c1 forbids both by name). A measurement ReachKit could not
            take is <em>ReachKit&rsquo;s</em> problem, so it takes <Mono>warn</Mono> — and the tone
            is not a prop here, it is a type with one member.
          </p>
        </Note>
        <Stop>
          <p style={{ margin: 0 }}>
            <strong>This proposal narrows the hole; it does not close it.</strong> Where there is no
            previous measurement there is nothing to keep showing, and the rule splits: stages known
            → <Mono>Steps</Mono>, every stage named; stages not known → one written line and no
            motion. The second branch is §4 gap 4 unchanged, and nothing in this app closes it.
          </p>
        </Stop>
        <Note>
          <p style={{ margin: 0 }}>
            <Mono>DayPanel</Mono> and <Mono>Sidebar</Mono> need no loading state at all, and that is
            a decision, not an omission: neither measures anything. The panel renders what it is
            handed, and a count the sidebar does not have already renders as no count.
          </p>
        </Note>
      </Section>
    </main>
  );
}
