---
tags:
  - infrastructure
  - pi-a2a-communication
  - a2a
  - agent-protocol
  - PARA
  - area
version: 0.4.0
status: active
last_updated: 2026-06-19
---

# pi-a2a-communication — Project AGENTS

**Purpose:** Pi extension providing A2A v1.0 protocol client tools. Slash commands (`/a2a-discover`, `/a2a-send`, etc.) and tools (`a2a_call`, `a2a_parallel`) for pi agents. Forked from DrOlu/pi-a2a-communication with A2A v1.0 spec compliance fixes.

## [S-TIGHT]

Project AGENTS for `workshop/02-Areas/Infrastructure/pi-a2a-communication/`. Fork reactivated for M6 spec compliance. All A2A protocol code MUST comply with v1.0 specification. TDD mandatory — conformance suite is source of truth.

---

## Project Status

| | |
|---|---|
| **Status** | ✅ Active — M6 Complete |
| **Version** | 0.2.0-alpha.3 |
| **Upstream** | `carlosfrias/pi-a2a-communication` (GitHub, main branch) |
| **Origin** | Forked from `DrOlu/pi-a2a-communication` v1.0.1 |
| **Parent project** | A2A migration complete — coms-net removed |
| **Sibling project** | [pi-a2a-gateway](../../../04-Archive/Infrastructure/pi-a2a-gateway/AGENTS.md) — archived |

## Key Files

| Path | Purpose |
|------|---------|
| `index.ts` | Main extension entry point (registers commands + tools) |
| `a2a-client.ts` | A2A client: sendMessage, sendStreamingMessage, getTask, cancelTask, discoverAgent |
| `a2a-server.ts` | A2A server: exposes pi as A2A agent (JSON-RPC, SSE, task lifecycle) |
| `pi-task-bridge.ts` | PiTaskBridge interface + NoOpPiTaskBridge + SubprocessPiTaskBridge |
| `agent-discovery.ts` | Agent discovery via Agent Cards + caching |
| `task-manager.ts` | Task orchestration: single, parallel, chain, async |
| `config.ts` | ConfigManager (disk persistence, agent registry) |
| `types.ts` | A2A v1.0 protocol type definitions + constants |
| `config/gateway-config.json` | A2A gateway configuration (will move to pi-a2a-gateway) |
| `scripts/generate-agent-cards.ts` | Fleet agent card generator |
| `tests/a2a-v1-conformance.test.ts` | A2A v1.0 spec conformance tests (19 tests, S1–S6b) |
| `tests/spec-compliance/` | A2A v1.0 spec compliance tests (unit-level) |
| `tests/characterization/` | Characterization test suites (4 files) |
| `pi-package.json` | Pi package manifest (commands, tools, metadata) |

## Anti-Drift Rules (CA-1 through CA-6)

**RULE CA-1: Spec compliance is non-negotiable.**
All A2A protocol implementations MUST comply with the v1.0 specification. Method names, task states, agent-card paths, and JSON-RPC formats must match the spec exactly. The characterization and spec-compliance tests are the source of truth.

**RULE CA-2: This package includes both client and server.**
`pi-a2a-communication` provides A2A client tools AND the A2A server (`a2a-server.ts`). The server is actively maintained for spec compliance (M6). Production deployment runs via the pi extension system.

**RULE CA-7: All S1–S6b fixes must make the corresponding conformance test pass.**
No spec gap is "fixed" until `npx vitest run a2a-v1-conformance` shows its test passing. The conformance suite (`tests/a2a-v1-conformance.test.ts`) is the source of truth for A2A v1.0 compliance.

**RULE CA-3: The server `executePiTask()` is delegated to PiTaskBridge.**
The A2A server delegates task execution to a `PiTaskBridge` implementation. The default `NoOpPiTaskBridge` returns a placeholder response. Production use should configure `SubprocessPiTaskBridge` (invokes pi CLI) or a custom bridge via `registerTaskHandler()`. The bridge is injectable via the `A2AServer` constructor.

**RULE CA-4: Never modify `types.ts` without running spec-compliance tests.**
The type definitions are the contract with the A2A v1.0 spec. Any change must pass `tests/spec-compliance/a2a-v1-protocol.test.ts` before merge.

**RULE CA-5: All new features start with a test.**
TDD is mandatory. Write a failing test first (characterization for existing behavior, spec-compliance for protocol behavior, unit for edge cases), then implement.

**RULE CA-6: The `a2a-server.ts` is now the primary target for M6 fixes.**
The server code is being actively maintained for A2A v1.0 spec compliance. All changes to `a2a-server.ts` must pass the conformance suite.

## Refined Agents

Battle-tested rules extracted from incident sessions. Each version supersedes the prior.

| Version | Date | Session | Key Rules |
|---------|------|---------|-----------|
| v1 | 2026-06-19 | 2026-06-19-1300 | Verify spec paths against actual spec (not assumptions); Use two independent models for audit validation; Conformance tests must test spec path not implementation path; Cite spec section for severity; Only native pi flags in systemd |

## Routing

| What are you trying to do? | Load this |
|----------------------------|-----------|
| Implement A2A client features | `a2a-client.ts` |
| Fix a spec gap (S1–S6b) | `a2a-server.ts` → then run `npx vitest run a2a-v1-conformance` |
| Add slash commands or tools | `index.ts` |
| Add protocol type definitions | `types.ts` → then run spec-compliance tests |
| Configure A2A client | `config.ts` |
| Understand A2A v1.0 spec | `tests/a2a-v1-conformance.test.ts` — conformance suite (source of truth) |
| Read architecture docs | `wiki/Home.md` — start here |
| Read conformance report | `wiki/reference/A2A-v1-Conformance-Report.md` — full audit with Mermaid diagrams |
| Read audit findings | `wiki/reference/A2A-v1-Conformance-Audit.md` — detailed code-level findings |

## Discovery Path

```
1. carlos-desktop/AGENTS.md                           ← Root router (pick workspace)
2. workshop/AGENTS.md                                 ← Workspace router
3. workshop/02-Areas/Infrastructure/AGENTS.md          ← Domain router
4. pi-a2a-communication/AGENTS.md                     ← YOU ARE HERE (project router)
5. pi-a2a-communication/FOCUS.md                      ← Current state + handoff
6. pi-a2a-communication/PLAN.md                       ← Release plan + task tracking
7. pi-a2a-communication/WORKBENCH.md                  ← Working notes + triage
8. pi-a2a-communication/.frias/refined-agents/        ← Battle-tested rules
9. pi-a2a-communication/.frias/journal/              ← Session journals
10. pi-a2a-communication/wiki/                     ← Architecture, protocol, guides
11. pi-a2a-communication/tests/                       ← TDD test suites
12. pi-a2a-communication/config/                     ← Gateway configuration (archived sibling project)
```

---

## FDP Compliance

This project follows the [Frias Documentation Protocol (FDP)](https://github.com/carlosfrias/frias-documentation-protocol) for documentation standards.

### Two Locations (FDP)

| Location | Path | Purpose |
|----------|------|--------|
| **Workspace Root** | `./src/`, `./tests/`, `./package.json` | Code, config, build artifacts |
| **Documentation Home** | `./wiki/`, `./.frias/` | All documentation, session state |

### Required Directories

| Directory | Purpose | Status |
|-----------|----------|--------|
| `.frias/threads/` | Thread structure for prompt tracking | ✅ |
| `.frias/journal/` | Session journal entries | ✅ |
| `.frias/refined-agents/` | Versioned battle-tested rules | ✅ |
| `.frias/status/` | Status snapshots | ✅ |
| `.frias/costs/` | AI model cost tracking | ✅ |
| `wiki/` | Architecture, protocol, guides | ✅ |

### Required Files

| File | Purpose | Status |
|------|---------|--------|
| [FOCUS.md](./FOCUS.md) | Current state, active work, handoff notes | ✅ |
| [PLAN.md](./PLAN.md) | Release plan with task checkboxes | ✅ |
| [WORKBENCH.md](./WORKBENCH.md) | Working notes and triage | ✅ |
| [AGENTS.md](./AGENTS.md) | Project routing and anti-drift rules | ✅ |

### FPB Compliance

Scaffolded using [Frias Project Blueprint (FPB)](https://github.com/carlosfrias/frias-project-blueprint) conventions:
- Root `AGENTS.md` with S-TIGHT directive and routing table
- Project-level anti-drift rules (CA-1 through CA-6)
- Discovery path from root router → workspace → domain → project
- `.frias/` process artifact structure
- Domain-divided wiki with Activity Logs

### Session Close Ritual

Per [FDP LIFECYCLE.md](https://github.com/carlosfrias/frias-documentation-protocol/blob/main/skills/frias-documentation-protocol/LIFECYCLE.md):

1. WORKBENCH triage — completed items moved to ✅ Recently Done
2. Per-prompt capture — `.frias/threads/`
3. Thread update — `.frias/threads/THREAD-v1.md`
4. FOCUS.md update — frontmatter, active work, handoff
5. Journal entry — `.frias/journal/`
6. PLAN.md update — progress, checkboxes, next steps
7. AI cost tracking — `.frias/costs/AI-MODEL-COSTS.md`
8. Refined agent — `.frias/refined-agents/` (when battle-tested rules emerge)
9. Vault sync — all 3 locations (workshop, vault, git)

## Universal Rules

**Managed by:** `universal-rules` skill (installed separately)
**Enforced by:** `never-do-guardrails` extension (bundled with skill)

| Category | Rules | Load When |
|----------|-------|-----------|
| Always Do | 1-6, 11-12, 15-27 | General work |
| Ask First | 10 | Skill loading without task |
| Never Do | 7-9 (BLOCK), 13-14 (behavioral) | Tool calls (auto-enforced) |

**Full rules:** `~/.pi/agent/git/github.com/carlosfrias/universal-rules/skills/universal-rules/CORE.md`

### Compliance Audit (2026-06-19)

| Rule | Status | Notes |
|------|--------|-------|
| RULE 1 | ✅ | Project in `workshop/02-Areas/Infrastructure/` |
| RULE 2 | ✅ | TDD enforced by CA-5 |
| RULE 3 | ✅ | Project AGENTS.md exists |
| RULE 7 | ✅ | No `pi-coding-agent` npm dependency |
| RULE 8 | ✅ | No `.pi/settings.json` |
| RULE 19 | ✅ | Properly classified in `02-Areas` |
| RULE 21 | ✅ | Hyphenated name |
| RULE 22 | ✅ FIXED | Removed 3 duplicate `Activity Log.md` (space) files, kept kebab-case |
| RULE 25 | ✅ FIXED | Wiki flattened from `wiki/pi-a2a-communication/` to `wiki/` per Rule 27 (project folder IS the namespace) |
| RULE 26 | ✅ FIXED | Aligned workshop wiki with vault structure; removed `_meta/` redirects; created `reference/` |
| RULE 27 | ✅ FIXED | Slimmed README.md to ≤30 line pointer; removed empty root dirs; added vitest artifacts to `.gitignore` |
| Version sync | ✅ FIXED | `pi-package.json` version updated from `0.1.0-alpha.1` → `0.2.0-alpha.3` |
| FDP Two Locations | ✅ FIXED | Added explicit Workspace Root + Documentation Home declaration |
| FDP Refined Agents | ✅ FIXED | Updated table with v1 refined agents |
| FPB Status | ✅ FIXED | Updated `.frias/status/project.md` to reflect M6 complete |

---

*Last updated: 2026-06-19*