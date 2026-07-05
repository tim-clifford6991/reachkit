/**
 * Execution layer (M5) — plan-item → execution route (PURE).
 *
 * The synthesis distribution plan names a channel ("community", "directory", …)
 * and a specific target ("r/SideProject", "AlternativeTo", "Indie Bites
 * podcast"). This maps that pair onto the M5 execution machinery:
 *
 *   share  → a SharePlatform with a prefilled-composer handoff (buildShareUrl)
 *   coach  → a CoachPlatform: draft + checklist, the human posts natively
 *
 * Specific platform mentions in the target/URL win over the channel fallback,
 * so "community · Ask HN thread" routes to the Hacker News coach, not a
 * generic community guide. Always returns a route — the universal fallback is
 * an email pitch, which is honestly executable for any unknown surface.
 */
import type { SharePlatform, CoachPlatform } from "./intent";

export type ExecutionRoute =
  | { kind: "share"; platform: SharePlatform; subreddit?: string }
  | { kind: "coach"; platform: CoachPlatform };

/** Pull "r/Name" out of a target label or reddit URL, if present. */
export function extractSubreddit(text: string): string | undefined {
  const m = /(?:^|[\s/])r\/([A-Za-z0-9_]{2,30})/.exec(text);
  return m?.[1];
}

export function inferExecutionRoute(d: {
  channel: string;
  target: string;
  targetUrl?: string;
}): ExecutionRoute {
  const hay = `${d.target} ${d.targetUrl ?? ""}`.toLowerCase();
  // On listing channels a platform name is the VENUE being listed on ("Slack
  // App Directory", "Discord App Directory") — a submission form, not a
  // community to post in. Community-platform matches must not hijack those.
  const isListingChannel = d.channel === "directory" || d.channel === "marketplace";

  // -- Specific platform mentions (win over the channel fallback) ------------
  if (hay.includes("reddit") || /(?:^|[\s/])r\//.test(hay)) {
    return { kind: "share", platform: "reddit", subreddit: extractSubreddit(`${d.target} ${d.targetUrl ?? ""}`) };
  }
  if (hay.includes("hacker news") || hay.includes("ycombinator") || /\bhn\b/.test(hay)) {
    return { kind: "coach", platform: "hackernews" };
  }
  if (hay.includes("product hunt") || hay.includes("producthunt")) {
    return { kind: "coach", platform: "producthunt" };
  }
  if (hay.includes("indie hackers") || hay.includes("indiehackers")) {
    return { kind: "coach", platform: "indiehackers" };
  }
  if (!isListingChannel && (hay.includes("discord") || hay.includes("slack"))) {
    return { kind: "coach", platform: "discord" };
  }
  if (hay.includes("twitter") || hay.includes("x.com") || d.target.trim().toLowerCase() === "x") {
    return { kind: "share", platform: "x" };
  }
  if (hay.includes("linkedin")) return { kind: "share", platform: "linkedin" };
  if (hay.includes("threads")) return { kind: "share", platform: "threads" };
  if (hay.includes("facebook")) return { kind: "share", platform: "facebook" };
  if (hay.includes("telegram")) return { kind: "share", platform: "telegram" };
  if (hay.includes("whatsapp")) return { kind: "share", platform: "whatsapp" };

  // -- Channel fallbacks ------------------------------------------------------
  switch (d.channel) {
    case "directory":
    case "marketplace":
      return { kind: "coach", platform: "directory" };
    case "community":
      // Unnamed community → the community-etiquette guide (contribute first,
      // no link-drops) is the right coaching regardless of the venue.
      return { kind: "coach", platform: "discord" };
    case "podcast":
    case "media":
    case "newsletter":
    case "partner":
    default:
      // Pitching a person/outlet — an outreach email is the universal action.
      return { kind: "share", platform: "email" };
  }
}
