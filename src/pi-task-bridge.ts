/**
 * PiTaskBridge — Interface for connecting A2A server to pi task execution
 *
 * The PiTaskBridge interface defines how the A2A server delegates incoming
 * task messages to actual execution backends. The default NoOpPiTaskBridge
 * returns placeholder responses, maintaining backward compatibility with
 * the original executePiTask() stub.
 *
 * M10: Replaces the hardcoded placeholder in a2a-server.ts with an
 * injectable interface that supports real pi subagent integration.
 */

/**
 * Interface for task execution backends.
 * 
 * Implementations:
 * - NoOpPiTaskBridge: Returns placeholder (default, backward compatible)
 * - SubprocessPiTaskBridge: Invokes pi CLI (M10.3)
 * - Custom: Register via A2AServer.registerTaskHandler()
 */
export interface PiTaskBridge {
  /**
   * Execute a task synchronously and return the result string.
   * @param message The text content extracted from the A2A message
   * @returns The result text to send back as the task response
   */
  executeTask(message: string): Promise<string>;

  /**
   * Execute a task with progress callbacks for streaming updates.
   * @param message The text content extracted from the A2A message
   * @param onProgress Callback for progress updates during execution
   * @returns The final result text
   */
  executeTaskWithProgress(
    message: string,
    onProgress: (progress: string) => void
  ): Promise<string>;
}

/**
 * NoOpPiTaskBridge — Returns placeholder responses.
 * 
 * This is the default bridge when no real execution backend is configured.
 * It preserves the exact behavior of the original executePiTask() stub
 * for backward compatibility.
 */
export class NoOpPiTaskBridge implements PiTaskBridge {
  async executeTask(message: string): Promise<string> {
    return `[A2A Task Result]\n\nMessage received: ${message}\n\nThis is a placeholder response from the NoOp bridge. Replace with a real PiTaskBridge implementation.`;
  }

  async executeTaskWithProgress(
    message: string,
    onProgress: (progress: string) => void
  ): Promise<string> {
    onProgress("Analyzing request...");
    onProgress("Processing task...");
    return this.executeTask(message);
  }
}