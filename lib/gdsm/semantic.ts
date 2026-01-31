/**
 * Semantic Layer - Heuristic type detection and entity extraction
 *
 * Fast regex-based detection (no LLM needed)
 */

import type { SemanticType } from "./types";

/**
 * Patterns for detecting semantic types
 */
const PATTERNS = {
  // Email: user@domain.tld
  email: /[\w.+-]+@[\w.-]+\.\w{2,}/,

  // Phone: various formats
  phone:
    /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}|(?:\+?[0-9]{1,3}[-.\s]?)?[0-9]{2,4}[-.\s][0-9]{2,4}[-.\s][0-9]{2,4}/,

  // Date: various formats
  date: /(?:\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})|(?:\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})|(?:(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{2,4})/i,

  // Currency: $123.45, €100, £50.00
  currency: /[$€£¥]\s*[\d,]+(?:\.\d{2})?|[\d,]+(?:\.\d{2})?\s*(?:USD|EUR|GBP|JPY)/i,

  // Percentage: 12.5%, 100%
  percentage: /\d+(?:\.\d+)?%/,

  // SSN: 123-45-6789
  ssn: /\b\d{3}-\d{2}-\d{4}\b/,

  // URL: http(s)://...
  url: /https?:\/\/[^\s<>"{}|\\^`\[\]]+/i,

  // Address: Contains street indicators
  address:
    /\b\d+\s+(?:[\w\s]+)\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Way|Place|Pl|Circle|Cir)\.?\b/i,
};

/**
 * Patterns for extracting legal parties
 */
const PARTY_PATTERNS = [
  // "Party A", "Party B", etc.
  /\bParty\s+[A-Z]\b/gi,
  // "the Buyer", "the Seller", "the Lessee", etc.
  /\bthe\s+(?:Buyer|Seller|Lessor|Lessee|Borrower|Lender|Licensor|Licensee|Grantor|Grantee|Landlord|Tenant|Employer|Employee|Company|Individual|Corporation|Contractor|Client)\b/gi,
  // Names followed by party indicators
  /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\s*(?:\([\'\"]?(?:Party\s+[A-Z]|Buyer|Seller|Lessor|Lessee)[\'\"]?\))/gi,
];

/**
 * Patterns for extracting names (simple heuristic)
 */
const NAME_PATTERN = /\b(?:Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g;

/**
 * Detect the semantic type of text
 * Returns the first matching type, or "unknown"
 */
export function detectSemanticType(text: string): SemanticType {
  if (!text || text.length === 0) return "unknown";

  // Order matters - check more specific patterns first
  if (PATTERNS.ssn.test(text)) return "ssn";
  if (PATTERNS.email.test(text)) return "email";
  if (PATTERNS.phone.test(text)) return "phone";
  if (PATTERNS.url.test(text)) return "url";
  if (PATTERNS.currency.test(text)) return "currency";
  if (PATTERNS.percentage.test(text)) return "percentage";
  if (PATTERNS.date.test(text)) return "date";
  if (PATTERNS.address.test(text)) return "address";

  // Check for legal party references
  for (const pattern of PARTY_PATTERNS) {
    if (pattern.test(text)) {
      pattern.lastIndex = 0; // Reset regex state
      return "legal_party";
    }
  }

  // Check for names
  if (NAME_PATTERN.test(text)) {
    NAME_PATTERN.lastIndex = 0;
    return "name";
  }

  return "unknown";
}

/**
 * Detect all semantic types present in text
 * Returns array of types found
 */
export function detectAllSemanticTypes(text: string): SemanticType[] {
  if (!text || text.length === 0) return [];

  const types: SemanticType[] = [];

  if (PATTERNS.ssn.test(text)) types.push("ssn");
  if (PATTERNS.email.test(text)) types.push("email");
  if (PATTERNS.phone.test(text)) types.push("phone");
  if (PATTERNS.url.test(text)) types.push("url");
  if (PATTERNS.currency.test(text)) types.push("currency");
  if (PATTERNS.percentage.test(text)) types.push("percentage");
  if (PATTERNS.date.test(text)) types.push("date");
  if (PATTERNS.address.test(text)) types.push("address");

  for (const pattern of PARTY_PATTERNS) {
    if (pattern.test(text)) {
      pattern.lastIndex = 0;
      types.push("legal_party");
      break;
    }
  }

  if (NAME_PATTERN.test(text)) {
    NAME_PATTERN.lastIndex = 0;
    types.push("name");
  }

  return types;
}

/**
 * Extract entities from text
 * Returns array of extracted entity strings
 */
export function extractEntities(text: string): string[] {
  if (!text || text.length === 0) return [];

  const entities: string[] = [];

  // Extract emails
  const emails = text.match(PATTERNS.email);
  if (emails) entities.push(...emails);

  // Extract phone numbers
  const phones = text.match(PATTERNS.phone);
  if (phones) entities.push(...phones);

  // Extract legal parties
  for (const pattern of PARTY_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      entities.push(...matches.map((m) => m.trim()));
    }
  }

  // Extract SSNs
  const ssns = text.match(PATTERNS.ssn);
  if (ssns) entities.push(...ssns);

  // Extract currency values
  const currencies = text.match(PATTERNS.currency);
  if (currencies) entities.push(...currencies);

  // Extract dates
  const dates = text.match(PATTERNS.date);
  if (dates) entities.push(...dates);

  // Extract URLs
  const urls = text.match(PATTERNS.url);
  if (urls) entities.push(...urls);

  // Extract names
  const names = text.match(NAME_PATTERN);
  if (names) entities.push(...names);

  // Deduplicate
  return [...new Set(entities)];
}

/**
 * Check if text matches a semantic type pattern
 */
export function matchesSemanticType(
  text: string,
  type: SemanticType
): boolean {
  switch (type) {
    case "email":
      return PATTERNS.email.test(text);
    case "phone":
      return PATTERNS.phone.test(text);
    case "date":
      return PATTERNS.date.test(text);
    case "currency":
      return PATTERNS.currency.test(text);
    case "percentage":
      return PATTERNS.percentage.test(text);
    case "ssn":
      return PATTERNS.ssn.test(text);
    case "url":
      return PATTERNS.url.test(text);
    case "address":
      return PATTERNS.address.test(text);
    case "legal_party":
      for (const pattern of PARTY_PATTERNS) {
        if (pattern.test(text)) {
          pattern.lastIndex = 0;
          return true;
        }
      }
      return false;
    case "name":
      const result = NAME_PATTERN.test(text);
      NAME_PATTERN.lastIndex = 0;
      return result;
    default:
      return false;
  }
}

/**
 * Get a human-readable description of a semantic type
 */
export function getSemanticTypeDescription(type: SemanticType): string {
  switch (type) {
    case "email":
      return "Email address";
    case "phone":
      return "Phone number";
    case "date":
      return "Date";
    case "currency":
      return "Currency amount";
    case "percentage":
      return "Percentage";
    case "name":
      return "Person name";
    case "address":
      return "Physical address";
    case "legal_party":
      return "Legal party reference";
    case "ssn":
      return "Social Security Number";
    case "url":
      return "URL/Web address";
    default:
      return "Unknown";
  }
}

/**
 * Get the regex pattern for a semantic type (for debugging)
 */
export function getPatternForType(
  type: SemanticType
): RegExp | RegExp[] | null {
  switch (type) {
    case "email":
      return PATTERNS.email;
    case "phone":
      return PATTERNS.phone;
    case "date":
      return PATTERNS.date;
    case "currency":
      return PATTERNS.currency;
    case "percentage":
      return PATTERNS.percentage;
    case "ssn":
      return PATTERNS.ssn;
    case "url":
      return PATTERNS.url;
    case "address":
      return PATTERNS.address;
    case "legal_party":
      return PARTY_PATTERNS;
    case "name":
      return NAME_PATTERN;
    default:
      return null;
  }
}
