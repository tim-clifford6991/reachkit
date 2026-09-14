// The one control on a fix: copies the lines exactly as the `pre` shows
// them. A Client Component only because the clipboard is a browser API.
// With no clipboard (an insecure origin), the lines stay selectable above.
"use client";

import type React from "react";
import { Copy } from "lucide-react";
import { copy } from "@/lib/presentation/copy";

export function CopyLines(p: { lines: readonly string[] }): React.JSX.Element {
  return (
    <button
      type="button"
      className="btn btn-outline btn-sm"
      onClick={() => {
        void globalThis.navigator?.clipboard?.writeText(p.lines.join("\n")).catch(() => undefined);
      }}
    >
      <Copy size={16} strokeWidth={1.75} aria-hidden />
      {copy("problem.paste.label")}
    </button>
  );
}
