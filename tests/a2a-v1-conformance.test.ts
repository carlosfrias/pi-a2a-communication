/**
 * A2A v1.0 Protocol Conformance Tests — S2, S3, S5
 *
 * Tests for PR 1: fix: A2A v1.0 auth, agent discovery, and crash handling
 *
 * S2: WWW-Authenticate header on 401 responses
 * S3: Agent Card discovery at spec-compliant /.well-known/agent-card.json
 * S5: try/catch around JSON.parse in handleSendMessage
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { A2AServer } from "../a2a-server.js";
import type { ServerConfig, SecurityConfig } from "../types.js";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";

const TEST_PORT = 18765;
const TEST_TOKEN = "test-bearer-token-conformance";

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

describe("A2A v1.0 Protocol Conformance — PR 1 (S2, S3, S5)", () => {
  let server: A2AServer;

  beforeAll(async () => {
    server = createTestServer();
    await server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  // ─── S2: WWW-Authenticate header on 401 responses ────────────────────
  describe("S2: WWW-Authenticate header on 401 responses", () => {
    it("MUST include WWW-Authenticate: Bearer on 401 responses", async () => {
      const res = await request("GET", "/.well-known/agent-card.json");
      expect(res.status).toBe(401);
      expect(res.headers["www-authenticate"]).toBe("Bearer");
    });

    it("MUST include WWW-Authenticate on unauthenticated JSON-RPC requests", async () => {
      const res = await request("POST", "/", {
        jsonrpc: "2.0",
        method: "message/send",
        id: 1,
        params: {},
      });
      expect(res.status).toBe(401);
      expect(res.headers["www-authenticate"]).toBe("Bearer");
    });
  });

  // ─── S3: Agent Card discovery at spec-compliant path ──────────────────
  describe("S3: Agent Card discovery paths", () => {
    it("MUST serve Agent Card at /.well-known/agent-card.json (A2A v1.0 §8.2)", async () => {
      const res = await request("GET", "/.well-known/agent-card.json", undefined, TEST_TOKEN);
      expect(res.status).toBe(200);
      expect(res.body.name).toBeDefined();
    });

    it("SHOULD serve Agent Card at legacy /.well-known/agent-card path (backward compat)", async () => {
      const res = await request("GET", "/.well-known/agent-card", undefined, TEST_TOKEN);
      expect(res.status).toBe(200);
      expect(res.body.name).toBeDefined();
    });

    it("SHOULD serve Agent Card at legacy /.well-known/agent.json path (backward compat)", async () => {
      const res = await request("GET", "/.well-known/agent.json", undefined, TEST_TOKEN);
      expect(res.status).toBe(200);
      expect(res.body.name).toBeDefined();
    });
  });

  // ─── S5: Uncaught parse error returns proper JSON-RPC error ───────────
  describe("S5: Legacy path /sendMessage parse error handling", () => {
    it("MUST return JSON-RPC Parse error (-32700) for malformed JSON", async () => {
      const res = await request("POST", "/sendMessage", "{malformed json" as any, TEST_TOKEN);
      // HTTP status may be 200 or 400 depending on S1 fix; both are acceptable here
      expect([200, 400]).toContain(res.status);
      expect(res.body.jsonrpc).toBe("2.0");
      expect(res.body.error?.code).toBe(-32700);
    });
  });
});