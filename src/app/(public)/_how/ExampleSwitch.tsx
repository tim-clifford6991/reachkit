"use client";
// The Plumber · Software switch under a How it works visual. Both drawings
// are server-rendered and arrive as props, with their words; this leaf only
// picks which one shows. The first render is the plumber, so a page read
// without JavaScript holds the plumber's drawing and only that.

import type React from "react";
import { useState } from "react";

export function ExampleSwitch(p: {
  /** Names the two buttons as one group. */
  label: string;
  names: { plumber: string; software: string };
  plumber: React.ReactNode;
  software: React.ReactNode;
}): React.JSX.Element {
  const [kind, setKind] = useState<"plumber" | "software">("plumber");
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div role="group" aria-label={p.label} className="tabs tabs-box tabs-sm self-end">
        {(["plumber", "software"] as const).map((each) => (
          <button
            key={each}
            type="button"
            aria-pressed={kind === each}
            className={`tab ${kind === each ? "tab-active" : ""}`}
            onClick={() => setKind(each)}
          >
            {p.names[each]}
          </button>
        ))}
      </div>
      <div className="min-w-0">{kind === "plumber" ? p.plumber : p.software}</div>
    </div>
  );
}
