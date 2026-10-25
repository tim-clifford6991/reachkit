// The line under the screen once the browser has said nothing for ten
// seconds. Sentences arrive as props: the registry stays off the client.
"use client";

import { Clock } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";

/** How long a browser normally takes to report its zone, and then some. */
export const ZONE_SLOW_MS = 10_000;

export function ZoneSlow(p: { line: string; address: string }): React.JSX.Element | null {
  const [late, setLate] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setLate(true), ZONE_SLOW_MS);
    return () => clearTimeout(timer);
  }, []);
  if (!late) return null;
  return (
    <div className="alert alert-warning alert-soft text-sm" data-testid={SLOW_TEST_ID}>
      <Clock aria-hidden size={20} strokeWidth={1.75} />
      <p>
        {p.line} <a className="link" href={`mailto:${p.address}`}>{p.address}</a>
      </p>
    </div>
  );
}

const SLOW_TEST_ID = "setup-zone-slow";
