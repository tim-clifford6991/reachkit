// BUILD §4.4 — the app shell every app screen sits inside.
//
// "Left sidebar (222px, sticky): domain block (accent dot, domain, `Week n ·
// re-measured Mon`) · nav **Overview / Calendar / Settings** (Calendar shows
// item count) · footer autopilot card (state + next publish time + toggle).
// Mobile: sidebar hidden, top tabs. No other navigation."
//
// REQ-040's promise is that the publishing state is visible from *every*
// screen, which is why it lives in this layout and in no screen: a screen
// that forgot to render it would be the only way to break the promise, and
// there is no screen that renders it.
//
// **This layout owns the route's `Surface` root** (BP-018: "Every screen
// root is a `Surface`"; ADR-093 decision 6's sweep asserts exactly one
// `[data-surface]` per document). Under `/app` the shell *is* the screen
// root — the sidebar and the main column are what the band arms describe —
// so a page under `/app` declares no `Surface` of its own. `compact` is one
// column (top tabs above the content), `medium` is two (sidebar beside
// main), and `wide` is the same as `medium`: the day panel that changes at
// `--breakpoint-xl` belongs to the calendar screen (§4.6, issue #16), not
// to the frame.
//
// The shell is read once, here (`readShell`, request-cached), and passed
// down. `SidebarNav` and `TabBar` are the two client components — each
// needs the current pathname to mark the current destination — and they map
// over the same `DESTINATIONS` tuple, so a fourth destination cannot appear
// on one breakpoint only.
import type React from "react";
import { Surface } from "@/ui/layout";
import { copy } from "@/lib/presentation/copy";
import { DomainBlock } from "./_shell/DomainBlock";
import { PublishingCard } from "./_shell/PublishingCard";
import { SidebarNav } from "./_shell/SidebarNav";
import { StoppedNotice } from "./_shell/StoppedNotice";
import { TabBar } from "./_shell/TabBar";
import { readShell } from "./_shell/provider";
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
      <div className="rk-shell">
        {/* Below --breakpoint-lg: the sidebar is hidden and its three parts
            collapse into this header (REQ-040 c5). */}
        <header className="rk-shell-top" data-testid="shell-top">
          <DomainBlock shell={shell} />
          <TabBar />
          <PublishingCard shell={shell} />
        </header>

        <div className="rk-shell-body">
          <aside className="rk-sidebar" data-testid="shell-sidebar">
            {/* The column stretches so its rule runs the full height; the
                inner block is what sticks. See `shell.css`. */}
            <div className="rk-sidebar-inner">
              {/* The brand row the set draws at the top of the sidebar
                  (S12, UI-SPEC §2). The same wordmark and chip markup the
                  public header spends, from the same key — one word, one
                  home — because the customer crosses between the two and a
                  second spelling of the product's name would be visible. */}
              <p className="rk-wordmark" data-testid="shell-brand">
                <span className="rk-wordmark-chip" aria-hidden="true" />
                <span>{copy("chrome.wordmark")}</span>
              </p>
              <DomainBlock shell={shell} />
              {/* The set labels the three destinations. The eyebrow role
                  supplies the uppercase and the tracking; the string is
                  "Workspace". */}
              <div className="flex min-w-0 flex-col gap-1">
                <span className="eyebrow">{copy("shell.workspace")}</span>
                <SidebarNav waiting={shell.waiting} />
              </div>
              <PublishingCard shell={shell} />
            </div>
          </aside>
          <main className="rk-main">
            {/* REQ-092 c3: stated on the screen the customer lands on, once
                — not in the header and the sidebar the way the domain block
                and the publishing card are, because two copies of one
                statement is two accounts of one fact. */}
            <StoppedNotice stopped={shell.stopped} timeZone={shell.timeZone} />
            {children}
          </main>
        </div>
      </div>
    </Surface>
  );
}
