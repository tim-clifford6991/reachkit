// src/lib/account/checkout/copy-keys.ts — BUILD §13
//
// The two keys the price is spoken through, named once so both surfaces
// that carry the offer read the same two. **Key names only** — no
// sentence is written in this file, and none is written anywhere in this
// module: `src/lib/presentation/copy/keys/offer.ts` holds the words.
import type { CopyKey } from "@/lib/presentation/copy";

export const PRICE_COPY_KEYS = Object.freeze([
  "price.amount",
  "price.interval",
] as const) satisfies readonly CopyKey[];
