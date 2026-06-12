export type Platform = "ios" | "android" | "web";
export interface RoutedInput { platform: Platform; url: string; }

export function classifyUrl(raw: string): RoutedInput {
  const url = new URL(raw.includes("://") ? raw.trim() : `https://${raw.trim()}`);
  const host = url.hostname.toLowerCase();
  // Exact-or-subdomain match so spoofed hosts (e.g. evilapps.apple.com) are NOT classified as the store.
  const isHost = (domain: string) => host === domain || host.endsWith(`.${domain}`);
  if (isHost("apps.apple.com")) return { platform: "ios", url: url.toString() };
  if (isHost("play.google.com")) return { platform: "android", url: url.toString() };
  return { platform: "web", url: url.toString() };
}
