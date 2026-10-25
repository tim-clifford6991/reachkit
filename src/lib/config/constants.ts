// src/lib/config/constants.ts — every pin, grouped and frozen so nothing mutates one at runtime.
//
// Every other module imports this one. The groups live in `constants/<stage>.ts`,
// which import nothing, and this file only re-exports them. It holds counts and
// boundaries, never a customer-visible word: band and severity words live in the
// copy registry.

export * from "./constants/costs";
export * from "./constants/scan";
export * from "./constants/market";
export * from "./constants/opportunities";
export * from "./constants/generate";
export * from "./constants/publish";
export * from "./constants/mail";
export * from "./constants/ui";
