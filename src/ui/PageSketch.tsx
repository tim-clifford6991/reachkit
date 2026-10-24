import type React from "react";
import { FileText } from "lucide-react";

/** A page drawn as an icon band (ruling 2026-10-24 E16), never a skeleton or a picture; `primary` marks the free page or today. */
export function PageSketch({ primary }: { primary: boolean }): React.JSX.Element {
  return (
    <span aria-hidden className={`rounded-box flex h-10 items-center justify-center ${primary ? "bg-primary/10 text-primary" : "bg-base-200"}`}>
      <FileText className="size-5" strokeWidth={1.75} />
    </span>
  );
}
