"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

interface PageThumbnailsProps {
  className?: string;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  onPageClick?: (pageIndex: number) => void;
}

export function PageThumbnails({
  className,
  iframeRef,
  onPageClick
}: PageThumbnailsProps): React.ReactElement | null {
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const thumbnailsContainerRef = useRef<HTMLDivElement>(null);

  // Scroll to a specific page using postMessage
  const scrollToPage = useCallback((pageIndex: number): void => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    iframe.contentWindow.postMessage({
      type: 'canon-scroll-to-page',
      pageIndex: pageIndex
    }, '*');

    setCurrentPage(pageIndex);
    onPageClick?.(pageIndex);
  }, [iframeRef, onPageClick]);

  // Listen for messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent): void => {
      if (event.data?.type === 'canon-pages-info') {
        const count = event.data.pageCount;
        if (count > 0) {
          setPageCount(count);
        }
      }
      if (event.data?.type === 'canon-current-page') {
        const newPage = event.data.pageIndex;
        setCurrentPage(newPage);
        // Scroll thumbnail into view
        const container = thumbnailsContainerRef.current;
        if (container && container.children[newPage]) {
          const thumbnailEl = container.children[newPage] as HTMLElement;
          thumbnailEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
      if (event.data?.type === 'canon-page-scrolled') {
        setCurrentPage(event.data.pageIndex);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Request page info when component mounts or iframe changes
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const requestPages = (): void => {
      if (iframe.contentWindow) {
        iframe.contentWindow.postMessage({ type: 'canon-get-pages' }, '*');
      }
    };

    const handleLoad = (): void => {
      setTimeout(requestPages, 300);
    };

    iframe.addEventListener('load', handleLoad);

    // If already loaded, request immediately
    if (iframe.contentDocument?.readyState === 'complete') {
      handleLoad();
    }

    return () => iframe.removeEventListener('load', handleLoad);
  }, [iframeRef]);

  if (pageCount === 0) {
    return (
      <div className={cn("flex flex-col h-full items-center justify-center p-4", className)}>
        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        <p className="text-white/50 text-xs mt-2">Loading...</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="px-3 py-2 border-b border-white/10">
        <h3 className="text-xs font-medium text-white/70 uppercase tracking-wide">
          Pages ({pageCount})
        </h3>
      </div>

      <div
        ref={thumbnailsContainerRef}
        className="flex-1 overflow-y-auto p-2 space-y-3"
      >
        {Array.from({ length: pageCount }).map((_, index) => (
          <button
            key={index}
            onClick={() => scrollToPage(index)}
            className={cn(
              "w-full rounded overflow-hidden transition-all duration-200 cursor-pointer",
              "focus:outline-none",
              currentPage === index
                ? "ring-2 ring-primary"
                : "hover:ring-2 hover:ring-white/40"
            )}
          >
            {/* Simple page placeholder - no broken thumbnails */}
            <div className="aspect-[8.5/11] bg-white relative flex items-center justify-center border border-gray-200">
              <div className="text-center">
                <div className="w-8 h-8 mx-auto mb-1 rounded bg-gray-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <span className="text-gray-500 text-xs font-medium">Page {index + 1}</span>
              </div>
            </div>
            <div className={cn(
              "py-1 text-center text-xs font-semibold",
              currentPage === index
                ? "bg-primary text-white"
                : "bg-[#3d3f42] text-white/80"
            )}>
              {index + 1}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
