"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var config_1 = require("vitest/config");
var node_path_1 = require("node:path");
var SRC = __dirname;
exports.default = (0, config_1.defineConfig)({
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
            // pi runtime type stubs
            '@mariozechner/pi-coding-agent': node_path_1.default.resolve(SRC, 'types/pi-runtime.d.ts'),
            '@mariozechner/pi-ai': node_path_1.default.resolve(SRC, 'types/pi-runtime.d.ts'),
            '@mariozechner/pi-tui': node_path_1.default.resolve(SRC, 'types/pi-runtime.d.ts'),
            '@mariozechner/pi-agent-core': node_path_1.default.resolve(SRC, 'types/pi-runtime.d.ts'),
            '@sinclair/typebox': node_path_1.default.resolve(SRC, 'node_modules/@sinclair/typebox/index.js'),
        }
    }
});
