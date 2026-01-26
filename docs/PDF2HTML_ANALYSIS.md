# PDF2HTML Conversion Analysis

## Overview

This document explains how pdf2htmlEX converts PDFs to HTML and how the Canon codebase processes, accesses, and manages the resulting elements.

## 1. PDF to HTML Conversion

### Conversion Process (`app/api/convert/route.ts`)

The conversion happens server-side using `pdf2htmlEX`:

```typescript
// Key conversion parameters:
--zoom 1.0              // Pixel-perfect accuracy (72 DPI matches PDF standard)
--embed-css 1           // Self-contained HTML
--embed-font 1          // Embed fonts
--embed-image 1         // Embed images
--embed-javascript 1    // Embed JS
```

**Output Structure:**
- Each page is wrapped in a container: `.pf` (page frame) or `.pc` (page container)
- Text elements use classes like:
  - `.t` = text lines (most common)
  - `.c` = character spans
  - `span` = generic text wrappers
  - `[class*="ff"]` = font-family classes
  - `[class*="fc"]` = font-color classes
  - `[class*="fs"]` = font-size classes
  - `[class*="ls"]` = letter-spacing classes
  - `[class*="ws"]` = word-spacing classes

## 2. Element Access & ID Assignment

### ID Assignment Strategy (`components/editor/pdf-viewer.tsx`)

**Location:** Injected script in the iframe (lines 77-100)

**Process:**
1. **Initial Assignment** (on page load):
   ```javascript
   function assignCanonIds() {
     var pages = document.querySelectorAll('.pf, .pc');
     var idCounter = 0;
     var allElements = document.querySelectorAll(SELECTABLE_SELECTORS + ', div.t');
     
     allElements.forEach(function(el) {
       // Skip if already has ID
       if (el.dataset && el.dataset.canonId) return;
       // Skip if no text
       if (!el.textContent || !el.textContent.trim()) return;
       // Skip page containers
       if (el.classList && (el.classList.contains('pf') || el.classList.contains('pc'))) return;
       
       var page = el.closest('.pf, .pc');
       var pageNum = page ? Array.from(pages).indexOf(page) + 1 : 0;
       el.dataset.canonId = 'pf' + pageNum + '-el-' + (idCounter++);
     });
   }
   ```

2. **ID Format:** `pf{pageNumber}-el-{counter}`
   - Example: `pf1-el-42` = page 1, element 42
   - Counter increments globally across all pages

3. **Re-assignment Triggers:**
   - On initial load
   - After 500ms, 1500ms, 3000ms (catches dynamically loaded content)
   - Via MutationObserver (watches for DOM changes)

**Key Selectors for ID Assignment:**
```javascript
const SELECTABLE_SELECTORS = '.t, .c, span, [class*="ff"], [class*="fc"], [class*="fs"], [class*="ls"], [class*="ws"]';
```

### Element Access Methods

**1. By ID (Primary Method):**
```javascript
const el = document.querySelector('[data-canon-id="pf1-el-42"]');
```

**2. Finding Selectable Parent (lines 132-166):**
```javascript
function getSelectableParent(el) {
  // First, check if clicked element or ancestor has data-canon-id
  // These are our leaf elements and should be preferred
  var current = el;
  while (current && current !== document.body) {
    if (current.dataset && current.dataset.canonId) {
      return current;  // Found a leaf element with ID
    }
    current = current.parentElement;
  }
  
  // Fallback: walk up to find a selectable element
  // (matches SELECTABLE_SELECTORS)
}
```

**3. Leaf Element Detection (lines 421-455):**
```javascript
function getElementsInDragBox(boxRect) {
  // First pass: find all intersecting elements with IDs
  var elements = document.querySelectorAll('[data-canon-id]');
  
  // Second pass: filter to leaf elements only
  // (don't include parents of other selected elements)
  var result = intersecting.filter(function(el) {
    for (var i = 0; i < intersecting.length; i++) {
      var other = intersecting[i];
      if (other !== el && el.contains(other)) {
        return false; // el contains other, skip el
      }
    }
    return true;
  });
}
```

## 3. Parent-Child-Leaf Element Relationships

### Nested Structure Problem

pdf2htmlEX creates deeply nested HTML structures where:
- **Parent elements** contain child elements
- **Child elements** contain their own text
- **Text duplication** occurs because parent.textContent includes all descendant text

**Example Structure:**
```html
<div class="t">                    <!-- Parent (has ID) -->
  <span class="c">                <!-- Child (has ID) -->
    <span class="ff1">Hello</span> <!-- Leaf (has ID) -->
  </span>
</div>
```

**Problem:**
- Parent `.t` has textContent: "Hello"
- Child `.c` has textContent: "Hello"  
- Leaf `.ff1` has textContent: "Hello"
- All three get IDs, but they represent the same text!

### Leaf Element Strategy

**Two Approaches in Codebase:**

**A. Client-Side (iframe script) - Lines 421-455:**
- Filters to leaf elements when drag-selecting
- Checks if element contains other selected elements
- If parent contains child, exclude parent

**B. Server-Side (context extraction) - `lib/agent/context.ts` lines 50-92:**
```typescript
// Strategy: Only assign IDs to LEAF elements (innermost text containers)
const leafElements = new Set<Element>();

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
  }
});
```

**Leaf Detection Logic:**
1. Element has direct text nodes (nodeType === 3)
2. Element has NO child elements with direct text
3. If both true → it's a leaf element

## 4. Duplicate Content Handling

### Problem: Text Duplication

pdf2htmlEX sometimes creates nested structures where text appears duplicated:
- Parent contains: "Hello World Hello World"
- This happens because parent.textContent includes child text twice

### Deduplication Strategy

**Location:** `components/editor/pdf-viewer.tsx` lines 173-205

**Method: Recursive N-plication Deduplication**
```javascript
function getDirectTextContent(el) {
  if (!el) return '';
  var text = el.textContent ? el.textContent.trim() : '';
  // Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim();

  // Recursively deduplicate until stable
  // Handles duplication, triplication, etc. (any N-plication)
  var maxIterations = 10; // Safety limit
  for (var iter = 0; iter < maxIterations; iter++) {
    var len = text.length;
    var deduplicated = false;

    // Try to find a split point where left === right
    if (len >= 2) {
      for (var i = 1; i < len; i++) {
        var left = text.substring(0, i).trim();
        var right = text.substring(i).trim();
        if (left === right && left.length > 0) {
          text = left;
          deduplicated = true;
          break;
        }
      }
    }

    // If no deduplication happened, we're done
    if (!deduplicated) break;
  }

  return text;
}
```

**How It Works:**
1. Takes element's textContent
2. Normalizes whitespace (multiple spaces → single space)
3. Tries to find split point where first half === second half
4. If found, keeps only first half
5. Repeats until no more duplication found (max 10 iterations)

**Example:**
- Input: `"Hello World Hello World"`
- Iteration 1: Finds split at "Hello World | Hello World" → `"Hello World"`
- Iteration 2: No duplication found → Done

### Server-Side Deduplication

**Location:** `app/api/agent/route.ts` lines 79-107

**Two Methods:**

**Method 1: Direct String Repetition**
```typescript
// Check for "X X" pattern (same text repeated)
const halfLen = Math.floor(text.length / 2);
if (text.length >= 4) {
  for (let i = halfLen - 1; i <= halfLen + 1 && i > 0 && i < text.length; i++) {
    const firstPart = text.substring(0, i).trim();
    const secondPart = text.substring(i).trim();
    if (firstPart === secondPart && firstPart.length > 0) {
      text = firstPart;
      break;
    }
  }
}
```

**Method 2: Word-Based Deduplication**
```typescript
// e.g., "Hello World Hello World" → "Hello World"
const words = text.split(/\s+/).filter(w => w.length > 0);
if (words.length >= 2 && words.length % 2 === 0) {
  const half = words.length / 2;
  const firstHalf = words.slice(0, half).join(' ');
  const secondHalf = words.slice(half).join(' ');
  if (firstHalf === secondHalf) {
    text = firstHalf;
  }
}
```

## 5. Element Selection Flow

### Click Selection (lines 464-527)

1. User clicks on element
2. `getSelectableParent()` walks up DOM tree
3. Finds first element with `data-canon-id` (preferred - leaf element)
4. If not found, finds element matching `SELECTABLE_SELECTORS`
5. Assigns ID if missing: `generateId(el)`
6. Applies selection styles
7. Notifies parent via `postMessage`

### Drag Selection (lines 536-656)

1. User drags to create selection box
2. `getElementsInDragBox()` finds all elements with IDs intersecting box
3. **Leaf filtering:** Removes parents that contain other selected elements
4. Applies selection to all leaf elements
5. Notifies parent with combined text

## 6. Key Data Attributes

| Attribute | Purpose | Example |
|-----------|---------|---------|
| `data-canon-id` | Unique identifier for element | `pf1-el-42` |
| `data-canon-redacted` | Marks element as redacted | `true` |
| `data-canon-original` | Stores original text before redaction | `"Hello World"` |
| `data-canon-highlighted` | Marks element as highlighted | `true` |
| `data-canon-comment` | Marks comment marker | `true` |
| `data-canon-comment-id` | Unique comment identifier | `comment-123` |
| `data-canon-comment-text` | Comment text content | `"Review this"` |

## 7. Summary

**Element Access:**
- Primary: `querySelector('[data-canon-id="..."]')`
- Fallback: Walk up DOM tree to find selectable parent

**ID Assignment:**
- Format: `pf{page}-el-{counter}`
- Assigned to all text-bearing elements matching selectors
- Re-assigned on DOM mutations

**Parent-Child-Leaf:**
- Problem: Nested structure causes duplicate IDs for same text
- Solution: Filter to leaf elements (no children with text)
- Applied in: drag selection, context extraction

**Duplicate Content:**
- Problem: Parent.textContent includes child text multiple times
- Solution: Recursive deduplication algorithm
- Applied in: `getDirectTextContent()`, `extractTextFromElement()`

**Key Insight:**
The codebase handles pdf2htmlEX's nested structure by:
1. Assigning IDs to all text elements
2. Filtering to leaf elements when needed
3. Deduplicating text content when reading
4. Using leaf elements for operations to avoid duplicates


