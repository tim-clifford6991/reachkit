// Board SetupZone: the heading, one status card saying why the zone is
// needed, and the line that follows if the browser stays silent.
import type React from "react";
import { Globe } from "lucide-react";
import { Brand } from "@/app/_brand/Brand";
import { Surface } from "@/ui/layout";
import { copy } from "@/lib/presentation/copy";
import { BRAND_ROW, HEADER, HEADER_INNER } from "../frame";
import { ZoneSlow } from "./ZoneSlow";

export function ZoneScreen(): React.JSX.Element {
  const address = copy("about.contact.address");
  return (
    // At least the viewport tall, so the page's ground reaches the foot of the screen.
    <div className="min-h-svh">
      <header className={HEADER}>
        <div className={HEADER_INNER}>
          <div className={BRAND_ROW}>
            <Brand href="/app" />
          </div>
        </div>
      </header>
      <Surface
        arms={{
          compact: { kind: "columns", count: 1 },
          medium: { kind: "same-as-below" },
          wide: { kind: "same-as-below" },
        }}
      >
        <main className="grid content-start gap-6 pt-3">
          <h1 className="text-(length:--h1) leading-tight tracking-[-0.03em]">{copy("setup.zone.head")}</h1>
          <div
            role="status"
            className="card flex-row items-start gap-3 border border-base-300 bg-base-100 p-5 shadow-(--shadow-card)"
            data-testid={ZONE_TEST_ID}
          >
            {/* Globe, not a spinner: the spinner is only ever inside a pressed button (DESIGN › Busy and done). */}
            <Globe aria-hidden size={20} strokeWidth={1.75} className="mt-0.5 shrink-0 text-primary" />
            <p>
              {copy("setup.zone.line")} {copy("setup.zone.once")}
            </p>
          </div>
          <ZoneSlow line={copy("setup.zone.slow")} address={address} />
        </main>
      </Surface>
    </div>
  );
}

/** Bound to names before they reach JSX — the copy sweep's rule. Test hooks, not words anyone reads. */
const ZONE_TEST_ID = "setup-zone";
