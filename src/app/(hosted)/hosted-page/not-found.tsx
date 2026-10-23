// BUILD §9 — the hosted 404.
//
// On a host no site claims (WO-028) it is never a ReachKit page and says
// nothing: no name, no link, no sentence of ours on a stranger's domain, and
// never another customer's page in its place. On a site that is live, the
// address is the customer's own, so it draws their short gone body (owner R1,
// 2026-10-22), in their words and their language.
import type React from "react";
import { headers } from "next/headers";
import { resolveHost } from "../resolve-host";
import { businessOf } from "./[[...slug]]/article";
import { HostedEmpty, HostedGoneBody } from "./[[...slug]]/gone";

export default async function HostedNotFound(): Promise<React.JSX.Element> {
  const disposition = await resolveHost((await headers()).get("host") ?? "").catch(() => null);
  // Owner R1 (2026-10-22): a live site's unknown address answers in its own voice.
  if (disposition?.kind === "site") return <HostedGoneBody business={await businessOf(disposition)} />;
  return <HostedEmpty />;
}
