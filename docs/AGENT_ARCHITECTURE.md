# Canon AI Agent Architecture

## Overview

Canon uses Claude Opus 4.5 with tool calling in an **agentic loop** to enable natural language document editing. The agent receives user instructions, reasons step-by-step, and calls **atomic tools** one element at a time. For bulk operations, it first uses `scan_document` (powered by Haiku) to find matching elements, then operates on each one atomically.

## Philosophy: Atomic Tools

Tools should be atomic operations on **SINGLE elements**. The LLM reasons about complex tasks and breaks them down into multiple atomic tool calls. No regex, no bulk operations in tools.

For "redact all numbers": LLM calls `scan_document` to find elements with numbers, then calls `redact_element` for EACH one.

## Architecture Flow

```
User Instruction + Context (selection or full doc text + HTML)
        ↓
    /api/agent (Claude Opus 4.5 - Streaming SSE)
        ↓
    Agent reasons out loud, calls scan_document if needed
        ↓
    scan_document executes via Haiku (finds matching elements)
        ↓
    Tool results returned to agent for continued reasoning
        ↓
    Agent calls atomic tools (redact_element, etc.) one by one
        ↓
    Operations returned as JSON
        ↓
    Client executes operations via postMessage
        ↓
    Results logged to Change Ledger
```

## Key Design Decisions

### Client-Side Execution

The full HTML document never leaves the client. This keeps:
- Network payload small (~1-2KB requests/responses)
- Server stateless
- Execution instant (no round-trip for DOM manipulation)

### Context Strategy

**With selection**: Pass element ID, text content, tag name
**Without selection**: Pass full document text (truncated to 8000 chars)

The agent receives just enough context to make intelligent decisions without overwhelming token usage.

## File Structure

```
lib/agent/
├── index.ts         # Module exports
├── tools.ts         # Tool definitions (7 tools)
├── context.ts       # Context extraction & prompt building
└── executor.ts      # Client-side operation execution

app/api/agent/
└── route.ts         # API endpoint (Claude SDK integration)
```

## Available Tools

### Atomic Element Operations

| Tool | Description | Required Params |
|------|-------------|-----------------|
| `replace_text` | Replace text in a SINGLE element | elementId, oldText, newText |
| `redact_element` | Black out a SINGLE element | elementId |
| `add_highlight` | Add yellow highlight to a SINGLE element | elementId |
| `add_comment` | Add annotation to a SINGLE element | elementId, comment |
| `delete_element` | Remove a SINGLE element | elementId |

### Document Scanning (for bulk operations)

| Tool | Description | Required Params |
|------|-------------|-----------------|
| `scan_document` | Find elements matching criteria (uses Haiku) | query |

**Important**: For bulk operations, always call `scan_document` first, then call atomic tools for each returned element.

## API Contract

### Request
```typescript
POST /api/agent
{
  instruction: string;       // User's natural language command
  context: {
    selectedElement?: {
      id: string;
      textContent: string;
      tagName: string;
    };
    documentText?: string;   // Full doc text if no selection
  }
}
```

### Response
```typescript
{
  success: boolean;
  operations: Array<{
    id: string;
    tool: string;
    input: Record<string, unknown>;
  }>;
  explanation: string;       // Agent's reasoning
  stopReason: string;        // "tool_use" or "end_turn"
}
```

## Operation Execution

Operations execute via postMessage to the iframe:

```typescript
// Parent sends operation
iframe.contentWindow.postMessage({
  type: "canon-execute-operation",
  operation: { id, tool, input }
}, "*");

// Iframe executes and responds
window.parent.postMessage({
  type: "canon-operation-result",
  operationId: string,
  success: boolean,
  result?: unknown,
  error?: string
}, "*");
```

## Iframe Message Handlers

The iframe script handles these operation types:

- **replace_text**: Finds element by `data-canon-id`, replaces text content
- **redact_element**: Applies redaction styling, stores original text
- **find_and_replace_all**: Tree walker replaces all matching text nodes
- **redact_all_matching**: Tree walker redacts all matching text
- **add_highlight**: Wraps element in highlight span
- **add_comment**: Adds comment marker with data attribute
- **delete_element**: Removes element from DOM

## System Prompt

The agent operates with these rules:

1. Use tools to make changes - don't just describe what to do
2. Reference "this" or "selected" uses the selected element
3. For bulk operations, use find_and_replace_all or redact_all_matching
4. Be precise - only modify what the user asks for
5. Explain actions briefly

## Cost Considerations

- **Model**: Claude Opus 4.5 (`claude-opus-4-5-20250514`)
- **Max tokens**: 2048 per request
- **Context**: ~500-8000 tokens depending on selection state

Typical request cost: ~$0.01-0.05 depending on context size

## Error Handling

- API errors return `{ success: false, error: string }`
- Operation execution errors captured per-operation
- Failed operations don't block subsequent operations
- All errors displayed in Command Capsule UI

## Integration Points



### Command Capsule
- Shows loading state during API call
- Displays proposed operations before apply
- Shows agent explanation
- Error display with retry option

### Change Ledger
- Logs all applied operations
- Maps tool names to change types
- Records page number and timestamp

### PDF Viewer
- Exposes `getIframeRef()` for context extraction
- Handles all operation message types
- Maintains `data-canon-id` attributes for targeting
