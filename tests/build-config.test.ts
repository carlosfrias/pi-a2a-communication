/**
 * Build-config invariant tests (RULE 2 — TDD guard for the prod-install build fix).
 *
 * Why this exists: `pi install` runs `npm install --omit=dev` then `prepare: npm
 * run build` (tsc). If the build tools (typescript, @types/node) are in
 * devDependencies, they're stripped under --omit=dev and the build fails (TS2688)
 * — silently breaking pi install/relaunch. These tests pin the invariant so a
 * careless move back to devDependencies is caught immediately.
 *
 * Per pi docs (extensions.md L149 / packages.md L168): runtime/build deps for a
 * pi package MUST be in `dependencies` because prod install omits devDependencies.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, "..");
const readJson = (p: string) => JSON.parse(readFileSync(join(pkgRoot, p), "utf-8"));

describe("prod-install build invariants (RULE 2)", () => {
  const pkg = readJson("package.json");

  it("typescript is in dependencies (survives --omit=dev for the prepare build)", () => {
    expect(pkg.dependencies?.typescript).toBeTruthy();
  });

  it("@types/node is in dependencies (tsc needs node types at build time)", () => {
    expect(pkg.dependencies?.["@types/node"]).toBeTruthy();
  });

  it("does NOT also list typescript/@types/node in devDependencies (single source)", () => {
    expect(pkg.devDependencies?.typescript).toBeFalsy();
    expect(pkg.devDependencies?.["@types/node"]).toBeFalsy();
  });

  it("test/lint tooling stays in devDependencies (not needed at install)", () => {
    expect(pkg.devDependencies?.vitest).toBeTruthy();
    expect(pkg.devDependencies?.eslint).toBeTruthy();
  });

  it("prepare builds (so dist is regenerated on install)", () => {
    expect(pkg.scripts?.prepare).toMatch(/build/);
  });

  it("pi extension points at the built dist (not src)", () => {
    expect(pkg.pi?.extensions).toContain("./dist/index.js");
  });

  it("tsconfig.json has no deprecated baseUrl (paths resolve relative to tsconfig dir)", () => {
    const ts = readJson("tsconfig.json");
    expect(ts.compilerOptions?.baseUrl).toBeUndefined();
    expect(ts.compilerOptions?.paths?.["@mariozechner/pi-coding-agent"]).toBeTruthy();
  });

  it("tsconfig.cjs.json has no deprecated baseUrl", () => {
    const ts = readJson("tsconfig.cjs.json");
    expect(ts.compilerOptions?.baseUrl).toBeUndefined();
    expect(ts.compilerOptions?.paths?.["@mariozechner/pi-coding-agent"]).toBeTruthy();
  });

  it("dist/ and node_modules/ are gitignored (RULE 26 — never committed)", () => {
    const gi = readFileSync(join(pkgRoot, ".gitignore"), "utf-8");
    expect(gi).toMatch(/^dist\/$/m);
    expect(gi).toMatch(/^node_modules\/$/m);
  });
});