---
name: Expertise Development Curriculum
updated: 2026-06-19
category: guides
audience: developers building Node.js expertise from first principles
scope: Node.js → TypeScript → plugin architecture → testing → CI/CD → integration → pi extensions → A2A deployment
---

# Expertise Development Curriculum

## From First Principles to Production Deployment

A structured curriculum for developing expertise in Node.js SDK/library development, plugin architecture, testing, CI/CD, integration, release workflows, and real-world deployment — with pi extensions and A2A as capstone applications, not prerequisites.

**Design principle:** Node.js comes first. pi extensions are an application of Node.js patterns, not a substitute for understanding them. This curriculum ensures you can use Node.js in any context — pi or otherwise.

---

## Part 1: Node.js Fundamentals

*Everything built on this project is a Node.js application. These are the foundations that make everything else possible.*

### 1.1 Module Systems: CJS and ESM

Node.js has two module systems. This project uses both — understanding why is essential.

**CommonJS (CJS)** — the original system:
```javascript
// export
module.exports = { hello, goodbye };
// import
const { hello } = require('./greetings');
```

**ECMAScript Modules (ESM)** — the modern standard:
```javascript
// export
export function hello() { return "hi"; }
// import
import { hello } from './greetings.js';  // .js extension required with NodeNext
```

**This project uses `NodeNext` resolution:**

```jsonc
// tsconfig.json
{
  "module": "NodeNext",
  "moduleResolution": "NodeNext"
}
```

This means:
- Source files must use `.js` extensions in imports (even though source is `.ts`)
- The `"type": "module"` field in `package.json` makes the project ESM-primary
- A second `tsconfig.cjs.json` produces a CJS fallback for consumers who use `require()`

**Why dual output?** Not all consumers have migrated to ESM. Publishing both (`dist/index.js` + `dist/index.cjs`) maximizes compatibility.

| Concept | What to Learn | Resource |
|---------|---------------|----------|
| CJS vs ESM semantics | Synchronous vs async loading, `require()` vs `import`, hoisting differences | [Node.js Docs: Modules](https://nodejs.org/api/esm.html) |
| Dual packaging | How `package.json` `exports` field serves both consumers | [Node.js Docs: Dual CJS/ESM packages](https://nodejs.org/api/packages.html#dual-package-hazzard) |
| `.js` extension requirement | Why `NodeNext` requires explicit extensions in source | [TypeScript Handbook: Module Resolution](https://www.typescriptlang.org/docs/handbook/modules/theory.html#module-resolution) |
| `package.json` `exports` | Conditional exports (`"import"` / `"require"` / `"types"`) | [Node.js Docs: Exports](https://nodejs.org/api/packages.html#exports) |

**Hands-on exercise:** Create a minimal dual-output library:
1. `src/index.ts` with one exported function
2. `tsconfig.json` (ESM) and `tsconfig.cjs.json` (CJS)
3. `package.json` with `"type": "module"` and conditional exports
4. `npm run build` and verify both `dist/index.js` and `dist/index.cjs` exist
5. Test both: `node -e "import('dist/index.js')"` and `node -e "require('dist/index.cjs')"`

### 1.2 Asynchronous JavaScript

Node.js is fundamentally async. This project uses async patterns extensively:

- **HTTP server** (`a2a-server.ts`): handles concurrent requests
- **SSE streaming** (`sendStreamingMessage`): streams real-time updates
- **Task lifecycle** (`task-manager.ts`): async state machines (submitted → working → completed)
- **Extension lifecycle** (`pi.on("session_start", async ...)`) : async event handlers

Key concepts to master:

| Pattern | Used In | How It Works |
|---------|---------|---------------|
| **Promises** | Every async operation | `await client.sendMessage(...)` |
| **Async iterators** | SSE streaming | `for await (const event of stream)` |
| **AbortController** | Cancellation | `ctx.signal` in pi tools, `AbortSignal` in fetch |
| **EventEmitter** | pi event system | `pi.on("tool_call", handler)` |
| **Error boundaries** | Network calls | try/catch with retry in `a2a-client.ts` |

**Resources:**

| Topic | Resource |
|-------|----------|
| Promises & async/await (deep) | [MDN: Async Functions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function) |
| Async iterators & generators | [MDN: Async Iteration](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for-await...of) |
| AbortController & AbortSignal | [Node.js Docs: AbortController](https://nodejs.org/api/globals.html#class-abortcontroller) |
| EventEmitter pattern | [Node.js Docs: Events](https://nodejs.org/api/events.html) |
| Error handling patterns | [Node.js Best Practices: Error Handling](https://github.com/goldbergyoni/nodebestpractices#1-error-handling) |

### 1.3 HTTP in Node.js

This project is an HTTP protocol implementation (A2A over JSON-RPC + SSE). Understanding Node.js HTTP is non-negotiable.

**What this project implements:**

```
Client → HTTP POST → JSON-RPC request → Server processes → JSON-RPC response → Client
Client → HTTP POST → JSON-RPC request → Server starts SSE stream → Events flow → Client
Client → HTTP GET  → /.well-known/agent-card → Server returns Agent Card JSON
```

Key Node.js modules used:

| Module | Purpose in This Project |
|--------|------------------------|
| `node:http` | Low-level HTTP server (`a2a-server.ts`) |
| `node:https` | TLS support for production deployments |
| `URL` / `URLSearchParams` | Parsing agent URLs and query strings |
| `ReadableStream` / `WritableStream` | SSE streaming implementation |

**Resources:**

| Topic | Resource |
|-------|----------|
| HTTP server from scratch | [Node.js Docs: HTTP](https://nodejs.org/api/http.html) |
| Server-Sent Events (SSE) | [MDN: Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events) |
| JSON-RPC 2.0 spec | [jsonrpc.org/specification](https://www.jsonrpc.org/specification) |

**Hands-on exercise:** Build a minimal JSON-RPC server:
1. Create `server.ts` using `node:http` that listens on port 3000
2. Accept POST to `/rpc` with `Content-Type: application/json`
3. Parse JSON-RPC request (`{ jsonrpc: "2.0", method: "...", params: {}, id: 1 }`)
4. Route to method handlers
5. Return JSON-RPC response
6. Add SSE endpoint at `/stream` that sends events every second
7. Test with `curl` and a simple client

### 1.4 Node.js Standard Library Essentials

This project uses zero runtime dependencies — everything is built on Node.js built-ins:

| Built-in | Used For |
|----------|----------|
| `node:http` | HTTP server (`a2a-server.ts`) |
| `node:crypto` | Task ID generation, hashing |
| `node:fs` | Config file persistence (`config.ts`) |
| `node:path` | Path resolution |
| `node:url` | URL parsing for agent discovery |
| `node:events` | Not directly, but pi's event system mirrors `EventEmitter` |

**Why zero dependencies?** Fewer dependencies means:
- No supply chain attacks from transitive deps
- No version conflicts with pi's own dependencies
- Deterministic builds across environments
- Smaller install footprint

**Resource:** [Node.js API Documentation](https://nodejs.org/api/) — read the `http`, `crypto`, `fs`, `path`, and `url` sections.

---

## Part 2: TypeScript for Node.js Libraries

*TypeScript is the language this project (and most modern Node.js libraries) use. Understanding the type system, build pipeline, and publishing workflow is essential for any library author.*

### 2.1 TypeScript Configuration That Matters

This project's `tsconfig.json` has specific choices worth understanding:

```jsonc
{
  "target": "ES2022",           // Modern JS output (top-level await, class fields)
  "module": "NodeNext",         // ESM-first with CJS fallback
  "moduleResolution": "NodeNext", // .js extensions required in imports
  "strict": false,              // Deliberate choice — enables gradually
  "declaration": true,          // Generate .d.ts files for consumers
  "declarationMap": true,       // Source maps for declarations
  "sourceMap": true,            // Source maps for debugging
  "paths": {                    // Type stubs — decouple from host
    "@mariozechner/pi-coding-agent": ["./types/pi-runtime.d.ts"]
  }
}
```

Key decisions explained:

| Decision | Why |
|----------|-----|
| `"strict": false` | Legacy choice from fork. Enables strict mode incrementally per-file with `// @ts-strict`. |
| `"target": "ES2022"` | Supports `at`, `structuredClone`, top-level await, error cause. Node 18+ supports all. |
| `paths` for type stubs | Allows development without the pi runtime installed. At runtime, pi provides the real types. |
| `"declaration": true` | Consumers need `.d.ts` files for type checking. Non-negotiable for a library. |

**Resources:**

| Topic | Resource |
|-------|----------|
| TSConfig deep dive | [typescriptlang.org/tsconfig](https://www.typescriptlang.org/tsconfig) |
| Module resolution strategies | [TypeScript Handbook: Module Resolution](https://www.typescriptlang.org/docs/handbook/modules/theory.html) |
| Declaration files (.d.ts) | [TypeScript Handbook: Declaration Files](https://www.typescriptlang.org/docs/handbook/declaration-files/templates.html) |

### 2.2 Type Stub Pattern (Host Decoupling)

This is a **critical pattern** for any Node.js library that integrates with a host system:

```
src/                          types/
├── index.ts                  └── pi-runtime.d.ts
│   import ExtensionAPI           declare interface ExtensionAPI {
│   from "@mariozechner/..."          on(event: string, handler: Function): void;
│                                     registerTool(def: any): void;
│                                     registerCommand(name: string, def: any): void;
│                                 }
```

**How it works:**
1. `tsconfig.json` `paths` redirects `@mariozechner/pi-coding-agent` → `./types/pi-runtime.d.ts`
2. `vitest.config.ts` `resolve.alias` does the same for tests
3. At runtime, pi provides the real `ExtensionAPI` — the stubs are only for type checking
4. Your code never `require()`s pi at runtime — zero coupling

**Why this pattern matters:**
- Develop and test without the host installed
- No version lockstep between your library and the host
- Tests mock the host API with simple test doubles
- The host provides the real implementation at runtime

**This pattern applies beyond pi.** Any library that plugs into a host system (VS Code extensions, Express middleware, Webpack plugins, Gulp tasks) can use this approach.

### 2.3 Dual Build Pipeline

```
src/                   dist/                    dist/
├── index.ts    →     ├── index.js    (ESM)    └── index.cjs  (CJS)
├── a2a-client.ts →   ├── a2a-client.js       └── (CJS fallbacks)
└── ...                └── ...
                       tsconfig.json              tsconfig.cjs.json
                       (ESM build)               (CJS build)
```

**Build process:**

```bash
npm run build
# Step 1: tsc (ESM)           → dist/*.js, dist/*.d.ts
# Step 2: tsc -p tsconfig.cjs  → dist/cjs/*.js
# Step 3: mv dist/cjs/index.js dist/index.cjs
```

**Package.json exports:**

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

**Resources:**

| Topic | Resource |
|-------|----------|
| TypeScript publishing guide | [nodejs.org/en/learn/typescript/publishing-a-ts-package](https://nodejs.org/en/learn/typescript/publishing-a-ts-package) |
| Dual package starter | [github.com/thaitype/typescript-dual-packages-starter](https://github.com/thaitype/typescript-dual-packages-starter) |
| Snyk: modern npm package | [snyk.io/blog/best-practices-create-modern-npm-package](https://snyk.io/blog/best-practices-create-modern-npm-package/) |

### 2.4 Zero-Dependency Design

This project's `package.json` has **zero runtime dependencies**. All logic uses Node.js built-ins:

```json
{
  "dependencies": {},      // ← nothing here
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "typescript": "^5.0.0",
    "vitest": "^1.6.1"
  }
}
```

**When to add a runtime dependency:**
- Only when a Node.js built-in cannot do the job
- Prefer `node:` built-ins (`node:http`, `node:crypto`, `node:fs`)
- If you must add one, pin the major version and audit it

**When zero-deps is the right choice:**
- Libraries that plug into a host (extensions, plugins, middleware)
- Protocol implementations (JSON-RPC, SSE) — Node.js has all the primitives
- Security-sensitive packages — smaller attack surface

---

## Part 3: Plugin and Extension Architecture

*This is the core design pattern. pi extensions are one instance of this pattern. VS Code extensions, Express middleware, Vite plugins, and ESLint rules are others. Understand the pattern once, apply it everywhere.*

### 3.1 The Universal Plugin Pattern

All plugin systems share the same core structure:

```
Host System
  │
  ├── Registration API ───────► Plugin registers capabilities
  │   (pi: registerTool,      (extension: "I provide a2a_call tool")
  │    registerCommand,        ("I provide /a2a-send command")
  │    on)
  │
  ├── Lifecycle Hooks ───────► Plugin reacts to events
  │   (session_start,          (extension: "Initialize A2A client")
  │    session_shutdown,       ("Clean up server, clear cache")
  │    tool_call)
  │
  └── Context Object ────────► Plugin accesses host state
      (ctx: ui, cwd,          (extension: "Notify user",
       sessionManager,          "Read working directory",
       signal)                  "Cancel on user abort")
```

**The three pillars of any plugin system:**

1. **Registration** — Plugin tells the host what it provides
2. **Lifecycle** — Host tells the plugin when things happen
3. **Context** — Host gives the plugin controlled access to its state

### 3.2 Plugin Patterns Across Ecosystems

Compare how different systems implement the same pattern:

| System | Registration | Lifecycle | Context | Entry Point |
|--------|-------------|-----------|---------|--------------|
| **pi** | `pi.registerTool()`, `pi.registerCommand()` | `pi.on("session_start", ...)` | `ctx.ui`, `ctx.cwd`, `ctx.signal` | `export default function(pi)` |
| **VS Code** | `context.subscriptions.push(...)`, `vscode.commands.registerCommand()` | `activate()`, `deactivate()` | `vscode.window`, `vscode.workspace` | `export function activate(context)` |
| **Express** | `app.use(middleware)`, `app.get(path, handler)` | `(req, res, next)` per request | `req`, `res`, `next` | `module.exports = function(options)` |
| **Vite** | `plugin.hookName()` in config | `buildStart()`, `transform()`, `buildEnd()` | `this` (PluginContext) | `export default function myPlugin()` |
| **ESLint** | `rule.create(context)` | `context.on("node", handler)` | `context.getSourceCode()` | `module.exports = { rules: {...} }` |

**Key insight:** Once you understand the registration → lifecycle → context pattern, you can learn any plugin system quickly.

### 3.3 The Extension Factory Pattern

This project uses the **factory function** pattern:

```typescript
// index.ts
export default function(pi: ExtensionAPI) {
  // Registration phase
  pi.registerTool({ name: "a2a_call", ... });
  pi.registerCommand("a2a-send", { ... });

  // Lifecycle phase
  pi.on("session_start", async (event, ctx) => {
    // Initialize runtime state
  });

  pi.on("session_shutdown", async () => {
    // Clean up
  });
}
```

**Why a factory function and not a class?**
- Simpler — no `this` binding issues
- Easier to test — pass a mock `ExtensionAPI`
- No side effects on import — the function only runs when the host calls it
- Host controls initialization timing

**Why defer state initialization to `session_start`?**
The factory may run in contexts that never start a session (e.g., `pi --list-models`). Starting servers or opening connections in the factory would waste resources or crash. The `session_start` event guarantees the agent is ready.

**Resources:**

| Topic | Resource |
|-------|----------|
| Plugin architecture in Node.js | [adaltas.com/en/2020/08/28/node-js-plugin-architecture](https://www.adaltas.com/en/2020/08/28/node-js-plugin-architecture/) |
| Modern plugin patterns | [oneuptime.com/blog/post/nodejs-plugin-architecture](https://oneuptime.com/blog/post/nodejs-plugin-architecture/view) |
| Plugin architecture without regrets | [medium.com/@Modexa/plugin-architecture-in-node-js-without-regrets](https://medium.com/@Modexa/plugin-architecture-in-node-js-without-regrets-e02ba78660c7) |
| Library extensibility (SWE) | [softwareengineering.stackexchange.com/questions/154968](https://softwareengineering.stackexchange.com/questions/154968/) |

### 3.4 Global State Management in Extensions

This project uses **module-level state variables** initialized on `session_start`:

```typescript
// Module scope — persists across the session
let a2aClient: A2AClient | null = null;
let a2aServer: A2AServer | null = null;
let configManager: ConfigManager | null = null;

export default function(pi: ExtensionAPI) {
  pi.on("session_start", async () => {
    configManager = new ConfigManager(DEFAULT_CONFIG);
    a2aClient = new A2AClient(configManager.getConfig().client, ...);
  });

  pi.on("session_shutdown", async () => {
    await a2aServer?.stop();
    a2aClient = null;
    configManager = null;
  });
}
```

**Why not a class?** Module scope is simpler for singletons. The extension is loaded once per session — there's never a need for multiple instances.

**Why null checks?** Tools and commands can be called before `session_start` in edge cases. Null checks prevent crashes.

**Alternative patterns:**
- **Closure state:** Wrap everything in the factory function (no module-level variables)
- **Class instance:** `new A2AExtension(pi)` with instance properties
- **WeakMap registry:** If you need multiple instances keyed by session

The module-level pattern is idiomatic for pi extensions because each session gets a fresh module load.

---

## Part 4: Testing Node.js Libraries

*Testing is how you prove your code works. This project uses a three-tier test strategy that maps to three different testing goals.*

### 4.1 The Three-Tier Test Strategy

| Tier | Purpose | When to Write | This Project |
|------|---------|---------------|-------------|
| **Conformance** | Protocol compliance | Before implementing a spec requirement | `tests/a2a-v1-conformance.test.ts` (19 tests, S1–S6b) |
| **Unit** | Code correctness | During and after implementation | `tests/spec-compliance/`, `tests/characterization/` |
| **Integration** | Component interaction | After components are stable | Client-server round-trip tests |

**Why three tiers?**
- Conformance tests are the **source of truth** for spec compliance (CA-7)
- Unit tests catch **regressions** in individual functions
- Integration tests verify **end-to-end behavior** (discovery → send → receive)

### 4.2 Testing with Type Stubs

Since this project uses type stubs instead of the real pi runtime, tests need mocks:

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
  sendUserMessage: vi.fn(),
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
  mode: 'tui',
  hasUI: true,
  signal: undefined,
  sessionManager: {
    getSessionFile: vi.fn(),
    getEntries: vi.fn(() => []),
  },
};

// Call the extension factory with the mock
import extension from '../src/index.js';
extension(mockPi as any);
```

**Why mock instead of the real API?**
- Tests run without pi installed
- Tests are deterministic — no network, no file system, no session state
- Tests are fast — no startup overhead
- Tests can verify registration calls: `expect(mockPi.registerTool).toHaveBeenCalledTimes(2)`

### 4.3 Testing HTTP Servers

For testing the A2A server, use real HTTP on a random port:

```typescript
import { Server } from 'node:http';
import { A2AServer } from '../src/a2a-server.js';

describe("A2A Server", () => {
  let server: A2AServer;
  let baseUrl: string;

  beforeAll(async () => {
    server = new A2AServer({ port: 0, host: "127.0.0.1" });
    await server.start();
    baseUrl = `http://127.0.0.1:${server.port}`;
  });

  afterAll(async () => {
    await server.stop();
  });

  it("returns Agent Card at /.well-known/agent-card", async () => {
    const res = await fetch(`${baseUrl}/.well-known/agent-card`);
    expect(res.status).toBe(200);
    const card = await res.json();
    expect(card.name).toBeDefined();
  });
});
```

**Why real HTTP instead of mocking?**
- Protocol tests need to verify actual HTTP behavior (headers, status codes, SSE framing)
- Random port (`port: 0`) avoids conflicts
- No mocking library to maintain — the test is close to production code

### 4.4 Vitest Configuration

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    globals: true,           // No need to import describe/it/expect
    environment: 'node',     // Node.js environment (not jsdom)
    include: ['tests/**/*.test.ts'],
    testTimeout: 15000,      // A2A tests may need time for streaming
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
      // Mirror tsconfig paths for test resolution
      '@mariozechner/pi-coding-agent': path.resolve(SRC, 'types/pi-runtime.d.ts'),
    }
  }
});
```

**Resources:**

| Topic | Resource |
|-------|----------|
| Vitest documentation | [vitest.dev](https://vitest.dev/) |
| Mocking with Vitest | [vitest.dev/guide/mocking](https://vitest.dev/guide/mocking.html) |
| Testing Node.js HTTP servers | [nodejs.org/api/http.html](https://nodejs.org/api/http.html) (see "http.createServer examples") |
| TDD in practice | [Test Driven Development by Kent Beck](https://www.oreilly.com/library/view/test-driven-development/0321146530/) |

---

## Part 5: CI/CD and Release Workflows

*Continuous integration and delivery ensure every change is tested, built, and published automatically. This is how professional Node.js libraries ship.*

### 5.1 CI Pipeline

```
Push to main / PR
  │
  ├── Lint ──────────► ESLint must pass
  │
  ├── Build ──────────► tsc + tsc -p tsconfig.cjs.json
  │
  ├── Test ───────────► vitest run (matrix: Node 18, 20, 22)
  │
  ├── Conformance ────► vitest run a2a-v1-conformance
  │
  └── Coverage ───────► vitest run --coverage (V8)
```

**GitHub Actions workflow:**

```yaml
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

  conformance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npx vitest run a2a-v1-conformance
```

### 5.2 Release Pipeline

```
Version tag pushed (v0.2.0)
  │
  ├── Test ───────────► All tests pass
  │
  ├── Build ──────────► Clean build
  │
  ├── Publish ────────► npm publish --provenance
  │
  └── GitHub Release ─► Auto-generated release notes
```

```yaml
name: Release
on:
  push:
    tags: ["v*"]

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          registry-url: https://registry.npmjs.org
      - run: npm ci
      - run: npm run build
      - run: npx vitest run
      - run: npm publish --provenance
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
      - uses: softprops/action-gh-release@v2
        with:
          generate_release_notes: true
```

### 5.3 Versioning Strategy

Semantic Versioning (semver) with pre-release phases:

```
MAJOR.MINOR.PATCH[-PRERELEASE]

0.1.0-alpha.1   ← Incomplete features, breaking changes expected
0.2.0-alpha.1   ← Feature-complete for milestone, spec compliance in progress
0.2.0-beta.1    ← All features working, testing edge cases
0.2.0           ← Stable, ready for production
1.0.0           ← A2A v1.0 spec fully compliant, API stable
```

| Change Type | Version Bump | Example |
|-------------|-------------|---------|
| Breaking API change | MAJOR | `1.0.0` → `2.0.0` |
| New feature (non-breaking) | MINOR | `0.2.0` → `0.3.0` |
| Bug fix (non-breaking) | PATCH | `0.2.1` → `0.2.2` |
| Work in progress | PRERELEASE | `0.2.0-alpha.1` → `0.2.0-alpha.2` |

### 5.4 Dual Manifest Synchronization

This project has two manifests that must stay in sync:

| File | Purpose | Must Match |
|------|---------|------------|
| `package.json` | npm package | `version`, `name`, `engines.node` |
| `pi-package.json` | pi extension | `version`, `name`, `compatibility.node`, `commands`, `tools` |

**Sync checklist on every release:**
1. Update `version` in both files
2. Verify `commands` and `tools` in `pi-package.json` match `index.ts` registrations
3. Verify `compatibility.node` matches `engines.node`
4. Update `changes` array in `pi-package.json`
5. Run `npm run build` — both manifests must produce valid output

### 5.5 Distribution Channels

| Channel | Install Command | When to Use |
|---------|---------------|-------------|
| **npm** | `pi install npm:pi-a2a-communication@0.2.0` | Production, version-pinned |
| **Git** | `pi install git:github.com/carlosfrias/pi-a2a-communication@v0.2.0` | Development, custom branches |
| **Local** | `pi install ./path/to/pi-a2a-communication` | Local dev, testing |

**Resources:**

| Topic | Resource |
|-------|----------|
| GitHub Actions for Node.js | [docs.github.com/actions/guides/building-and-testing-nodejs](https://docs.github.com/actions/guides/building-and-testing-nodejs) |
| Publishing npm packages from CI | [docs.github.com/actions/publishing-packages/publishing-nodejs-packages](https://docs.github.com/actions/publishing-packages/publishing-nodejs-packages) |
| npm Trusted Publishers (OIDC) | [docs.npmjs.com/trusted-publishers](https://docs.npmjs.com/trusted-publishers/) |
| semantic-release | [github.com/semantic-release/npm](https://github.com/semantic-release/npm) |
| Keep a Changelog | [keepachangelog.com](https://keepachangelog.com/) |

---

## Part 6: Integration Patterns

*How a Node.js library connects to the outside world — HTTP, JSON-RPC, SSE, webhooks, message queues, and other protocols.*

### 6.1 JSON-RPC 2.0

A2A uses JSON-RPC 2.0 as its transport protocol. Understanding this is essential for this project:

```json
// Request
{
  "jsonrpc": "2.0",
  "method": "message/send",
  "params": {
    "message": { "role": "user", "parts": [{ "type": "text", "text": "Hello" }] }
  },
  "id": 1
}

// Response (success)
{
  "jsonrpc": "2.0",
  "result": { "id": "task-123", "status": { "state": "completed" } },
  "id": 1
}

// Response (error)
{
  "jsonrpc": "2.0",
  "error": { "code": -32601, "message": "Method not found" },
  "id": 1
}
```

**JSON-RPC error codes (must know):**

| Code | Meaning |
|------|---------|
| -32700 | Parse error (invalid JSON) |
| -32600 | Invalid request (missing required field) |
| -32601 | Method not found |
| -32602 | Invalid params |
| -32603 | Internal error |

**Implementation in this project:**
- `a2a-client.ts` sends JSON-RPC requests via HTTP POST
- `a2a-server.ts` receives JSON-RPC requests and routes to method handlers
- Both must validate `jsonrpc: "2.0"`, `method`, `id` fields per the spec

### 6.2 Server-Sent Events (SSE)

SSE is how A2A streams real-time updates:

```
Client → POST /a2a (JSON-RPC: message/stream)
Server → 200 OK
         Content-Type: text/event-stream

         data: {"jsonrpc":"2.0","result":{"id":"task-1","status":{"state":"working"}}}

         data: {"jsonrpc":"2.0","result":{"id":"task-1","status":{"state":"working"},"artifact":[...]}}

         data: {"jsonrpc":"2.0","result":{"id":"task-1","status":{"state":"completed"}}}
```

**SSE format rules:**
- Each event starts with `data: ` followed by JSON on a single line
- Events separated by blank lines (`\n\n`)
- Stream ends when server closes connection or sends final event

**Implementation pattern:**

```typescript
// Server-side SSE
res.writeHead(200, {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
});

for await (const event of taskEvents) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
  if (event.status.state === 'completed') break;
}
res.end();
```

### 6.3 Agent Discovery (Well-Known URI)

A2A agents publish their capabilities at a standard URL:

```
GET /.well-known/agent-card HTTP/1.1
Host: agent.example.com
Accept: application/json
```

The response is an Agent Card JSON describing the agent's name, capabilities, authentication methods, and endpoints.

**Implementation in this project:**
- `agent-discovery.ts` fetches Agent Cards and caches them (TTL: 5 minutes)
- `a2a-server.ts` serves the Agent Card at `/.well-known/agent-card`
- The path must be exactly `/.well-known/agent-card` per the A2A v1.0 spec (not `.json`)

### 6.4 Integration with Other Systems

| Pattern | How It Works | This Project |
|---------|-------------|--------------|
| **REST API** | HTTP + JSON | A2A client/server use standard HTTP + JSON-RPC |
| **SSE streaming** | HTTP + `text/event-stream` | `sendStreamingMessage` for real-time updates |
| **Webhook** | HTTP callback URL | Push notifications when tasks complete |
| **Message queue** | Async task processing | `TaskManager` supports fire-and-forget tasks |
| **MCP coexistence** | A2A for agents, MCP for tools | pi uses A2A for remote agents, MCP for local tools |

**A2A vs MCP (when to use which):**

| | A2A | MCP |
|--|-----|-----|
| **Purpose** | Agent ↔ Agent delegation | Agent ↔ Tool integration |
| **Analogy** | Colleagues delegating work | Worker using a tool |
| **This project** | ✅ What we implement | ❌ Not our scope |
| **Together** | pi → A2A → remote agent → MCP → database ||

**Resources:**

| Topic | Resource |
|-------|----------|
| JSON-RPC 2.0 specification | [jsonrpc.org/specification](https://www.jsonrpc.org/specification) |
| Server-Sent Events (MDN) | [developer.mozilla.org/docs/Web/API/Server-sent_events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events) |
| A2A v1.0 Specification | [a2a-protocol.org/v1.0.0/specification](https://a2a-protocol.org/v1.0.0/specification/) |
| A2A vs MCP vs ACP | [tyk.io/learning-center/agent-protocols](https://tyk.io/learning-center/agent-protocols-a-complete-guide-to-mcp-a2a-and-acp/) |

---

## Part 7: pi Extensions — An Application of Node.js Patterns

*Now that you understand Node.js, TypeScript, plugin architecture, testing, CI/CD, and integration patterns, pi extensions are a specific application of all these concepts. This section maps what you've learned to pi's API.*

### 7.1 pi Extension API Mapped to Universal Patterns

| Universal Pattern | pi Implementation | You Already Know |
|-------------------|-------------------|-----------------|
| **Registration** | `pi.registerTool()`, `pi.registerCommand()` | Same as Express `app.use()`, Vite `plugin.hook()` |
| **Lifecycle** | `pi.on("session_start", ...)`, `pi.on("session_shutdown", ...)` | Same as Express middleware chain, VS Code `activate()`/`deactivate()` |
| **Context** | `ctx.ui`, `ctx.cwd`, `ctx.signal`, `ctx.sessionManager` | Same as Express `req`/`res`, VS Code `context` |
| **Factory function** | `export default function(pi: ExtensionAPI)` | Same as Express `module.exports = function(options)` |
| **Type stubs** | `types/pi-runtime.d.ts` | Same as `@types/express` — type declarations decoupled from runtime |
| **Dual build** | ESM + CJS in `dist/` | Standard Node.js library pattern |
| **Testing with mocks** | `vi.fn()` for `ExtensionAPI` | Standard Vitest mocking |

**The key insight:** If you understand Express middleware, you understand pi extensions. The names change, the pattern doesn't.

### 7.2 pi-Specific Concepts

These are the parts that are unique to pi, not universal Node.js patterns:

| Concept | What It Does | When You Need It |
|---------|-------------|-----------------|
| `ctx.ui.notify()` | Show notification in TUI | Status messages, completion alerts |
| `ctx.ui.confirm()` | Ask user yes/no question | Dangerous operations (block `rm -rf`) |
| `ctx.ui.select()` | Present choices to user | Multi-option commands |
| `ctx.signal` | AbortSignal for cancellation | Long-running network calls |
| `ctx.sessionManager` | Access session state | Reading conversation history |
| `pi.sendUserMessage()` | Inject message into session | A2A responses flowing back to the agent |
| `pi.sendMessage()` | Send custom message type | Internal extension communication |

**Full pi extension docs:** `/usr/local/lib/node_modules/@earendil-works/pi-coding-agent/docs/extensions.md`

**Full pi SDK docs:** `/usr/local/lib/node_modules/@earendil-works/pi-coding-agent/docs/sdk.md`

**Full pi package docs:** `/usr/local/lib/node_modules/@earendil-works/pi-coding-agent/docs/packages.md`

### 7.3 pi Package Distribution

```bash
# Install from git (pinned to tag)
pi install git:github.com/carlosfrias/pi-a2a-communication@v0.2.0

# Install from npm (version-pinned)
pi install npm:pi-a2a-communication@0.2.0

# Install from local path (development)
pi install ./path/to/pi-a2a-communication

# Try without installing (temporary)
pi -e git:github.com/carlosfrias/pi-a2a-communication

# List installed packages
pi list

# Update all packages
pi update --all
```

**Where packages go:**
- npm: `~/.pi/agent/npm/pi-a2a-communication/`
- git: `~/.pi/agent/git/github.com/carlosfrias/pi-a2a-communication/`
- local: wherever you point it

**pi package manifest (`pi-package.json`):**

```json
{
  "name": "pi-a2a-communication",
  "version": "0.2.0-alpha.1",
  "category": "communication",
  "tags": ["a2a", "multi-agent", "distributed", "communication", "pi-extension"],
  "compatibility": { "pi": ">=1.0.0", "node": ">=18.0.0" },
  "commands": ["/a2a-discover", "/a2a-send", "..."],
  "tools": ["a2a_call", "a2a_parallel"]
}
```

---

## Part 8: A2A Protocol — A Node.js Application

*The A2A protocol is a concrete application of everything in Parts 1-6: HTTP server, JSON-RPC, SSE, module architecture, testing, and deployment. Understanding the protocol deepens your Node.js expertise because it exercises every pattern.*

### 8.1 Protocol Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    A2A Protocol Stack                            │
├─────────────────────────────────────────────────────────────────┤
│ Application Layer   │ Task lifecycle, Agent Cards, Push Notifs  │
├─────────────────────┼───────────────────────────────────────────┤
│ RPC Layer           │ JSON-RPC 2.0 (method routing, errors)    │
├─────────────────────┼───────────────────────────────────────────┤
│ Transport Layer     │ HTTP POST (sync) + SSE (streaming)        │
├─────────────────────┼───────────────────────────────────────────┤
│ Discovery Layer     │ GET /.well-known/agent-card               │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 Source Code Mapped to Node.js Concepts

| File | Lines | Node.js Concepts Used |
|------|-------|----------------------|
| `a2a-server.ts` | 1159 | `node:http` server, request routing, SSE streaming, JSON parsing, async handlers |
| `a2a-client.ts` | 718 | `fetch()` API, AbortController, async iterators (SSE), retry logic |
| `agent-discovery.ts` | 390 | `fetch()`, JSON parsing, cache with TTL, URL resolution |
| `task-manager.ts` | 400 | Async state machines, `Map` for task tracking, AbortSignal propagation |
| `config.ts` | 333 | `node:fs` for JSON persistence, `node:path` for file resolution |
| `types.ts` | 497 | TypeScript discriminated unions, type guards, JSON-RPC schema |
| `index.ts` | 744 | Extension factory pattern, event registration, tool/command registration |

### 8.3 Learning Path: Read the Code

| Step | What to Read | Focus On |
|------|-------------|----------|
| 1 | `types.ts` | TypeScript discriminated unions, JSON-RPC schema, A2A task states |
| 2 | `config.ts` | `node:fs` JSON persistence, config validation |
| 3 | `agent-discovery.ts` | `fetch()`, caching, URL resolution |
| 4 | `a2a-client.ts` | HTTP client, retry logic, AbortController, SSE parsing |
| 5 | `a2a-server.ts` | `node:http` server, request routing, JSON-RPC dispatch, SSE response |
| 6 | `task-manager.ts` | Async state machines, `Map`-based task tracking |
| 7 | `index.ts` | Extension factory, registration, lifecycle management |

**Resources:**

| Topic | Resource |
|-------|----------|
| A2A v1.0 Spec (authoritative) | [a2a-protocol.org/v1.0.0/specification](https://a2a-protocol.org/v1.0.0/specification/) |
| Google A2A repo | [github.com/google/A2A](https://github.com/google/A2A) |
| A2A Python SDK (reference) | [github.com/a2aproject/a2a-python](https://github.com/a2aproject/a2a-python) |
| Google Codelab (hands-on) | [codelabs.developers.google.com/intro-a2a-purchasing-concierge](https://codelabs.developers.google.com/intro-a2a-purchasing-concierge) |

---

## Part 9: Real-World Deployment Case Studies

*These case studies show how the patterns from Parts 1-6 are applied in production. Each maps to specific Node.js concepts you've already learned.*

### Case Study 1: Individual Developer (Local Agent)

**Scenario:** A developer installs the extension on their laptop to call remote A2A agents.

**Node.js concepts exercised:** Module loading (Part 1.1), package installation (Part 5.5), factory function (Part 3.3).

```bash
pi install git:github.com/carlosfrias/pi-a2a-communication
# → Pi clones repo → runs npm install → loads index.ts via jiti → registers 10 commands + 2 tools
```

**What happens at each layer:**
1. **Module system:** pi uses jiti to load `index.ts` (ESM, no build step needed for development)
2. **Factory pattern:** pi calls `export default function(pi)` with the real `ExtensionAPI`
3. **Registration:** Extension registers tools and commands
4. **Lifecycle:** `session_start` initializes A2A client, `session_shutdown` cleans up

### Case Study 2: Fleet Deployment (Multi-Node)

**Scenario:** 7 pi agents across different machines, each running the A2A server, discovering each other.

**Node.js concepts exercised:** HTTP server (Part 1.3), async handling (Part 1.2), caching (Part 8.2).

```
Machine A (pi + A2A server :10000)
  → /a2a-discover http://machine-b:10000  → Gets Agent Card
  → /a2a-send machine-b "Analyze this"   → JSON-RPC POST → Response
  → /a2a-broadcast "Review code"          → Parallel JSON-RPC to machines B, C, D
```

**What happens at each layer:**
1. **HTTP server:** `a2a-server.ts` creates a `node:http` server on port 10000
2. **Discovery:** `agent-discovery.ts` fetches `/.well-known/agent-card` from each machine
3. **Client:** `a2a-client.ts` sends JSON-RPC POST requests
4. **Task management:** `task-manager.ts` orchestrates parallel requests with `Promise.allSettled()`

### Case Study 3: Enterprise Gateway

**Scenario:** An A2A gateway provides TLS, auth, rate limiting, and agent registry. This package is the client.

**Node.js concepts exercised:** HTTPS (Part 1.3), authentication (Part 6.1), error handling (Part 1.2).

```
pi Agent → HTTPS/JSON-RPC → A2A Gateway (pi-a2a-gateway)
                                  ↓
                           ┌─────────┐
                           │ Auth     │ (OAuth2/mTLS)
                           │ Rate Lim │ (per-tenant quotas)
                           │ Registry │ (Agent Card catalog)
                           └─────────┘
                                  ↓
                           Remote Agents
```

**What the gateway provides (separate project):**
- TLS termination (`node:https` or reverse proxy)
- OAuth2 token validation
- Rate limiting (per-tenant)
- Agent registry (persistent catalog)
- Health monitoring

**What this package provides (client side):**
- Bearer token / API key / OAuth2 / mTLS authentication
- Retry with exponential backoff
- Request timeout handling
- Agent discovery with caching

### Case Study 4: CI/CD Pipeline Integration

**Scenario:** Automated pipeline uses the pi SDK to embed A2A capabilities.

**Node.js concepts exercised:** SDK embedding (Part 7.2), programmatic tool use, session management.

```typescript
import { createAgentSession, DefaultResourceLoader, SessionManager }
  from "@earendil-works/pi-coding-agent";

const loader = new DefaultResourceLoader({
  additionalExtensionPaths: ["/opt/pi-extensions/pi-a2a-communication"],
});
await loader.reload();

const { session } = await createAgentSession({
  resourceLoader: loader,
  sessionManager: SessionManager.inMemory(),
});

// CI/CD: security scan → code review → deploy
await session.prompt(`
  Use a2a_parallel to run security scans, then a2a_call for code review.
`);
```

### Case Study 5: A2A + MCP Combined Architecture

**Scenario:** A pi agent uses MCP for local tools and A2A for remote agents simultaneously.

```
┌────────────────────────────────────────────────┐
│                pi Agent                        │
│                                                │
│  ┌──────────────┐    ┌──────────────────────┐  │
│  │  MCP Tools   │    │  A2A Extension        │  │
│  │  (local)     │    │  (remote agents)     │  │
│  │              │    │                      │  │
│  │ - Database   │    │ - Research Agent     │  │
│  │ - File System│    │ - Code Review Agent  │  │
│  │ - Git        │    │ - Deployment Agent   │  │
│  │ - Browser    │    │ - Analytics Agent    │  │
│  └──────────────┘    └──────────────────────┘  │
└────────────────────────────────────────────────┘
```

**Node.js concepts exercised:** Multiple transport protocols coexisting (Part 6), async event handling (Part 1.2), tool registration (Part 3.1).

### Case Study 6: Multi-Tenant SaaS

**Scenario:** A shared A2A gateway serves multiple organizations, each with their own agents and auth.

**Node.js concepts exercised:** Per-tenant configuration (Part 2.1 type stubs → per-tenant config objects), authentication (Part 6.1), isolation.

```jsonc
// ~/.pi/agent/a2a/config.json (Organization A)
{
  "security": {
    "defaultScheme": "oauth2",
    "oauth2Config": {
      "tokenUrl": "https://auth.org-a.example.com/oauth2/token",
      "clientId": "org-a-pi-agent"
    }
  }
}
```

**Enterprise A2A resources:**
| Resource | What It Covers |
|----------|---------------|
| [AWS A2A Gateway Sample](https://github.com/aws-samples/sample-a2a-gateway) | Serverless gateway, 3-layer architecture |
| [Azure A2A Apps](https://techcommunity.microsoft.com/blog/appsonazureblog/building-agent-to-agent-a2a-applications-on-azure-app-service/4433114) | Azure App Service deployment |
| [Kubernetes Deployment](https://stacka2a.dev/blog/a2a-kubernetes-deployment-guide) | K8s deployment, scaling, service mesh |
| [Enterprise A2A Guide](https://xenoss.io/blog/agent2agent-a2a-protocol-enterprise-guide) | Security, scaling, multi-tenant patterns |

---


## Part 10: Hands-On Labs

*Step-by-step labs you can follow to build expertise from Node.js fundamentals through pi extensions to A2A deployment. Each lab produces a working deliverable. Do them in order — each builds on the previous.*

---

### Lab 1: Dual-Output TypeScript Library (Node.js Foundations)

**Time:** 4-6 hours | **Deliverable:** A working dual-output TypeScript library

#### Step 1: Create project structure

```bash
mkdir ~/labs/ts-dual-lib && cd ~/labs/ts-dual-lib
npm init -y
npm install -D typescript vitest @types/node
```

#### Step 2: Write source code

Create `src/index.ts`:

```typescript
// src/index.ts
export function greet(name: string): string {
  return `Hello, ${name}!`;
}

export function farewell(name: string): string {
  return `Goodbye, ${name}!`;
}

export interface GreetingOptions {
  name: string;
  formal?: boolean;
}

export function greetWithOptions(options: GreetingOptions): string {
  return options.formal ? `Dear ${options.name}` : `Hey ${options.name}`;
}
```

#### Step 3: Configure TypeScript (ESM)

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

#### Step 4: Configure TypeScript (CJS fallback)

Create `tsconfig.cjs.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "Node",
    "outDir": "./dist/cjs"
  },
  "include": ["src/**/*.ts"]
}
```

#### Step 5: Configure package.json

Update `package.json`:

```json
{
  "name": "ts-dual-lib",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist/**/*", "README.md", "LICENSE"],
  "scripts": {
    "build": "tsc && npm run build:cjs",
    "build:cjs": "tsc -p tsconfig.cjs.json && mv dist/cjs/index.js dist/index.cjs",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

#### Step 6: Build and verify

```bash
npm run build

# Verify both outputs exist
ls -la dist/index.js      # ESM
ls -la dist/index.cjs     # CJS
ls -la dist/index.d.ts   # Types

# Test ESM import
node -e "import('./dist/index.js').then(m => console.log(m.greet('World')))"

# Test CJS require
node -e "const m = require('./dist/index.cjs'); console.log(m.greet('World'))"
```

#### Step 7: Verify the concepts you just learned

Answer these questions before moving on:

1. Why does `tsconfig.json` use `"module": "NodeNext"` but `tsconfig.cjs.json` uses `"module": "CommonJS"`?
2. Why must source imports include `.js` extensions with NodeNext?
3. What happens if a CJS consumer tries to `import()` your ESM output? (They get a promise — this is fine.)
4. What happens if an ESM consumer tries to `require()` your CJS output? (It won't — Node.js throws.)

**✅ Checkpoint:** Both `node -e` commands above should print `Hello, World!`

---

### Lab 2: JSON-RPC Server (HTTP & Async)

**Time:** 3-4 hours | **Deliverable:** A working JSON-RPC 2.0 server with SSE streaming

#### Step 1: Create server project

```bash
mkdir ~/labs/json-rpc-server && cd ~/labs/json-rpc-server
npm init -y
npm install -D typescript @types/node vitest
tsc --init
```

#### Step 2: Implement JSON-RPC types

Create `src/types.ts`:

```typescript
// src/types.ts
export interface JsonRpcRequest {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown>;
  id?: string | number | null;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
  id: string | number | null;
}

export interface JsonRpcMethod {
  name: string;
  handler: (params: Record<string, unknown>) => Promise<unknown>;
}

// Standard JSON-RPC error codes
export const PARSE_ERROR = -32700;
export const INVALID_REQUEST = -32600;
export const METHOD_NOT_FOUND = -32601;
export const INVALID_PARAMS = -32602;
export const INTERNAL_ERROR = -32603;
```

#### Step 3: Implement the server

Create `src/server.ts`:

```typescript
// src/server.ts
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import {
  JsonRpcRequest, JsonRpcResponse, JsonRpcMethod,
  PARSE_ERROR, INVALID_REQUEST, METHOD_NOT_FOUND, INTERNAL_ERROR
} from "./types.js";

export class RpcServer {
  private methods = new Map<string, JsonRpcMethod["handler"]>();

  /** Register a method handler */
  registerMethod(name: string, handler: JsonRpcMethod["handler"]): void {
    this.methods.set(name, handler);
  }

  /** Start the server on the given port (0 = random) */
  start(port: number = 0): Promise<{ server: import("node:http").Server; port: number }> {
    return new Promise((resolve) => {
      const server = createServer((req, res) => this.handleRequest(req, res));
      server.listen(port, () => {
        const addr = server.address();
        const actualPort = addr && typeof addr === "object" ? addr.port : port;
        resolve({ server, port: actualPort });
      });
    });
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // Only accept POST to /rpc
    if (req.method !== "POST" || req.url !== "/rpc") {
      res.writeHead(404).end("Not found");
      return;
    }

    let body: string;
    try {
      body = await this.readBody(req);
    } catch {
      this.sendError(res, null, PARSE_ERROR, "Parse error");
      return;
    }

    let request: JsonRpcRequest;
    try {
      request = JSON.parse(body);
    } catch {
      this.sendError(res, null, PARSE_ERROR, "Parse error");
      return;
    }

    // Validate request
    if (request.jsonrpc !== "2.0") {
      this.sendError(res, request.id ?? null, INVALID_REQUEST, "Invalid request");
      return;
    }

    // Find method
    const handler = this.methods.get(request.method);
    if (!handler) {
      this.sendError(res, request.id ?? null, METHOD_NOT_FOUND, `Method not found: ${request.method}`);
      return;
    }

    // Execute method
    try {
      const result = await handler(request.params ?? {});
      const response: JsonRpcResponse = { jsonrpc: "2.0", result, id: request.id ?? null };
      res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(response));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Internal error";
      this.sendError(res, request.id ?? null, INTERNAL_ERROR, message);
    }
  }

  private readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let data = "";
      req.on("data", (chunk) => { data += chunk; });
      req.on("end", () => resolve(data));
      req.on("error", reject);
    });
  }

  private sendError(res: ServerResponse, id: string | number | null, code: number, message: string): void {
    const response: JsonRpcResponse = { jsonrpc: "2.0", error: { code, message }, id };
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(response));
  }
}
```

#### Step 4: Add SSE streaming

Create `src/stream.ts`:

```typescript
// src/stream.ts
import { ServerResponse } from "node:http";

/** Send Server-Sent Events to the client */
export function startSSE(
  res: ServerResponse,
  events: AsyncIterable<Record<string, unknown>>,
  signal?: AbortSignal
): void {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  (async () => {
    for await (const event of events) {
      if (signal?.aborted) break;
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
    res.end();
  })();
}
```

#### Step 5: Write tests

Create `tests/server.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RpcServer } from "../src/server.js";

describe("RpcServer", () => {
  let server: RpcServer;
  let port: number;
  let baseUrl: string;

  beforeAll(async () => {
    server = new RpcServer();
    server.registerMethod("echo", async (params) => params);
    server.registerMethod("add", async (params) => {
      const { a, b } = params as { a: number; b: number };
      return a + b;
    });
    const result = await server.start(0);
    port = result.port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    // Server cleanup (close HTTP server)
  });

  it("should echo params", async () => {
    const res = await fetch(`${baseUrl}/rpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", method: "echo", params: { hello: "world" }, id: 1,
      }),
    });
    const data = await res.json();
    expect(data.result).toEqual({ hello: "world" });
  });

  it("should add two numbers", async () => {
    const res = await fetch(`${baseUrl}/rpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", method: "add", params: { a: 3, b: 4 }, id: 2,
      }),
    });
    const data = await res.json();
    expect(data.result).toBe(7);
  });

  it("should return METHOD_NOT_FOUND for unknown method", async () => {
    const res = await fetch(`${baseUrl}/rpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", method: "nonexistent", id: 3,
      }),
    });
    const data = await res.json();
    expect(data.error.code).toBe(-32601);
  });

  it("should return PARSE_ERROR for invalid JSON", async () => {
    const res = await fetch(`${baseUrl}/rpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    const data = await res.json();
    expect(data.error.code).toBe(-32700);
  });
});
```

#### Step 6: Run tests

```bash
npm run build
npx vitest run
```

**✅ Checkpoint:** All 4 tests pass. You've built a JSON-RPC 2.0 server from scratch using only Node.js built-ins.

#### Step 7: Verify the concepts you just learned

1. Why does the server use `port: 0` in tests? (Random port — avoids conflicts.)
2. What happens if two requests arrive simultaneously? (Node.js event loop handles them concurrently via async.)
3. How would you add authentication? (Middleware before `handleRequest`, check `Authorization` header.)
4. How would you add SSE streaming for long-running tasks? (Add a `/stream` route, use `startSSE`.)

---

### Lab 3: Plugin Architecture (Factory + Type Stubs)

**Time:** 3-4 hours | **Deliverable:** A library with factory function entry point and type stubs

#### Step 1: Create project

```bash
mkdir ~/labs/plugin-arch && cd ~/labs/plugin-arch
npm init -y
npm install -D typescript vitest @types/node
tsc --init
```

#### Step 2: Create type stubs for a hypothetical host

Create `types/host-runtime.d.ts`:

```typescript
// types/host-runtime.d.ts
// Type stubs — the host provides the real implementation at runtime.
// This allows development and testing without the host installed.

export interface HostAPI {
  on(event: string, handler: (...args: unknown[]) => unknown): void;
  registerCapability(name: string, definition: CapabilityDefinition): void;
  sendMessage(message: string): void;
}

export interface HostContext {
  ui: {
    notify(message: string, level: "info" | "warn" | "error"): void;
    confirm(title: string, message: string): Promise<boolean>;
  };
  cwd: string;
  signal?: AbortSignal;
}

export interface CapabilityDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (params: Record<string, unknown>, context: HostContext) => Promise<CapabilityResult>;
}

export interface CapabilityResult {
  content: Array<{ type: string; text: string }>;
  details: Record<string, unknown>;
}
```

#### Step 3: Configure tsconfig.json with type stub paths

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "baseUrl": ".",
    "paths": {
      "@mylib/host-runtime": ["./types/host-runtime.d.ts"]
    }
  },
  "include": ["src/**/*.ts", "types/**/*.ts"]
}
```

#### Step 4: Implement the extension using type stubs

Create `src/index.ts`:

```typescript
// src/index.ts
import type { HostAPI, HostContext, CapabilityResult } from "@mylib/host-runtime";

// Module-level state — initialized on startup, cleaned up on shutdown
let db: Map<string, string> | null = null;

export default function initialize(host: HostAPI) {
  console.log("[mylib] Extension factory called");

  // Lifecycle: initialize on startup
  host.on("startup", async (_event, _ctx) => {
    db = new Map();
    console.log("[mylib] Database initialized");
  });

  // Lifecycle: cleanup on shutdown
  host.on("shutdown", async () => {
    db = null;
    console.log("[mylib] Database cleaned up");
  });

  // Register capability
  host.registerCapability("store", {
    name: "store",
    description: "Store and retrieve key-value pairs",
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["get", "set", "delete"] },
        key: { type: "string" },
        value: { type: "string" },
      },
    },
    async execute(params, ctx: HostContext): Promise<CapabilityResult> {
      if (!db) throw new Error("Not initialized");

      const { action, key, value } = params as { action: string; key: string; value?: string };

      switch (action) {
        case "get": {
          const result = db.get(key);
          if (result === undefined) {
            ctx.ui.notify(`Key not found: ${key}`, "warn");
            return { content: [{ type: "text", text: `Key not found: ${key}` }], details: {} };
          }
          return { content: [{ type: "text", text: result }], details: {} };
        }
        case "set": {
          db.set(key, value!);
          ctx.ui.notify(`Stored: ${key}`, "info");
          return { content: [{ type: "text", text: `Stored: ${key} = ${value}` }], details: {} };
        }
        case "delete": {
          db.delete(key);
          return { content: [{ type: "text", text: `Deleted: ${key}` }], details: {} };
        }
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    },
  });
}
```

#### Step 5: Write tests with mock host

Create `tests/index.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import initialize from "../src/index.js";
import type { HostAPI, HostContext } from "../types/host-runtime.d.ts";

describe("plugin-arch extension", () => {
  let mockHost: HostAPI;
  let events: Record<string, (...args: unknown[]) => unknown>;
  let capabilities: Record<string, { execute: (params: Record<string, unknown>, ctx: HostContext) => Promise<unknown> }>;
  let mockCtx: HostContext;

  beforeEach(() => {
    events = {};
    capabilities = {};

    mockHost = {
      on: vi.fn((event: string, handler: (...args: unknown[]) => unknown) => {
        events[event] = handler;
      }),
      registerCapability: vi.fn((name: string, def: unknown) => {
        capabilities[name] = def as typeof capabilities[string];
      }),
      sendMessage: vi.fn(),
    };

    mockCtx = {
      ui: { notify: vi.fn(), confirm: vi.fn() },
      cwd: "/tmp/test",
    };

    // Initialize the extension
    initialize(mockHost);
  });

  it("should register startup and shutdown handlers", () => {
    expect(events["startup"]).toBeDefined();
    expect(events["shutdown"]).toBeDefined();
  });

  it("should register the store capability", () => {
    expect(capabilities["store"]).toBeDefined();
    expect(capabilities["store"].name).toBe("store");
  });

  it("should store and retrieve values", async () => {
    // Simulate startup to initialize the database
    await events["startup"]({}, mockCtx);

    // Store a value
    const setResult = await capabilities["store"].execute(
      { action: "set", key: "hello", value: "world" },
      mockCtx
    );
    expect(setResult.content[0].text).toBe("Stored: hello = world");

    // Retrieve the value
    const getResult = await capabilities["store"].execute(
      { action: "get", key: "hello" },
      mockCtx
    );
    expect(getResult.content[0].text).toBe("world");
  });

  it("should handle key not found", async () => {
    await events["startup"]({}, mockCtx);

    const result = await capabilities["store"].execute(
      { action: "get", key: "nonexistent" },
      mockCtx
    );
    expect(result.content[0].text).toBe("Key not found: nonexistent");
    expect(mockCtx.ui.notify).toHaveBeenCalledWith("Key not found: nonexistent", "warn");
  });

  it("should throw if not initialized", async () => {
    // Don't call startup — database is null
    await expect(
      capabilities["store"].execute({ action: "get", key: "test" }, mockCtx)
    ).rejects.toThrow("Not initialized");
  });

  it("should clean up on shutdown", async () => {
    await events["startup"]({}, mockCtx);
    await capabilities["store"].execute(
      { action: "set", key: "hello", value: "world" },
      mockCtx
    );

    await events["shutdown"]({}, mockCtx);

    // After shutdown, store should throw because db is null
    await expect(
      capabilities["store"].execute({ action: "get", key: "hello" }, mockCtx)
    ).rejects.toThrow("Not initialized");
  });
});
```

#### Step 6: Configure Vitest with alias

Create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@mylib/host-runtime": path.resolve(__dirname, "types/host-runtime.d.ts"),
    },
  },
});
```

#### Step 7: Run tests

```bash
npm run build
npx vitest run
```

**✅ Checkpoint:** All 5 tests pass. You've built a plugin with factory function, type stubs, lifecycle management, and mock-based testing.

#### Step 8: Verify the concepts

1. Why is `db` initialized in the `startup` handler, not the factory function? (The factory may run before a session starts — deferring initialization avoids crashes.)
2. Why use type stubs instead of installing the real host? (Decoupling — tests run without the host, no version lockstep.)
3. How would you add a second capability (e.g., `search`) without modifying the factory? (Just add another `host.registerCapability()` call.)
4. What happens if `startup` is called twice? (The Map is re-created — previous data is lost. How would you make it idempotent?)

---

### Lab 4: Testing, Coverage & CI (Quality)

**Time:** 3-4 hours | **Deliverable:** A library with >80% coverage and CI pipeline

#### Step 1: Add coverage to your Lab 3 project

```bash
cd ~/labs/plugin-arch
```

Update `vitest.config.ts`:

```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: ["tests/**", "dist/**", "types/**"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
      },
    },
  },
  resolve: {
    alias: {
      "@mylib/host-runtime": path.resolve(__dirname, "types/host-runtime.d.ts"),
    },
  },
});
```

#### Step 2: Run coverage

```bash
npx vitest run --coverage
```

If coverage is below 80%, add more tests for uncovered branches (error cases, edge cases).

#### Step 3: Set up GitHub Actions CI

Create `.github/workflows/ci.yml`:

```yaml
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
```

#### Step 4: Push to GitHub and verify CI passes

```bash
git init
git add .
git commit -m "Initial commit with CI"
git remote add origin https://github.com/YOUR_USERNAME/plugin-arch.git
git push -u origin main

# Check: https://github.com/YOUR_USERNAME/plugin-arch/actions
```

**✅ Checkpoint:** CI pipeline runs on Node 18, 20, 22. Coverage >80%.

---

### Lab 5: Build, Release & Distribution

**Time:** 2-3 hours | **Deliverable:** A published npm package with automated releases

#### Step 1: Finalize package.json for publishing

```bash
cd ~/labs/plugin-arch
```

Update `package.json`:

```json
{
  "name": "plugin-arch-lab",
  "version": "0.1.0",
  "description": "Lab: Plugin architecture with factory function and type stubs",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist/**/*", "README.md", "LICENSE"],
  "keywords": ["plugin", "extension", "architecture", "lab"],
  "license": "MIT",
  "repository": "https://github.com/YOUR_USERNAME/plugin-arch",
  "scripts": {
    "build": "tsc && npm run build:cjs",
    "build:cjs": "tsc -p tsconfig.cjs.json && mv dist/cjs/index.js dist/index.cjs",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint . --ext .ts",
    "prepublishOnly": "npm run build && npm test"
  }
}
```

#### Step 2: Create CHANGELOG.md

```markdown
# Changelog

## [0.1.0] - 2026-06-19

### Added
- Initial release
- Factory function pattern with type stubs
- Store capability (get, set, delete)
- Startup/shutdown lifecycle
- Unit tests with mock host
- CI pipeline (Node 18, 20, 22)
- Coverage thresholds (>80%)
```

#### Step 3: Dry-run publish

```bash
npm run build
npm publish --dry-run
```

Verify the tarball includes only `dist/`, `README.md`, and `LICENSE`.

#### Step 4: Create release workflow

Create `.github/workflows/release.yml`:

```yaml
name: Release
on:
  push:
    tags: ["v*"]

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          registry-url: https://registry.npmjs.org
      - run: npm ci
      - run: npm run build
      - run: npx vitest run
      - run: npm publish --provenance
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

#### Step 5: Tag and release

```bash
npm version patch  # 0.1.0 → 0.1.1
git push origin main --tags
# This triggers the release workflow
```

**✅ Checkpoint:** Package published to npm. `npm view plugin-arch-lab` shows correct version.

---

### Lab 6: pi Extension — Hello World

**Time:** 1-2 hours | **Deliverable:** A working pi extension that registers a tool and a command

> **Now you apply Node.js patterns to pi.** The factory function, type stubs, lifecycle management, and testing patterns are all the same — just a different host API.

#### Step 1: Create the extension

```bash
mkdir -p ~/.pi/agent/extensions/hello-lab
cd ~/.pi/agent/extensions/hello-lab
```

Create `index.ts`:

```typescript
// ~/.pi/agent/extensions/hello-lab/index.ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

// Module-level state (same pattern as Lab 3)
let callCount = 0;

export default function (pi: ExtensionAPI) {
  // Lifecycle: initialize on session start (same pattern as Lab 3's startup handler)
  pi.on("session_start", async (_event, ctx) => {
    callCount = 0;
    ctx.ui.notify("Hello Lab extension loaded!", "info");
  });

  // Lifecycle: cleanup on shutdown (same pattern as Lab 3's shutdown handler)
  pi.on("session_shutdown", async () => {
    callCount = 0;
  });

  // Register a tool the LLM can call (same pattern as Lab 3's registerCapability)
  pi.registerTool({
    name: "hello_lab",
    label: "Hello Lab",
    description: "Say hello with a custom greeting",
    parameters: Type.Object({
      name: Type.String({ description: "Name to greet" }),
      style: Type.Optional(Type.String({ description: "Greeting style", default: "casual" })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      callCount++;
      const style = params.style ?? "casual";
      const greeting = style === "formal" ? `Dear ${params.name}` : `Hey ${params.name}`;
      ctx.ui.notify(`Greeting #${callCount}: ${greeting}`, "info");
      return {
        content: [{ type: "text", text: greeting }],
        details: { callCount, style },
      };
    },
  });

  // Register a slash command (pi-specific — not in Lab 3's generic host)
  pi.registerCommand("hello-lab", {
    description: "Say hello from the lab extension",
    handler: async (args, ctx) => {
      const name = args || "world";
      ctx.ui.notify(`Hello, ${name}! (called ${callCount} times)`, "info");
    },
  });
}
```

#### Step 2: Test it in pi

```bash
# Start pi with the extension
pi -e ~/.pi/agent/extensions/hello-lab/index.ts
```

In the pi session:
```
> /hello-lab Carlos
→ Hello, Carlos! (called 0 times)

> Ask the agent: "Use the hello_lab tool to greet Alice formally"
→ (Agent calls hello_lab tool with {name: "Alice", style: "formal"})
→ Dear Alice

> /hello-lab
→ Hello, world! (called 1 times)
```

#### Step 3: Write tests with mock ExtensionAPI

This is the **exact same pattern as Lab 3** — mock the host API.

Create `tests/hello-lab.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the pi types (same as Lab 3's mock host pattern)
interface MockExtensionAPI {
  on: ReturnType<typeof vi.fn>;
  registerTool: ReturnType<typeof vi.fn>;
  registerCommand: ReturnType<typeof vi.fn>;
}

describe("hello-lab extension", () => {
  let mockPi: MockExtensionAPI;
  let events: Record<string, (...args: unknown[]) => unknown>;
  let tools: Record<string, { execute: (...args: unknown[]) => Promise<unknown> }>;
  let commands: Record<string, { handler: (...args: unknown[]) => Promise<void> }>;

  beforeEach(() => {
    events = {};
    tools = {};
    commands = {};

    mockPi = {
      on: vi.fn((event: string, handler: (...args: unknown[]) => unknown) => {
        events[event] = handler;
      }),
      registerTool: vi.fn((def: Record<string, unknown>) => {
        tools[def.name as string] = def as typeof tools[string];
      }),
      registerCommand: vi.fn((name: string, def: Record<string, unknown>) => {
        commands[name] = def as typeof commands[string];
      }),
    };

    // Import and initialize the extension
    // (In a real test, you'd import from the built output)
  });

  it("should register session_start and session_shutdown handlers", () => {
    // After importing the extension:
    // extension(mockPi as any);
    expect(events["session_start"]).toBeDefined();
    expect(events["session_shutdown"]).toBeDefined();
  });

  it("should register the hello_lab tool", () => {
    // After importing:
    // extension(mockPi as any);
    expect(tools["hello_lab"]).toBeDefined();
  });

  it("should register the hello-lab command", () => {
    // After importing:
    // extension(mockPi as any);
    expect(commands["hello-lab"]).toBeDefined();
  });

  // The key insight: this test structure is IDENTICAL to Lab 3
  // Only the mock API names changed: HostAPI → ExtensionAPI
  // The pattern is: mock → call factory → assert registrations
});
```

**✅ Checkpoint:** The extension loads in pi, the tool works, and the command works. Tests follow the same pattern as Lab 3.

#### Step 4: Verify the pattern connection

Compare Lab 3 and Lab 6 side by side:

| Concept | Lab 3 (Generic Host) | Lab 6 (pi Extension) |
|---------|---------------------|----------------------|
| Entry point | `export default function(host: HostAPI)` | `export default function(pi: ExtensionAPI)` |
| Registration | `host.registerCapability()` | `pi.registerTool()` / `pi.registerCommand()` |
| Lifecycle | `host.on("startup")` / `host.on("shutdown")` | `pi.on("session_start")` / `pi.on("session_shutdown")` |
| Context | `ctx.ui`, `ctx.cwd` | Same |
| Mock pattern | `vi.fn()` for each method | Same |
| Type stubs | `types/host-runtime.d.ts` | `types/pi-runtime.d.ts` |

**The only difference is the API names. The pattern is the same.**

---

### Lab 7: pi Extension — A2A-Inspired (Multi-Tool + HTTP Server)

**Time:** 4-6 hours | **Deliverable:** A pi extension that mimics core A2A patterns (discovery, send, status)

> This lab bridges the gap between Labs 1-5 (Node.js fundamentals) and the real A2A extension. You'll build a simplified version of the A2A patterns using only Node.js built-ins.

#### Step 1: Create the extension

```bash
mkdir -p ~/.pi/agent/extensions/a2a-lab
cd ~/.pi/agent/extensions/a2a-lab
```

Create `index.ts`:

```typescript
// ~/.pi/agent/extensions/a2a-lab/index.ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { createServer, IncomingMessage, ServerResponse } from "node:http";

// ─── Module state (same pattern as Labs 3 & 6) ───
let agentRegistry = new Map<string, { url: string; name: string; description: string }>();
let taskCounter = 0;
let httpServer: import("node:http").Server | null = null;

// ─── JSON-RPC handler (built in Lab 2) ───
function handleJsonRpc(req: IncomingMessage, res: ServerResponse): void {
  // Simplified — Lab 2 has the full implementation
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ jsonrpc: "2.0", result: { status: "working" }, id: 1 }));
}

// ─── Extension factory ───
export default function (pi: ExtensionAPI) {
  // Lifecycle (same pattern as Labs 3 & 6)
  pi.on("session_start", async (_event, ctx) => {
    agentRegistry.clear();
    taskCounter = 0;
    ctx.ui.notify("A2A Lab extension loaded", "info");
  });

  pi.on("session_shutdown", async () => {
    httpServer?.close();
    httpServer = null;
    agentRegistry.clear();
  });

  // ─── Tool: a2a_lab_discover ───
  pi.registerTool({
    name: "a2a_lab_discover",
    label: "A2A Lab Discover",
    description: "Discover an A2A agent at a URL and register it",
    parameters: Type.Object({
      url: Type.String({ description: "URL of the A2A agent" }),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        // Fetch Agent Card (built in Lab 2 concepts — HTTP GET + JSON parse)
        const response = await fetch(`${params.url}/.well-known/agent-card`);
        if (!response.ok) {
          return { content: [{ type: "text", text: `Failed to discover agent: ${response.status}` }], details: {} };
        }
        const card = await response.json();
        agentRegistry.set(params.url, { url: params.url, name: card.name, description: card.description });
        return { content: [{ type: "text", text: `Discovered: ${card.name} — ${card.description}` }], details: card };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }], details: {} };
      }
    },
  });

  // ─── Tool: a2a_lab_send ───
  pi.registerTool({
    name: "a2a_lab_send",
    label: "A2A Lab Send",
    description: "Send a message to a discovered A2A agent",
    parameters: Type.Object({
      agent_url: Type.String({ description: "URL of the discovered agent" }),
      message: Type.String({ description: "Message to send" }),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      taskCounter++;
      const taskId = `task-${taskCounter}`;
      try {
        // Send JSON-RPC request (built in Lab 2)
        const response = await fetch(`${params.agent_url}/rpc`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "message/send",
            params: { message: { role: "user", parts: [{ type: "text", text: params.message }] } },
            id: taskId,
          }),
        });
        const data = await response.json();
        ctx.ui.notify(`Task ${taskId} sent`, "info");
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }], details: { taskId } };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }], details: { taskId } };
      }
    },
  });

  // ─── Command: /a2a-lab ───
  pi.registerCommand("a2a-lab", {
    description: "List discovered A2A agents",
    handler: async (_args, ctx) => {
      if (agentRegistry.size === 0) {
        ctx.ui.notify("No agents discovered yet", "info");
        return;
      }
      const agents = Array.from(agentRegistry.values())
        .map((a) => `  ${a.name}: ${a.url}`)
        .join("\n");
      ctx.ui.notify(`Discovered agents:\n${agents}`, "info");
    },
  });

  // ─── Command: /a2a-lab-server ───
  pi.registerCommand("a2a-lab-server", {
    description: "Start or stop the local A2A server",
    handler: async (args, ctx) => {
      if (args === "stop") {
        httpServer?.close();
        httpServer = null;
        ctx.ui.notify("A2A server stopped", "info");
        return;
      }
      // Start server (Lab 2 concepts — createServer, listen on port)
      httpServer = createServer((req, res) => handleJsonRpc(req, res));
      httpServer.listen(10099, () => {
        ctx.ui.notify("A2A server started on port 10099", "info");
      });
    },
  });
}
```

#### Step 2: Test it in pi

```bash
pi -e ~/.pi/agent/extensions/a2a-lab/index.ts
```

In the pi session:
```
> /a2a-lab
→ No agents discovered yet

> Ask: "Use a2a_lab_discover to find the agent at http://localhost:10099"
→ (Agent discovers... or reports error if server not running)

> /a2a-lab-server start
→ A2A server started on port 10099

> Ask: "Use a2a_lab_discover to find the agent at http://localhost:10099"
→ Discovered: pi-a2a-lab-agent — Local A2A Lab Agent

> /a2a-lab
→ Discovered agents:
  pi-a2a-lab-agent: http://localhost:10099

> /a2a-lab-server stop
→ A2A server stopped
```

**✅ Checkpoint:** You've built a pi extension that implements A2A discovery, message sending, and a local server — all using Node.js built-ins (Lab 2 concepts) and the plugin pattern (Labs 3 & 6).

#### Step 3: Trace the concept lineage

Every concept in this lab maps back to earlier labs:

| Concept in Lab 7 | Origin |
|-------------------|--------|
| `createServer` from `node:http` | Lab 2: JSON-RPC server |
| `fetch()` for Agent Card | Lab 2: HTTP client |
| `JSON.stringify` / `JSON.parse` | Lab 2: JSON-RPC parsing |
| Factory function `export default function(pi)` | Lab 3: Plugin architecture |
| Type stubs for `ExtensionAPI` | Lab 3: Host decoupling |
| Module-level state (`agentRegistry`, `taskCounter`) | Lab 3: Global state pattern |
| `pi.on("session_start")` / `pi.on("session_shutdown")` | Lab 3: Lifecycle hooks |
| `pi.registerTool()` / `pi.registerCommand()` | Lab 3: Registration API |
| `try/catch` with error messages | Lab 1: Async error handling |
| `taskCounter++` for unique IDs | Lab 1: Node.js built-ins |

---

### Lab 8: A2A Protocol — End-to-End

**Time:** 4-6 hours | **Deliverable:** Two pi agents communicating via A2A

#### Step 1: Install the real A2A extension

```bash
pi install git:github.com/carlosfrias/pi-a2a-communication
```

#### Step 2: Start Agent A (server)

Terminal 1:
```bash
pi
```

In the pi session:
```
> /a2a-server start 10000
→ A2A server started on port 10000

> /a2a-discover http://localhost:10000
→ Discovered: pi-a2a-agent
```

#### Step 3: Connect from Agent B (client)

Terminal 2:
```bash
pi
```

In the pi session:
```
> /a2a-discover http://localhost:10000
→ Discovered: pi-a2a-agent

> /a2a-send pi-a2a-agent "What capabilities do you have?"
→ Task submitted. Status: completed
→ Result: [Agent A responds]
```

#### Step 4: Verify the round-trip

1. Check Agent A's session — it should show the incoming A2A request
2. Check Agent B's session — it should show the response
3. Check `/a2a-agents` on both — both should show the discovered agent

#### Step 5: Run the conformance tests

```bash
cd ~/workshop/02-Areas/Infrastructure/pi-a2a-communication
npx vitest run a2a-v1-conformance
```

Review the test output. Each test maps to the JSON-RPC concepts you built in Lab 2:
- S1: Agent Card path = your Lab 2 discovery endpoint
- S2: JSON-RPC methods = your Lab 2 method routing
- S3: Task lifecycle = your Lab 2 async patterns
- S4: Streaming = your Lab 2 SSE implementation

**✅ Checkpoint:** Two pi agents communicating via A2A. Conformance tests pass.

---

### Lab 9: Production Deployment

**Time:** 2-3 hours | **Deliverable:** A deployed A2A setup with authentication

#### Step 1: Configure authentication

```bash
# In pi session
/a2a-config security.defaultScheme bearer
/a2a-config security.bearerToken "your-secret-token-here"
```

#### Step 2: Start with TLS (if you have certs)

```bash
# Or use a reverse proxy (nginx/caddy) for TLS termination
/a2a-server start 10000
```

#### Step 3: Test with curl

```bash
# Discover agent
curl http://localhost:10000/.well-known/agent-card

# Send a message
curl -X POST http://localhost:10000/a2a \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-secret-token-here" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "params": {
      "message": { "role": "user", "parts": [{ "type": "text", "text": "Hello" }] }
    },
    "id": 1
  }'
```

#### Step 4: Study the AWS A2A Gateway architecture

Read [github.com/aws-samples/sample-a2a-gateway](https://github.com/aws-samples/sample-a2a-gateway).

Understand how each layer maps to Node.js concepts:

| Gateway Layer | Node.js Concept | Lab Origin |
|---------------|----------------|-----------|
| Management Layer | HTTP middleware | Lab 2 |
| Control Layer | JSON-RPC routing | Lab 2 |
| Data Layer | SSE streaming | Lab 2 |
| Authentication | `Authorization` header parsing | Lab 9 |
| Agent Registry | `Map<string, AgentCard>` | Lab 7 |

**✅ Checkpoint:** A2A server running with authentication. You can curl it and get responses.

---

### Lab 10: Capstone — Contribute to pi-a2a-communication

**Time:** Ongoing | **Deliverable:** A merged PR to this project

#### Step 1: Find a conformance gap

```bash
cd ~/workshop/02-Areas/Infrastructure/pi-a2a-communication
npx vitest run a2a-v1-conformance
```

Review the test output. Find a failing or missing test.

#### Step 2: Write a failing test (TDD per CA-5)

In `tests/a2a-v1-conformance.test.ts` or `tests/spec-compliance/`, write a test for the gap:

```typescript
it("should [spec requirement]", async () => {
  // Arrange
  const request = { jsonrpc: "2.0", method: "...", params: {...}, id: 1 };

  // Act
  const response = await fetch(`${baseUrl}/a2a`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  const data = await response.json();

  // Assert
  expect(data).toMatchObject({ jsonrpc: "2.0", ... });
});
```

#### Step 3: Implement the minimum code to pass

Edit `src/a2a-server.ts` or `src/types.ts` to make the test pass.

#### Step 4: Run the full conformance suite

```bash
npx vitest run a2a-v1-conformance
```

All tests must pass — your change must not break existing compliance.

#### Step 5: Submit a PR

```bash
git checkout -b fix/S7-your-spec-gap
git add .
git commit -m "fix: [spec gap description] (S7)"
git push origin fix/S7-your-spec-gap
# Open PR on GitHub
```

**✅ Checkpoint:** You've contributed to an open-source project using every pattern from Labs 1-9.

---

### Ongoing: Deepen Expertise

| Activity | Frequency | Resource |
|----------|-----------|----------|
| Read one pi extension example | Weekly | `/usr/local/lib/node_modules/@earendil-works/pi-coding-agent/examples/extensions/` |
| Read source of one production plugin system | Monthly | VS Code, Vite, or ESLint |
| Study the A2A spec change log | Quarterly | [github.com/google/A2A](https://github.com/google/A2A) |
| Complete one more Lab | As time allows | Pick from Labs 1-10 based on weak areas |
| Contribute to this project | Ongoing | `tests/a2a-v1-conformance.test.ts` is the source of truth |
