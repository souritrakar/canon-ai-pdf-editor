"use client";

import { useState, useCallback, forwardRef, useImperativeHandle, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { EditorMode } from "./toolbar";

export interface SelectedElement {
  id: string;
  tagName: string;
  textContent: string;
  className: string;
  rect: { x: number; y: number; width: number; height: number };
  count?: number; // For multi-selection
}

interface PDFViewerProps {
  className?: string;
  editorMode?: EditorMode;
  onElementSelect?: (element: SelectedElement | null) => void;
}

export interface PDFViewerRef {
  loadHtml: (html: string) => void;
  clear: () => void;
  clearSelection: () => void;
  getSelectedElement: () => SelectedElement | null;
  getHtml: () => string | null;
  redactElement: (elementId: string) => void;
  getIframeRef: () => React.RefObject<HTMLIFrameElement | null>;
}

// Script to inject into the iframe for element selection
const SELECTION_SCRIPT = `
<script>
(function() {
  let selectedElement = null;
  let selectedElements = []; // Multi-selection support
  let currentMode = 'select';
  const SELECTION_COLOR = '#EB4F34';
  const HOVER_COLOR = '#EB4F34';
  const HIGHLIGHT_COLOR = 'rgba(255, 234, 0, 0.4)';
  const COMMENT_COLOR = '#3B82F6'; // Blue for comments

  // Drag-to-select state (Canva-style)
  let isDragSelecting = false;
  let dragSelectStartX = 0;
  let dragSelectStartY = 0;
  let dragSelectBox = null;
  let dragStartTime = 0;

  // Highlight drawing state
  let isDrawingHighlight = false;
  let highlightStartX = 0;
  let highlightStartY = 0;
  let currentHighlightBox = null;
  let highlightCounter = 0;

  // Comment state
  let commentCounter = 0;
  let activeCommentInput = null;

  // Selectable elements in pdf2htmlEX output
  // COMPREHENSIVE selector to catch ALL text-bearing elements:
  // - .t = text lines (most common)
  // - .c = character spans
  // - span = generic spans (pdf2htmlEX wraps text in spans)
  // - div with text = divs containing text content
  // - [class*="ff"] = font-family classes
  // - [class*="fc"] = font-color classes
  // - [class*="fs"] = font-size classes
  // - [class*="ls"] = letter-spacing classes
  // - [class*="ws"] = word-spacing classes
  const SELECTABLE_SELECTORS = '.t, .c, span, [class*="ff"], [class*="fc"], [class*="fs"], [class*="ls"], [class*="ws"]';

  // Assign unique IDs to ALL text-bearing elements (no filtering)
  // Deduplication happens when reading text, not when assigning IDs
  function assignCanonIds() {
    var pages = document.querySelectorAll('.pf, .pc');
    var idCounter = 0;

    // Get all elements matching selectors
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

    if (idCounter > 0) {
      console.log('[Canon] Assigned IDs to ' + idCounter + ' elements');
    }
  }

  // Run on load and after any DOM mutations (for dynamic content)
  assignCanonIds();

  // Re-assign IDs after short delays to catch dynamically loaded content
  setTimeout(assignCanonIds, 500);
  setTimeout(assignCanonIds, 1500);
  setTimeout(assignCanonIds, 3000);

  // Use MutationObserver to catch any dynamically added elements
  var observer = new MutationObserver(function(mutations) {
    var shouldReassign = false;
    mutations.forEach(function(mutation) {
      if (mutation.addedNodes.length > 0) {
        shouldReassign = true;
      }
    });
    if (shouldReassign) {
      assignCanonIds();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // ===========================================
  // COORDINATE SYSTEM
  // Compute page-relative bounding boxes for all elements
  // ===========================================
  function computeCoordinates() {
    var pages = document.querySelectorAll('.pf, .pc');

    // Store page dimensions
    pages.forEach(function(page, pageIndex) {
      page.setAttribute('data-canon-page-num', String(pageIndex + 1));
      page.setAttribute('data-canon-page-width', String(page.offsetWidth));
      page.setAttribute('data-canon-page-height', String(page.offsetHeight));
    });

    // Compute element coordinates
    var elements = document.querySelectorAll('[data-canon-id]');
    elements.forEach(function(el) {
      var page = el.closest('.pf, .pc');
      if (!page) return;

      var pageRect = page.getBoundingClientRect();
      var elRect = el.getBoundingClientRect();

      // Page-relative coordinates (origin: top-left of page)
      var x = elRect.left - pageRect.left;
      var y = elRect.top - pageRect.top;

      el.setAttribute('data-canon-x', x.toFixed(1));
      el.setAttribute('data-canon-y', y.toFixed(1));
      el.setAttribute('data-canon-width', elRect.width.toFixed(1));
      el.setAttribute('data-canon-height', elRect.height.toFixed(1));
      el.setAttribute('data-canon-page', page.getAttribute('data-canon-page-num') || '1');
    });

    console.log('[Canon] Computed coordinates for ' + elements.length + ' elements');
    window.parent.postMessage({ type: 'canon-coordinates-ready', count: elements.length }, '*');
  }

  // Schedule coordinate computation after fonts load
  function scheduleCoordinateComputation() {
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function() {
        requestAnimationFrame(computeCoordinates);
      });
    } else {
      setTimeout(computeCoordinates, 1000);
    }
  }

  // Compute coordinates after IDs are assigned
  scheduleCoordinateComputation();

  // Recompute coordinates on window resize (debounced)
  var resizeTimeout = null;
  window.addEventListener('resize', function() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(computeCoordinates, 250);
  });

  function isRedacted(el) {
    return el && el.hasAttribute && el.hasAttribute('data-canon-redacted');
  }

  function getSelectableParent(el) {
    // First, check if the clicked element or any ancestor has data-canon-id
    // These are our leaf elements and should be preferred
    var current = el;
    while (current && current !== document.body) {
      if (isRedacted(current)) {
        return null;
      }
      if (current.dataset && current.dataset.canonId) {
        return current;
      }
      current = current.parentElement;
    }

    // Fallback: walk up to find a selectable element
    current = el;
    while (current && current !== document.body) {
      if (isRedacted(current)) {
        return null;
      }
      if (current.matches && current.matches(SELECTABLE_SELECTORS)) {
        return current;
      }
      if (current.tagName === 'DIV' && current.childNodes.length > 0) {
        var hasDirectText = Array.from(current.childNodes).some(
          function(n) { return n.nodeType === 3 && n.textContent.trim(); }
        );
        if (hasDirectText || current.classList.contains('t')) {
          return current;
        }
      }
      current = current.parentElement;
    }
    return null;
  }

  function generateId(el) {
    const index = Array.from(document.querySelectorAll(el.tagName)).indexOf(el);
    return el.tagName.toLowerCase() + '-' + index + '-' + Date.now();
  }

  // Get the text content of an element, with N-plication deduplication
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

  function notifyParent(el) {
    if (!el) {
      window.parent.postMessage({ type: 'canon-element-select', element: null }, '*');
      return;
    }
    const rect = el.getBoundingClientRect();
    window.parent.postMessage({
      type: 'canon-element-select',
      element: {
        id: el.dataset.canonId || generateId(el),
        tagName: el.tagName,
        textContent: getDirectTextContent(el).substring(0, 500),
        className: el.className,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
      }
    }, '*');
  }

  // Apply selection style directly to element
  function applySelection(el) {
    if (!el) return;

    // Store original styles before modifying (critical for pdf2htmlEX absolute positioning)
    const computed = window.getComputedStyle(el);
    if (!el.hasAttribute('data-canon-original-position')) {
      el.setAttribute('data-canon-original-position', el.style.position || '');
      el.setAttribute('data-canon-original-zindex', el.style.zIndex || '');
      el.setAttribute('data-canon-original-bgcolor', el.style.backgroundColor || '');
    }

    // Use outline which doesn't affect layout
    el.style.outline = '2px solid ' + SELECTION_COLOR;
    el.style.outlineOffset = '2px';
    el.style.cursor = 'pointer';

    // Only add background highlight - don't change position or z-index
    // as this breaks pdf2htmlEX absolute positioning
    el.style.backgroundColor = 'rgba(235, 79, 52, 0.08)';
  }

  function clearSelection(el) {
    if (!el || isRedacted(el)) return;

    // Clear selection outline styles
    el.style.outline = '';
    el.style.outlineOffset = '';
    el.style.cursor = '';

    // Don't reset background if element has been highlighted by agent
    if (el.hasAttribute('data-canon-highlighted')) {
      // Just clean up stored attributes, keep the highlight
      el.removeAttribute('data-canon-original-bgcolor');
      el.removeAttribute('data-canon-original-position');
      el.removeAttribute('data-canon-original-zindex');
      return;
    }

    // Restore original background color (only for non-highlighted elements)
    const originalBgColor = el.getAttribute('data-canon-original-bgcolor');
    if (originalBgColor !== null) {
      el.style.backgroundColor = originalBgColor;
      el.removeAttribute('data-canon-original-bgcolor');
    } else {
      el.style.backgroundColor = '';
    }

    // Clean up stored attributes
    el.removeAttribute('data-canon-original-position');
    el.removeAttribute('data-canon-original-zindex');
  }

  // Apply hover style directly to element
  function applyHover(el) {
    if (!el || isRedacted(el)) return;
    // Use outline for hover - doesn't affect layout
    el.style.outline = '1px solid ' + HOVER_COLOR;
    el.style.outlineOffset = '1px';
    el.style.cursor = 'pointer';
  }

  function clearHover(el) {
    if (!el || isRedacted(el)) return;
    // Only clear hover styles, not selection styles
    if (el !== selectedElement && !selectedElements.includes(el)) {
      el.style.outline = '';
      el.style.outlineOffset = '';
    }
    el.style.cursor = '';
  }

  // Clear all selected elements
  function clearAllSelections() {
    if (selectedElement) {
      clearSelection(selectedElement);
      selectedElement = null;
    }
    selectedElements.forEach(function(el) {
      clearSelection(el);
    });
    selectedElements = [];
  }

  // Apply selection to multiple elements
  function applyMultiSelection(elements) {
    elements.forEach(function(el) {
      if (!el.dataset.canonId) {
        el.dataset.canonId = generateId(el);
      }
      applySelection(el);
    });
  }

  // Notify parent about selected elements (single or multi)
  function notifyParentMulti(elements) {
    if (elements.length === 0) {
      window.parent.postMessage({ type: 'canon-element-select', element: null }, '*');
      return;
    }

    if (elements.length === 1) {
      // Single selection - use existing format
      const el = elements[0];
      const rect = el.getBoundingClientRect();
      window.parent.postMessage({
        type: 'canon-element-select',
        element: {
          id: el.dataset.canonId,
          tagName: el.tagName,
          textContent: getDirectTextContent(el).substring(0, 500),
          className: el.className,
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
        }
      }, '*');
    } else {
      // Multi-selection - combine text content
      const combinedText = elements.map(function(el) {
        return getDirectTextContent(el);
      }).join(' ').substring(0, 500);

      const firstRect = elements[0].getBoundingClientRect();
      window.parent.postMessage({
        type: 'canon-element-select',
        element: {
          id: elements.map(function(el) { return el.dataset.canonId; }).join(','),
          tagName: 'MULTI',
          textContent: combinedText,
          className: 'multi-selection',
          rect: { x: firstRect.x, y: firstRect.y, width: firstRect.width, height: firstRect.height },
          count: elements.length
        }
      }, '*');
    }
  }

  // Create drag selection box
  function createDragSelectBox(x, y) {
    const box = document.createElement('div');
    box.className = 'canon-drag-select-box';
    box.style.cssText = 'position: fixed; border: 2px dashed ' + SELECTION_COLOR + '; background: rgba(235, 79, 52, 0.1); pointer-events: none; z-index: 10000;';
    box.style.left = x + 'px';
    box.style.top = y + 'px';
    box.style.width = '0px';
    box.style.height = '0px';
    return box;
  }

  // Check if element intersects with selection box
  // Uses a more lenient approach to catch elements that might have weird positioning
  function elementIntersectsBox(el, boxRect) {
    const elRect = el.getBoundingClientRect();

    // Skip elements with zero dimensions (invisible)
    if (elRect.width === 0 && elRect.height === 0) {
      return false;
    }

    // Standard intersection check
    return !(elRect.right < boxRect.left ||
             elRect.left > boxRect.right ||
             elRect.bottom < boxRect.top ||
             elRect.top > boxRect.bottom);
  }

  // Check if element has meaningful text content (directly or via text nodes)
  function hasSelectableText(el) {
    if (!el) return false;

    // Check direct text content
    var text = el.textContent ? el.textContent.trim() : '';
    if (!text) return false;

    // Check if element has direct text nodes (not just child elements with text)
    var hasDirectText = false;
    for (var i = 0; i < el.childNodes.length; i++) {
      var node = el.childNodes[i];
      if (node.nodeType === 3 && node.textContent && node.textContent.trim()) {
        hasDirectText = true;
        break;
      }
    }

    // If it has direct text nodes, it's selectable
    if (hasDirectText) return true;

    // If it matches selectable selectors, it's selectable
    if (el.matches && el.matches(SELECTABLE_SELECTORS)) return true;

    // DIV with .t class is selectable
    if (el.tagName === 'DIV' && el.classList && el.classList.contains('t')) return true;

    return false;
  }

  // Find all selectable elements within the drag box
  // Filter to leaf elements (no children with IDs) to avoid duplicates
  function getElementsInDragBox(boxRect) {
    var elements = document.querySelectorAll('[data-canon-id]');
    var intersecting = [];

    // First pass: find all intersecting elements
    elements.forEach(function(el) {
      if (isRedacted(el)) return;

      var rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;

      var intersects = !(rect.right < boxRect.left ||
                         rect.left > boxRect.right ||
                         rect.bottom < boxRect.top ||
                         rect.top > boxRect.bottom);

      if (intersects) {
        intersecting.push(el);
      }
    });

    // Second pass: filter to leaf elements only (don't include parents of other selected elements)
    var result = intersecting.filter(function(el) {
      for (var i = 0; i < intersecting.length; i++) {
        var other = intersecting[i];
        if (other !== el && el.contains(other)) {
          return false; // el contains other, skip el
        }
      }
      return true;
    });

    return result;
  }

  // Click handler
  let hoverElement = null;

  // Track if we should skip the next click (after drag)
  let skipNextClick = false;

  // We use mousedown/mouseup for drag selection, click is handled here for single elements
  document.addEventListener('click', function(e) {
    // Only handle clicks in select or redact mode
    if (currentMode !== 'select' && currentMode !== 'redact') return;

    // Skip this click if it was part of a drag
    if (skipNextClick) {
      skipNextClick = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // Check if we just finished dragging
    if (isDragSelecting) {
      skipNextClick = true;
      return;
    }

    const target = getSelectableParent(e.target);

    // Clear hover on click
    if (hoverElement) {
      clearHover(hoverElement);
      hoverElement = null;
    }

    // In redact mode, redact on click
    if (currentMode === 'redact' && target) {
      // Redaction is handled by parent
      return;
    }

    // If we have multi-selection and clicked on one of them, just use that element
    if (selectedElements.length > 1 && target && selectedElements.includes(target)) {
      // Clear multi-selection but keep clicked element
      selectedElements.forEach(function(el) {
        if (el !== target) clearSelection(el);
      });
      selectedElements = [];
      selectedElement = target;
      notifyParent(target);
      return;
    }

    if (selectedElement === target && selectedElements.length === 0) {
      // Clicking same single element deselects
      clearSelection(selectedElement);
      selectedElement = null;
      notifyParent(null);
      return;
    }

    // Clear all previous selections
    clearAllSelections();

    selectedElement = target;
    if (target) {
      if (!target.dataset.canonId) {
        target.dataset.canonId = generateId(target);
      }
      applySelection(target);
    }
    notifyParent(target);
  }, true);

  // Prevent default drag behavior on images and other elements
  document.addEventListener('dragstart', function(e) {
    if (currentMode === 'select') {
      e.preventDefault();
    }
  }, true);

  // Drag-to-select: mousedown starts potential drag
  document.addEventListener('mousedown', function(e) {
    // Only in select mode
    if (currentMode !== 'select') return;

    // Prevent default to stop image dragging
    e.preventDefault();

    // Record start position for potential drag
    dragStartTime = Date.now();
    dragSelectStartX = e.clientX;
    dragSelectStartY = e.clientY;
    isDragSelecting = false; // Will become true if user moves enough

    // Change cursor to crosshair while potentially dragging
    document.body.style.cursor = 'crosshair';
  }, true);

  // Drag-to-select: mousemove updates the box
  document.addEventListener('mousemove', function(e) {
    if (currentMode !== 'select') return;

    // Check if mouse button is held down (e.buttons === 1 means left button)
    if (e.buttons !== 1) return;

    const currentX = e.clientX;
    const currentY = e.clientY;
    const deltaX = Math.abs(currentX - dragSelectStartX);
    const deltaY = Math.abs(currentY - dragSelectStartY);

    // Start drag if moved more than 10px (threshold to distinguish click from drag)
    if (!isDragSelecting && (deltaX > 10 || deltaY > 10)) {
      isDragSelecting = true;
      // Clear previous selections when starting drag
      clearAllSelections();
      // Create selection box at original start position
      dragSelectBox = createDragSelectBox(dragSelectStartX, dragSelectStartY);
      document.body.appendChild(dragSelectBox);
    }

    if (!isDragSelecting || !dragSelectBox) return;

    e.preventDefault();

    // Calculate box dimensions (handle dragging in any direction)
    const left = Math.min(dragSelectStartX, currentX);
    const top = Math.min(dragSelectStartY, currentY);
    const width = Math.abs(currentX - dragSelectStartX);
    const height = Math.abs(currentY - dragSelectStartY);

    dragSelectBox.style.left = left + 'px';
    dragSelectBox.style.top = top + 'px';
    dragSelectBox.style.width = width + 'px';
    dragSelectBox.style.height = height + 'px';

    // Preview: highlight elements that would be selected
    const boxRect = {
      left: left,
      top: top,
      right: left + width,
      bottom: top + height
    };

    // Clear previous preview highlights
    selectedElements.forEach(function(el) {
      clearSelection(el);
    });

    // Find and preview elements
    const elementsInBox = getElementsInDragBox(boxRect);
    elementsInBox.forEach(function(el) {
      applySelection(el);
    });
    selectedElements = elementsInBox;
  }, true);

  // Helper to cancel drag selection and clean up
  function cancelDragSelect() {
    if (dragSelectBox) {
      dragSelectBox.remove();
      dragSelectBox = null;
    }
    isDragSelecting = false;
    document.body.style.cursor = 'default';
  }

  // Drag-to-select: mouseup finalizes selection
  document.addEventListener('mouseup', function(e) {
    if (currentMode !== 'select') return;

    // Reset cursor
    document.body.style.cursor = 'default';

    // If we were drag selecting, finalize it
    if (isDragSelecting && dragSelectBox) {
      e.preventDefault();
      e.stopPropagation();

      // Set flag to skip the click event that follows mouseup
      skipNextClick = true;

      // Remove the drag box
      dragSelectBox.remove();
      dragSelectBox = null;

      if (selectedElements.length > 0) {
        // Successful drag selection
        // Set single selectedElement for backwards compatibility
        selectedElement = selectedElements.length === 1 ? selectedElements[0] : null;
        notifyParentMulti(selectedElements);
      } else {
        // Drag but no elements selected
        notifyParentMulti([]);
      }

      // Small delay before clearing isDragSelecting
      setTimeout(function() {
        isDragSelecting = false;
      }, 50);
    }
  }, true);

  // Cancel drag on scroll (box position becomes invalid)
  window.addEventListener('scroll', function() {
    if (isDragSelecting) {
      cancelDragSelect();
      clearAllSelections();
    }
  }, true);

  // Cancel drag if mouse leaves document
  document.addEventListener('mouseleave', function() {
    if (isDragSelecting) {
      cancelDragSelect();
    }
  }, true);

  // Also handle blur (window loses focus)
  window.addEventListener('blur', function() {
    cancelDragSelect();
  });

  // Hover effect
  document.addEventListener('mouseover', function(e) {
    // Only show hover in select or redact mode
    if (currentMode !== 'select' && currentMode !== 'redact') {
      e.target.style.cursor = '';
      return;
    }

    const target = getSelectableParent(e.target);

    if (target === hoverElement || target === selectedElement) {
      // If hovering over a selectable element, show pointer cursor
      if (target && target !== selectedElement) {
        target.style.cursor = 'pointer';
      }
      return;
    }

    // Clear previous hover
    if (hoverElement && hoverElement !== selectedElement) {
      clearHover(hoverElement);
    }

    hoverElement = target;

    if (target && target !== selectedElement) {
      applyHover(target);
    } else if (!target) {
      // If not over a selectable element, reset cursor
      e.target.style.cursor = '';
    }
  }, true);

  document.addEventListener('mouseout', function(e) {
    // Only handle in select or redact mode
    if (currentMode !== 'select' && currentMode !== 'redact') return;

    const target = getSelectableParent(e.target);
    if (target && target === hoverElement && target !== selectedElement) {
      clearHover(target);
      hoverElement = null;
    }
    // Reset cursor when leaving elements
    if (e.target.style && e.target !== selectedElement && e.target !== hoverElement) {
      e.target.style.cursor = '';
    }
  }, true);

  // Listen for commands from parent
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'canon-clear-selection') {
      clearAllSelections();
    }

    // Handle mode change
    if (e.data && e.data.type === 'canon-set-mode') {
      currentMode = e.data.mode || 'select';
      // Close any active comment input when switching modes
      if (activeCommentInput) {
        activeCommentInput.remove();
        activeCommentInput = null;
      }
      // Update cursor based on mode
      if (currentMode === 'highlight' || currentMode === 'comment') {
        document.body.style.cursor = 'crosshair';
      } else if (currentMode === 'select' || currentMode === 'redact') {
        // In select/redact mode, cursor will be set to pointer on hover
        document.body.style.cursor = 'default';
      } else {
        document.body.style.cursor = 'default';
      }
    }

    // Handle redact element command
    if (e.data && e.data.type === 'canon-redact-element') {
      const elementId = e.data.elementId;
      if (!elementId) return;

      // Find the element by data-canon-id
      const el = document.querySelector('[data-canon-id="' + elementId + '"]');
      if (!el) return;

      // Clear selection first if this is the selected element
      if (selectedElement === el) {
        clearSelection(selectedElement);
        selectedElement = null;
      }

      // Apply true redaction - completely destroy text and use black background
      const originalText = el.textContent || '';

      // Get dimensions BEFORE any modifications using offsetWidth/Height
      const originalWidth = el.offsetWidth;
      const originalHeight = el.offsetHeight;

      // Store original text as data attribute (for undo functionality later)
      el.setAttribute('data-canon-redacted', 'true');
      el.setAttribute('data-canon-original', originalText);

      // Clear the text content
      el.textContent = '';

      // Apply black background with fixed dimensions
      el.style.backgroundColor = '#000000';
      el.style.display = 'inline-block';
      el.style.width = originalWidth + 'px';
      el.style.height = originalHeight + 'px';
      el.style.overflow = 'hidden';
      el.style.outline = '';
      el.style.outlineOffset = '';

      // Notify parent that redaction is complete
      window.parent.postMessage({
        type: 'canon-redaction-complete',
        elementId: elementId,
        textContent: ''
      }, '*');
    }

    // Handle scroll to page command
    if (e.data && e.data.type === 'canon-scroll-to-page') {
      const pageIndex = e.data.pageIndex;
      const pages = document.querySelectorAll('.pf');
      const targetPage = pages[pageIndex];

      if (targetPage) {
        targetPage.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Notify parent that scroll is complete
        window.parent.postMessage({
          type: 'canon-page-scrolled',
          pageIndex: pageIndex
        }, '*');
      }
    }

    // Handle get page count request
    if (e.data && e.data.type === 'canon-get-pages') {
      const pages = document.querySelectorAll('.pf');
      window.parent.postMessage({
        type: 'canon-pages-info',
        pageCount: pages.length
      }, '*');
    }

    // Handle agent operations (tool calls from AI)
    if (e.data && e.data.type === 'canon-execute-operation') {
      console.log('[Canon Iframe] Received operation:', e.data.operation);
      const op = e.data.operation;
      let result = { success: false, error: 'Unknown operation' };

      try {
        switch (op.tool) {
          case 'set_element_text': {
            const el = document.querySelector('[data-canon-id="' + op.input.elementId + '"]');
            if (el) {
              const newText = op.input.text;
              const originalText = el.textContent || '';

              console.log('[set_element_text] Element:', op.input.elementId);
              console.log('[set_element_text] Original:', originalText);
              console.log('[set_element_text] New:', newText);
              console.log('[set_element_text] Element HTML:', el.outerHTML.substring(0, 200));
              console.log('[set_element_text] Children count:', el.children.length);

              // For leaf elements (which should have no child elements with text),
              // we can safely use textContent as it preserves the element's own classes
              el.textContent = newText;

              result = { success: true, result: { originalText: originalText, newText: newText } };
            } else {
              result = { success: false, error: 'Element not found: ' + op.input.elementId };
            }
            break;
          }

          case 'redact_element': {
            const el = document.querySelector('[data-canon-id="' + op.input.elementId + '"]');
            if (el) {
              // Clear selection if this is selected
              if (selectedElement === el) {
                clearSelection(selectedElement);
                selectedElement = null;
              }
              // Apply redaction
              const originalText = el.textContent || '';
              const originalWidth = el.offsetWidth;
              const originalHeight = el.offsetHeight;
              el.setAttribute('data-canon-redacted', 'true');
              el.setAttribute('data-canon-original', originalText);
              el.textContent = '';
              el.style.backgroundColor = '#000000';
              el.style.display = 'inline-block';
              el.style.width = originalWidth + 'px';
              el.style.height = originalHeight + 'px';
              el.style.overflow = 'hidden';
              el.style.outline = '';
              el.style.outlineOffset = '';
              result = { success: true, result: { redacted: true, originalText: originalText } };
            } else {
              result = { success: false, error: 'Element not found: ' + op.input.elementId };
            }
            break;
          }

          case 'highlight_element': {
            const el = document.querySelector('[data-canon-id="' + op.input.elementId + '"]');
            if (el) {
              // Use setProperty with !important to override pdf2htmlEX styles
              el.style.setProperty('background-color', 'rgba(255, 234, 0, 0.5)', 'important');
              el.style.setProperty('border-radius', '2px', 'important');
              el.setAttribute('data-canon-highlighted', 'true');
              result = { success: true, result: { highlighted: true, elementId: op.input.elementId } };
            } else {
              result = { success: false, error: 'Element not found: ' + op.input.elementId };
            }
            break;
          }

          case 'add_comment': {
            const el = document.querySelector('[data-canon-id="' + op.input.elementId + '"]');
            if (el) {
              const rect = el.getBoundingClientRect();
              const page = findPageAtPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
              if (page) {
                const computedPosition = window.getComputedStyle(page).position;
                if (computedPosition === 'static') {
                  page.style.position = 'relative';
                }
                const pageRect = page.getBoundingClientRect();
                const x = rect.left - pageRect.left + rect.width;
                const y = rect.top - pageRect.top;
                const commentId = 'comment-ai-' + Date.now();
                const marker = createCommentMarker(x, y, page, commentId);
                marker.setAttribute('data-canon-comment-text', op.input.text);
                page.appendChild(marker);
                addTooltipToMarker(marker, page);
                result = { success: true, result: { commentId: commentId } };
              } else {
                result = { success: false, error: 'Could not find page for element' };
              }
            } else {
              result = { success: false, error: 'Element not found: ' + op.input.elementId };
            }
            break;
          }

          case 'delete_element': {
            const el = document.querySelector('[data-canon-id="' + op.input.elementId + '"]');
            if (el) {
              // Clear selection if this is selected
              if (selectedElement === el) {
                clearSelection(selectedElement);
                selectedElement = null;
              }
              const originalText = el.textContent || '';
              el.remove();
              result = { success: true, result: { deleted: true, originalText: originalText } };
            } else {
              result = { success: false, error: 'Element not found: ' + op.input.elementId };
            }
            break;
          }

          default:
            result = { success: false, error: 'Unknown tool: ' + op.tool };
        }
      } catch (err) {
        result = { success: false, error: err.message || 'Operation failed' };
      }

      // Send result back to parent
      window.parent.postMessage({
        type: 'canon-operation-result',
        operationId: op.id,
        success: result.success,
        result: result.result,
        error: result.error
      }, '*');
    }
  });

  // Highlight mode - drag to draw highlight boxes
  // Find the page element (.pf or .pc) that contains the given point
  let currentHighlightPage = null;

  function findPageAtPoint(x, y) {
    // pdf2htmlEX uses .pf (page frame) or .pc (page container) for pages
    const pages = document.querySelectorAll('.pf, .pc');
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const rect = page.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return page;
      }
    }
    // Return null if not on a page - don't allow interactions outside PDF pages
    return null;
  }

  function createHighlightBox(x, y, width, height) {
    const box = document.createElement('div');
    box.className = 'canon-highlight';
    box.setAttribute('data-canon-highlight', 'true');
    box.setAttribute('data-canon-highlight-id', 'highlight-' + (++highlightCounter) + '-' + Date.now());
    box.style.position = 'absolute';
    box.style.left = x + 'px';
    box.style.top = y + 'px';
    box.style.width = width + 'px';
    box.style.height = height + 'px';
    box.style.backgroundColor = HIGHLIGHT_COLOR;
    box.style.pointerEvents = 'none';
    box.style.zIndex = '1000';
    box.style.borderRadius = '2px';
    return box;
  }

  // Get coordinates relative to a specific page element
  function getPageCoords(e, page) {
    const rect = page.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  document.addEventListener('mousedown', function(e) {
    if (currentMode !== 'highlight') return;

    e.preventDefault();
    e.stopPropagation();

    // Find which page we're drawing on
    currentHighlightPage = findPageAtPoint(e.clientX, e.clientY);
    if (!currentHighlightPage) return;

    // Ensure the page has relative positioning for absolute children
    const computedPosition = window.getComputedStyle(currentHighlightPage).position;
    if (computedPosition === 'static') {
      currentHighlightPage.style.position = 'relative';
    }

    isDrawingHighlight = true;
    const coords = getPageCoords(e, currentHighlightPage);
    highlightStartX = coords.x;
    highlightStartY = coords.y;

    // Create initial highlight box and append to the page
    currentHighlightBox = createHighlightBox(highlightStartX, highlightStartY, 0, 0);
    currentHighlightPage.appendChild(currentHighlightBox);
  }, true);

  document.addEventListener('mousemove', function(e) {
    if (!isDrawingHighlight || currentMode !== 'highlight' || !currentHighlightBox || !currentHighlightPage) return;

    e.preventDefault();

    const coords = getPageCoords(e, currentHighlightPage);
    const currentX = coords.x;
    const currentY = coords.y;

    // Calculate box dimensions (handle dragging in any direction)
    const left = Math.min(highlightStartX, currentX);
    const top = Math.min(highlightStartY, currentY);
    const width = Math.abs(currentX - highlightStartX);
    const height = Math.abs(currentY - highlightStartY);

    currentHighlightBox.style.left = left + 'px';
    currentHighlightBox.style.top = top + 'px';
    currentHighlightBox.style.width = width + 'px';
    currentHighlightBox.style.height = height + 'px';
  }, true);

  document.addEventListener('mouseup', function(e) {
    if (!isDrawingHighlight || currentMode !== 'highlight') return;

    e.preventDefault();
    e.stopPropagation();

    isDrawingHighlight = false;

    // Remove highlight if too small (accidental click)
    if (currentHighlightBox) {
      const width = parseFloat(currentHighlightBox.style.width);
      const height = parseFloat(currentHighlightBox.style.height);

      if (width < 5 || height < 5) {
        currentHighlightBox.remove();
      } else {
        // Enable pointer events for interaction later (delete, etc)
        currentHighlightBox.style.pointerEvents = 'auto';
        currentHighlightBox.style.cursor = 'pointer';

        // Notify parent about the new highlight
        window.parent.postMessage({
          type: 'canon-highlight-created',
          highlightId: currentHighlightBox.getAttribute('data-canon-highlight-id'),
          rect: {
            x: parseFloat(currentHighlightBox.style.left),
            y: parseFloat(currentHighlightBox.style.top),
            width: width,
            height: height
          }
        }, '*');
      }
    }

    currentHighlightBox = null;
    currentHighlightPage = null;
  }, true);

  // Comment mode - click to add comments/annotations
  // Adobe Acrobat style sticky note icon
  function createCommentMarker(x, y, page, commentId) {
    const marker = document.createElement('div');
    marker.className = 'canon-comment-marker';
    marker.setAttribute('data-canon-comment', 'true');
    marker.setAttribute('data-canon-comment-id', commentId);
    marker.style.position = 'absolute';
    marker.style.left = x + 'px';
    marker.style.top = y + 'px';
    marker.style.width = '20px';
    marker.style.height = '20px';
    marker.style.cursor = 'pointer';
    marker.style.zIndex = '1001';
    marker.style.transition = 'transform 0.15s ease';

    // SVG sticky note icon (like Adobe Acrobat)
    marker.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="' + COMMENT_COLOR + '" style="filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/><path d="M4 4h16v12H5.17L4 17.17z" opacity="0.3"/></svg>';

    // Hover effect
    marker.addEventListener('mouseenter', function() {
      this.style.transform = 'scale(1.15)';
    });
    marker.addEventListener('mouseleave', function() {
      this.style.transform = 'scale(1)';
    });

    return marker;
  }

  // Create tooltip to show comment text on hover
  function createCommentTooltip(text, marker, page) {
    const tooltip = document.createElement('div');
    tooltip.className = 'canon-comment-tooltip';
    tooltip.style.position = 'absolute';
    tooltip.style.backgroundColor = '#FEF9C3'; // Yellow sticky note color
    tooltip.style.border = '1px solid #EAB308';
    tooltip.style.borderRadius = '4px';
    tooltip.style.padding = '8px 10px';
    tooltip.style.fontSize = '12px';
    tooltip.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    tooltip.style.color = '#1C1917';
    tooltip.style.maxWidth = '220px';
    tooltip.style.minWidth = '120px';
    tooltip.style.lineHeight = '1.4';
    tooltip.style.zIndex = '1003';
    tooltip.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
    tooltip.style.wordWrap = 'break-word';
    tooltip.style.whiteSpace = 'pre-wrap';
    tooltip.style.pointerEvents = 'none';

    // Position tooltip - smart positioning to avoid blocking content
    const markerLeft = parseFloat(marker.style.left);
    const markerTop = parseFloat(marker.style.top);
    const pageRect = page.getBoundingClientRect();
    const markerRect = marker.getBoundingClientRect();
    const tooltipWidth = 220;
    const tooltipHeight = 80; // Approximate height

    // Calculate available space in each direction
    const spaceRight = pageRect.width - markerLeft - 24;
    const spaceLeft = markerLeft;
    const spaceBelow = pageRect.height - markerTop;
    const spaceAbove = markerTop;

    // Horizontal positioning: prefer right, but go left if not enough space
    const markerWidth = 20; // Width of the marker icon
    const gap = 4; // Small gap between marker and tooltip
    if (spaceRight >= tooltipWidth) {
      // Position to the right of marker (close to the icon)
      tooltip.style.left = (markerLeft + markerWidth + gap) + 'px';
    } else if (spaceLeft >= tooltipWidth) {
      // Position to the left of marker
      tooltip.style.left = (markerLeft - tooltipWidth - gap) + 'px';
    } else {
      // Center it as best as possible
      tooltip.style.left = Math.max(4, (pageRect.width - tooltipWidth) / 2) + 'px';
    }

    // Vertical positioning: prefer same level, but adjust if near edges
    if (spaceBelow >= tooltipHeight) {
      tooltip.style.top = markerTop + 'px';
    } else if (spaceAbove >= tooltipHeight) {
      // Position above
      tooltip.style.top = (markerTop - tooltipHeight + 20) + 'px';
    } else {
      // Center vertically
      tooltip.style.top = Math.max(4, markerTop - tooltipHeight / 2) + 'px';
    }

    tooltip.textContent = text;
    return tooltip;
  }

  // Add hover tooltip functionality to a marker
  function addTooltipToMarker(marker, page) {
    let tooltip = null;

    marker.addEventListener('mouseenter', function() {
      const text = this.getAttribute('data-canon-comment-text');
      if (text && currentMode !== 'comment') {
        // Only show tooltip when not in comment mode (editing mode)
        tooltip = createCommentTooltip(text, this, page);
        page.appendChild(tooltip);
      }
    });

    marker.addEventListener('mouseleave', function() {
      if (tooltip) {
        tooltip.remove();
        tooltip = null;
      }
    });
  }

  function createCommentBubble(x, y, page, commentId, existingText) {
    const bubble = document.createElement('div');
    bubble.className = 'canon-comment-bubble';
    bubble.setAttribute('data-canon-comment-bubble', commentId);
    bubble.style.position = 'absolute';
    bubble.style.backgroundColor = '#FEF9C3'; // Yellow sticky note
    bubble.style.border = '1px solid #EAB308';
    bubble.style.borderRadius = '2px';
    bubble.style.boxShadow = '2px 2px 8px rgba(0,0,0,0.2)';
    bubble.style.zIndex = '1002';
    bubble.style.width = '200px';
    bubble.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    bubble.style.fontSize = '12px';

    // Header bar
    const header = document.createElement('div');
    header.style.backgroundColor = '#EAB308';
    header.style.padding = '4px 8px';
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.cursor = 'default';

    const title = document.createElement('span');
    title.textContent = 'Comment';
    title.style.fontSize = '11px';
    title.style.fontWeight = '500';
    title.style.color = '#422006';

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.background = 'none';
    closeBtn.style.border = 'none';
    closeBtn.style.fontSize = '16px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.color = '#422006';
    closeBtn.style.padding = '0';
    closeBtn.style.lineHeight = '1';

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Content area
    const content = document.createElement('div');
    content.style.padding = '8px';

    const textarea = document.createElement('textarea');
    textarea.placeholder = 'Type your comment...';
    textarea.value = existingText || '';
    textarea.style.width = '100%';
    textarea.style.minHeight = '80px';
    textarea.style.border = 'none';
    textarea.style.backgroundColor = 'transparent';
    textarea.style.padding = '0';
    textarea.style.fontSize = '12px';
    textarea.style.resize = 'none';
    textarea.style.outline = 'none';
    textarea.style.fontFamily = 'inherit';
    textarea.style.color = '#1C1917';
    textarea.style.lineHeight = '1.4';
    textarea.setAttribute('data-canon-comment-textarea', 'true');

    const buttonRow = document.createElement('div');
    buttonRow.style.display = 'flex';
    buttonRow.style.justifyContent = 'flex-end';
    buttonRow.style.gap = '6px';
    buttonRow.style.marginTop = '8px';
    buttonRow.style.paddingTop = '8px';
    buttonRow.style.borderTop = '1px solid #EAB308';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.padding = '4px 10px';
    cancelBtn.style.fontSize = '11px';
    cancelBtn.style.border = '1px solid #D97706';
    cancelBtn.style.borderRadius = '3px';
    cancelBtn.style.backgroundColor = 'transparent';
    cancelBtn.style.cursor = 'pointer';
    cancelBtn.style.color = '#92400E';

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Post';
    saveBtn.style.padding = '4px 10px';
    saveBtn.style.fontSize = '11px';
    saveBtn.style.border = 'none';
    saveBtn.style.borderRadius = '3px';
    saveBtn.style.backgroundColor = '#D97706';
    saveBtn.style.color = 'white';
    saveBtn.style.cursor = 'pointer';

    buttonRow.appendChild(cancelBtn);
    buttonRow.appendChild(saveBtn);

    content.appendChild(textarea);
    content.appendChild(buttonRow);

    bubble.appendChild(header);
    bubble.appendChild(content);

    // Calculate position - check if bubble would go off the right edge
    const pageRect = page.getBoundingClientRect();
    const bubbleWidth = 200;
    const rightSpace = pageRect.width - x;

    if (rightSpace < bubbleWidth + 30) {
      bubble.style.left = (x - bubbleWidth - 10) + 'px';
    } else {
      bubble.style.left = (x + 24) + 'px';
    }

    // Check vertical positioning
    const bubbleHeight = 160;
    const bottomSpace = pageRect.height - y;

    if (bottomSpace < bubbleHeight && y > bubbleHeight) {
      bubble.style.top = (y - bubbleHeight + 20) + 'px';
    } else {
      bubble.style.top = y + 'px';
    }

    // Prevent clicks inside bubble from creating new comments
    bubble.addEventListener('click', function(e) {
      e.stopPropagation();
    });

    // Close button acts like cancel
    closeBtn.addEventListener('click', function() {
      cancelBtn.click();
    });

    return { bubble, textarea, cancelBtn, saveBtn };
  }

  function showCommentInput(x, y, page, commentId, marker, existingText) {
    // Remove any existing input
    if (activeCommentInput) {
      activeCommentInput.remove();
      activeCommentInput = null;
    }

    const { bubble, textarea, cancelBtn, saveBtn } = createCommentBubble(x, y, page, commentId, existingText);
    page.appendChild(bubble);
    activeCommentInput = bubble;
    textarea.focus();

    cancelBtn.addEventListener('click', function() {
      bubble.remove();
      activeCommentInput = null;
      // If this was a new comment with no text, remove the marker too
      if (!existingText && marker) {
        const storedText = marker.getAttribute('data-canon-comment-text');
        if (!storedText) {
          marker.remove();
          uncommittedMarker = null;
        }
      }
    });

    saveBtn.addEventListener('click', function() {
      const text = textarea.value.trim();
      if (text) {
        marker.setAttribute('data-canon-comment-text', text);
        // Clear uncommitted marker tracking since it's now saved
        uncommittedMarker = null;
        // Notify parent
        window.parent.postMessage({
          type: 'canon-comment-saved',
          commentId: commentId,
          text: text
        }, '*');
      } else if (!existingText) {
        // Remove marker if no text and it's a new comment
        marker.remove();
        uncommittedMarker = null;
      }
      bubble.remove();
      activeCommentInput = null;
    });

    // Save on Enter (Shift+Enter for newline)
    textarea.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        saveBtn.click();
      }
      if (e.key === 'Escape') {
        cancelBtn.click();
      }
    });
  }

  // Track the current uncommitted marker (marker without saved text)
  let uncommittedMarker = null;

  // Comment mode click handler
  document.addEventListener('click', function(e) {
    if (currentMode !== 'comment') return;

    // Don't do anything if clicking inside the bubble
    if (e.target.closest('.canon-comment-bubble')) {
      return;
    }

    // If clicking on an existing marker, edit it
    const clickedMarker = e.target.closest('.canon-comment-marker');
    if (clickedMarker) {
      return; // Let the marker's own click handler deal with it
    }

    e.preventDefault();
    e.stopPropagation();

    // If there's an active comment input, cancel it first (clicking away = cancel)
    if (activeCommentInput) {
      activeCommentInput.remove();
      activeCommentInput = null;

      // Remove the uncommitted marker if it has no saved text
      if (uncommittedMarker) {
        const savedText = uncommittedMarker.getAttribute('data-canon-comment-text');
        if (!savedText) {
          uncommittedMarker.remove();
        }
        uncommittedMarker = null;
      }

      // Don't create a new comment on the same click that dismisses the old one
      return;
    }

    // Find which page we're on
    const page = findPageAtPoint(e.clientX, e.clientY);
    if (!page) return;

    // Ensure page has relative positioning
    const computedPosition = window.getComputedStyle(page).position;
    if (computedPosition === 'static') {
      page.style.position = 'relative';
    }

    // Get page-relative coordinates
    const coords = getPageCoords(e, page);
    const commentId = 'comment-' + (++commentCounter) + '-' + Date.now();

    // Create and add the marker
    const marker = createCommentMarker(coords.x, coords.y, page, commentId);
    page.appendChild(marker);

    // Add tooltip functionality for viewing comments
    addTooltipToMarker(marker, page);

    // Track this as the uncommitted marker
    uncommittedMarker = marker;

    // Show input bubble
    showCommentInput(coords.x, coords.y, page, commentId, marker, '');

    // Click on marker to edit comment (in comment mode) or view (in other modes)
    marker.addEventListener('click', function(evt) {
      evt.stopPropagation();

      // In comment mode, open editor
      if (currentMode === 'comment') {
        // Cancel any other active input first
        if (activeCommentInput) {
          activeCommentInput.remove();
          activeCommentInput = null;
          if (uncommittedMarker && uncommittedMarker !== this) {
            const savedText = uncommittedMarker.getAttribute('data-canon-comment-text');
            if (!savedText) {
              uncommittedMarker.remove();
            }
          }
        }

        const existingText = this.getAttribute('data-canon-comment-text') || '';
        const markerX = parseFloat(this.style.left);
        const markerY = parseFloat(this.style.top);

        // If this marker has no saved text, it's the uncommitted one
        if (!existingText) {
          uncommittedMarker = this;
        } else {
          uncommittedMarker = null;
        }

        showCommentInput(markerX, markerY, page, this.getAttribute('data-canon-comment-id'), this, existingText);
      }
    });

    // Notify parent about new comment
    window.parent.postMessage({
      type: 'canon-comment-created',
      commentId: commentId,
      rect: { x: coords.x, y: coords.y }
    }, '*');
  }, true);

  // Disable text selection for Figma/Canva-like feel
  document.body.style.userSelect = 'none';
  document.body.style.webkitUserSelect = 'none';
  document.body.style.cursor = 'default';

  // Forward Ctrl+Q to parent to open command capsule
  document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'q') {
      e.preventDefault();
      e.stopPropagation();
      window.parent.postMessage({ type: 'canon-ctrl-q' }, '*');
    }
  }, true);

  // Track scroll and notify parent about current page
  let lastReportedPage = -1;
  function reportCurrentPage() {
    const pages = document.querySelectorAll('.pf');
    if (pages.length === 0) return;

    const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
    const viewportHeight = window.innerHeight;
    const viewportCenter = scrollTop + viewportHeight / 3;

    let currentPage = 0;
    for (let i = pages.length - 1; i >= 0; i--) {
      const pageEl = pages[i];
      if (pageEl.offsetTop <= viewportCenter) {
        currentPage = i;
        break;
      }
    }

    if (currentPage !== lastReportedPage) {
      lastReportedPage = currentPage;
      window.parent.postMessage({
        type: 'canon-current-page',
        pageIndex: currentPage
      }, '*');
    }
  }

  window.addEventListener('scroll', reportCurrentPage);
  // Initial report after a short delay
  setTimeout(function() {
    const pages = document.querySelectorAll('.pf');
    window.parent.postMessage({
      type: 'canon-pages-info',
      pageCount: pages.length
    }, '*');
    reportCurrentPage();
  }, 500);
})();
</script>
`;

export const PDFViewer = forwardRef<PDFViewerRef, PDFViewerProps>(
  function PDFViewer({ className, editorMode = "select", onElementSelect }, ref) {
    const [htmlContent, setHtmlContent] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Send mode changes to iframe
    useEffect(() => {
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'canon-set-mode', mode: editorMode },
        '*'
      );
    }, [editorMode]);

    // Inject selection script into HTML
    const injectSelectionScript = useCallback((html: string): string => {
      // Insert script before closing body tag
      if (html.includes('</body>')) {
        return html.replace('</body>', SELECTION_SCRIPT + '</body>');
      }
      // Fallback: append to end
      return html + SELECTION_SCRIPT;
    }, []);

    const loadHtml = useCallback((html: string): void => {
      setIsLoading(true);
      setSelectedElement(null);
      const enhancedHtml = injectSelectionScript(html);
      setHtmlContent(enhancedHtml);
      setIsLoading(false);
    }, [injectSelectionScript]);

    const clear = useCallback((): void => {
      setHtmlContent(null);
      setSelectedElement(null);
    }, []);

    const clearSelection = useCallback((): void => {
      setSelectedElement(null);
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'canon-clear-selection' },
        '*'
      );
    }, []);

    const getSelectedElement = useCallback((): SelectedElement | null => {
      return selectedElement;
    }, [selectedElement]);

    const getHtml = useCallback((): string | null => {
      // Get the current HTML from the iframe DOM (includes any modifications like redactions)
      const iframeDoc = iframeRef.current?.contentDocument;
      if (iframeDoc) {
        return '<!DOCTYPE html>' + iframeDoc.documentElement.outerHTML;
      }
      // Fallback to stored content if iframe not accessible
      return htmlContent;
    }, [htmlContent]);

    const redactElement = useCallback((elementId: string): void => {
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'canon-redact-element', elementId },
        '*'
      );
    }, []);

    const getIframeRef = useCallback((): React.RefObject<HTMLIFrameElement | null> => {
      return iframeRef;
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        loadHtml,
        clear,
        clearSelection,
        getSelectedElement,
        getHtml,
        redactElement,
        getIframeRef,
      }),
      [loadHtml, clear, clearSelection, getSelectedElement, getHtml, redactElement, getIframeRef]
    );

    // Listen for messages from iframe
    useEffect(() => {
      const handleMessage = (event: MessageEvent): void => {
        if (event.data?.type === 'canon-element-select') {
          const element = event.data.element as SelectedElement | null;
          setSelectedElement(element);
          onElementSelect?.(element);
        }
      };

      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }, [onElementSelect]);

    if (!htmlContent) {
      return (
        <div
          className={cn(
            "flex items-center justify-center bg-surface-subtle rounded-lg border-2 border-dashed border-border",
            className
          )}
        >
          <div className="text-center p-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-subtle flex items-center justify-center">
              <svg
                className="w-8 h-8 text-text-tertiary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <p className="text-text-secondary font-body">
              Upload a PDF to get started
            </p>
          </div>
        </div>
      );
    }

    if (isLoading) {
      return (
        <div
          className={cn(
            "flex items-center justify-center bg-surface-subtle rounded-lg",
            className
          )}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-text-secondary font-body text-sm">
              Converting PDF...
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className={cn("relative bg-white rounded-lg overflow-auto", className)}>
        <iframe
          ref={iframeRef}
          srcDoc={htmlContent}
          className="w-full h-full border-0"
          title="PDF Document"
          sandbox="allow-same-origin allow-scripts"
        />
      </div>
    );
  }
);
