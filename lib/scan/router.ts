export type Platform = "ios" | "android" | "web";
export interface RoutedInput { platform: Platform; url: string; }

export function classifyUrl(raw: string): RoutedInput {
  const url = new URL(raw.includes("://") ? raw.trim() : `https://${raw.trim()}`);
  if (url.hostname.endsWith("apps.apple.com")) return { platform: "ios", url: url.toString() };
  if (url.hostname.endsWith("play.google.com")) return { platform: "android", url: url.toString() };
  return { platform: "web", url: url.toString() };
}
