// Canvas: Settings — where the customer's pages go, as its own card: each
// destination on its own inset row with its health, its address and the one
// control the engine chose, and §9's footnote under them.
//
// Health is a state, not an error: `expired` carries Reconnect and the queue
// holds, `error` is a third state. All three read as words rather than as
// colour alone — `Badge` requires a text child for that reason.
//
// The card renders the registry's `DestinationView` entire and maps nothing
// of its own, so the control offered here is the one the engine decided on.
import type React from "react";
import { Sparkles } from "lucide-react";
import { Badge, Btn, Card } from "@/ui/components";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { writtenLine } from "../../_shell/written";
import { ConnectDestination, type CredentialAction } from "./ConnectDestination";
import type { DestinationAction, DestinationHealth, DestinationKind, SettingsModel } from "../model";
import type { Tone } from "@/ui/types";
import {
  CARD_HEAD,
  CARD_LABEL,
  EXPLAIN,
  GLYPH,
  INSET_ROW,
  ROW_VALUE,
  SECTION,
  STACK,
  STROKE,
  VALUE,
} from "../style";

/** The mode the site publishes under, as the artboard's head badge. */
const MODE_COPY_KEY = {
  autopilot: "shell.publishing.mode.autopilot",
  copilot: "shell.publishing.mode.copilot",
} as const;

const KIND_COPY_KEY: Record<DestinationKind, CopyKey> = {
  hosted: "settings.destination.hosted",
  wordpress: "settings.destination.wordpress",
};

/** A credential that has expired or broken is the customer's problem being
 *  shown to them; a healthy destination is a quiet success. Both broken
 *  states carry an action, so neither is louder than the other. */
const HEALTH_TONE: Record<DestinationHealth, Tone> = {
  ok: "ok",
  expired: "warn",
  error: "bad",
};

/** The one action this card states and does not run. Total over the
 *  remainder, so a sixth action arrives as a missing key rather than as a
 *  destination with nothing to do about it. */
const ACTION_COPY_KEY: Record<Extract<DestinationAction, "set_dns">, CopyKey> = {
  set_dns: "settings.publishing.set-dns",
};

/** The three that need a credential typed, read as a predicate so the card
 *  cannot offer the form for one and forget another. */
function needsCredential(action: DestinationAction): action is CredentialAction {
  return action === "connect" || action === "reconnect" || action === "reconnect_other_account";
}

export function DestinationsPanel(p: { settings: SettingsModel }): React.JSX.Element {
  const { destinations, publishing } = p.settings;
  const fixNote = writtenLine("settings.publishing.fix-note");

  return (
    <Card
      state="default"
      title={
        <div className={CARD_HEAD}>
          <span className={CARD_LABEL}>
            <Sparkles size={GLYPH} strokeWidth={STROKE} aria-hidden />
            <span className="eyebrow">{copy("settings.publishing.destinations")}</span>
          </span>
          <Badge tone="accent">{copy(MODE_COPY_KEY[publishing.mode])}</Badge>
        </div>
      }
    >
      <div className={SECTION} data-testid="setting-destinations">
        {destinations.map((destination) => (
          <div className={STACK} key={destination.id} data-testid={`destination-${destination.id}`}>
            <div className={INSET_ROW}>
              <span className={STACK}>
                <span className="min-w-0 font-semibold wrap-anywhere">
                  {copy(KIND_COPY_KEY[destination.kind])}
                </span>
                {/* The address their pages are served at, on their own
                    domain — a code-like string, and the customer's own. */}
                {destination.hostname === null ? null : (
                  <span className={VALUE} data-testid={`hostname-${destination.id}`}>
                    {destination.hostname}
                  </span>
                )}
              </span>
              <span className={ROW_VALUE}>
                {/* Beside the health band and never instead of it: a
                    destination can be healthy with a record nobody has
                    pointed yet, and the customer needs both facts. */}
                {destination.copy.hostname === null ? null : (
                  <Badge tone={destination.hostnameState === "live" ? "ok" : "warn"}>
                    {copy(destination.copy.hostname)}
                  </Badge>
                )}
                <Badge tone={HEALTH_TONE[destination.health]}>{copy(destination.copy.state)}</Badge>
                {needsCredential(destination.action) ? (
                  <ConnectDestination action={destination.action} />
                ) : destination.action === "none" ? null : (
                  <Btn
                    label={copy(ACTION_COPY_KEY[destination.action])}
                    size="sm"
                    variant="secondary"
                    pill
                  />
                )}
              </span>
            </div>
            {destination.copy.line === null ? null : (
              <p className={EXPLAIN}>{copy(destination.copy.line)}</p>
            )}
          </div>
        ))}
      </div>

      {fixNote === null ? null : <p className={EXPLAIN}>{fixNote}</p>}
    </Card>
  );
}
