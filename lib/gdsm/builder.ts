/**
 * GDSM Builder - Constructs GDSM from iframe DOM
 *
 * Uses smart deduplication to preserve maximum granularity:
 * - Keeps elements whose text is NOT fully covered by their children
 * - Skips parent elements if children fully represent the same text
 * - This preserves word-level elements where pdf2htmlEX provides them
 */

import type { GDSM, GDSMElement, GDSMPage, TextIndex, GDSMStats } from "./types";
import { ElementState } from "./types";
import { buildTextIndex } from "./text-index";
import { detectSemanticType, extractEntities } from "./semantic";

/**
 * Selectors for text elements in pdf2htmlEX output
 */
const SELECTABLE_SELECTORS =
  '.t, .c, span, [class*="ff"], [class*="fc"], [class*="fs"], [class*="ls"], [class*="ws"]';

/**
 * Normalize text for comparison (collapse whitespace)
 */
function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Check if an element has unique text content not fully covered by its children.
 *
 * Smart deduplication logic:
 * - If element has NO child elements → keep it (it's a leaf with unique content)
 * - If element's text DIFFERS from children's combined text → keep it (has unique content)
 * - If element's text EQUALS children's combined text → skip it (children cover it)
 *
 * This preserves word-level granularity where pdf2htmlEX provides it.
 *
 * Example 1: <span>Graphium</span> → kept (no children)
 * Example 2: <div><span>Graphium</span><span> | </span></div>
 *            → div skipped (text = children's text), spans kept
 */
function hasUniqueTextContent(el: Element): boolean {
  const text = el.textContent?.trim() || "";
  if (!text) return false;

  // Get immediate child elements (not all descendants)
  const children = Array.from(el.children);

  // No child elements = this is a leaf with unique text
  if (children.length === 0) {
    return true;
  }

  // Check if this element has direct text nodes (not just text from children)
  const hasDirectTextNode = Array.from(el.childNodes).some(
    (node) =>
      node.nodeType === Node.TEXT_NODE &&
      node.textContent &&
      node.textContent.trim().length > 0
  );

  // If element has direct text nodes mixed with children, keep it
  // (e.g., <span>Hello <b>world</b>!</span> - has "Hello " and "!" as direct text)
  if (hasDirectTextNode) {
    // Check if the direct text adds anything beyond children's text
    const childrenText = children
      .map((c) => c.textContent || "")
      .join("");

    const myNorm = normalizeText(text);
    const childNorm = normalizeText(childrenText);

    // If my text differs from children's, I have unique content
    if (myNorm !== childNorm) {
      return true;
    }
  }

  // Concatenate all children's text
  const childrenText = children
    .map((c) => c.textContent || "")
    .join("");

  const myNorm = normalizeText(text);
  const childNorm = normalizeText(childrenText);

  // If my text differs from children's combined text, I have unique content
  // If they're the same, children fully cover me → skip this element
  return myNorm !== childNorm;
}

/**
 * Assign data-canon-id attributes using smart deduplication.
 * Keeps elements that have unique text not fully covered by their children.
 */
function ensureElementIds(iframeDoc: Document): void {
  const elementsWithId = iframeDoc.querySelectorAll("[data-canon-id]");

  if (elementsWithId.length > 0) {
    // IDs already assigned
    return;
  }

  console.log("[GDSM Builder] Assigning IDs with smart deduplication...");

  const selectorElements = iframeDoc.querySelectorAll(SELECTABLE_SELECTORS);
  const uniqueElements = new Set<Element>();
  let skippedDueToCoverage = 0;

  selectorElements.forEach((el) => {
    if (hasUniqueTextContent(el)) {
      uniqueElements.add(el);
    } else {
      skippedDueToCoverage++;
    }
  });

  const pages = iframeDoc.querySelectorAll(".pf");
  let idCounter = 0;

  uniqueElements.forEach((el) => {
    const htmlEl = el as HTMLElement;
    if (htmlEl.getAttribute("data-canon-id")) return;

    const page = el.closest(".pf");
    const pageNum = page ? Array.from(pages).indexOf(page) + 1 : 0;
    htmlEl.setAttribute("data-canon-id", `pf${pageNum}-el-${idCounter++}`);
  });

  console.log(
    `[GDSM Builder] Assigned IDs to ${idCounter} elements (skipped ${skippedDueToCoverage} parent elements covered by children)`
  );
}

/**
 * Extract element coordinates from DOM element
 */
function extractCoordinates(
  el: HTMLElement,
  pageNum: number
): { x: number; y: number; width: number; height: number } {
  // Try data attributes first
  const dataX = el.getAttribute("data-canon-x");
  const dataY = el.getAttribute("data-canon-y");
  const dataW = el.getAttribute("data-canon-width");
  const dataH = el.getAttribute("data-canon-height");

  if (dataX && dataY && dataW && dataH) {
    return {
      x: parseFloat(dataX),
      y: parseFloat(dataY),
      width: parseFloat(dataW),
      height: parseFloat(dataH),
    };
  }

  // Fall back to computed bounding rect relative to page
  const page = el.closest(".pf");
  if (page) {
    const pageRect = page.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();

    return {
      x: elRect.left - pageRect.left,
      y: elRect.top - pageRect.top,
      width: elRect.width,
      height: elRect.height,
    };
  }

  // Last resort: absolute position
  const rect = el.getBoundingClientRect();
  return {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

/**
 * Determine element state from DOM attributes/classes
 */
function determineElementState(el: HTMLElement): ElementState {
  let state = ElementState.NONE;

  // Check for redaction
  if (
    el.classList.contains("canon-redacted") ||
    el.getAttribute("data-canon-redacted") === "true"
  ) {
    state |= ElementState.REDACTED;
  }

  // Check for highlight
  if (
    el.classList.contains("canon-highlighted") ||
    el.getAttribute("data-canon-highlighted") === "true"
  ) {
    state |= ElementState.HIGHLIGHTED;
  }

  // Check for modification
  if (el.getAttribute("data-canon-modified") === "true") {
    state |= ElementState.MODIFIED;
  }

  // Check for comment
  if (el.getAttribute("data-canon-comment-id")) {
    state |= ElementState.COMMENTED;
  }

  // Check for deletion
  if (
    el.classList.contains("canon-deleted") ||
    el.getAttribute("data-canon-deleted") === "true"
  ) {
    state |= ElementState.DELETED;
  }

  return state;
}

/**
 * Extract a GDSMElement from a DOM element
 */
function extractElement(
  el: HTMLElement,
  pageNum: number
): GDSMElement | null {
  const id = el.getAttribute("data-canon-id");
  if (!id) return null;

  const text = el.textContent?.trim() || "";
  const coords = extractCoordinates(el, pageNum);
  const state = determineElementState(el);

  // Skip empty elements (unless they're redacted - those should be tracked)
  if (text.length === 0 && state === ElementState.NONE) {
    return null;
  }

  // Detect semantic type and extract entities
  const semanticType = detectSemanticType(text);
  const entities = extractEntities(text);

  // Check for existing comment
  const commentId = el.getAttribute("data-canon-comment-id");
  const commentText = el.getAttribute("data-canon-comment-text");
  const commentTimestamp = el.getAttribute("data-canon-comment-timestamp");

  const element: GDSMElement = {
    id,
    text,
    page: pageNum,
    x: coords.x,
    y: coords.y,
    width: coords.width,
    height: coords.height,
    state,
    semanticType: semanticType !== "unknown" ? semanticType : undefined,
    entities: entities.length > 0 ? entities : undefined,
  };

  // Add comment if present
  if (commentId && commentText) {
    element.comment = {
      id: commentId,
      text: commentText,
      timestamp: commentTimestamp ? parseInt(commentTimestamp, 10) : Date.now(),
    };
  }

  // Store original text if element has been modified
  const originalText = el.getAttribute("data-canon-original-text");
  if (originalText) {
    element.originalText = originalText;
  }

  return element;
}

/**
 * Extract page information from the document
 */
function extractPages(iframeDoc: Document): GDSMPage[] {
  const pageElements = iframeDoc.querySelectorAll("[data-canon-page-num]");
  const pages: GDSMPage[] = [];

  if (pageElements.length > 0) {
    pageElements.forEach((page) => {
      const pageNum = parseInt(
        page.getAttribute("data-canon-page-num") || "1",
        10
      );
      const width = parseFloat(
        page.getAttribute("data-canon-page-width") || "612"
      );
      const height = parseFloat(
        page.getAttribute("data-canon-page-height") || "792"
      );

      pages.push({
        pageNum,
        width,
        height,
        elementCount: 0, // Will be updated after element extraction
      });
    });
  } else {
    // Fallback: count .pf elements (main page containers)
    const pfPages = iframeDoc.querySelectorAll(".pf");
    pfPages.forEach((page, index) => {
      const rect = (page as HTMLElement).getBoundingClientRect();
      pages.push({
        pageNum: index + 1,
        width: rect.width || 612,
        height: rect.height || 792,
        elementCount: 0,
      });
    });
  }

  return pages;
}

/**
 * Calculate statistics from elements
 */
function calculateStats(elements: Map<string, GDSMElement>): GDSMStats {
  const stats: GDSMStats = {
    total: elements.size,
    redacted: 0,
    highlighted: 0,
    modified: 0,
    commented: 0,
    deleted: 0,
  };

  elements.forEach((el) => {
    if (el.state & ElementState.REDACTED) stats.redacted++;
    if (el.state & ElementState.HIGHLIGHTED) stats.highlighted++;
    if (el.state & ElementState.MODIFIED) stats.modified++;
    if (el.state & ElementState.COMMENTED) stats.commented++;
    if (el.state & ElementState.DELETED) stats.deleted++;
  });

  return stats;
}

/**
 * Build a GDSM from an iframe document
 */
export function buildGDSM(iframeDoc: Document): GDSM {
  const startTime = performance.now();

  // Ensure all elements have IDs
  ensureElementIds(iframeDoc);

  // Extract page info
  const pages = extractPages(iframeDoc);

  // Build element maps
  const elementsById = new Map<string, GDSMElement>();
  const elementsByPage = new Map<number, GDSMElement[]>();

  // Initialize page arrays
  pages.forEach((page) => {
    elementsByPage.set(page.pageNum, []);
  });

  // Extract all elements with IDs
  const domElements = iframeDoc.querySelectorAll("[data-canon-id]");

  domElements.forEach((domEl) => {
    const htmlEl = domEl as HTMLElement;

    // Determine page number - use .pf only (not .pc) to avoid double-counting
    // pdf2htmlEX outputs .pf as the main page container
    const page = domEl.closest(".pf");
    const pfPages = iframeDoc.querySelectorAll(".pf");
    const pageNum = page ? Array.from(pfPages).indexOf(page) + 1 : 1;

    const element = extractElement(htmlEl, pageNum);
    if (!element) return;

    elementsById.set(element.id, element);

    // Add to page array
    let pageElements = elementsByPage.get(pageNum);
    if (!pageElements) {
      pageElements = [];
      elementsByPage.set(pageNum, pageElements);
    }
    pageElements.push(element);
  });

  // Update page element counts
  elementsByPage.forEach((elements, pageNum) => {
    const page = pages.find((p) => p.pageNum === pageNum);
    if (page) {
      page.elementCount = elements.length;
    }
  });

  // Build text index
  const textIndex = buildTextIndex(elementsById);

  // Calculate stats
  const stats = calculateStats(elementsById);

  const gdsm: GDSM = {
    documentId: `doc-${Date.now()}`,
    version: 1,
    createdAt: Date.now(),
    lastModifiedAt: Date.now(),
    pages,
    elementsById,
    elementsByPage,
    textIndex,
    stats,
  };

  const elapsed = performance.now() - startTime;
  console.log(
    `[GDSM Builder] Built GDSM with ${elementsById.size} elements across ${pages.length} pages in ${elapsed.toFixed(1)}ms`
  );

  return gdsm;
}

/**
 * Generate a unique document ID
 */
export function generateDocumentId(): string {
  return `doc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
