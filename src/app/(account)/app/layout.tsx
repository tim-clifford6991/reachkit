// SPEC §4 — the signed-in shell every /app screen sits inside.
//
// **2026-09-20 (#908, issue #911): it is one daisyUI `drawer`.**
//
//   at `lg` and above  `lg:drawer-open` — the side is always on screen. The
//                      one toggle switches it between the full panel and a
//                      72px icon rail, through daisyUI's `is-drawer-open:` /
//                      `is-drawer-close:` variants. No script opens or
//                      closes anything; `_shell/drawer.ts` only remembers
//                      the choice for this browser.
//   below `lg`         the same side is a drawer over the screen, opened by
//                      the top bar's button, and the three menu items stand
//                      in a daisyUI `dock` at the foot of the viewport.
//
// The panel holds, in order: the brand with the collapse button, the domain
// block, the menu (Overview · Plan · Settings, the waiting count on
// Overview), the *Waiting for you* card, the onboarding line while a pass
// runs, the two shortcuts, the theme control and the autopilot card.
//
// **It renders once.** Until this issue the shell drew the same parts twice
// — a header below `lg` and a sidebar above it, one hidden per breakpoint —
// which is why `OnboardingPanel` had to poll `offsetParent` to work out
// whether it was the visible copy. One drawer needs one copy, so both the
// double render and that guard are gone.
//
// REQ-040's promise is that the publishing state is visible from *every*
// screen, which is why it lives in this layout and in no screen.
//
// **This layout owns the route's `Surface` root** — exactly one
// `[data-surface]` per document. A page under `/app` declares no `Surface`
// of its own.
//
// **2026-09-20 (#908, issue 912): the frame paints before any of it is
// read.** SPEC §4 — "No loading screens in the app: a route paints its
// shell and daisyUI `skeleton` placeholders at once and fills in."
//
// This layout awaits the session gate and the request's nonce, and nothing
// else. Every part with a query behind it is a child of its own
// `<Suspense>` boundary (`_shell/slots.tsx`), so the drawer, the brand, the
// three menu items and the content well are in the **first server
// response** and each part lands as it resolves. The shell is still read
// once — `readShell` is `React.cache`d, so the slots share one query.
//
// The CSP nonce is read the way the root layout reads it (#331): off the
// policy `src/middleware.ts` forwarded on this request.
import type React from "react";
import { Suspense } from "react";
import { PanelLeftClose, PanelLeftOpen, Send } from "lucide-react";
import { Brand, BrandMark } from "@/app/_brand/Brand";
import { Surface } from "@/ui/layout";
import { copy } from "@/lib/presentation/copy";
import { AppDock } from "./_shell/AppDock";
import { SidebarNav } from "./_shell/SidebarNav";
import { ThemeToggle } from "@/app/_theme/ThemeToggle";
import { themeNames } from "@/app/_theme/names";
import { DRAWER_FOCUS_RING, DRAWER_TOGGLE_ID, RAIL_SCRIPT } from "./_shell/drawer";
import { cspNonce } from "./_shell/nonce";
import { requireSetUpAccount } from "./_session/account";
import {
  DomainSlot,
  OnboardingSlot,
  PublishingSlot,
  ShortcutsSlot,
  StoppedNoticeSlot,
  TopBarSlot,
  WaitingCardSlot,
  readingShell,
  waitingCount,
} from "./_shell/slots";
import {
  DomainSkeleton,
  PanelCardSkeleton,
  TopBarSkeleton,
} from "./_shell/skeletons";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  // **The only two reads this layout waits for** (issue 912).
  //
  // `requireSetUpAccount` is the gate: one signed cookie and one `sites`
  // row, and it decides whether a stranger should be looking at this frame
  // at all. Suspending it would stream a signed-in shell and redirect
  // afterwards — the right answer arriving after the wrong picture.
  // `cspNonce` is a header on this request, not a query.
  //
  // Everything else the shell draws is a `_shell/slots.tsx` child behind a
  // boundary of its own, so the frame below is in the first server
  // response and each part lands as it resolves. That is the gap the old
  // `app/loading.tsx` documented and could not close: a `loading.js` never
  // covers its own layout's reads.
  const [, nonce] = await Promise.all([requireSetUpAccount(), cspNonce()]);
  // **The one shell read, started here and never awaited here.** Every slot
  // below takes this same promise, so the six of them are one query as a
  // fact rather than as a hope about `React.cache`'s scope.
  const shell = readingShell();
  // The count the menu badges carry. The three menu items have no read
  // behind them and must be on screen at once; `SidebarNav` and `AppDock`
  // read this with `use()` inside a boundary around the badge alone.
  const waiting = waitingCount(shell);

  return (
    <Surface
      arms={{
        compact: { kind: "columns", count: 1 },
        medium: { kind: "columns", count: 2 },
        wide: { kind: "same-as-below" },
      }}
    >
      <div className="drawer lg:drawer-open">
        {/*
          The one control. It is the focusable, announceable thing behind
          every `<label>` in this shell, which is why it carries the panel's
          name; daisyUI hides it entirely at `drawer-open`, and `lg:block!`
          puts it back so the collapse is reachable from the keyboard at the
          band where the collapse exists at all.
        */}
        <input
          id={DRAWER_TOGGLE_ID}
          type="checkbox"
          className="drawer-toggle lg:block!"
          aria-label={copy("shell.panel.label")}
        />
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: RAIL_SCRIPT }} />

        <div className="drawer-content flex min-w-0 flex-col gap-4 pb-20 lg:pb-0">
          <Suspense fallback={<TopBarSkeleton />}>
            <TopBarSlot shell={shell} />
          </Suspense>
          <main className="flex min-w-0 flex-1 flex-col gap-4">
            {/* REQ-092 c3: stated once, on the screen the customer lands on.
                No fallback: a stop is the exception, so a box held for one
                would be an empty alert on every screen that has none. */}
            <Suspense fallback={null}>
              <StoppedNoticeSlot shell={shell} />
            </Suspense>
            {children}
          </main>
          <AppDock waiting={waiting} />
        </div>

        {/*
          Two overrides, both deliberate.

          `lg:overflow-visible!` — daisyUI makes the side a scroll
          container, and a scroll container clips, which would cut the
          rail's tooltips and the theme menu off at 72px. The panel below
          keeps its own scrollbar, so nothing tall is trapped.

          `lg:h-auto!` with the panel's own `calc(100dvh - 2 × gutter)` —
          daisyUI gives the side a flat `100dvh`, which inside the
          surface's own block padding makes every `/app` screen one gutter
          taller than the viewport and gives the whole app a scrollbar with
          nothing under it. The two subtracted values are the surface's
          gutters at those two bands (`--s-5`, `--s-6`).
        */}
        <div className="drawer-side z-30 lg:h-auto! lg:overflow-visible!">
          <label htmlFor={DRAWER_TOGGLE_ID} className="drawer-overlay" aria-hidden="true" />
          <aside
            className="border-base-300 bg-base-100 flex h-full w-60 max-w-[85vw] flex-col border-e p-4 lg:h-[calc(100dvh-3rem)] lg:is-drawer-open:w-18 lg:is-drawer-open:items-center lg:is-drawer-open:p-2 xl:h-[calc(100dvh-4rem)]"
            // Named for the same reason the draft screen's panel is (#328):
            // a screen can carry a second `<aside>`, and two unnamed
            // complementary landmarks are indistinguishable. It is the
            // toggle's own name, so the control and the region it opens are
            // called the same thing.
            aria-label={copy("shell.panel.label")}
            data-testid="shell-sidebar"
          >
            {/* ── the full panel ─────────────────────────────────── */}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-y-auto lg:is-drawer-open:hidden">
              <div className="flex min-w-0 items-center gap-2">
                <Brand href="/app" testId="shell-brand" />
                <label
                  htmlFor={DRAWER_TOGGLE_ID}
                  className={`btn btn-ghost btn-square btn-sm tooltip tooltip-bottom ms-auto hidden shrink-0 lg:flex ${DRAWER_FOCUS_RING}`}
                  data-tip={copy("shell.panel.collapse")}
                  data-testid="shell-collapse"
                >
                  <PanelLeftClose size={20} strokeWidth={1.75} aria-hidden />
                </label>
              </div>
              <Suspense fallback={<DomainSkeleton />}>
                <DomainSlot shell={shell} />
              </Suspense>
              <div className="flex min-w-0 flex-col gap-1">
                {/* `.eyebrow`, not `text-xs`: the rung is ruled
                    (`docs/DESIGN.md`: "eyebrow 11 uppercase 700 .1em") and
                    carries its case, weight and ink with the size, which no
                    single utility does. It was first reached for because
                    `type.css` out-ranked `text-xs`; that is fixed at the
                    cause now (#941) and the class is still the right one. */}
                <h2 className="eyebrow px-0">{copy("shell.workspace")}</h2>
                <SidebarNav waiting={waiting} />
              </div>
              <Suspense fallback={<PanelCardSkeleton testId="shell-waiting-skeleton" className="h-20 w-full" />}>
                <WaitingCardSlot shell={shell} />
              </Suspense>
              {/* Issue #782: the deep pass and the first draft run in the
                  background; the panel says which step until they end. */}
              <Suspense fallback={<PanelCardSkeleton testId="shell-onboarding-skeleton" className="h-12 w-full" />}>
                <OnboardingSlot />
              </Suspense>
              <div className="mt-auto flex min-w-0 flex-col gap-3">
                <Suspense fallback={<PanelCardSkeleton testId="shell-shortcuts-skeleton" className="h-8 w-full" />}>
                  <ShortcutsSlot shell={shell} />
                </Suspense>
                <Suspense fallback={<PanelCardSkeleton testId="shell-publishing-skeleton" className="h-24 w-full" />}>
                  <PublishingSlot shell={shell} />
                </Suspense>
                <ThemeToggle names={themeNames()} up />
              </div>
            </div>

            {/* ── the 72px icon rail ─────────────────────────────── */}
            <div
              className="hidden flex-col items-center gap-2 lg:is-drawer-open:flex lg:is-drawer-open:h-full"
              data-testid="shell-rail"
            >
              <BrandMark size="lg" />
              <label
                htmlFor={DRAWER_TOGGLE_ID}
                className={`btn btn-ghost btn-square btn-sm tooltip tooltip-right shrink-0 ${DRAWER_FOCUS_RING}`}
                data-tip={copy("shell.panel.open")}
                data-testid="shell-expand"
              >
                <PanelLeftOpen size={20} strokeWidth={1.75} aria-hidden />
              </label>
              <SidebarNav waiting={waiting} rail />
              <div className="mt-auto flex flex-col items-center gap-2">
                <ThemeToggle names={themeNames()} up />
                <span
                  className="text-success tooltip tooltip-right grid size-10 shrink-0 place-items-center"
                  data-tip={copy("shell.publishing.mode.autopilot")}
                  data-testid="shell-rail-autopilot"
                >
                  <Send size={20} strokeWidth={1.75} aria-hidden />
                  <span className="sr-only">{copy("shell.publishing.mode.autopilot")}</span>
                </span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </Surface>
  );
}
