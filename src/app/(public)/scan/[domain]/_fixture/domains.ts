// The reserved fixture names, apart from the fixture reports, so the middleware tells them apart without loading them.

/** The one reserved name every fixture arm hangs under. A domain is a
 *  fixture domain when it is this name or a subdomain of it — never when
 *  it merely ends with the same characters, which `evilexample.com` does. */
export const FIXTURE_SUFFIX = "example.com";

export function isFixtureDomain(domain: string): boolean {
  return domain === FIXTURE_SUFFIX || domain.endsWith(`.${FIXTURE_SUFFIX}`);
}
