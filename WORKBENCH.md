---
workbench: true
updated: 2026-06-19
project: pi-a2a-communication
---

# Workbench — pi-a2a-communication

> Lean desk. Promoted items go to PLAN/FOCUS. Emergent items stay here.

---

## ✅ Recently done

- 📅 2026-06-19: Vault-primary documentation drift audit — 16 findings, 9 corrections applied across FDP LIFECYCLE.md, root AGENTS.md, FPB scaffold, RESUME-GUIDE, sync README
- 📅 2026-06-19: Validated corrections with deepseek-v4-pro:cloud, audited by kimi-k2.7-code:cloud
- 📅 2026-06-19: 3 git commits pushed (FDP repo, root AGENTS, pi-a2a-communication)
- 📅 2026-06-19: All FDP files synced to workshop and vault copies
- 📅 2026-06-19: Conformance audit completed — 7 gaps (S1–S6b) identified, validated by deepseek-v4-pro and kimi-k2.7
- 📅 2026-06-19: Conformance test suite written — 19 tests (6 pass, 13 fail)
- 📅 2026-06-19: Fork reactivated for M6 spec compliance
- 📅 2026-06-19: IntelliJ project created at Infrastructure level
- 📅 2026-06-19: All documentation updated (FOCUS, PLAN, AGENTS, wiki, vault)
- 📅 2026-06-18: Project split — client stays here, server moves to pi-a2a-gateway
- 📅 2026-06-18: A2A v1.0 spec compliance fixes (10 gaps fixed, 84 tests passing)
- 📅 2026-06-18: FPB scaffold + vault mirror created
- 📅 2026-06-18: Forked from DrOlu/pi-a2a-communication v1.0.1

## 🔨 Current work

- [/] M6.1: Fix S2 — Add WWW-Authenticate header on 401 responses
- [/] M6.2: Fix S5 — Add try/catch for JSON.parse in /sendMessage

## 📋 Next up

- [ ] M6.3: Fix S3 — Add /.well-known/agent-card.json discovery path
- [ ] M6.4: Fix S6 — Add PascalCase method name mapping
- [ ] M6.5: Fix S1 — Return HTTP 200 for JSON-RPC error responses
- [ ] M6.6: Fix S6b — Use id: null instead of id: 0
- [ ] M6.7: Fix S4 — Add transport binding routes

## 💡 Observations

- kimi audit identified operational gaps: sync-shadows.sh only handles AGENTS.md (not FOCUS.md/PLAN.md), and agents currently write docs in workshop during sessions — need a docs-sync tool for true vault-first workflow
- deepseek validated that all 9 corrections are aligned with Rule 26
- WORKBENCH.md should remain workshop-authoritative (it's a scratchpad, not documentation per Rule 26)
- Code-level audit reports (e.g., A2A-v1-CONFORMANCE-AUDIT.md) should remain workshop-authoritative (they're tied to code/tests)

---

> 📋 **Checkbox states:** `[ ]` To Do | `[/]` In Progress | `[~]` Good Enough | `[x]` Done | `[>]` Deferred | `[!]` Blocked | `[-]` Cancelled

*Last updated: 2026-06-19*