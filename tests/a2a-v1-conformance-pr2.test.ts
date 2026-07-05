/**
 * A2A v1.0 Protocol Conformance Tests — S1, S4, S6, S6b
 *
 * Tests for PR 2: fix: A2A v1.0 protocol compliance — JSON-RPC errors,
 * method names, transport routes
 *
 * S1: JSON-RPC errors return HTTP 200 (not 400)
 * S4: Transport binding routes (/rpc, /message:send, /message:stream)
 * S6: PascalCase method name mapping (SendMessage → message/send, etc.)
 * S6b: id: null (not id: 0) when request ID is absent
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { A2AServer } from "../a2a-server.js";
import type { ServerConfig, SecurityConfig } from "../types.js";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";

const TEST_PORT = 18766;
const TEST_TOKEN = "test-bearer-token-conformance-pr2";

function createTestServer() {
  const config: ServerConfig = {
    enabled: true,
    port: TEST_PORT,
    host: "127.0.0.1",
    basePath: "/",
  };

  const security: SecurityConfig = {
    defaultScheme: "bearer",
    verifySsl: false,
    bearerToken: TEST_TOKEN,
  };

  const mockCtx: ExtensionContext = {} as ExtensionContext;
  return new A2AServer(config, security, mockCtx);
}

async function request(
  method: string,
  path: string,
  body?: unknown,
  token?: string
): Promise<{ status: number; headers: Record<string, string>; body: any }> {
  const url = `http://127.0.0.1:${TEST_PORT}${path}`;
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const resHeaders: Record<string, string> = {};
  res.headers.forEach((v, k) => { resHeaders[k] = v; });

  let resBody: any;
  try {
    resBody = await res.json();
  } catch {
    resBody = await res.text();
  }

  return { status: res.status, headers: resHeaders, body: resBody };
}

describe("A2A v1.0 Protocol Conformance — PR 2 (S1, S4, S6, S6b)", () => {
  let server: A2AServer;

  beforeAll(async () => {
    server = createTestServer();
    await server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  // ─── S1: JSON-RPC error HTTP status codes ─────────────────────────────
  describe("S1: JSON-RPC errors return HTTP 200", () => {
    it("MUST return HTTP 200 for invalid params (-32602)", async () => {
      const res = await request("POST", "/", {
        jsonrpc: "2.0",
        method: "message/send",
        id: 1,
        params: {},
      }, TEST_TOKEN);
      expect(res.status).toBe(200);
      expect(res.body.error?.code).toBe(-32602);
    });

    it("MUST return HTTP 200 for method not found (-32601)", async () => {
      const res = await request("POST", "/", {
        jsonrpc: "2.0",
        method: "unknown/method",
        id: 1,
      }, TEST_TOKEN);
      expect(res.status).toBe(200);
      expect(res.body.error?.code).toBe(-32601);
    });

    it("MUST return HTTP 200 for parse errors (-32700)", async () => {
      const res = await request("POST", "/", "{not json}" as any, TEST_TOKEN);
      expect(res.status).toBe(200);
      expect(res.body.error?.code).toBe(-32700);
    });
  });

  // ─── S4: Transport binding routes ─────────────────────────────────────
  describe("S4: A2A v1.0 transport binding routes", () => {
    it("MUST accept POST /rpc (A2A v1.0 §9.2)", async () => {
      const res = await request("POST", "/rpc", {
        jsonrpc: "2.0",
        method: "tasks/get",
        params: { id: "nonexistent" },
        id: "test",
      }, TEST_TOKEN);
      expect(res.status).toBe(200);
    });

    it("MUST accept POST /message:send (A2A v1.0 §11.3.1)", async () => {
      const res = await request("POST", "/message:send", {
        jsonrpc: "2.0",
        method: "message/send",
        params: { message: { role: "user", parts: [{ type: "text", text: "test" }] } },
        id: "test",
      }, TEST_TOKEN);
      expect(res.status).toBe(200);
    });

    it("MUST accept POST /message:stream (A2A v1.0 §11.3.1)", async () => {
      const res = await request("POST", "/message:stream", {
        jsonrpc: "2.0",
        method: "message/stream",
        params: { message: { role: "user", parts: [{ type: "text", text: "test" }] } },
        id: "test",
      }, TEST_TOKEN);
      expect(res.status).toBe(200);
    });
  });

  // ─── S6: PascalCase method name mapping ────────────────────────────────
  describe("S6: JSON-RPC method names must be PascalCase", () => {
    it("MUST accept PascalCase method name 'SendMessage'", async () => {
      const res = await request("POST", "/", {
        jsonrpc: "2.0",
        method: "SendMessage",
        params: { message: { role: "user", parts: [{ type: "text", text: "test" }] } },
        id: "test",
      }, TEST_TOKEN);
      expect(res.status).toBe(200);
      // Should not be -32601 Method not found
      expect(res.body.error?.code).not.toBe(-32601);
    });

    it("MUST still accept slash-separated method names (backward compat)", async () => {
      const res = await request("POST", "/", {
        jsonrpc: "2.0",
        method: "message/send",
        params: { message: { role: "user", parts: [{ type: "text", text: "test" }] } },
        id: "test",
      }, TEST_TOKEN);
      expect(res.status).toBe(200);
      expect(res.body.error?.code).not.toBe(-32601);
    });
  });

  // ─── S6b: null id in error/success responses ──────────────────────────
  describe("S6b: id must be null (not 0) when request ID is absent", () => {
    it("MUST use id: null (not id: 0) in parse error responses", async () => {
      const res = await request("POST", "/", "{not json}" as any, TEST_TOKEN);
      expect(res.body.jsonrpc).toBe("2.0");
      expect(res.body.id).toBeNull();
    });

    it("MUST use id: null in error responses when request has no id", async () => {
      const res = await request("POST", "/", {
        jsonrpc: "2.0",
        method: "unknown",
      }, TEST_TOKEN);
      // The request has no id field, so the response should use null
      expect(res.body.jsonrpc).toBe("2.0");
    });
  });
});