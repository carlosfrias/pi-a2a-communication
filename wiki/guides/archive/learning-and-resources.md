---
name: Learning and Resources Guide
updated: 2026-06-19
category: guides
---

# Learning and Resources Guide

A curated guide to understanding the A2A protocol, this library's architecture, best practices, and common deployment patterns. Whether you're new to A2A or extending this extension, start here.

---

## Table of Contents

1. [What This Library Is](#what-this-library-is)
2. [A2A Protocol Fundamentals](#a2a-protocol-fundamentals)
3. [Official Specification & Reference](#official-specification--reference)
4. [Tutorials & Getting Started](#tutorials--getting-started)
5. [How This Library Implements A2A](#how-this-library-implements-a2a)
6. [Common Deployment Patterns](#common-deployment-patterns)
7. [Best Practices](#best-practices)
8. [A2A vs Other Protocols](#a2a-vs-other-protocols)
9. [Enterprise Deployment Guides](#enterprise-deployment-guides)
10. [Local Documentation](#local-documentation)

---

## What This Library Is

**pi-a2a-communication** is a TypeScript Node.js library — a **pi extension package** (plugin) that adds A2A protocol capabilities to the pi coding agent. It is **not** a React app, web framework, or frontend project.

| Aspect | Detail |
|--------|--------|
| **Type** | Backend library / pi extension package |
| **Language** | TypeScript (ES2022, NodeNext modules) |
| **Runtime** | Node.js ≥ 18 |
| **Framework** | None — plain TypeScript, hooks into pi via `ExtensionAPI` |
| **Runtime Dependencies** | Zero |
| **Testing** | Vitest |
| **UI** | None — headless extension providing slash commands and tools |

The library has two sides:

- **Client side** (`a2a-client.ts`) — pi *calls* remote A2A agents
- **Server side** (`a2a-server.ts`) — pi *exposes itself as* an A2A agent (local testing only; production gateway is `pi-a2a-gateway`)

---

## A2A Protocol Fundamentals

The Agent2Agent (A2A) protocol is an **open standard** by Google for communication between independent AI agent systems. Key concepts:

### Core Primitives

| Primitive | Description | This Library |
|-----------|-------------|--------------|
| **Agent Card** | JSON document at `/.well-known/agent-card` describing an agent's capabilities, skills, and endpoints | `agent-discovery.ts` |
| **Message** | A task sent from one agent to another (JSON-RPC 2.0) | `a2a-client.ts` — `sendMessage`, `sendStreamingMessage` |
| **Task** | A unit of work with a lifecycle (submitted → working → completed/failed/canceled) | `task-manager.ts` |
| **Streaming** | Server-Sent Events (SSE) for real-time task progress updates | `a2a-client.ts` — `sendStreamingMessage` |
| **Push Notification** | Callback URL for async task completion notifications | `a2a-client.ts` |

### Task Lifecycle

```
submitted → working → completed
                    → failed
                    → canceled
         → input-required (agent needs more info)
```

### Communication Patterns

| Pattern | Method | Description |
|---------|--------|-------------|
| **Synchronous** | `message/send` | Send message, wait for result |
| **Streaming** | `message/stream` | Send message, receive SSE events |
| **Task Polling** | `tasks/get` | Check status of a running task |
| **Task Cancel** | `tasks/cancel` | Cancel a running task |
| **Task Subscribe** | `tasks/subscribe` | SSE stream of task state changes |

---

## Official Specification & Reference

These are the **authoritative sources** for the A2A v1.0 protocol:

| Resource | URL | What You'll Learn |
|----------|-----|-------------------|
| **A2A v1.0 Spec** | [a2a-protocol.org/v1.0.0/specification](https://a2a-protocol.org/v1.0.0/specification/) | The canonical protocol specification — JSON-RPC methods, task lifecycle, Agent Cards, streaming |
| **Google A2A GitHub** | [github.com/google/A2A](https://github.com/google/A2A) | Official repo with spec, samples, and reference implementations |
| **A2A Project (Community)** | [github.com/a2aproject/A2A](https://github.com/a2aproject/A2A) | Community-maintained (24k+ stars) — Python/JS SDKs, samples, docs |
| **A2A Python SDK** | [github.com/a2aproject/a2a-python](https://github.com/a2aproject/a2a-python) | Reference Python implementation and SDK |

**Recommended reading order:**
1. Read the [v1.0 spec overview](https://a2a-protocol.org/v1.0.0/specification/) for the big picture
2. Skim the [Google A2A repo](https://github.com/google/A2A) for example Agent Cards and sample agents
3. Review this project's conformance tests (`tests/a2a-v1-conformance.test.ts`) for implementation details

---

## Tutorials & Getting Started

| Resource | URL | Level | Description |
|----------|-----|-------|-------------|
| **Google Codelab: Purchasing Concierge** | [codelabs.developers.google.com/intro-a2a-purchasing-concierge](https://codelabs.developers.google.com/intro-a2a-purchasing-concierge) | 🟢 Beginner | Hands-on walkthrough building a multi-agent purchasing system on Cloud Run |
| **IBM A2A Tutorial** | [ibm.com/think/tutorials/use-a2a-protocol-for-ai-agent-communication](https://www.ibm.com/think/tutorials/use-a2a-protocol-for-ai-agent-communication) | 🟢 Beginner | Enterprise perspective on agent-to-agent communication |
| **A2A Protocol Tutorials** | [a2a-protocol.org/tutorials/python/](https://a2a-protocol.org/v0.3.0/tutorials/python/1-introduction/) | 🟢 Beginner | Python-based walkthroughs of core A2A concepts |

**Recommended learning path:**
1. Start with the **Google Codelab** — it walks through building a purchasing concierge that discovers and calls remote agents
2. Try the **IBM tutorial** for an enterprise deployment perspective
3. Return to this project's conformance tests to see how the spec maps to TypeScript code

---

## How This Library Implements A2A

### Source Code Map

| File | Lines | Responsibility |
|------|-------|---------------|
| `src/types.ts` | ~497 | A2A v1.0 protocol type definitions, constants, and JSON-RPC schemas |
| `src/a2a-client.ts` | ~718 | Client: `sendMessage`, `sendStreamingMessage`, `getTask`, `cancelTask` |
| `src/a2a-server.ts` | ~1159 | Server: HTTP listener, JSON-RPC dispatcher, SSE handler, task lifecycle |
| `src/agent-discovery.ts` | ~390 | Agent Card fetching, parsing, caching, and registry |
| `src/task-manager.ts` | ~400 | Task orchestration: single, parallel, chain, async execution modes |
| `src/config.ts` | ~333 | Configuration manager with disk persistence and agent registry |
| `src/index.ts` | ~744 | Extension entry point — registers all commands and tools with pi |

### Spec Compliance Status

The conformance test suite (`tests/a2a-v1-conformance.test.ts`) is the source of truth for A2A v1.0 compliance. See:

- [A2A v1 Spec Compliance](../a2a-v1-spec-compliance.md) — compliance audit results
- [A2A v1 Conformance Report](../A2A-v1-Conformance-Report.md) — full executive report with Mermaid diagrams
- [A2A v1 Conformance Audit](../../A2A-v1-Conformance-Audit.md) — detailed code-level findings

### Commands and Tools

The extension registers 10 slash commands and 2 programmatic tools:

**Slash Commands:** `/a2a-discover`, `/a2a-agents`, `/a2a-send`, `/a2a-broadcast`, `/a2a-chain`, `/a2a-status`, `/a2a-cancel`, `/a2a-server`, `/a2a-config`, `/a2a-help`

**Tools:** `a2a_call` (single agent), `a2a_parallel` (multiple agents)

See the [README](../../../README.md) for full usage examples.

---

## Common Deployment Patterns

### Pattern 1: Agent Discovery

An agent publishes an **Agent Card** (JSON at `/.well-known/agent-card`) describing its capabilities. Other agents find it via `/a2a-discover`.

```bash
# Discover what an agent can do
/a2a-discover https://agent.example.com

# List all known agents
/a2a-agents
```

**Use case:** Finding available agents in a fleet or marketplace, understanding their capabilities before sending tasks.

### Pattern 2: Task Delegation

Agent A sends a task to Agent B using `message/send` (JSON-RPC). Agent B processes it and returns a result.

```bash
# Delegate a task to a single agent
/a2a-send security-agent "Audit this codebase for SQL injection vulnerabilities"
```

**Use case:** Direct delegation — "I need X done, you're the expert, here's the task."

### Pattern 3: Streaming Responses

For long-running tasks, Agent A uses `message/stream` (JSON-RPC over SSE) to get incremental progress updates.

```bash
# Send with streaming enabled (default)
/a2a-send research-agent "Analyze this dataset" --streaming
```

**Use case:** Real-time progress on long tasks — code generation, data analysis, multi-step reasoning.

### Pattern 4: Parallel Orchestration

Call multiple agents simultaneously with `a2a_parallel`, then combine results.

```bash
# Ask 3 security agents the same question
/a2a-broadcast "Audit this code for vulnerabilities" \
  --agents https://security1.enterprise.com,https://security2.enterprise.com,https://compliance.enterprise.com
```

**Use case:** Redundancy (voting/consensus), breadth (different perspectives), and speed (parallel execution).

### Pattern 5: Pipeline Chaining

Chain agents sequentially, passing each output as the next input.

```bash
# Scout → Reviewer → Worker pipeline
/a2a-chain code-scout "find all auth code" \
  | code-reviewer "review {previous} for issues" \
  | code-worker "fix the issues in {previous}"
```

**Use case:** Multi-step workflows where each agent specializes in one stage.

### Pattern 6: Agent-as-a-Service

Expose your pi agent as an A2A server so other agents can discover and call it.

```bash
# Start the A2A server
/a2a-server start 10000
```

**Use case:** Making your pi agent available to other agents in a fleet or across organizations.

---

## Best Practices

### Protocol Compliance

- **Always use spec-compliant method names:** `message/send`, `message/stream`, `tasks/get`, `tasks/cancel`, `tasks/subscribe`
- **Always use the spec Agent Card path:** `/.well-known/agent-card` (not `.json`)
- **Always follow the task state machine:** submitted → working → completed/failed/canceled
- **Never skip the conformance tests:** After any change to `types.ts` or `a2a-server.ts`, run `npx vitest run a2a-v1-conformance`

### Security

- **Always use HTTPS in production** — never send Agent Cards or task messages over plain HTTP
- **Configure authentication** — Bearer tokens at minimum; OAuth2 or mTLS for cross-organization
- **Verify SSL certificates** — keep `security.verifySsl: true` (default) in production
- **Use API gateways** for external-facing agents rather than exposing them directly

### Task Management

- **Use streaming for long tasks** — polling (`tasks/get`) is acceptable for short tasks, but SSE streaming is more efficient for anything over a few seconds
- **Set appropriate timeouts** — A2A tasks can run for minutes; configure `client.timeout` accordingly
- **Handle `input-required` state** — agents may need more information; your client should handle this gracefully
- **Cancel tasks you don't need** — don't leave tasks running that you've abandoned

### Agent Card Design

- **Be specific about capabilities** — list exact skills, input/output schemas, and authentication requirements
- **Include security schemes** — document your authentication requirements in the Agent Card
- **Version your Agent Card** — use the `version` field so clients can detect breaking changes
- **Cache responsibly** — the default TTL is 5 minutes; adjust based on how often your agent changes

### Error Handling

- **Retry with backoff** — the client retries 3 times with 1s delay by default; increase for flaky networks
- **Handle JSON-RPC errors** — A2A uses JSON-RPC 2.0 error codes (-32700, -32600, -32601, -32602, -32603)
- **Graceful degradation** — if an agent is unreachable, don't crash; log the error and continue with available agents

---

## A2A vs Other Protocols

| | A2A | MCP | ACP |
|--|-----|-----|-----|
| **What** | Agent ↔ Agent communication | Agent ↔ Tool integration | Agent ↔ Agent (Apple's take) |
| **Analogy** | Colleagues delegating work | Worker using a tool | Colleagues sharing context |
| **Transport** | JSON-RPC over HTTP/SSE | JSON-RPC over stdio/HTTP | Apple proprietary |
| **Discovery** | Agent Cards (`.well-known/agent-card`) | Tool manifests | N/A |
| **This project** | ✅ What we implement | ❌ Complementary, not competing | ❌ Not relevant |

**When to use A2A:** When you need agents to *delegate tasks to each other*, *discover capabilities dynamically*, or *collaborate across organizational boundaries*.

**When to use MCP:** When you need an agent to *use a tool* (database, API, file system) — MCP is for tool integration, not inter-agent communication.

**They complement each other:** An A2A agent might use MCP to access tools locally while using A2A to delegate tasks to other agents.

---

## Enterprise Deployment Guides

| Resource | URL | Key Topics |
|----------|-----|------------|
| **AWS A2A Gateway Sample** | [github.com/aws-samples/sample-a2a-gateway](https://github.com/aws-samples/sample-a2a-gateway) | Serverless gateway, 3-layer architecture (management/control/data) |
| **Kubernetes Deployment** | [stacka2a.dev/blog/a2a-kubernetes-deployment-guide](https://stacka2a.dev/blog/a2a-kubernetes-deployment-guide) | K8s deployment, scaling, service mesh |
| **Azure A2A Apps** | [techcommunity.microsoft.com/blog/.../4433114](https://techcommunity.microsoft.com/blog/appsonazureblog/building-agent-to-agent-a2a-applications-on-azure-app-service/4433114) | Azure App Service deployment |
| **Enterprise Guide (Xenoss)** | [xenoss.io/blog/agent2agent-a2a-protocol-enterprise-guide](https://xenoss.io/blog/agent2agent-a2a-protocol-enterprise-guide) | Enterprise patterns, security, scaling |
| **Protocol Comparison (Tyk)** | [tyk.io/learning-center/agent-protocols-a-complete-guide-to-mcp-a2a-and-acp/](https://tyk.io/learning-center/agent-protocols-a-complete-guide-to-mcp-a2a-and-acp/) | A2A vs MCP vs ACP comparison |

---

## Local Documentation

Documents within this project's wiki:

| Path | Content |
|------|---------|
| [Home](../Home.md) | Wiki home — architecture overview, current status |
| [A2A v1 Spec Compliance](../a2a-v1-spec-compliance.md) | Spec compliance audit results |
| [A2A v1 Conformance Report](../A2A-v1-Conformance-Report.md) | Full executive report with Mermaid diagrams |
| [Agent Card Schema](../agent-card-schema.md) | A2A Agent Card schema reference |
| [Implementation](../implementation/) | Implementation details (planned) |

Key files in the code repo:

| Path | Content |
|------|---------|
| `tests/a2a-v1-conformance.test.ts` | A2A v1.0 spec conformance tests (source of truth) |
| `tests/spec-compliance/` | Unit-level spec compliance tests |
| `tests/characterization/` | Characterization test suites |
| `wiki/reference/A2A-v1-Conformance-Audit.md` | Detailed code-level audit findings |
| `README.md` | Full usage documentation with examples |
| `pi-package.json` | Pi extension manifest (commands, tools) |

---

*Last updated: 2026-06-19*