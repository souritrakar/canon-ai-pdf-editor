"use client";

import type { AgentOperation } from "./tools";

/**
 * Result of executing an operation
 */
export interface ExecutionResult {
  success: boolean;
  operationId: string;
  tool: string;
  result?: Record<string, unknown>;
  error?: string;
}

/**
 * Execute a single operation via postMessage to the iframe
 */
export async function executeOperation(
  operation: AgentOperation,
  iframeRef: React.RefObject<HTMLIFrameElement | null>
): Promise<ExecutionResult> {
  console.log("[Executor] Executing operation:", operation);

  const iframe = iframeRef.current;
  const contentWindow = iframe?.contentWindow;

  console.log("[Executor] iframe:", iframe, "contentWindow:", contentWindow);

  if (!contentWindow) {
    console.log("[Executor] No content window!");
    return {
      success: false,
      operationId: operation.id,
      tool: operation.tool,
      error: "Iframe not available",
    };
  }

  return new Promise((resolve) => {
    console.log("[Executor] Sending postMessage to iframe for operation:", operation.id);

    const timeout = setTimeout(() => {
      console.log("[Executor] Operation timed out:", operation.id);
      window.removeEventListener("message", handler);
      resolve({
        success: false,
        operationId: operation.id,
        tool: operation.tool,
        error: "Operation timed out",
      });
    }, 10000); // 10 second timeout

    const handler = (event: MessageEvent): void => {
      if (event.data?.type === "canon-operation-result") {
        console.log("[Executor] Received result for:", event.data.operationId, "expected:", operation.id);
      }
      if (
        event.data?.type === "canon-operation-result" &&
        event.data.operationId === operation.id
      ) {
        console.log("[Executor] Operation result:", event.data);
        clearTimeout(timeout);
        window.removeEventListener("message", handler);
        resolve({
          success: event.data.success,
          operationId: operation.id,
          tool: operation.tool,
          result: event.data.result,
          error: event.data.error,
        });
      }
    };

    window.addEventListener("message", handler);

    // Send operation to iframe for execution
    contentWindow.postMessage(
      {
        type: "canon-execute-operation",
        operation,
      },
      "*"
    );
  });
}

/**
 * Execute multiple operations sequentially
 */
export async function executeOperations(
  operations: AgentOperation[],
  iframeRef: React.RefObject<HTMLIFrameElement | null>
): Promise<ExecutionResult[]> {
  console.log("[Executor] executeOperations called with", operations.length, "operations");
  const results: ExecutionResult[] = [];

  for (const op of operations) {
    console.log("[Executor] Processing operation", results.length + 1, "of", operations.length);
    const result = await executeOperation(op, iframeRef);
    results.push(result);

    // Continue even on failures - don't stop
    if (!result.success) {
      console.log("[Executor] Operation failed:", result.error, "but continuing...");
    }
  }

  console.log("[Executor] Completed all operations. Results:", results.length);
  return results;
}

/**
 * Format operation for display in UI
 */
export function formatOperationDescription(operation: AgentOperation): string {
  const { tool, input } = operation;

  switch (tool) {
    case "set_element_text":
      return `Set text to "${input.text}"`;
    case "redact_element":
      return `Redact element`;
    case "highlight_element":
      return `Highlight element`;
    case "add_comment":
      return `Add comment: "${input.text}"`;
    case "delete_element":
      return `Delete element`;
    default:
      return `${tool}`;
  }
}
