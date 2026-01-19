import type { Tool } from "@anthropic-ai/sdk/resources/messages";

/**
 * ATOMIC Agent Tools for Document Editing
 *
 * Philosophy: Tools are the smallest possible operations.
 * The LLM reasons about complex tasks and breaks them into atomic calls.
 * No assumptions, no magic - just simple primitives.
 */

export const AGENT_TOOLS: Tool[] = [
  // ===== TEXT OPERATIONS =====
  {
    name: "set_element_text",
    description: "Set the text content of an element. Replaces ALL text in the element with the new text.",
    input_schema: {
      type: "object" as const,
      properties: {
        elementId: {
          type: "string",
          description: "The data-canon-id of the element",
        },
        text: {
          type: "string",
          description: "The new text content for the element",
        },
      },
      required: ["elementId", "text"],
    },
  },

  // ===== VISUAL OPERATIONS =====
  {
    name: "redact_element",
    description: "Black out an element completely. The text becomes unreadable.",
    input_schema: {
      type: "object" as const,
      properties: {
        elementId: {
          type: "string",
          description: "The data-canon-id of the element to redact",
        },
      },
      required: ["elementId"],
    },
  },
  {
    name: "highlight_element",
    description: "Add yellow highlight background to an element.",
    input_schema: {
      type: "object" as const,
      properties: {
        elementId: {
          type: "string",
          description: "The data-canon-id of the element to highlight",
        },
      },
      required: ["elementId"],
    },
  },

  // ===== ANNOTATION OPERATIONS =====
  {
    name: "add_comment",
    description: "Attach a sticky note to an element. The comment text is what the user will see.",
    input_schema: {
      type: "object" as const,
      properties: {
        elementId: {
          type: "string",
          description: "The data-canon-id of the element to annotate",
        },
        text: {
          type: "string",
          description: "The note content. Use the element's actual content if user says 'summarize' or any other instruction related to the content of the element. Use user's exact words if they specify (e.g., 'review later').",
        },
      },
      required: ["elementId", "text"],
    },
  },

  // ===== STRUCTURAL OPERATIONS =====
  {
    name: "delete_element",
    description: "Remove an element from the document entirely.",
    input_schema: {
      type: "object" as const,
      properties: {
        elementId: {
          type: "string",
          description: "The data-canon-id of the element to delete",
        },
      },
      required: ["elementId"],
    },
  },

  // ===== DOCUMENT SCANNING =====
  {
    name: "scan_document",
    description: `Find elements in the document matching a criteria. Returns element IDs and their text.

Use this when you need to find elements before operating on them:
- "redact all phone numbers" → scan for phone numbers, then redact each
- "highlight dates" → scan for dates, then highlight each
- "find text containing X" → scan for X`,
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "What to find. E.g., 'phone numbers', 'email addresses', 'text containing French', 'dates'",
        },
      },
      required: ["query"],
    },
  },
];

// Type for operation returned by agent
export interface AgentOperation {
  id: string;
  tool: string;
  input: Record<string, unknown>;
}

// Type for tool input schemas
export interface SetElementTextInput {
  elementId: string;
  text: string;
}

export interface RedactElementInput {
  elementId: string;
}

export interface HighlightElementInput {
  elementId: string;
}

export interface AddCommentInput {
  elementId: string;
  text: string;
}

export interface DeleteElementInput {
  elementId: string;
}

export interface ScanDocumentInput {
  query: string;
}
