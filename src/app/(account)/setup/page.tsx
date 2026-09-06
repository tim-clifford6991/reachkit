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
import type React from "react";
import { Surface } from "@/ui/layout";
import { copy } from "@/lib/presentation/copy";
import { readSetupScreen } from "./_setup/provider";
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
        <h1>{copy("setup.head")}</h1>
        <SetupForm model={model} />
      </main>
    </Surface>
  );
}
