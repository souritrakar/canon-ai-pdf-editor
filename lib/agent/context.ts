import type { SelectedElement } from "@/components/editor/pdf-viewer";

/**
 * Message in conversation history
 */
export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Coordinate data for an element (page-relative)
 */
export interface ElementCoords {
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
}

/**
 * Page dimension info
 */
export interface PageInfo {
  pageNum: number;
  width: number;
  height: number;
}

/**
 * Context types for the agent
 */
export interface AgentContext {
  selectedElement?: {
    id: string;
    textContent: string;
    tagName: string;
    coords?: ElementCoords;
  };
  // Full HTML for scan_document tool - contains all text and element IDs
  documentHtml?: string;
  // Conversation history for multi-turn context
  conversationHistory?: ConversationMessage[];
  // Page dimensions for spatial context
  pageInfo?: PageInfo[];
}

/**
 * Extract context from the current editor state.
 *
 * Strategy:
 * - Always include documentHtml for scan_document tool
 * - If element selected, include that info too
 */
export function extractContext(
  selectedElement: SelectedElement | null,
  iframeRef: React.RefObject<HTMLIFrameElement | null> | null
): AgentContext {
  const iframeDoc = iframeRef?.current?.contentDocument;

  // Always get the full HTML for scan_document operations
  let documentHtml: string | undefined;
  if (iframeDoc) {
    // First check if IDs have been assigned
    let elementsWithId = iframeDoc.querySelectorAll('[data-canon-id]');
    console.log(`[Context] Elements with data-canon-id in DOM: ${elementsWithId.length}`);

    // If no IDs found, manually assign them now
    if (elementsWithId.length === 0) {
      console.log(`[Context] No IDs found, manually assigning...`);

      // Strategy: Only assign IDs to LEAF elements (innermost text containers)
      // This avoids duplicate matches for parent/child with same text
      const SELECTABLE_SELECTORS = '.t, .c, span, [class*="ff"], [class*="fc"], [class*="fs"], [class*="ls"], [class*="ws"]';
      const selectorElements = iframeDoc.querySelectorAll(SELECTABLE_SELECTORS);
      const leafElements = new Set<Element>();

      // Only add elements that are "leaf" text containers
      // A leaf element has direct text content AND no child elements with text
      selectorElements.forEach((el) => {
        const hasDirectText = Array.from(el.childNodes).some((node) =>
          node.nodeType === 3 && node.textContent && node.textContent.trim().length > 0
        );

        // Check if any child elements also have text (making this a parent, not leaf)
        const hasChildWithText = Array.from(el.querySelectorAll('*')).some((child) =>
          child.textContent && child.textContent.trim().length > 0 &&
          Array.from(child.childNodes).some(n => n.nodeType === 3 && n.textContent && n.textContent.trim().length > 0)
        );

        // Only add if this element has direct text OR is the innermost container
        if (hasDirectText && !hasChildWithText) {
          leafElements.add(el);
        } else if (!hasChildWithText && el.textContent && el.textContent.trim().length > 0) {
          // Element has text content but no children with direct text - it's a leaf
          leafElements.add(el);
        }
      });

      let idCounter = 0;
      const pages = iframeDoc.querySelectorAll('.pf, .pc');

      leafElements.forEach((el) => {
        const htmlEl = el as HTMLElement;
        if (htmlEl.getAttribute('data-canon-id')) return; // Skip if already has ID

        // Create stable IDs based on page and position
        const page = el.closest('.pf, .pc');
        const pageNum = page ? Array.from(pages).indexOf(page) + 1 : 0;
        htmlEl.setAttribute('data-canon-id', `pf${pageNum}-el-${idCounter++}`);
      });

      console.log(`[Context] Manually assigned IDs to ${idCounter} leaf elements`);
      elementsWithId = iframeDoc.querySelectorAll('[data-canon-id]');
    }

    // Now extract the HTML with IDs
    documentHtml = iframeDoc.documentElement.outerHTML;

    // Debug: Verify IDs are in extracted HTML
    const canonIdCount = (documentHtml.match(/data-canon-id/g) || []).length;
    console.log(`[Context] Extracted HTML: ${documentHtml.length} chars, ${canonIdCount} data-canon-id attributes`);
  } else {
    console.warn(`[Context] No iframe document available`);
  }

  // Extract page dimensions from data attributes
  let pageInfo: PageInfo[] | undefined;
  if (iframeDoc) {
    const pages = iframeDoc.querySelectorAll('[data-canon-page-num]');
    if (pages.length > 0) {
      pageInfo = Array.from(pages).map((page) => ({
        pageNum: parseInt(page.getAttribute('data-canon-page-num') || '1', 10),
        width: parseFloat(page.getAttribute('data-canon-page-width') || '612'),
        height: parseFloat(page.getAttribute('data-canon-page-height') || '792'),
      }));
      console.log(`[Context] Extracted page info for ${pageInfo.length} pages`);
    }
  }

  // If element is selected, include that context with coordinates
  if (selectedElement) {
    let coords: ElementCoords | undefined;

    // Extract coordinates from element's data attributes
    if (iframeDoc) {
      const el = iframeDoc.querySelector(`[data-canon-id="${selectedElement.id}"]`);
      if (el) {
        const x = el.getAttribute('data-canon-x');
        const y = el.getAttribute('data-canon-y');
        const w = el.getAttribute('data-canon-width');
        const h = el.getAttribute('data-canon-height');
        const p = el.getAttribute('data-canon-page');

        if (x && y && w && h) {
          coords = {
            x: parseFloat(x),
            y: parseFloat(y),
            width: parseFloat(w),
            height: parseFloat(h),
            page: parseInt(p || '1', 10),
          };
          console.log(`[Context] Selected element coords: (${coords.x}, ${coords.y}) ${coords.width}x${coords.height} on page ${coords.page}`);
        }
      }
    }

    return {
      selectedElement: {
        id: selectedElement.id,
        textContent: selectedElement.textContent,
        tagName: selectedElement.tagName,
        coords,
      },
      documentHtml,
      pageInfo,
    };
  }

  // No selection - just return documentHtml and pageInfo
  return { documentHtml, pageInfo };
}

/**
 * Build the user message for the agent based on instruction and context
 */
export function buildUserMessage(instruction: string, context: AgentContext): string {
  let message = instruction;

  if (context.selectedElement) {
    let contextStr = `[CONTEXT: User has selected an element with ID "${context.selectedElement.id}" containing text: "${context.selectedElement.textContent}"`;

    // Include position if available
    if (context.selectedElement.coords) {
      const c = context.selectedElement.coords;
      contextStr += ` at position (${c.x.toFixed(1)}, ${c.y.toFixed(1)}) on page ${c.page}, size ${c.width.toFixed(1)}x${c.height.toFixed(1)}px`;
    }

    contextStr += `]`;
    message += `\n\n${contextStr}`;
  }
  // Note: documentHtml is used by scan_document tool, not included in user message (too large)

  return message;
}

/**
 * Build system prompt for the agent
 */
export function buildSystemPrompt(context: AgentContext): string {
  let contextInfo = '';

  if (context.selectedElement) {
    contextInfo = `SELECTED ELEMENT:
- ID: "${context.selectedElement.id}"
- Content: "${context.selectedElement.textContent}"`;

    // Add spatial info if available
    if (context.selectedElement.coords) {
      const c = context.selectedElement.coords;
      contextInfo += `
- Position: (${c.x.toFixed(1)}, ${c.y.toFixed(1)}) on page ${c.page}
- Size: ${c.width.toFixed(1)} x ${c.height.toFixed(1)} pixels`;
    }
  } else {
    contextInfo = `No element selected. Use scan_document to find elements.`;
  }

  // Add page dimension context if available
  if (context.pageInfo && context.pageInfo.length > 0) {
    contextInfo += `\n\nPAGE DIMENSIONS:`;
    context.pageInfo.forEach((p) => {
      contextInfo += `\n- Page ${p.pageNum}: ${p.width.toFixed(0)} x ${p.height.toFixed(0)} pixels`;
    });
  }

  return `You are Canon's document editing assistant. Help users edit PDF documents through natural language.

## Context
${contextInfo}

## Tools

| Tool | Purpose |
|------|---------|
| set_element_text(elementId, text) | Replace element's text |
| redact_element(elementId) | Black out element |
| highlight_element(elementId) | Yellow highlight |
| add_comment(elementId, text) | Add annotation |
| delete_element(elementId) | Remove element |
| scan_document(query) | Find matching elements |

## CRITICAL: Follow Instructions PRECISELY

**Literal vs Semantic:**
- "containing X" or "with the word X" = LITERAL match (only elements with exact word X)
- "about X" or "related to X" = SEMANTIC match (broader interpretation)
- "all X" without qualifier = use judgment, but prefer precision

**Examples:**
- "redact text containing French" → scan for literal word "French" only (NOT "Francophone", "FR 101")
- "redact text about French language" → broader: includes French courses, Francophone, etc.
- "redact all email addresses" → pattern match: anything with @ in email format

**When UNCERTAIN, ASK:**
If the user's instruction is ambiguous, ASK for clarification before acting. Examples:
- "redact sensitive info" → Ask: "What counts as sensitive? Names, emails, phone numbers, financial data, or something specific?"
- "fix the formatting" → Ask: "Which elements need formatting changes, and what style do you want?"
- "clean this up" → Ask: "What specifically should I clean up or remove?"

Do NOT guess on ambiguous instructions. A quick question saves the user from unwanted changes.

## scan_document Usage

Pass the query EXACTLY as the user specified. The scanner will interpret it:
- User says "containing French" → scan_document("text containing the word French")
- User says "email addresses" → scan_document("email addresses")
- User says "Party B's info" → scan_document("information about or related to Party B")

Do NOT over-elaborate the query. Keep it close to user's words.

## Execution

1. Each tool call = ONE element
2. Bulk operations: N matches → N tool calls
3. set_element_text REPLACES entire content

## Conversation

You have history. When users say:
- "also the emails" → apply same operation to emails
- "not that one" → refers to last operation
- "what about X?" → same logic for X

## Style
Be concise. Acknowledge briefly, then execute. Ask only when truly ambiguous.`;
}
