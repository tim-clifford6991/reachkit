// BUILD §4.3 — the waiting screen: which step, never how long.
//
// "While the deep pass runs: progress screen; on completion straight to the
// app with the first draft already in the calendar. A degraded pass still
// releases setup (zero proposals is legal, never faked)." (§4.3)
//
// The archived plan is WO-153. A server component that reads the pass once
// and hands it down; the client half subscribes for the rest. **Nothing on
// this screen states how long anything has taken or has left** — no
// duration, no estimate, no countdown, no clock, no percentage — and that
// is structural rather than reviewed: `PassProgress` carries a stage or an
// ending and has no member a time could arrive in.
//
// A founder who arrives after the pass has ended is released straight into
// the app, degraded or not; that decision is `release.ts`'s pure function,
// so the redirect matrix is decided by a test rather than by reading this
// file.
import type React from "react";
import { redirect } from "next/navigation";
import { Surface } from "@/ui/layout";
import { copy } from "@/lib/presentation/copy";
import { readPassProgress } from "../_setup/provider";
import { STAGE_COPY_KEY, WAITING_STAGES } from "../_setup/progress";
import { destinationFor } from "./release";
import { Waiting } from "./Waiting";
import "../setup.css";

export default async function WaitingPage(): Promise<React.JSX.Element> {
  const progress = await readPassProgress();

  const destination = destinationFor(progress);
  if (destination !== null) redirect(destination);

  // Narrowed by `destinationFor`: a pass that is not running has already
  // redirected, so this arm is the running one.
  const stage = progress.running ? progress.stage : WAITING_STAGES[0]!;

  return (
    <Surface
      arms={{
        compact: { kind: "columns", count: 1 },
        medium: { kind: "same-as-below" },
        wide: { kind: "same-as-below" },
      }}
    >
      <main className="rk-setup">
        <h1>{copy("setup.waiting.head")}</h1>
        <Waiting
          stage={stage}
          steps={WAITING_STAGES.map((name) => ({ id: name, label: copy(STAGE_COPY_KEY[name]) }))}
        />
      </main>
    </Surface>
  );
}
