/**
 * Global Document Structure Model (GDSM)
 *
 * Internal document representation that:
 * 1. Maintains accurate, mutable state of all document elements
 * 2. Replaces inefficient "pass full HTML" approach for scanner LLM
 * 3. Enables semantic reasoning ("redact Party B info") not just pattern matching
 * 4. Updates instantly when mutations occur
 * 5. Optimizes for search, space, and time efficiency
 *
 * @example
 * ```typescript
 * import { buildGDSM, scanGDSM, applyMutation } from '@/lib/gdsm';
 *
 * // Build GDSM from iframe
 * const gdsm = buildGDSM(iframeDoc);
 *
 * // Query for elements
 * const result = scanGDSM(gdsm, { containsWord: 'French' });
 *
 * // Apply mutation
 * applyMutation(gdsm, { type: 'redact', elementId: 'pf1-el-42' });
 * ```
 */

// Types
export type {
  GDSMElement,
  GDSM,
  GDSMPage,
  TextIndex,
  GDSMStats,
  GDSMMutation,
  MutationType,
  ScanQuery,
  ScanResult,
  SemanticType,
  ElementComment,
} from "./types";

export { ElementState } from "./types";

// Builder
export { buildGDSM, generateDocumentId } from "./builder";

// Text Index
export {
  buildTextIndex,
  searchWord,
  searchPartial,
  addToIndex,
  removeFromIndex,
  updateIndex,
  containsExactWord,
  getIndexStats,
} from "./text-index";

// Mutations
export {
  applyMutation,
  applyMutations,
  removeHighlight,
  removeComment,
  getModifiedSince,
  hasState,
  getElementsByState,
} from "./mutations";

export type { MutationResult } from "./mutations";

// Scanner
export {
  scanGDSM,
  buildCompactRepresentation,
  findByWord,
  findBySemanticType,
  findByPage,
  getElementById,
  findByPattern,
  findEmails,
  findPhoneNumbers,
  findDates,
  getDocumentSummary,
  parseQuery,
  PATTERNS,
} from "./scanner";

// Semantic
export {
  detectSemanticType,
  detectAllSemanticTypes,
  extractEntities,
  matchesSemanticType,
  getSemanticTypeDescription,
  getPatternForType,
} from "./semantic";
