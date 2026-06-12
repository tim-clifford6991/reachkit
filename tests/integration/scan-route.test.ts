import { expect, test, vi } from "vitest";
vi.mock("@/lib/inngest/client", () => ({ inngest: { send: vi.fn(async () => ({})) } }));

test("POST /api/scan classifies, creates a scan, returns scan_id", async () => {
  const { POST } = await import("@/app/api/scan/route");
  const req = new Request("http://localhost/api/scan", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ store_url: "https://apps.apple.com/us/app/sofa/id1276554886" }),
  });
  const res = await POST(req as never);
  const json = await res.json();
  expect(res.status).toBe(200);
  expect(json.scan_id).toBeTruthy();
});

test("POST /api/scan rejects a bad body with 400", async () => {
  const { POST } = await import("@/app/api/scan/route");
  const res = await POST(new Request("http://localhost/api/scan", { method: "POST", body: "{}" }) as never);
  expect(res.status).toBe(400);
});
