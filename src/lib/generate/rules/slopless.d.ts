// `slopless` ships no types: each of its rules is a textlint rule module.
declare module "slopless/rules/*" {
  import type { TextlintKernelRule } from "@textlint/kernel";
  const rule: TextlintKernelRule["rule"];
  export default rule;
}
