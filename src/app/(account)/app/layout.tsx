// Canvas: Dashboard — the app shell every app screen sits inside.
//
// The artboard's sidebar: the brand, the Workspace nav, and at its foot the
// autopilot block with the domain under it. Below the medium band the sidebar
// is hidden and those parts collapse into the top header — the same three
// destinations stay reachable, as one row with its labels and counts kept.
//
// The publishing state lives here and in no screen: a screen that forgot to
// render it would be the only way to break the promise that it is visible
// from every screen, and there is no screen that renders it.
//
// This layout owns the route's `Surface` root, so a page under `/app`
// declares none of its own. `shell.css` is still imported because the sibling
// app screens spend `.rk-prov` and its neighbours; the shell itself now draws
// in Tailwind utilities over the theme's tokens.
import type React from "react";
import { TrendingUp } from "lucide-react";
import { Surface } from "@/ui/layout";
import { copy } from "@/lib/presentation/copy";
import { DomainBlock } from "./_shell/DomainBlock";
import { PublishingCard } from "./_shell/PublishingCard";
import { SidebarNav } from "./_shell/SidebarNav";
import { StoppedNotice } from "./_shell/StoppedNotice";
import { readShell } from "./_shell/provider";
import {
  MAIN,
  MARK,
  NAV_GROUP,
  SHELL,
  SHELL_BODY,
  SHELL_TOP,
  SIDEBAR,
  SIDEBAR_FOOT,
  SIDEBAR_INNER,
  SIDEBAR_TOP,
  WORDMARK,
} from "./_shell/style";
import "@/ui/layout/shell.css";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  const shell = await readShell();

  return (
    <Surface
      arms={{
        compact: { kind: "columns", count: 1 },
        medium: { kind: "columns", count: 2 },
        wide: { kind: "same-as-below" },
      }}
    >
      <div className={SHELL}>
        <header className={SHELL_TOP} data-testid="shell-top">
          <DomainBlock shell={shell} />
          <SidebarNav waiting={shell.waiting} row />
          <PublishingCard shell={shell} />
        </header>

        <div className={SHELL_BODY}>
          <aside className={SIDEBAR} data-testid="shell-sidebar">
            <div className={SIDEBAR_INNER}>
              <div className={SIDEBAR_TOP}>
                <p className={WORDMARK} data-testid="shell-brand">
                  <span className={MARK} aria-hidden="true">
                    <TrendingUp size={15} strokeWidth={2} aria-hidden />
                  </span>
                  <span>{copy("chrome.wordmark")}</span>
                </p>
                <div className={NAV_GROUP}>
                  <span className="eyebrow">{copy("shell.workspace")}</span>
                  <SidebarNav waiting={shell.waiting} />
                </div>
              </div>
              {/* The artboard puts the autopilot block and the domain at the
                  foot of the column, pushed there by the free space. */}
              <div className={SIDEBAR_FOOT}>
                <PublishingCard shell={shell} />
                <DomainBlock shell={shell} />
              </div>
            </div>
          </aside>
          <main className={MAIN}>
            {/* Stated once, on the screen the customer lands on — not in the
                header and the sidebar the way the domain block is, because
                two copies of one statement is two accounts of one fact. */}
            <StoppedNotice stopped={shell.stopped} timeZone={shell.timeZone} />
            {children}
          </main>
        </div>
      </div>
    </Surface>
  );
}
