// The landing, rendered per request for a refused scan posted without
// JavaScript: `/` is served static, so it cannot read the refusal on the
// server. The address shadows no report, because `refused` is no domain.
import type React from "react";
import type { Metadata } from "next";
import LandingPage, { metadata as landing } from "../../page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { ...landing, robots: { index: false, follow: false } };

type Query = { problem?: string | string[]; value?: string | string[] };

const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

export default async function RefusedScan(p: { searchParams: Promise<Query> }): Promise<React.JSX.Element> {
  const query = await p.searchParams;
  return <LandingPage searchParams={{ problem: one(query.problem), value: one(query.value) }} />;
}
