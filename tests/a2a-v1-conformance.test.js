/**
 * A2A v1.0 Protocol Conformance Test Suite
 * for pi-a2a-communication (local fork v0.1.0-alpha.1)
 *
 * Tests the LOCAL fork against the A2A Protocol v1.0 specification.
 *
 * Spec gaps identified (S1–S6):
 *   S1: JSON-RPC errors return HTTP 400 (convention: HTTP 200)
 *   S2: 401 responses lack WWW-Authenticate header (RFC 7235: MUST)
 *   S3: /.well-known/agent-card.json not supported (spec: MUST)
 *   S4: /message:send and /message:stream not supported (spec HTTP/REST binding)
 *   S5: /sendMessage lacks try/catch for JSON.parse (uncaught → HTTP 500)
 *   S6: JSON-RPC method names are slash-separated, not PascalCase (spec: SendMessage)
 *
 * Passing features:
 *   ✅ /.well-known/agent.json (local fork path, NOT spec path)
 *   ✅ / root JSON-RPC dispatcher (accepts slash-separated methods only)
 *   ✅ Bearer token authentication
 *   ✅ /sendMessage and /sendStreamingMessage (legacy paths)
 *
 * Usage:
 *   cd workshop/02-Areas/Infrastructure/pi-a2a-communication
 *   npx vitest run a2a-v1-conformance
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { A2AServer } from 'pi-a2a-communication';
import http from 'node:http';
// ─── Test Configuration ───────────────────────────────────────────────────────
const TEST_PORT = 29876;
const TEST_HOST = '127.0.0.1';
const TEST_TOKEN = 'test-conformance-token';
const TEST_BASE = `http://${TEST_HOST}:${TEST_PORT}`;
let server;
function request(method, path, body, token) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, TEST_BASE);
        const isString = typeof body === 'string';
        const payload = body ? (isString ? body : JSON.stringify(body)) : undefined;
        const options = {
            hostname: TEST_HOST,
            port: TEST_PORT,
            path: url.pathname + url.search,
            method,
            headers: {
                ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload).toString() } : {}),
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
        };
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
                const headers = {};
                for (let i = 0; i < res.rawHeaders.length; i += 2) {
                    headers[res.rawHeaders[i].toLowerCase()] = res.rawHeaders[i + 1];
                }
                let parsed = data;
                try {
                    parsed = JSON.parse(data);
                }
                catch { }
                resolve({ status: res.statusCode ?? 0, headers, body: parsed, raw: data });
            });
        });
        req.on('error', reject);
        if (payload)
            req.write(payload);
        req.end();
    });
}
// ─── Test Suite ────────────────────────────────────────────────────────────────
describe('A2A v1.0 Protocol Conformance', () => {
    beforeAll(async () => {
        server = new A2AServer({ enabled: true, port: TEST_PORT, host: TEST_HOST }, { defaultScheme: 'bearer', bearerToken: TEST_TOKEN }, null);
        await server.start();
        await new Promise(r => setTimeout(r, 200));
    });
    afterAll(async () => {
        if (server?.isRunning()) {
            await server.stop();
        }
    });
    // ─── S3: Agent Card Discovery Path ────────────────────────────────────────
    //
    // A2A v1.0 Spec §8.2, §14.3: "Well-Known URI: /.well-known/agent-card.json"
    // The local fork routes /.well-known/agent.json (not spec-compliant).
    // The published npm v1.0.1 routes /.well-known/agent-card (also not spec-compliant).
    // Neither implementation serves the correct spec path.
    describe('S3: Agent Card discovery paths', () => {
        it('MUST serve Agent Card at /.well-known/agent-card.json (A2A v1.0 spec path)', async () => {
            const res = await request('GET', '/.well-known/agent-card.json', undefined, TEST_TOKEN);
            // Spec: The agent card MUST be discoverable at /.well-known/agent-card.json
            expect(res.status).toBe(200); // ❌ FAILS: returns 404
        });
        it('SHOULD serve Agent Card at /.well-known/agent.json for backward compat', async () => {
            // The local fork serves this path, but it is NOT the spec path
            const res = await request('GET', '/.well-known/agent.json', undefined, TEST_TOKEN);
            expect(res.status).toBe(200); // ✅ PASSES (local fork path)
            expect(res.body.name).toBe('pi-coding-agent');
        });
        it('SHOULD serve Agent Card at /.well-known/agent-card for legacy compat', async () => {
            // Many A2A clients use this path (npm v1.0.1 did). The fork doesn't support it.
            const res = await request('GET', '/.well-known/agent-card', undefined, TEST_TOKEN);
            expect(res.status).toBe(200); // ❌ FAILS: returns 404
        });
    });
    // ─── S1: JSON-RPC Errors Must Return HTTP 200 ──────────────────────────────
    //
    // JSON-RPC over HTTP convention (not in core JSON-RPC 2.0 spec, which is
    // transport-agnostic): JSON-RPC error responses SHOULD use HTTP 200.
    // The A2A v1.0 spec examples show HTTP 200 for successful responses but don't
    // explicitly mandate HTTP 200 for error responses.
    //
    // Current behavior: sendJSONRPCError() uses HTTP 400 (res.writeHead(400))
    // Recommendation: Change to HTTP 200 for JSON-RPC error transport neutrality.
    describe('S1: JSON-RPC error HTTP status codes', () => {
        it('SHOULD return HTTP 200 for JSON-RPC invalid params errors (convention)', async () => {
            const res = await request('POST', '/', {
                jsonrpc: '2.0',
                id: '1',
                method: 'SendMessage',
                params: {}, // missing required 'message' field
            }, TEST_TOKEN);
            // Convention: HTTP 200 with JSON-RPC error body
            // Current: HTTP 400 with JSON-RPC error body
            expect(res.status).toBe(200); // ❌ FAILS: returns 400
            expect(res.body.jsonrpc).toBe('2.0');
            expect(res.body.error?.code).toBe(-32602);
        });
        it('SHOULD return HTTP 200 for JSON-RPC method-not-found errors (convention)', async () => {
            const res = await request('POST', '/', {
                jsonrpc: '2.0',
                id: '2',
                method: 'nonexistent/method',
                params: {},
            }, TEST_TOKEN);
            expect(res.status).toBe(200); // ❌ FAILS: returns 400
            expect(res.body.jsonrpc).toBe('2.0');
            expect(res.body.error?.code).toBe(-32601);
        });
        it('SHOULD return HTTP 200 for JSON-RPC parse errors (convention)', async () => {
            // Root dispatcher has try/catch for JSON.parse → returns -32700 properly
            const res = await request('POST', '/', '{malformed json', TEST_TOKEN);
            expect(res.status).toBe(200); // ❌ FAILS: returns 400
            expect(res.body.jsonrpc).toBe('2.0');
            expect(res.body.error?.code).toBe(-32700);
            // Note: The server uses `id ?? 0` instead of `id: null` for parse errors.
            // JSON-RPC 2.0 spec §5.1: "id MUST be Null if there was an error detecting the request id."
            expect(res.body.id).toBeNull(); // ❌ FAILS: returns id:0
        });
    });
    // ─── S5: /sendMessage Parse Error Handling ──────────────────────────────────
    //
    // The legacy /sendMessage handler calls JSON.parse(body) without try/catch.
    // Uncaught SyntaxError propagates to top-level catch → HTTP 500.
    // Should return a JSON-RPC parse error (code -32700) instead.
    describe('S5: Legacy path /sendMessage parse error handling', () => {
        it('MUST handle malformed JSON gracefully on /sendMessage', async () => {
            const res = await request('POST', '/sendMessage', '{malformed json', TEST_TOKEN);
            // Spec: HTTP 200 with JSON-RPC parse error (code -32700)
            // Current: HTTP 500 "Internal Server Error" (uncaught SyntaxError)
            expect(res.status).toBe(200); // ❌ FAILS: returns 500
        });
    });
    // ─── S2: WWW-Authenticate Header on 401 Responses ──────────────────────────
    //
    // RFC 7235 §2.1: "A server generating a 401 response MUST send a
    //   WWW-Authenticate header field containing at least one challenge."
    describe('S2: WWW-Authenticate header on 401 responses', () => {
        it('MUST include WWW-Authenticate header on 401 response (RFC 7235)', async () => {
            const res = await request('GET', '/.well-known/agent.json');
            expect(res.status).toBe(401);
            expect(res.headers['www-authenticate']).toBeDefined(); // ❌ FAILS: header missing
        });
        it('MUST include WWW-Authenticate header on 401 for JSON-RPC requests', async () => {
            const res = await request('POST', '/', {
                jsonrpc: '2.0',
                id: '1',
                method: 'SendMessage',
                params: { message: { role: 'user', parts: [{ type: 'text', text: 'test' }] } },
            }); // no auth token
            expect(res.status).toBe(401);
            expect(res.headers['www-authenticate']).toBeDefined(); // ❌ FAILS
        });
    });
    // ─── S4: A2A v1.0 HTTP/REST Endpoint Paths ────────────────────────────────
    //
    // A2A v1.0 defines TWO transport bindings:
    //   1. HTTP/REST binding (§11.3.1): POST /message:send, POST /message:stream
    //   2. JSON-RPC binding (§9.2): Single endpoint POST /rpc with method dispatch
    //
    // The local fork only supports /sendMessage and /sendStreamingMessage (legacy).
    describe('S4: A2A v1.0 HTTP/REST endpoint paths', () => {
        it('MUST accept POST /message:send (A2A v1.0 HTTP/REST binding)', async () => {
            // A2A v1.0 §11.3.1: HTTP/REST binding uses colon-separated paths
            const res = await request('POST', '/message:send', {
                jsonrpc: '2.0',
                id: '1',
                method: 'SendMessage',
                params: { message: { role: 'user', parts: [{ type: 'text', text: 'test' }] } },
            }, TEST_TOKEN);
            expect(res.status).toBe(200); // ❌ FAILS: returns 404
        });
        it('MUST accept POST /message:stream (A2A v1.0 HTTP/REST binding)', async () => {
            const res = await request('POST', '/message:stream', {
                jsonrpc: '2.0',
                id: '2',
                method: 'SendStreamingMessage',
                params: { message: { role: 'user', parts: [{ type: 'text', text: 'test' }] } },
            }, TEST_TOKEN);
            expect(res.status).toBe(200); // ❌ FAILS: returns 404
        });
        it('MUST support JSON-RPC dispatch at POST /rpc (A2A v1.0 JSON-RPC binding)', async () => {
            // A2A v1.0 §9.2: JSON-RPC binding uses a single /rpc endpoint
            const res = await request('POST', '/rpc', {
                jsonrpc: '2.0',
                id: '3',
                method: 'SendMessage',
                params: { message: { role: 'user', parts: [{ type: 'text', text: 'test' }] } },
            }, TEST_TOKEN);
            expect(res.status).toBe(200); // ❌ FAILS: returns 404
        });
    });
    // ─── S6: JSON-RPC Method Names ────────────────────────────────────────────
    //
    // A2A v1.0 §5.3, §9.4: JSON-RPC method names are PascalCase:
    //   SendMessage, SendStreamingMessage, GetTask, CancelTask, etc.
    //
    // The local fork uses slash-separated lowercase: message/send, tasks/get, etc.
    // The root dispatcher accepts slash-separated methods only.
    describe('S6: JSON-RPC method names must be PascalCase (A2A v1.0)', () => {
        it('MUST accept "SendMessage" method (A2A v1.0 PascalCase)', async () => {
            // The root dispatcher only accepts slash-separated methods (message/send).
            // A spec-compliant client sending "SendMessage" gets Method not found.
            const res = await request('POST', '/', {
                jsonrpc: '2.0',
                id: '1',
                method: 'SendMessage',
                params: { message: { role: 'user', parts: [{ type: 'text', text: 'test' }] } },
            }, TEST_TOKEN);
            // Should return 200 with result; currently returns -32601 Method not found
            expect(res.status).toBe(200); // ❌ FAILS: returns 400 (method not found)
            expect(res.body.result).toBeDefined(); // ❌ FAILS: returns error
        });
        it('MUST accept "GetTask" method (A2A v1.0 PascalCase)', async () => {
            const res = await request('POST', '/', {
                jsonrpc: '2.0',
                id: '2',
                method: 'GetTask',
                params: { id: 'nonexistent' },
            }, TEST_TOKEN);
            // Should return 200 with task-not-found error; currently returns -32601
            expect(res.status).toBe(200); // ❌ FAILS: returns 400
        });
    });
    // ─── PASSING: Working Features ────────────────────────────────────────────
    describe('Working A2A features (PASSING)', () => {
        it('MUST reject requests without Authorization header', async () => {
            const res = await request('GET', '/.well-known/agent.json');
            expect(res.status).toBe(401); // ✅
        });
        it('MUST reject requests with wrong token', async () => {
            const res = await request('GET', '/.well-known/agent.json', undefined, 'wrong-token');
            expect(res.status).toBe(401); // ✅
        });
        it('MUST accept requests with correct Bearer token', async () => {
            const res = await request('GET', '/.well-known/agent.json', undefined, TEST_TOKEN);
            expect(res.status).toBe(200); // ✅
            expect(res.body.name).toBe('pi-coding-agent');
        });
        it('SHOULD accept POST /sendMessage (legacy path)', async () => {
            const res = await request('POST', '/sendMessage', {
                jsonrpc: '2.0',
                id: '3',
                method: 'message/send',
                params: { message: { role: 'user', parts: [{ type: 'text', text: 'test' }] } },
            }, TEST_TOKEN);
            expect(res.status).toBe(200); // ✅
            expect(res.body.jsonrpc).toBe('2.0');
            expect(res.body.result).toBeDefined();
        });
        it('SHOULD support JSON-RPC dispatch at root path / (slash-separated methods)', async () => {
            // NOTE: This passes because the root dispatcher accepts slash-separated
            // method names (message/send). A spec-compliant client using PascalCase
            // (SendMessage) would get Method not found. See S6.
            const res = await request('POST', '/', {
                jsonrpc: '2.0',
                id: '4',
                method: 'message/send',
                params: { message: { role: 'user', parts: [{ type: 'text', text: 'test' }] } },
            }, TEST_TOKEN);
            expect(res.status).toBe(200); // ✅ (only for slash-separated methods)
            expect(res.body.jsonrpc).toBe('2.0');
            expect(res.body.result).toBeDefined();
        });
    });
    // ─── Summary ──────────────────────────────────────────────────────────────
    //
    // Conformance Results for pi-a2a-communication (local fork v0.1.0-alpha.1):
    //
    // | ID  | Severity | Issue                                              | Status |
    // |-----|----------|----------------------------------------------------|--------|
    // | S1  | MEDIUM   | JSON-RPC errors return HTTP 400 (convention: 200) | ❌     |
    // | S2  | HIGH     | 401 responses lack WWW-Authenticate header (RFC 7235)| ❌    |
    // | S3  | HIGH     | /.well-known/agent-card.json not supported (spec path)| ❌    |
    // | S4  | HIGH     | /message:send, /message:stream, /rpc not supported  | ❌     |
    // | S5  | HIGH     | /sendMessage uncaught parse error → HTTP 500       | ❌     |
    // | S6  | HIGH     | Method names slash-separated, not PascalCase        | ❌     |
    // | S6b | LOW      | id:0 instead of id:null in parse errors            | ❌     |
    // | —   | ✅       | /.well-known/agent.json (local fork path)          | ✅     |
    // | —   | ✅       | Bearer token authentication                        | ✅     |
    // | —   | ✅       | /sendMessage (legacy path)                         | ✅     |
    // | —   | ✅       | / root JSON-RPC dispatcher (slash-separated only)  | ✅     |
    //
    // Fix locations (in a2a-server.ts):
    //   S1:  sendJSONRPCError() → change res.writeHead(400) to res.writeHead(200)
    //   S2:  isAuthenticated() rejection → add res.setHeader('WWW-Authenticate', 'Bearer')
    //   S3:  Add '/.well-known/agent-card.json' route alongside '/.well-known/agent.json'
    //   S4:  Add '/message:send', '/message:stream', '/rpc' routes
    //   S5:  Add try/catch around JSON.parse in handleSendMessage()
    //   S6:  Add PascalCase method name mapping in root JSON-RPC dispatcher
    //   S6b: Change `id ?? 0` to `id: null` in parse error responses
});
//# sourceMappingURL=a2a-v1-conformance.test.js.map