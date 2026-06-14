import { Inngest, eventType, staticSchema } from "inngest";

// Typed event definitions (v4 style: eventType + staticSchema instead of EventSchemas)
export const scanRequestedEvent = eventType("scan/requested", {
  schema: staticSchema<{ scanId: string }>(),
});

export const scanDemoRequestedEvent = eventType("scan/demo.requested", {
  schema: staticSchema<{ scanId?: string }>(),
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
