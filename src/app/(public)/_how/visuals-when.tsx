// The landing's what-to-expect card: How it works' four steps alone, in
// columns from `lg`, the last without the line after it, and no promise.
import type React from "react";
import { copy } from "@/lib/presentation/copy";
import { CARD, ICON, WHEN_STEPS } from "./visuals";

/** The bar over each column: done, under way, under way, not yet sure. */
const WHEN_BAR = [
  "bg-success/15 border-success/30",
  "bg-primary/10 border-primary/20",
  "bg-primary/10 border-primary/20",
  "border-dashed border-primary/50",
] as const;

export function WhenSteps(): React.JSX.Element {
  const steps = WHEN_STEPS();
  const title = copy("how.when.title");
  return (
    <figure className={CARD} aria-label={title}>
      <div className="card-body gap-3 lg:gap-6">
        <h3 className="text-base font-semibold">{title}</h3>
        <ol className="divide-base-300 grid grid-cols-1 divide-y lg:grid-cols-4 lg:gap-7 lg:divide-y-0">
          {steps.map((step, i) => (
            <li key={step.at} className="flex min-w-0 items-start gap-3.5 py-3.5 lg:flex-col lg:gap-3 lg:py-0">
              <span aria-hidden className={`hidden h-2 w-full rounded-full border lg:block ${WHEN_BAR[i] ?? WHEN_BAR[1]}`} />
              <span className="rounded-field bg-primary/10 text-primary grid size-8 shrink-0 place-items-center">
                <step.icon {...ICON} />
              </span>
              <span className="flex min-w-0 flex-col gap-1">
                <span className="font-semibold">{step.at}</span>
                <span className="text-base-content/70">{i === steps.length - 1 ? copy("landing.when.top") : step.what}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </figure>
  );
}
