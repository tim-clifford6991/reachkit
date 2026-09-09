// BUILD §3, UI-SPEC 3a — the public header (issue #351).
// src/app/(public)/_chrome/Header.tsx
//
// **Ruling 3a, verbatim**: "Public header = brand · Sign in (quiet) · one
// solid CTA". That is the whole header, on every public route. The Pricing
// link that used to sit here is in the footer's Product column, where 3a
// puts it — the header carries the two things a stranger does, and the
// compact-band `Collapse` that listed the links goes with them: two
// controls need no menu, and every link is still in the document.
//
// **The header's CTA is drawn on the landing too, and that is new.** Ruling
// 2b of 2026-09-08 supersedes #290's one-primary reading: "two solid
// primaries per screen are allowed where the artifact draws them (landing:
// header CTA + hero CTA)". On the landing that CTA is REQ-099 c3's — it
// brings the hero's own field into view with the cursor in it rather than
// loading a page, so the page still has exactly one submit control. On
// every other public route it is a link to the landing, which is where the
// field is.
//
// **The right slot is the route's, and the route says so.** On the report
// address the approved set draws REQ-001 c7's quiet *Copy link* there
// instead of the pair — it is the one screen with an address to copy, and
// the control had been standing inside the report's own tree because the
// chrome had no slot for it (issue #352's own note). It has one now. The
// arm is a value the layout passes, never a pathname this file reads: a
// header that reads the route is a second place the rule lives.
import type React from "react";
import Link from "next/link";
import { Btn } from "@/ui/components/Btn";
import { copy } from "@/lib/presentation/copy";
import { CopyLink } from "../scan/[domain]/_address/copy-link";
import { FieldCta } from "../_landing/FieldCta";

/** What the bar's right slot holds. A closed union with a `never` default
 *  below, so a fourth kind of chrome cannot arrive without a rendering —
 *  and so the decision is a value the layout hands over rather than a
 *  pathname read twice. */
export type HeaderAction =
  /** Ruling 3a's pair: quiet Sign in, then the one solid CTA. */
  | { kind: "cta" }
  /** The same pair, with REQ-099 c3's CTA — the hero's own field. */
  | { kind: "landing" }
  /** REQ-001 c7's control, on the one screen with an address to copy. */
  | { kind: "copy-link"; canonicalUrl: string };

function Action(p: { action: HeaderAction }): React.JSX.Element {
  if (p.action.kind === "copy-link") {
    return <CopyLink canonicalUrl={p.action.canonicalUrl} />;
  }
  return (
    <>
      {/* Quiet, on every route: signing in is what a customer does, and
          it is never the thing a stranger came to do. */}
      <Btn href="/signin" label={copy("chrome.nav.signin")} variant="tertiary" pill />
      {p.action.kind === "landing" ? (
        <FieldCta label={copy("chrome.cta.scan")} />
      ) : (
        <Btn href="/" label={copy("chrome.cta.scan")} variant="primary" pill />
      )}
    </>
  );
}

export function Header(p: { action: HeaderAction }): React.JSX.Element {
  return (
    <header className="rk-chrome-head" data-testid="public-header">
      <div className="rk-chrome-bar">
        <Link href="/" className="rk-wordmark">
          <span className="rk-wordmark-chip" aria-hidden />
          <span>{copy("chrome.wordmark")}</span>
        </Link>

        <div className="rk-chrome-controls">
          <Action action={p.action} />
        </div>
      </div>
    </header>
  );
}
