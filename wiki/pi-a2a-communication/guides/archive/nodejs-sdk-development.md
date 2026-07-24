---
name: Node.js SDK Development Guide
updated: 2026-06-19
category: guides
---

# Node.js SDK Development Guide

How pi-a2a-communication works as a Node.js library and pi extension package, best practices for development, testing, CI/CD, and deployment. Covers the pi extension SDK, TypeScript library patterns, and real-world deployment scenarios.

---

## Table of Contents

1. [Architecture: How This Library Works](#architecture-how-this-library-works)
2. [Pi Extension System](#pi-extension-system)
3. [TypeScript Library Patterns](#typescript-library-patterns)
4. [Testing Best Practices](#testing-best-practices)
5. [Build and Publishing](#build-and-publishing)
6. [CI/CD Practices](#cicd-practices)
7. [Common Deployment Scenarios](#common-deployment-scenarios)
8. [References and Further Reading](#references-and-further-reading)

---

## Architecture: How This Library Works

### What It Is

pi-a2a-communication is a **TypeScript Node.js library** packaged as a **pi extension**. It has no frontend, no web framework, and no runtime dependencies beyond Node.js itself.

| Aspect | Detail |
|--------|--------|
| **Type** | Backend library / pi extension package (plugin) |
| **Language** | TypeScript 5.x, targeting ES2022 |
| **Module system** | NodeNext (ESM primary, CJS secondary via dual build) |
| **Runtime** | Node.js ≥ 18 |
| **Runtime deps** | Zero (all logic is self-contained) |
| **Dev deps** | TypeScript, Vitest, ESLint, `@types/node` |
| **UI** | None — headless extension registering slash commands and tools |
| **Testing** | Vitest with V8 coverage |

### Source Architecture

```
src/
├── index.ts           # Extension entry point — registers all commands/tools with pi
├── a2a-client.ts      # A2A client: sendMessage, sendStreamingMessage, getTask, cancelTask
├── a2a-server.ts      # A2A server: HTTP listener, JSON-RPC, SSE, task lifecycle
├── agent-discovery.ts # Agent Card fetching, parsing, caching, registry
├── task-manager.ts    # Task orchestration: single, parallel, chain, async
├── config.ts          # Configuration manager with disk persistence
├── types.ts           # A2A v1.0 protocol type definitions + constants
└── enterprise-config.example.ts  # Enterprise config example
```

The entry point (`index.ts`) exports a **default factory function** that receives the pi `ExtensionAPI`. This is the pi extension contract — the only thing pi needs to load your extension.

### How It Connects to pi

```typescript
// index.ts — the pi extension contract
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  // Subscribe to events
  pi.on("session_start", async (event, ctx) => { /* ... */ });

  // Register tools the LLM can call
  pi.registerTool({ name: "a2a_call", /* ... */ });
  pi.registerTool({ name: "a2a_parallel", /* ... */ });

  // Register slash commands
  pi.registerCommand("a2a-discover", { /* ... */ });
  // ... 10 commands total
}
```

Pi discovers this extension via:
- **Global path:** `~/.pi/agent/extensions/pi-a2a-communication/index.ts` (auto-discovered)
- **Project path:** `.pi/extensions/pi-a2a-communication/index.ts`
- **Package install:** `pi install git:github.com/carlosfrias/pi-a2a-communication`

When pi starts a session, it loads the extension's default export, calls it with `ExtensionAPI`, and the extension wires itself into the event system.

---

## Pi Extension System

### Core Concepts

Pi extensions are **TypeScript modules** that hook into the pi agent lifecycle. They are loaded via [jiti](https://github.com/unjs/jiti) — no compilation step required for development.

Key capabilities available to extensions:

| Capability | API | This Library's Usage |
|-----------|-----|---------------------|
| **Custom tools** | `pi.registerTool()` | `a2a_call`, `a2a_parallel` |
| **Slash commands** | `pi.registerCommand()` | `/a2a-discover`, `/a2a-send`, etc. (10 commands) |
| **Event hooks** | `pi.on(event, handler)` | `session_start`, `session_shutdown` |
| **User interaction** | `ctx.ui.notify()`, `ctx.ui.confirm()` | Status messages, error notifications |
| **Session state** | `ctx.sessionManager` | Task state persistence |

### Extension Lifecycle

```
pi starts
  └─► Loads extensions from auto-discovery paths
      └─► Calls export default function(pi: ExtensionAPI)
          └─► Extension registers tools, commands, event handlers
              └─► session_start fires → extension initializes runtime state
                  └─► Agent processes prompts → tools/commands invoked
                      └─► session_shutdown fires → extension cleans up resources
```

### Extension Styles

**Single file** (simplest):
```
~/.pi/agent/extensions/
└── my-extension.ts
```

**Directory with index.ts** (this project's pattern):
```
~/.pi/agent/extensions/
└── pi-a2a-communication/
    ├── index.ts        # Entry point (default export)
    ├── a2a-client.ts   # Helper module
    ├── a2a-server.ts   # Helper module
    └── ...              # Other modules
```

**Package with dependencies** (for npm-published packages):
```json
{
  "name": "pi-a2a-communication",
  "dependencies": { /* runtime deps */ },
  "pi": {
    "extensions": ["./dist/index.js"],
    "commands": ["/a2a-discover", "/a2a-send", "..."],
    "tools": ["a2a_call", "a2a_parallel"]
  }
}
```

### Available Imports

Extensions can import from these pi packages:

| Package | Purpose |
|---------|---------|
| `@earendil-works/pi-coding-agent` | `ExtensionAPI`, `ExtensionContext`, event types, session types |
| `typebox` | Schema definitions for tool parameters (TypeBox) |
| `@earendil-works/pi-ai` | AI utilities (`StringEnum` for Google-compatible enums) |
| `@earendil-works/pi-tui` | TUI components for custom rendering |

This project uses **type stubs** (`types/pi-runtime.d.ts`) that redirect the `@mariozechner/pi-coding-agent` import (the old package name) to local type definitions. This allows development without the full pi runtime installed:

```jsonc
// tsconfig.json paths
{
  "paths": {
    "@mariozechner/pi-coding-agent": ["./types/pi-runtime.d.ts"],
    "@mariozechner/pi-ai": ["./types/pi-runtime.d.ts"],
    "@mariozechner/pi-tui": ["./types/pi-runtime.d.ts"],
    "@mariozechner/pi-agent-core": ["./types/pi-runtime.d.ts"]
  }
}
```

### Important Rules for pi Extensions

1. **Don't start background resources in the factory function.** The factory may run in invocations that never start a session. Defer to `session_start`.

2. **Clean up in `session_shutdown`.** Register an idempotent shutdown handler to close servers, connections, file watchers.

3. **Use `ctx.signal` for abort-aware async work.** This lets users cancel operations with Esc.

4. **Return values from event handlers control behavior.** For `tool_call`, return `{ block: true, reason: "..." }` to block. For `input`, return `{ action: "handled" }` to skip agent processing.

5. **Extensions run with full system permissions.** Only install extensions from trusted sources.

### Pi Package Installation

```bash
# Install from git
pi install git:github.com/carlosfrias/pi-a2a-communication

# Install from npm
pi install npm:pi-a2a-communication@0.2.0

# Install from local path
pi install /path/to/pi-a2a-communication

# Try without installing (temporary)
pi -e git:github.com/carlosfrias/pi-a2a-communication

# List installed packages
pi list

# Update all packages
pi update --all

# Remove
pi remove npm:pi-a2a-communication
```

Pi packages go to `~/.pi/agent/npm/` (npm) or `~/.pi/agent/git/` (git) for global scope, `.pi/npm/` or `.pi/git/` for project scope.

---

## TypeScript Library Patterns

### Dual Build: ESM + CJS

This project produces dual output formats:

```
dist/
├── index.js          # ESM (primary)
├── index.cjs          # CJS (secondary)
├── index.d.ts         # Type declarations
└── ...                # Other modules
```

Configured in `package.json`:
```json
{
  "type": "module",
  "main": "dist/index.js",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  }
}
```

And built with two TypeScript configs:
- `tsconfig.json` → ESM output (`dist/index.js`)
- `tsconfig.cjs.json` → CJS output (`dist/index.cjs`)

```bash
# Build both
npm run build
# → tsc && npm run build:cjs
# → tsc -p tsconfig.cjs.json && mv dist/cjs/index.js dist/index.cjs
```

### Zero Runtime Dependencies

This project has **zero runtime dependencies** — all logic is self-contained. This is a deliberate choice for:

- **Minimal install footprint** — no transitive dependency conflicts
- **Deterministic builds** — no dependency version drift
- **Security** — smaller attack surface, no supply chain risk from transitive deps
- **pi compatibility** — no version conflicts with pi's own dependencies

Dev dependencies only:

```json
{
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "eslint": "^8.0.0",
    "typescript": "^5.0.0",
    "vitest": "^1.6.1"
  }
}
```

### Module Resolution: NodeNext

```jsonc
// tsconfig.json
{
  "target": "ES2022",
  "module": "NodeNext",
  "moduleResolution": "NodeNext"
}
```

This means:
- **Source imports must include `.js` extensions:** `import { A2AClient } from "./a2a-client.js"`
- **Node.js resolves ESM natively** — no bundler required
- **CJS consumers** get `dist/index.cjs` via the `require` export condition

### Type Stub Pattern for Host Decoupling

This project doesn't depend on `@earendil-works/pi-coding-agent` at runtime. Instead, it uses **type stubs**:

```
types/
└── pi-runtime.d.ts    # Declares ExtensionAPI, ExtensionContext, etc.
```

With `tsconfig.json` paths redirecting the import:
```jsonc
{
  "paths": {
    "@mariozechner/pi-coding-agent": ["./types/pi-runtime.d.ts"]
  }
}
```

And `vitest.config.ts` mirroring the alias:
```typescript
resolve: {
  alias: {
    "@mariozechner/pi-coding-agent": path.resolve(SRC, "types/pi-runtime.d.ts"),
  }
}
```

**Benefits:**
- Develop and test without the full pi runtime installed
- No version coupling between the extension and pi
- At runtime, pi provides the real `ExtensionAPI` — types are only for development
- Tests can mock the pi API with simple test doubles

### Global Extension State Pattern

The extension uses module-level state variables, initialized on `session_start`:

```typescript
let a2aClient: A2AClient | null = null;
let a2aServer: A2AServer | null = null;
let agentDiscovery: AgentDiscovery | null = null;
let taskManager: TaskManager | null = null;
let configManager: ConfigManager | null = null;

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (event, ctx) => {
    configManager = new ConfigManager(DEFAULT_CONFIG);
    a2aClient = new A2AClient(configManager.getConfig().client, ...);
    // ...
  });

  pi.on("session_shutdown", async () => {
    await a2aServer?.stop();
    a2aClient = null;
    // ...
  });
}
```

This pattern:
- **Defers initialization** to session start (avoids the anti-pattern of starting servers in the factory)
- **Cleans up** on session shutdown
- **Allows null checks** in tools/commands to handle pre-initialization state

---

## Testing Best Practices

### Test Architecture

This project uses a **three-tier test strategy** per anti-drift rule CA-5 ("All new features start with a test"):

| Tier | Directory | Purpose | When to Run |
|------|-----------|---------|-------------|
| **Conformance** | `tests/a2a-v1-conformance.test.ts` | A2A v1.0 spec compliance (19 tests, S1–S6b) | Every commit touching server/protocol code |
| **Spec Compliance** | `tests/spec-compliance/` | Unit-level spec compliance tests | Every commit touching `types.ts` |
| **Characterization** | `tests/characterization/` | Existing behavior documentation tests | Before refactoring |

### Vitest Configuration

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 15000,
    hookTimeout: 15000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['tests/**', 'dist/**', 'types/**']
    }
  },
  resolve: {
    conditions: ['node'],
    alias: {
      // pi runtime type stubs (not real runtime)
      '@mariozechner/pi-coding-agent': path.resolve(SRC, 'types/pi-runtime.d.ts'),
      // ... other stubs
    }
  }
});
```

### Running Tests

```bash
# Run all tests
npx vitest run

# Run only conformance tests
npx vitest run a2a-v1-conformance

# Run with coverage
npx vitest run --coverage

# Run in watch mode
npx vitest

# Run a single test file
npx vitest run tests/spec-compliance/a2a-v1-protocol.test.ts
```

### TDD Workflow (per CA-5)

1. **Write a failing test** first
   - Spec gap → write a conformance test (e.g., "S7: server must return JSON-RPC error for unknown method")
   - Existing behavior → write a characterization test
   - Edge case → write a unit test

2. **Implement** the minimum code to make it pass

3. **Verify** by running the relevant test suite:
   ```bash
   npx vitest run a2a-v1-conformance  # After any protocol change
   npx vitest run spec-compliance      # After any types.ts change
   ```

4. **Refactor** if needed, keeping all tests green

### Mocking the pi Extension API

Since the extension uses type stubs, tests need to mock `ExtensionAPI` and `ExtensionContext`:

```typescript
// Create a mock ExtensionAPI
const mockPi = {
  on: vi.fn(),
  registerTool: vi.fn(),
  registerCommand: vi.fn(),
  registerShortcut: vi.fn(),
  registerFlag: vi.fn(),
  sendMessage: vi.fn(),
  appendEntry: vi.fn(),
};

// Create a mock ExtensionContext
const mockCtx = {
  ui: {
    notify: vi.fn(),
    confirm: vi.fn(),
    select: vi.fn(),
    input: vi.fn(),
  },
  cwd: '/tmp/test',
  sessionManager: { /* ... */ },
};

// Call the extension factory
import extension from '../src/index.js';
extension(mockPi as any);
```

For HTTP-based testing (A2A client/server), use Vitest's built-in fetch mocking or start a real HTTP server on a random port:

```typescript
import { Server } from 'node:http';

// Start server on random port
const server = new Server(app);
await new Promise(resolve => server.listen(0, resolve));
const port = server.address().port;
const baseUrl = `http://localhost:${port}`;

// ... run tests against baseUrl ...

// Cleanup
server.close();
```

---

## Build and Publishing

### Build Process

```bash
# Clean and build both ESM + CJS
npm run build
# → tsc && npm run build:cjs
# → tsc -p tsconfig.cjs.json && mv dist/cjs/index.js dist/index.cjs
```

Output structure:
```
dist/
├── index.js           # ESM entry point
├── index.cjs          # CJS entry point
├── index.d.ts         # TypeScript declarations
├── index.d.ts.map     # Declaration source maps
├── a2a-client.js      # Individual modules (ESM)
├── a2a-server.js
├── ...
└── a2a-client.d.ts    # Individual declarations
```

### Pi Package Manifest

The `pi-package.json` is the pi-specific manifest (separate from `package.json`):

```json
{
  "name": "pi-a2a-communication",
  "version": "0.1.0-alpha.1",
  "description": "A2A client extension for pi",
  "author": "Carlos Frias <carlos@frias.io>",
  "category": "communication",
  "tags": ["a2a", "multi-agent", "distributed", "communication", "pi-extension"],
  "repository": "https://github.com/carlosfrias/pi-a2a-communication",
  "compatibility": {
    "pi": ">=1.0.0",
    "node": ">=18.0.0"
  },
  "commands": ["/a2a-discover", "/a2a-send", "..."],
  "tools": ["a2a_call", "a2a_parallel"]
}
```

### Publishing to npm

```bash
# Ensure clean build
npm run build

# Dry run
npm publish --dry-run

# Publish (after version bump)
npm version patch  # or minor, major
npm publish
```

### Publishing as a Pi Package (git)

```bash
# Tag a release
git tag v0.2.0
git push origin v0.2.0

# Users install with
pi install git:github.com/carlosfrias/pi-a2a-communication@v0.2.0
```

Pi handles `npm install` automatically during `pi install`. Runtime dependencies in `package.json` `dependencies` are installed; `devDependencies` are skipped.

---

## CI/CD Practices

### Recommended GitHub Actions Workflow

This project does not yet have a `.github/` directory. Here is a recommended CI/CD setup:

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: npm
      - run: npm ci
      - run: npm run build
      - run: npx vitest run
      - run: npx vitest run --coverage

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint

  publish:
    needs: [test, lint]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && startsWith(github.event.head_commit.message, 'release')
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          registry-url: https://registry.npmjs.org
      - run: npm ci
      - run: npm run build
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Key CI/CD Practices for Node.js Libraries

1. **Matrix testing across Node versions** — Test on 18, 20, 22 minimum
2. **Build verification** — `npm run build` must succeed before tests
3. **Conformance tests as gate** — `npx vitest run a2a-v1-conformance` must pass for any merge
4. **Coverage tracking** — V8 coverage with HTML report
5. **Lint before merge** — ESLint must pass
6. **Semantic versioning** — `npm version patch|minor|major` before publish
7. **Trusted publishing** — Use OIDC-based npm publishing from GitHub Actions (no long-lived tokens)
8. **Dual build verification** — Both ESM and CJS outputs must build cleanly

### Trusted Publishing (npm)

npm supports **trusted publishers** using OIDC authentication from GitHub Actions:

```yaml
# In publish job
- uses: actions/setup-node@v4
  with:
    node-version: 20
    registry-url: https://registry.npmjs.org
- run: npm publish --provenance
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

This eliminates the need for long-lived npm tokens. Configure at [npmjs.com](https://www.npmjs.com) → Package → Settings → Trusted Publishers.

### Pre-publish Checklist

```bash
# 1. Update version
npm version patch  # or minor/major

# 2. Verify build
npm run build

# 3. Run all tests
npx vitest run

# 4. Run conformance suite specifically
npx vitest run a2a-v1-conformance

# 5. Dry run publish
npm publish --dry-run

# 6. Publish
npm publish

# 7. Tag and push
git push origin main --tags
```

---

## Common Deployment Scenarios

### Scenario 1: Local Development Installation

The most common deployment — install the extension on your local pi agent for development and testing.

```bash
# Install from git (recommended for development)
pi install git:github.com/carlosfrias/pi-a2a-communication

# Or link locally for active development
cd ~/projects/pi-a2a-communication
npm link
# Then in pi settings.json, add to extensions:
# "/path/to/pi-a2a-communication/src/index.ts"
```

**Use case:** Individual developer using A2A to communicate with agents running on other machines or services.

### Scenario 2: Fleet Deployment (Multi-Node)

Deploy the extension across a fleet of pi agents running on different machines. The A2A server mode exposes each pi agent as an A2A-compliant agent.

```bash
# On each fleet node:
pi install git:github.com/carlosfrias/pi-a2a-communication

# Configure the server
/a2a-config server.enabled true
/a2a-config server.port 10000
/a2a-config server.host 0.0.0.0

# Start the A2A server
/a2a-server start 10000
```

**Use case:** A fleet of specialized pi agents (research, code review, deployment) communicating via A2A protocol across machines.

### Scenario 3: A2A Gateway (Enterprise)

For production deployments, the A2A server code in this package is a stub. The real production deployment uses **pi-a2a-gateway** (a separate project) that provides:

- TLS termination
- Authentication/authorization (OAuth2, mTLS)
- Rate limiting
- Agent registry
- Health monitoring

This package is the **client** that connects to the gateway.

```
┌─────────────────┐      A2A Protocol      ┌──────────────────┐
│  pi Agent       │ ◄──────────────────► │  A2A Gateway     │
│  (this package) │    JSON-RPC over HTTP  │  (pi-a2a-gateway)│
└─────────────────┘                        └────────┬─────────┘
                                                    │
                                    ┌───────────────┼───────────────┐
                                    │               │               │
                                    ▼               ▼               ▼
                            ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
                            │ Auth Agent   │ │ Billing Agent│ │ ML Agent     │
                            └──────────────┘ └──────────────┘ └──────────────┘
```

**Use case:** Enterprise multi-organization agent collaboration with security, rate limiting, and centralized management.

### Scenario 4: CI/CD Pipeline Integration

Use `a2a_call` and `a2a_parallel` tools in pi sessions to orchestrate CI/CD tasks across multiple agents.

```bash
# In a pi session triggered by CI/CD:
# 1. Discover available agents
/a2a-discover https://ci-agent-1.example.com
/a2a-discover https://ci-agent-2.example.com

# 2. Run security scans in parallel
/a2a-broadcast "Scan for vulnerabilities" \
  --agents https://security-agent.ci.com,https://compliance-agent.ci.com

# 3. Generate documentation
/a2a-send docs-agent "Generate release notes for v2.0"
```

**Use case:** Automated CI/CD pipelines where pi orchestrates multiple specialized agents for code review, security scanning, and documentation generation.

### Scenario 5: SDK Embedding

Use the pi SDK to embed A2A capabilities in a custom application:

```typescript
import { createAgentSession, DefaultResourceLoader, SessionManager } from "@earendil-works/pi-coding-agent";

const loader = new DefaultResourceLoader({
  additionalExtensionPaths: ["/path/to/pi-a2a-communication/dist/index.js"],
});
await loader.reload();

const { session } = await createAgentSession({
  resourceLoader: loader,
  sessionManager: SessionManager.inMemory(),
});

// Now the session has a2a_call and a2a_parallel tools available
await session.prompt("Use a2a_call to check the security agent at https://security.example.com");
```

**Use case:** Building a custom web UI, CLI, or automated pipeline that uses pi as an agent with A2A capabilities.

### Scenario 6: Development Testing with Local Server

For development, start the local A2A server and test client calls against it:

```bash
# Terminal 1: Start the A2A server
/a2a-server start 10000

# Terminal 2: Discover and call
/a2a-discover http://localhost:10000
/a2a-send localhost-agent "Test message"
```

**Use case:** Local development and testing without needing a remote A2A gateway.

---

## References and Further Reading

### Pi Extension Development

| Resource | URL | Description |
|----------|-----|-------------|
| **Pi Extensions Docs** | [pi.dev/docs/latest/extensions](https://pi.dev/docs/latest/extensions) | Full extension API reference (events, tools, commands, UI) |
| **Pi Packages Docs** | [pi.dev/docs/latest/packages](https://pi.dev/docs/latest/packages) | Package structure, installation, publishing |
| **Pi SDK Docs** | [pi.dev/docs/latest/sdk](https://pi.dev/docs/latest/sdk) | Programmatic access to pi's agent capabilities |
| **Pi Extension Examples** | `pi-coding-agent/examples/extensions/` | Working extension examples (snake, summarize, dynamic-tools, etc.) |
| **Pi SDK Examples** | `pi-coding-agent/examples/sdk/` | SDK integration examples (11 examples from minimal to full control) |

### Node.js Library Best Practices

| Resource | URL | Description |
|----------|-----|-------------|
| **Snyk: Create Modern npm Package** | [snyk.io/blog/best-practices-create-modern-npm-package](https://snyk.io/blog/best-practices-create-modern-npm-package/) | Modern package setup, security, dual ESM/CJS |
| **TypeScript Dual Package Starter** | [github.com/thaitype/typescript-dual-packages-starter](https://github.com/thaitype/typescript-dual-packages-starter) | Boilerplate for dual ESM/CJS packages |
| **Node.js Publishing Guide** | [nodejs.org/en/learn/typescript/publishing-a-ts-package](https://nodejs.org/en/learn/typescript/publishing-a-ts-package) | Official TypeScript package publishing guide |
| **Plugin Architecture in Node.js** | [adaltas.com/en/2020/08/28/node-js-plugin-architecture](https://www.adaltas.com/en/2020/08/28/node-js-plugin-architecture/) | Plugin patterns (hook, middleware, event-driven) |
| **Oneuptime: Node.js Plugin Architecture** | [oneuptime.com/blog/post/nodejs-plugin-architecture/view](https://oneuptime.com/blog/post/2026-01-26-nodejs-plugin-architecture/view) | Modern plugin architecture patterns |

### CI/CD and Publishing

| Resource | URL | Description |
|----------|-----|-------------|
| **GitHub Actions: Node.js CI** | [docs.github.com/actions/guides/building-and-testing-nodejs](https://docs.github.com/actions/guides/building-and-testing-nodejs) | Official GitHub Actions Node.js CI guide |
| **GitHub Actions: Publishing npm Packages** | [docs.github.com/actions/publishing-packages/publishing-nodejs-packages](https://docs.github.com/actions/publishing-packages/publishing-nodejs-packages) | Publishing npm packages from CI |
| **npm Trusted Publishers** | [docs.npmjs.com/trusted-publishers](https://docs.npmjs.com/trusted-publishers/) | OIDC-based npm publishing (no long-lived tokens) |
| **Grizzly Peak: Publishing npm Packages** | [grizzlypeaksoftware.com/library/publishing-npm-packages](https://www.grizzlypeaksoftware.com/library/publishing-npm-packages-complete-workflow-n0etbyg4) | Complete workflow including semantic-release |

### This Project's Documentation

| Path | Content |
|------|---------|
| [Learning & Resources Guide](./learning-and-resources.md) | A2A protocol fundamentals, tutorials, deployment patterns |
| [A2A v1 Spec Compliance](../a2a-v1-spec-compliance.md) | Spec compliance audit results |
| [A2A v1 Conformance Report](../A2A-v1-Conformance-Report.md) | Full executive report with Mermaid diagrams |
| [Agent Card Schema](../agent-card-schema.md) | A2A Agent Card schema reference |
| [README.md](../../../README.md) | Full usage documentation with examples |

---

*Last updated: 2026-06-19*