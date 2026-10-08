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
// The domain can be any length and is a value, so it is mono and clamped to
// one line; the brand and the control are fixed-width and never give way.
// The publishing line is a sentence, clamped to one line with its whole
// text in `title`.
import type React from "react";
import { Send } from "lucide-react";
import { Brand } from "@/app/_brand/Brand";
import { ThemeToggle } from "@/app/_theme/ThemeToggle";
import { themeNames } from "@/app/_theme/names";
import { TOP_BAR } from "./bar";
import { publishingStatement } from "./PublishingCard";
import type { ShellModel } from "./model";

export function TopBar(p: { shell: ShellModel }): React.JSX.Element {
  const { line } = publishingStatement(p.shell);
  return (
    <header
      className={`border-base-300 bg-base-100 flex min-w-0 flex-col justify-center gap-2 border-b px-4 ${TOP_BAR}`}
      data-testid="shell-top"
    >
      <div className="navbar min-h-0 min-w-0 gap-2 p-0">
        <span className="shrink-0">
          <Brand href="/app" />
        </span>
        <span className="num min-w-0 flex-1 truncate text-end text-xs opacity-70" title={p.shell.domain}>
          {p.shell.domain}
        </span>
        <ThemeToggle names={themeNames()} />
      </div>
      <p className="flex min-w-0 items-center gap-1.5 text-xs" data-testid="shell-top-publishing">
        <Send size={14} strokeWidth={1.75} className="text-success shrink-0" aria-hidden />
        <span className="text-base-content/70 min-w-0 truncate" title={line}>
          {line}
        </span>
      </p>
    </header>
  );
}
