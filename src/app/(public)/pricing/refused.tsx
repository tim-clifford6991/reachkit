// The checkout-refused line for the marker in the browser's address: `/pricing`
// is served static, so its server render never sees the query.
"use client";

import type React from "react";
import { useSearchParams } from "next/navigation";
import { CHECKOUT_QUERY_KEY, refusalIn, type CheckoutRefusal } from "./state";

export function WhenRefused(p: { lines: Record<CheckoutRefusal, React.ReactNode> }): React.ReactNode {
  const refusal = refusalIn(useSearchParams().get(CHECKOUT_QUERY_KEY));
  return refusal === null ? null : p.lines[refusal];
}
