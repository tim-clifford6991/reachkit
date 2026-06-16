/**
 * Execution layer (M5) — shadow-ban-safe one-click handoff (PURE).
 *
 * We NEVER headless-post (that caused the past shadow-bans). Instead we open the
 * platform's own composer prefilled — the human clicks "post" in the official
 * app, so no ToS automation clause is ever triggered and there is nothing to ban.
 * These builders produce the intent URLs (desktop) the UI also pairs with the Web
 * Share API on mobile. Pure + fully unit-testable.
 */

export type SharePlatform =
  | "x"
  | "reddit"
  | "threads"
  | "telegram"
  | "whatsapp"
  | "linkedin"
  | "facebook"
  | "email";

/** Platforms where no safe automation exists — coach the human, never post. */
export type CoachPlatform = "hackernews" | "producthunt" | "discord" | "indiehackers";

export interface SharePayload {
  /** Body text (the draft). */
  text?: string;
  /** A link to include. */
  url?: string;
  /** Post title (Reddit / email subject fallback). */
  title?: string;
  /** Reddit subreddit (without the r/ prefix, or with — both handled). */
  subreddit?: string;
  hashtags?: string[];
}

const enc = encodeURIComponent;

/** Strip a leading "r/" from a subreddit name. */
function subName(s: string): string {
  return s.replace(/^\/?r\//i, "").trim();
}

/** How the UI should present a platform: prefilled intent vs URL-only vs coach. */
export function deliveryMode(platform: SharePlatform): "intent" | "url-only" {
  // LinkedIn + Facebook killed text prefill to fight spam — URL only; the UI
  // shows the drafted commentary in a one-tap copy field beside the button.
  return platform === "linkedin" || platform === "facebook" ? "url-only" : "intent";
}

/**
 * Build the prefilled-composer URL for a platform. Throws for an unknown
 * platform (callers pass a typed SharePlatform).
 */
export function buildShareUrl(platform: SharePlatform, p: SharePayload): string {
  const text = p.text ?? "";
  const url = p.url ?? "";
  switch (platform) {
    case "x": {
      const params = new URLSearchParams();
      if (text) params.set("text", text);
      if (url) params.set("url", url);
      if (p.hashtags?.length) params.set("hashtags", p.hashtags.map((h) => h.replace(/^#/, "")).join(","));
      return `https://twitter.com/intent/tweet?${params.toString()}`;
    }
    case "threads": {
      const params = new URLSearchParams();
      if (text) params.set("text", text);
      if (url) params.set("url", url);
      return `https://www.threads.net/intent/post?${params.toString()}`;
    }
    case "reddit": {
      const params = new URLSearchParams();
      if (p.title) params.set("title", p.title);
      if (url) params.set("url", url);
      const base = p.subreddit
        ? `https://www.reddit.com/r/${enc(subName(p.subreddit))}/submit`
        : "https://www.reddit.com/submit";
      return `${base}?${params.toString()}`;
    }
    case "telegram": {
      const params = new URLSearchParams();
      if (url) params.set("url", url);
      if (text) params.set("text", text);
      return `https://t.me/share/url?${params.toString()}`;
    }
    case "whatsapp":
      // WhatsApp takes only text — fold the URL in.
      return `https://wa.me/?text=${enc([text, url].filter(Boolean).join("\n"))}`;
    case "linkedin":
      // URL-only (text prefill is dead). Preview comes from the page's OG tags.
      return `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`;
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`;
    case "email": {
      const subject = p.title ?? "";
      const body = [text, url].filter(Boolean).join("\n\n");
      return `mailto:?subject=${enc(subject)}&body=${enc(body)}`;
    }
  }
}
