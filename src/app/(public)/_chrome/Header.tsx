// BUILD §3 — the public header, a daisyUI navbar.
// src/app/(public)/_chrome/Header.tsx
//
// Brand · Pricing · Sign in · the header CTA (outline). SPEC §1, 2026-09-14:
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
//
// **On a phone it is three things, and it never wraps (#936).** The bar
// used to be `flex-wrap`, which at 390 dropped the buttons onto a second
// row: the header grew, and the brand and the CTA stopped being the two
// things a stranger sees first. The 2026-09-20 board (`R6-8`) draws the
// phone bar as brand · outline CTA · menu button, and that is what this
// renders — the links that do not fit move into the menu rather than onto
// another line, and nothing is dropped. From `sm` the menu is gone and
// every link stands in the bar.
//
// The brand itself is `src/app/_brand/Brand.tsx` — one drawing shared with
// the app shell, so the mark the owner is still choosing (the canvas's logo
// round) is one edit away wherever it appears.
import type React from "react";
import { Menu } from "lucide-react";
import Link from "next/link";
import { copy } from "@/lib/presentation/copy";
import { Brand } from "@/app/_brand/Brand";
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

/** The two links that stand in the bar from `sm` and sit in the menu below
 *  it. One list, rendered twice at different widths — never two lists, or
 *  the bar and the menu come to offer different places to go. */
const LINKS: readonly { href: string; key: "chrome.nav.pricing" | "chrome.nav.signin" }[] = [
  { href: "/pricing", key: "chrome.nav.pricing" },
  { href: "/signin", key: "chrome.nav.signin" },
];

/** The CTA, in whichever of its two forms this route takes. */
function Cta(p: { action: HeaderAction }): React.JSX.Element {
  return p.action.kind === "landing" ? (
    <FieldCta label={copy("chrome.cta.scan")} />
  ) : (
    <Link href="/" className="btn btn-outline btn-primary btn-sm sm:btn-md">
      {copy("chrome.cta.scan")}
    </Link>
  );
}

/**
 * The phone menu: everything the bar cannot hold at 390.
 *
 * A daisyUI `dropdown` with a `menu` inside it, which is the same control
 * the theme toggle already is — so the toggle rides inside this one as its
 * last item rather than taking a slot of its own in a 390px bar. daisyUI's
 * dropdown opens on `:focus-within`, so focus moving into the nested
 * control keeps this one open, and both close when focus leaves.
 */
function PhoneMenu(p: { action: HeaderAction }): React.JSX.Element {
  return (
    <div className="dropdown dropdown-end sm:hidden" data-testid="public-header-menu">
      <button type="button" tabIndex={0} className="btn btn-ghost btn-square btn-sm" aria-label={copy("chrome.nav.menu")}>
        <Menu size={20} strokeWidth={1.75} aria-hidden />
      </button>
      <ul tabIndex={-1} className="dropdown-content menu rounded-box bg-base-100 z-20 w-52 p-2 shadow-sm">
        {p.action.kind === "copy-link" ? (
          <li>
            <CopyLink canonicalUrl={p.action.canonicalUrl} />
          </li>
        ) : null}
        {LINKS.map((link) => (
          <li key={link.href}>
            <Link href={link.href}>{copy(link.key)}</Link>
          </li>
        ))}
        <li>
          {/* The theme control rides in the menu below `sm` and stands in
              the bar from it. Both are rendered and CSS hides one, which
              is how a responsive bar is built — but it does mean the
              control exists twice in the document, so each arm says which
              it is and only one is ever displayed, focusable or announced
              (`hidden` is `display: none`).
              `labelled`: in here the glyph alone is a mystery under two
              worded links, so it shows its own name (owner, 2026-09-21). */}
          <ThemeToggle labelled />
        </li>
      </ul>
    </div>
  );
}

export function Header(p: { action: HeaderAction }): React.JSX.Element {
  return (
    <header className="border-base-300 bg-base-100 sticky top-0 z-10 border-b" data-testid="public-header">
      {/* No `flex-wrap`: a bar that wraps is a bar that grew instead of one
          that chose. What does not fit at 390 is in the menu. */}
      <nav className="navbar mx-auto max-w-6xl gap-2 px-4">
        <div className="min-w-0 flex-1">
          <Brand href="/" testId="public-brand" />
        </div>
        <div className="flex flex-none items-center gap-2">
          {/* From `sm`: every link in the bar, the report's copy control
              beside them, and the theme toggle on its own. */}
          {p.action.kind === "copy-link" ? (
            <span className="hidden sm:inline-flex">
              <CopyLink canonicalUrl={p.action.canonicalUrl} />
            </span>
          ) : null}
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="btn btn-ghost hidden sm:inline-flex">
              {copy(link.key)}
            </Link>
          ))}
          <span className="hidden sm:inline-flex" data-testid="public-header-theme">
            <ThemeToggle />
          </span>
          <Cta action={p.action} />
          <PhoneMenu action={p.action} />
        </div>
      </nav>
    </header>
  );
}
