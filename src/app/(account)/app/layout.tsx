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
// The shell is read once, here (`readShell`, request-cached), and passed
// down. The CSP nonce is read the way the root layout reads it (#331):
// off the policy `src/middleware.ts` forwarded on this request.
import type React from "react";
import { PanelLeftClose, PanelLeftOpen, Send } from "lucide-react";
import { Brand, BrandMark } from "@/app/_brand/Brand";
import { Surface } from "@/ui/layout";
import { copy } from "@/lib/presentation/copy";
import { AppDock } from "./_shell/AppDock";
import { DomainBlock } from "./_shell/DomainBlock";
import { PublishingCard } from "./_shell/PublishingCard";
import { Shortcuts } from "./_shell/Shortcuts";
import { SidebarNav } from "./_shell/SidebarNav";
import { StoppedNotice } from "./_shell/StoppedNotice";
import { TopBar } from "./_shell/TopBar";
import { WaitingCard } from "./_shell/WaitingCard";
import { ThemeToggle } from "@/app/_theme/ThemeToggle";
import { DRAWER_TOGGLE_ID, RAIL_SCRIPT } from "./_shell/drawer";
import { cspNonce } from "./_shell/nonce";
import { readShell } from "./_shell/provider";
import { readOnboarding } from "./_shell/onboarding";
import { MARKET_TOO_SMALL, readCategoryChoice } from "./_shell/remeasure";
import { OnboardingStatus } from "./_shell/OnboardingStatus";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  const [shell, onboarding, nonce] = await Promise.all([
    readShell(),
    readOnboarding(),
    cspNonce(),
  ]);
  // Issue 837: a market too small is offered broader categories beside its
  // notice, and any one of them measures again now.
  const choice =
    onboarding.kind === "notice" && onboarding.key === MARKET_TOO_SMALL ? await readCategoryChoice() : null;

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
          <TopBar shell={shell} />
          <main className="flex min-w-0 flex-1 flex-col gap-4">
            {/* REQ-092 c3: stated once, on the screen the customer lands on. */}
            <StoppedNotice stopped={shell.stopped} timeZone={shell.timeZone} />
            {children}
          </main>
          <AppDock waiting={shell.waiting} />
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
            data-testid="shell-sidebar"
          >
            {/* ── the full panel ─────────────────────────────────── */}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-y-auto lg:is-drawer-open:hidden">
              <div className="flex min-w-0 items-center gap-2">
                <Brand href="/app" testId="shell-brand" />
                <label
                  htmlFor={DRAWER_TOGGLE_ID}
                  className="btn btn-ghost btn-square btn-sm tooltip tooltip-bottom ms-auto hidden shrink-0 lg:flex"
                  data-tip={copy("shell.panel.collapse")}
                  data-testid="shell-collapse"
                >
                  <PanelLeftClose size={20} strokeWidth={1.75} aria-hidden />
                </label>
              </div>
              <DomainBlock shell={shell} />
              <div className="flex min-w-0 flex-col gap-1">
                {/* `.eyebrow`, not `text-xs`: the rung is ruled
                    (`docs/DESIGN.md`: "eyebrow 11 uppercase 700 .1em") and
                    carries its case, weight and ink with the size, which no
                    single utility does. It was first reached for because
                    `type.css` out-ranked `text-xs`; that is fixed at the
                    cause now (#941) and the class is still the right one. */}
                <h2 className="eyebrow px-0">{copy("shell.workspace")}</h2>
                <SidebarNav waiting={shell.waiting} />
              </div>
              <WaitingCard review={shell.review} timeZone={shell.timeZone} />
              {/* Issue #782: the deep pass and the first draft run in the
                  background; the panel says which step until they end. */}
              <OnboardingStatus key={onboarding.kind} state={onboarding} choice={choice} />
              <div className="mt-auto flex min-w-0 flex-col gap-3">
                <Shortcuts blog={shell.blog} />
                <PublishingCard shell={shell} />
                <ThemeToggle up />
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
                className="btn btn-ghost btn-square btn-sm tooltip tooltip-right shrink-0"
                data-tip={copy("shell.panel.open")}
                data-testid="shell-expand"
              >
                <PanelLeftOpen size={20} strokeWidth={1.75} aria-hidden />
              </label>
              <SidebarNav waiting={shell.waiting} rail />
              <div className="mt-auto flex flex-col items-center gap-2">
                <ThemeToggle up />
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
