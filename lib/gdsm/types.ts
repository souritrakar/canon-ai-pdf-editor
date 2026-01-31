/**
 * Global Document Structure Model (GDSM) - Core Types
 *
 * Internal document representation that:
 * 1. Maintains accurate, mutable state of all document elements
 * 2. Replaces inefficient "pass full HTML" approach for scanner LLM
 * 3. Enables semantic reasoning ("redact Party B info") not just pattern matching
 * 4. Updates instantly when mutations occur
 * 5. Optimizes for search, space, and time efficiency
 */

/**
 * Element state flags (bitfield for efficiency)
 */
export enum ElementState {
  NONE = 0,
  REDACTED = 1 << 0, // 1
  HIGHLIGHTED = 1 << 1, // 2
  MODIFIED = 1 << 2, // 4
  COMMENTED = 1 << 3, // 8
  DELETED = 1 << 4, // 16
}

/**
 * Semantic type classification for elements
 */
export type SemanticType =
  | "email"
  | "phone"
  | "date"
  | "currency"
  | "percentage"
  | "name"
  | "address"
  | "legal_party"
  | "ssn"
  | "url"
  | "unknown";

/**
 * Comment attached to an element
 */
export interface ElementComment {
  id: string;
  text: string;
  timestamp: number;
}

/**
 * A single document element with all its properties
 */
export interface GDSMElement {
  // Identity
  id: string; // "pf1-el-42"

  // Content
  text: string; // Current text (may be empty if redacted)
  originalText?: string; // For undo (set on first mutation)

  // Position (page-relative)
  page: number; // 1-indexed
  x: number; // Left edge
  y: number; // Top edge
  width: number;
  height: number;

  // State (bitfield)
  state: ElementState;

  // Semantic annotations
  semanticType?: SemanticType;
  entities?: string[]; // ["Party B", "john@example.com"]

  // Comment (if present)
  comment?: ElementComment;
}

/**
 * Page metadata
 */
export interface GDSMPage {
  pageNum: number; // 1-indexed
  width: number;
  height: number;
  elementCount: number;
}

/**
 * Inverted text index for fast literal search
 */
export interface TextIndex {
  // Word to element IDs - "french" -> Set<"pf1-el-5", "pf1-el-12">
  wordToElements: Map<string, Set<string>>;
  // Bigram index for partial matching - "fr" -> Set<elementId>
  bigramToElements: Map<string, Set<string>>;
}

/**
 * Document statistics
 */
export interface GDSMStats {
  total: number;
  redacted: number;
  highlighted: number;
  modified: number;
  commented: number;
  deleted: number;
}

/**
 * The Global Document Structure Model
 */
export interface GDSM {
  documentId: string;
  version: number; // Increments on mutation
  createdAt: number;
  lastModifiedAt: number;

  // Structure
  pages: GDSMPage[];

  // Element access patterns
  elementsById: Map<string, GDSMElement>; // O(1) by ID
  elementsByPage: Map<number, GDSMElement[]>; // O(1) by page

  // Search index
  textIndex: TextIndex;

  // Stats
  stats: GDSMStats;
}

/**
 * Mutation types for GDSM updates
 */
export type MutationType =
  | "redact"
  | "highlight"
  | "set_text"
  | "add_comment"
  | "delete";

/**
 * A mutation to apply to an element
 */
export interface GDSMMutation {
  type: MutationType;
  elementId: string;
  // For set_text
  newText?: string;
  // For add_comment
  commentText?: string;
}

/**
 * Query types for scanner
 */
export interface ScanQuery {
  // Filter by page(s)
  pages?: number[];

  // State filters
  excludeRedacted?: boolean;
  onlyHighlighted?: boolean;

  // Literal word search (uses inverted index)
  containsWord?: string;

  // Pattern matching (regex)
  pattern?: RegExp;

  // Semantic type filter
  semanticType?: SemanticType;

  // Semantic search (requires LLM)
  semanticQuery?: string;

  // Limit results
  limit?: number;
}

/**
 * Result of a scan query
 */
export interface ScanResult {
  elements: GDSMElement[];
  matchedCount: number;
  queryType: "index" | "pattern" | "semantic";
  // For semantic queries, includes the compact representation sent to LLM
  compactRepresentation?: string;
}
