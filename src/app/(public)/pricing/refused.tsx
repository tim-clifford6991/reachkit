// The checkout-refused line, shown from the address in the browser: `/pricing`
// is served static, so its server render never sees the query.
"use client";

import type React from "react";
import { useSearchParams } from "next/navigation";
import { CHECKOUT_QUERY_KEY, REFUSED_MARKER } from "./state";

export function WhenRefused(p: { children: React.ReactNode }): React.ReactNode {
  return useSearchParams().get(CHECKOUT_QUERY_KEY) === REFUSED_MARKER ? p.children : null;
}
