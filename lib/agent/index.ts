// Agent module exports
export { AGENT_TOOLS, type AgentOperation } from "./tools";
export type {
  SetElementTextInput,
  RedactElementInput,
  HighlightElementInput,
  AddCommentInput,
  DeleteElementInput,
  ScanDocumentInput,
} from "./tools";

export {
  extractContext,
  buildUserMessage,
  buildSystemPrompt,
  type AgentContext,
} from "./context";

export {
  executeOperation,
  executeOperations,
  formatOperationDescription,
  type ExecutionResult,
} from "./executor";
