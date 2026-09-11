"use client";

/**
 * /variants/<preset>/overview and /variants/<preset>/report.
 *
 * One file, two screens, six presets. The preset is a tuple of positions
 * and nothing else — there is no per-preset markup anywhere in this app,
 * which is the property that makes a preset composable rather than a
 * drawing someone would have to redraw.
 */
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { StateBar } from "@/components/chrome/WalkBanner";
import { Mono, Note, P } from "@/components/chrome/sheet";
import { PRESETS, getPreset } from "../../axes";
import { VariantBanner, VariantScope } from "../../VariantScope";
import { OVERVIEW_VIEWS, OverviewContent, type OverviewView } from "../../screens/OverviewContent";
import { REPORT_VIEWS, ReportContent, type ReportView } from "../../screens/ReportContent";

export default function VariantScreen() {
  const params = useParams<{ preset: string; screen: string }>();
  const presetId = typeof params.preset === "string" ? params.preset : "";
  const screen = typeof params.screen === "string" ? params.screen : "";
  const preset = getPreset(presetId);

  const [overviewView, setOverviewView] = useState<OverviewView>("measured");
  const [reportView, setReportView] = useState<ReportView>("report");

  if (!preset || (screen !== "overview" && screen !== "report")) {
    return (
      <main className="pv-wrap">
        <div className="pv-stop">
          <p style={{ margin: 0, fontWeight: 700 }}>No such variant screen.</p>
          <p style={{ margin: "var(--s-2) 0 0" }}>
            The presets are {PRESETS.map((p) => p.id).join(" · ")}, and the two screens are{" "}
            <Mono>overview</Mono> and <Mono>report</Mono>.{" "}
            <Link href="/variants" className="pv-mono">/variants</Link>
          </p>
        </div>
      </main>
    );
  }

  const other = screen === "overview" ? "report" : "overview";

  return (
    <main className="pv-wrap">
      <VariantBanner id={preset.id} intent={preset.intent} tuple={preset.tuple} />

      {/* Jump strip — the same screen under every preset is one click away,
          which is the only way an aesthetic judgement is actually made. */}
      <div className="pv-note">
        <p style={{ margin: 0 }} className="pv-mono">
          this screen, other presets:
        </p>
        <div className="pv-axis-head" style={{ marginTop: "var(--s-2)" }}>
          {PRESETS.map((p) => (
            <Link
              key={p.id}
              href={`/variants/${p.id}/${screen}`}
              className="pv-link"
              data-current={p.id === preset.id ? "true" : "false"}
            >
              {p.id}
            </Link>
          ))}
        </div>
        <p style={{ margin: "var(--s-3) 0 0" }} className="pv-mono">
          this preset, other screen:{" "}
          <Link href={`/variants/${preset.id}/${other}`} className="pv-link">
            {other}
          </Link>{" "}
          · baseline it is compared against:{" "}
          <Link href={screen === "overview" ? "/walk/app/overview" : "/walk/report"} className="pv-link">
            {screen === "overview" ? "/walk/app/overview" : "/walk/report"}
          </Link>{" "}
          · <Link href="/variants" className="pv-link">back to the axes</Link>
        </p>
        <div style={{ marginTop: "var(--s-3)" }}>
          {screen === "overview" ? (
            <StateBar
              states={[...OVERVIEW_VIEWS]}
              value={overviewView}
              onChange={(s) => setOverviewView(s as OverviewView)}
            />
          ) : (
            <StateBar
              states={[...REPORT_VIEWS]}
              value={reportView}
              onChange={(s) => setReportView(s as ReportView)}
            />
          )}
        </div>
      </div>

      <VariantScope tuple={preset.tuple}>
        {screen === "overview" ? (
          <OverviewContent view={overviewView} />
        ) : (
          <ReportContent view={reportView} />
        )}
      </VariantScope>

      <Note>
        <p style={{ margin: 0 }}>
          <strong>The state selector is not decoration.</strong>{" "}
          {screen === "overview" ? (
            <>
              Switch to <Mono>empty-queue</Mono> under any preset: §2.5 says an empty queue is a
              success state, and a &quot;cleaner&quot; token set that quietly made it read as a
              failure is the exact trap. It stays green in every position on this page — and under{" "}
              <Mono>mono</Mono> it is green <em>ink</em> with no fill, which is the version worth
              staring at. <Mono>failed</Mono> and <Mono>domain-changed</Mono> are the other two:
              a failed measurement takes <Mono>warn</Mono>, never <Mono>bad</Mono>, and the gapped
              rival rows still carry no delta badge.
            </>
          ) : (
            <>
              Switch to <Mono>degraded</Mono> under <Mono>open</Mono>: the section goes absent with
              one written line, and with no card frame left the line is carrying the whole state on
              its own. That is the cost of whitespace-only separation, seen rather than described.{" "}
              <Mono>scanning</Mono> shows named stages and no bare spinner in every position.
            </>
          )}
        </p>
      </Note>

      <P>
        Every string on this screen is <Mono>src/mock/data.ts</Mono>&rsquo;s. The six outstanding
        customer-visible strings are still outstanding and still render as their bracketed labels —
        an exploration of the aesthetic is not an occasion to write copy.
      </P>
    </main>
  );
}
