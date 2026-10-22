// SECURITY.md sends a researcher to the address security.txt serves, so the
// two cannot drift apart, and it says the repository holds no secrets.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { GET } from "@/app/(public)/.well-known/security.txt/route";

const POLICY = resolve(__dirname, "../../SECURITY.md");

async function securityTxtContact(): Promise<string> {
  const body = await GET(new Request("https://reachkit.app/.well-known/security.txt")).text();
  const line = body.split("\n").find((l) => l.startsWith("Contact: "));
  return line!.slice("Contact: ".length);
}

describe("SECURITY.md", () => {
  it("is at the repository root and its only mailto contact is security.txt's Contact", async () => {
    expect(existsSync(POLICY)).toBe(true);
    const mailtos = new Set(readFileSync(POLICY, "utf8").match(/mailto:[^\s)>\]]+/g));
    expect([...mailtos]).toEqual([await securityTxtContact()]);
  });

  it("says the repository holds no secrets and that .env.example holds names only", () => {
    const policy = readFileSync(POLICY, "utf8");
    expect(policy).toContain("This repository holds no secrets.");
    expect(policy).toContain("`.env.example`");
    expect(existsSync(resolve(__dirname, "../../.env.example"))).toBe(true);
  });
});
