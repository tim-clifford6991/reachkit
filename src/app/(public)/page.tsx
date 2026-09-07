// BUILD §3 — the landing page, composed (issue #266).
//
// **This is a port of the owner-approved card idiom, not a design.** The
// owner ruled on 2026-09-02, verbatim: *"This is exactly what we need — 'A ·
// Six boxes' is my preference and what we should proceed with"*, endorsing
// the idiom drawn as live code at `/idiom/landing` in the archived corpus;
// and, of BUILD §3's landing, that it is *"much too light: above the fold
// there must be the tagline, a subline, the CTA and an enticing
// image/component giving them an immediate feel for what the app is and
// looks like, then a product demo video, then a walk through why-care /
// what-it-does / how-to-start."* Neither reached `BUILD.md`; the amendment
// is queued on #2. What is below is that page, section for section.
//
// **REQ-001 c1 is untouched**: "exactly one text input and one submit
// control and no other input control of any kind". Everything this file
// adds around `ScanForm` is prose, a link, or one rendered component — no
// second field, no selector, no toggle. `tests/app/scan-address/landing.
// test.tsx` asserts the count over the whole rendered page and still does.
//
// **The demo video block is declared and not rendered.** `design/tokens.md`
// §9.4 decides the three states, and *absent* — no asset has been produced
// — is "the block does not render. No placeholder box, no 'coming soon', no
// empty frame with a play triangle over nothing. A section whose content
// does not exist is not a section, and the three narrative sections close up
// behind it." Its four sentences exist as keys (L7–L10) so the block has
// them the day an asset lands.
//
// **A Server Component.** It reads no session and no cookie — the group's
// own rule — and it renders the hero's specimen, which is the report's own
// chart over the reserved fixture and therefore a server read. The one
// interactive part, the field and its control, is `ScanForm` (a client
// component, extracted here unchanged).
import type React from "react";
import { Surface } from "@/ui/layout";
import { CardHead, IdiomCard } from "@/ui/idiom";
import { copy } from "@/lib/presentation/copy";
import { ScanForm } from "./_landing/ScanForm";
import { HeroSpecimen } from "./_landing/HeroSpecimen";

type LandingSearchParams = { problem?: string; value?: string };

export default function LandingPage(props: {
  searchParams?: Promise<LandingSearchParams> | LandingSearchParams;
}): React.JSX.Element {
  return (
    // ADR-093 decision 6: the screen root is a `Surface`, and its arms are
    // declared. The hero is two columns from `medium` — the field beside the
    // specimen — which is what REQ-099 c1's own `compact` arm ("follows
    // directly below, in normal flow") anticipated. The sections below it
    // are full-bleed grounds and carry their own inner measure, so they take
    // the surface's whole width and `.rk-section-in` centres their content
    // at `--w-wide`.
    <Surface
      arms={{
        compact: { kind: "columns", count: 1 },
        medium: { kind: "columns", count: 2 },
        wide: { kind: "same-as-below" },
      }}
    >
      <main className="col-span-full grid grid-cols-subgrid">
        {/* ══ HERO — on the accent ground ═══════════════════════════════
            The owner's "much too light", answered with the one ground this
            design system now has: the same `--grad-accent` the sign-in panel
            spends, so the two first touchpoints are the same surface and not
            two inventions. */}
        <section id="landing-field" className="col-span-full rk-hero rk-accent-ground">
          <div className="rk-hero-grid">
            <div className="rk-hero-copy">
              {/* APPROVED — BUILD §3's tagline, verbatim, and the one
                  written string on this page. */}
              <h1 className="rk-on-accent-h1">{copy("landing.headline")}</h1>
              <p className="rk-quiet">{copy("landing.subline")}</p>
              <ScanForm searchParams={props.searchParams} />
            </div>
            <HeroSpecimen />
          </div>
        </section>

        {/* ══ 1 · WHY SHOULD THEY CARE ═════════════════════════════════ */}
        <section className="col-span-full rk-section rk-section-surface">
          <div className="rk-section-in">
            <div className="rk-section-read">
              <p className="eyebrow">{copy("landing.why.eyebrow")}</p>
              <h2>{copy("landing.why.heading")}</h2>
              <p className="rk-quiet">{copy("landing.why.body")}</p>
            </div>
          </div>
        </section>

        {/* ══ 2 · WHAT IT DOES FOR THEM ════════════════════════════════
            Three cards, each leading with its own line — §2.5's "every card
            leads with the answer", where the answer here is the sentence.
            The chip glyph is the same on all three on purpose: three
            different icons would assign meaning to three cards whose copy is
            not written yet, and an icon that means something is a claim. */}
        <section className="col-span-full rk-section">
          <div className="rk-section-in">
            <div className="rk-section-read">
              <p className="eyebrow">{copy("landing.does.eyebrow")}</p>
              <h2>{copy("landing.does.heading")}</h2>
            </div>
            <div className="rk-three">
              <IdiomCard head={<CardHead eyebrow={copy("landing.does.item-1.title")} />}>
                <p className="rk-quiet">{copy("landing.does.item-1.line")}</p>
              </IdiomCard>
              <IdiomCard head={<CardHead eyebrow={copy("landing.does.item-2.title")} />}>
                <p className="rk-quiet">{copy("landing.does.item-2.line")}</p>
              </IdiomCard>
              <IdiomCard head={<CardHead eyebrow={copy("landing.does.item-3.title")} />}>
                <p className="rk-quiet">{copy("landing.does.item-3.line")}</p>
              </IdiomCard>
            </div>
          </div>
        </section>

        {/* ══ 3 · WHAT THEY DO TO START TODAY ══════════════════════════
            The control here is THE SAME ACTION as the hero's, repeated at
            the bottom of the walk — one primary action stated twice, not two
            primary actions. It is a link to the field rather than a second
            solid button: the master's ruling on the #266 mockup is one solid
            primary per screen, and the hero's is it. */}
        <section className="col-span-full rk-section rk-section-surface">
          <div className="rk-section-in">
            <div className="rk-section-read">
              <p className="eyebrow">{copy("landing.start.eyebrow")}</p>
              <h2>{copy("landing.start.heading")}</h2>
              <p className="rk-quiet">{copy("landing.start.body")}</p>
              <div>
                <a href="#landing-field" className="btn btn-ghost rk-btn-secondary rk-pill">
                  {copy("landing.start.cta")}
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
    </Surface>
  );
}
