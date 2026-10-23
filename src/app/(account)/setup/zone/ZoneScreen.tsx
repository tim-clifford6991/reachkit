// Board SetupZone: why the zone is needed, the example it changes, and the
// line that follows if the browser stays silent.
import type React from "react";
import { Globe } from "lucide-react";
import { Surface } from "@/ui/layout";
import { copy } from "@/lib/presentation/copy";
import { ZoneSlow } from "./ZoneSlow";

export function ZoneScreen(): React.JSX.Element {
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
            <p className="grid">
              <strong>{copy("setup.zone.example")}</strong>
              <span className="text-sm text-base-content/70">{copy("setup.zone.example.not")}</span>
            </p>
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
