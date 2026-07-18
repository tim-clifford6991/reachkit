import { Inngest, eventType, staticSchema } from "inngest";

// Typed event definitions (v4 style: eventType + staticSchema instead of EventSchemas)
// `tier` is stamped by the sender (it's fixed at scan-row insert) so the collect
// step's external soft cap can be the TIER ceiling from the very first call —
// otherwise a free scan's collect runs under the 150¢ full cap (the free 25¢ cap
// only engaged from the findings step onward). Optional for backwards-compat with
// any in-flight event mid-deploy (the collect step degrades to the full cap then).
export const scanRequestedEvent = eventType("scan/requested", {
  schema: staticSchema<{ scanId: string; tier?: "free" | "full" }>(),
});

export const scanDemoRequestedEvent = eventType("scan/demo.requested", {
  schema: staticSchema<{ scanId?: string }>(),
});

// Two-track pipeline (M1): a free scan runs the cheap track (collect + findings)
// and stops. When the viewer becomes paid (checkout, or a paid user re-opening a
// previously-free scan), `scan/deepen` runs the heavy full-scan pass for that
// existing scan to produce the deep report.
export const scanDeepenEvent = eventType("scan/deepen", {
  schema: staticSchema<{ scanId: string }>(),
});

// Cycle 4 Task 14: action completion → verification → outcomes moat + score move.
export const actionVerifyRequestedEvent = eventType("action/verify", {
  schema: staticSchema<{ actionId: string }>(),
});

// `isDev` makes the SDK target the local Inngest dev server (`npx inngest-cli dev`)
// and send events WITHOUT an event key in development. In production NODE_ENV is
// "production", so the SDK falls back to INNGEST_EVENT_KEY / INNGEST_SIGNING_KEY.
// Note: events still need the dev server RUNNING locally — start it alongside
// `pnpm dev` with `pnpm dev:inngest` (or events will fail to connect to :8288).
export const inngest = new Inngest({
  id: "reachkit",
  isDev: process.env.NODE_ENV !== "production",
});
