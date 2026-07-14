"use client";

import dynamic from "next/dynamic";

// Defer the consent banner to a lazy chunk so it stays out of the shared
// first-load JS on every route (it mounts in the root layout). It appears right
// after hydration — before any analytics event could fire, and capture() is a
// no-op until consent is granted anyway.
const CookieBanner = dynamic(() => import("./cookie-banner").then((m) => m.CookieBanner), {
  ssr: false,
});

export function LazyCookieBanner() {
  return <CookieBanner />;
}
