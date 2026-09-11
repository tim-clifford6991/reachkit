"use client";

/**
 * BUILD §4.4's app shell, assembled from registered components.
 *
 * This is a SCREEN COMPOSITION, not a registry row — components.md §4 names
 * `SidebarNav` and the other compositions and says explicitly that they are
 * owned by their surface blueprints and "must not become" registry rows.
 *
 * "Mobile: sidebar hidden, top tabs. No other navigation." The top tabs are
 * `TabBar`, which is components.md §4 gap 5 and PROPOSED — it is built here
 * as a shell-local composition over the registered `Tabs` needing no custom
 * CSS, which is the evidence for the architect's boundary call, not the
 * call itself. It carries its proposed mark on screen.
 *
 * WHAT §4.4 FIXES AND WHAT IS DERIVED. That the sidebar hides and tabs take
 * over is §4.4's own sentence — a FOUND rule. The width at which it happens
 * is --breakpoint-lg, derived under rule 1.1 (tokens.md §2b): 222 for the
 * sidebar plus 48 of main padding plus the 696 a seven-column grid needs at
 * --w-cell-min is 966, and 1024 is the smallest named step that clears it.
 *
 * The rounded frame no longer clips its own overflow. An `overflow: hidden`
 * ancestor silently kills every `position: sticky` descendant, and this one
 * had two — the sidebar and the day panel. The walkthrough's own note asks
 * the reviewer to "scroll and watch" a stickiness that could not happen.
 */
import { useState } from "react";
import type { ReactNode } from "react";
import { Num } from "@/components/Num";
import { Toggle } from "@/components/registry/primitives";
import { Sidebar } from "@/components/registry/surfaces";
import { TabBar } from "@/components/proposed";
import { DESTINATIONS, SHELL } from "@/mock/data";

export function AppShell({
  current,
  children,
}: {
  current: (typeof DESTINATIONS)[number];
  children: ReactNode;
}) {
  const [tab, setTab] = useState(DESTINATIONS.indexOf(current));

  return (
    <div className="rk rk-shell">
      {/* narrow viewport — sidebar hidden, top tabs. §4.4, at --breakpoint-lg */}
      <div
        className="lg:hidden"
        style={{
          padding: "var(--s-3)",
          borderBottom: "var(--border-hair) solid var(--line)",
        }}
      >
        <TabBar destinations={DESTINATIONS} selected={tab} onSelect={setTab} />
      </div>

      <div className="rk-shell-body">
        <div className="hidden lg:flex">
          <Sidebar
            domainBlock={
              <div className="stack-1">
                <div className="row">
                  <span className="rk-dot" />
                  <span className="t-sm" style={{ fontWeight: 700 }}>
                    <Num>{SHELL.domain}</Num>
                  </span>
                </div>
                <p className="prov">{SHELL.week}</p>
              </div>
            }
            destinations={DESTINATIONS.map((d) => ({
              label: d,
              count: d === "Calendar" ? SHELL.counts.Calendar : 0,
              current: d === current,
            }))}
            publishingState={
              <div className="sunk stack-2">
                <p className="eb">{SHELL.publishing.state}</p>
                <p className="prov">
                  <Num>{SHELL.publishing.next}</Num>
                </p>
                <Toggle label={SHELL.publishing.toggleLabel} checked onChange={() => undefined} />
              </div>
            }
          />
        </div>
        <div className="rk-main">{children}</div>
      </div>
    </div>
  );
}
