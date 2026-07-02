---
prompt: 005
date: 2026-07-02
verbatim: |
  Make sure your work isn't colliding with the work the other session is doing.
---

# 005 — Avoid collision with the other session

## Context
A concurrent pi session (`subagent-chat-019f1eed`, "Track A2A") was active in the same workspace. User flagged the collision risk (recalled memory noted a cross-session lockstep protocol). I was editing the `pi-a2a-communication` repo + deploying to the fleet.

## Outcome
- Verified via intercom: git repos were SEPARATE (I commit only to `pi-a2a-communication`; the other session to playbook-executor/vault/workshop) → no git collision.
- The only overlap was fleet ansible (both restart pi-agent on nodes). Serialized: the other session held ansible; I ran the single `upgrade-a2a.yml` per deploy, intercom'd "starting"/"done".
- The other session also flagged a pi-intercom duplicate conflict (from my `pi install npm:pi-intercom`); reconciled with evidence (the duplicate was real; they uninstalled it).
- That session ended mid-way; later deploys had no concurrent session.
- Intercom delivery was glitchy (crossed/duplicate messages) — resolved by evidence-based verification (git log, `pi list`, fresh `pi --print`).

## Decisions
- Serialize fleet ansible (never run `upgrade-a2a.yml` concurrently with the other session's restarts).
- Evidence-based reconciliation over repeated intercom acknowledgments (avoid feeding a loop).

## Thread impact
No collision occurred; all v0.5.x deploys landed cleanly. Established the coordination pattern for future concurrent sessions.