---
name: pi-a2a-communication
phase: "M4: Client Polish — v0.2.0-alpha.2"
progress: 40
status: active
last_updated: 2026-06-18
---

# PLAN — pi-a2a-communication

## Current Release: v0.1.0-alpha.1 | Next: v0.2.0-alpha.2 (Client Polish)

### Release History

| Version | Date | Description |
|---------|------|-------------|
| v0.1.0-alpha.1 | 2026-06-18 | Fork from DrOlu v1.0.1, A2A v1.0 spec fixes, TDD scaffold, project split |

### Upcoming Releases

| Version | Phase | Description | Status |
|---------|-------|-------------|--------|
| v0.2.0-alpha.2 | M4 | Client tool polish, streaming improvements | ⬜ Planned |
| v0.3.0-alpha.3 | M4 | Package publish to npm | ⬜ Planned |
| v1.0.0 | M5 | Stable client release (after gateway is battle-tested) | ⬜ Deferred |

---

## v0.2.0-alpha.2 — Client Tool Polish

- [ ] 2.1 Improve `/a2a-send` command output formatting
- [ ] 2.2 Improve `/a2a-discover` command with better Agent Card display
- [ ] 2.3 Add error handling and retry for client operations
- [ ] 2.4 Improve streaming client experience

## v0.3.0-alpha.3 — Package Publish

- [ ] 3.1 Clean up package.json for npm publish
- [ ] 3.2 Update README with installation and usage instructions
- [ ] 3.3 Add CONTRIBUTING.md and LICENSE
- [ ] 3.4 Publish to npm as `pi-a2a-communication`

---

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Fork then enhance | Fork DrOlu v1.0.1 | Base has protocol code but no tests |
| Spec compliance first | Fix before features | Protocol compliance is foundational |
| Client/server split | Client = this package, Server = pi-a2a-gateway | Different deployment models, different lifecycles |
| Keep a2a-server.ts locally | Dev/test server in client package | Useful for testing; production server is pi-a2a-gateway |
| TDD mandatory | Characterization → spec → unit | Prevents regression on protocol compliance |

---

> 📋 **Checkbox states:** `[ ]` To Do | `[/]` In Progress | `[~]` Good Enough | `[x]` Done | `[>]` Deferred | `[!]` Blocked | `[-]` Cancelled

*Last updated: 2026-06-18*