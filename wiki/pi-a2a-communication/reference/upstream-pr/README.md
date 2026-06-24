---
name: Upstream PR Index
updated: 2026-06-24
status: draft
---

# Upstream PR Index — DrOlu/pi-a2a-communication

**Prepared for review only. Do NOT submit without explicit authorization.**

Target: `DrOlu/pi-a2a-communication` (main branch, last active 2026-03-15)

## Issues → Folders

| Issue | ID | Severity | Folder | PR Group |
|-------|-----|----------|--------|----------|
| #3 | S3 | HIGH | [S3-agent-card-discovery/](./S3-agent-card-discovery/) | PR 1 |
| #4 | S2 | HIGH | [S2-www-authenticate/](./S2-www-authenticate/) | PR 1 |
| #5 | S1 | MEDIUM | [S1-json-rpc-error-status/](./S1-json-rpc-error-status/) | PR 2 |
| #6 | S5 | HIGH | [S5-parse-error-crash/](./S5-parse-error-crash/) | PR 1 |
| #7 | S6 | HIGH | [S6-pascalcase-method-names/](./S6-pascalcase-method-names/) | PR 2 |
| #7 | S6b | LOW | [S6b-null-id-in-errors/](./S6b-null-id-in-errors/) | PR 2 |
| #8 | S4 | HIGH | [S4-transport-binding-routes/](./S4-transport-binding-routes/) | PR 2 |

## Two-PR Strategy

| | PR 1: Auth, Discovery, Crash | PR 2: Protocol Compliance |
|---|------|------|
| **Title** | `fix: A2A v1.0 auth, agent discovery, and crash handling` | `fix: A2A v1.0 protocol compliance — JSON-RPC errors, method names, transport routes` |
| **Fixes** | S2, S3, S5 | S1, S4, S6, S6b |
| **Commits** | `fd3a23d` + `15afaf9` | `cab19ea` + `d83f21e` |
| **Source lines** | +123/-24 across 4 files | +30/-5 in a2a-server.ts only |
| **Overlap with PR #1** | Complementary (adds WWW-Authenticate they lack, corrects agent-card path) | None |

## Upstream Context

| PR | Author | Scope | Overlap with ours |
|----|--------|-------|-------------------|
| #1 | 5queezer | Session execution, auth restructuring, streaming fix | S2 partial (no WWW-Authenticate), S3 partial (wrong path still), no overlap on S1/S4/S5/S6/S6b |
| #2 | cavos-io | Custom config directory (`PI_A2A_CONFIG_DIR`) | None — purely additive feature |

6 unauthorized issues (#3–#8) were filed and subsequently closed.

## PR Template

See [PR-template-from-upstream.md](./PR-template-from-upstream.md) for the template pattern extracted from 5queezer's PR #1.

---

*Last updated: 2026-06-24*