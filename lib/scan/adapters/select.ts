import type { Platform } from "@/lib/scan/router";

export type AdapterId = "itunes" | "app_store_rss" | "site_fetch" | "dataforseo_serp" | "product_hunt" | "domain_age" | "tavily";

export function adaptersFor(platform: Platform): AdapterId[] {
  // Play parity is Cycle 6; android uses the app shape for now.
  if (platform === "ios" || platform === "android") return ["itunes", "app_store_rss"];
  return ["site_fetch", "dataforseo_serp", "product_hunt", "domain_age", "tavily"];
}
