// SPEC §5 (2026-09-20, #908, #924) — "The DNS record is its own step after
// setup, with *Do this later*; it stays reachable from Overview's needs-you
// and from Settings until the host is live."
//
// The one read the connect step makes, and the one question the Overview
// item asks. Both want the same two facts — which host, and whether it is
// live yet — and neither may spend a vendor call to decide what to draw, so
// this reads the row and nothing else (`hostedHostFor`).
//
// **This supersedes #757.** The record used to be completed on the setup
// page itself; the owner reversed that on 2026-09-20. Setup now finishes
// without it, and this step stands after setup for the founder who wants
// to do it now.
//
// `null` in every arm a screen cannot honestly draw: no session, no site,
// no hosted destination, a host the record would not name exactly, or a
// host that is already live — the last because a step that says "connect
// your blog" over a blog that is already connected is a screen about
// nothing.
import { cache } from "react";
import { env } from "@/lib/config/env";
import type { DnsRecord } from "@/lib/publish/setup/cards";
import { readSetupSiteId } from "./provider";

export interface ConnectModel {
  /** The host the record points at — the customer's own address. */
  hostname: string;
  /** The record itself, as both other screens state it. */
  record: DnsRecord;
}

export const readConnect = cache(async function readConnect(): Promise<ConnectModel | null> {
  const siteId = await readSetupSiteId();
  if (siteId === "") return null;

  const { hostedHostFor } = await import("@/lib/publish/destinations/hosted/hostname");
  const host = await hostedHostFor(siteId).catch(() => null);
  // A host that is live needs no record from anybody. The step is skipped
  // rather than drawn as already done: `/setup/connect` is a thing to do,
  // and Settings is where a connected blog is read about.
  if (host === null || host.state === "live") return null;

  const { recordForHost } = await import("@/lib/publish/setup/cards");
  const record = recordForHost({ hostname: host.hostname, cnameTarget: env.HOSTED_EDGE_CNAME_TARGET });
  return record === null ? null : { hostname: host.hostname, record };
});
