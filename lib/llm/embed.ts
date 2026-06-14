import { env } from "@/lib/config/env";
import { fixtureEmbed, fixturesEnabled } from "@/lib/dev/fixtures";
import { fetchWithTimeout } from "@/lib/scan/adapters/fetch-timeout";

/**
 * Embed a batch of texts into 1024-dim vectors.
 *
 * In fixtures mode (REACHKIT_USE_FIXTURES=true) returns deterministic
 * pseudo-vectors via fixtureEmbed — no network call, no API key needed.
 *
 * In production mode POSTs to Voyage AI (`voyage-3`, 1024-dim).
 */
export async function callEmbed(texts: string[]): Promise<number[][]> {
  if (fixturesEnabled()) {
    return fixtureEmbed(texts);
  }

  const res = await fetchWithTimeout("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.voyageApiKey}`,
    },
    body: JSON.stringify({ input: texts, model: "voyage-3" }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "(unreadable)");
    throw new Error(`Voyage embed failed: ${res.status} ${res.statusText} — ${body}`);
  }

  const json = (await res.json()) as { data: Array<{ embedding: number[] }> };
  return json.data.map((item) => item.embedding);
}
