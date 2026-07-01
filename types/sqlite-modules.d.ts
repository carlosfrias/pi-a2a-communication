// Ambient declarations for optional SQLite drivers used by task-ledger.ts.
// Both are loaded via dynamic import() inside try/catch fallbacks, so they
// are optional at runtime. Declaring them here lets `tsc` resolve the module
// specifiers without requiring the packages (or Node 22.5+ with node:sqlite)
// to be present at build time.

declare module "node:sqlite" {
  export class DatabaseSync {
    constructor(location: string);
    exec(sql: string): void;
    prepare(sql: string): SqliteStatement;
    close(): void;
  }
  export class SqliteStatement {
    all(...params: unknown[]): Record<string, unknown>[];
    get(...params: unknown[]): Record<string, unknown> | undefined;
    run(...params: unknown[]): { changes: number; lastInsertRowid: number };
  }
}

declare module "better-sqlite3" {
  // better-sqlite3's default export is the Database constructor; its API
  // surface mirrors node:sqlite's DatabaseSync closely enough for our usage.
  const Database: new (location: string) => {
    exec(sql: string): void;
    prepare(sql: string): {
      all(...params: unknown[]): Record<string, unknown>[];
      get(...params: unknown[]): Record<string, unknown> | undefined;
      run(...params: unknown[]): { changes: number; lastInsertRowid: number };
    };
    close(): void;
  };
  export default Database;
}