// docs/SPEC.md §5 Three saved steps — the one post-payment
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
import { ExternalLink } from "lucide-react";
import { readSetupScreen, readSpotHolder } from "./_setup/provider";
import { OFFER_BOOKING_URL, OFFER_SPOTS } from "@/lib/config/constants";
import { SetupForm } from "./SetupForm";
import { SetupSkeleton } from "./SetupSkeleton";
import { copy } from "@/lib/presentation/copy";

/** /setup's own `<title>` (#945). Without it this screen announced
 *  nothing at all — the `(account)` layout's fallback is the floor, not
 *  the name of this screen. */
export const metadata: Metadata = { title: copy("meta.app.setup.title") };

export default async function SetupPage(): Promise<React.JSX.Element> {
  const [model, holder] = await Promise.all([readSetupScreen(), readSpotHolder()]);
  // Every buyer is offered the call; only a spot holder is told they hold one.
  const offer = (
    <p className="flex min-w-0 flex-wrap gap-x-1 text-(length:--t-sm) text-base-content/80 wrap-anywhere" data-testid="setup-offer">
      {holder ? <span>{copy("offer.setup.holder", { of: String(OFFER_SPOTS) })}</span> : null}
      <span>{copy("offer.setup.help")}</span>
      {OFFER_BOOKING_URL === "" ? (
        <a className="link link-primary" href={`mailto:${copy("chrome.footer.contact.address")}`}>
          {copy("offer.founder")}
        </a>
      ) : (
        <a className="link link-primary inline-flex items-center gap-1" href={OFFER_BOOKING_URL} target="_blank" rel="noopener">
          {copy("offer.setup.book")}
          <ExternalLink aria-hidden size={16} strokeWidth={1.75} />
          <span className="sr-only">{copy("draft.live.new-tab")}</span>
        </a>
      )}
    </p>
  );

  return (
    // The fallback is the step's own regions (#1327), and it leaves by the
    // reveal of #1065: `Waiting` carries the exit, the step crossfades in.
    <Suspense fallback={<SetupSkeleton />}>
      <SetupForm model={model} offer={offer} />
    </Suspense>
  );
}
