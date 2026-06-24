# PR Template — Based on 5queezer/PR #1 Pattern

> Extracted from `DrOlu/pi-a2a-communication` PR #1 by 5queezer (Christian Pojoni).
> Use this structure for our S1–S6b spec compliance PRs.

---

## Title Format

`fix: <scope> — <concise description>`

Examples from upstream:
- PR #1: `Make A2A server functional and fix auth`
- PR #2: `feat: support custom A2A config directory`

For our PRs, use conventional commit prefix + A2A spec context:
- `fix: A2A v1.0 spec compliance — security and crash bugs (S2, S3, S5)`
- `fix: A2A v1.0 spec compliance — protocol and transport (S1, S4, S6, S6b)`

---

## Body Structure

### 1. Summary
Bullet list of what this PR fixes. Each bullet is a self-contained change. Start with the user-visible impact, then list implementation details.

Pattern:
```
## Summary

This fixes <what's broken and why it matters>:

- <Fix 1: user-visible impact>
- <Fix 2: user-visible impact>
- ...
```

### 2. Motivation / Context (optional but recommended)
Explain *why* these changes matter. Reference the spec sections or RFCs.

Pattern:
```
## Motivation

<Why this matters. Which spec sections or RFCs are violated. What breaks for users.>
```

### 3. Technical Details (for non-trivial changes)
Explain the approach taken. Include subsections for distinct features if the PR has multiple.

Pattern:
```
## <Feature or fix name>

<Explanation of approach, design decisions, backward compatibility notes.>
```

### 4. Safety Notes (if applicable)
Warn about breaking changes, security implications, or deployment considerations.

Pattern:
```
## Safety notes

<Who should be careful. What could break. Security considerations.>
```

### 5. Validation
Automated + manual verification steps. This is critical — both `npm test` output AND manual protocol-level testing.

Pattern:
```
## Validation

- `npm install`
- `npm test -- --run`  (or `npx vitest run`)
- `npm run build`
- Manual A2A protocol checks:
  - <specific curl or client test>
  - <specific endpoint verification>
```

### 6. Regression Notes (if applicable)
Document bugs found during testing and how they were fixed.

Pattern:
```
## <Bug or regression name>

<Description of the bug found during manual testing>

Root cause:
- <explanation>

Fix:
- <what was changed>

Manual validation:
- <steps to verify>
```

---

## Key Patterns to Follow

1. **Title: concise, no internal issue IDs.** No "S1" or "S6b" in the title — those are our internal tracking, not meaningful to external reviewers.

2. **Summary bullets are user-visible.** Each bullet explains the fix from a user's perspective, not our internal classification.

3. **Reference the spec.** Cite A2A v1.0 spec sections and/or relevant RFCs (e.g., RFC 7235 for auth, RFC 8615 for well-known URIs, JSON-RPC spec for error handling).

4. **Show the test suite.** Include the conformance test count and how to run it. PR #1 showed both unit tests and manual protocol-level verification.

5. **Manual protocol-level testing.** Show actual `curl` commands or client interactions that verify the fix at the HTTP level, not just unit tests.

6. **Backward compatibility.** If a fix changes behavior (e.g., adding a new route), note whether the old path still works and how.

7. **No internal references.** No "GAP-2", "M10", "fnet3", "PiTaskBridge", or fleet-specific terminology. External reviewers don't know our project structure.

8. **Clean diff.** PR #1 was 480 additions / 58 deletions — focused and reviewable. Our S1–S6b fixes are ~7 commits. Consider whether to submit as 2 PRs (security+crash separate from protocol+transport) or 1 PR with clear sections.

---

## PR Split Recommendation

Based on the overlap analysis with existing PR #1 (5queezer):

**Option A: Single PR** — `fix: A2A v1.0 spec compliance — 6 conformance fixes`
- All S1–S6b in one PR
- Pro: Simple, complete
- Con: Large diff, mixes security fixes with protocol fixes

**Option B: Two PRs** (recommended, mirrors 5queezer's approach of one PR per concern area)

| PR | Scope | Fixes | Rationale |
|----|-------|-------|-----------|
| 1 | Security & crash bugs | S2, S3, S5 | P0 severity, no overlap with PR #1 (they moved auth to per-route but didn't add WWW-Authenticate; their agent-card path is still wrong) |
| 2 | Protocol compliance | S1, S4, S6, S6b | P1/P2 severity, zero overlap with any existing PR |

PR #1 (5queezer) addresses auth restructuring and session execution — different approach from ours. Our S2 fix (WWW-Authenticate header) is complementary, not conflicting. Our S3 fix (agent-card.json) corrects their path. S5, S1, S4, S6/S6b have zero overlap.

*Last updated: 2026-06-24*