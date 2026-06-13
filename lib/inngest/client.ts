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

export const inngest = new Inngest({ id: "reachkit" });
