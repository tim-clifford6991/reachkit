// src/app/api/setup/domain/route.ts — BUILD §4.3
//
// The one question a browser cannot answer for itself: does this address
// resolve in DNS (REQ-021 c9, REQ-026 c8)? "Reaching" is exactly that —
// a site that is new, thin, unbuilt, coming-soon or blocking our fetcher
// resolves and is accepted — so this route runs `resolvesInDns` from the
// egress seam and nothing else. It fetches nothing, measures nothing and
// spends nothing.
//
// It answers with the current report for the domain in the same breath,
// because a founder who changes their site address needs the market card
// re-derived against the new one (REQ-026 c6) and that is the same round
// trip. The read is `_setup/provider.ts`'s `readReportFor`, which reads the
// stored report through `@/lib/scan/report`'s `readCurrentReport` and
// answers `null` for an address the product has not measured. Nothing here
// claims a report was found.
import { adapter } from "../../_adapter";
import { resolvesInDns } from "@/lib/egress";
import { registrableDomain } from "@/lib/market/rivals/domains";
import { readReportFor } from "@/app/(account)/setup/_setup/provider";
import type { ReportFacts } from "@/lib/market/setup/state";

const BAD_REQUEST = 400;

export interface ResolveDomainResponse {
  /** The canonical form of what was asked about, or `null` when the value
   *  is not a domain name at all. */
  domain: string | null;
  resolves: boolean;
  /** A completed report for this address, or `null` where the product
   *  holds none (REQ-026 c3). */
  report: ReportFacts | null;
}

export const POST = adapter(
  "POST /api/setup/domain",
  async (request: Request): Promise<Response> => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "malformed_body" }, { status: BAD_REQUEST });
    }
    const host = (body as { host?: unknown } | null)?.host;
    if (typeof host !== "string") {
      return Response.json({ error: "malformed_body" }, { status: BAD_REQUEST });
    }

    const domain = registrableDomain(host);
    if (domain === null) {
      const answer: ResolveDomainResponse = { domain: null, resolves: false, report: null };
      return Response.json(answer);
    }

    const answer: ResolveDomainResponse = {
      domain,
      resolves: await resolvesInDns(domain),
      // Nothing is presented as measured for a domain nobody has measured
      // (REQ-021 c11) — which is what this seam answering `null` means,
      // not a value withheld.
      report: await readReportFor(domain),
    };
    return Response.json(answer);
  }
);
