// SPEC §4 (2026-09-20, #908), issue 912 — the shell's parts, each able to
// arrive on its own.
//
// **Why these exist at all.** The layout used to `await` the shell read,
// the onboarding read and the nonce together before returning any JSX, so a
// *cold* arrival at `/app` painted nothing until the database answered —
// the gap the old `app/loading.tsx` documented in its own header and could
// not close, because "if the layout accesses uncached or runtime data …
// `loading.js` will not show a fallback for it" (Next's `loading.md`).
//
// A `<Suspense>` boundary can only suspend a *child*, so each part of the
// shell that needs a read is a child now: one small async server component
// per part, each behind its own boundary in the layout. React streams the
// frame first and every part as it resolves.
//
// **One read, handed in.** The layout starts `readShell()` once and passes
// the *promise* to every slot; no slot calls the reader itself. `readShell`
// is `React.cache`d and would mostly dedupe anyway, but "mostly" is the
// wrong word for a screen's query count: a `cache` scope belongs to a
// render pass, and these six awaits are spread across six of them. Passing
// the promise makes one query a fact about this file rather than a
// property of somebody else's memoisation.
//
// **They add no behaviour.** Every slot below is a read and a render of a
// component that already existed and is unchanged. What is new is *when*
// each one is allowed to be on screen, which is the whole of this issue.
//
// **The session is not in here, deliberately.** `requireSetUpAccount()`
// stays awaited in the layout: it is one signed cookie and one `sites`
// row, and it is the read that decides whether a signed-out visitor should
// be looking at this shell at all. Suspending it would stream a signed-in
// frame to a stranger and then redirect them — the right answer arriving
// after the wrong picture.
import type React from "react";
import { DomainBlock } from "./DomainBlock";
import { OnboardingStatus } from "./OnboardingStatus";
import { PublishingCard } from "./PublishingCard";
import { StoppedNotice } from "./StoppedNotice";
import { TopBar } from "./TopBar";
import { WaitingCard } from "./WaitingCard";
import { readShell } from "./provider";
import type { ShellModel } from "./model";
import { readOnboarding } from "./onboarding";
import { MARKET_TOO_SMALL, readCategoryChoice } from "./remeasure";
import { requireSetUpAccount } from "../_session/account";
import { setupChannelName } from "@/lib/scan/deep/channel";

/** What every slot below takes: the one read, in flight. */
interface Reading {
  shell: Promise<ShellModel>;
}

export async function TopBarSlot(p: Reading): Promise<React.JSX.Element> {
  return <TopBar shell={await p.shell} />;
}

export async function DomainSlot(p: Reading): Promise<React.JSX.Element> {
  return <DomainBlock shell={await p.shell} />;
}

export async function WaitingCardSlot(p: Reading): Promise<React.JSX.Element | null> {
  const shell = await p.shell;
  return <WaitingCard review={shell.review} timeZone={shell.timeZone} />;
}

export async function StoppedNoticeSlot(p: Reading): Promise<React.JSX.Element | null> {
  const shell = await p.shell;
  return <StoppedNotice stopped={shell.stopped} timeZone={shell.timeZone} />;
}

export async function PublishingSlot(p: Reading): Promise<React.JSX.Element> {
  return <PublishingCard shell={await p.shell} />;
}

/**
 * The onboarding line, and the broader categories a market too small is
 * offered beside it (issue 837).
 *
 * The `key` on `OnboardingStatus` is the state's own kind, as the layout
 * set it: the panel's running arm subscribes to a channel, and a state that
 * changes kind has to remount rather than re-subscribe.
 */
export async function OnboardingSlot(p: Reading): Promise<React.JSX.Element | null> {
  const onboarding = await readOnboarding();
  const choice =
    onboarding.kind === "notice" && onboarding.key === MARKET_TOO_SMALL
      ? await readCategoryChoice()
      : null;
  const shell = await p.shell;
  // Issue 1196: the running panel listens on the site's own channel. The
  // name is composed here from the session's site, never in the browser.
  let channel: string | null = null;
  if (onboarding.kind === "running") {
    channel = setupChannelName((await requireSetUpAccount()).siteId);
  }
  return (
    <OnboardingStatus
      key={onboarding.kind}
      state={onboarding}
      choice={choice}
      timeZone={shell.timeZone}
      channel={channel}
    />
  );
}

/**
 * The waiting count, as a promise (REQ-040 c2).
 *
 * **Handed to the nav rather than awaited for it.** The three menu items
 * are the shell: they have no read behind them and they must be on screen
 * in the first response. Only the badge beside *Overview* needs the count,
 * so the count travels down as a promise and `SidebarNav` reads it with
 * `use()` inside a boundary of its own — the nav paints at once and the
 * number lands on it. One DOM, one nav, no second copy of the menu.
 */
/** The one read, started once. Exported so the layout can hold it and
 *  hand it to every slot. */
export function readingShell(): Promise<ShellModel> {
  return readShell();
}

export function waitingCount(shell: Promise<ShellModel>): Promise<number> {
  return shell.then((model) => model.waiting);
}
