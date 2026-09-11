"use client";

/**
 * /directions/<direction>/<screen>
 *
 * Five directions × two screens. The jump strip at the top is the point of
 * the route: the SAME screen under every direction is one click away, and
 * an aesthetic judgement is only ever actually made by looking at the same
 * thing twice.
 *
 * Everything above and below the specimen is preview chrome (--pv-*) and is
 * never part of what is being judged. The specimen itself renders full
 * width, outside the reviewer wrap, because two of the five directions
 * decide their own measure and one of them is full-bleed by construction.
 */
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { StateBar } from "@/components/chrome/WalkBanner";
import { Mono, Note, P } from "@/components/chrome/sheet";
import { DIRECTIONS, SCREENS, SCREEN_META, getDirection, type ScreenId } from "../../catalog";
import {
  OVERVIEW_VIEWS,
  PRIMARY_ACTION,
  REPORT_VIEWS,
  type OverviewView,
  type ReportView,
} from "../../fixture";
import { LedgerOverview, LedgerReport } from "../../impl/ledger";
import { ConsoleOverview, ConsoleReport } from "../../impl/console";
import { RankedOverview, RankedReport } from "../../impl/ranked";
import { SplitOverview, SplitReport } from "../../impl/split";
import { NarrativeOverview, NarrativeReport } from "../../impl/narrative";

const BASELINE: Record<ScreenId, string> = {
  report: "/walk/report",
  overview: "/walk/app/overview",
};

export default function DirectionScreen() {
  const params = useParams<{ direction: string; screen: string }>();
  const directionId = typeof params.direction === "string" ? params.direction : "";
  const screenParam = typeof params.screen === "string" ? params.screen : "";
  const direction = getDirection(directionId);

  const [reportView, setReportView] = useState<ReportView>("report");
  const [overviewView, setOverviewView] = useState<OverviewView>("measured");

  const isScreen = (s: string): s is ScreenId => (SCREENS as readonly string[]).includes(s);

  if (!direction || !isScreen(screenParam)) {
    return (
      <main className="pv-wrap">
        <div className="pv-stop">
          <p style={{ margin: 0, fontWeight: 700 }}>No such direction screen.</p>
          <p style={{ margin: "var(--s-2) 0 0" }}>
            The directions are {DIRECTIONS.map((d) => d.id).join(" · ")}, and the two screens are{" "}
            <Mono>report</Mono> and <Mono>overview</Mono>.{" "}
            <Link href="/directions" className="pv-mono">
              /directions
            </Link>
          </p>
        </div>
      </main>
    );
  }

  const screen: ScreenId = screenParam;
  const other: ScreenId = screen === "report" ? "overview" : "report";
  const meta = SCREEN_META[screen];

  const specimen = renderSpecimen(direction.id, screen, reportView, overviewView);

  return (
    <>
      <div className="pv-wrap" style={{ paddingBottom: "var(--s-4)" }}>
        <div className="pv-stop" style={{ marginBottom: "var(--s-4)" }}>
          <p style={{ margin: 0, fontWeight: 700 }}>
            A direction, not a decision. Nothing here is signed.
          </p>
          <p style={{ margin: "var(--s-2) 0 0" }} className="pv-mono">
            {direction.name} · {meta.title} · {meta.spec}
          </p>
          <p style={{ margin: "var(--s-1) 0 0" }} className="pv-mono">
            primary action: {PRIMARY_ACTION[screen]}
          </p>
          <p style={{ margin: "var(--s-1) 0 0" }} className="pv-mono">
            proposed, not registered: {direction.newComponents.join(" · ")}
          </p>
          <p style={{ margin: "var(--s-1) 0 0" }} className="pv-mono">
            new tokens:{" "}
            {direction.newTokens.length === 0
              ? "none"
              : direction.newTokens.map((t) => `${t.name} = ${t.value}`).join(" · ")}
          </p>
        </div>

        <div className="pv-note">
          <p style={{ margin: 0 }} className="pv-mono">
            this screen, other directions:
          </p>
          <div className="pv-nav" style={{ marginTop: "var(--s-2)" }}>
            {DIRECTIONS.map((d) => (
              <Link
                key={d.id}
                href={`/directions/${d.id}/${screen}`}
                className="pv-link"
                data-current={d.id === direction.id ? "true" : "false"}
              >
                {d.id}
              </Link>
            ))}
          </div>
          <p style={{ margin: "var(--s-3) 0 0" }} className="pv-mono">
            this direction, other screen:{" "}
            <Link href={`/directions/${direction.id}/${other}`} className="pv-link">
              {other}
            </Link>{" "}
            · the baseline it is judged against:{" "}
            <Link href={BASELINE[screen]} className="pv-link">
              {BASELINE[screen]}
            </Link>{" "}
            ·{" "}
            <Link href="/directions" className="pv-link">
              back to the five
            </Link>
          </p>
          <div style={{ marginTop: "var(--s-3)" }}>
            {screen === "report" ? (
              <StateBar
                states={[...REPORT_VIEWS]}
                value={reportView}
                onChange={(v) => setReportView(v as ReportView)}
              />
            ) : (
              <StateBar
                states={[...OVERVIEW_VIEWS]}
                value={overviewView}
                onChange={(v) => setOverviewView(v as OverviewView)}
              />
            )}
          </div>
        </div>
      </div>

      {/* The specimen, full width. Everything inside it is product tokens;
          everything outside it is --pv-* and is not being judged. */}
      {specimen}

      <div className="pv-wrap" style={{ paddingTop: "var(--s-5)" }}>
        <h2 className="pv-h2">What this direction argues</h2>
        <P>{direction.archetype}</P>
        <table className="pv-table">
          <tbody>
            <tr>
              <th>unit of content</th>
              <td>{direction.unit}</td>
            </tr>
            <tr>
              <th>the comparison</th>
              <td>{direction.comparison}</td>
            </tr>
            <tr>
              <th>state &amp; band</th>
              <td>{direction.stateChannel}</td>
            </tr>
            <tr>
              <th>chrome</th>
              <td>{direction.chrome}</td>
            </tr>
            <tr>
              <th>typography</th>
              <td>{direction.typography}</td>
            </tr>
            <tr>
              <th>good at</th>
              <td>{direction.goodAt}</td>
            </tr>
            <tr>
              <th>bad at</th>
              <td>{direction.badAt}</td>
            </tr>
          </tbody>
        </table>

        <Note>
          <p style={{ margin: 0 }}>
            <strong>The state selector is not decoration.</strong> Rule 7.3 asks every data view
            for loading, empty and error, and an aesthetic that only survives the happy path has
            not been reviewed. On the workspace, switch to <Mono>empty-queue</Mono>: §2.5 says an
            empty queue is a success state, and a direction that quietly turned it into a failure
            is the trap. On the report, switch to <Mono>degraded</Mono>: the section goes absent
            with one written line, and in the directions that removed the card frame that line is
            carrying the whole state on its own.
          </p>
        </Note>

        <P>
          Every string on this screen comes from <Mono>src/mock/data.ts</Mono> through{" "}
          <Mono>src/app/directions/fixture.ts</Mono>, and every number in every direction is the
          same number. The outstanding customer-visible strings are still outstanding and still
          render as their bracketed labels — an exploration of form is not an occasion to write
          copy.
        </P>
      </div>
    </>
  );
}

function renderSpecimen(
  id: string,
  screen: ScreenId,
  reportView: ReportView,
  overviewView: OverviewView,
) {
  if (screen === "report") {
    switch (id) {
      case "ledger":
        return <LedgerReport view={reportView} />;
      case "console":
        return <ConsoleReport view={reportView} />;
      case "ranked":
        return <RankedReport view={reportView} />;
      case "split":
        return <SplitReport view={reportView} />;
      default:
        return <NarrativeReport view={reportView} />;
    }
  }
  switch (id) {
    case "ledger":
      return <LedgerOverview view={overviewView} />;
    case "console":
      return <ConsoleOverview view={overviewView} />;
    case "ranked":
      return <RankedOverview view={overviewView} />;
    case "split":
      return <SplitOverview view={overviewView} />;
    default:
      return <NarrativeOverview view={overviewView} />;
  }
}
