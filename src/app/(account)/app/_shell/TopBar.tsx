// SPEC §4 (2026-09-20, #908) — below the large breakpoint: "a top bar with
// brand, domain and menu button".
//
// A daisyUI `navbar`. The menu button is a `<label>` for the shell's one
// drawer toggle, so the side panel opens with no client runtime at all; the
// toggle itself is the focusable control and carries the panel's name
// (`layout.tsx`). `drawer-button` is daisyUI's own class for that label —
// it is what draws the focus ring when the toggle is focused.
//
// The domain can be any length and is a value, so it is mono and clamped to
// one line; the brand and the button are fixed-width and never give way.
import type React from "react";
import { PanelLeftOpen, TrendingUp } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { DRAWER_TOGGLE_ID } from "./drawer";
import type { ShellModel } from "./model";

export function TopBar(p: { shell: ShellModel }): React.JSX.Element {
  return (
    <header
      className="navbar border-base-300 bg-base-100 min-h-0 gap-2 rounded-box border p-2 lg:hidden"
      data-testid="shell-top"
    >
      <a href="/app" className="flex shrink-0 items-center gap-2 font-extrabold tracking-tight">
        <span className="grid size-7 shrink-0 place-items-center rounded-field bg-primary text-primary-content" aria-hidden>
          <TrendingUp size={16} strokeWidth={1.75} aria-hidden />
        </span>
        <span>{copy("chrome.wordmark")}</span>
      </a>
      <span className="num min-w-0 flex-1 truncate text-end text-xs opacity-60" title={p.shell.domain}>
        {p.shell.domain}
      </span>
      <label
        htmlFor={DRAWER_TOGGLE_ID}
        className="btn btn-ghost btn-square btn-sm drawer-button tooltip tooltip-left shrink-0"
        data-tip={copy("shell.panel.open")}
        data-testid="shell-menu-button"
      >
        <PanelLeftOpen size={20} strokeWidth={1.75} aria-hidden />
      </label>
    </header>
  );
}
