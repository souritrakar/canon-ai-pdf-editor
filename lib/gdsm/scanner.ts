/**
 * GDSM Scanner - Query interface for finding elements
 *
 * Replaces the old scanDocument() approach that sent full HTML to LLM
 *
 * Query execution is tiered for efficiency:
 * 1. Spatial filter (page) → O(1)
 * 2. State filter (exclude redacted) → O(n)
 * 3. Literal search → O(1) index lookup
 * 4. Pattern search → O(n) regex
 * 5. Semantic search → Compact list to LLM
 */

import type { GDSM, GDSMElement, ScanQuery, ScanResult, SemanticType } from "./types";
import { ElementState } from "./types";
import { searchWord, containsExactWord } from "./text-index";
import { matchesSemanticType } from "./semantic";

/**
 * Scan the GDSM for matching elements
 */
export function scanGDSM(gdsm: GDSM, query: ScanQuery): ScanResult {
  let elements: GDSMElement[];
  let queryType: ScanResult["queryType"] = "index";

  // Step 1: Start with page filter if specified (O(1) lookup)
  if (query.pages && query.pages.length > 0) {
    elements = [];
    for (const pageNum of query.pages) {
      const pageElements = gdsm.elementsByPage.get(pageNum);
      if (pageElements) {
        elements.push(...pageElements);
      }
    }
  } else {
    // Get all elements
    elements = Array.from(gdsm.elementsById.values());
  }

  // Step 2: Apply state filters (O(n))
  if (query.excludeRedacted) {
    elements = elements.filter(
      (el) => !(el.state & ElementState.REDACTED)
    );
  }

  if (query.onlyHighlighted) {
    elements = elements.filter(
      (el) => (el.state & ElementState.HIGHLIGHTED) !== 0
    );
  }

  // Exclude deleted elements by default
  elements = elements.filter(
    (el) => !(el.state & ElementState.DELETED)
  );

  // Step 3: Literal word search using inverted index (O(1))
  if (query.containsWord) {
    // Use index for fast lookup of candidate elements
    const candidateIds = searchWord(gdsm.textIndex, query.containsWord);

    // Filter to only elements in our current set AND verify exact word match
    elements = elements.filter(
      (el) =>
        candidateIds.has(el.id) &&
        containsExactWord(el.text, query.containsWord!)
    );
    queryType = "index";
  }

  // Step 4: Pattern matching (O(n) regex)
  if (query.pattern) {
    elements = elements.filter((el) => query.pattern!.test(el.text));
    queryType = "pattern";
  }

  // Step 5: Semantic type filter (O(n))
  if (query.semanticType) {
    elements = elements.filter((el) => {
      // First check if we already detected this type
      if (el.semanticType === query.semanticType) return true;
      // Fall back to pattern check
      return matchesSemanticType(el.text, query.semanticType!);
    });
    queryType = "pattern";
  }

  // Step 6: Semantic query (requires LLM)
  let compactRepresentation: string | undefined;
  if (query.semanticQuery) {
    // Build compact representation for LLM
    compactRepresentation = buildCompactRepresentation(elements);
    queryType = "semantic";
    // Note: Actual LLM call happens in the API route
    // This just prepares the compact data
  }

  // Apply limit if specified
  if (query.limit && elements.length > query.limit) {
    elements = elements.slice(0, query.limit);
  }

  return {
    elements,
    matchedCount: elements.length,
    queryType,
    compactRepresentation,
  };
}

/**
 * Build a compact representation of elements for LLM semantic search
 * Format: "[id|pN] text content" per line
 * Much smaller than full HTML (~20KB vs ~400KB)
 */
export function buildCompactRepresentation(elements: GDSMElement[]): string {
  return elements
    .map((el) => {
      const stateIndicators: string[] = [];
      if (el.state & ElementState.HIGHLIGHTED) stateIndicators.push("H");
      if (el.state & ElementState.COMMENTED) stateIndicators.push("C");
      if (el.state & ElementState.MODIFIED) stateIndicators.push("M");

      const stateStr =
        stateIndicators.length > 0 ? `|${stateIndicators.join("")}` : "";
      const typeStr = el.semanticType ? `|${el.semanticType}` : "";

      // Truncate very long text
      const text = el.text.length > 200 ? el.text.slice(0, 197) + "..." : el.text;

      return `[${el.id}|p${el.page}${stateStr}${typeStr}] ${text}`;
    })
    .join("\n");
}

/**
 * Quick search by exact word (uses index)
 */
export function findByWord(gdsm: GDSM, word: string): GDSMElement[] {
  const candidateIds = searchWord(gdsm.textIndex, word);
  const elements: GDSMElement[] = [];

  candidateIds.forEach((id) => {
    const el = gdsm.elementsById.get(id);
    if (el && containsExactWord(el.text, word)) {
      elements.push(el);
    }
  });

  return elements;
}

/**
 * Find elements by semantic type
 */
export function findBySemanticType(
  gdsm: GDSM,
  type: SemanticType
): GDSMElement[] {
  const result: GDSMElement[] = [];

  gdsm.elementsById.forEach((el) => {
    if (el.state & ElementState.DELETED) return;
    if (el.state & ElementState.REDACTED) return;

    if (el.semanticType === type || matchesSemanticType(el.text, type)) {
      result.push(el);
    }
  });

  return result;
}

/**
 * Find elements on a specific page
 */
export function findByPage(gdsm: GDSM, pageNum: number): GDSMElement[] {
  return gdsm.elementsByPage.get(pageNum) || [];
}

/**
 * Find element by ID
 */
export function getElementById(
  gdsm: GDSM,
  elementId: string
): GDSMElement | undefined {
  return gdsm.elementsById.get(elementId);
}

/**
 * Find elements matching a regex pattern
 */
export function findByPattern(gdsm: GDSM, pattern: RegExp): GDSMElement[] {
  const result: GDSMElement[] = [];

  gdsm.elementsById.forEach((el) => {
    if (el.state & ElementState.DELETED) return;
    if (el.state & ElementState.REDACTED) return;

    if (pattern.test(el.text)) {
      result.push(el);
    }
  });

  return result;
}

/**
 * Common pattern matchers
 */
export const PATTERNS = {
  email: /[\w.+-]+@[\w.-]+\.\w{2,}/,
  phone: /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/,
  date: /\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/,
  currency: /[$€£¥]\s*[\d,]+(?:\.\d{2})?/,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/,
  url: /https?:\/\/[^\s]+/,
};

/**
 * Find all emails in document
 */
export function findEmails(gdsm: GDSM): GDSMElement[] {
  return findBySemanticType(gdsm, "email");
}

/**
 * Find all phone numbers in document
 */
export function findPhoneNumbers(gdsm: GDSM): GDSMElement[] {
  return findBySemanticType(gdsm, "phone");
}

/**
 * Find all dates in document
 */
export function findDates(gdsm: GDSM): GDSMElement[] {
  return findBySemanticType(gdsm, "date");
}

/**
 * Get summary of document content for LLM context
 */
export function getDocumentSummary(gdsm: GDSM): string {
  const { stats, pages } = gdsm;

  let summary = `Document: ${pages.length} pages, ${stats.total} elements\n`;
  summary += `States: ${stats.redacted} redacted, ${stats.highlighted} highlighted, `;
  summary += `${stats.modified} modified, ${stats.commented} commented, ${stats.deleted} deleted\n`;

  // Count by semantic type
  const typeCounts: Record<string, number> = {};
  gdsm.elementsById.forEach((el) => {
    if (el.semanticType) {
      typeCounts[el.semanticType] = (typeCounts[el.semanticType] || 0) + 1;
    }
  });

  if (Object.keys(typeCounts).length > 0) {
    summary += `Detected types: ${Object.entries(typeCounts)
      .map(([type, count]) => `${count} ${type}`)
      .join(", ")}\n`;
  }

  return summary;
}

/**
 * Parse a natural language query into a ScanQuery object
 * This is a simple heuristic parser - complex queries still go to LLM
 */
export function parseQuery(queryText: string): ScanQuery {
  const query: ScanQuery = {};
  const lowerQuery = queryText.toLowerCase();

  // Check for page references
  const pageMatch = lowerQuery.match(/page\s*(\d+)/);
  if (pageMatch) {
    query.pages = [parseInt(pageMatch[1], 10)];
  }

  // Check for semantic type keywords
  if (lowerQuery.includes("email")) {
    query.semanticType = "email";
  } else if (lowerQuery.includes("phone") || lowerQuery.includes("number")) {
    query.semanticType = "phone";
  } else if (lowerQuery.includes("date")) {
    query.semanticType = "date";
  } else if (lowerQuery.includes("currency") || lowerQuery.includes("dollar") || lowerQuery.includes("price")) {
    query.semanticType = "currency";
  } else if (lowerQuery.includes("ssn") || lowerQuery.includes("social security")) {
    query.semanticType = "ssn";
  } else if (lowerQuery.includes("url") || lowerQuery.includes("link") || lowerQuery.includes("website")) {
    query.semanticType = "url";
  } else if (lowerQuery.includes("address")) {
    query.semanticType = "address";
  } else if (lowerQuery.includes("party a") || lowerQuery.includes("party b") || lowerQuery.includes("legal party")) {
    query.semanticType = "legal_party";
  }

  // Check for "containing" keyword for exact word search
  const containingMatch = queryText.match(/containing\s+(?:the\s+)?(?:word\s+)?["']?(\w+)["']?/i);
  if (containingMatch) {
    query.containsWord = containingMatch[1];
  }

  // Check for "with" keyword
  const withMatch = queryText.match(/with\s+(?:the\s+)?(?:word\s+)?["']?(\w+)["']?/i);
  if (withMatch && !query.containsWord) {
    query.containsWord = withMatch[1];
  }

  // If no specific patterns matched, treat as semantic query
  if (!query.semanticType && !query.containsWord && !query.pages) {
    query.semanticQuery = queryText;
  }

  // Exclude redacted by default
  query.excludeRedacted = true;

  return query;
}
