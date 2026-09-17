// SPEC §4 — the signed-in shell every /app screen sits inside.
//
// From `lg` a sticky sidebar: the brand, the domain block, the Workspace nav
// (Overview / Calendar / Settings, Calendar with its waiting count) and the
// publishing card at its foot. Below `lg` the sidebar is hidden and the same
// three parts stand in a header above the screen, the nav as one horizontal
// row with its labels and count kept. No drawer: the nav is never behind a
// control, and the shell needs no client runtime beyond marking the current
// destination.
//
// REQ-040's promise is that the publishing state is visible from *every*
// screen, which is why it lives in this layout and in no screen.
//
// **This layout owns the route's `Surface` root** — exactly one
// `[data-surface]` per document. A page under `/app` declares no `Surface`
// of its own.
//
// The shell is read once, here (`readShell`, request-cached), and passed down.
import type React from "react";
import { TrendingUp } from "lucide-react";
import { Surface } from "@/ui/layout";
import { copy } from "@/lib/presentation/copy";
import { DomainBlock } from "./_shell/DomainBlock";
import { PublishingCard } from "./_shell/PublishingCard";
import { SidebarNav } from "./_shell/SidebarNav";
import { StoppedNotice } from "./_shell/StoppedNotice";
import { ThemeToggle } from "@/app/_theme/ThemeToggle";
import { readShell } from "./_shell/provider";
import { readOnboarding } from "./_shell/onboarding";
import { OnboardingStatus } from "./_shell/OnboardingStatus";

/** The product's mark, as the public header draws it, linking home to /app. */
function Brand(): React.JSX.Element {
  return (
    <a href="/app" className="flex items-center gap-2 text-lg font-extrabold tracking-tight" data-testid="shell-brand">
      <span className="grid size-7 place-items-center rounded-field bg-primary text-primary-content" aria-hidden>
        <TrendingUp size={16} strokeWidth={1.75} aria-hidden />
      </span>
      <span>{copy("chrome.wordmark")}</span>
    </a>
  );
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  const [shell, onboarding] = await Promise.all([readShell(), readOnboarding()]);

  return (
    <Surface
      arms={{
        compact: { kind: "columns", count: 1 },
        medium: { kind: "columns", count: 2 },
        wide: { kind: "same-as-below" },
      }}
    >
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
        {/* Below lg: the sidebar's three parts, in a header (REQ-040 c5). */}
        <header
          className="flex min-w-0 flex-col gap-3 rounded-box border border-base-300 bg-base-100 p-3 lg:hidden"
          data-testid="shell-top"
        >
          <div className="navbar min-h-0 gap-3 p-0">
            <div className="min-w-0 flex-1">
              <DomainBlock shell={shell} />
            </div>
          </div>
          <SidebarNav waiting={shell.waiting} row />
          <OnboardingStatus key={onboarding.kind} state={onboarding} />
          <PublishingCard shell={shell} />
          <ThemeToggle />
        </header>

        <aside
          className="hidden w-56 shrink-0 lg:sticky lg:top-4 lg:block"
          data-testid="shell-sidebar"
        >
          <div className="flex min-h-[calc(100vh-2rem)] flex-col gap-5 rounded-box border border-base-300 bg-base-100 p-4">
            <Brand />
            <DomainBlock shell={shell} />
            <div className="flex min-w-0 flex-col gap-1">
              <h2 className="menu-title px-0 text-xs uppercase tracking-wide">{copy("shell.workspace")}</h2>
              <SidebarNav waiting={shell.waiting} />
            </div>
            {/* Issue #782: the deep pass and the first draft run in the
                background; the panel says which step until they end. */}
            <OnboardingStatus key={onboarding.kind} state={onboarding} />
            <div className="mt-auto">
              <PublishingCard shell={shell} />
              <ThemeToggle up />
            </div>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col gap-4">
          {/* REQ-092 c3: stated once, on the screen the customer lands on. */}
          <StoppedNotice stopped={shell.stopped} timeZone={shell.timeZone} />
          {children}
        </main>
      </div>
    </Surface>
  );
}
