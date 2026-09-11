"use client";

/**
 * /idiom/signin — THE SIGN-IN SCREEN.
 *
 * BUILD.md §3 names magic-link auth and NO section of §4 describes a
 * sign-in screen. That gap was reported; the owner answered it by pointing
 * at the live page ("this has always looked clean → https://reachkit.app/login")
 * and attaching a screenshot. Every customer-visible string on this screen
 * is therefore OWNER-SUPPLIED and transcribed verbatim from ./copy.ts —
 * not paraphrased, not improved, and not one string of this preview's own
 * is added.
 *
 * FOUR THINGS WERE DECIDED HERE AS PARAMETERS (rule 1.1) and are recorded
 * in tokens.md §9 with their reversal costs: the gradient, the glass card's
 * two alphas, the dark pill, and the narrow-viewport arm. ONE THING IS
 * RAISED AND NOT ANSWERED: where the specimen score comes from.
 */
import Link from "next/link";
import { Num } from "@/components/Num";
import { Input } from "@/components/registry/primitives";
import { Mono, Note, P, SheetHead, Stop } from "@/components/chrome/sheet";
import { Bar, IdiomBtn, IdiomScope } from "../parts";
import { SIGNIN } from "../copy";

export default function IdiomSignIn() {
  return (
    <>
      <main className="pv-wrap" style={{ paddingBottom: "var(--s-4)" }}>
        <SheetHead
          title="Sign in"
          carries="preview artifact · owner-supplied copy, transcribed · not production code · nothing here is signed"
        >
          <P>
            Two panels, roughly 50/50, full viewport height at and above{" "}
            <Mono>--breakpoint-lg</Mono>. Left: the one action. Right: the accent ground and the
            glass card. Every string is the owner&rsquo;s, taken from the page they endorsed.
          </P>
        </SheetHead>

        <Stop>
          <p style={{ margin: 0, fontWeight: 700 }}>
            RAISED, NOT ANSWERED: where does the 47 come from?
          </p>
          <p style={{ margin: "var(--s-2) 0 0" }}>
            The right panel shows a Discoverability Score for a named domain to a stranger who has
            not signed in. Three answers are possible and they are not equivalent: a real recent
            scan of that domain, a fixed specimen everyone sees, or a placeholder. Only the first
            is a measurement; the second is a specimen and must be labelled as one; the third is a
            number the product invents and shows to a customer, which is rule 1.2. A page that
            shows an invented measurement to a stranger is exactly the thing that ships by
            accident, so this preview renders the owner&rsquo;s own transcribed figures and asks
            rather than deciding. <strong>Nobody builds this panel until it is answered.</strong>
          </p>
        </Stop>

        <Note>
          <p style={{ margin: 0 }}>
            <strong>What was decided here, and what it costs to reverse.</strong> The gradient is{" "}
            <Mono>--grad-accent</Mono>: a flat <Mono>--accent</Mono> ground under a radial
            highlight of <Mono>--on-accent</Mono> at 28% — BUILD.md §2.1&rsquo;s own stated alpha,
            so no second accent stop is minted and no new colour exists. The glass card is the
            same rule at 12% and 28%, which is the pair §2.1 states verbatim. The dark pill is{" "}
            <Mono>--ink</Mono> on <Mono>--surface</Mono>, two named tokens that invert with the
            theme rather than pinning a light-mode colour. The narrow arm is below.
          </p>
          <p style={{ margin: "var(--s-2) 0 0" }}>
            <strong>The narrow viewport: the panel follows the form, in flow.</strong> Not above
            it, and not dropped. This screen has exactly one primary action and it must be the
            first thing on the screen at every width; the panel carries no action and no route, so
            following the form costs the customer nothing, while putting it above pushes an email
            field below the fold on a phone. Dropping it was the other candidate and is refused
            for a weaker but real reason — ADR-093&rsquo;s whole shape is a designed narrow arm
            rather than a hidden surface, and nothing here needs hiding to fit. Reversal cost: one
            media query and the order of two children.
          </p>
        </Note>

        <Note>
          <p style={{ margin: 0 }}>
            <strong>One owed string this screen found.</strong> The registered <Mono>Input</Mono>{" "}
            requires a label as well as a placeholder, never defaulted (components.md §1) — and the
            page the owner endorsed shows no visible field label. The bracketed slot is rendered
            below rather than filled. Either the owner writes it, or <Mono>Input</Mono>&rsquo;s row
            gains an arm for a visually-hidden label; both are rulings, and neither is a
            preview&rsquo;s to take.
          </p>
        </Note>
      </main>

      <IdiomScope>
        <div className="ci-split">
          {/* ── LEFT · the one action ─────────────────────────────────── */}
          <div className="ci-split-form">
            <div className="ci-form-col">
              {/* "roughly the h2 rung, 800" — .rk-h2 at --t-head-weight. */}
              <h1 className="rk-h2">{SIGNIN.heading}</h1>
              <p className="ci-lede">{SIGNIN.body}</p>
              <Input
                label="[S1 · sign-in field label — owner's]"
                placeholder={SIGNIN.fieldPlaceholder}
              />
              <IdiomBtn variant="primary" block label={SIGNIN.submit} />
              <p className="t-sm dim" style={{ margin: 0 }}>
                {SIGNIN.newLead}
                <Link href="/idiom/landing" className="ci-link">
                  {SIGNIN.newLeadLink}
                </Link>
              </p>
            </div>
          </div>

          {/* ── RIGHT · the accent ground and the glass card ──────────── */}
          <div className="ci-split-panel ci-accent-ground">
            <div className="ci-panel-col">
              <h2 className="ci-on-accent-h1">{SIGNIN.panelHeading}</h2>
              <div className="ci-glass">
                <p className="prov">
                  <Num>{SIGNIN.panelDomain}</Num>
                </p>
                <div className="between">
                  <span className="t-sm" style={{ fontWeight: 600 }}>
                    {SIGNIN.scoreLabel}
                  </span>
                  <span className="ci-pill-inverse">
                    <Num>{SIGNIN.scorePill}</Num>
                  </span>
                </div>
                <div className="ci-figure">
                  <span className="ci-figure-big">
                    <Num>{SIGNIN.scoreValue}</Num>
                  </span>
                  <span className="ci-figure-of">
                    <Num>{SIGNIN.scoreOf}</Num>
                  </span>
                </div>
                {/* The bar states the SAME fact as the figure above it, so it
                    is drawn at that figure. The reference screenshot draws it
                    at roughly 40% beside a 47/100 — two renderings of one
                    number that disagree, which is rule 2.4's second copy
                    arriving as a picture. Recorded rather than copied. */}
                <Bar value={Number(SIGNIN.scoreValue)} max={SIGNIN.scoreMax} label={SIGNIN.scoreLabel} />
                <p className="ci-quiet t-sm">{SIGNIN.panelLine}</p>
              </div>
            </div>
          </div>
        </div>
      </IdiomScope>

      <main className="pv-wrap" style={{ paddingTop: "var(--s-5)" }}>
        <h2 className="pv-h2">What this screen holds</h2>
        <P>
          One primary action — <Mono>Send my link</Mono>, full width, solid accent, and the only
          solid button on the screen. No checkout surface, no payment field and no price: sign-in
          is a magic link and billing is Stripe&rsquo;s entirely. No paragraph of generated copy:
          every sentence is one the owner wrote on a page they pointed at. Nothing below{" "}
          <Mono>--t-floor</Mono>, and nothing that clips at 320.
        </P>
        <p className="pv-p">
          <Link href="/idiom" className="pv-mono">
            /idiom
          </Link>{" "}
          ·{" "}
          <Link href="/idiom/landing" className="pv-mono">
            /idiom/landing
          </Link>
        </p>
      </main>
    </>
  );
}
