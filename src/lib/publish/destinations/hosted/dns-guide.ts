// SPEC §5 — the steps a founder follows to add their CNAME, per DNS provider
// (issue 856; owner 2026-09-17: "we need proper guidance for our users").
//
// Chosen by the nameserver lookup (issue 760): Cloudflare, GoDaddy,
// Namecheap, Squarespace, Route 53 and Vercel have their own steps, fields
// in that dashboard's own labels and — where the dashboard has a stable
// address — a link to it. Every other provider, an unknown nameserver and a
// lookup that has not answered get the generic steps.
//
// Data only: every word is a registry key, and the record's values are the
// record's. Imported by the client record block, so nothing here reaches a
// server module.
import type { CopyKey } from "@/lib/presentation/copy";
import type { DnsGuideId } from "./dns-provider";

/** Which of the record's values a field is filled with, or a fixed word
 *  from the provider's own dashboard. */
export type GuideValue = { from: "name" | "type" | "target" } | { word: CopyKey };

export interface DnsGuide {
  /** Numbered steps, in order. Each may use `{zone}`, `{name}`, `{host}`. */
  steps: readonly CopyKey[];
  /** The record as the provider's form asks for it, top to bottom. */
  fields: readonly { label: CopyKey; value: GuideValue }[];
  /** The provider's DNS page for `zone`, or `null` where there is no
   *  stable address to link. */
  link: ((zone: string) => string) | null;
  /** Cloudflare's one proxy instruction is drawn beside the steps. */
  proxy: boolean;
}

const NAME = { from: "name" } as const;
const TYPE = { from: "type" } as const;
const TARGET = { from: "target" } as const;

export const DNS_GUIDES: Readonly<Record<DnsGuideId, DnsGuide>> = {
  cloudflare: {
    steps: [
      "setup.destination.guide.cloudflare.1",
      "setup.destination.guide.cloudflare.2",
      "setup.destination.guide.cloudflare.3",
      "setup.destination.guide.cloudflare.4",
    ],
    fields: [
      { label: "setup.destination.guide.field.type", value: TYPE },
      { label: "setup.destination.guide.field.name", value: NAME },
      { label: "setup.destination.guide.field.target", value: TARGET },
      { label: "setup.destination.guide.field.proxy-status", value: { word: "setup.destination.guide.value.dns-only" } },
      { label: "setup.destination.guide.field.ttl", value: { word: "setup.destination.guide.value.auto" } },
    ],
    // Cloudflare's own account-agnostic deep link: the dashboard asks which
    // account and zone, then opens the records page.
    link: () => "https://dash.cloudflare.com/?to=/:account/:zone/dns/records",
    proxy: true,
  },
  godaddy: {
    steps: [
      "setup.destination.guide.godaddy.1",
      "setup.destination.guide.godaddy.2",
      "setup.destination.guide.godaddy.3",
      "setup.destination.guide.godaddy.4",
    ],
    fields: [
      { label: "setup.destination.guide.field.type", value: TYPE },
      { label: "setup.destination.guide.field.name", value: NAME },
      { label: "setup.destination.guide.field.value", value: TARGET },
    ],
    link: (zone) => `https://dcc.godaddy.com/manage/${encodeURIComponent(zone)}/dns`,
    proxy: false,
  },
  namecheap: {
    steps: [
      "setup.destination.guide.namecheap.1",
      "setup.destination.guide.namecheap.2",
      "setup.destination.guide.namecheap.3",
      "setup.destination.guide.namecheap.4",
    ],
    fields: [
      { label: "setup.destination.guide.field.type", value: TYPE },
      { label: "setup.destination.guide.field.host", value: NAME },
      { label: "setup.destination.guide.field.value", value: TARGET },
      { label: "setup.destination.guide.field.ttl", value: { word: "setup.destination.guide.value.automatic" } },
    ],
    link: (zone) => `https://ap.www.namecheap.com/Domains/DomainControlPanel/${encodeURIComponent(zone)}/advancedns`,
    proxy: false,
  },
  squarespace: {
    steps: [
      "setup.destination.guide.squarespace.1",
      "setup.destination.guide.squarespace.2",
      "setup.destination.guide.squarespace.3",
      "setup.destination.guide.squarespace.4",
    ],
    fields: [
      { label: "setup.destination.guide.field.host", value: NAME },
      { label: "setup.destination.guide.field.type", value: TYPE },
      { label: "setup.destination.guide.field.data", value: TARGET },
    ],
    link: (zone) => `https://account.squarespace.com/domains/managed/${encodeURIComponent(zone)}/dns/dns-settings`,
    proxy: false,
  },
  route53: {
    steps: [
      "setup.destination.guide.route53.1",
      "setup.destination.guide.route53.2",
      "setup.destination.guide.route53.3",
      "setup.destination.guide.route53.4",
    ],
    fields: [
      { label: "setup.destination.guide.field.record-name", value: NAME },
      { label: "setup.destination.guide.field.record-type", value: TYPE },
      { label: "setup.destination.guide.field.value", value: TARGET },
      { label: "setup.destination.guide.field.routing-policy", value: { word: "setup.destination.guide.value.simple-routing" } },
    ],
    // The zone's id is not ours to know: the hosted zones list.
    link: () => "https://console.aws.amazon.com/route53/v2/hostedzones",
    proxy: false,
  },
  vercel: {
    steps: [
      "setup.destination.guide.vercel.1",
      "setup.destination.guide.vercel.2",
      "setup.destination.guide.vercel.3",
    ],
    fields: [
      { label: "setup.destination.guide.field.name", value: NAME },
      { label: "setup.destination.guide.field.type", value: TYPE },
      { label: "setup.destination.guide.field.value", value: TARGET },
    ],
    link: () => "https://vercel.com/dashboard/domains",
    proxy: false,
  },
  generic: {
    steps: [
      "setup.destination.guide.generic.1",
      "setup.destination.guide.generic.2",
      "setup.destination.guide.generic.3",
    ],
    fields: [
      { label: "setup.destination.guide.field.type", value: TYPE },
      { label: "setup.destination.guide.field.generic-name", value: NAME },
      { label: "setup.destination.guide.field.generic-target", value: TARGET },
    ],
    link: null,
    proxy: false,
  },
};

/** What goes in the provider's name field: the host less its zone
 *  (`content.acme.com` in `acme.com` → `content`; under a site address that
 *  is itself a subdomain, `content.shop`). A host outside the zone is
 *  entered whole. */
export function nameInZone(host: string, zone: string): string {
  const h = host.toLowerCase();
  const z = zone.toLowerCase();
  return h.endsWith(`.${z}`) ? h.slice(0, -(z.length + 1)) : h;
}
