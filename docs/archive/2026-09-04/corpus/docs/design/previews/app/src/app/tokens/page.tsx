import { Num } from "@/components/Num";
import { ColourSwatch, ValueRow } from "@/components/chrome/TokenReadout";
import { Flag, Mono, Note, P, Pre, ScrollX, Section, SheetHead, SpecTable, Stage, Stop, Sub } from "@/components/chrome/sheet";

const SURFACES: readonly [string, string][] = [
  ["--bg", "Page background"],
  ["--surface", "Card and panel surface · daisyUI base-100"],
  ["--sunk", "Recessed surface · base-200"],
  ["--line", "Borders and rules · base-300"],
  ["--ink", "Primary text · base-content"],
  ["--ink-2", "Secondary text"],
  ["--ink-3", "Provenance and eyebrow — always quiet"],
];

const ACCENT: readonly [string, string][] = [
  ["--accent", "The customer's own colour · primary"],
  ["--on-accent", "Text on an accent fill"],
  ["--accent-bg", "Accent-tinted fill"],
  ["--accent-line", "Accent-tinted border"],
];

const STATE: readonly [string, string][] = [
  ["--ok", "daisyUI success"],
  ["--ok-bg", "Success fill"],
  ["--ok-line", "Success border"],
  ["--warn", "daisyUI warning"],
  ["--warn-bg", "Warning fill"],
  ["--warn-line", "Warning border"],
  ["--bad", "daisyUI error"],
  ["--bad-bg", "Error fill"],
  ["--bad-line", "Error border"],
];

const SERIES: readonly [string, string][] = [
  ["--chart-you", "The customer's series. Always the customer, never a rival"],
  ["--chart-rival", "Every rival series. Neutral gray, never red"],
  ["--chart-goal", "The goal marker — dashed goal dots, the goal footnote"],
];

const THEMING_CSS = `:root {            /* light */
  --bg:#f6f6f9; --surface:#ffffff; ... }

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { ... }   /* system dark */
}

:root[data-theme="dark"] { ... }            /* the explicit toggle */

/* "Never define a color only inside a dark block." */`;

export default function TokensPage() {
  return (
    <main className="pv-wrap">
      <SheetHead
        title="Token specimen — live"
        carries="WO-029 (theme tokens) + WO-030 (fonts, type scale, numeral rule) · both unsigned"
      >
        <P>
          Every value below is read back out of the running document rather than restated here
          (rule 2.4 — <Mono>globals.css</Mono> is the one home). Move the theme control in the bar
          above and the printed values change with the swatches, because they are the same fact.
        </P>
      </SheetHead>

      <Section n="1" title="Three-state theming">
        <P>
          <Mono>BUILD.md</Mono> §2.1 fixes three states, and this app ships all three. The chrome
          control has three positions for exactly that reason: <strong>system</strong> removes the{" "}
          <Mono>data-theme</Mono> attribute entirely, which is the only way to exercise the
          media-guarded branch. A two-position toggle leaves that branch untested, and the HTML
          sheets — which scoped both themes into side-by-side panes — never exercised it at all.
        </P>
        <Pre>{THEMING_CSS}</Pre>
        <Note>
          <p style={{ margin: 0 }}>
            The dark-only rule is structurally held: the light block declares every token, and the
            two dark blocks declare the identical list. A token defined only in dark is visible as
            a diff in one file.
          </p>
        </Note>
      </Section>

      <Section n="2" title="Colour">
        <Sub title="Surfaces and ink" />
        <div className="pv-swatches">
          {SURFACES.map(([n, u]) => (
            <ColourSwatch key={n} name={n} used={u} />
          ))}
        </div>
        <Sub title="Accent" />
        <div className="pv-swatches">
          {ACCENT.map(([n, u]) => (
            <ColourSwatch key={n} name={n} used={u} />
          ))}
        </div>
        <Sub title="State — ok / warn / bad" />
        <P>
          Tone is for <strong>state</strong>. §2.4: status colours are for state, never for series.
          §2.5: red appears only for the customer&rsquo;s problem being shown to them. The six dark{" "}
          <Mono>-bg</Mono>/<Mono>-line</Mono> values are derived at §2.1&rsquo;s own stated rule —
          12%/28% alpha on the three dark hues — and never carried over from light. Switch to dark
          and read them off.
        </P>
        <div className="pv-swatches">
          {STATE.map(([n, u]) => (
            <ColourSwatch key={n} name={n} used={u} />
          ))}
        </div>
        <Sub title="Series — the only two chart colours" />
        <P>
          A third series colour does not exist. A rival never takes <Mono>--bad</Mono>,{" "}
          <Mono>--warn</Mono> or <Mono>--ok</Mono>: a rival is context, not an alarm. In this app
          that is not a note — <Mono>PresenceBars</Mono> and <Mono>RivalSparkline</Mono> accept no
          tone prop at all, so the type system has no member to break the rule with.
        </P>
        <div className="pv-swatches">
          {SERIES.map(([n, u]) => (
            <ColourSwatch key={n} name={n} used={u} />
          ))}
        </div>
      </Section>

      <Section n="3" title="Radius, shadow, ring, spacing">
        <ScrollX>
        <table className="pv-table">
          <thead>
            <tr>
              <th>Token</th>
              <th>Resolved now</th>
              <th>Used for</th>
            </tr>
          </thead>
          <tbody>
            <ValueRow name="--r-box" used="Cards, panels, the day panel" />
            <ValueRow name="--r-field" used="Inputs, buttons, chips" />
            <ValueRow name="--r-pill" used="Badges, verdict chips, stage chips" />
            <ValueRow name="--shadow-card" used="Card elevation" />
            <ValueRow name="--ring-accent" used="Focus ring; today's ringed cell" />
            <ValueRow name="--border-hair" used="Every rule, card edge, cell border and input outline" />
          </tbody>
        </table>
        </ScrollX>
        <Stage label="the two ruled values, at size — switch themes to judge them">
          <div className="row-3">
            <div className="rk-card" style={{ padding: "var(--s-4)", maxWidth: "var(--w-day-panel)" }}>
              <p className="eb">--shadow-card</p>
              <p className="explain">
                The light geometry re-inked at a second alpha. Ruled 2026-09-02, not derived.
              </p>
            </div>
            <div
              className="rk-card"
              style={{ padding: "var(--s-4)", boxShadow: "var(--ring-accent)", borderColor: "var(--accent-line)" }}
            >
              <p className="eb">--ring-accent</p>
              <p className="explain">The light construction on the dark accent. Ruled, not derived.</p>
            </div>
          </div>
        </Stage>
        <Sub title="Spacing — seven steps on a 4px base, ruled 2026-09-02" />
        <Stage label="the scale, drawn">
          <div className="stack-2">
            {["--s-1", "--s-2", "--s-3", "--s-4", "--s-5", "--s-6", "--s-7"].map((s) => (
              <div className="row" key={s}>
                <span className="prov" style={{ minWidth: "var(--s-7)" }}>
                  {s}
                </span>
                <span style={{ height: "var(--s-2)", width: `var(${s})`, background: "var(--accent)", borderRadius: "var(--r-pill)" }} />
              </div>
            ))}
          </div>
        </Stage>
        <Note>
          <p style={{ margin: 0 }}>
            The cost the owner accepted, recorded so it is not re-litigated: seven steps is more
            choices per layout than a six- or eight-step scale, and nothing in the scale stops two
            adjacent surfaces picking differently. <strong>The preview gate holds that line, not
            the scale.</strong> This app is where an inconsistent rhythm is visible — scroll two
            walkthroughs side by side and it shows.
          </p>
        </Note>
      </Section>

      <Section n="4" title="Type roles — WO-030, at the real letterforms">
        <P>
          This is the part the offline HTML sheets could not do. They fell back to the system
          stack and said so; here Plus Jakarta Sans and JetBrains Mono are the real self-hosted{" "}
          <Mono>@fontsource</Mono> faces, which is what BP-004 will render from a customer&rsquo;s
          own domain. Heading weight 800, tracking −0.02em, <Mono>text-wrap: balance</Mono>.
        </P>
        <Stage label="the heading scale — ratio 1.25 from the 15px body, ruled 2026-09-02">
          <div className="stack-3">
            <p className="rk-h1">[screen head — owner&rsquo;s]</p>
            <p className="rk-h2">[module head — owner&rsquo;s]</p>
            <p className="rk-h3">[card head — owner&rsquo;s]</p>
            <p className="rk-h4">[sub-head — owner&rsquo;s]</p>
            <p>[body at 15px / 1.55 — owner&rsquo;s]</p>
            <p className="eb">eyebrow · uppercase · 11px</p>
            <p className="explain">
              [explanatory line under a card&rsquo;s answer — 11.5px, dim, one sentence]
            </p>
            <p className="prov">[measured · date] · [from: search · vol/mo]</p>
          </div>
        </Stage>
        <Note>
          <p style={{ margin: 0 }}>
            <Mono>--t-h4</Mono> is 16px — deliberately 1px off the 15px body. At h4 15 the two are
            indistinguishable. On a real font at a real viewport you can now check that claim
            instead of taking it.
          </p>
        </Note>
        <Sub title="The big mono number — §2.5's card answer" />
        <Stage label="--t-num-big, always through the numeral utility">
          <div className="row" style={{ alignItems: "baseline" }}>
            <span className="rk-num-big">
              <Num>62</Num>
            </span>
            <span className="badge tone-ok">
              <Num>▲ 8</Num>
            </span>
            <span className="badge tone-neutral">[band]</span>
          </div>
        </Stage>
      </Section>

      <Section n="5" title="The numeral rule — mechanical, not a convention">
        <P>
          §2.3: every numeral, date, URL, search query and code-like string is JetBrains Mono with{" "}
          <Mono>tabular-nums</Mono>. One utility applies both together and a component cannot apply
          one without the other: <Mono>src/components/Num.tsx</Mono> is the only thing in the app
          that emits the <Mono>num</Mono> class, and <Mono>num</Mono> is the only rule in the
          stylesheet that puts <Mono>--font-mono</Mono> on running text.
        </P>
        <Stage label="the same column, through the utility and around it">
          <div className="row-3" style={{ alignItems: "flex-start" }}>
            <div className="stack-1">
              <p className="eb">through &lt;Num&gt; — correct</p>
              {["1,900", "128", "62", "2,400"].map((n) => (
                <p key={n} style={{ margin: 0, textAlign: "right", width: "var(--s-7)" }}>
                  <Num>{n}</Num>
                </p>
              ))}
            </div>
            <div className="stack-1">
              <p className="eb" style={{ color: "var(--bad)" }}>
                UI font — a defect
              </p>
              {["1,900", "128", "62", "2,400"].map((n) => (
                <p key={n} style={{ margin: 0, textAlign: "right", width: "var(--s-7)" }}>
                  {n}
                </p>
              ))}
            </div>
          </div>
        </Stage>
        <P>
          The right column is the defect, drawn on purpose: the figures do not line up. On a
          specimen without the real font this comparison is meaningless, which is why it is here
          and not on the sheet.
        </P>
        <Note>
          <p style={{ margin: 0 }}>
            <strong>No emoji anywhere in the product</strong> — not in a component, not in copy,
            not in a chart label. Nothing in <Mono>src/</Mono> contains one. The two icons this app
            uses in its own chrome are lucide-react, at 2px stroke, and are chrome, not product.
          </p>
        </Note>
      </Section>

      <Section n="6" title="Chart bounds — ranges, held as ranges">
        <P>
          §2.4 states bounds, not single values, and they are law as bounds. A chart asserts against
          the bound, not against a token name.
        </P>
        <SpecTable
          head={["Constraint", "Value"]}
          rows={[
            ["Series colours", "exactly two: --chart-you, --chart-rival"],
            ["Axes", "one per chart"],
            ["Line weight", "2–2.5px"],
            ["Endpoint dot", "3.5–5px, with a --surface ring"],
            ["Gridlines", "faint, at 2–3 values"],
            ["Tooltip", "on every mark; fixed-position, ink-on-bg, mono"],
            ["Labelling", "every bar and point direct-labelled; no legend-only mode"],
            ["Implementation", "inline SVG, hand-sized viewBoxes. No chart library"],
            ["Inventory", "closed at five. A sixth form is a design-artifact approval first"],
          ]}
        />
        <Note>
          <p style={{ margin: 0 }}>
            A number inside a <Mono>viewBox</Mono> is coordinate space, not a design value —{" "}
            <Mono>tokens.md</Mono> §7 states that exemption. Every stroke, fill and font in{" "}
            <Mono>charts.tsx</Mono> is still a named token; see <Mono>/charts</Mono>.
          </p>
        </Note>
      </Section>

      <Section n="7" title="Derived under rule 1.1 — the owner's 2026-09-02 ruling, made buildable">
        <P>
          The owner ruled two things on 2026-09-02: <strong>nothing is clipped and everything has
          buffer at its edges</strong>, and <strong>the whole system works at every screen size,
          including mobile</strong>. Neither was enforceable, because the design system named no
          breakpoint, no type floor, no cell floor and no border width. These nine are the
          design-guardian&rsquo;s own parameters (rule 1.1) — chosen, derived and reversible —
          and they are <em>not</em> the four values the owner ruled, which stay in §3 and §4
          above. <Mono>tokens.md</Mono> §2b carries each derivation and its reversal cost.
        </P>
        <SpecTable
          head={["Token", "Value", "Derivation"]}
          rows={[
            ["--breakpoint-sm", "640px", "two-up fits: 2 × 290 + --s-5 + 2 × --s-4 = 636"],
            ["--breakpoint-md", "768px", "a 7-across grid reaches --w-cell-min: 7 × 96 + 6 × --s-1 + 2 × --s-4 = 728"],
            ["--breakpoint-lg", "1024px", "the sidebar returns: --w-sidebar 222 + 2 × --s-5 + the 696 grid = 966"],
            ["--breakpoint-xl", "1280px", "the day panel sits BESIDE the grid (§4.6): 222 + 48 + 696 + --s-4 + 290 = 1272"],
            ["--t-floor", "11px", "§2.3's own smallest named role. No text in the product goes under it"],
            ["--w-cell-min", "96px", "a date + the widest stage chip + one line of label at the floor, with --s-2 either side"],
            ["--w-spark-min", "120px", "the sparkline's hand-sized plot, as a rendered floor — below it the endpoint dot scales under §2.4's 3.5–5px"],
            ["--border-hair", "1px", "the value already spent about twenty times, named rather than changed"],
            ["--w-read / --w-wide", "704px / 1216px", "one construction: the breakpoint above the content, less 2 × --s-6"],
          ]}
        />
        <Note>
          <p style={{ margin: 0 }}>
            <strong>The breakpoints are Tailwind&rsquo;s own steps and that is deliberate.</strong>{" "}
            Each value above is the smallest Tailwind step that clears an obligation derived from
            the fixed dimensions BUILD §4 states. They are declared in this app&rsquo;s{" "}
            <Mono>@theme</Mono> block and nowhere else, so <Mono>lg:hidden</Mono> and{" "}
            <Mono>var(--breakpoint-lg)</Mono> resolve from one declaration — a token that
            disagreed with the utility class beside it would be two homes for one fact. A media
            query cannot read a <Mono>var()</Mono>, so the literal inside an{" "}
            <Mono>@media</Mono> prelude is the one raw value this stylesheet still admits, and it
            must equal a token named here.
          </p>
        </Note>
        <Sub title="Still proposed — released by a signature, not by this section" />
        <P>
          Three tokens stay <Mono>proposed</Mono>. Their <em>values</em> are BUILD §4&rsquo;s and
          only their names are the system&rsquo;s, so what releases them is WO-033&rsquo;s
          signature — not a derivation. Every screen that spends one still carries a visible{" "}
          <Flag>proposed</Flag> mark.
        </P>
        <SpecTable
          head={["Token", "Value", "Standing"]}
          rows={[
            ["--w-sidebar", "222px", "value transcribed from BUILD §4.4; the name is the system's"],
            ["--w-day-panel", "290px", "value transcribed from BUILD §4.6; the name is the system's"],
            ["--grid-week", "repeat(7, minmax(0, 1fr))", "the minmax is load-bearing (§4.6)"],
          ]}
        />
        <Note>
          <p style={{ margin: 0 }}>
            <Mono>--t-sm</Mono> 13px and <Mono>--t-xs</Mono> 12px are no longer among them. They
            were derived, never transcribed, and the owner&rsquo;s ruling landed on exactly the
            text they size — the <Mono>was 276×</Mono> badge. They are law under rule 1.1 and
            carry no <Flag>proposed</Flag> mark anywhere in this app any more.
          </p>
        </Note>
        <Stop>
          <p style={{ margin: 0 }}>
            <strong>What is still open, and is not invented shut here.</strong> The reflows these
            breakpoints carry are <em>proposed</em>, not derived: BUILD §4.6 fixes the calendar as
            a seven-column grid and the day panel as 290px beside it, and says nothing about a
            viewport too narrow for either. Below <Mono>--breakpoint-md</Mono> the month and the
            week strip become seven rows; below <Mono>--breakpoint-xl</Mono> the day panel follows
            the grid full-width, still not a drawer. <strong>Those three need the surface
            blueprint&rsquo;s word.</strong> Token delivery into email (WO-101/103) is untouched
            and remains a build-path question outside <Mono>design/</Mono>.
          </p>
        </Stop>
      </Section>

      <Section n="8" title="daisyUI 5 slot mapping">
        <P>
          §2.1: map the tokens onto daisyUI&rsquo;s theme slots &ldquo;so stock daisyUI classes just
          work&rdquo;. Every slot here carries a <em>variable reference</em>, never a literal — a
          slot holding a literal colour is a second home for a value that already has one.
        </P>
        <SpecTable
          head={["daisyUI slot", "Token"]}
          rows={[
            ["--color-base-100", "var(--surface)"],
            ["--color-base-200", "var(--sunk)"],
            ["--color-base-300", "var(--line)"],
            ["--color-base-content", "var(--ink)"],
            ["--color-primary", "var(--accent)"],
            ["--color-primary-content", "var(--on-accent)"],
            ["--color-success", "var(--ok)"],
            ["--color-warning", "var(--warn)"],
            ["--color-error", "var(--bad)"],
            ["--radius-box", "var(--r-box)"],
            ["--radius-field", "var(--r-field)"],
            ["--radius-selector", "var(--r-pill)"],
          ]}
        />
        <Note>
          <p style={{ margin: 0 }}>
            <Mono>tokens.md</Mono> §3 names eight slots. Three more are mapped here as internal
            names (rule 1.1): <Mono>--color-primary-content</Mono> ← <Mono>--on-accent</Mono>, whose
            job §2.1 already states, and the two radius aliases daisyUI 5 reads. The mapping is in
            one CSS block and reverses in one edit.
          </p>
        </Note>
      </Section>
    </main>
  );
}
