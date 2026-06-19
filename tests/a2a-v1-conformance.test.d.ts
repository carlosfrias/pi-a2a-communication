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
export {};
//# sourceMappingURL=a2a-v1-conformance.test.d.ts.map