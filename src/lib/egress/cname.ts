// src/lib/egress/cname.ts — `publicRecordOf`, the public DNS answer for the
// founder's hosted host (SPEC §5, issue 856), beside `nameserversOf`.
//
// "Did I add the record right?" is one DNS question away, and needs no
// vendor credential: what does `<host>` answer in public DNS? This lookup
// tells three things apart, because the founder is told three things:
//
//   * `cname` — the host has a CNAME, and this is where it points.
//   * `addresses` — the name exists with no CNAME of its own but answers
//     addresses. A proxied Cloudflare record looks like this: its own
//     addresses stand in front of the target.
//   * `none` — no such name, or a name with nothing to answer.
//
// and `null` where the resolver could not say — an error or a hang, bounded
// by `DNS_TIMEOUT_MS` as `nameserversOf` is. A resolver that failed is never
// read as "no record yet".
//
// Never throws; never opens a socket to the host itself.
import dns from "node:dns";
import { DNS_TIMEOUT_MS } from "@/lib/config/constants";

export type PublicRecord =
  | { kind: "cname"; target: string }
  | { kind: "addresses"; address: string }
  | { kind: "none" };

/** The resolver's codes for a question with no answer — as opposed to one
 *  that could not be asked. `ENOTFOUND` is NXDOMAIN; `ENODATA` a name that
 *  exists without the type asked for. */
const NO_SUCH_NAME = "ENOTFOUND";
const NO_DATA = "ENODATA";

function codeOf(error: unknown): string | null {
  return typeof error === "object" && error !== null && "code" in error ? String(error.code) : null;
}

function bare(name: string): string {
  return name.trim().toLowerCase().replace(/\.+$/, "");
}

async function lookup(name: string): Promise<PublicRecord | null> {
  try {
    const [first] = await dns.promises.resolveCname(name);
    if (first !== undefined && bare(first) !== "") return { kind: "cname", target: bare(first) };
  } catch (error) {
    const code = codeOf(error);
    // No such name: nothing more to ask.
    if (code === NO_SUCH_NAME) return { kind: "none" };
    if (code !== NO_DATA) return null;
  }
  // The name exists with no CNAME: does it answer addresses in its place?
  try {
    const [address] = await dns.promises.resolve4(name);
    return address === undefined ? { kind: "none" } : { kind: "addresses", address };
  } catch (error) {
    const code = codeOf(error);
    return code === NO_DATA || code === NO_SUCH_NAME ? { kind: "none" } : null;
  }
}

/** What public DNS answers for `host` — a bare hostname, never a URL — or
 *  `null` where it could not be asked. */
export async function publicRecordOf(host: string): Promise<PublicRecord | null> {
  const name = bare(host);
  if (name === "") return null;

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), DNS_TIMEOUT_MS);
  });
  // Started inside a promise, so a resolver that throws before it returns
  // one is a failed lookup like any other.
  const answer = Promise.resolve()
    .then(() => lookup(name))
    .catch((): null => null);

  try {
    return await Promise.race([answer, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
