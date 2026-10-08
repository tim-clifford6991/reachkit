// SPEC §4 (2026-09-20, #908) — below the large breakpoint: a top bar with
// the menu button, the brand and the domain.
//
// **2026-10-07 (owner, issue 1322): the menu button is the first item.** The
// panel is daisyUI's left `drawer-side`, so the control that opens it stands
// at the start of the bar, on the side the panel comes in from. Its tooltip
// opens to the right for the same reason: to the left of a control at the
// left edge there is no screen.
//
// A daisyUI `navbar`. The menu button is a `<label>` for the shell's one
// drawer toggle, so the side panel opens with no client runtime at all; the
// toggle itself is the focusable control and carries the panel's name
// (`layout.tsx`). `drawer-button` is daisyUI's own class for that label —
// it is what draws the focus ring when the toggle is focused.
//
// The domain can be any length and is a value, so it is mono and clamped to
// one line; the button and the brand are fixed-width and never give way.
import type React from "react";
import { PanelLeftOpen } from "lucide-react";
import { Brand } from "@/app/_brand/Brand";
import { copy } from "@/lib/presentation/copy";
import { DRAWER_FOCUS_RING, DRAWER_TOGGLE_ID } from "./drawer";
import type { ShellModel } from "./model";

export function TopBar(p: { shell: ShellModel }): React.JSX.Element {
  return (
    <header
      className="navbar border-base-300 bg-base-100 min-h-0 gap-2 rounded-box border p-2 lg:hidden"
      data-testid="shell-top"
    >
      <label
        htmlFor={DRAWER_TOGGLE_ID}
        className={`btn btn-ghost btn-square btn-sm drawer-button tooltip tooltip-right shrink-0 ${DRAWER_FOCUS_RING}`}
        data-tip={copy("shell.panel.open")}
        data-testid="shell-menu-button"
      >
        <PanelLeftOpen size={20} strokeWidth={1.75} aria-hidden />
      </label>
      <span className="shrink-0">
        <Brand href="/app" />
      </span>
      <span className="num min-w-0 flex-1 truncate text-end text-xs opacity-70" title={p.shell.domain}>
        {p.shell.domain}
      </span>
    </header>
  );
}
