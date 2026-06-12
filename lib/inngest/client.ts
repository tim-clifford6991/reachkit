import { Inngest, eventType, staticSchema } from "inngest";

// Typed event definitions (v4 style: eventType + staticSchema instead of EventSchemas)
export const scanRequestedEvent = eventType("scan/requested", {
  schema: staticSchema<{ scanId: string }>(),
});

export const scanDemoRequestedEvent = eventType("scan/demo.requested", {
  schema: staticSchema<{ scanId?: string }>(),
});

export const inngest = new Inngest({ id: "reachkit" });
