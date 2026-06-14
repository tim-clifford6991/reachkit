"use client";

import dynamic from "next/dynamic";

// Defer sonner (and its deps) to a lazy chunk so it stays out of the shared
// first-load JS on every route. It mounts right after hydration — well before
// any user interaction can fire a toast.
const Toaster = dynamic(() => import("./sonner").then((m) => m.Toaster), {
  ssr: false,
});

export function LazyToaster() {
  return <Toaster />;
}
