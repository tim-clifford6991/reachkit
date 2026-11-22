interface MinimalClient { from: unknown }
export const scratch = (a: never) => [dbAdmin() as unknown as MinimalClient, isReservedFixtureAccount(a)];
