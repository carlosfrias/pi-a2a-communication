# pi-a2a-communication

> **A production-grade, spec-conformant implementation of the Google A2A (Agent2Agent) v1.0 protocol** — the protocol layer that lets heterogeneous agents (pi and non-pi) collaborate via JSON-RPC + Server-Sent Events, with agent-card discovery, full task lifecycle, and disconnect-resilient task ledgering. **19/19 A2A v1.0 conformance tests passing.**

> [!NOTE]
> Engineering portfolio note — this project demonstrates spec-compliance engineering and multi-agent protocol implementation. See the [skills assessment →](SKILLS-ASSESSMENT.md) for the expertise applied.

This is the most spec-rigorous piece of the pi-orchestration ecosystem: ~5,746 lines of TypeScript implementing an external standard to the letter, verified by a conformance suite — not a "A2A-like" interface. Forked from `DrOlu/pi-a2a-communication` and hardened with spec-compliance fixes, it is the contract layer every other multi-agent component in the fleet builds on.

---

## Protocol conformance

Verified against the A2A v1.0 spec by `tests/a2a-v1-conformance.test.ts` — **19/19 tests passing**.

Implemented JSON-RPC methods: `message/send`, `message/stream` (SSE), `tasks/get`, `tasks/cancel`, `tasks/subscribe`, `tasks/resubscribe`, `tasks/pushNotificationConfig/*`, `agent/authenticatedExtendedCard`.

---

## Architecture

~5,746 LOC across 13 TypeScript modules in `src/`:

| Module | Role |
|--------|------|
| `a2a-server.ts` (1,299 lines) | A2A JSON-RPC server |
| `a2a-client.ts` (732 lines) | A2A client |
| `types.ts` | A2A type definitions |
| `agent-discovery.ts` | Agent-card discovery at `/.well-known/agent-card.json` (RFC 8615) |
| `task-manager.ts` | Task lifecycle: `queued / working / completed / failed / canceled` |
| `task-ledger.ts`, `replicated-ledger.ts` | Durable task ledgering — enables `tasks/resubscribe` after disconnect |
| `reclamation.ts` | Task reclamation |
| `pi-session-handler.ts`, `pi-task-bridge.ts` | Bridge pi sessions into the A2A protocol |

### Design notes

- **Two transport shapes.** `message/send` is request/response; `message/stream` uses Server-Sent Events for long-running agent output. Both share the same task model.
- **Disconnect recovery.** Ledgered task state means a dropped client can `tasks/resubscribe` and recover its stream — the task outlives the connection that started it.
- **Agent-card discovery.** Served at the RFC 8615 `/.well-known/agent-card.json`; a legacy fork path is retained for clients that haven't migrated.
- **Fork-and-maintain posture.** Spec-compliance fixes layered over `DrOlu/pi-a2a-communication`; the conformance suite prevents drift.

---

## Tools and commands

Registers three pi tools so agents invoke peers programmatically:

- `a2a_call` — programmatic single-agent invocation
- `a2a_parallel` — parallel agent execution
- `a2a_chain` — sequential agent execution

Plus slash commands: `/a2a-discover`, `/a2a-send`, …

---

## Integration

The protocol layer of a multi-tier orchestration stack:

- Pairs with **`pi-a2a-gateway`** (fleet gateway/proxy) for gateway-mediated A2A dispatch.
- Pairs with **`fleet-resource-manager`**'s `a2a_bridge`, which publishes `AgentHealth` (status + latency + resource metrics) in the A2A format so routing decisions consider node health.
- Bridges **pi sessions** to the A2A protocol so pi and non-pi agents share one collaboration contract.

---

## Installation

pi skill package — see `package.json` / `pi-package.json`.

```bash
pi install <this package>
```

## Testing

```bash
npm test          # full suite: conformance, unit, integration, spec-compliance, characterization
```

## Documentation

- **Wiki:** [wiki/pi-a2a-communication/Home.md](wiki/pi-a2a-communication/Home.md)
- **Conformance:** [A2A v1.0 Spec Compliance Report](wiki/pi-a2a-communication/reference/A2A-v1-Conformance-Report.md)
- **Focus:** [FOCUS.md](FOCUS.md) — current state and session handoff
- **Workbench:** [WORKBENCH.md](WORKBENCH.md) — active tasks and working notes

---

## Provenance

Authored and maintained by **Carlos Frias** as the protocol layer of his pi-orchestration ecosystem — the multi-agent / A2A tier of his AI-agent infrastructure work. Forked from `DrOlu/pi-a2a-communication` with spec-compliance fixes; conformance is proven by the A2A v1.0 test suite.

## License

[MIT](./LICENSE) — Copyright (c) 2026 pi-extensions.