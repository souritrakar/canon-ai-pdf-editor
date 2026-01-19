import type { SelectedElement } from "@/components/editor/pdf-viewer";

/**
 * Context types for the agent
 */
export interface AgentContext {
  selectedElement?: {
    id: string;
    textContent: string;
    tagName: string;
  };
  // Full HTML for scan_document tool - contains all text and element IDs
  documentHtml?: string;
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

  // If element is selected, include that context
  if (selectedElement) {
    return {
      selectedElement: {
        id: selectedElement.id,
        textContent: selectedElement.textContent,
        tagName: selectedElement.tagName,
      },
      documentHtml,
    };
  }

  // No selection - just return documentHtml
  return { documentHtml };
}

/**
 * Build the user message for the agent based on instruction and context
 */
export function buildUserMessage(instruction: string, context: AgentContext): string {
  let message = instruction;

  if (context.selectedElement) {
    message += `\n\n[CONTEXT: User has selected an element with ID "${context.selectedElement.id}" containing text: "${context.selectedElement.textContent}"]`;
  }
  // Note: documentHtml is used by scan_document tool, not included in user message (too large)

  return message;
}

/**
 * Build system prompt for the agent
 */
export function buildSystemPrompt(context: AgentContext): string {
  const contextInfo = context.selectedElement
    ? `SELECTED ELEMENT:
- ID: "${context.selectedElement.id}"
- Content: "${context.selectedElement.textContent}"`
    : `No selection. Use scan_document to find elements.`;

  return `You are Canon's document editing assistant. You help users edit PDF documents by calling tools.

## Current Context
${contextInfo}

## Available Tools

| Tool | Purpose |
|------|---------|
| set_element_text(elementId, text) | Replace element's entire text content |
| redact_element(elementId) | Black out element completely |
| highlight_element(elementId) | Add yellow highlight to element |
| add_comment(elementId, text) | Attach annotation to element |
| delete_element(elementId) | Remove element from document |
| scan_document(query) | Search document for matching elements |

## Core Principles

1. **Atomic Operations**: Each tool call operates on exactly ONE element. The elementId parameter accepts a single ID, never multiple.

2. **Bulk Operations**: When modifying multiple elements, call the tool once per element. If scan_document returns N matches, you make N separate tool calls.

3. **Text Replacement**: The \`text\` parameter in set_element_text is the COMPLETE NEW content for that element. It fully replaces whatever was there before.

4. **Finding Elements**: Use scan_document when you need to locate elements. It returns element IDs and their current text content. Use those IDs in subsequent tool calls.

## Workflow

For operations on selected element:
→ Use the element ID from context directly

For operations requiring search:
→ First call scan_document to find matching elements
→ Then call the appropriate tool for each result

## Response Style
Be concise. Acknowledge briefly, then execute with tool calls.`;
}
