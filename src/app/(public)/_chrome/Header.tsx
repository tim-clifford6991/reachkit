// BUILD §3 — the public chrome: the banner and the header.
// src/app/(public)/_chrome/Header.tsx
//
// Boards `PubLanding` and `PubLandingPhone` (owner 2026-10-20):
//
//   · **The banner** — one dismissible strip above the header, on the accent
//     ground with its own ink, a *Free* tag, the line `chrome.banner` and a
//     link to the landing's field; below `sm` the shorter line is the link.
//     Its dismissal is remembered before paint (`./banner.ts`).
//   · **The header** — sticky, a 78% surface ground under a 12px blur. The
//     mark and *How it works · Pricing · Free scans* on the left (Q1); on the
//     right the one theme button, *Sign in* as a ghost, and *Free scan* solid
//     with an arrow. The `/app` shell keeps its three-way dropdown.
//   · **Below `lg`** the links move into a daisyUI `drawer` from the right;
//     below `sm` the switch and *Sign in* follow them. *Start free* never
//     leaves the bar, and the bar never wraps (#936).
//
// On the landing *Start free* and the banner's link bring the hero's field
// into view (`HeaderArm.tsx`), so the page keeps exactly one submit control;
// elsewhere they link to it. SPEC §1, owner 2026-09-15 (issue 714): the same
// chrome on every public route, the report adding its copy control.
//
// **A Server Component since #988, and it takes no path.** The pieces that
// follow the address or answer a click are client leaves in `./HeaderArm.tsx`
// and hold no copy key; every `copy()` call below runs on the server, and
// each leaf is handed its sentence already written.
//
// **Signed in** (owner 2026-09-26, #1125) *Sign in* and *Start free* give
// way to one solid *Your dashboard* into the app, in the bar and never in
// the drawer. The caller reads the session (`./session.ts`) and hands the
// destination in, so this stays a plain render; no destination is the
// signed-out header, exactly as it was.
//
// **The blur is a layer, not the header's own style.** `backdrop-filter` on
// an element makes it the containing block of its fixed descendants, and
// the drawer's panel is one: on the header itself it would open inside the
// bar instead of over the screen.
import type React from "react";
import { ArrowRight, Menu } from "lucide-react";
import Link from "next/link";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { Brand } from "@/app/_brand/Brand";
import { ThemeSwitch } from "@/app/_theme/ThemeSwitch";
import { BannerDismiss, BannerLink, DrawerLinks, HeaderCopyLink, HeaderCta } from "./HeaderArm";
import type { AppEntry } from "./session";

/** Which of the copy control's two homes a render is drawing — a slot
 *  name, never a sentence. Bound to a name because the copy sweep reads a
 *  bare JSX attribute string as product voice, and it is right to. */
const PLACE = { bar: "bar", menu: "menu" } as const;

/** The nav's links, rendered in the bar from `lg` and in the drawer below
 *  it. One list, so the bar and the drawer never offer different places. */
const LINKS: readonly { href: string; key: CopyKey }[] = [
  { href: "/how-it-works", key: "chrome.nav.works" },
  { href: "/pricing", key: "chrome.nav.pricing" },
  { href: "/scans", key: "chrome.nav.scans" },
];

/** The switch's two names, resolved here so the client leaf holds no key. */
function switchNames(): { toDark: string; toLight: string } {
  return { toDark: copy("chrome.theme.to-dark"), toLight: copy("chrome.theme.to-light") };
}

/** The phone drawer's one toggle. */
const MENU_TOGGLE_ID = "public-menu";

/** Draws the ring on the drawer's `<label>` buttons when its hidden toggle
 *  has keyboard focus — the toggle itself has no box to draw one on (the
 *  `/app` shell's `DRAWER_FOCUS_RING`, #328). */
const MENU_FOCUS_RING = [
  "[.drawer-toggle:focus-visible~*_&]:outline-solid",
  "[.drawer-toggle:focus-visible~*_&]:outline-2",
  "[.drawer-toggle:focus-visible~*_&]:outline-offset-2",
  "[.drawer-toggle:focus-visible~*_&]:outline-primary",
].join(" ");

/** The strip above the header. Hidden before paint once dismissed, and on the landing, whose offer carries it. */
function Banner(): React.JSX.Element {
  return (
    <div
      role="region"
      aria-label={copy("chrome.banner.label")}
      className="bg-primary text-primary-content relative text-sm [[data-banner=off]_&]:hidden [body:has(main[data-page=landing])_&]:hidden"
      data-testid="public-banner"
    >
      <p className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 py-2 ps-4 pe-12 sm:justify-center sm:px-12">
        <span className="badge badge-sm bg-primary-content text-primary border-0 font-semibold">
          {copy("chrome.banner.tag")}
        </span>
        <span className="hidden min-w-0 sm:inline">{copy("chrome.banner")}</span>
        <span className="hidden sm:inline">
          <BannerLink label={copy("landing.submit.label")} />
        </span>
        <span className="sm:hidden">
          <BannerLink label={copy("chrome.banner.short")} />
        </span>
      </p>
      <span className="absolute end-2 top-1.5">
        <BannerDismiss label={copy("chrome.banner.dismiss")} />
      </span>
    </div>
  );
}

/**
 * The drawer below `lg`: the links, the report's copy control and — below
 * `sm`, where the bar has no room for them — the theme switch and *Sign in*
 * (signed out only).
 */
function PhoneMenu(p: { signedIn: boolean }): React.JSX.Element {
  return (
    <div className="drawer drawer-end w-auto lg:hidden" data-testid="public-header-menu">
      <input id={MENU_TOGGLE_ID} type="checkbox" className="drawer-toggle" aria-label={copy("chrome.nav.menu")} />
      <div className="drawer-content">
        <label htmlFor={MENU_TOGGLE_ID} className={`btn btn-ghost btn-square btn-sm ${MENU_FOCUS_RING}`}>
          <Menu size={20} strokeWidth={1.75} aria-hidden />
        </label>
      </div>
      <div className="drawer-side z-40">
        <label htmlFor={MENU_TOGGLE_ID} className="drawer-overlay" aria-hidden="true" />
        <div className="bg-base-100 flex min-h-full w-72 max-w-[85vw] flex-col gap-4 p-4">
          <DrawerLinks toggleId={MENU_TOGGLE_ID}>
            <ul className="menu w-full p-0">
              {LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{copy(link.key)}</Link>
                </li>
              ))}
              <HeaderCopyLink place={PLACE.menu} label={copy("copy-link.label")} />
            </ul>
            <div className="border-base-300 border-t pt-4 sm:hidden">
              <ThemeSwitch names={switchNames()} />
            </div>
            {p.signedIn ? null : (
              <Link href="/signin" className="btn btn-ghost justify-start sm:hidden">
                {copy("chrome.nav.signin")}
              </Link>
            )}
          </DrawerLinks>
        </div>
      </div>
    </div>
  );
}

export function Header(p: { entry?: AppEntry }): React.JSX.Element {
  const entry = p.entry ?? null;
  return (
    <>
      <Banner />
      <header className="border-base-300 sticky top-0 z-30 border-b" data-testid="public-header">
        <div aria-hidden className="bg-base-100/78 absolute inset-0 -z-10 backdrop-blur-md" />
        {/* No `flex-wrap`: a bar that wraps is a bar that grew instead of
            one that chose. What does not fit is in the drawer. */}
        <nav className="navbar mx-auto max-w-6xl gap-2 px-4">
          <div className="flex min-w-0 flex-1 items-center gap-6">
            <Brand href="/" testId="public-brand" />
            <ul className="hidden items-center gap-1 lg:flex">
              {LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="btn btn-ghost btn-sm font-medium">
                    {copy(link.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-none items-center gap-2">
            <HeaderCopyLink place={PLACE.bar} label={copy("copy-link.label")} />
            <span className="hidden sm:inline-flex" data-testid="public-header-theme">
              <ThemeSwitch names={switchNames()} />
            </span>
            {entry === null ? (
              <>
                <Link href="/signin" className="btn btn-ghost px-2">
                  {copy("chrome.nav.signin")}
                </Link>
                <HeaderCta label={copy("chrome.cta.start")} />
              </>
            ) : (
              <Link href={entry} className="btn btn-primary btn-sm" data-testid="public-header-app">
                {copy("chrome.cta.app")}
                <ArrowRight aria-hidden size={16} strokeWidth={1.75} />
              </Link>
            )}
            <PhoneMenu signedIn={entry !== null} />
          </div>
        </nav>
      </header>
    </>
  );
}
