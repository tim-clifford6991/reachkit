import Link from "next/link";
import { Mono, Note, P, ScrollX, SheetHead, Stop } from "@/components/chrome/sheet";
import { DIRECTIONS, SCREENS, SCREEN_META } from "./catalog";
import { RECORDED_GAPS } from "./fixture";

/**
 * /directions — the index.
 *
 * Its one job is to let the report be seen in all five directions back to
 * back, and then the workspace in all five. The matrix below is that: a row
 * per direction, a column per screen, and the same-screen jump strip
 * repeated on every specimen route so the comparison never costs a return
 * trip here.
 */
export default function DirectionsIndex() {
  return (
    <main className="pv-wrap">
      <SheetHead
        title="Five design directions"
        carries="preview artifact · exploration · not production code · nothing here is signed"
      >
        <P>
          Five component vocabularies rendering one fixture. Each is its own implementation — a
          different page archetype, a different unit of content, a different technique for the
          same rival comparison, a different channel carrying state, different chrome, a different
          typographic strategy. Two of them are far enough apart that a reader could not tell they
          render the same data without being told.
        </P>
      </SheetHead>

      <Stop>
        <p style={{ margin: 0, fontWeight: 700 }}>Nothing here is signed, and nothing is chosen.</p>
        <p style={{ margin: "var(--s-2) 0 0" }}>
          Every component invented for these five is <Mono>proposed</Mono> and none of them may be
          named by production UI code before the owner&rsquo;s word (duty 3). Four of the five need
          a chart form <Mono>BUILD §2.4</Mono> does not admit, and its inventory is closed at five
          with &ldquo;a new chart form is a design-artifact approval first&rdquo;. Three of them
          need a value the ruled token set does not provide. Every one of those costs is on the
          direction&rsquo;s own row below and on its own screen.
        </p>
      </Stop>

      <Note>
        <p style={{ margin: 0 }}>
          <strong>
            <Mono>/variants</Mono> is left standing and is not superseded.
          </strong>{" "}
          It is the record of what was drawn: seven axes over one JSX tree, where the only thing a
          preset can change is which token a surface picks. That is a good composition mechanism
          and the wrong exploration mechanism — minimal change was structurally guaranteed by it.
          This subtree is the other half, and neither replaces the other. The four specimen sheets
          and the five walkthroughs are also untouched; the walkthroughs are the baseline every
          direction is judged against, and each specimen route links to its own.
        </p>
      </Note>

      <h2 className="pv-h2">The matrix — the same screen, five ways</h2>
      <P>
        Read a column, not a row: the report in all five, then the workspace in all five. Each
        specimen route repeats this strip at the top, so moving between directions on one screen
        never costs a return trip here.
      </P>
      <ScrollX>
        <table className="pv-table">
          <thead>
            <tr>
              <th>direction</th>
              {SCREENS.map((s) => (
                <th key={s}>
                  {SCREEN_META[s].title}
                  <br />
                  <span style={{ fontWeight: 400, textTransform: "none" }}>
                    {SCREEN_META[s].who}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DIRECTIONS.map((d) => (
              <tr key={d.id}>
                <td className="m">
                  <strong>{d.id}</strong>
                  <br />
                  <span style={{ color: "var(--pv-dim)" }}>{d.name}</span>
                </td>
                {SCREENS.map((s) => (
                  <td key={s}>
                    <Link href={`/directions/${d.id}/${s}`} className="pv-mono">
                      /directions/{d.id}/{s}
                    </Link>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollX>

      <h2 className="pv-h2">What each one argues</h2>
      {DIRECTIONS.map((d) => (
        <div className="pv-stage" key={d.id}>
          <p className="pv-stage-label">
            {d.id} — {d.name}
          </p>
          <P>{d.archetype}</P>
          <ScrollX>
            <table className="pv-table">
              <tbody>
                <tr>
                  <th>unit</th>
                  <td>{d.unit}</td>
                </tr>
                <tr>
                  <th>comparison</th>
                  <td>{d.comparison}</td>
                </tr>
                <tr>
                  <th>state &amp; band</th>
                  <td>{d.stateChannel}</td>
                </tr>
                <tr>
                  <th>chrome</th>
                  <td>{d.chrome}</td>
                </tr>
                <tr>
                  <th>typography</th>
                  <td>{d.typography}</td>
                </tr>
                <tr>
                  <th>good at</th>
                  <td>{d.goodAt}</td>
                </tr>
                <tr>
                  <th>bad at</th>
                  <td>{d.badAt}</td>
                </tr>
              </tbody>
            </table>
          </ScrollX>
          <p className="pv-p" style={{ margin: "var(--s-2) 0 0" }}>
            <Link href={`/directions/${d.id}/report`} className="pv-mono">
              report
            </Link>{" "}
            ·{" "}
            <Link href={`/directions/${d.id}/overview`} className="pv-mono">
              overview
            </Link>
          </p>
        </div>
      ))}

      <h2 className="pv-h2">What each one costs</h2>
      <P>
        A direction that needs eleven new tokens is a more expensive direction, and the owner
        should be told that while choosing. These counts are honest: a value composed from ruled
        tokens is not counted, and a value that cannot be reached from them is.
      </P>
      <ScrollX>
        <table className="pv-table">
          <thead>
            <tr>
              <th>direction</th>
              <th>new tokens</th>
              <th>proposed components</th>
              <th>what would have to change</th>
            </tr>
          </thead>
          <tbody>
            {DIRECTIONS.map((d) => (
              <tr key={d.id}>
                <td className="m">{d.id}</td>
                <td>
                  {d.newTokens.length === 0 ? (
                    <em>none</em>
                  ) : (
                    <ul style={{ margin: 0, paddingLeft: "var(--s-4)" }}>
                      {d.newTokens.map((t) => (
                        <li key={t.name}>
                          <code className="pv-mono">
                            {t.name}: {t.value}
                          </code>{" "}
                          — {t.why}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td>
                  <span className="pv-mono">{d.newComponents.length}</span> —{" "}
                  {d.newComponents.join(", ")}
                </td>
                <td>
                  <ul style={{ margin: 0, paddingLeft: "var(--s-4)" }}>
                    {d.wouldChange.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollX>

      <h2 className="pv-h2">Strings this exploration ran into and did not write</h2>
      <P>
        Where a direction needed a customer-visible string nothing approved provides, it reused an
        existing one and the gap is recorded here. Two bracketed placeholders were added — both
        for the console direction&rsquo;s command field — and they are holes, not copy.
      </P>
      <ScrollX>
        <table className="pv-table">
          <thead>
            <tr>
              <th>where</th>
              <th>what was needed</th>
              <th>what was spent instead</th>
            </tr>
          </thead>
          <tbody>
            {RECORDED_GAPS.map((g) => (
              <tr key={g.where}>
                <td className="m">{g.where}</td>
                <td>{g.needed}</td>
                <td>{g.spent}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollX>

      <h2 className="pv-h2">What is held in all five</h2>
      <ScrollX>
        <table className="pv-table">
          <tbody>
            <tr>
              <th>the data</th>
              <td>
                One fixture, <Mono>src/app/directions/fixture.ts</Mono>, which adds no data and
                derives three things from <Mono>src/mock/data.ts</Mono>. If two directions
                disagreed about a number the comparison would be worthless, so they cannot: there
                is one join and every direction imports it.
              </td>
            </tr>
            <tr>
              <th>the type floor</th>
              <td>
                Nothing renders below <Mono>--t-floor</Mono> at any width in any direction.
              </td>
            </tr>
            <tr>
              <th>two series colours</th>
              <td>
                §2.4 closes the palette at <Mono>--chart-you</Mono> and <Mono>--chart-rival</Mono>.
                Four directions introduce a new chart FORM; none introduces a third series colour,
                and no rival is ever red.
              </td>
            </tr>
            <tr>
              <th>the meaning rules</th>
              <td>
                §2.5: an intended-empty state never takes bad or warn — check{" "}
                <Mono>empty-queue</Mono> in all five. A failed measurement takes warn, never bad.
                Red appears only where the customer&rsquo;s own problem is being shown to them.
              </td>
            </tr>
            <tr>
              <th>ADR-093</th>
              <td>
                Mobile first, every <Mono>@media</Mono> a min-width at a named breakpoint, every
                band a min-height and never a height. Two shapes have a designed narrow form
                rather than a reduced one: the board becomes labelled blocks, and the slope chart
                becomes a list.
              </td>
            </tr>
            <tr>
              <th>one primary action</th>
              <td>
                The same action is primary on a screen in every direction — a direction changes
                where it sits, never which one it is. Each specimen route names it at the top so
                it is checkable by looking.
              </td>
            </tr>
          </tbody>
        </table>
      </ScrollX>
    </main>
  );
}
