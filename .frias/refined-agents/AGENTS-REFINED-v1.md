---
version: 1
date: 2026-06-19
session: 2026-06-19-1300
thread: m6-spec-compliance
trigger: A2A conformance audit validation revealed incorrect spec paths
---

# AGENTS-REFINED — pi-a2a-communication v1

## Rules Extracted

### RULE 1: Verify spec paths against the actual specification, not assumptions
The conformance test suite initially used `/.well-known/agent-card` and `/message/send` based on assumed knowledge. Deepseek validation found that the A2A v1.0 spec actually defines `/.well-known/agent-card.json` (with `.json` suffix per RFC 8615) and `/message:send` (colon-separated per HTTP/REST binding). Always verify paths against the spec document, not against other implementations or assumptions.

### RULE 2: Use two independent models for validation of audit results
The deepseek model caught critical errors (wrong spec paths, wrong URL format, undocumented gap) that the kimi model confirmed but didn't discover independently. Using two models with different strengths — one for validation (catching errors) and one for audit (completeness checking) — produces more reliable results than either alone.

### RULE 3: Conformance test suites must test the spec path, not the implementation path
The test suite was initially testing what the server *does* (e.g., `/.well-known/agent.json`) rather than what the spec *requires* (`/.well-known/agent-card.json`). Mark passing tests that test implementation behavior, not spec compliance, as "PASSING (implementation-specific)" to avoid false confidence.

### RULE 4: When severity levels differ between sources, cite the spec basis
S1 was initially rated HIGH but deepseek correctly identified that JSON-RPC 2.0 is transport-agnostic, making HTTP 200 a convention rather than a hard requirement. Always cite the spec section that mandates the behavior and distinguish between "MUST" (normative) and "SHOULD" (convention).

### RULE 5: Only native pi flags in systemd unit files
From previous session: The pi-agent systemd service must only use flags that are native to pi (`--no-session`, `--name`, `--append-system-prompt`). Extension-specific flags like `--node`, `--server-url` from coms-net will crash pi.