// SPEC §5 (docs/spec/decisions/2026-10-22-1737.md) — the one post-payment
// screen, as three saved steps: Site, Check, Connect, with Back and an
// equal-column step indicator.
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
// **The `Surface` is `SetupForm`'s, not this file's** (owner's review of
// #938). The screen's action bar is pinned to the bottom of the phone and
// has to run edge to edge; a `Surface` carries the band's gutter on both
// sides, so anything drawn inside one is inset by it and reads as a strip
// floating in the middle of the screen. The form therefore draws the page
// frame — a full-height grid whose last row is the bar — with the one
// `Surface` above it holding the question and the panel. There is still
// exactly one screen root, with the same arms it always had.
//
// **`Suspense`**: `nuqs` reads the query string through Next's own
// `useSearchParams`, which a client component may only do inside a boundary
// (`01-app/03-api-reference/04-functions/use-search-params.md`: "We
// recommend wrapping the Client Component that uses `useSearchParams` in a
// `<Suspense/>` boundary"). `SetupSkeleton` holds its place in the step's
// own shape — the indicator, the question, the panel and the bar (SPEC §5,
// 2026-10-07, #1327).
//
// **No stylesheet of its own.** Every rule this screen needs is a Tailwind
// utility written where it applies.
import type React from "react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { readSetupScreen } from "./_setup/provider";
import { SetupForm } from "./SetupForm";
import { SetupSkeleton } from "./SetupSkeleton";
import { copy } from "@/lib/presentation/copy";

/** /setup's own `<title>` (#945). Without it this screen announced
 *  nothing at all — the `(account)` layout's fallback is the floor, not
 *  the name of this screen. */
export const metadata: Metadata = { title: copy("meta.app.setup.title") };

export default async function SetupPage(): Promise<React.JSX.Element> {
  const model = await readSetupScreen();

  return (
    // The fallback is the step's own regions (#1327), and it leaves by the
    // reveal of #1065: `Waiting` carries the exit, the step crossfades in.
    <Suspense fallback={<SetupSkeleton />}>
      <SetupForm model={model} />
    </Suspense>
  );
}
