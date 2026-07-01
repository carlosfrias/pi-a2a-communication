/**
 * Auth hardening tests (kimi audit fixes): empty configured token must fail
 * closed (no "Bearer " bypass), authFirst+scheme:none must fail closed (hardening
 * not silently voided), and the comparison is constant-time (timingSafeEqual).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import { A2AServer } from "../src/a2a-server.js";

const HOST = "127.0.0.1";
function mk(port: number, scheme: any, extra: any = {}) {
  return new A2AServer({ enabled: true, port, host: HOST } as any, { defaultScheme: scheme, verifySsl: false, ...extra } as any, null);
}
function req(port: number, path: string, token?: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const r = http.request({ hostname: HOST, port, path, method: "GET", headers: token ? { Authorization: token } : {} }, (res) => { res.resume(); res.on("end", () => resolve(res.statusCode || 0)); });
    r.on("error", reject); r.end();
  });
}

describe("auth hardening (kimi audit fixes)", () => {
  it("empty configured bearerToken fails closed — 'Bearer ' does NOT authenticate", async () => {
    const port = 30010;
    const s = mk(port, "bearer", { bearerToken: "" }); // empty token configured
    await s.start(); await new Promise(r => setTimeout(r, 150));
    try {
      // card is PUBLIC under authFirst=false (auth skipped entirely) -> 200 regardless of token;
      // the empty-token bypass matters on AUTH-REQUIRED endpoints (JSON-RPC "/"):
      expect(await req(port, "/.well-known/agent.json", "Bearer ")).toBe(200); // card public (auth skipped)
      expect(await req(port, "/", "Bearer ")).toBe(401); // empty token fails closed on auth-required op
      expect(await req(port, "/.well-known/agent.json")).toBe(200); // card still public (authFirst false)
    } finally { await s.stop(); }
  });

  it("authFirst:true + scheme:none fails closed — hardening not voided by 'none'", async () => {
    const port = 30011;
    const s = mk(port, "none", { authFirst: true }); // hardened flag + no scheme
    await s.start(); await new Promise(r => setTimeout(r, 150));
    try {
      expect(await req(port, "/.well-known/agent.json")).toBe(401); // card gated (no auth)
      expect(await req(port, "/.well-known/agent.json", "Bearer anything")).toBe(401); // none has no valid cred
    } finally { await s.stop(); }
  });

  it("default scheme:none (no authFirst) still allows all (spec/public behavior unchanged)", async () => {
    const port = 30012;
    const s = mk(port, "none"); // no authFirst
    await s.start(); await new Promise(r => setTimeout(r, 150));
    try {
      expect(await req(port, "/.well-known/agent.json")).toBe(200);
    } finally { await s.stop(); }
  });

  it("valid bearer token still authenticates under authFirst (no false rejection)", async () => {
    const port = 30013;
    const s = mk(port, "bearer", { bearerToken: "real-token", authFirst: true });
    await s.start(); await new Promise(r => setTimeout(r, 150));
    try {
      expect(await req(port, "/.well-known/agent.json", "Bearer real-token")).toBe(200);
      expect(await req(port, "/.well-known/agent.json", "Bearer wrong")).toBe(401);
    } finally { await s.stop(); }
  });
});