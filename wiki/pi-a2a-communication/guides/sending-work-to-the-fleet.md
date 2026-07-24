---
name: Sending Work to the Fleet
category: guides
updated: 2026-06-20
version: 0.3.0
---

# Sending Work to the Fleet

How to distribute tasks across the 7-node A2A fleet (fnet1–fnet7) from your orchestrator.

## Prerequisites

- A2A extension installed and configured (`pi list | grep a2a`)
- Fleet nodes running v0.3.0+ on port 10000
- Auth token: `lab-fleet-2026`

## Fleet Node Reference

Actual hardware as of 2026-06-20. All nodes run Ollama with CPU-only inference.

| Node | CPU | RAM | Disk | GPU | Ollama Models |
|------|-----|-----|------|-----|---------------|
| fnet1 | i5-6400 (4c) | 16GB | 227GB | Intel HD 530 | minicpm-o2.6:8b, qwen3.5:4b |
| fnet2 | i7-8700 (12c) | 16GB | 226GB | GTX 660 (driver broken) | minicpm-o2.6:8b, qwen3.5:4b |
| fnet3 | i7-10710U (12c) | 32GB | 226GB | Intel UHD | minicpm-o2.6:8b, qwen3.5:4b |
| fnet4 | i7-10710U (12c) | 32GB | 226GB | Intel UHD | minicpm-o2.6:8b, qwen3.5:4b |
| fnet5 | i7-10710U (12c) | 32GB | 226GB | Intel UHD | minicpm-o2.6:8b, qwen3.5:4b |
| fnet6 | i7-10710U (12c) | 32GB | 227GB | Intel UHD | minicpm-o2.6:8b, qwen3.5:4b |
| fnet7 | i7-10710U (12c) | 16GB | 227GB | Intel UHD | minicpm-o2.6:8b, qwen3.5:4b |

**Notes:**
- fnet2 has a GTX 660 but the NVIDIA driver is broken — it runs CPU-only
- fnet1 has only 4 cores and 16GB — lightest node
- fnet7 has 16GB RAM (not 128GB) — was misconfigured in node-pool.json
- All nodes run the same two models: `openbmb/minicpm-o2.6:8b` (5.5GB) and `qwen3.5:4b` (3.4GB)
- Best nodes for heavier tasks: fnet3/fnet4/fnet5/fnet6 (32GB RAM, 12 cores)
- Best for lightweight tasks: fnet1/fnet2/fnet7 (16GB RAM)

---

## Keyword Triggers

When you tell pi to distribute work, it matches your intent to one of these operations. Each operation has a **slash command** (for interactive use) and a **tool** (for subagent delegation).

### Quick-Reference Matrix

| You say... | Operation | Slash Command | Tool |
|------------|-----------|---------------|------|
| "discover agents", "find agents", "scan fleet", "what's available" | **Discover** | `/a2a-discover` | — |
| "list agents", "show agents", "who's available", "fleet status" | **List** | `/a2a-agents` | — |
| "send this to fnet1", "ask fnet7 to analyze", "dispatch to that node" | **Send** | `/a2a-send` | `a2a_call` |
| "broadcast", "distribute", "fan out", "send to all", "parallel", "scatter" | **Broadcast** | `/a2a-broadcast` | `a2a_parallel` |
| "chain", "pipeline", "pipe through", "sequential", "then send to", "hand off" | **Chain** | `/a2a-chain` | `a2a_chain` |
| "check task", "task status", "is it done", "progress", "where's my task" | **Status** | `/a2a-status` | — |
| "cancel task", "stop task", "abort", "kill it" | **Cancel** | `/a2a-cancel` | — |
| "start server", "run as agent", "listen for tasks" | **Server** | `/a2a-server` | — |
| "configure A2A", "change token", "update settings" | **Config** | `/a2a-config` | — |
| "A2A help", "how do I", "fleet commands" | **Help** | `/a2a-help` | — |

### Trigger Patterns by Operation

#### 🔍 Discover — `/a2a-discover <url>`

**Triggers:** discover, find, scan, what agents, agent card, A2A discover, probe

```
/a2a-discover http://fnet1:10000
```

Scans a single URL and caches the agent card. Run once per node to populate the agent registry.

#### 📋 List — `/a2a-agents`

**Triggers:** list agents, show agents, who's available, known agents, fleet status, cached agents

```
/a2a-agents
```

Shows all previously discovered agents with names, URLs, and skills.

#### 📤 Send — `/a2a-send <url> <message>` / `a2a_call`

**Triggers:** send, ask, dispatch, tell, assign, run on, send to node, message agent, call agent, single task

**Slash command:**
```
/a2a-send http://fnet7:10000 Analyze this log file for errors
```

**Tool (subagent):**
```json
a2a_call({
  "agent_url": "http://fnet7:10000",
  "message": "Analyze this log file for errors",
  "streaming": true,
  "timeout": 60000
})
```

Use when you want **one agent** to do **one thing**.

#### 📡 Broadcast — `/a2a-broadcast <message> --agents <urls>` / `a2a_parallel`

**Triggers:** broadcast, distribute, fan out, scatter, parallel, send to multiple, send to all, run on multiple agents, fleet broadcast, parallel dispatch, distribute work

**Slash command:**
```
/a2a-broadcast Run diagnostics and report system status --agents http://fnet1:10000,http://fnet7:10000
```

**Tool (subagent):**
```json
a2a_parallel({
  "agent_urls": [
    "http://fnet1:10000",
    "http://fnet2:10000",
    "http://fnet7:10000"
  ],
  "message": "Run diagnostics and report system status"
})
```

All 7 nodes at once:
```
/a2a-broadcast Check system health --agents http://fnet1:10000,http://fnet2:10000,http://fnet3:10000,http://fnet4:10000,http://fnet5:10000,http://fnet6:10000,http://fnet7:10000
```

Use when you want the **same task** on **multiple agents simultaneously**.

#### 🔗 Chain — `/a2a-chain <agent1> <msg1> | <agent2> <msg2>` / `a2a_chain`

**Triggers:** chain, pipeline, sequential, pipe, relay, handoff, multi-step, then send to, step-by-step, agent-to-agent, cascade

**Slash command:**
```
/a2a-chain http://fnet7:10000 "Extract key metrics from this dataset" | http://fnet1:10000 "Summarize: {previous}"
```

**Tool (subagent):**
```json
a2a_chain({
  "steps": [
    {"agent_url": "http://fnet7:10000", "message": "Analyze the data and extract insights"},
    {"agent_url": "http://fnet1:10000", "message": "Summarize these findings: {previous}"}
  ],
  "continueOnError": false,
  "timeout": 60000
})
```

Use when step N's **input depends on** step N-1's **output**. Use `{previous}` to pipe results between steps.

#### 📊 Status — `/a2a-status <taskId>`

**Triggers:** check task, task status, progress, is it done, where is my task, A2A status, check result

```
/a2a-status 1781929043052-4wk1sc17h
```

#### 🛑 Cancel — `/a2a-cancel <taskId>`

**Triggers:** cancel, stop, abort, kill, terminate, cancel remote job

```
/a2a-cancel 1781929043052-4wk1sc17h
```

#### 🖥️ Server — `/a2a-server start|stop [port]`

**Triggers:** start server, stop server, A2A server, agent mode, serve, listen

```
/a2a-server start 10000
/a2a-server stop
```

#### ⚙️ Config — `/a2a-config`

**Triggers:** configure A2A, change settings, set token, update config, bridge config

#### ❓ Help — `/a2a-help`

**Triggers:** A2A help, how to use A2A, fleet commands, what commands available

---

## Natural Language → Operation Mapping

These are the patterns pi uses to route your request to the correct A2A operation:

| Intent | Example Prompt | Routed To |
|--------|---------------|-----------|
| **Send one task** | "Ask fnet7 to check disk space" | `a2a_call` or `/a2a-send` |
| **Send one task** | "Send this analysis request to http://fnet3:10000" | `a2a_call` or `/a2a-send` |
| **Distribute work** | "Distribute this across the fleet" | `a2a_parallel` or `/a2a-broadcast` |
| **Distribute work** | "Run health checks on all nodes" | `a2a_parallel` or `/a2a-broadcast` |
| **Distribute work** | "Fan out this query to fnet1, fnet2, fnet7" | `a2a_parallel` or `/a2a-broadcast` |
| **Pipeline** | "Have fnet7 analyze the data, then fnet1 summarize it" | `a2a_chain` or `/a2a-chain` |
| **Pipeline** | "Process on fnet7, then hand off to fnet1 for review" | `a2a_chain` or `/a2a-chain` |
| **Discover** | "What agents are on the fleet?" | `/a2a-discover` + `/a2a-agents` |
| **Check task** | "Is my task done yet?" | `/a2a-status <id>` |
| **Cancel** | "Cancel that task" | `/a2a-cancel <id>` |

---

## Example Prompts

### Distribute Analysis Across the Fleet

> Use a2a_parallel to broadcast "Analyze CPU usage and report findings" to fnet1, fnet2, and fnet7. Then use a2a_chain to have fnet7 summarize all results.

### System Health Check

> Use a2a_parallel to send "Check system health: disk, memory, CPU" to all 7 fleet nodes (fnet1 through fnet7 on port 10000). Consolidate the results into a summary table.

### Heavy Compute → Summarize Pipeline

> Use a2a_chain: first send "Process this dataset and extract anomalies" to http://fnet7:10000, then send "Summarize these anomalies: {previous}" to http://fnet1:10000.

### Single Node Query

> Use a2a_call to ask http://fnet1:10000 "What is your hostname and available models?"

### All-Hands Broadcast

> Broadcast "Report your system status" to the entire fleet using /a2a-broadcast with all 7 agent URLs.

---

## Raw HTTP (for Scripts)

### Send a Task

```bash
curl -s -X POST "http://fnet1:10000/" \
  -H "Authorization: Bearer lab-fleet-2026" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "id": "1",
    "params": {
      "message": {
        "messageId": "msg-1",
        "role": "user",
        "parts": [{"type": "text", "text": "What is your hostname?"}]
      }
    }
  }'
```

### Stream with SSE

```bash
curl -s -X POST "http://fnet1:10000/" \
  -H "Authorization: Bearer lab-fleet-2026" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/stream",
    "id": "2",
    "params": {
      "message": {
        "messageId": "msg-2",
        "role": "user",
        "parts": [{"type": "text", "text": "Report system status"}]
      }
    }
  }'
```

### Get Task Status

```bash
curl -s -X POST "http://fnet1:10000/" \
  -H "Authorization: Bearer lab-fleet-2026" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tasks/get",
    "id": "3",
    "params": {"id": "<taskId>"}
  }'
```

### Discover Agent Card

```bash
curl -s -H "Authorization: Bearer lab-fleet-2026" \
  "http://fnet1:10000/.well-known/agent-card.json" | python3 -m json.tool
```

---

## Task Execution Architecture

```
⭐ Orchestrator (Mac)
   pi + A2A client
   bridge: subprocess (pi --print)
       |
       | A2A JSON-RPC / SSE
       |
    fnet1  fnet2  fnet3  fnet4  fnet5  fnet6  fnet7
    4c     12c    12c    12c    12c    12c    12c
    16GB   16GB   32GB   32GB   32GB   32GB   16GB
    CPU    CPU+GPU CPU    CPU    CPU    CPU    CPU
           GTX660*
    ⬇⬇⬇⬇⬇⬇⬇ All run: minicpm-o2.6:8b + qwen3.5:4b
    ⬇⬇⬇⬇⬇⬇⬇ bridge: noop → PiSessionHandler → NoOp fallback
```

*GTX 660 present but driver broken; fnet2 runs CPU-only.*

**How task execution works on fleet nodes:**

1. A2A request arrives at `fnet{n}:10000`
2. `processTask()` checks registered `taskHandlers` first
3. `PiSessionTaskHandler` tries `ctx.newSession()` (not yet available in pi v0.79.4)
4. Falls back to configured `PiTaskBridge` (`noop` on fleet, `subprocess` on orchestrator)
5. Returns result as A2A artifact

**When pi adds `newSession()` support**, fleet nodes will automatically use the running pi session for real AI responses — no code changes needed.

---

## Deployment

See [ansible/deploy-a2a.yml](../../../ansible/deploy-a2a.yml) for fleet standup playbook.

```bash
# Deploy to all fleet nodes
cd workshop/02-Areas/Infrastructure/pi-a2a-communication
ansible-playbook -i ansible/inventory.ini ansible/deploy-a2a.yml

# Config-only update
ansible-playbook -i ansible/inventory.ini ansible/deploy-a2a.yml --tags config

# Restart only
ansible-playbook -i ansible/inventory.ini ansible/deploy-a2a.yml --tags restart
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `401 Unauthorized` | Add `-H "Authorization: Bearer lab-fleet-2026"` |
| Agent not responding | `ssh fnetN "sudo systemctl restart pi-agent@fnetN"` |
| Placeholder responses | Expected — NoOp bridge active until pi adds `newSession()` |
| Tool name conflict | `pi remove npm:pi-a2a-communication` |
| Build fails on node | `ssh fnetN` then `nvm use && cd ~/.pi/.../pi-a2a-communication && npm run build` |
| `ctx.newSession is not a function` | Expected on pi v0.79.4 — handler falls back to NoOp bridge automatically |

---

*Last updated: 2026-06-20 · pi-a2a-communication v0.3.0*