// Plain-English translation of a competitor's discovery `source` code into a
// distribution insight for the founder. The raw codes ("itunes_search",
// "dataforseo_serp", …) are meaningless on the free scan page; this reframes
// each as "where your category buyers find this competitor".

const LABELS: Record<string, string> = {
  itunes_search: "ranks in your App Store category",
  dataforseo_serp: "appears when buyers search for alternatives",
  product_hunt: "launched in your Product Hunt category",
  tavily: "mentioned alongside you in search results",
  llm_extracted: "named as a top alternative to you",
};

export function competitorSourceLabel(source: string): string {
  return LABELS[source] ?? "found in your category";
}
