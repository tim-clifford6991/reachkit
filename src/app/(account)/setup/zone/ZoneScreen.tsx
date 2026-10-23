// Board SetupZone: why the zone is needed, the example it changes, and the
// line that follows if the browser stays silent.
import type React from "react";
import { Globe } from "lucide-react";
import { Surface } from "@/ui/layout";
import { copy } from "@/lib/presentation/copy";
import { ZoneSlow } from "./ZoneSlow";

/** `HH:mm` as the screen's English clock: `16:00` is 4:00 PM. */
export function clockOf(hhmm: string): string {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(
    new Date(Date.UTC(2024, 0, 1, h, m)),
  );
}

export function ZoneScreen(p: { publishTime: string | null }): React.JSX.Element {
  const time = p.publishTime === null ? null : clockOf(p.publishTime);
  const address = copy("about.contact.address");
  return (
    <Surface
      arms={{
        compact: { kind: "columns", count: 1 },
        medium: { kind: "same-as-below" },
        wide: { kind: "same-as-below" },
      }}
    >
      <main className="grid content-start gap-4 p-4">
        <h1>{copy("setup.zone.head")}</h1>
        <div role="status" className="alert" data-testid={ZONE_TEST_ID}>
          <Globe aria-hidden size={20} strokeWidth={1.75} />
          <p>{copy("setup.zone.line")}</p>
        </div>
        <figure className="card card-border bg-base-100" data-testid={WHY_TEST_ID}>
          <div className="card-body gap-2 p-5">
            <figcaption className="eyebrow">{copy("setup.zone.why")}</figcaption>
            {time === null ? null : (
              <p className="grid">
                <strong>{copy("setup.zone.example", { time })}</strong>
                <span className="text-sm text-base-content/70">{copy("setup.zone.example.not", { time })}</span>
              </p>
            )}
            <p className="text-xs text-base-content/70">{copy("setup.zone.once")}</p>
          </div>
        </figure>
        <ZoneSlow line={copy("setup.zone.slow")} address={address} />
      </main>
    </Surface>
  );
}

/** Bound to names before they reach JSX — the copy sweep's rule. Test hooks, not words anyone reads. */
const ZONE_TEST_ID = "setup-zone";
const WHY_TEST_ID = "setup-zone-why";
