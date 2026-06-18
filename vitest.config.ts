import { defineConfig } from 'vitest/config';
import path from 'node:path';

const SRC = __dirname;

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
      include: ['*.ts'],
      exclude: ['tests/**', 'dist/**', 'types/**']
    }
  },
  resolve: {
    conditions: ['node'],
    alias: {
      // pi runtime type stubs
      '@mariozechner/pi-coding-agent': path.resolve(SRC, 'types/pi-runtime.d.ts'),
      '@mariozechner/pi-ai': path.resolve(SRC, 'types/pi-runtime.d.ts'),
      '@mariozechner/pi-tui': path.resolve(SRC, 'types/pi-runtime.d.ts'),
      '@mariozechner/pi-agent-core': path.resolve(SRC, 'types/pi-runtime.d.ts'),
      '@sinclair/typebox': path.resolve(SRC, 'node_modules/@sinclair/typebox/index.js'),
    }
  }
});