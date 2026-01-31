/**
 * Text Index - Inverted index for O(1) word lookup
 */

import type { GDSMElement, TextIndex } from "./types";

/**
 * Normalize a word for indexing (lowercase, trim)
 */
function normalizeWord(word: string): string {
  return word.toLowerCase().trim();
}

/**
 * Extract words from text
 * Returns array of normalized words (letters, numbers, and some punctuation)
 */
function extractWords(text: string): string[] {
  // Match word characters including accented characters
  const matches = text.match(/[\p{L}\p{N}]+/gu);
  if (!matches) return [];

  return matches
    .map(normalizeWord)
    .filter((word) => word.length >= 2); // Skip single-char words
}

/**
 * Generate bigrams from a word
 * "french" -> ["fr", "re", "en", "nc", "ch"]
 */
function generateBigrams(word: string): string[] {
  const normalized = normalizeWord(word);
  if (normalized.length < 2) return [];

  const bigrams: string[] = [];
  for (let i = 0; i < normalized.length - 1; i++) {
    bigrams.push(normalized.substring(i, i + 2));
  }
  return bigrams;
}

/**
 * Build text index from elements
 */
export function buildTextIndex(
  elementsById: Map<string, GDSMElement>
): TextIndex {
  const wordToElements = new Map<string, Set<string>>();
  const bigramToElements = new Map<string, Set<string>>();

  elementsById.forEach((element) => {
    if (!element.text || element.text.length === 0) return;

    const words = extractWords(element.text);

    // Index each word
    words.forEach((word) => {
      // Add to word index
      let wordSet = wordToElements.get(word);
      if (!wordSet) {
        wordSet = new Set();
        wordToElements.set(word, wordSet);
      }
      wordSet.add(element.id);

      // Add bigrams for partial matching
      const bigrams = generateBigrams(word);
      bigrams.forEach((bigram) => {
        let bigramSet = bigramToElements.get(bigram);
        if (!bigramSet) {
          bigramSet = new Set();
          bigramToElements.set(bigram, bigramSet);
        }
        bigramSet.add(element.id);
      });
    });
  });

  return { wordToElements, bigramToElements };
}

/**
 * Search the text index for a word (exact match)
 * Returns set of element IDs that contain the word
 */
export function searchWord(
  index: TextIndex,
  word: string
): Set<string> {
  const normalized = normalizeWord(word);
  return index.wordToElements.get(normalized) || new Set();
}

/**
 * Search the text index for partial match using bigrams
 * Returns set of element IDs that might contain the partial word
 */
export function searchPartial(
  index: TextIndex,
  partial: string
): Set<string> {
  const bigrams = generateBigrams(partial);
  if (bigrams.length === 0) return new Set();

  // Start with first bigram
  let result = new Set(index.bigramToElements.get(bigrams[0]) || []);

  // Intersect with remaining bigrams
  for (let i = 1; i < bigrams.length && result.size > 0; i++) {
    const bigramSet = index.bigramToElements.get(bigrams[i]) || new Set();
    result = new Set([...result].filter((id) => bigramSet.has(id)));
  }

  return result;
}

/**
 * Add an element to the text index
 */
export function addToIndex(
  index: TextIndex,
  element: GDSMElement
): void {
  if (!element.text || element.text.length === 0) return;

  const words = extractWords(element.text);

  words.forEach((word) => {
    // Add to word index
    let wordSet = index.wordToElements.get(word);
    if (!wordSet) {
      wordSet = new Set();
      index.wordToElements.set(word, wordSet);
    }
    wordSet.add(element.id);

    // Add bigrams
    const bigrams = generateBigrams(word);
    bigrams.forEach((bigram) => {
      let bigramSet = index.bigramToElements.get(bigram);
      if (!bigramSet) {
        bigramSet = new Set();
        index.bigramToElements.set(bigram, bigramSet);
      }
      bigramSet.add(element.id);
    });
  });
}

/**
 * Remove an element from the text index
 */
export function removeFromIndex(
  index: TextIndex,
  element: GDSMElement
): void {
  if (!element.text || element.text.length === 0) return;

  const words = extractWords(element.text);

  words.forEach((word) => {
    // Remove from word index
    const wordSet = index.wordToElements.get(word);
    if (wordSet) {
      wordSet.delete(element.id);
      if (wordSet.size === 0) {
        index.wordToElements.delete(word);
      }
    }

    // Remove from bigram index
    const bigrams = generateBigrams(word);
    bigrams.forEach((bigram) => {
      const bigramSet = index.bigramToElements.get(bigram);
      if (bigramSet) {
        bigramSet.delete(element.id);
        if (bigramSet.size === 0) {
          index.bigramToElements.delete(bigram);
        }
      }
    });
  });
}

/**
 * Update an element in the text index (remove old text, add new)
 */
export function updateIndex(
  index: TextIndex,
  oldElement: GDSMElement,
  newElement: GDSMElement
): void {
  removeFromIndex(index, oldElement);
  addToIndex(index, newElement);
}

/**
 * Check if an element contains a word as a standalone word (not substring)
 * This is the EXACT WORD matching that was requested
 */
export function containsExactWord(text: string, word: string): boolean {
  const normalizedWord = normalizeWord(word);
  const words = extractWords(text);
  return words.includes(normalizedWord);
}

/**
 * Get index statistics
 */
export function getIndexStats(index: TextIndex): {
  wordCount: number;
  bigramCount: number;
  avgElementsPerWord: number;
} {
  let totalElements = 0;
  index.wordToElements.forEach((set) => {
    totalElements += set.size;
  });

  return {
    wordCount: index.wordToElements.size,
    bigramCount: index.bigramToElements.size,
    avgElementsPerWord:
      index.wordToElements.size > 0
        ? totalElements / index.wordToElements.size
        : 0,
  };
}
