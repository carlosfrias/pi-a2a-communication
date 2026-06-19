---
date: 2026-06-19
prompt: "How do I create intellij projects that show up as a root module from a larger parent project folder?"
outcome: "Explained 3 approaches. Created parent IntelliJ project at Infrastructure/ level with pi-a2a-communication as child module. Added workspace package.json, .gitignore, VCS mappings for 21 git repos, and run configurations."
thread: m6-spec-compliance
---

# 005: IntelliJ Parent Project Setup

## User Request (verbatim)
> How do I create intellij projects that show up as a root module from a larger parent project folder?

## Context
User wanted to work on pi-a2a-communication within the broader Infrastructure workspace in IntelliJ, seeing it as a module within a parent project.

## Decisions Made
1. Created parent `.idea/` at `workshop/02-Areas/Infrastructure/` with `Infrastructure.iml` as root module
2. `pi-a2a-communication` registered as child module with its own `.idea/`
3. VCS mappings added for 21 git repos
4. Workspace `package.json` created with pi-a2a-communication as member
5. `.gitignore` added at Infrastructure level excluding `.idea/` and `node_modules/`
6. Dual-mode compatibility: open Infrastructure/ for all modules, or pi-a2a-communication/ alone

## Thread Impact
- IntelliJ project ready for development