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
}

// Script to inject into the iframe for element selection
const SELECTION_SCRIPT = `
<script>
(function() {
  let selectedElement = null;
  let currentMode = 'select';
  const SELECTION_COLOR = '#EB4F34';
  const HOVER_COLOR = '#EB4F34';
  const HIGHLIGHT_COLOR = 'rgba(255, 234, 0, 0.4)';

  // Highlight drawing state
  let isDrawingHighlight = false;
  let highlightStartX = 0;
  let highlightStartY = 0;
  let currentHighlightBox = null;
  let highlightCounter = 0;

  // Selectable elements in pdf2htmlEX output
  const SELECTABLE_SELECTORS = '.t, .c, img, [class*="ff"], [class*="fc"]';

  function isRedacted(el) {
    return el && el.hasAttribute && el.hasAttribute('data-canon-redacted');
  }

  function getSelectableParent(el) {
    while (el && el !== document.body) {
      // Skip redacted elements
      if (isRedacted(el)) {
        return null;
      }
      if (el.matches && el.matches(SELECTABLE_SELECTORS)) {
        return el;
      }
      if (el.tagName === 'DIV' && el.childNodes.length > 0) {
        const hasDirectText = Array.from(el.childNodes).some(
          n => n.nodeType === 3 && n.textContent.trim()
        );
        if (hasDirectText || el.classList.contains('t')) {
          return el;
        }
      }
      el = el.parentElement;
    }
    return null;
  }

  function generateId(el) {
    const index = Array.from(document.querySelectorAll(el.tagName)).indexOf(el);
    return el.tagName.toLowerCase() + '-' + index + '-' + Date.now();
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
        textContent: el.textContent?.substring(0, 500) || '',
        className: el.className,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
      }
    }, '*');
  }

  // Apply selection style directly to element
  function applySelection(el) {
    if (!el) return;
    el.style.outline = '2px solid ' + SELECTION_COLOR;
    el.style.outlineOffset = '1px';
    el.style.backgroundColor = 'rgba(235, 79, 52, 0.08)';
  }

  function clearSelection(el) {
    if (!el || isRedacted(el)) return;
    el.style.outline = '';
    el.style.outlineOffset = '';
    el.style.backgroundColor = '';
  }

  // Apply hover style directly to element
  function applyHover(el) {
    if (!el || isRedacted(el)) return;
    el.style.outline = '1px solid ' + HOVER_COLOR;
    el.style.outlineOffset = '0px';
  }

  function clearHover(el) {
    if (!el || isRedacted(el)) return;
    el.style.outline = '';
    el.style.outlineOffset = '';
  }

  // Click handler
  let hoverElement = null;

  document.addEventListener('click', function(e) {
    // Only handle clicks in select or redact mode
    if (currentMode !== 'select' && currentMode !== 'redact') return;

    e.preventDefault();
    e.stopPropagation();

    const target = getSelectableParent(e.target);

    // Clear hover on click
    if (hoverElement) {
      clearHover(hoverElement);
      hoverElement = null;
    }

    if (selectedElement === target) {
      // Clicking same element deselects
      clearSelection(selectedElement);
      selectedElement = null;
      notifyParent(null);
      return;
    }

    // Clear previous selection
    if (selectedElement) {
      clearSelection(selectedElement);
    }

    selectedElement = target;
    if (target) {
      if (!target.dataset.canonId) {
        target.dataset.canonId = generateId(target);
      }
      applySelection(target);
    }
    notifyParent(target);
  }, true);

  // Hover effect
  document.addEventListener('mouseover', function(e) {
    // Only show hover in select or redact mode
    if (currentMode !== 'select' && currentMode !== 'redact') return;

    const target = getSelectableParent(e.target);

    if (target === hoverElement || target === selectedElement) return;

    // Clear previous hover
    if (hoverElement && hoverElement !== selectedElement) {
      clearHover(hoverElement);
    }

    hoverElement = target;

    if (target && target !== selectedElement) {
      applyHover(target);
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
  }, true);

  // Listen for commands from parent
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'canon-clear-selection') {
      if (selectedElement) {
        clearSelection(selectedElement);
        selectedElement = null;
      }
    }

    // Handle mode change
    if (e.data && e.data.type === 'canon-set-mode') {
      currentMode = e.data.mode || 'select';
      // Update cursor based on mode
      if (currentMode === 'highlight') {
        document.body.style.cursor = 'crosshair';
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
      const originalWidth = el.offsetWidth;
      const originalHeight = el.offsetHeight;

      // Store original text as data attribute (for undo functionality later)
      el.setAttribute('data-canon-redacted', 'true');
      el.setAttribute('data-canon-original', originalText);

      // COMPLETELY DESTROY all text content - remove all child nodes
      while (el.firstChild) {
        el.removeChild(el.firstChild);
      }
      // Also set textContent and innerHTML to empty (belt and suspenders)
      el.textContent = '';
      el.innerHTML = '';

      // Lock the element to its original dimensions and fill with black
      el.style.display = 'inline-block';
      el.style.width = originalWidth + 'px';
      el.style.height = originalHeight + 'px';
      el.style.minWidth = originalWidth + 'px';
      el.style.minHeight = originalHeight + 'px';
      el.style.backgroundColor = '#000000';
      el.style.overflow = 'hidden';
      el.style.outline = '';
      el.style.outlineOffset = '';
      el.style.color = 'transparent';
      el.style.fontSize = '0';
      el.style.lineHeight = '0';

      // Notify parent that redaction is complete
      window.parent.postMessage({
        type: 'canon-redaction-complete',
        elementId: elementId,
        textContent: ''
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
    // Fallback to page-container or body
    return document.getElementById('page-container') || document.body;
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

  // Disable text selection for Figma/Canva-like feel
  document.body.style.userSelect = 'none';
  document.body.style.webkitUserSelect = 'none';
  document.body.style.cursor = 'default';
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

    useImperativeHandle(
      ref,
      () => ({
        loadHtml,
        clear,
        clearSelection,
        getSelectedElement,
        getHtml,
        redactElement,
      }),
      [loadHtml, clear, clearSelection, getSelectedElement, getHtml, redactElement]
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
