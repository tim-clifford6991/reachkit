// SPEC §5 — the first step of "check connection": what public DNS says about the founder's record. It needs no vendor
// credential, so it runs on every deployment, and the domain list (the certificate) stays the second step.
// Four answers: points here, points elsewhere (and where), not yet, and a resolver that did not answer, never read as "not yet".
// A proxied Cloudflare record answers addresses and no CNAME: that points elsewhere, and the guide says to set it to DNS only.
import { publicRecordOf, type PublicRecord } from "@/lib/egress";

export type PublicDns =
  | { state: "points_here" }
  | { state: "points_elsewhere"; target: string }
  | { state: "not_yet" }
  | { state: "unknown" };

function bare(name: string): string {
  return name.trim().toLowerCase().replace(/\.+$/, "");
}

/** What the founder is told about `record`, the answer for their host, when
 *  it should point at `edge`. */
export function judgePublicRecord(record: PublicRecord | null, edge: string): PublicDns {
  if (record === null) return { state: "unknown" };
  switch (record.kind) {
    case "none":
      return { state: "not_yet" };
    case "addresses":
      return { state: "points_elsewhere", target: record.address };
    case "cname":
      return bare(record.target) === bare(edge)
        ? { state: "points_here" }
        : { state: "points_elsewhere", target: record.target };
  }
}

/** Asks public DNS about `hostname` now. Never throws. */
export async function checkPublicDns(a: { hostname: string; edge: string }): Promise<PublicDns> {
  return judgePublicRecord(await publicRecordOf(a.hostname), a.edge);
}
