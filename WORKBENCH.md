---
workbench: true
updated: 2026-06-19
project: pi-a2a-communication
---

# Workbench — pi-a2a-communication

> Lean desk. Promoted items go to PLAN/FOCUS. Emergent items stay here.

---

## ✅ Recently done

- 📅 2026-06-19: **P0 complete** — S2 (WWW-Authenticate), S3 (agent-card.json path), S5 (parse error try/catch). Conformance suite: 11/19 passing.
- 📅 2026-06-19: Wiki cleaned per Rule 27 — all docs moved to `wiki/`, root only has AGENTS/FOCUS/PLAN/WORKBENCH/README
- 📅 2026-06-19: Vault-primary drift audit moved to vault-accessibility project
- 📅 2026-06-19: Conformance report validated — all audit findings ingested
- 📅 2026-06-19: Conformance audit completed — 7 gaps (S1–S6b) identified, validated by deepseek-v4-pro and kimi-k2.7
- 📅 2026-06-19: Conformance test suite written — 19 tests (6 pass, 13 fail)
- 📅 2026-06-19: Fork reactivated for M6 spec compliance
- 📅 2026-06-18: Project split — client stays here, server moves to pi-a2a-gateway
- 📅 2026-06-18: Forked from DrOlu/pi-a2a-communication v1.0.1

## 🔨 Current work

- [ ] M6.4: Fix S6 (P1) — Add PascalCase method name mapping
- [ ] M6.5: Fix S1 (P1) — Return HTTP 200 for JSON-RPC error responses
- [ ] M6.6: Fix S6b (P1) — Use `id: null` instead of `id: 0`

## 📋 Next up

- [ ] M6.7: Fix S4 (P2) — Add transport binding routes (`/rpc`, `/message:send`, `/message:stream`)

## 💡 Observations

- S5 fix catches parse error but returns HTTP 400 — HTTP 200 is S1 (separate gap)
- WORKBENCH.md should remain workshop-authoritative per Rule 26 (it's a scratchpad)
- Code-level audit reports belong in wiki/ per Rule 27, not root

---

> 📋 **Checkbox states:** `[ ]` To Do | `[/]` In Progress | `[~]` Good Enough | `[x]` Done | `[>]` Deferred | `[!]` Blocked | `[-]` Cancelled

*Last updated: 2026-06-19*