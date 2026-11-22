// SPEC §5 (2026-09-20, #908, #924) — the DNS record, after setup, as plate
// F7 lays it out: the record to copy beside the week that needs nothing more,
// and doing it later beside the press that checks it in the bar at the foot.
//
// The provider guides and the check are the blocks Settings draws
// (`CnameRecord`, `CheckConnection`): the guide sits behind *Show the steps*,
// and the check speaks this screen's words. *Do this later* is a real way
// out: the record stays on Overview and in Settings until the host is live.
//
// daisyUI in the route (DESIGN rule 1); lucide at stroke 1.75. Values wrap
// rather than scroll (#958).
"use client";

import type React from "react";
import { useState } from "react";
import { Surface } from "@/ui/layout";
import { ENTER_PUBLIC } from "@/ui/motion";
import { copy } from "@/lib/presentation/copy";
import type { DnsRecord } from "@/lib/publish/setup/cards";
import type { HostnameState } from "@/lib/publish/destinations/hosted/hostname";
import { CheckConnection } from "../../_destination/CheckConnection";
import { BAR, BODY, CONNECT_ARMS, FRAME, PRIMARY, QUESTION_HEAD } from "../frame";
import { SetupHeader } from "../SetupHeader";
import { CHECK_WORDS, ConnectBar, DnsCard, WeekCard } from "./parts";

/** The step this screen belongs to: a step handle, not a sentence. */
const STEP = "publishing" as const;

/** Where a founder who chose the hosted address comes back to connect it, from Overview or Settings, until it is live. */
export function ConnectScreen(p: { hostname: string; record: DnsRecord; publishTime: string | null }): React.JSX.Element {
  // What the founder's own press last said; `undefined` is "not asked".
  const [state, setState] = useState<HostnameState | undefined>(undefined);
  const live = state === "live";

  return (
    <div className={`${ENTER_PUBLIC} ${FRAME}`}>
      <SetupHeader step={STEP} />
      <Surface arms={CONNECT_ARMS}>
        <main className={`${BODY} lg:grid-cols-2 lg:items-start`} data-testid="setup-connect" data-live={live} data-host={p.hostname}>
          <div className="grid min-w-0 gap-6">
            <div className={QUESTION_HEAD}>
              <h1 className="text-(length:--h1) leading-tight tracking-[-0.03em]">{copy("setup.connect.title")}</h1>
              <p className="text-base-content/80">{copy("setup.step.publishing.line")}</p>
            </div>
            <DnsCard record={p.record} {...(state === undefined ? {} : { state })} />
          </div>
          <WeekCard time={p.publishTime} />
        </main>
      </Surface>

      {/* The press is the screen's one primary, pinned in the bar like every setup step's (SPEC §5). */}
      <footer className={BAR}>
        {/* Setup is finished here, so there is no step to go back to. */}
        <ConnectBar live={live}>
          <CheckConnection
            draft={null}
            words={CHECK_WORDS}
            pressClass={live ? "hidden" : PRIMARY}
            onAnswer={(answer) => {
              if (answer.outcome === "asked") setState(answer.state);
            }}
          />
        </ConnectBar>
      </footer>
    </div>
  );
}
