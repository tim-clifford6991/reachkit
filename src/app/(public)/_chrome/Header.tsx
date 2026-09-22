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
//
// **A Server Component since #988, and it takes no path.** It used to be a
// Client Component by inheritance — `(public)/layout.tsx` read
// `usePathname()` to hand it an arm, which made this file, `Footer.tsx`,
// `Brand.tsx` and everything they import client modules, and dragged
// `copy()`'s whole merged registry into every public route's first
// download. Two arms of this bar genuinely do follow the address, and only
// those two are Client Components now (`./HeaderArm.tsx`); the rule they
// apply is `./action.ts`, which holds no copy key so that importing it
// costs a client nothing. Every `copy()` call below runs on the server, and
// each leaf is handed its sentence already written.
import type React from "react";
import { Menu } from "lucide-react";
import Link from "next/link";
import { copy } from "@/lib/presentation/copy";
import { Brand } from "@/app/_brand/Brand";
import { ThemeToggle } from "@/app/_theme/ThemeToggle";
import { themeNames } from "@/app/_theme/names";
import { HeaderCopyLink, HeaderCta } from "./HeaderArm";

/** The two links that stand in the bar from `sm` and sit in the menu below
 *  it. One list, rendered twice at different widths — never two lists, or
 *  the bar and the menu come to offer different places to go. */
/** Which of the copy control's two homes a render is drawing — a slot
 *  name, never a sentence. Bound to a name because the copy sweep reads a
 *  bare JSX attribute string as product voice, and it is right to. */
const PLACE = { bar: "bar", menu: "menu" } as const;

const LINKS: readonly { href: string; key: "chrome.nav.pricing" | "chrome.nav.signin" }[] = [
  { href: "/pricing", key: "chrome.nav.pricing" },
  { href: "/signin", key: "chrome.nav.signin" },
];

/**
 * The phone menu: everything the bar cannot hold at 390.
 *
 * A daisyUI `dropdown` with a `menu` inside it, which is the same control
 * the theme toggle already is — so the toggle rides inside this one as its
 * last item rather than taking a slot of its own in a 390px bar. daisyUI's
 * dropdown opens on `:focus-within`, so focus moving into the nested
 * control keeps this one open, and both close when focus leaves.
 */
function PhoneMenu(): React.JSX.Element {
  return (
    <div className="dropdown dropdown-end sm:hidden" data-testid="public-header-menu">
      <button type="button" tabIndex={0} className="btn btn-ghost btn-square btn-sm" aria-label={copy("chrome.nav.menu")}>
        <Menu size={20} strokeWidth={1.75} aria-hidden />
      </button>
      <ul tabIndex={-1} className="dropdown-content menu rounded-box bg-base-100 z-20 w-52 p-2 shadow-sm">
        <HeaderCopyLink place={PLACE.menu} label={copy("copy-link.label")} />
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
          <ThemeToggle names={themeNames()} labelled />
        </li>
      </ul>
    </div>
  );
}

export function Header(): React.JSX.Element {
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
          <HeaderCopyLink place={PLACE.bar} label={copy("copy-link.label")} />
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="btn btn-ghost hidden sm:inline-flex">
              {copy(link.key)}
            </Link>
          ))}
          <span className="hidden sm:inline-flex" data-testid="public-header-theme">
            <ThemeToggle names={themeNames()} />
          </span>
          <HeaderCta label={copy("chrome.cta.scan")} />
          <PhoneMenu />
        </div>
      </nav>
    </header>
  );
}
