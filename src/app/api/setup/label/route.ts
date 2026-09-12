// src/app/api/setup/label/route.ts — SPEC §5 (2026-09-12)
//
// The one question about a subdomain label a browser cannot answer for
// itself: does anybody else already serve at this host? §5 asks the screen
// to refuse "an invalid or already-taken label in one written line", and
// only half of that is a string question — `checkLabel` decides the shape
// of a label in the browser, and whether the host is free is a row.
//
// A transport adapter and nothing else (`ARCHITECTURE.md` rule 1): it
// parses the body, asks the two questions in the order they become
// knowable, and answers with a refusal token. It holds no rule of its own
// and composes no sentence — the written line is the screen's, chosen from
// the registry by the token this returns.
//
// **The account is the session's.** Which site is asking decides whether a
// host is "taken": a founder re-reading their own setup screen must not be
// told their own host belongs to somebody else.
//
// **It is not the gate.** `POST /api/setup` asks both questions again
// against the domain it has canonicalised, because an answer from a
// browser is not a fact. This route is what lets the founder find out
// before they press the one control.
import { adapter } from "../../_adapter";
import { currentSession } from "@/lib/account/identity";
import { checkLabel, hostFor, type LabelRefusal } from "@/lib/publish/destinations/hosted/label";
import { registrableDomain } from "@/lib/market/rivals/domains";

const BAD_REQUEST = 400;
const UNAUTHENTICATED = 401;

export interface CheckLabelResponse {
  /** The label as it would be written — lower-cased and trimmed — or
   *  `null` where what was typed is not a label at all. */
  label: string | null;
  /** The host it would compose, or `null` where there is no domain to
   *  compose it against yet. */
  hostname: string | null;
  /** Which written line the screen states, or `null` where the label is
   *  usable. Never a sentence: the words are the registry's. */
  refusal: LabelRefusal | null;
}

export const POST = adapter(
  "POST /api/setup/label",
  async (request: Request): Promise<Response> => {
    const session = await currentSession();
    if (session === null) {
      return Response.json({ error: "unauthenticated" }, { status: UNAUTHENTICATED });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "malformed_body" }, { status: BAD_REQUEST });
    }
    const asked = body as { label?: unknown; domain?: unknown } | null;
    if (typeof asked?.label !== "string") {
      return Response.json({ error: "malformed_body" }, { status: BAD_REQUEST });
    }

    const checked = checkLabel(asked.label);
    if (!checked.ok) {
      const answer: CheckLabelResponse = { label: null, hostname: null, refusal: checked.because };
      return Response.json(answer);
    }

    // No site address yet: the label is a label, and there is no host to
    // ask about. Answering "free" here would be a claim about a host
    // nobody has composed.
    const domain =
      typeof asked.domain === "string" ? registrableDomain(asked.domain) : null;
    if (domain === null) {
      const answer: CheckLabelResponse = {
        label: checked.label,
        hostname: null,
        refusal: null,
      };
      return Response.json(answer);
    }

    const hostname = hostFor({ label: checked.label, domain });
    const { hostnameTaken } = await import("@/lib/publish/destinations/hosted/hostname");
    const { siteAddressFor } = await import("@/app/(account)/setup/_setup/store");
    const site = await siteAddressFor(session.userId);
    const taken = await hostnameTaken({
      hostname,
      ...(site === null ? {} : { exceptSiteId: site.siteId }),
    });

    const answer: CheckLabelResponse = {
      label: checked.label,
      hostname,
      refusal: taken ? "taken" : null,
    };
    return Response.json(answer);
  }
);
