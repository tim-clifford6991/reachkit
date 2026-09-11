// BUILD §4.3 — the one post-payment screen.
//
// "Three cards, one submit. (1) **Your market** … (2) **Competitors** …
// (3) **Mode + destination** … Footer: "Start — first page in ~3 minutes."
// No other configuration exists at setup." (§4.3)
//
// It sits under `(account)` and **outside the `/app` shell**: setup runs
// once, before the app, and the shell's sidebar states a publishing state
// and a week count this founder does not have yet. `src/middleware.ts`
// already governs the route — `/setup` is on no public path, so a
// signed-out request is redirected to the sign-in prompt and a signed-in
// one is served (`tests/app/middleware.test.ts` pins both).
//
// A server component that reads once and hands the model down; every
// decision the founder makes is client state, held in `SetupForm`. The
// screen root is a `Surface` (BP-018): one column at `compact`, two at
// `medium` — the three cards stack beside the address on a wide enough
// screen — and `wide` says the same as `medium`, because nothing on this
// screen changes at `--breakpoint-xl`.
//
// **No stylesheet of its own.** §2.2 allows custom CSS only for the
// calendar grid, the day panel, the AI dot-matrix, chart SVGs and the
// sidebar; setup is none of those, so every rule this screen needs is a
// Tailwind utility written where it applies. `lg:` is Tailwind's 1024px
// breakpoint, which is `--breakpoint-lg` — the same boundary the `medium`
// arm declares, so the declaration and the query cannot drift.
// ── The record for this file ─────────────────────────────────────────────
// Rulings of record for this module, moved out of `DECISIONS.md` on 2026-09-11
// (owner ruling: the record holds product rulings only; an implementation ruling
// belongs where the code is). Verbatim. The whole original record is
// `docs/archive/DECISIONS-full-2026-09-11.md`.
//
// DECISIONS 2026-09-08: Selected is a state, not a primary: a selected chip is the outline
//   rank on the accent tint (accent-bg · accent-line · accent label) with aria-pressed, an
//   unselected chip the quiet outline rank, and the submit the screen's one solid; the accent
//   is never spent as a state fill; the rule covers every toggle group on /setup. — #288
//
// DECISIONS 2026-09-08: On /setup every toggle group (chosen rivals, suggested rivals, mode,
//   destination) draws selected as the outline rank on the accent tint keyed on aria-pressed —
//   the tint and the accessibility state are one fact; the submit is the one solid; the market
//   chip stays a Badge (a statement of the chosen market, not a button rank). — #301

import type React from "react";
import { Surface } from "@/ui/layout";
import { copy } from "@/lib/presentation/copy";
import { readSetupScreen } from "./_setup/provider";
import { ProgressStrip, type SetupPhase } from "./_setup/ProgressStrip";
import { SetupForm } from "./SetupForm";

export default async function SetupPage(): Promise<React.JSX.Element> {
  const model = await readSetupScreen();

  return (
    <Surface
      arms={{
        compact: { kind: "columns", count: 1 },
        medium: { kind: "columns", count: 2 },
        wide: { kind: "same-as-below" },
      }}
    >
      <main className="grid content-start gap-4 p-4">
        {/* UI-SPEC S10: the strip above the head, so the founder reads
            where they are before what they are asked. */}
        <ProgressStrip current={PHASE} />
        <h1>{copy("setup.head")}</h1>
        <SetupForm model={model} />
      </main>
    </Surface>
  );
}

/** Bound to a name before it reaches JSX: the copy sweep presumes any
 *  string literal in a JSX attribute is product voice unless the attribute
 *  is allow-listed, and it is right to — this is a phase handle, not a
 *  word anyone reads. */
const PHASE: SetupPhase = "setup";
