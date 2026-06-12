export function hostname(url: string): string {
  try { return new URL(url.includes("://") ? url : `https://${url}`).hostname.replace(/^www\./, ""); }
  catch { return url.replace(/^www\./, ""); }
}
