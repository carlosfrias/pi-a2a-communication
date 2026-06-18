---
workbench: true
updated: 2026-06-18
project: pi-a2a-communication
---

# Workbench — pi-a2a-communication

> This is your desk. Messy is fine. When something solidifies, move it to the right filing cabinet: decisions → PLAN.md, tasks → PLAN.md, questions → the thread.

---

## 🔨 Current work

- FPB project scaffold renamed from pi-a2a-gateway to pi-a2a-communication
- Clarifying client vs server scope (client extension only — server goes to pi-a2a-gateway)

---

## 💭 Working notes

<!-- ⚠️ NOT ready for processing. Agent must ASK before capturing these into PLAN/FOCUS. -->

- `a2a-server.ts` lives in this package but is for local testing only — production server is pi-a2a-gateway
- Enterprise types (`LoadBalanceStrategy`, `AgentPool`, `workflows`) exist but have zero runtime code — decide whether they belong here or in gateway
- `executePiTask()` stub is a server concern, not client — should move to pi-a2a-gateway in Phase 1
- CORS `*` is fine for local testing, but this package shouldn't be running a production server anyway

---

## 📋 To sort

- Whether to remove `a2a-server.ts` from the client package or keep as dev dependency
- Where enterprise types (LoadBalanceStrategy, AgentPool) should live long-term
- Whether `config/gateway-config.json` should move to pi-a2a-gateway

---

## ✅ Recently done

- 📅 2026-06-18: FPB project scaffold renamed from pi-a2a-gateway → pi-a2a-communication
- 📅 2026-06-18: A2A v1.0 spec compliance fixes applied (10 gaps fixed)
- 📅 2026-06-18: Characterization tests written (4 suites)
- 📅 2026-06-18: Agent cards generated for fleet nodes (8 cards)
- 📅 2026-06-18: pi-package.json updated to pi-a2a-communication v0.1.0-alpha.1
- 📅 2026-06-18: Forked from DrOlu/pi-a2a-communication v1.0.1

---

## Processing Convention

When an agent joins this project and reads the WORKBENCH:

1. **Read** all sections above (Current work, Working notes, To sort, Recently done)
2. **Process Current work items:**
   - Solid items → capture into `PLAN.md` as tasks, update `FOCUS.md` active work
   - Decisions already made → capture into decision log or `FOCUS.md` decisions table
3. **Process 💭 Working notes with CARE:**
   - ⚠️ **Working notes are not well-formed.** Before processing, ASK the user:
     - "I see these working notes: [list]. Should I capture any of these into PLAN/FOCUS, or are they still half-formed?"
   - Only process what the user confirms
4. **Process 📋 To sort items:**
   - Determine if each item belongs in PLAN, FOCUS, a domain, or should stay in To sort
   - Move items that have a clear home to their destination
   - Leave ambiguous items in To sort
5. **Move processed items to ✅ Recently done**
   - Add a date stamp: `📅 YYYY-MM-DD`
   - Brief description of what was done and where it landed
6. **Update this WORKBENCH** after processing — remove captured items from their original sections

**Key rule:** Working notes (💭) require user confirmation before processing. Current work items (🔨) can be captured directly.

---

> 📋 **Checkbox states:** `[ ]` To Do | `[/]` In Progress | `[~]` Good Enough | `[x]` Done | `[>]` Deferred | `[!]` Blocked | `[-]` Cancelled