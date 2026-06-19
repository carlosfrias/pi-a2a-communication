---
name: Agent Card Schema
status: verified
updated: 2026-06-19
---

# Agent Card Schema — pi-a2a-communication

Agent Cards are the discovery mechanism in the A2A protocol. Every A2A-compliant agent serves an Agent Card at a well-known URL, describing its capabilities, authentication requirements, and communication endpoints.

## Discovery Path

| Path | Spec | Status in Local Fork | Status in npm v1.0.1 |
|------|------|-----------------------|-----------------------|
| `/.well-known/agent-card.json` | **A2A v1.0 §8.2, §14.3** (correct spec path) | ❌ Returns 404 | ❌ Returns 404 |
| `/.well-known/agent.json` | Not in spec (local fork invention) | ✅ Returns 200 | ❌ Returns 404 |
| `/.well-known/agent-card` | Not in spec (legacy, close but missing `.json`) | ❌ Returns 404 | ✅ Returns 200 |

> **See also:** [[wiki/reference/A2A-v1-Conformance-Report]] for full spec compliance details.

> **Note:** The correct A2A v1.0 discovery path is `/.well-known/agent-card.json` (with `.json` suffix per RFC 8615). Neither the local fork nor the published npm package serve this path correctly.

## Fleet Agent Card

Each fleet node serves an identical Agent Card at `http://{host}:10000/.well-known/agent-card` (with `Authorization: Bearer lab-fleet-2026`):

```json
{
  "name": "pi-coding-agent",
  "description": "pi coding agent exposed via A2A protocol",
  "url": "http://0.0.0.0:10000",
  "version": "1.0.0",
  "provider": {
    "organization": "pi",
    "url": "https://pi.dev"
  },
  "capabilities": {
    "streaming": true,
    "pushNotifications": true,
    "extendedAgentCard": true
  },
  "skills": [
    {
      "id": "code-generation",
      "name": "Code Generation",
      "description": "Generate code from natural language descriptions",
      "tags": ["code", "generation", "programming"],
      "examples": [
        "Write a Python function to sort a list",
        "Create a React component"
      ]
    },
    {
      "id": "code-analysis",
      "name": "Code Analysis",
      "description": "Analyze and review code for issues and improvements",
      "tags": ["code", "analysis", "review"],
      "examples": [
        "Review this function for bugs",
        "Explain what this code does"
      ]
    },
    {
      "id": "refactoring",
      "name": "Refactoring",
      "description": "Refactor code to improve structure and readability",
      "tags": ["code", "refactoring", "improvement"],
      "examples": [
        "Refactor this to use async/await",
        "Simplify this code"
      ]
    }
  ],
  "defaultInputModes": ["text/plain", "application/json"],
  "defaultOutputModes": ["text/plain", "application/json", "text/markdown", "text/code"],
  "securitySchemes": {
    "bearer": {
      "type": "http",
      "scheme": "bearer",
      "description": "Bearer token authentication"
    }
  },
  "securityRequirements": [
    {
      "schemes": {
        "bearer": []
      }
    }
  ]
}
```

## Schema Reference

### Top-Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✅ | Human-readable agent name |
| `description` | string | ✅ | Agent description |
| `url` | string | ✅ | Agent endpoint URL |
| `version` | string | ✅ | Agent version (semver) |
| `provider` | object | ❌ | Organization info |
| `provider.organization` | string | ❌ | Organization name |
| `provider.url` | string | ❌ | Organization URL |
| `capabilities` | object | ✅ | Agent capabilities |
| `capabilities.streaming` | boolean | ❌ | Supports SSE streaming |
| `capabilities.pushNotifications` | boolean | ❌ | Supports push notifications |
| `capabilities.extendedAgentCard` | boolean | ❌ | Has extended card |
| `skills` | array | ✅ | Agent skills |
| `defaultInputModes` | array | ❌ | Accepted input MIME types |
| `defaultOutputModes` | array | ❌ | Output MIME types |
| `securitySchemes` | object | ✅ | Authentication schemes |
| `securityRequirements` | array | ✅ | Required auth |

### Skill Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Unique skill identifier |
| `name` | string | ✅ | Human-readable skill name |
| `description` | string | ✅ | Skill description |
| `tags` | array | ❌ | Skill tags for discovery |
| `examples` | array | ❌ | Example prompts |

### Security Scheme Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | ✅ | `"http"` for bearer |
| `scheme` | string | ✅ | `"bearer"` |
| `description` | string | ❌ | Human-readable description |

## Authentication

All fleet nodes require Bearer token authentication:

```bash
# Fetch agent card (spec path — note: npm v1.0.1 only serves the legacy path)
curl -H "Authorization: Bearer lab-fleet-2026" \
  http://fnet1:10000/.well-known/agent-card

# Spec-compliant path (currently returns 404 on both local fork and npm v1.0.1):
# curl -H "Authorization: Bearer lab-fleet-2026" \
#   http://fnet1:10000/.well-known/agent-card.json

# Without auth → 401 Unauthorized (missing WWW-Authenticate header — see conformance report)
```

## Fleet Configuration

Agent cards are configured per-node at `~/.pi/agent/a2a/agents/{hostname}-agent.json`. The server reads this file on startup and serves it at the discovery endpoint.

## Related

- [[wiki/reference/A2A-v1-Conformance-Report]] — Full spec compliance audit
- [[wiki/reference/a2a-v1-spec-compliance]] — Compliance summary table

---

*Last updated: 2026-06-19*