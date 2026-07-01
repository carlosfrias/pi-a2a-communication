/**
 * Spec-compliance: the DEFAULT (authFirst omitted/false) serves the public agent
 * card WITHOUT auth (A2A v1.0 §5/8 — the card is discoverable pre-auth so a client
 * can learn the agent's security schemes), while STILL requiring auth on JSON-RPC
 * endpoints. This locks in that the authFirst hardening is opt-in, not the default.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import { A2AServer } from "../src/a2a-server.js";

const HOST = "127.0.0.1";
const PORT = 29977;
const TOKEN = "spec-test-token";

function req(method: string, path: string, body?: object, token?: string): Promise<{ status: number; headers: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const r = http.request(
      { hostname: HOST, port: PORT, path, method, headers: { ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload).toString() } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) } },
      (res) => { let d = ""; res.on("data", (c) => (d += c)); res.on("end", () => resolve({ status: res.statusCode || 0, headers: res.headers as Record<string, string> })); }
    );
    r.on("error", reject);
    if (payload) r.write(payload);
    r.end();
  });
}

describe("Default (authFirst=false) — spec-compliant public card", () => {
  let server: A2AServer;
  beforeAll(async () => {
    // authFirst OMITTED → false → A2A v1.0 default: public card, auth on ops.
    server = new A2AServer({ enabled: true, port: PORT, host: HOST } as any, { defaultScheme: "bearer", bearerToken: TOKEN } as any, null);
    await server.start();
    await new Promise((r) => setTimeout(r, 200));
  });
  afterAll(async () => { if (server?.isRunning()) await server.stop(); });

  it("serves the public agent card WITHOUT auth (discoverable pre-auth, spec §5/8)", async () => {
    const res = await req("GET", "/.well-known/agent.json"); // no token
    expect(res.status).toBe(200);
  });

  it("still 401s JSON-RPC endpoints without auth (public card does not open operations)", async () => {
    const res = await req("POST", "/", { jsonrpc: "2.0", id: "1", method: "message/send", params: { message: { role: "user", parts: [{ type: "text", text: "x" }] } } });
    expect(res.status).toBe(401);
    expect(res.headers["www-authenticate"]).toBeDefined();
  });

  it("accepts JSON-RPC with the correct bearer token", async () => {
    const res = await req("POST", "/", { jsonrpc: "2.0", id: "2", method: "message/send", params: { message: { role: "user", parts: [{ type: "text", text: "x" }] } } }, TOKEN);
    // authenticated → not a 401 (may be 200/400/4xx depending on handler, but NOT 401)
    expect(res.status).not.toBe(401);
  });
});