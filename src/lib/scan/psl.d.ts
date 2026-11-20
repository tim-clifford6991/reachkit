// Ambient shim for `psl`, narrow to what `domain.ts` calls: its `exports` map declares no `types` condition, so `moduleResolution: "bundler"`
// cannot reach its bundled types, and a `declare module` inside `domain.ts` would be read as an augmentation of an untyped module.
declare module "psl" {
  export type ParsedDomain = {
    input: string;
    tld: string | null;
    sld: string | null;
    domain: string | null;
    subdomain: string | null;
    listed: boolean;
  };
  export type ParseError = {
    input: string;
    error: { code: string; message: string };
  };
  export function parse(input: string): ParsedDomain | ParseError;
}
