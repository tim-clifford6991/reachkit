// SPEC §4 (2026-10-08, owner, issue 1339) — below the large breakpoint: the
// top bar, which stays on screen while the page scrolls.
//
// "On a phone the bottom bar is the navigation." There is no side panel
// below `lg` and so no control here that opens one; the 2026-10-07 menu
// button (issue 1322) is gone with the panel it opened. What the panel held
// and a phone still needs is on this bar instead: the brand, the domain, the
// theme control, and the publishing line — REQ-040's "visible from every
// screen", as the one statement `PublishingCard` draws from `lg`.
//
// A daisyUI `navbar` row over one line, in a bar of one fixed height
// (`bar.ts`), because the tab bars stick directly under it.
//
// The brand and the theme control on the first row; the domain and whether
// publishing is on under them, as board Plan draws the bar. The domain can be
// any length and is a value, so it is mono and clamped to one line. While
// publishing is not on, the line says why in the panel's own sentence,
// clamped to one line with its whole text in `title`.
import type React from "react";
import { copy } from "@/lib/presentation/copy";
import { Brand } from "@/app/_brand/Brand";
import { ThemeToggle } from "@/app/_theme/ThemeToggle";
import { themeNames } from "@/app/_theme/names";
import { TOP_BAR } from "./bar";
import { publishingStatement } from "./PublishingCard";
import type { ShellModel } from "./model";

export function TopBar(p: { shell: ShellModel }): React.JSX.Element {
  const on = p.shell.publishing.next !== null;
  const line = on ? copy("shell.publishing.state.autopilot") : publishingStatement(p.shell).line;
  return (
    <header
      className={`border-base-300 bg-base-100 flex min-w-0 flex-col justify-center gap-2 border-b px-4 ${TOP_BAR}`}
      data-testid="shell-top"
    >
      <div className="navbar min-h-0 min-w-0 gap-2 p-0">
        <span className="shrink-0">
          <Brand href="/app" />
        </span>
        <span className="flex-1" />
        <ThemeToggle names={themeNames()} />
      </div>
      <p className="flex min-w-0 items-center gap-3 text-xs">
        <span className="num min-w-0 shrink truncate text-base-content/70" title={p.shell.domain}>
          {p.shell.domain}
        </span>
        <span className="flex min-w-0 items-center gap-1.5 font-semibold" data-testid="shell-top-publishing">
          <span className={`status shrink-0 ${on ? "status-success" : "status-warning"}`} aria-hidden />
          <span className="min-w-0 truncate" title={line}>
            {line}
          </span>
        </span>
      </p>
    </header>
  );
}
