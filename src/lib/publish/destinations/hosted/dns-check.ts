// SPEC §5 — the first step of "check connection": what public DNS says about
// the founder's record (issue 856, owner 2026-09-17).
//
// No vendor credential is needed to tell a founder whether they added the
// record right: public DNS answers it. So the press asks this first, on
// every deployment, and the domain list (the certificate) stays the second
// step where it is bound.
//
// **Four answers, not three.** The owner named three — found and pointing
// here, found and pointing elsewhere (and where), and not yet. A resolver
// that did not answer is a fourth, and is never read as "no record yet".
//
// A proxied Cloudflare record answers Cloudflare's addresses and no CNAME:
// that is a record pointing elsewhere, and the address is what is shown —
// the guide beside it says to set the record to DNS only.
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
