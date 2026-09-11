"use client";

/**
 * /idiom/landing — THE LANDING PAGE.
 *
 * BUILD.md §3 specifies "one field, one button" and one tagline. The owner
 * ruled on 2026-09-02 that the page is much too light: above the fold there
 * must be the tagline, a subline, the CTA and "an enticing image/component
 * giving them an immediate feel for what the app is and looks like", then a
 * product demo video, then a walk through why-care / what-it-does /
 * how-to-start.
 *
 * THE TAGLINE IS APPROVED COPY AND STANDS. Every other customer-visible
 * string on this page is the owner's and is UNWRITTEN: each renders as its
 * bracketed slot from ./copy.ts, numbered L1…L25 so they can be written in
 * one pass. A preview that drafted them "as a suggestion" would be the
 * defect rule 7.3 names, and the suggestion is what survives.
 */
import Link from "next/link";
import { AlertTriangle, ArrowRight, Play, Search } from "lucide-react";
import { AiDotMatrix } from "@/components/registry/surfaces";
import { Badge, Input } from "@/components/registry/primitives";
import { Mono, Note, P, SheetHead, Stop } from "@/components/chrome/sheet";
import { MATRIX_ROWS, REPORT } from "@/mock/data";
import { CardHead, IdiomBtn, IdiomCard, IdiomScope } from "../parts";
import { LANDING } from "../copy";

export default function IdiomLanding() {
  return (
    <>
      <main className="pv-wrap" style={{ paddingBottom: "var(--s-4)" }}>
        <SheetHead
          title="Landing"
          carries="preview artifact · one approved string, twenty-five owed · not production code · nothing here is signed"
        >
          <P>
            Hero on the accent ground, the demo video block, then three narrative sections. The
            structure is drawn; the copy is not. Twenty-five bracketed slots render as brackets and
            are enumerated with this route so the owner can write them in one pass.
          </P>
        </SheetHead>

        <Stop>
          <p style={{ margin: 0, fontWeight: 700 }}>
            One approved string on this page, and it is the tagline.
          </p>
          <p style={{ margin: "var(--s-2) 0 0" }}>
            BUILD.md §3&rsquo;s tagline stands and is rendered verbatim. Every other sentence —
            subline, CTA label, the three section headings, all body copy — is the owner&rsquo;s
            and is not drafted here, not even as a suggestion (constitution §1). What you are
            looking at is the SHAPE of an argument with the argument missing, which is the only
            honest thing a preview can show at this stage.
          </p>
        </Stop>

        <Note>
          <p style={{ margin: 0 }}>
            <strong>
              The &ldquo;enticing component&rdquo; is a real component from the product, and the
              argument for it is short.
            </strong>{" "}
            It is the report&rsquo;s AI dot-matrix: two rivals&rsquo; rows filled gray and the
            customer&rsquo;s own row empty and red-ringed. Four reasons, in order of weight.{" "}
            <em>One</em> — it makes the product&rsquo;s whole argument without a sentence, and on a
            page where every sentence is still owed that is not a nice property, it is the only
            thing that renders at all. <em>Two</em> — it is the same code the customer meets after
            paying, so it cannot go stale, it re-themes with the toggle, it inherits every token
            ruling, and it is inside ADR-093&rsquo;s conformance suite, which no image is.{" "}
            <em>Three</em> — a screenshot is a second home for a surface that already has one (rule
            2.4), and two of the four HTML sheets went wrong on screen within a day of a token
            ruling, which is exactly how a hero image rots. <em>Four</em> — it is not interactive,
            so the argument is not behind a tap.
          </p>
          <p style={{ margin: "var(--s-2) 0 0" }}>
            <strong>Where a static image would genuinely have won, and why it does not here:</strong>{" "}
            if the hero needed to show the whole app at once — chrome, sidebar, calendar, panel, at
            a width the visitor&rsquo;s phone does not have — a scaled screenshot survives that and
            a live component does not, because a live component at 375px renders its own compact
            arm and stops looking like the product. That is a real trade and it is why the choice
            is ONE MODULE rather than a whole screen: a module is legible at every band, and the
            &ldquo;what the app looks like&rdquo; job is the demo video&rsquo;s, one block down.
          </p>
        </Note>
      </main>

      <IdiomScope>
        {/* ══ HERO ══════════════════════════════════════════════════════
            On the accent ground. The owner's "much too light" answered with
            the one ground this design system now has — the same
            --grad-accent the sign-in panel spends, so the two first
            touchpoints are the same surface and not two inventions. */}
        <section className="ci-hero ci-accent-ground">
          <div className="ci-hero-grid">
            <div className="ci-hero-copy">
              {/* APPROVED — BUILD.md §3, verbatim. */}
              <h1 className="ci-on-accent-h1">{LANDING.tagline}</h1>
              <p className="ci-quiet">{LANDING.subline}</p>
              <div className="ci-hero-form">
                <Input label={LANDING.fieldLabel} placeholder={LANDING.fieldPlaceholder} />
                <IdiomBtn
                  variant="on-accent"
                  label={LANDING.cta}
                  icon={<Search size={16} strokeWidth={2} aria-hidden />}
                />
              </div>
            </div>

            {/* The product component, on its own --surface, floating on the
                accent. Shown in its own theme, exactly as a customer meets
                it after paying. */}
            <div className="ci-hero-specimen">
              <CardHead
                icon={<Search size={16} strokeWidth={2} />}
                eyebrow={LANDING.specimenLabel}
                pill={<Badge tone="bad">{REPORT.notYouBadge}</Badge>}
              />
              <AiDotMatrix rows={MATRIX_ROWS} countLine={REPORT.denominator} />
              <p className="explain">{LANDING.specimenCaption}</p>
            </div>
          </div>
        </section>

        {/* ══ THE DEMO VIDEO BLOCK ══════════════════════════════════════ */}
        <section className="ci-section">
          <div className="ci-section-in">
            <div className="ci-section-read stack-2">
              <p className="eb">{LANDING.videoEyebrow}</p>
              <h2 className="rk-h1">{LANDING.videoHeading}</h2>
            </div>
            <div className="ci-video">
              <span className="ci-play" aria-hidden>
                <Play size={20} strokeWidth={2} />
              </span>
            </div>
          </div>
        </section>

        {/* ══ 1 · WHY SHOULD THEY CARE ══════════════════════════════════ */}
        <section className="ci-section" style={{ background: "var(--surface)" }}>
          <div className="ci-section-in">
            <div className="ci-section-read stack-3">
              <p className="eb">{LANDING.whyEyebrow}</p>
              <h2 className="rk-h1">{LANDING.whyHeading}</h2>
              <p className="dim" style={{ margin: 0 }}>
                {LANDING.whyBody}
              </p>
            </div>
          </div>
        </section>

        {/* ══ 2 · WHAT IT DOES FOR THEM ═════════════════════════════════ */}
        <section className="ci-section">
          <div className="ci-section-in">
            <div className="ci-section-read stack-2">
              <p className="eb">{LANDING.doesEyebrow}</p>
              <h2 className="rk-h1">{LANDING.doesHeading}</h2>
            </div>
            {/* Three cards, and each leads with its eyebrow and then its one
                line — §2.5's "every card leads with the answer", where the
                answer here is the sentence. The icon is the SAME on all
                three on purpose: three different icons would assign meaning
                to three cards whose copy is not written yet, and an icon
                that means something is a claim. The three icons are owed
                alongside L16–L21. */}
            <div className="ci-three">
              {LANDING.does.map((d) => (
                <IdiomCard
                  key={d.title}
                  head={<CardHead icon={<ArrowRight size={16} strokeWidth={2} />} eyebrow={d.title} />}
                >
                  <p className="dim" style={{ margin: 0 }}>
                    {d.line}
                  </p>
                </IdiomCard>
              ))}
            </div>
          </div>
        </section>

        {/* ══ 3 · WHAT THEY DO TO START TODAY ═══════════════════════════
            The CTA here is THE SAME ACTION as the hero's, repeated at the
            bottom of the walk. That is one primary action stated twice, not
            two primary actions: a second, different solid button is what
            the one-primary-action rule refuses. */}
        <section className="ci-section" style={{ background: "var(--surface)" }}>
          <div className="ci-section-in">
            <div className="ci-section-read stack-3">
              <p className="eb">{LANDING.startEyebrow}</p>
              <h2 className="rk-h1">{LANDING.startHeading}</h2>
              <p className="dim" style={{ margin: 0 }}>
                {LANDING.startBody}
              </p>
              <div className="row">
                <IdiomBtn variant="primary" label={LANDING.startCta} />
              </div>
            </div>
          </div>
        </section>
      </IdiomScope>

      <main className="pv-wrap" style={{ paddingTop: "var(--s-5)" }}>
        <h2 className="pv-h2">The video is a new asset class — three states, decided</h2>
        <P>
          A landing page whose hero depends on an asset that has not been produced is a landing
          page that does not render, so what the block does without its asset is decided here
          rather than discovered. The hero above is complete without the video: nothing in it
          depends on the block below it.
        </P>
        <div className="rk ci" style={{ padding: "var(--s-4)", borderRadius: "var(--r-card)" }}>
          <div className="stack-5">
            <div className="stack-2">
              <p className="eb">absent — no asset has been produced</p>
              <p className="explain">
                The block does not render. No placeholder box, no &ldquo;coming soon&rdquo;, no
                empty frame with a play triangle over nothing. A section whose content does not
                exist is not a section, and the three narrative sections close up behind it.
              </p>
            </div>
            <div className="stack-2">
              <p className="eb">loading — the poster is the block</p>
              <div className="ci-video">
                <span className="ci-play" aria-hidden>
                  <Play size={20} strokeWidth={2} />
                </span>
              </div>
              <p className="explain">
                The poster is the video&rsquo;s own first frame and ships with it, so the block
                renders its final size on the first paint and nothing on the page moves when the
                player mounts over it. There is no third loading state and no spinner: REQ-003 c1
                forbids an unlabelled spinner by name and the rule generalises.
              </p>
            </div>
            <div className="stack-2">
              <p className="eb">blocked — the player is refused</p>
              <div className="ci-video">
                <span className="ci-play" aria-hidden>
                  <Play size={20} strokeWidth={2} />
                </span>
                <span className="ci-video-note">
                  <AlertTriangle size={14} strokeWidth={2} aria-hidden style={{ color: "var(--warn)" }} />
                  <span className="t-xs">{LANDING.videoBlocked}</span>
                  <IdiomBtn variant="secondary" size="sm" label={LANDING.videoOpen} />
                </span>
              </div>
              <p className="explain">
                A content policy, a tracking blocker or no network. The poster stays and one
                written line plus the video&rsquo;s own address takes the play control&rsquo;s
                place. It takes <Mono>warn</Mono> and never <Mono>bad</Mono>: red is the
                customer&rsquo;s own problem being shown to them (§2.5), and a player we could not
                mount is ours.
              </p>
            </div>
          </div>
        </div>

        <h2 className="pv-h2">Checkout is not on this page and is nowhere in design/</h2>
        <P>
          The pricing card&rsquo;s start action is a redirect to Stripe Checkout, which handles
          billing, invoicing and every billing notification entirely. No component in{" "}
          <Mono>components.md</Mono> renders a payment field, a card number, an invoice or a price
          form, and none is added here. BUILD.md §4.7&rsquo;s Settings Billing card is recorded in{" "}
          <Mono>components.md</Mono> §7 as pending an owner ruling so nobody builds it in the
          meantime.
        </P>

        <p className="pv-p">
          <Link href="/idiom" className="pv-mono">
            /idiom
          </Link>{" "}
          ·{" "}
          <Link href="/idiom/signin" className="pv-mono">
            /idiom/signin
          </Link>
        </p>
      </main>
    </>
  );
}
