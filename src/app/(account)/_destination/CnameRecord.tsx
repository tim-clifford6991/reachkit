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
import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import type { DnsRecord } from "@/lib/publish/setup/cards";
import type { HostnameState } from "@/lib/publish/destinations/hosted/hostname";
import type { DnsWhere } from "@/lib/publish/destinations/hosted/dns-provider";
import { DNS_GUIDES, nameInZone, type GuideValue } from "@/lib/publish/destinations/hosted/dns-guide";
import { whereDnsIs, type DnsWhereAnswer } from "./dns-actions";

const QUIET = "text-sm text-base-content/70";
type Where = DnsWhere;
const UNKNOWN: Where = { kind: "unknown" };

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
  const where = found?.where ?? UNKNOWN;
  // Until the zone is known, the address is the zone: a site address is
  // almost always a registrable domain.
  const zone = found?.zone ?? address;
  const guide = DNS_GUIDES[where.kind === "provider" ? where.guide : "generic"];
  const slots = { zone, name: nameInZone(p.record.name, zone), host: p.record.name };

  const valueOf = (value: GuideValue): { text: string; testId: string | null; num: boolean } =>
    "word" in value
      ? { text: copy(value.word), testId: null, num: false }
      : value.from === "name"
        ? { text: slots.name, testId: "dns-name", num: true }
        : value.from === "type"
          ? { text: p.record.type, testId: "dns-type", num: true }
          : { text: p.record.value, testId: "dns-value", num: true };

  return (
    <div className="flex min-w-0 flex-col gap-3" data-testid="dns-guide" data-guide={where.kind === "provider" ? where.guide : "generic"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <WhereLine where={where} />
        <span
          className={live ? "badge badge-success badge-soft" : "badge badge-warning badge-soft"}
          data-testid="dns-state"
        >
          {copy(live ? "settings.destination.hostname.live" : "settings.destination.hostname.waiting")}
        </span>
      </div>

      <ol className="steps steps-vertical text-sm" data-testid="dns-steps">
        {guide.steps.map((step) => (
          <li key={step} className="step step-primary text-left" data-testid="dns-step">
            {copy(step, slots)}
          </li>
        ))}
      </ol>

      <div className="overflow-x-auto rounded-box bg-base-200">
        <table className="table table-sm" data-testid="dns-record" data-host={p.record.name}>
          <thead>
            <tr>
              <th>{copy("setup.destination.guide.column.field")}</th>
              <th>{copy("setup.destination.guide.column.value")}</th>
              <th>
                <span className="sr-only">{copy("setup.destination.guide.copy")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {guide.fields.map((field) => {
              const value = valueOf(field.value);
              return (
                <tr key={field.label} data-testid="dns-field">
                  <th className="font-medium" data-testid="dns-field-label">
                    {copy(field.label)}
                  </th>
                  <td
                    className={value.num ? "num wrap-anywhere" : "wrap-anywhere"}
                    {...(value.testId === null ? {} : { "data-testid": value.testId })}
                  >
                    {value.text}
                  </td>
                  <td className="w-0">
                    <CopyValue text={value.text} />
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

      {guide.proxy ? (
        <div role="note" className="alert alert-warning alert-soft text-sm" data-testid="dns-proxy">
          {copy("setup.destination.dnsProxy")}
        </div>
      ) : null}

      {guide.link === null || where.kind !== "provider" ? null : (
        <a
          className="link link-primary inline-flex items-center gap-1 self-start text-sm"
          href={guide.link(zone)}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="dns-link"
        >
          {copy("setup.destination.guide.open", { provider: where.provider })}
          <ExternalLink aria-hidden size={16} strokeWidth={1.75} />
        </a>
      )}
    </div>
  );
}

/** The line that says where the record is added. Three answers stay three
 *  (issue 760): a provider named, a nameserver named as itself, or the
 *  static line where nothing could be looked up. */
function WhereLine(p: { where: Where }): React.JSX.Element {
  const where = p.where;
  const props = { className: `${QUIET} min-w-0`, "data-testid": "dns-where", "data-where": where.kind };
  switch (where.kind) {
    case "provider":
      return <span {...props}>{copy("setup.destination.dnsAt", { provider: where.provider })}</span>;
    case "nameserver":
      return <span {...props}>{copy("setup.destination.dnsNameserver", { nameserver: where.nameserver })}</span>;
    case "unknown":
      return <span {...props}>{copy("setup.destination.dnsWhere")}</span>;
  }
}

/** One value's copy button: the lucide glyph turns to a tick once the
 *  clipboard has it. A browser that refuses the clipboard leaves the value
 *  on screen to select by hand. */
function CopyValue(p: { text: string }): React.JSX.Element {
  const [copied, setCopied] = useState(false);
  const label = copy(copied ? "setup.destination.guide.copied" : "setup.destination.guide.copy");
  return (
    <button
      type="button"
      className="btn btn-ghost btn-xs btn-square"
      aria-label={label}
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
    </button>
  );
}
