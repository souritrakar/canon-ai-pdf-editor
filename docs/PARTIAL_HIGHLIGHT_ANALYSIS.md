# Partial Text Highlighting Analysis

## Current State

**Current Implementation:**
- `highlight_element` tool highlights **entire elements only**
- Applies `background-color: rgba(255, 234, 0, 0.5)` to the whole element
- Works on elements identified by `data-canon-id`

**Code Location:** `components/editor/pdf-viewer.tsx` lines 882-894

```javascript
case 'highlight_element': {
  const el = document.querySelector('[data-canon-id="' + op.input.elementId + '"]');
  if (el) {
    el.style.setProperty('background-color', 'rgba(255, 234, 0, 0.5)', 'important');
    el.style.setProperty('border-radius', '2px', 'important');
    el.setAttribute('data-canon-highlighted', 'true');
  }
}
```

## The Challenge: Partial Text Highlighting

### Problem 1: Element Granularity

**Current Architecture:**
- Elements are **leaf elements** (smallest text containers)
- Each element has a single `data-canon-id`
- Elements may contain:
  - Direct text nodes
  - Child elements with their own text
  - Mixed content (text + child elements)

**Example Structure:**
```html
<span data-canon-id="pf1-el-42" class="t ff1 fc2">
  Hello World This is a sentence
</span>
```

If user wants to highlight just "World", you'd need to:
1. Split the text node: `"Hello "` + `"World"` + `" This is a sentence"`
2. Create new elements for each part
3. Preserve original styling/positioning
4. Assign new IDs to the split elements

### Problem 2: pdf2htmlEX Absolute Positioning

**Critical Constraint:**
- pdf2htmlEX uses **absolute positioning** for precise text placement
- Each element has specific `left`, `top`, `width`, `height` from PDF coordinates
- Breaking up an element could break the layout

**Example:**
```html
<span class="t" style="position:absolute; left:100px; top:200px; width:150px;">
  Hello World
</span>
```

If you split this into:
```html
<span style="position:absolute; left:100px; top:200px; width:50px;">Hello </span>
<span style="position:absolute; left:150px; top:200px; width:50px;">World</span>
```

You'd need to:
- Calculate exact pixel positions for each word/character
- Account for font metrics (character width varies)
- Handle line breaks correctly

### Problem 3: Parent-Child-Leaf Relationships

**Current Leaf Element Strategy:**
- System filters to leaf elements to avoid duplicates
- Leaf = element with direct text AND no children with text

**If You Split an Element:**
```html
<!-- Before -->
<span data-canon-id="pf1-el-42">Hello World</span>

<!-- After splitting -->
<span data-canon-id="pf1-el-42">Hello </span>
<span data-canon-id="pf1-el-999">World</span>  <!-- New element -->
```

**Issues:**
1. Original element ID (`pf1-el-42`) now points to partial text
2. New element needs new ID
3. Parent-child relationships change
4. Leaf detection logic might break
5. Text extraction becomes more complex

## Potential Solutions

### Solution 1: Text Node Splitting (Most Accurate)

**Approach:**
1. Find the text node within the element
2. Split it at the desired boundaries
3. Wrap the highlighted portion in a new `<span>` with highlight styling
4. Keep original element structure intact

**Implementation Sketch:**
```javascript
function highlightPartialText(elementId, startIndex, endIndex) {
  const el = document.querySelector('[data-canon-id="' + elementId + '"]');
  if (!el) return false;

  // Find text nodes within element
  const walker = document.createTreeWalker(
    el,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );

  let textNode;
  let currentIndex = 0;
  
  while (textNode = walker.nextNode()) {
    const nodeLength = textNode.textContent.length;
    
    // Check if our range overlaps with this text node
    if (currentIndex + nodeLength >= startIndex && currentIndex < endIndex) {
      const nodeStart = Math.max(0, startIndex - currentIndex);
      const nodeEnd = Math.min(nodeLength, endIndex - currentIndex);
      
      // Split the text node
      const beforeText = textNode.textContent.substring(0, nodeStart);
      const highlightText = textNode.textContent.substring(nodeStart, nodeEnd);
      const afterText = textNode.textContent.substring(nodeEnd);
      
      // Create new nodes
      const beforeNode = document.createTextNode(beforeText);
      const afterNode = document.createTextNode(afterText);
      
      // Create highlight span
      const highlightSpan = document.createElement('span');
      highlightSpan.style.backgroundColor = 'rgba(255, 234, 0, 0.5)';
      highlightSpan.style.borderRadius = '2px';
      highlightSpan.setAttribute('data-canon-highlight-partial', 'true');
      highlightSpan.setAttribute('data-canon-parent-id', elementId);
      highlightSpan.textContent = highlightText;
      
      // Replace original text node with split nodes
      const parent = textNode.parentNode;
      if (beforeText) parent.insertBefore(beforeNode, textNode);
      parent.insertBefore(highlightSpan, textNode);
      if (afterText) parent.insertBefore(afterNode, textNode);
      parent.removeChild(textNode);
      
      break;
    }
    
    currentIndex += nodeLength;
  }
  
  return true;
}
```

**Pros:**
- Preserves original element structure
- Works with existing parent-child relationships
- Doesn't break absolute positioning (highlight span inherits positioning)

**Cons:**
- Complex to implement correctly
- Need to handle multiple text nodes
- Need to preserve all styling from parent
- Character index calculation is tricky with nested elements

### Solution 2: Range-Based Highlighting (Browser Native)

**Approach:**
Use browser's native `Range` API to select and highlight text

**Implementation Sketch:**
```javascript
function highlightTextRange(elementId, startOffset, endOffset) {
  const el = document.querySelector('[data-canon-id="' + elementId + '"]');
  if (!el) return false;

  const range = document.createRange();
  const selection = window.getSelection();
  
  // Find text node and set range
  const textNode = el.firstChild; // Simplified - need proper traversal
  range.setStart(textNode, startOffset);
  range.setEnd(textNode, endOffset);
  
  // Create highlight
  const highlightSpan = document.createElement('span');
  highlightSpan.style.backgroundColor = 'rgba(255, 234, 0, 0.5)';
  
  try {
    range.surroundContents(highlightSpan);
  } catch (e) {
    // Range might span multiple nodes - need to handle that
    const contents = range.extractContents();
    highlightSpan.appendChild(contents);
    range.insertNode(highlightSpan);
  }
  
  return true;
}
```

**Pros:**
- Browser handles text node splitting
- Works across element boundaries
- Native API, well-tested

**Cons:**
- Can break if range spans multiple elements
- Still need to preserve styling
- Complex with absolute positioning

### Solution 3: Character-Level Elements (Pre-split)

**Approach:**
Pre-process PDF to create character-level elements (like pdf2htmlEX's `.c` class)

**Current pdf2htmlEX Output:**
```html
<span class="t">Hello World</span>
```

**Desired:**
```html
<span class="c">H</span>
<span class="c">e</span>
<span class="c">l</span>
...
```

**Pros:**
- Each character is individually addressable
- Can highlight any substring precisely
- No splitting needed at highlight time

**Cons:**
- Requires modifying pdf2htmlEX conversion
- Creates many more elements (performance)
- Breaks existing ID assignment logic
- May not be available in all PDFs

## Recommendation: Hybrid Approach

### For Accurate Partial Highlighting:

1. **Use Text Node Splitting (Solution 1)**
   - Most compatible with current architecture
   - Preserves parent-child relationships
   - Works with absolute positioning

2. **Key Requirements:**
   - Calculate character positions within element
   - Handle multiple text nodes
   - Preserve all CSS from parent element
   - Assign temporary IDs to highlight spans
   - Track parent element ID for cleanup

3. **Implementation Considerations:**
   ```javascript
   // New tool: highlight_text_range
   {
     name: "highlight_text_range",
     description: "Highlight a specific portion of text within an element",
     input_schema: {
       type: "object",
       properties: {
         elementId: { type: "string" },
         startIndex: { type: "number" },  // Character index
         endIndex: { type: "number" },    // Character index
         // OR
         startText: { type: "string" },   // Text to find start
         endText: { type: "string" }      // Text to find end
       }
     }
   }
   ```

4. **Parent-Child-Leaf Handling:**
   - Highlight spans are **children** of original element
   - Original element keeps its `data-canon-id`
   - Highlight spans get `data-canon-highlight-partial="true"`
   - Leaf detection: Original element is still a leaf (has direct text)
   - Highlight spans are NOT leaves (they're styling wrappers)

## Accuracy Assessment

### ✅ **Can Work Accurately IF:**
1. You implement proper text node traversal
2. You preserve all parent element styling
3. You handle character index calculation correctly
4. You account for whitespace normalization
5. You test with various pdf2htmlEX output structures

### ⚠️ **Challenges:**
1. **Character Indexing:** Need to match user's text selection to actual DOM text (handles deduplication, whitespace)
2. **Multiple Text Nodes:** Element might have text split across multiple nodes
3. **Nested Elements:** Text might be in child elements, not direct text nodes
4. **Positioning:** Highlight span needs to inherit positioning correctly
5. **Cleanup:** Need way to remove partial highlights without breaking element

### ❌ **Won't Work Well IF:**
1. Text is in deeply nested child elements
2. Element has complex mixed content (text + images + other elements)
3. Absolute positioning calculations are off
4. Character width varies significantly (variable-width fonts)

## Conclusion

**Current State:** ❌ Partial highlighting **not supported** - only full element highlighting

**Feasibility:** ✅ **Yes, it can be done accurately** with proper implementation

**Best Approach:** Text node splitting with careful styling preservation

**Complexity:** Medium-High (requires careful DOM manipulation and styling preservation)

**Recommendation:** 
- Start with simple cases (single text node, no nested elements)
- Test thoroughly with various PDF structures
- Consider adding `highlight_text_range` tool alongside existing `highlight_element`
- Track parent element IDs for proper cleanup





