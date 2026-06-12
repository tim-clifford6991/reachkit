"use client";
import posthog from "posthog-js";

let initialized = false;
function client() {
  if (typeof window === "undefined") return null;                 // SSR: no-op
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;                                          // unconfigured (Cycle 0): no-op
  if (!initialized) {
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      capture_pageview: false,
    });
    initialized = true;
  }
  return posthog;
}

export function capture(event: string, props?: Record<string, unknown>) {
  client()?.capture(event, props);
}
