/**
 * bridge-options — pure mapping from A2A {@link BridgeConfig} to
 * {@link SubprocessBridgeOptions}.
 *
 * Extracted from `index.ts` (Phase EXEC Tier A) so the config→bridge wiring is
 * unit-testable without importing the extension entry point (which has
 * session_start side effects). `index.ts` now calls this helper.
 *
 * Opt-in / non-fleet safe: every fleet execution-shaping flag is passed through
 * ONLY when set on the config; undefined stays undefined so the subprocess
 * bridge omits the corresponding `pi --print` flag and non-fleet installs keep
 * the original `pi --print --no-session <msg>` behaviour.
 */
import type { BridgeConfig } from "./types.js";
import type { SubprocessBridgeOptions } from "./pi-task-bridge.js";

/**
 * Build {@link SubprocessBridgeOptions} from a {@link BridgeConfig}.
 *
 * @param config - the bridge section of the A2A config (may be partial)
 * @returns options suitable for `new SubprocessPiTaskBridge(opts)`
 */
export function buildBridgeOptions(config: BridgeConfig): SubprocessBridgeOptions {
  return {
    command: config.command || "pi",
    timeout: config.timeout ?? 120000,
    // Opt-in: pass through only when configured (undefined -> safe default).
    provider: config.provider,
    model: config.model,
    tools: config.tools,
    noExtensions: config.noExtensions ?? false,
    // Phase EXEC Tier A — executor-role steering (opt-in).
    systemPrompt: config.systemPrompt,
    appendSystemPrompt: config.appendSystemPrompt,
    maxConcurrent: config.maxConcurrent,
    maxBufferBytes: config.maxBufferBytes,
    // Phase EXEC Tier B — narration-detection guard (opt-in).
    narrationGuardEnabled: config.narrationGuardEnabled,
    narrationMaxRetries: config.narrationMaxRetries,
    // Phase EXEC Option B — OLLAMA_KEEP_ALIVE for the regular subprocess bridge.
    // Maps config.ollamaKeepAlive to env.OLLAMA_KEEP_ALIVE in the spawned child.
    // Without this, OLLAMA_KEEP_ALIVE defaults to 0 (unload after each response),
    // causing ~89s cold starts and "Connection error" failures on every new task.
    ollamaKeepAlive: config.ollamaKeepAlive,
  };
}
