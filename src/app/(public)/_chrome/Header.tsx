// BUILD §3 — the public header, a daisyUI navbar.
// src/app/(public)/_chrome/Header.tsx
//
// Brand · Sign in (ghost) · the header CTA (outline). SPEC §1, 2026-09-14:
// the header CTA is outline on every public page, so each screen's own
// action is its only solid button.
//
// On the landing the CTA focuses the hero's field (`FieldCta`) rather than
// loading a page, so the page keeps exactly one submit control. On every
// other public route it is a link to the landing.
//
// The right slot is the route's, handed over by the layout: the report
// address shows its Copy link, and a token page shows its own address,
// quiet, with no control beside it.
import type React from "react";
import { TrendingUp } from "lucide-react";
import Link from "next/link";
import { copy } from "@/lib/presentation/copy";
import { CopyLink } from "../scan/[domain]/_address/copy-link";
import { FieldCta } from "../_landing/FieldCta";

/** What the bar's right slot holds. A closed union, so a fourth kind of
 *  chrome cannot arrive without a rendering. */
export type HeaderAction =
  /** Sign in, then the header CTA as a link to the landing. */
  | { kind: "cta" }
  /** The same pair, with the CTA focusing the landing's own field. */
  | { kind: "landing" }
  /** The one screen with an address to copy. */
  | { kind: "copy-link"; canonicalUrl: string }
  /** A token page's own address, quiet. */
  | { kind: "address"; address: string };

function Action(p: { action: HeaderAction }): React.JSX.Element {
  if (p.action.kind === "copy-link") {
    return <CopyLink canonicalUrl={p.action.canonicalUrl} />;
  }
  if (p.action.kind === "address") {
    return <span className="font-mono text-xs text-base-content/60">{p.action.address}</span>;
  }
  return (
    <>
      <Link href="/signin" className="btn btn-ghost">
        {copy("chrome.nav.signin")}
      </Link>
      {p.action.kind === "landing" ? (
        <FieldCta label={copy("chrome.cta.scan")} />
      ) : (
        <Link href="/" className="btn btn-outline btn-primary">
          {copy("chrome.cta.scan")}
        </Link>
      )}
    </>
  );
}

/** The brand, as the header and the footer both draw it. */
export function Brand(): React.JSX.Element {
  return (
    <Link href="/" className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
      <span className="grid size-7 place-items-center rounded-field bg-primary text-primary-content" aria-hidden>
        <TrendingUp size={16} strokeWidth={1.75} aria-hidden />
      </span>
      <span>{copy("chrome.wordmark")}</span>
    </Link>
  );
}

export function Header(p: { action: HeaderAction }): React.JSX.Element {
  return (
    <header className="sticky top-0 z-10 border-b border-base-300 bg-base-100" data-testid="public-header">
      <nav className="navbar mx-auto max-w-6xl flex-wrap gap-2 px-4">
        <div className="flex-1">
          <Brand />
        </div>
        <div className="flex flex-none items-center gap-2">
          <Action action={p.action} />
        </div>
      </nav>
    </header>
  );
}
