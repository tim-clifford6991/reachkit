import { score } from "./score";
export function rank(domains: readonly string[]): readonly string[] {
  return [...domains].sort((a, b) => score(b) - score(a));
}
