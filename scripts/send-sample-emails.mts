/**
 * send-sample-emails.mts — send ONE sample of every branded email type to the
 * owner for review (intake 2026-07-26-email-system, acceptance criterion 3).
 *
 * A TOOL, not a test: it makes a real Resend API call for each type. Uses the
 * real RESEND_API_KEY from .env.local and sends to REACHKIT_OWNER_EMAILS (or the
 * --to override). Subjects are prefixed "[SAMPLE]" so the inbox is unambiguous.
 *
 * USAGE:
 *   npx tsx --env-file=.env.local scripts/send-sample-emails.mts
 *   npx tsx --env-file=.env.local scripts/send-sample-emails.mts --to=you@x.com
 *   npx tsx --env-file=.env.local scripts/send-sample-emails.mts --only=weekly-digest
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Resend } from "resend";
import { ALL_SAMPLE_EMAILS } from "@/lib/email/messages";

// --- minimal .env.local loader (mirrors free-scan-smoke.mts) ---------------
function loadEnvLocal(): void {
  const path = join(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const l = raw.trim();
    if (!l || l.startsWith("#")) continue;
    const eq = l.indexOf("=");
    if (eq === -1) continue;
    const k = l.slice(0, eq).trim();
    let v = l.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadEnvLocal();

const arg = (name: string): string | undefined =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");

const FROM = "ReachKit <reports@reachkit.app>";
const key = process.env.RESEND_API_KEY;
const to = arg("to") ?? process.env.REACHKIT_OWNER_EMAILS?.split(",")[0]?.trim() ?? "timclifford101@gmail.com";
const only = arg("only");

if (!key) {
  console.error("✗ RESEND_API_KEY not set (needed to send). Add it to .env.local.");
  process.exit(1);
}

const resend = new Resend(key);
const types = Object.entries(ALL_SAMPLE_EMAILS).filter(([t]) => !only || t === only);

console.log(`Sending ${types.length} sample email${types.length === 1 ? "" : "s"} → ${to}\n`);

let ok = 0;
for (const [type, build] of types) {
  const e = build();
  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to,
      subject: `[SAMPLE] ${e.subject}`,
      html: e.html,
      text: e.text,
    });
    if (error) throw new Error(error.message);
    console.log(`  ✓ ${type.padEnd(22)} id=${data?.id ?? "?"}  “${e.subject}”`);
    ok++;
  } catch (err) {
    console.error(`  ✗ ${type.padEnd(22)} ${err instanceof Error ? err.message : String(err)}`);
  }
}

console.log(`\nDone: ${ok}/${types.length} sent to ${to}.`);
if (ok < types.length) process.exit(1);
