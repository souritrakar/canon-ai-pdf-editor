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
 * GDSM Element for scanner (serializable version)
 */
export interface GDSMElementForScanner {
  id: string;
  text: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  state: number;
  semanticType?: string;
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
  // GDSM elements for scanner (replaces HTML parsing)
  gdsmElements?: GDSMElementForScanner[];
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

## CRITICAL: "this" = Selected Element

**When user has a SELECTED ELEMENT (shown in Context above), ANY reference to "this", "that", or "it" means that element.**

USE THE SELECTED ELEMENT ID DIRECTLY for (example usages):
- "change this to X" → set_element_text(selectedId, "X")
- "translate this to XYZ" → set_element_text(selectedId, translated_text)
- "make this more formal" → set_element_text(selectedId, formal_version)
- "redact this" → redact_element(selectedId)
- "highlight this" → highlight_element(selectedId)
- "delete this" → delete_element(selectedId)

**DO NOT use scan_document when user says "this" with a selected element.**

## scan_document Usage

ONLY use scan_document when:
1. No element is selected AND user wants to find elements
2. User explicitly says "all", "every", or "each"
3. User describes a pattern: "all emails", "phone numbers", "dates"

**Query Formulation - BE PRECISE:**
When calling scan_document, phrase your query to get exact matches:

| User says | Your query | Why |
|-----------|------------|-----|
| "redact lines containing French" | "lines containing the word French" | Clarifies EXACT word match |
| "find all emails" | "email addresses" | Pattern match |
| "highlight dates" | "dates" | Pattern match |
| "redact Party B info" | "content about Party B" | Semantic - needs context |

**Match Types:**
- "containing X" / "with the word X" = EXACT WORD match (X as standalone word, NOT as substring)
  - "French" matches "French language" but NOT "Francophone" or "Frenchman"
- "about X" / "related to X" = SEMANTIC match (broader interpretation)
- Pattern queries (emails, phones, dates) = match FORMAT not literal text

## Text Replacement with set_element_text

The text parameter REPLACES the entire element content.

For "change X to Y": If selected text is "Hello World" and user says "change Hello to Hi":
- The new text should be "Hi World" (replace within context)

For "translate this": Translate the ENTIRE selected text.

For "make this formal/casual": Rewrite the ENTIRE selected text in that style.

## When UNCERTAIN

Ask for clarification on vague instructions:
- "redact sensitive info" → What counts as sensitive?
- "fix this" → What specifically needs fixing?

## Conversation Context

You have history. You must analyze the user instruction to understand the conversational context and what they are referring to. For example, when users say:
- "also the emails" → apply same operation to emails
- "also do X" → apply same operation type to X
- "not that one" → refers to last operation
- "undo that" → refers to last operation
- "what about X?" → same logic for X

## Style
Be concise. When element is selected, execute directly. Don't scan when you already have the target.

## CRITICAL: Language & Tone

**You are PROPOSING changes, not executing them.** The user must click "Apply" to confirm.

DO NOT say:
- "Done!" / "I've done it!" / "Completed!"
- "I deleted/redacted/changed X"
- "All X elements have been deleted"

INSTEAD say:
- "I'll delete these 5 elements" → then call the tools
- "Ready to redact 3 elements containing phone numbers"
- "Found 10 matches. I'll highlight them."

**After calling tools, summarize what WILL happen (not what DID happen):**
- "This will delete 5 lines from page 2"
- "This will redact all email addresses (4 found)"

Keep responses brief. One short sentence before tools, one after.`;
}
