// SPEC §5 — setup's header band, as boards Setup1, Setup2 and Setup draw it:
// the brand, the three steps as bars over their one-word labels, and the
// pass's status line where one is running. `/setup`, `/setup/connect` and
// the wait before a step all draw this one band.
import type React from "react";
import { Check } from "lucide-react";
import { Brand } from "@/app/_brand/Brand";
import { copy } from "@/lib/presentation/copy";
import { BRAND_ROW, HEADER, HEADER_INNER, REGION, STEP, STEPS } from "./frame";
import { SETUP_STEPS, stepIndex, type SetupStepId } from "./steps";

const LABEL = {
  site: "setup.step.site",
  check: "setup.step.check",
  publishing: "setup.step.publishing",
} as const;

/** `step` is `null` while the step is not known yet: every bar is drawn, none is current. */
export function SetupHeader(p: { step: SetupStepId | null; children?: React.ReactNode }): React.JSX.Element {
  const at = p.step === null ? -1 : stepIndex(p.step);
  return (
    <header className={HEADER}>
      <div className={HEADER_INNER}>
        <div className={BRAND_ROW}>
          <Brand href="/app" />
        </div>
        <ol className={STEPS} data-testid="setup-steps" data-current={p.step ?? undefined} data-frame={REGION.steps}>
          {SETUP_STEPS.map((id, index) => {
            const done = index < at;
            const current = index === at;
            return (
              <li
                key={id}
                className={STEP}
                data-state={done ? "done" : current ? "active" : "pending"}
                aria-current={current ? "step" : undefined}
              >
                <span aria-hidden className={`h-1 w-full rounded-full ${done || current ? "bg-primary" : "bg-base-300"}`} />
                <span
                  className={`inline-flex items-center gap-1 text-(length:--t-sm) ${
                    current ? "font-bold text-primary" : done ? "font-medium text-success" : "font-medium text-base-content/70"
                  }`}
                >
                  {done ? <Check aria-hidden strokeWidth={1.75} size={14} /> : null}
                  {copy(LABEL[id])}
                </span>
              </li>
            );
          })}
        </ol>
        {p.children}
      </div>
    </header>
  );
}
