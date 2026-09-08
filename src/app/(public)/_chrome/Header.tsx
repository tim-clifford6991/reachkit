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
// `onLanding` is the route's to say, never inferred from a pathname here: a
// header that reads the route is a second place the rule lives.
import type React from "react";
import Link from "next/link";
import { Btn } from "@/ui/components/Btn";
import { copy } from "@/lib/presentation/copy";
import { FieldCta } from "../_landing/FieldCta";

export function Header(p: { onLanding: boolean }): React.JSX.Element {
  return (
    <header className="rk-chrome-head" data-testid="public-header">
      <div className="rk-chrome-bar">
        <Link href="/" className="rk-wordmark">
          <span className="rk-wordmark-chip" aria-hidden />
          <span>{copy("chrome.wordmark")}</span>
        </Link>

        <div className="rk-chrome-controls">
          {/* Quiet, on every route: signing in is what a customer does, and
              it is never the thing a stranger came to do. */}
          <Btn href="/signin" label={copy("chrome.nav.signin")} variant="secondary" pill />
          {p.onLanding ? (
            <FieldCta label={copy("chrome.cta.scan")} />
          ) : (
            <Btn href="/" label={copy("chrome.cta.scan")} variant="primary" pill />
          )}
        </div>
      </div>
    </header>
  );
}
