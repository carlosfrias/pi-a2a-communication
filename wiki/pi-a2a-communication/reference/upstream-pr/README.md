---
name: Upstream PR Index
updated: 2026-06-24
status: draft
---

# Upstream PR Index — DrOlu/pi-a2a-communication

**Prepared for review only. Do NOT submit without explicit authorization.**

Target: `DrOlu/pi-a2a-communication` (main branch, last active 2026-03-15)

## Two-PR Strategy

| | PR 1 | PR 2 |
|---|------|------|
| **Title** | `fix: A2A v1.0 auth, agent discovery, and crash handling` | `fix: A2A v1.0 protocol compliance — JSON-RPC errors, method names, transport routes` |
| **Scope** | S2, S3, S5 — security & robustness | S1, S4, S6, S6b — protocol compliance |
| **Commits** | `fd3a23d` + `15afaf9` (2 commits) | `cab19ea` + `d83f21e` (2 commits) |
| **Source lines** | +123/-24 across 4 files | +30/-5 in a2a-server.ts only |
| **Overlap with existing PR #1** | Complementary (adds WWW-Authenticate they lack, corrects agent-card path) | None — zero overlap with any existing PR |

## Subfolders

- [pr-1-auth-discovery-crash/](./pr-1-auth-discovery-crash/) — S2, S3, S5: Auth header, agent card discovery, crash handling
- [pr-2-protocol-compliance/](./pr-2-protocol-compliance/) — S1, S4, S6, S6b: JSON-RPC errors, method names, transport routes

## Upstream Context

| PR | Author | Scope | Overlap with ours |
|----|--------|-------|-------------------|
| #1 | 5queezer | Session execution, auth restructuring, streaming fix | S2 partial (no WWW-Authenticate), S3 partial (wrong path still), no overlap on S1/S4/S5/S6/S6b |
| #2 | cavos-io | Custom config directory (`PI_A2A_CONFIG_DIR`) | None — purely additive feature |

6 unauthorized issues (#3–#8) were filed and subsequently closed.

---

*Last updated: 2026-06-24*