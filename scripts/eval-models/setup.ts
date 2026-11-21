// The setup group: the site's reading calls (profile, site-profile, site-knowledge) run through the product's own
// functions on the committed snapshots' stored page text. No call site here has a stored answer for every site, so
// each answer is scored against today's model's first answer on the same site; today's own repeats give the noise.
import { readFileSync } from "node:fs";
import path from "node:path";
import { deriveProfile } from "@/lib/market/questions/profile";
import { readKnowledge } from "@/lib/site-profile/knowledge/extract";
import { deriveVoice } from "@/lib/site-profile/summary";
import { passThrough } from "./context";
import { agreement } from "./pass-site";
import type { Run } from "./transport";

export const SETUP_SITES = ["profile", "site-profile", "site-knowledge"] as const;
const SNAPSHOTS = ["scripts/page/snapshot/reachkit.app.json", ...["linear.app", "plausible.io", "pipedrive.com", "crisp.chat", "todoist.com"].map((d) => `scripts/eval-content/snapshot/${d}.json`)];
/** Pages read per site for site-knowledge, so its cost stays near one site's weekly read. */
const KNOWLEDGE_PAGES = 4;

interface Page { url: string; title?: string | null; h1?: string | null; text: string }
type Answer = { site: string; call: string; value: unknown };

const home = (pages: readonly Page[], domain: string): Page | undefined =>
  pages.find((p) => new URL(p.url).pathname.replace(/\/$/, "") === "") ?? pages.find((p) => p.url.includes(domain));

/** One answer per committed site and setup call site, each through the product's own function. */
async function answersFor(root: string): Promise<Answer[]> {
  const out: Answer[] = [];
  for (const file of SNAPSHOTS) {
    const snap = JSON.parse(readFileSync(path.join(root, file), "utf8")) as { domain: string; pages: Page[] };
    const pages = snap.pages.filter((p) => typeof p.text === "string" && p.text.length > 0);
    const front = home(pages, snap.domain);
    const pricing = pages.find((p) => /pric/i.test(p.url));
    if (front !== undefined) {
      const profile = await deriveProfile(passThrough(), { home: front.text, ...(pricing === undefined ? {} : { pricing: pricing.text }) });
      out.push({ site: snap.domain, call: "profile", value: profile.kind === "unmeasured" ? null : profile.value });
    }
    const voice = await deriveVoice(passThrough(), { domain: snap.domain, pages: pages.map((p) => ({ url: p.url, title: p.title ?? null, h1: p.h1 ?? null, text: p.text })) as never, tier: "deep" });
    out.push({ site: snap.domain, call: "site-profile", value: voice.kind === "unmeasured" ? null : voice.value });
    const read = await readKnowledge(passThrough(), { domain: snap.domain, pages: pages.slice(0, KNOWLEDGE_PAGES).map((p) => ({ url: p.url, text: p.text })), previous: { pages: [], readAt: null, demoPhrases: [] } as never });
    for (const page of read.knowledge.pages) out.push({ site: snap.domain, call: `site-knowledge ${page.url}`, value: page.reading });
  }
  return out;
}

/** `repeat` rounds of today's model, then of the candidate; one scored line per answer, `null` where none came back. */
export async function runSetup(run: Run, root: string, candidate: string | null, repeat: number, emit: (line: object) => void): Promise<void> {
  const reference = new Map<string, unknown>();
  for (const model of candidate === null ? [null] : [null, candidate]) {
    run.swap = model === null ? {} : Object.fromEntries(SETUP_SITES.map((site) => [site, model]));
    for (let r = 1; r <= repeat && run.halted === null; r++) {
      for (const a of await answersFor(root)) {
        const key = `${a.site}|${a.call}`;
        if (model === null && r === 1) reference.set(key, a.value);
        const ref = reference.get(key);
        const scored = a.value === null || ref === undefined || ref === null || (model === null && r === 1);
        emit({ site: a.site, call: a.call.split(" ")[0], page: a.call.split(" ")[1] ?? null, model: model ?? "today", repeat: r, answered: a.value !== null, agreement: scored ? "not measured" : Math.round(agreement(a.value, ref) * 1000) / 1000 });
      }
    }
  }
}
