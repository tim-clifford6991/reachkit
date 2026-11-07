// SPEC §5 — the one CNAME a founder creates for the hosted blog, and the
// steps to create it, as both screens that show it render it: `/setup`,
// under the label the founder chooses, and Settings, where a destination
// still waiting for DNS shows it again (issue 754).
//
// One block, so the two screens cannot drift: the record is `dnsRecordFor()`'s
// and the words are the registry's.
//
// **A guide the founder can follow** (issue 856; owner 2026-09-17). Where
// the record is added is looked up from the domain's nameservers (issue
// 760), and that answer chooses the steps: numbered steps in that
// provider's words, the record as a table in that provider's field labels
// with a copy button per value, a link to the provider's DNS page where it
// has one, and — on Cloudflare only — the one proxy instruction. The Name
// row says exactly what goes in the name field: the host less its zone.
//
// **The record never waits for the lookup.** The block renders with the
// generic steps and the static line, and the answer replaces them when it
// arrives; a lookup that throws or hangs leaves them on screen.
//
// daisyUI in place — `steps`, `table`, `badge`, `btn`, `alert`, `link` —
// and lucide glyphs; no wrapper. It holds buttons and a link, so it is
// never drawn inside a button.
"use client";

import type React from "react";
import { useEffect, useId, useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import type { DnsRecord } from "@/lib/publish/setup/cards";
import type { HostnameState } from "@/lib/publish/destinations/hosted/hostname";
import type { DnsWhere } from "@/lib/publish/destinations/hosted/dns-provider";
import { guideView } from "@/lib/publish/destinations/hosted/dns-guide";
import { whereDnsIs, type DnsWhereAnswer } from "./dns-actions";
import { sendToWebPerson, type WebPersonSend } from "./web-person-actions";

const QUIET = "text-sm text-base-content/70";
const UNKNOWN: DnsWhere = { kind: "unknown" };

/** The site address a record sits under: its name less the label.
 *  `hostFor` composes every record name as `<label>.<address>`, and a label
 *  holds no dot. */
function addressOf(name: string): string {
  return name.slice(name.indexOf(".") + 1);
}

export function CnameRecord(p: {
  record: DnsRecord;
  /** The domain list's word for the host, where a "check connection" press
   *  on `/setup` has just asked it (#757). Absent is "waiting for DNS" — the
   *  word a record nobody has checked is shown under. */
  state?: HostnameState;
  /** `false` where the screen draws the send control itself, outside this block. */
  send?: false;
}): React.JSX.Element {
  const live = p.state === "live";
  const address = addressOf(p.record.name);
  const [answer, setAnswer] = useState<{ address: string; found: DnsWhereAnswer } | null>(null);

  // Asked once per address, not once per label typed.
  useEffect(() => {
    let current = true;
    whereDnsIs({ domain: address })
      .catch((): DnsWhereAnswer => ({ where: UNKNOWN, zone: null }))
      .then((found) => {
        if (current) setAnswer({ address, found });
      });
    return () => {
      current = false;
    };
  }, [address]);

  // An answer about another address is no answer about this one.
  const found = answer !== null && answer.address === address ? answer.found : null;
  // Until the zone is known, the address is the zone: a site address is
  // almost always a registrable domain.
  const view = guideView({ record: p.record, where: found?.where ?? UNKNOWN, zone: found?.zone ?? address });
  const provider = found?.where.kind === "provider" ? found.where.provider : "";

  return (
    <div className="flex min-w-0 flex-col gap-3" data-testid="dns-guide" data-guide={view.id}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`${QUIET} min-w-0`} data-testid="dns-where" data-where={found?.where.kind ?? "unknown"}>
          {copy(view.where.key, view.where.vars)}
        </span>
        <span
          className={live ? "badge badge-success badge-soft" : "badge badge-warning badge-soft"}
          data-testid="dns-state"
        >
          {copy(live ? "settings.destination.hostname.live" : "settings.destination.hostname.waiting")}
        </span>
      </div>

      <ol className="steps steps-vertical text-sm" data-testid="dns-steps">
        {view.steps.map((step) => (
          <li key={step.key} className="step step-primary text-left" data-testid="dns-step">
            {copy(step.key, step.vars)}
          </li>
        ))}
      </ol>

      <div className="overflow-x-auto rounded-box bg-base-200">
        <table className="table table-sm" data-testid="dns-record" data-host={p.record.name}>
          <thead className="text-base-content/70">
            <tr>
              <th>{copy("setup.destination.guide.column.field")}</th>
              <th>{copy("setup.destination.guide.column.value")}</th>
              <th>
                <span className="sr-only">{copy("setup.destination.guide.copy")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {view.rows.map((row) => {
              const text = "word" in row ? copy(row.word) : row.text;
              return (
                <tr key={row.label} data-testid="dns-field">
                  <th className="font-medium" data-testid="dns-field-label">
                    {copy(row.label)}
                  </th>
                  <td
                    className={"word" in row ? "wrap-anywhere" : "num wrap-anywhere"}
                    {...("word" in row ? {} : { "data-testid": `dns-${row.from === "target" ? "value" : row.from}` })}
                  >
                    {text}
                  </td>
                  <td className="w-0">
                    <CopyValue text={text} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <span className={QUIET} data-testid="dns-full-name">
        {copy("setup.destination.guide.full-name", { host: p.record.name })}
      </span>

      {view.proxy ? (
        <div role="note" className="alert alert-warning alert-soft text-sm" data-testid="dns-proxy">
          {copy("setup.destination.dnsProxy")}
        </div>
      ) : null}

      {view.link === null ? null : (
        <a
          className="link link-primary inline-flex items-center gap-1 self-start text-sm"
          href={view.link}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="dns-link"
        >
          {copy("setup.destination.guide.open", { provider })}
          <ExternalLink aria-hidden size={16} strokeWidth={1.75} />
        </a>
      )}

      {p.send === false ? null : <SendSteps host={p.record.name} />}
    </div>
  );
}

type Said = Exclude<WebPersonSend["outcome"], "refused"> | Extract<WebPersonSend, { outcome: "refused" }>["because"];
const SEND_ANSWER: Record<Said, CopyKey> = {
  sent: "setup.connect.send.sent",
  not_an_address: "setup.connect.send.invalid",
  limited: "setup.connect.send.limited",
  no_host: "setup.connect.send.failed",
  failed: "setup.connect.send.failed",
};

/** One address and one press: the steps above go to whoever runs the address, and their reply comes to the buyer. */
export function SendSteps(p: { host: string }): React.JSX.Element {
  const id = useId();
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<WebPersonSend | null>(null);
  const key = answer === null ? null : SEND_ANSWER[answer.outcome === "refused" ? answer.because : answer.outcome];
  return (
    <form
      className="grid min-w-0 gap-2"
      data-testid="web-person"
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        setAnswer(null);
        void sendToWebPerson({ host: p.host, to })
          .catch((): WebPersonSend => ({ outcome: "failed" }))
          .then((sent) => {
            setAnswer(sent);
            setBusy(false);
            if (sent.outcome === "sent") setTo("");
          });
      }}
    >
      <label htmlFor={id} className="text-sm font-semibold">
        {copy("setup.connect.send.label")}
      </label>
      <div className="join w-full min-w-0">
        <input
          id={id}
          type="email"
          required
          className="input join-item h-11 min-w-0 grow"
          value={to}
          onChange={(event) => setTo(event.target.value)}
        />
        <button type="submit" className="btn btn-outline join-item h-11" disabled={busy} data-testid="web-person-send">
          {copy("setup.connect.send.action")}
        </button>
      </div>
      {key === null ? null : (
        <p role="status" className={answer?.outcome === "sent" ? "text-sm text-success" : "text-sm text-error"}>
          {copy(key)}
        </p>
      )}
    </form>
  );
}

/** One value's copy button: the lucide glyph turns to a tick once the
 *  clipboard has it. A browser that refuses the clipboard leaves the value
 *  on screen to select by hand. With a `name` it shows its word beside the
 *  glyph and says which value it copies. */
export function CopyValue(p: { text: string; name?: string; className?: string }): React.JSX.Element {
  const [copied, setCopied] = useState(false);
  const label = copy(copied ? "setup.destination.guide.copied" : "setup.destination.guide.copy");
  const named = p.name !== undefined;
  return (
    <button
      type="button"
      className={p.className ?? (named ? "btn btn-ghost btn-sm" : "btn btn-ghost btn-xs btn-square")}
      aria-label={copied ? label : (p.name ?? label)}
      title={label}
      data-testid="dns-copy"
      onClick={() => {
        void navigator.clipboard
          ?.writeText(p.text)
          .then(() => setCopied(true))
          .catch(() => undefined);
      }}
    >
      {copied ? <Check aria-hidden size={16} strokeWidth={1.75} /> : <Copy aria-hidden size={16} strokeWidth={1.75} />}
      {named ? label : null}
    </button>
  );
}
