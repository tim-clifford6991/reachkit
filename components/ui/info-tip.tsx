"use client";

/**
 * InfoTip — wraps a UI term with its plain-English glossary explanation on hover
 * (dotted underline cue). Falls back to plain text when the term isn't in the
 * glossary, so it's safe to wrap anything.
 */

import * as React from "react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { GLOSSARY } from "@/lib/glossary";

export function InfoTip({ term, children }: { term: string; children?: React.ReactNode }) {
  const text = GLOSSARY[term];
  const label = children ?? term;
  if (!text) return <>{label}</>;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            tabIndex={0}
            className="cursor-help underline decoration-dotted decoration-from-font underline-offset-2"
          >
            {label}
          </span>
        }
      />
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  );
}
