"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { SelectedElement } from "./pdf-viewer";
import type { AgentOperation } from "@/lib/agent";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  operations?: AgentOperation[];
  timestamp: Date;
}

interface CommandCapsuleProps {
  isOpen: boolean;
  onToggle: () => void;
  selectedElement: SelectedElement | null;
  onClearSelection: () => void;
  onSubmit: (instruction: string) => void;
  operations?: AgentOperation[];
  explanation?: string;
  onApplyChanges?: () => void;
  onDismissChanges?: () => void;
  disabled?: boolean;
  isProcessing?: boolean;
  error?: string | null;
}

// Group operations by type for display
interface GroupedOperations {
  tool: string;
  count: number;
  label: string;
}

function groupOperations(ops: AgentOperation[]): GroupedOperations[] {
  const groups = new Map<string, number>();

  for (const op of ops) {
    const count = groups.get(op.tool) || 0;
    groups.set(op.tool, count + 1);
  }

  const result: GroupedOperations[] = [];
  for (const [tool, count] of groups) {
    let label: string;
    switch (tool) {
      case "set_element_text":
        label = count === 1 ? "Set text" : `Set text in ${count} elements`;
        break;
      case "redact_element":
        label = count === 1 ? "Redact element" : `Redact ${count} elements`;
        break;
      case "highlight_element":
        label = count === 1 ? "Highlight element" : `Highlight ${count} elements`;
        break;
      case "add_comment":
        label = count === 1 ? "Add comment" : `Add ${count} comments`;
        break;
      case "delete_element":
        label = count === 1 ? "Delete element" : `Delete ${count} elements`;
        break;
      default:
        label = count === 1 ? tool : `${tool} (${count})`;
    }
    result.push({ tool, count, label });
  }

  return result;
}

export function CommandCapsule({
  isOpen,
  onToggle,
  selectedElement,
  onClearSelection,
  onSubmit,
  operations = [],
  explanation = "",
  onApplyChanges,
  onDismissChanges,
  disabled = false,
  isProcessing = false,
  error = null,
}: CommandCapsuleProps): React.ReactElement {
  const [instruction, setInstruction] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const capsuleRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus textarea when opened
  useEffect(() => {
    if (isOpen && textareaRef.current && !isProcessing) {
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [isOpen, isProcessing]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 100)}px`;
    }
  }, [instruction]);

  // Track operations count to detect changes
  const lastOpsLengthRef = useRef(0);

  useEffect(() => {
    // Nothing to show
    if (!explanation && operations.length === 0) {
      return;
    }

    // Check if operations actually changed (new ones added)
    const hasNewOps = operations.length > lastOpsLengthRef.current;
    lastOpsLengthRef.current = operations.length;

    setMessages(prev => {
      // Find existing assistant message for this response (last one without user message after)
      const lastAssistantIdx = prev.findLastIndex(m => m.role === "assistant");
      const lastUserIdx = prev.findLastIndex(m => m.role === "user");

      // If there's an assistant message after the last user message, update it
      if (lastAssistantIdx > lastUserIdx && lastAssistantIdx >= 0) {
        const updated = [...prev];
        updated[lastAssistantIdx] = {
          ...updated[lastAssistantIdx],
          content: explanation || updated[lastAssistantIdx].content,
          operations: operations.length > 0 ? operations : updated[lastAssistantIdx].operations,
        };
        return updated;
      }

      // Otherwise, add new assistant message
      return [...prev, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: explanation || "Processing...",
        operations: operations.length > 0 ? operations : undefined,
        timestamp: new Date(),
      }];
    });
  }, [operations, explanation]);

  // When error comes in, show it
  useEffect(() => {
    if (error) {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Error: ${error}`,
        timestamp: new Date(),
      }]);
    }
  }, [error]);

  // Handle click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent): void => {
      if (capsuleRef.current && !capsuleRef.current.contains(e.target as Node)) {
        if (operations.length === 0 && messages.length === 0 && !isProcessing) {
          onToggle();
        }
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onToggle, operations.length, messages.length, isProcessing]);

  const handleSubmit = useCallback((): void => {
    if (!instruction.trim() || isProcessing) return;

    // Clear previous conversation and start fresh
    setMessages([{
      id: crypto.randomUUID(),
      role: "user",
      content: instruction,
      timestamp: new Date(),
    }]);

    onSubmit(instruction);
    setInstruction("");
  }, [instruction, onSubmit, isProcessing]);

  const handleClose = useCallback((): void => {
    setMessages([]);
    setInstruction("");
    lastOpsLengthRef.current = 0;
    onDismissChanges?.();
    onToggle();
  }, [onToggle, onDismissChanges]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }
    },
    [handleSubmit, handleClose]
  );

  const handleApply = useCallback((): void => {
    console.log("[CommandCapsule] handleApply called, onApplyChanges:", !!onApplyChanges);
    if (onApplyChanges) {
      console.log("[CommandCapsule] Calling onApplyChanges");
      onApplyChanges();
    }

    // Update the message to show applied state (remove operations from last message)
    setMessages(prev => {
      const lastIdx = prev.findLastIndex(m => m.operations && m.operations.length > 0);
      if (lastIdx >= 0) {
        const updated = [...prev];
        const appliedCount = updated[lastIdx].operations?.length || 0;
        updated[lastIdx] = {
          ...updated[lastIdx],
          content: `Applied ${appliedCount} change${appliedCount === 1 ? "" : "s"}.`,
          operations: undefined, // Remove operations to hide buttons
        };
        return updated;
      }
      return prev;
    });

    // Reset the operations ref
    lastOpsLengthRef.current = 0;
  }, [onApplyChanges]);

  const handleDismiss = useCallback((): void => {
    onDismissChanges?.();
    lastOpsLengthRef.current = 0;
    // Remove the last assistant message with operations
    setMessages(prev => {
      const lastIdx = prev.length - 1;
      if (prev[lastIdx]?.operations) {
        return prev.slice(0, lastIdx);
      }
      return prev;
    });
  }, [onDismissChanges]);

  // Get placeholder text based on context
  const getPlaceholder = (): string => {
    if (selectedElement) {
      return "What would you like to do with this selection?";
    }
    if (messages.length > 0) {
      return "Ask a follow-up or describe another change...";
    }
    return "Describe a change to your document...";
  };

  // Truncate text for context chip
  const getSelectionPreview = (): string => {
    if (!selectedElement?.textContent) return "";
    const text = selectedElement.textContent;
    return text.length > 40 ? `${text.substring(0, 40)}...` : text;
  };

  const hasConversation = messages.length > 0 || isProcessing;

  return (
    <div
      ref={capsuleRef}
      className={cn(
        "fixed bottom-10 left-1/2 -translate-x-1/2 z-50",
        "transition-all duration-200 ease-out"
      )}
    >
      {/* Rest State - Pill Button */}
      {!isOpen && (
        <button
          onClick={onToggle}
          disabled={disabled}
          className={cn(
            "flex items-center gap-2 px-5 py-3 rounded-full",
            "bg-surface border border-border shadow-lg",
            "text-text-secondary font-body text-sm",
            "hover:shadow-xl hover:scale-[1.02] hover:border-primary/30",
            "transition-all duration-200 ease-out",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100",
            "backdrop-blur-sm"
          )}
        >
          <span className="text-base">✨</span>
          <span>Describe a change...</span>
          <kbd className="ml-2 px-1.5 py-0.5 rounded bg-surface-subtle border border-border text-[10px] font-mono text-text-tertiary">
            Ctrl+Q
          </kbd>
        </button>
      )}

      {/* Expanded State - Command Palette with Conversation */}
      {isOpen && (
        <div
          className={cn(
            "w-[640px] rounded-2xl",
            "bg-surface border border-border shadow-2xl",
            "animate-capsule-expand origin-bottom",
            "backdrop-blur-sm",
            "flex flex-col",
            hasConversation ? "max-h-[480px]" : "max-h-[280px]"
          )}
        >
          {/* Header */}
          {hasConversation && (
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="text-base">✨</span>
                <span className="text-sm font-semibold text-text-primary">AI Assistant</span>
                {isProcessing && !messages.some(m => m.operations && m.operations.length > 0) && (
                  <span className="text-xs text-text-tertiary animate-pulse">thinking...</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsCollapsed(!isCollapsed)}
                  className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-surface-subtle transition-colors text-text-tertiary hover:text-text-secondary cursor-pointer"
                  title={isCollapsed ? "Expand" : "Collapse"}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    {isCollapsed ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    )}
                  </svg>
                </button>
                <button
                  onClick={handleClose}
                  className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-surface-subtle transition-colors text-text-tertiary hover:text-text-secondary cursor-pointer"
                  title="Close"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Conversation Area */}
          {hasConversation && !isCollapsed && (
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[120px] max-h-[280px]">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-3",
                    msg.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-sm">✨</span>
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[85%] rounded-xl px-3 py-2",
                      msg.role === "user"
                        ? "bg-primary text-white"
                        : "bg-surface-subtle border border-border"
                    )}
                  >
                    <p className={cn(
                      "text-sm",
                      msg.role === "user" ? "text-white" : "text-text-primary"
                    )}>
                      {msg.content}
                    </p>

                    {/* Operations within message - grouped by type */}
                    {msg.operations && msg.operations.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {groupOperations(msg.operations).map((group, idx) => (
                          <div
                            key={idx}
                            className="p-2 rounded-lg bg-surface border border-border text-sm text-text-primary flex items-center gap-2"
                          >
                            <span className="text-primary">→</span>
                            {group.label}
                          </div>
                        ))}
                        <div className="flex gap-2 mt-2">
                          <button
                            type="button"
                            onClick={() => {
                              console.log("[Button] Apply clicked directly!");
                              handleApply();
                            }}
                            className="flex-1 py-1.5 px-3 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-medium transition-colors cursor-pointer"
                          >
                            Apply {msg.operations.length === 1 ? "Change" : `${msg.operations.length} Changes`}
                          </button>
                          <button
                            onClick={handleDismiss}
                            className="py-1.5 px-3 rounded-lg bg-surface hover:bg-surface-subtle text-text-secondary text-xs font-medium transition-colors border border-border cursor-pointer"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    )}

                    <p className={cn(
                      "text-[10px] mt-1",
                      msg.role === "user" ? "text-white/60" : "text-text-tertiary"
                    )}>
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {msg.role === "user" && (
                    <div className="w-7 h-7 rounded-full bg-text-primary flex items-center justify-center shrink-0">
                      <span className="text-xs text-white font-semibold">U</span>
                    </div>
                  )}
                </div>
              ))}

              {/* Loading indicator - only show if processing AND no operations yet */}
              {isProcessing && !messages.some(m => m.operations && m.operations.length > 0) && (
                <div className="flex gap-3 justify-start">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-sm">✨</span>
                  </div>
                  <div className="max-w-[85%] rounded-xl px-3 py-2 bg-surface-subtle border border-border">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Input Area */}
          <div className={cn(
            "p-4",
            hasConversation && "border-t border-border"
          )}>
            {/* Context Chip (always show when element selected) */}
            {selectedElement && (
              <div className="mb-3">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
                  <span className="text-xs">📝</span>
                  <span className="text-xs font-medium text-text-primary max-w-[400px] truncate">
                    "{getSelectionPreview()}"
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onClearSelection();
                    }}
                    className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-primary/20 transition-colors cursor-pointer"
                  >
                    <svg
                      className="w-3 h-3 text-text-secondary"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
            <div className="flex items-end gap-3">
              <textarea
                ref={textareaRef}
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={getPlaceholder()}
                disabled={isProcessing}
                className={cn(
                  "flex-1 px-4 py-3 rounded-xl",
                  "bg-surface-subtle border border-border",
                  "text-text-primary font-body placeholder:text-text-tertiary",
                  "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30",
                  "resize-none max-h-[100px] overflow-y-auto",
                  "transition-all duration-150",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
                rows={1}
              />
              <button
                onClick={handleSubmit}
                disabled={!instruction.trim() || isProcessing}
                className={cn(
                  "p-3 rounded-xl",
                  "bg-primary hover:bg-primary-hover text-text-inverse",
                  "disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer",
                  "transition-all duration-150",
                  "flex items-center justify-center shrink-0"
                )}
              >
                {isProcessing ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg
                    className="w-5 h-5"
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
                )}
              </button>
            </div>

            {/* Hints */}
            <div className="flex items-center justify-between mt-2 px-1">
              <span className="text-[10px] text-text-tertiary">
                <kbd className="px-1 py-0.5 rounded bg-surface-subtle border border-border font-mono">
                  Enter
                </kbd>
                {" "}send
              </span>
              <span className="text-[10px] text-text-tertiary">
                <kbd className="px-1 py-0.5 rounded bg-surface-subtle border border-border font-mono">
                  Esc
                </kbd>
                {" "}close
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
