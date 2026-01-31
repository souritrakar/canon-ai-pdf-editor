/**
 * GDSM Mutations - Apply mutations to the document model
 */

import type { GDSM, GDSMElement, GDSMMutation, GDSMStats } from "./types";
import { ElementState } from "./types";
import { updateIndex, removeFromIndex } from "./text-index";
import { detectSemanticType, extractEntities } from "./semantic";

/**
 * Result of applying a mutation
 */
export interface MutationResult {
  success: boolean;
  elementId: string;
  previousState?: Partial<GDSMElement>;
  error?: string;
}

/**
 * Apply a single mutation to the GDSM
 * Returns the result with previous state for potential undo
 */
export function applyMutation(
  gdsm: GDSM,
  mutation: GDSMMutation
): MutationResult {
  const element = gdsm.elementsById.get(mutation.elementId);

  if (!element) {
    return {
      success: false,
      elementId: mutation.elementId,
      error: `Element not found: ${mutation.elementId}`,
    };
  }

  // Store previous state for undo (shallow copy of relevant fields)
  const previousState: Partial<GDSMElement> = {
    text: element.text,
    state: element.state,
    originalText: element.originalText,
    comment: element.comment ? { ...element.comment } : undefined,
  };

  // Store original text on first mutation (for complete undo)
  if (!element.originalText) {
    element.originalText = element.text;
  }

  // Clone element for index update
  const oldElement = { ...element };

  switch (mutation.type) {
    case "redact":
      applyRedact(gdsm, element, oldElement);
      break;

    case "highlight":
      applyHighlight(element);
      break;

    case "set_text":
      if (mutation.newText === undefined) {
        return {
          success: false,
          elementId: mutation.elementId,
          error: "newText required for set_text mutation",
        };
      }
      applySetText(gdsm, element, oldElement, mutation.newText);
      break;

    case "add_comment":
      if (!mutation.commentText) {
        return {
          success: false,
          elementId: mutation.elementId,
          error: "commentText required for add_comment mutation",
        };
      }
      applyAddComment(element, mutation.commentText);
      break;

    case "delete":
      applyDelete(gdsm, element, oldElement);
      break;

    default:
      return {
        success: false,
        elementId: mutation.elementId,
        error: `Unknown mutation type: ${mutation.type}`,
      };
  }

  // Update version and timestamp
  gdsm.version++;
  gdsm.lastModifiedAt = Date.now();

  // Recalculate stats
  updateStats(gdsm);

  return {
    success: true,
    elementId: mutation.elementId,
    previousState,
  };
}

/**
 * Apply redaction to an element
 */
function applyRedact(
  gdsm: GDSM,
  element: GDSMElement,
  oldElement: GDSMElement
): void {
  // Set state flag
  element.state |= ElementState.REDACTED;

  // Clear text (content is removed on redaction)
  element.text = "";

  // Clear semantic info since text is gone
  element.semanticType = undefined;
  element.entities = undefined;

  // Update text index (remove old words)
  updateIndex(gdsm.textIndex, oldElement, element);
}

/**
 * Apply highlight to an element
 */
function applyHighlight(element: GDSMElement): void {
  element.state |= ElementState.HIGHLIGHTED;
}

/**
 * Apply text change to an element
 */
function applySetText(
  gdsm: GDSM,
  element: GDSMElement,
  oldElement: GDSMElement,
  newText: string
): void {
  // Set text
  element.text = newText;
  element.state |= ElementState.MODIFIED;

  // Redetect semantic type and entities for new text
  element.semanticType = detectSemanticType(newText);
  if (element.semanticType === "unknown") {
    element.semanticType = undefined;
  }
  element.entities = extractEntities(newText);
  if (element.entities.length === 0) {
    element.entities = undefined;
  }

  // Update text index
  updateIndex(gdsm.textIndex, oldElement, element);
}

/**
 * Apply comment to an element
 */
function applyAddComment(element: GDSMElement, commentText: string): void {
  element.state |= ElementState.COMMENTED;
  element.comment = {
    id: `comment-${Date.now()}`,
    text: commentText,
    timestamp: Date.now(),
  };
}

/**
 * Apply deletion to an element
 */
function applyDelete(
  gdsm: GDSM,
  element: GDSMElement,
  oldElement: GDSMElement
): void {
  element.state |= ElementState.DELETED;
  element.text = "";

  // Clear semantic info
  element.semanticType = undefined;
  element.entities = undefined;

  // Remove from text index
  removeFromIndex(gdsm.textIndex, oldElement);
}

/**
 * Apply multiple mutations in sequence
 */
export function applyMutations(
  gdsm: GDSM,
  mutations: GDSMMutation[]
): MutationResult[] {
  return mutations.map((mutation) => applyMutation(gdsm, mutation));
}

/**
 * Update GDSM stats based on current element states
 */
function updateStats(gdsm: GDSM): void {
  const stats: GDSMStats = {
    total: gdsm.elementsById.size,
    redacted: 0,
    highlighted: 0,
    modified: 0,
    commented: 0,
    deleted: 0,
  };

  gdsm.elementsById.forEach((el) => {
    if (el.state & ElementState.REDACTED) stats.redacted++;
    if (el.state & ElementState.HIGHLIGHTED) stats.highlighted++;
    if (el.state & ElementState.MODIFIED) stats.modified++;
    if (el.state & ElementState.COMMENTED) stats.commented++;
    if (el.state & ElementState.DELETED) stats.deleted++;
  });

  gdsm.stats = stats;
}

/**
 * Remove highlight from an element
 */
export function removeHighlight(gdsm: GDSM, elementId: string): MutationResult {
  const element = gdsm.elementsById.get(elementId);
  if (!element) {
    return {
      success: false,
      elementId,
      error: `Element not found: ${elementId}`,
    };
  }

  const previousState = { state: element.state };
  element.state &= ~ElementState.HIGHLIGHTED;

  gdsm.version++;
  gdsm.lastModifiedAt = Date.now();
  updateStats(gdsm);

  return { success: true, elementId, previousState };
}

/**
 * Remove comment from an element
 */
export function removeComment(gdsm: GDSM, elementId: string): MutationResult {
  const element = gdsm.elementsById.get(elementId);
  if (!element) {
    return {
      success: false,
      elementId,
      error: `Element not found: ${elementId}`,
    };
  }

  const previousState = {
    state: element.state,
    comment: element.comment ? { ...element.comment } : undefined,
  };

  element.state &= ~ElementState.COMMENTED;
  element.comment = undefined;

  gdsm.version++;
  gdsm.lastModifiedAt = Date.now();
  updateStats(gdsm);

  return { success: true, elementId, previousState };
}

/**
 * Get elements that have been modified since a specific version
 */
export function getModifiedSince(
  gdsm: GDSM,
  sinceVersion: number
): GDSMElement[] {
  // Since we don't track per-element version, return all modified elements
  // This is a simplified implementation - could be enhanced with version tracking
  const modified: GDSMElement[] = [];

  gdsm.elementsById.forEach((el) => {
    if (el.state !== ElementState.NONE) {
      modified.push(el);
    }
  });

  return modified;
}

/**
 * Check if element has a specific state flag
 */
export function hasState(element: GDSMElement, state: ElementState): boolean {
  return (element.state & state) !== 0;
}

/**
 * Get all elements with a specific state
 */
export function getElementsByState(
  gdsm: GDSM,
  state: ElementState
): GDSMElement[] {
  const result: GDSMElement[] = [];

  gdsm.elementsById.forEach((el) => {
    if (el.state & state) {
      result.push(el);
    }
  });

  return result;
}
