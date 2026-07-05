# Skills Assessment — pi-a2a-communication

> **Skill domain:** Multi-agent protocol implementation and spec-compliance engineering — the A2A (Agent2Agent) tier of the AI-agent infrastructure stack. See the [`bap_coe` portfolio hub →](https://github.com/carlosfrias/apigee-hybrid-workspace/blob/main/SKILLS-ASSESSMENT.md) for the Apigee platform-operations counterpart and the full corpus.

---

## Why this project is notable

- **Spec compliance, proven.** 19/19 A2A v1.0 conformance tests pass — implementation correctness is verified against the standard, not asserted. ([Spec Compliance Report](wiki/pi-a2a-communication/reference/A2A-v1-Conformance-Report.md))
- **Production-grade transport.** Both `message/send` (request/response) and `message/stream` (SSE for long-running agent output) — the real A2A wire shapes, not a single toy channel.
- **Disconnect-resilient task ledgering.** Tasks are durable (`task-ledger.ts`, `replicated-ledger.ts`), so a client that drops can `tasks/resubscribe` and recover its stream. State survives the connection — the hard part of agent orchestration.
- **RFC 8615 agent-card discovery.** Capability advertisement at the spec-compliant `/.well-known/agent-card.json`, with a legacy fork path retained for back-compat.
- **Fork-and-maintain discipline.** Carries spec-compliance fixes on top of upstream; the conformance suite guards against drift.

---

## Expertise demonstrated

> TypeScript is the medium. The engineering evidence lives in the [project README →](README.md). What follows is the skills assessment for the business reader.

- **Spec-compliance engineering** — implementing an external standard (Google A2A v1.0) with a conformance suite that proves it. 19/19 tests pass. The discipline is: read the spec, implement to the spec, write tests against the spec, fix until the tests pass. The spec is the authority, not the implementation.
- **JSON-RPC + SSE streaming** — both wire shapes for agent messaging. `message/send` for request/response; `message/stream` for Server-Sent Events that deliver long-running agent output in real time. Two channels, one task model.
- **Multi-agent task lifecycle** — the full `queued/working/completed/failed/canceled` state machine with subscribe / resubscribe / push-notification config. The state machine is the orchestration — the protocol is the contract.
- **Disconnect-resilient task ledgering** — durable task streams, not ephemeral requests. A client that drops mid-stream can `tasks/resubscribe` and recover. The task outlives the connection that started it.
- **RFC 8615 well-known discovery** — agent-card capability advertisement done to spec. The `/.well-known/agent-card.json` path is the standard; the legacy fork path is retained for back-compat.
- **Fork-and-fix upstream maintenance** — maintaining conformance against an evolving upstream. The conformance suite is the guard rail.

---

## How this shows the expertise

This is the most spec-rigorous piece of the pi-orchestration ecosystem. ~5,746 lines of TypeScript implementing an external standard to the letter, verified by a conformance suite — not a "A2A-like" interface. The clearest single signal: **19/19 conformance tests passing**. That is not "we implemented something similar" — it is "we implemented the spec, and the tests prove it."

The second signal: **disconnect-resilient task ledgering**. Most agent protocols treat tasks as ephemeral request/response pairs. A2A's `tasks/resubscribe` means the task outlives the connection — the client drops, reconnects, and recovers its stream. That is the hard part of agent orchestration, encoded as protocol-level durability, not application-level retry.

---

## Related expertise

| Skill | Repository | Assessment |
|-------|-----------|-----------|
| Apigee Hybrid / K8s automation (portfolio hub) | [`apigee-hybrid-workspace`](https://github.com/carlosfrias/apigee-hybrid-workspace) | [SKILLS-ASSESSMENT.md →](https://github.com/carlosfrias/apigee-hybrid-workspace/blob/main/SKILLS-ASSESSMENT.md) ✅ portfolio hub |
| Rolling upgrade / DR / traffic fencing | [`apigee-opdk-playbook-maintenance-opdk-upgrade`](https://github.com/carlosfrias/apigee-opdk-playbook-maintenance-opdk-upgrade) | [SKILLS-ASSESSMENT.md →](https://github.com/carlosfrias/apigee-opdk-playbook-maintenance-opdk-upgrade/blob/main/SKILLS-ASSESSMENT.md) ✅ |
| OpenLDAP / packaging resilience | [`apigee-opdk-setup-os-openldap`](https://github.com/carlosfrias/apigee-opdk-setup-os-openldap) | [SKILLS-ASSESSMENT.md →](https://github.com/carlosfrias/apigee-opdk-setup-os-openldap/blob/main/SKILLS-ASSESSMENT.md) ✅ |

---

## Provenance

Authored and maintained by **Carlos Frias**. Forked from `DrOlu/pi-a2a-communication` with spec-compliance fixes. This skills assessment is the companion to the engineering [README →](README.md). For the full engineering detail — architecture, testing, and integration — see the project README.

## License

[MIT](./LICENSE) — Copyright (c) 2026 pi-extensions.