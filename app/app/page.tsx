"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { PDFViewer, type PDFViewerRef, type SelectedElement, EditorToolbar, type EditorMode, PageThumbnails, CommandCapsule } from "@/components/editor";
import { extractContext, executeOperations, type AgentOperation, type ExecutionResult, type ConversationMessage } from "@/lib/agent";

export default function AppPage(): React.ReactElement {
  const [documentName, setDocumentName] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>("select");
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);

  // Agent state
  const [isProcessing, setIsProcessing] = useState(false);
  const [agentOperations, setAgentOperations] = useState<AgentOperation[]>([]);
  const [agentExplanation, setAgentExplanation] = useState("");
  const [agentError, setAgentError] = useState<string | null>(null);
  // Conversation history for multi-turn context
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);

  // Change ledger: only tracks APPLIED changes (results of work)
  const [changeLedger, setChangeLedger] = useState<Array<{
    id: string;
    type: "text-replace" | "redact" | "insert" | "delete" | "format" | "highlight" | "comment";
    description: string;
    page?: number;
    timestamp: Date;
  }>>([]);

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
        setPdfLoaded(true);
        setAgentOperations([]);
        setAgentExplanation("");
        setConversationHistory([]); // Clear conversation for new document
      } catch (err) {
        console.error("Failed to convert PDF:", err);
        setError(err instanceof Error ? err.message : "Failed to convert PDF");
        pdfViewerRef.current?.clear();
        setPdfLoaded(false);
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

  const [showExportMenu, setShowExportMenu] = useState(false);

  const handleExportPDF = useCallback(async (): Promise<void> => {
    const html = pdfViewerRef.current?.getHtml();
    if (!html) return;

    setIsExporting(true);
    setShowExportMenu(false);
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

  const handleExportHTML = useCallback((): void => {
    const html = pdfViewerRef.current?.getHtml();
    if (!html) return;

    setShowExportMenu(false);

    // Create self-contained HTML with all interactive features preserved
    const htmlBlob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(htmlBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = documentName?.replace(/\.pdf$/i, "-edited.html") || "exported.html";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [documentName]);

  // Submit instruction to AI agent with streaming
  const handleSubmit = useCallback(async (instructionText: string): Promise<void> => {
    if (!instructionText.trim()) return;

    setIsProcessing(true);
    setAgentError(null);
    setAgentOperations([]);
    setAgentExplanation("");

    // Add user message to conversation history
    const userMessage: ConversationMessage = { role: "user", content: instructionText };
    const updatedHistory = [...conversationHistory, userMessage];
    setConversationHistory(updatedHistory);

    try {
      // Extract context from current state
      const context = extractContext(
        selectedElement,
        pdfViewerRef.current?.getIframeRef() ?? null
      );

      // Include conversation history in context
      context.conversationHistory = updatedHistory;

      // Call agent API with streaming
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instruction: instructionText,
          context,
          stream: true,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Agent request failed");
      }

      // Read SSE stream
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let streamedText = "";
      let currentEventType = "";
      const collectedOperations: AgentOperation[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEventType = line.slice(7).trim();
            continue;
          }
          if (line.startsWith("data: ")) {
            const jsonStr = line.slice(6);
            if (!jsonStr.trim()) continue;

            try {
              const data = JSON.parse(jsonStr);

              // Route based on event type
              switch (currentEventType) {
                case "text":
                  // Streaming text from agent reasoning
                  if (data.text) {
                    streamedText += data.text;
                    setAgentExplanation(streamedText);
                  }
                  break;

                case "tool_complete":
                  // Tool completed - add to operations
                  if (data.tool && data.id) {
                    const op = {
                      id: data.id,
                      tool: data.tool,
                      input: data.input || {},
                    };
                    collectedOperations.push(op);
                    setAgentOperations([...collectedOperations]);
                  }
                  break;

                case "complete":
                  // Final completion - use final operations array
                  if (data.operations && data.operations.length > 0) {
                    setAgentOperations(data.operations);
                  }
                  if (data.explanation) {
                    setAgentExplanation(data.explanation);
                  }
                  break;

                case "error":
                  throw new Error(data.error || "Unknown error");

                default:
                  // Fallback: try to infer from data shape
                  if (data.text !== undefined) {
                    streamedText += data.text;
                    setAgentExplanation(streamedText);
                  } else if (data.success !== undefined && data.operations) {
                    setAgentOperations(data.operations);
                  }
              }
            } catch (parseErr) {
              if (parseErr instanceof Error && parseErr.message !== "Unknown error") {
                console.warn("Failed to parse SSE data:", jsonStr, parseErr);
              } else {
                throw parseErr;
              }
            }
          }
        }
      }

      // Add assistant response to conversation history
      if (streamedText.trim()) {
        setConversationHistory(prev => [...prev, { role: "assistant", content: streamedText.trim() }]);
      }

    } catch (err) {
      console.error("Agent error:", err);
      setAgentError(err instanceof Error ? err.message : "Failed to process instruction");
    } finally {
      setIsProcessing(false);
    }
  }, [selectedElement, conversationHistory]);

  // Apply operations when user confirms
  const handleApplyChanges = useCallback(async (): Promise<void> => {
    console.log("[Apply] ========== APPLY CHANGES CALLED ==========");
    console.log("[Apply] agentOperations:", agentOperations);
    console.log("[Apply] agentOperations.length:", agentOperations.length);

    if (agentOperations.length === 0) {
      console.log("[Apply] ERROR: No operations - agentOperations is empty!");
      return;
    }

    const pdfViewer = pdfViewerRef.current;
    console.log("[Apply] pdfViewerRef.current exists:", !!pdfViewer);

    if (!pdfViewer) {
      console.log("[Apply] ERROR: No pdfViewer ref");
      return;
    }

    const iframeRef = pdfViewer.getIframeRef();
    console.log("[Apply] iframeRef exists:", !!iframeRef);
    console.log("[Apply] iframeRef.current exists:", !!iframeRef?.current);

    if (!iframeRef) {
      console.log("[Apply] ERROR: No iframe ref");
      return;
    }

    console.log("[Apply] Executing", agentOperations.length, "operations");

    // Execute all operations
    const results: ExecutionResult[] = await executeOperations(agentOperations, iframeRef);
    console.log("[Apply] Results:", results);

    // Add successful operations to ledger
    const newEntries = results
      .filter(r => r.success)
      .map(r => {
        const op = agentOperations.find(o => o.id === r.operationId);
        return {
          id: crypto.randomUUID(),
          type: mapToolToChangeType(op?.tool || ""),
          description: formatOperationForLedger(op),
          timestamp: new Date(),
        };
      });

    if (newEntries.length > 0) {
      setChangeLedger(prev => [...newEntries, ...prev]);
    }

    // Check for errors
    const errors = results.filter(r => !r.success);
    if (errors.length > 0) {
      console.error("Some operations failed:", errors);
    }

    // Clear operations
    setAgentOperations([]);
    setAgentExplanation("");
    handleClearSelection();
  }, [agentOperations, handleClearSelection]);

  // Dismiss operations without applying
  const handleDismissChanges = useCallback((): void => {
    setAgentOperations([]);
    setAgentExplanation("");
    setAgentError(null);
  }, []);

  // Global Ctrl+Q handler for command capsule
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "q") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (documentName && !isConverting) {
          setIsCommandOpen(prev => !prev);
        }
      }
    };

    // Listen for Ctrl+Q forwarded from iframe
    const handleMessage = (e: MessageEvent): void => {
      if (e.data?.type === "canon-ctrl-q") {
        if (documentName && !isConverting) {
          setIsCommandOpen(prev => !prev);
        }
      }
    };

    // Use capture phase to catch the event before browser handles it
    window.addEventListener("keydown", handleGlobalKeyDown, { capture: true });
    document.addEventListener("keydown", handleGlobalKeyDown, { capture: true });
    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown, { capture: true });
      document.removeEventListener("keydown", handleGlobalKeyDown, { capture: true });
      window.removeEventListener("message", handleMessage);
    };
  }, [documentName, isConverting]);

  // Close export menu when clicking outside
  useEffect(() => {
    if (!showExportMenu) return;
    const handleClickOutside = (): void => setShowExportMenu(false);
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [showExportMenu]);

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

          {/* Selected Element Info */}
          {selectedElement && (
            <div className="mt-4 p-3 rounded-lg bg-teal-50 border border-teal-200">
              <p className="text-xs font-semibold text-teal-700 mb-1">Selected Element</p>
              <p className="text-xs font-mono text-teal-900 break-all select-all">
                {selectedElement.id}
              </p>
              {selectedElement.count && selectedElement.count > 1 && (
                <p className="text-xs text-teal-600 mt-1">
                  +{selectedElement.count - 1} more selected
                </p>
              )}
              <p className="text-xs text-teal-600 mt-2 line-clamp-3">
                {selectedElement.textContent}
              </p>
            </div>
          )}
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
            <div className="relative">
              <Button
                onClick={(e) => { e.stopPropagation(); setShowExportMenu(!showExportMenu); }}
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
                    Export
                    <svg
                      className="w-3 h-3 ml-1"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </>
                )}
              </Button>
              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                  <button
                    onClick={handleExportPDF}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
                      <path d="M8 12h8v2H8zm0 3h8v2H8z"/>
                    </svg>
                    Export as PDF
                  </button>
                  <button
                    onClick={handleExportHTML}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 text-orange-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                    </svg>
                    Export as HTML
                    <span className="text-xs text-gray-400 ml-auto">Interactive</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-hidden p-4 relative flex gap-4">
          {/* Page Thumbnails Panel - Inside Editor Area */}
          {pdfLoaded && pdfViewerRef.current && (
            <div className="w-32 flex-shrink-0 bg-[#525659] rounded-lg overflow-hidden">
              <PageThumbnails
                iframeRef={pdfViewerRef.current.getIframeRef()}
                className="h-full"
              />
            </div>
          )}

          {/* Main Document View */}
          <div className="flex-1 relative">
            {/* Floating Toolbar */}
            {documentName && !isConverting && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
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
          </div>

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

        {/* Floating Command Capsule */}
        <CommandCapsule
          isOpen={isCommandOpen}
          onToggle={() => setIsCommandOpen(prev => !prev)}
          selectedElement={selectedElement}
          onClearSelection={handleClearSelection}
          onSubmit={handleSubmit}
          operations={agentOperations}
          explanation={agentExplanation}
          onApplyChanges={handleApplyChanges}
          onDismissChanges={handleDismissChanges}
          disabled={!documentName || isConverting}
          isProcessing={isProcessing}
          error={agentError}
        />
      </main>

      {/* Right Panel - Change Ledger (Results Only) */}
      <aside className="w-72 border-l border-border bg-surface flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-text-secondary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
              />
            </svg>
            <h2 className="text-h3 font-display font-semibold text-text-primary">
              Changes
            </h2>
          </div>
          {changeLedger.length > 0 && (
            <span className="text-xs text-text-tertiary bg-surface-subtle px-2 py-0.5 rounded-full">
              {changeLedger.length}
            </span>
          )}
        </div>

        {/* Change Ledger - Applied Changes Only */}
        <div className="flex-1 overflow-y-auto p-3">
          {changeLedger.length > 0 ? (
            <div className="space-y-2">
              {changeLedger.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-lg bg-surface-subtle border border-border hover:border-border-strong transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded flex items-center justify-center shrink-0 bg-green-100 text-green-600">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary font-body leading-snug">
                        {item.description}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {item.page && (
                          <span className="text-[10px] text-text-tertiary">
                            Page {item.page}
                          </span>
                        )}
                        <span className="text-[10px] text-text-tertiary">
                          {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center px-4">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-surface-subtle flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-text-tertiary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
                    />
                  </svg>
                </div>
                <p className="text-sm text-text-tertiary font-body">
                  No changes applied yet
                </p>
                <p className="text-xs text-text-tertiary font-body mt-1">
                  Applied edits will appear here
                </p>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

// Helper functions
function mapToolToChangeType(tool: string): "text-replace" | "redact" | "insert" | "delete" | "format" | "highlight" | "comment" {
  switch (tool) {
    case "replace_text":
      return "text-replace";
    case "redact_element":
      return "redact";
    case "delete_element":
      return "delete";
    case "add_highlight":
      return "highlight";
    case "add_comment":
      return "comment";
    default:
      return "format";
  }
}

function formatOperationForLedger(op: AgentOperation | undefined): string {
  if (!op) return "Unknown operation";

  switch (op.tool) {
    case "replace_text":
      return `Replaced "${op.input.oldText}" with "${op.input.newText}"`;
    case "redact_element":
      return "Redacted element";
    case "add_highlight":
      return "Highlighted element";
    case "add_comment":
      return `Added comment: "${op.input.comment}"`;
    case "delete_element":
      return "Deleted element";
    default:
      return `Applied ${op.tool}`;
  }
}
