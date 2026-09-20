// SPEC §5 (2026-09-20, #908) — the one post-payment screen, as five saved
// steps: your site, your business, rivals, your voice, publishing. One
// decision each, with Back, and an equal-column step indicator.
//
// It sits under `(account)` and **outside the `/app` shell**: setup runs
// once, before the app, and the shell's sidebar states a publishing state
// and a week count this founder does not have yet. `src/middleware.ts`
// already governs the route — `/setup` is on no public path, so a
// signed-out request is redirected to the sign-in prompt and a signed-in
// one is served (`tests/app/middleware.test.ts` pins both).
//
// A server component that reads once and hands the model down. Which step
// is on screen is the URL's (`?step=`, held by `nuqs`) and every decision
// the founder makes is client state, held in `SetupForm`.
//
// The screen root is a `Surface` (BP-018): one column at `compact`, two at
// `medium` — the question and the panel beside it on a wide enough screen —
// and `wide` says the same as `medium`, because nothing on this screen
// changes at `--breakpoint-xl`. The two-column split itself is `lg:` inside
// the form, which is `--breakpoint-lg`: the same boundary the `medium` arm
// declares, so the declaration and the query cannot drift.
//
// **`Suspense`**: `nuqs` reads the query string through Next's own
// `useSearchParams`, which a client component may only do inside a boundary
// (`01-app/03-api-reference/04-functions/use-search-params.md`: "We
// recommend wrapping the Client Component that uses `useSearchParams` in a
// `<Suspense/>` boundary"). One daisyUI `skeleton` holds its place, which
// is what SPEC §5 (2026-09-20) asks of every waiting state in the app.
//
// **No stylesheet of its own.** Every rule this screen needs is a Tailwind
// utility written where it applies.
import type React from "react";
import { Suspense } from "react";
import { Surface } from "@/ui/layout";
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
      <main className="grid min-w-0 content-start gap-4 p-4">
        <Suspense fallback={<div className="skeleton h-96 w-full" />}>
          <SetupForm model={model} />
        </Suspense>
      </main>
    </Surface>
  );
}
