// SPEC §4 (2026-09-20, #908), issue 1320 — Plan's head: the screen's name,
// the line under it, and the place the month switcher takes.
//
// One function for the loaded screen and its waiting state, so the two
// cannot be two shapes. Neither the name nor the line has a read behind it
// — both are registry sentences — so `loading.tsx` draws them themselves
// and only the switcher, which needs the month that was asked for, waits
// as a box.
import type React from "react";
import { copy } from "@/lib/presentation/copy";
import { writtenLine } from "../_shell/written";

export function PlanHead(p: { children: React.ReactNode }): React.JSX.Element {
  // SPEC §4 (2026-09-20, #908, issue #914): "*Plan* is the calendar's
  // on-screen name." The screen is named by the menu item that reaches it,
  // which is the idiom Settings and Overview already keep — their `h1` is
  // `shell.nav.*` and the written line sits under it. `calendar.head` is
  // that line here (the owner's sentence of 2026-09-11, #516), so nothing
  // it says is lost by the heading taking the name.
  const head = writtenLine("calendar.head");
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-2xl font-semibold">{copy("shell.nav.plan")}</h1>
        {head === null ? null : <p className="min-w-0 wrap-anywhere">{head}</p>}
      </div>
      {p.children}
    </div>
  );
}
