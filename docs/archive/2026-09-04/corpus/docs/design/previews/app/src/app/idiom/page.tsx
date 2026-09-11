import Link from "next/link";
import { Mono, Note, P, ScrollX, SheetHead, Stop } from "@/components/chrome/sheet";
import { IDIOM_ROUTES, OWED_STRINGS, PROPOSED_TOKENS, RAISED, REGISTRY_MOVES } from "./ledger";

/**
 * /idiom — the index for the approved card idiom.
 *
 * The owner approved an idiom on 2026-09-02 ("A · Six boxes"). This route's
 * one job is to say what that costs: which values it spends that nobody
 * ruled, which registry rows it moves, which strings it owes, and which
 * questions it raises rather than answers.
 */
export default function IdiomIndex() {
  return (
    <main className="pv-wrap">
      <SheetHead
        title="The approved card idiom"
        carries="preview artifact · design-system skill step 2 · not production code"
      >
        <P>
          Three screens in one idiom, as live code: the workspace overview drawn as{" "}
          <strong>Take A &mdash; six boxes</strong>, the sign-in screen, and the landing page. The
          idiom held constant across the three card-density takes and is what the owner endorsed;
          the modules, their order and every approved string are unchanged.
        </P>
      </SheetHead>

      <Stop>
        <p style={{ margin: 0, fontWeight: 700 }}>
          An approved idiom is not a signed preview, and nothing here is signed.
        </p>
        <p style={{ margin: "var(--s-2) 0 0" }}>
          Every row in <Mono>components.md</Mono> is still <Mono>proposed</Mono>, no{" "}
          <Mono>Signed-off:</Mono> date exists, and this route creates none. Six values are
          proposed and spent on these screens; two of them are the two the owner explicitly did
          not rule. Preview sign-off is the owner&rsquo;s (rule 7.3, step 3).
        </p>
      </Stop>

      <h2 className="pv-h2">The idiom, as it was endorsed</h2>
      <ScrollX>
        <table className="pv-table">
          <tbody>
            <tr>
              <th>ground and separation</th>
              <td>
                Soft grey <Mono>--bg</Mono>, white <Mono>--surface</Mono> cards separated by{" "}
                <strong>shadow, never a border</strong>. That first clause is the whole reason{" "}
                <Mono>--shadow-lift</Mono> exists: <Mono>--shadow-card</Mono> is a 1px hairline and
                cannot carry an edge once the border is gone.
              </td>
            </tr>
            <tr>
              <th>card head</th>
              <td>
                A rounded-square icon chip in <Mono>--accent-bg</Mono>/<Mono>--accent</Mono>, an
                11px uppercase eyebrow at <Mono>--t-eyebrow-track</Mono> in <Mono>--ink-3</Mono>,
                an optional pill on the right. The chip is <Mono>--s-6</Mono> square: the ladder is
                closed and 32 is the rung the drawn 30 lands on.
              </td>
            </tr>
            <tr>
              <th>padding</th>
              <td>
                <Mono>--s-5</Mono> for a card, <Mono>--s-6</Mono> for a larger one. Which card is
                larger is a judgement no token holds; ADR-093 decision 4 hands exactly that to this
                gate, so it is set by the caller and visible on the drawing.
              </td>
            </tr>
            <tr>
              <th>the request to act</th>
              <td>
                A <strong>tinted panel</strong> &mdash; <Mono>--accent-bg</Mono> or{" "}
                <Mono>--warn-bg</Mono>, a white icon chip, a bold title, one dim explanatory line,
                a pill CTA. The single biggest lift from the reference, and the one new registry
                row this idiom proposes.
              </td>
            </tr>
            <tr>
              <th>buttons</th>
              <td>
                Pills throughout. One solid accent primary per screen, an outline secondary, a
                quiet tertiary. On an accent ground the solid primary inverts to{" "}
                <Mono>--on-accent</Mono> fill with an <Mono>--accent</Mono> label &mdash; two named
                tokens, no third value.
              </td>
            </tr>
            <tr>
              <th>the growth chart</th>
              <td>
                Soft area fill under the accent line, endpoint dot with a <Mono>--surface</Mono>{" "}
                ring, only the two endpoints labelled. <Mono>GrowthLine</Mono> already draws all
                three &mdash; see the raised question below.
              </td>
            </tr>
            <tr>
              <th>colour meaning</th>
              <td>
                <Mono>--ok</Mono>/<Mono>--warn</Mono>/<Mono>--bad</Mono> reserved for state; the
                accent is never a state colour. Already §2.5&rsquo;s law and unchanged &mdash;
                recorded here because an idiom that spends the accent everywhere is exactly where
                it gets broken.
              </td>
            </tr>
          </tbody>
        </table>
      </ScrollX>

      <h2 className="pv-h2">The three routes</h2>
      <div className="stack-3">
        {IDIOM_ROUTES.map((r) => (
          <div className="pv-stage" key={r.href} style={{ marginBottom: 0 }}>
            <Link href={r.href} className="pv-mono" style={{ fontWeight: 700 }}>
              {r.href}
            </Link>
            <p className="pv-p" style={{ margin: "var(--s-2) 0 0" }}>
              {r.shows}
            </p>
            <p className="pv-p" style={{ margin: "var(--s-1) 0 0", color: "var(--pv-stop)" }}>
              <strong>Unsigned:</strong> {r.unsigned}
            </p>
          </div>
        ))}
      </div>

      <h2 className="pv-h2">Six proposed values, and what each costs to refuse</h2>
      <P>
        None of these is ruled. Two are the ones the owner explicitly left open and they are marked
        so. Each is declared once, in <Mono>globals.css</Mono> §1c, and{" "}
        <Mono>tokens.md</Mono> §9 carries the same table as the law-book copy.
      </P>
      <ScrollX>
        <table className="pv-table">
          <thead>
            <tr>
              <th>token</th>
              <th>value</th>
              <th>derivation</th>
              <th>reversal cost</th>
            </tr>
          </thead>
          <tbody>
            {PROPOSED_TOKENS.map((t) => (
              <tr key={t.name}>
                <td className="m">
                  {t.name}
                  {t.notRuled ? (
                    <>
                      <br />
                      <span className="pv-flag">owner has not ruled</span>
                    </>
                  ) : null}
                </td>
                <td className="m">{t.value}</td>
                <td>{t.derivation}</td>
                <td>{t.reversal}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollX>

      <Note>
        <p style={{ margin: 0 }}>
          <strong>The numeral question, built so one token flips it.</strong> BUILD.md §2.3,
          verbatim: <em>&ldquo;Every numeral, date, URL, search query and code-like string is
          JetBrains Mono with <Mono>tabular-nums</Mono>.&rdquo;</em> The owner&rsquo;s two
          reference screenshots both set the big numbers in a heavy sans, and the take the owner
          approved used sans. <strong>The owner has not ruled.</strong>{" "}
          <Mono>--t-num-headline-face</Mono> defaults to <Mono>--font-mono</Mono>, which is what
          §2.3 states and therefore what conforms; the switch above every idiom screen flips it to
          the sans at 800. It reaches the HEADLINE numeral only &mdash; a date, a URL, a search
          query and a provenance line stay mono whichever way it goes &mdash; and{" "}
          <Mono>tabular-nums</Mono> is never dropped, because it comes from the{" "}
          <Mono>.num</Mono> utility and no rule here can reach it. So the mechanical half of
          §2.3&rsquo;s rule survives either ruling; only the face is in question.
        </p>
      </Note>

      <h2 className="pv-h2">What moves in the registry &mdash; one new row, four widenings</h2>
      <ScrollX>
        <table className="pv-table">
          <thead>
            <tr>
              <th>what</th>
              <th>kind</th>
              <th>why the existing contract cannot hold it</th>
            </tr>
          </thead>
          <tbody>
            {REGISTRY_MOVES.map((m) => (
              <tr key={m.name}>
                <td className="m">{m.name}</td>
                <td>{m.kind}</td>
                <td>{m.why}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollX>

      <h2 className="pv-h2">Raised, not answered</h2>
      <div className="stack-3">
        {RAISED.map((q) => (
          <div className="pv-stop" key={q.title} style={{ marginBottom: 0 }}>
            <p style={{ margin: 0, fontWeight: 700 }}>{q.title}</p>
            <p style={{ margin: "var(--s-2) 0 0" }}>{q.body}</p>
          </div>
        ))}
      </div>

      <h2 className="pv-h2">Strings nobody may write but the owner &mdash; twenty-six</h2>
      <P>
        Every one renders as its bracket on the screen that needs it. The numbering is the one the
        screens use, so the owner can write them in a single pass and they land in one place.
      </P>
      <ScrollX>
        <table className="pv-table">
          <thead>
            <tr>
              <th>#</th>
              <th>where</th>
              <th>what it is</th>
            </tr>
          </thead>
          <tbody>
            {OWED_STRINGS.map((s) => (
              <tr key={s.id}>
                <td className="m">{s.id}</td>
                <td className="m">{s.where}</td>
                <td>{s.what}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollX>

      <h2 className="pv-h2">Checkout is not ours, and design/ has never held one</h2>
      <P>
        Checked across <Mono>design/</Mono> on 2026-09-02: no component, token, sheet or preview
        route renders a payment field, a card number, an invoice or a price form. The
        report&rsquo;s pricing card carries a start action that is a redirect and nothing else, and
        no checkout surface is added by any of these three routes. Stripe Checkout handles billing,
        invoicing and every billing notification entirely, which is why none of it has a surface
        here. BUILD.md §4.7&rsquo;s Settings <strong>Billing</strong> card is recorded in{" "}
        <Mono>components.md</Mono> §7 as <strong>pending an owner ruling</strong> &mdash; not
        redesigned on a guess, and not built in the meantime.
      </P>

      <p className="pv-p">
        <Link href="/" className="pv-mono">
          / &mdash; the preview index
        </Link>{" "}
        ·{" "}
        <Link href="/walk/app/overview" className="pv-mono">
          /walk/app/overview &mdash; the baseline Take A is read against
        </Link>
      </p>
    </main>
  );
}
