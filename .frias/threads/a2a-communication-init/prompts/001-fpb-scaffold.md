# FPB Scaffold — pi-a2a-communication

| About | Details |
|-------|---------|
| **Prompt ID** | 001 |
| **Purpose** | Create FPB-compliant project structure for both workshop and vault sides of pi-a2a-communication (renamed from pi-a2a-gateway) |
| **Status** | ✅ Complete |
| **Thread** | a2a-communication-init |

## Context

pi-a2a-communication was forked from DrOlu/pi-a2a-communication v1.0.1. Originally named pi-a2a-gateway, it was renamed to pi-a2a-communication to clarify that it is the CLIENT extension (slash commands + tools), while the standalone server/gateway became a separate project: pi-a2a-gateway. The workshop side had source code, tests, and config but needed FPB project structure updates for the renamed identity. The vault side didn't exist.

## What was done

1. Renamed workshop directory from pi-a2a-gateway → pi-a2a-communication
2. Updated package.json and pi-package.json to reflect pi-a2a-communication identity
3. Created/updated workshop FPB files:
   - `AGENTS.md` — project routing, anti-drift rules (CA-1 through CA-6), discovery path, FDP compliance
   - `FOCUS.md` — current state, milestone progress, key gaps, design decisions, handoff notes
   - `PLAN.md` — release plan v0.1.0-alpha.1 through v0.3.0-alpha.3, client-focused tasks
   - `WORKBENCH.md` — active work, working notes, recently done
   - `wiki/pi-a2a-communication/` with Home.md and domain structure (link stubs)
   - `.frias/threads/0-THREAD.md` updated for new project name

4. Created vault FPB files:
   - `FOCUS.md`, `PLAN.md`, `WORKBENCH.md` — vault copies synced from workshop
   - `wiki/` with Home.md, architecture/, guides/, reference/ (full content)
   - `.frias/` directory structure with threads and costs

5. Created pi-a2a-gateway as a NEW project:
   - Workshop: AGENTS.md, FOCUS.md, PLAN.md, WORKBENCH.md, wiki, .frias, config/
   - Vault: FOCUS.md, PLAN.md, WORKBENCH.md, wiki with architecture/guides/reference, .frias

## Decisions

- pi-a2a-communication = CLIENT EXTENSION (pi package with slash commands and tools)
- pi-a2a-gateway = STANDALONE SERVER (replaces coms-net hub)
- Workshop is authoritative for AGENTS.md, FOCUS.md, PLAN.md, WORKBENCH.md
- Vault is authoritative for wiki content (workshop wiki links to vault)
- Anti-drift rules CA-1 through CA-6 for client, GA-1 through GA-6 for gateway