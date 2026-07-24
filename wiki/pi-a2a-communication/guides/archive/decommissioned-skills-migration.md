---
name: Decommissioned Skills Migration Guide
updated: 2026-06-19
parents: [[pi-a2a-communication/Home]]
tags: migration, a2a, decompose-execute-verify, fleet-dispatcher-cascade, coms-net
---

# Decommissioned Skills Migration Guide

**From:** `decompose-execute-verify` v2.1.0 + `fleet-dispatcher-cascade` v1.0.0 + `pi-cross-node-comms` (coms-net tools)
**To:** A2A protocol (`a2a_call`, `a2a_parallel`) + `intercom` (unchanged) + `subagent` (unchanged)
**Date:** 2026-06-19

This guide maps every capability from the decommissioned D-E-V / fleet-dispatcher / coms-net stack to its A2A replacement, preserves the patterns worth keeping, and notes what is now simpler.

---

## 1. What the Old Stack Did

### Decompose-Execute-Verify (D-E-V)

A cost-optimization pattern that breaks complex tasks into atomic sub-tasks for cheap local execution, then verifies output with cloud models before it becomes authoritative.

**Execution flow:**
```
User Prompt → Decomposer (cloud, ~$0.03) → Local Model Execution (~$0.00) → Verifier (cloud, ~$0.02) → Final Output
                                                                  Total: ~$0.05
```
vs. cloud end-to-end: ~$0.20–0.30.

Key features:
- Two specialized agents: `decomposer` and `verifier`
- 2x decomposition (decompose the decomposition if needed)
- Complexity ratings per sub-task (low / medium / high)
- Verification gate catches hallucinations before they propagate
- 75–85% cost savings vs. cloud end-to-end

### Fleet-Dispatcher Cascade

A three-tier execution cascade that routes D-E-V sub-tasks through the best available execution tier with per-sub-task graceful degradation.

| Tier | Mechanism | Check | Fallback |
|------|-----------|-------|----------|
| 1 (fleet) | `coms_net_send` / `coms_net_await` | `coms_net_list()` returns peers | Tier 2 |
| 2 (intercom) | `intercom` ask/send | `intercom({ action: "list" })` returns sessions | Tier 3 |
| 3 (subagent) | `subagent({ agent, task })` | Always available | None — guaranteed |

### Coms-Net Tools (pi-cross-node-comms)

The HTTP/SSE hub-based communication layer that fleet-dispatcher relied on:
- `coms_net_list()` — discover online peers and their capabilities
- `coms_net_send({ target, prompt })` — send a task to a peer
- `coms_net_await({ msg_id, timeout_ms })` — block until peer responds
- `coms_net_get({ msg_id })` — non-blocking poll for a response

---

## 2. Capability Mapping: Old → New

### Core Tool Mapping

| Old (coms-net) | New (A2A) | Notes |
|-----------------|-----------|-------|
| `coms_net_send({ target, prompt })` | `a2a_call({ agent_url, message })` | Direct HTTP call, no hub. `agent_url` is the peer's A2A endpoint (e.g. `http://node:10000`) |
| `coms_net_await({ msg_id, timeout_ms })` | `a2a_call({ agent_url, message, timeout })` | A2A call is synchronous with optional `timeout` parameter. No separate await step needed. |
| `coms_net_get({ msg_id })` | N/A — not needed | A2A calls return inline. No async polling pattern. |
| `coms_net_list()` | Agent discovery via `/.well-known/agent-card.json` | Each A2A agent publishes a standardized agent card. Discover peers by fetching their card URL. |
| Parallel dispatch (manual coordination) | `a2a_parallel({ tasks: [...] })` | Built-in parallel execution, no intercom choreography needed |

### Fleet-Dispatcher Tier Mapping

| Old Tier | Old Mechanism | New Mechanism | Status |
|----------|--------------|---------------|--------|
| Tier 1 (fleet) | `coms_net_send` / `coms_net_await` | `a2a_call` / `a2a_parallel` | **Replaced** — direct peer-to-peer, no hub |
| Tier 2 (intercom) | `intercom` ask/send | `intercom` ask/send | **Unchanged** — still valid for local sessions |
| Tier 3 (subagent) | `subagent({ agent, task })` | `subagent({ agent, task })` | **Unchanged** — always-available fallback |

### D-E-V Agent Mapping

| Old Agent | Old Route | New Route | Notes |
|-----------|-----------|------------|-------|
| `decomposer` | Cloud model via subagent | Cloud model via subagent | Pattern unchanged; agent definition still valid |
| `verifier` | Cloud model via subagent | Cloud model via subagent | Pattern unchanged; agent definition still valid |
| `position-monitor` | Tier 1 fleet → Tier 3 subagent | `a2a_call` to fleet node → subagent fallback | Same degradation logic, different transport |
| `bookkeeping` | Tier 1 fleet → Tier 3 subagent | `a2a_call` → subagent fallback | Same degradation logic |
| `technical-infrastructure` | Tier 1 fleet → Tier 3 subagent | `a2a_call` → subagent fallback | Same degradation logic |
| `vision-proxy` | Tier 1 fleet (capability-filtered) | `a2a_call` to capable node | Use agent card `capabilities` field for filtering |

---

## 3. What Is Now Simpler

### No Hub Required

| Aspect | Old (coms-net) | New (A2A) |
|--------|---------------|-----------|
| Architecture | HTTP/SSE hub process running on orchestrator node | Direct peer-to-peer HTTP calls |
| Deployment | Hub URL + token config per node | Each node runs its own A2A server on port 10000 |
| Discovery | Hub tracks online peers, `coms_net_list()` queries hub | Each agent publishes `/.well-known/agent-card.json` |
| Message routing | Hub relays messages between nodes | Direct HTTP — caller connects to target node |
| Failure modes | Hub = single point of failure | No hub = no SPOF |
| SSHFS needed | Yes (for shared state / workspace files) | No — A2A handles data transfer in the call |

### No Separate Await Step

Old pattern (3 calls):
```javascript
// 1. Send
const msg_id = coms_net_send({ target: "node-a", prompt: "..." })
// 2. Await (blocking)
const result = coms_net_await({ msg_id, timeout_ms: 120000 })
// 3. (or poll) coms_net_get({ msg_id })
```

New pattern (1 call):
```javascript
const result = a2a_call({ agent_url: "http://node-a:10000", message: "...", timeout: 120000 })
```

### Standardized Agent Discovery

Old: Hub tracks peer names and capabilities in memory.
New: Each agent publishes a standards-compliant agent card at `/.well-known/agent-card.json` with structured `capabilities`, `skills`, and `metadata`.

---

## 4. Preserved Patterns: What to Keep

These patterns from D-E-V and fleet-dispatcher are transport-independent and remain valuable with A2A.

### 4.1 Decomposition Strategy

The D-E-V decomposition pattern is **transport-agnostic**. Keep it.

**Rules for good sub-tasks:**
- Each sub-task should be a single, clear instruction
- Prefer deterministic operations: extraction, calculation, formatting, comparison
- Avoid sub-tasks requiring subjective judgment
- If you can't write the expected output format, the sub-task is too vague

**2x decomposition:** For complex sub-tasks, decompose the decomposition. The `decomposer` agent can recursively break down sub-tasks that are still too complex after the first pass.

**Implementation:** The `decomposer` and `verifier` agent definitions work unchanged — just change the execution transport from coms-net to A2A.

```yaml
# Decomposer agent (unchanged pattern, new transport)
name: decomposer
model: ollama/qwen3.5:cloud
task: |
  Break down the following task into atomic sub-tasks.
  For each sub-task, specify:
  - instruction (single clear action)
  - expected_format (what the output should look like)
  - complexity (low / medium / high)
  - capability (required peer capability, if any)
```

### 4.2 Verification Practices

The verification gate is the **cheapest insurance** against propagated errors.

**Verification cost:** ~$0.02 per verification call.
**Cost of a propagated error:** Far exceeds verification spend.

**Escalation ladder for verification failures:**

| Failure Type | Action |
|-------------|--------|
| Borderline (verifier was strict) | Accept with caveats, log for review |
| Local model error (hallucination) | Re-run sub-task with cloud model |
| Systematic failure (same error type) | Update decomposition to route this task type to cloud |
| Structural failure (decomposition was wrong) | Re-decompose with refined scope |

**Implementation with A2A:**
```javascript
// Verify output via A2A call to verifier agent
const verification = a2a_call({
  agent_url: "http://verifier-node:10000",
  message: `Verify the following output against these criteria: ...`,
  timeout: 60000
})
```

### 4.3 Cost Estimation Formulas

These formulas remain valid regardless of transport.

| Approach | Relative Cost | Token Profile | Example Cost |
|----------|---------------|---------------|--------------|
| Cloud end-to-end | 1.0x | Full task x every turn | ~$0.25 |
| Static chains | 0.3–0.5x | Only reasoning-heavy steps on cloud | ~$0.10 |
| **D-E-V** | **0.15–0.25x** | Decomposition + verification on cloud, execution on local | **~$0.05** |
| Dispatch overhead (old) | +0.05x | Intercom & SSHFS coordination | ~$0.01 |
| Dispatch overhead (A2A) | +0.02x | Direct HTTP calls, no hub/SSHFS | ~$0.005 |

**Savings formula:**
```
savings_pct = (cloud_end_to_end_cost - actual_cost) / cloud_end_to_end_cost * 100
typical savings: 75–85%
```

**Tracking:**
```bash
# Count decomposer invocations
grep -c "decomposer" ~/.pi/agent/logs/*.jsonl

# Count verifier invocations
grep -c "verifier" ~/.pi/agent/logs/*.jsonl
```

### 4.4 D-E-V Envelope Pattern

The request/response envelope that separates control plane from data plane is still excellent practice with A2A. Adapt the envelope to A2A's message format:

**Old envelope** (coms-net prompt):
```json
{
  "dev_pipeline": {
    "plan_id": "STRING",
    "sub_task_id": NUMBER,
    "tier_target": NUMBER,
    "capability": "STRING",
    "instruction": "STRING",
    "expected_format": "STRING",
    "verification_criteria": ["STRING"],
    "constraints": "STRING"
  }
}
```

**New envelope** (A2A message):
```json
{
  "dev_pipeline": {
    "plan_id": "STRING",
    "sub_task_id": NUMBER,
    "capability": "STRING",
    "instruction": "STRING",
    "expected_format": "STRING",
    "verification_criteria": ["STRING"],
    "constraints": "STRING"
  }
}
```

Note: `tier_target` is removed because A2A routes directly — no tier cascade needed. The caller picks the target agent based on its agent card capabilities.

### 4.5 Capability-Aware Routing

The concept of routing sub-tasks to peers based on their capabilities remains, but the mechanism changes.

**Old:** Query `coms_net_list()`, filter by `capabilities` field in hub response.
**New:** Fetch agent card from `/.well-known/agent-card.json`, check `capabilities` field.

| Task Type | Model Needed | Required Capability | A2A Route |
|-----------|-------------|--------------------|------------|
| Position monitoring | low | — | Any fleet node via `a2a_call` |
| Bookkeeping / logging | low | — | Any fleet node via `a2a_call` |
| Infrastructure checks | medium | — | Any fleet node via `a2a_call` |
| Image analysis / vision | medium+ | `image-inference` | `a2a_call` to vision-capable node |
| Video analysis | high (cloud+GPU) | `video-inference` | `a2a_call` to video-capable node only |
| Audio transcription | medium+ | `audio-inference` | `a2a_call` to audio-capable node |
| Market research | high (cloud) | — | Subagent (local) |
| Decomposition | high (cloud) | — | Subagent (local) |
| Verification | high (cloud) | — | Subagent (local) |

**Media decomposition patterns still apply:**
- Video tasks MUST be decomposed (extract frames first, then analyze)
- Single images can go directly to vision-capable A2A agents
- Multiple images: decompose into per-image analysis + aggregate step

---

## 5. Migration Examples

### 5.1 Single Task: Old vs. New

**Old (fleet-dispatcher + coms-net):**
```javascript
// Tier 1: Try fleet
const peers = coms_net_list()
if (peers.length > 0) {
  const peer = peers.filter(p => p.capabilities.includes('image-inference'))
                     .sort((a, b) => a.context_used_pct - b.context_used_pct)[0]
  const msg_id = coms_net_send({ target: peer.name, prompt: envelope })
  const result = coms_net_await({ msg_id, timeout_ms: 120000 })
  if (result) return result
}
// Tier 2: Try intercom
const sessions = intercom({ action: "list" })
if (sessions.length > 0) {
  const reply = intercom({ action: "ask", to: sessions[0].name, message: envelope })
  if (reply) return reply
}
// Tier 3: Fallback to subagent
return subagent({ agent: "vision-proxy", task: instruction })
```

**New (A2A + intercom + subagent):**
```javascript
// Direct A2A call to capable node (replaces Tier 1)
try {
  const result = a2a_call({
    agent_url: "http://vision-node:10000",
    message: envelope,
    timeout: 120000
  })
  if (result) return result
} catch (e) {
  // A2A failed, degrade to intercom (Tier 2 still valid)
  const sessions = intercom({ action: "list" })
  if (sessions.length > 0) {
    const reply = intercom({ action: "ask", to: sessions[0].name, message: envelope })
    if (reply) return reply
  }
  // Final fallback: subagent (Tier 3)
  return subagent({ agent: "vision-proxy", task: instruction })
}
```

### 5.2 Parallel Dispatch: Old vs. New

**Old (manual coordination via coms-net):**
```javascript
// Send tasks to multiple fleet nodes
const msg_ids = tasks.map(task => {
  const peer = selectPeer(task.capability)
  return { msg_id: coms_net_send({ target: peer.name, prompt: task }), task }
})
// Await all results
const results = msg_ids.map(({ msg_id, task }) => {
  const result = coms_net_await({ msg_id, timeout_ms: 300000 })
  return { task, result }
})
```

**New (built-in parallel):**
```javascript
const results = a2a_parallel({
  tasks: tasks.map(task => ({
    agent_url: selectAgentUrl(task.capability),
    message: task.envelope
  })),
  timeout: 300000
})
```

### 5.3 Full D-E-V Pipeline: Old vs. New

**Old:**
```
Decomposer (subagent) → Fleet-Dispatcher (coms_net cascade) → Verifier (subagent)
```

**New:**
```
Decomposer (subagent) → A2A direct calls (a2a_call / a2a_parallel) → Verifier (subagent)
                         ↓ on failure
                         Intercom (local sessions)
                         ↓ on failure
                         Subagent (guaranteed fallback)
```

The three-tier degradation cascade is preserved, but Tier 1 transport changes from coms-net hub relay to direct A2A HTTP calls.

---

## 6. What Was Removed

| Component | Why Removed | Replacement |
|-----------|-------------|-------------|
| `coms_net_send` | Hub relay is unnecessary with direct A2A | `a2a_call` |
| `coms_net_await` | A2A calls are synchronous | `a2a_call` with `timeout` |
| `coms_net_get` | No async polling needed | N/A |
| `coms_net_list` | Hub-based discovery replaced by agent cards | `/.well-known/agent-card.json` |
| coms-net HTTP/SSE hub | Single point of failure, requires separate process | Each node runs its own A2A server |
| SSHFS mount | Shared file access needed for hub-based coord. | A2A handles data transfer; local files stay local |
| `fleet-dispatcher-cascade` skill | Transport-specific routing logic | This guide + A2A tools |

---

## 7. Checklist: Migrating a Workflow

- [ ] Replace all `coms_net_send` + `coms_net_await` pairs with `a2a_call`
- [ ] Replace parallel coms-net dispatch with `a2a_parallel`
- [ ] Replace `coms_net_list()` capability filtering with agent card lookups at `/.well-known/agent-card.json`
- [ ] Remove SSHFS mounts (no longer needed for A2A)
- [ ] Remove coms-net hub URL and token from project config
- [ ] Update fleet node URLs from hub relay format to direct A2A format (`http://node:10000`)
- [ ] Keep intercom calls unchanged (Tier 2 still valid)
- [ ] Keep subagent calls unchanged (Tier 3 still valid)
- [ ] Update D-E-V envelope: remove `tier_target` field
- [ ] Update timeout values: A2A `timeout` parameter replaces `coms_net_await` `timeout_ms`
- [ ] Keep `decomposer` and `verifier` agent definitions — they are transport-agnostic
- [ ] Keep cost estimation formulas — still accurate
- [ ] Keep verification escalation ladder — still best practice
- [ ] Keep media decomposition patterns (video → frames → analysis) — still required
- [ ] Update project [[AGENTS.md]] to reference A2A tools instead of coms-net

---

## 8. See Also

- [[pi-a2a-communication/Home]] — Wiki home, current status
- [A2A v1 Spec Compliance](../a2a-v1-spec-compliance.md) — Spec audit results
- [Agent Card Schema](../agent-card-schema.md) — A2A agent card reference
- [Learning & Resources](./learning-and-resources.md) — A2A protocol fundamentals
- `~/.pi/agent/git/github.com/carlosfrias/decompose-execute-verify/` — Archived D-E-V skill source
- `~/.pi/agent/git/github.com/carlosfrias/pi-cross-node-comms/` — Archived coms-net source

---

*Last updated: 2026-06-19*