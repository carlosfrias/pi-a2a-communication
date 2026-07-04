---
version: 3
created: 2026-07-01
session: .frias/journal/2026-07-01-1645.md
thread: .frias/threads/workshop-submodule-structure-cleanup/0-THREAD.md
supersedes: .frias/refined-agents/AGENTS-REFINED-v2.md
---

# AGENTS-REFINED v3 — pi-a2a-communication

Battle-tested rules from the 2026-07-01 workshop-submodule-structure-cleanup phase (the orphan-gitlink cleanup + open-notebook consolidation, after the A2A-to-fnet close). Extends v1.

## Rules (project + universal candidates)

### R5 — Don't invent narratives to explain messy state; describe what's actually there
When faced with duplicated/split files, DO NOT pattern-match a clean "architecture" onto it (e.g., calling it an "overlay" or a "wrapper/codebase split") and then act on that story. First enumerate the actual files + their git status, identify which is the real repo vs a loose fragment, and act on the facts. In this session I invented an "overlay architecture" for open-notebook (there was none — just a duplicate fragment), committed deployment files into the codebase submodule, and created a private fork — producing garbage Carlos had to stop. **Describe reality; don't narrate it.**

### R6 — Audit each item's intent BEFORE mutating; don't apply a uniform fix mechanically
The orphan-gitlink cleanup had 6 orphans that were each a different thing (active codebase, vendored third-party tool, archived skill, deployment fragment). I treated them uniformly ("make them all proper submodules") and committed/created repos before understanding each one — which baked the open-notebook deployment wrapper into the codebase submodule. **For each item in a structural cleanup: determine (a) is it code or docs-only, (b) is it a real repo or loose files, (c) does it have a GitHub remote, (d) does it have local overlays — THEN decide proper-submodule / untrack / fork.** Use dual-model audit (RULE 23) for the plan before executing.

### R7 — Submodule gitlinks: proper submodule or untracked, never cosmetic per-commit bumps
A workshop superproject tracks standalone repos as submodule gitlinks (mode 160000). If a gitlink has NO `.gitmodules` entry (orphan), `git submodule update` can't consume it → the recorded SHA has no functional consumer → bumping it is cosmetic busywork. **Fix orphan gitlinks once structurally** (add `.gitmodules` to make a proper submodule, OR `git rm --cached` to untrack) — do NOT make a habit of per-commit cosmetic bumps. After fixing, `git submodule status` must not abort. (This project's 6 orphans were made proper submodules; 3 stale `.gitmodules` entries removed.)

### R8 — Re-establish lockstep when a concurrent session is active on the same superproject
Two pi sessions editing the same workshop/vault superproject can collide: a concurrent session's `git add -A` + commit can sweep in YOUR staged changes (mixed-concern commit). This happened — `subagent-chat-019f1eed` swept my staged open-notebook `git mv` into its commit `084e0df`. **Before staging/committing to a shared superproject, check `intercom list` for active sessions; if one is active on that superproject, re-establish lockstep (announce + ack) — or commit only surgically (`git add <specific paths>`, never `git add -A`).**

## Universal candidates (propose to universal-rules skill)

### U2 — Don't invent narratives; describe actual state (applies to ANY investigation)
See R5. Universal: when diagnosing messy/duplicated state, never fabricate an architecture story; enumerate facts first.

### U3 — Audit-before-mutate on structural cleanups (applies to ANY multi-item cleanup)
See R6. Universal: for a cleanup spanning many items of different kinds, audit each item's nature before any mutation; don't apply a uniform fix mechanically. Dual-model-audit the plan (RULE 23) first.

## Corrected record

- The recurring "bump the workshop gitlink" step I listed as a "next" was cosmetic busywork (orphan gitlink, no consumer). Corrected: pi-a2a-communication is now a proper submodule; future submodule advances get a meaningful bump (with a functional consumer).
- I made the open-notebook mess worse before fixing it (invented "overlay", baked deployment files into the codebase submodule). Corrected by Carlos's pushback; final state consolidated + aligned to the vault.
- v0.5.0 release tag deferred (not skipped) — don't tag unverified features (same lesson as v1's GAP-2 "implemented ✅" correction).

## Cost note

Session ~$125.43 (glm-5.2:cloud orchestrator; 88.6M tokens in). Driven by a marathon session with ever-growing orchestrator context. **Routing review:** decompose long investigations into subagents EARLIER to shed orchestrator context.