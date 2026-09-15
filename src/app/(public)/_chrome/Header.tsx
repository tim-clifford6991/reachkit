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
// SPEC §1, owner 2026-09-15 (issue 714): no exceptions. The report, the two
// token pages and sign-in carry the same bar; the report adds its Copy link
// beside the pair.
import type React from "react";
import { TrendingUp } from "lucide-react";
import Link from "next/link";
import { copy } from "@/lib/presentation/copy";
import { CopyLink } from "../scan/[domain]/_address/copy-link";
import { FieldCta } from "../_landing/FieldCta";
import { ThemeToggle } from "@/app/_theme/ThemeToggle";
import { canonicalUrl } from "./canonical";

/** What the bar's right slot holds beside Sign in. A closed union, so a
 *  fourth kind of chrome cannot arrive without a rendering. */
export type HeaderAction =
  /** The header CTA as a link to the landing. */
  | { kind: "cta" }
  /** The CTA focusing the landing's own field. */
  | { kind: "landing" }
  /** The report address: its Copy link, then the CTA as a link. */
  | { kind: "copy-link"; canonicalUrl: string };

const REPORT_PREFIX = "/scan/";

/** The bar's arm for a public path. Pure, so the one per-route rule is
 *  asserted where it is written. No origin bound at build time is no
 *  address to copy: the report then takes the plain arm. */
export function headerActionFor(pathname: string): HeaderAction {
  if (pathname === "/") return { kind: "landing" };
  if (pathname.startsWith(REPORT_PREFIX)) {
    const url = canonicalUrl(pathname);
    return url === null ? { kind: "cta" } : { kind: "copy-link", canonicalUrl: url };
  }
  return { kind: "cta" };
}

function Action(p: { action: HeaderAction }): React.JSX.Element {
  return (
    <>
      {p.action.kind === "copy-link" ? <CopyLink canonicalUrl={p.action.canonicalUrl} /> : null}
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
          <ThemeToggle />
          <Action action={p.action} />
        </div>
      </nav>
    </header>
  );
}
