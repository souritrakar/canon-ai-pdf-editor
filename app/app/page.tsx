"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { PDFViewer, type PDFViewerRef, type SelectedElement, EditorToolbar, type EditorMode } from "@/components/editor";

export default function AppPage(): React.ReactElement {
  const [instruction, setInstruction] = useState("");
  const [proposedChanges, setProposedChanges] = useState<string[]>([]);
  const [documentName, setDocumentName] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>("select");

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfViewerRef = useRef<PDFViewerRef>(null);

  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
      const file = event.target.files?.[0];
      if (!file || file.type !== "application/pdf") return;

      setIsConverting(true);
      setError(null);
      setDocumentName(file.name);
      setSelectedElement(null);

      try {
        const formData = new FormData();
        formData.append("pdf", file);

        const response = await fetch("/api/convert", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to convert PDF");
        }

        pdfViewerRef.current?.loadHtml(data.html);
        setProposedChanges([]);
      } catch (err) {
        console.error("Failed to convert PDF:", err);
        setError(err instanceof Error ? err.message : "Failed to convert PDF");
        pdfViewerRef.current?.clear();
      } finally {
        setIsConverting(false);
      }
    },
    []
  );

  const handleUploadClick = useCallback((): void => {
    fileInputRef.current?.click();
  }, []);

  const handleElementSelect = useCallback((element: SelectedElement | null): void => {
    // In redact mode, clicking an element redacts it
    if (editorMode === "redact" && element) {
      pdfViewerRef.current?.redactElement(element.id);
      setSelectedElement(null);
      return;
    }

    // In select mode, just select the element
    setSelectedElement(element);
  }, [editorMode]);

  const handleClearSelection = useCallback((): void => {
    setSelectedElement(null);
    pdfViewerRef.current?.clearSelection();
  }, []);

  const handleExport = useCallback(async (): Promise<void> => {
    const html = pdfViewerRef.current?.getHtml();
    if (!html) return;

    setIsExporting(true);
    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to export PDF");
      }

      // Convert base64 to blob and download
      const pdfBlob = new Blob(
        [Uint8Array.from(atob(data.pdf), (c) => c.charCodeAt(0))],
        { type: "application/pdf" }
      );
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = documentName?.replace(/\.pdf$/i, "-edited.pdf") || "exported.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
      setError(err instanceof Error ? err.message : "Failed to export PDF");
    } finally {
      setIsExporting(false);
    }
  }, [documentName]);


  const handleSubmit = useCallback((): void => {
    if (!instruction.trim()) return;

    // Placeholder: would trigger AI analysis
    setProposedChanges([
      "Replace 'John Doe' with 'Jane Smith' on page 1",
      "Update date from '2024-01-15' to '2024-12-15' on page 2",
    ]);
    setInstruction("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [instruction]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [instruction]);

  // Update placeholder text based on selection
  const getPlaceholderText = (): string => {
    if (!documentName || isConverting) {
      return "Upload a PDF first...";
    }
    if (selectedElement) {
      const preview = selectedElement.textContent.substring(0, 30);
      return `Edit "${preview}${selectedElement.textContent.length > 30 ? '...' : ''}"`;
    }
    return "Select an element or describe changes...";
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Left Sidebar - Document Navigation & Uploads */}
      <aside className="w-64 border-r border-border bg-surface flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="text-h3 font-display font-semibold text-text-primary mb-4">
            Documents
          </h2>
          <Button
            onClick={handleUploadClick}
            disabled={isConverting}
            className="w-full bg-primary hover:bg-primary-hover text-text-inverse"
          >
            {isConverting ? "Converting..." : "Upload PDF"}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {documentName ? (
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 cursor-pointer">
                <p className="text-sm font-body font-medium text-text-primary truncate">
                  {documentName}
                </p>
                <p className="text-xs text-text-tertiary mt-1">
                  {isConverting ? "Converting..." : "Ready"}
                </p>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-surface-subtle border border-dashed border-border">
                <p className="text-sm font-body text-text-tertiary text-center">
                  No documents yet
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-primary font-semibold">U</span>
            </div>
            <span className="font-body">User</span>
          </div>
        </div>
      </aside>

      {/* Center Panel - PDF Document Viewer */}
      <main className="flex-1 flex flex-col bg-surface-subtle overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border bg-surface">
          <div>
            <h1 className="text-lg font-display font-semibold text-text-primary">
              {documentName ?? "No document selected"}
            </h1>
            {isConverting && (
              <p className="text-sm text-text-secondary mt-1">
                Converting PDF to HTML...
              </p>
            )}
            {!isConverting && documentName && (
              <p className="text-sm text-text-tertiary mt-1">
                Click on any element to select it
              </p>
            )}
          </div>
          {documentName && !isConverting && (
            <Button
              onClick={handleExport}
              disabled={isExporting}
              variant="outline"
              className="flex items-center gap-2"
            >
              {isExporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  Export PDF
                </>
              )}
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-hidden p-4 relative">
          {/* Floating Toolbar */}
          {documentName && !isConverting && (
            <div className="absolute top-8 left-1/2 -translate-x-1/2 z-20">
              <EditorToolbar
                activeMode={editorMode}
                onModeChange={setEditorMode}
                disabled={!documentName || isConverting}
              />
            </div>
          )}

          {/* Always render PDFViewer to maintain ref */}
          <PDFViewer
            ref={pdfViewerRef}
            className="w-full h-full"
            editorMode={editorMode}
            onElementSelect={handleElementSelect}
          />

          {/* Overlay for loading state */}
          {isConverting && (
            <div className="absolute inset-4 flex items-center justify-center bg-surface-subtle/90 rounded-lg z-10">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-text-secondary font-body text-sm">
                  Converting PDF to HTML...
                </p>
              </div>
            </div>
          )}

          {/* Overlay for error state */}
          {error && (
            <div className="absolute inset-4 flex items-center justify-center bg-surface-subtle/90 rounded-lg z-10">
              <div className="text-center p-8 bg-red-50 rounded-lg border border-red-200">
                <p className="text-red-600 font-medium mb-2">Conversion Error</p>
                <p className="text-red-500 text-sm">{error}</p>
                <Button
                  onClick={handleUploadClick}
                  className="mt-4 bg-primary hover:bg-primary-hover text-text-inverse"
                >
                  Try Another File
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Right Panel - Selection Info & AI Chat */}
      <aside className="w-80 border-l border-border bg-surface flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="text-h3 font-display font-semibold text-text-primary">
            Edit Document
          </h2>
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Selected Element Info */}
          {selectedElement ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-body font-semibold text-text-primary">
                  Selected Element
                </h3>
                <button
                  onClick={handleClearSelection}
                  className="text-xs text-text-tertiary hover:text-text-secondary transition-colors"
                >
                  Clear
                </button>
              </div>
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 text-xs font-mono bg-primary/10 text-primary rounded">
                    {selectedElement.tagName}
                  </span>
                  {selectedElement.className && (
                    <span className="text-xs text-text-tertiary font-mono truncate">
                      .{selectedElement.className.split(' ')[0]}
                    </span>
                  )}
                </div>
                <p className="text-sm text-text-primary font-body leading-relaxed">
                  {selectedElement.textContent || "(no text content)"}
                </p>
              </div>
              <p className="text-xs text-text-tertiary">
                Use the input below to describe what you want to do with this element.
              </p>
            </div>
          ) : proposedChanges.length > 0 ? (
            <>
              <div>
                <h3 className="text-sm font-body font-semibold text-text-primary mb-3">
                  Proposed Changes
                </h3>
                <div className="space-y-2">
                  {proposedChanges.map((change, index) => (
                    <div
                      key={index}
                      className="p-3 rounded-lg bg-surface-subtle border border-border"
                    >
                      <p className="text-sm text-text-primary font-body">
                        {change}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="pt-2">
                <Button className="w-full bg-primary hover:bg-primary-hover text-text-inverse">
                  Apply Changes
                </Button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-surface-subtle flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-text-tertiary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59"
                    />
                  </svg>
                </div>
                <p className="text-sm text-text-tertiary font-body">
                  {documentName && !isConverting
                    ? "Click an element in the document to select it"
                    : "Upload a PDF to start editing"}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Fixed AI Chat Input Bar at Bottom */}
        <div className="border-t border-border bg-surface p-4">
          <div className="relative">
            <div className="flex items-end gap-2 rounded-xl border-2 border-border bg-surface-subtle focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all duration-200 shadow-sm">
              <textarea
                ref={textareaRef}
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={getPlaceholderText()}
                disabled={!documentName || isConverting}
                className="flex-1 px-4 py-3 bg-transparent text-text-primary font-body placeholder:text-text-tertiary focus:outline-none resize-none max-h-[200px] overflow-y-auto disabled:cursor-not-allowed disabled:opacity-50"
                rows={1}
              />
              <button
                onClick={handleSubmit}
                disabled={!instruction.trim() || !documentName || isConverting}
                className="m-2 p-2 rounded-lg bg-primary hover:bg-primary-hover text-text-inverse disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center shrink-0"
                title="Send (Enter)"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              </button>
            </div>
            <p className="mt-2 text-xs text-text-tertiary font-body text-center">
              Press{" "}
              <kbd className="px-1.5 py-0.5 rounded bg-surface-subtle border border-border text-xs">
                Enter
              </kbd>{" "}
              to send,{" "}
              <kbd className="px-1.5 py-0.5 rounded bg-surface-subtle border border-border text-xs">
                Shift+Enter
              </kbd>{" "}
              for new line
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
