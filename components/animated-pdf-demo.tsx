"use client";

import { useState, useEffect } from "react";

interface PDFAction {
  type: "redact" | "replace" | "highlight" | "split";
  text: string;
  target?: string;
  color?: string;
}

const demoSequence: PDFAction[] = [
  { type: "redact", text: "redact all personal information" },
  { type: "replace", text: "replace John Smith with Jane Doe everywhere", target: "John Smith" },
  { type: "highlight", text: "highlight all dates in yellow", color: "#FCD34D" },
  { type: "split", text: "split this file whenever the invoice number changes" },
];

interface AnimatedPDFDemoProps {
  currentIndex?: number;
  isExternalControl?: boolean;
  shouldStart?: boolean;
}

export function AnimatedPDFDemo({ 
  currentIndex: externalIndex, 
  isExternalControl = false,
  shouldStart = false
}: AnimatedPDFDemoProps) {
  const [internalIndex, setInternalActionIndex] = useState(0);
  const [animationPhase, setAnimationPhase] = useState<"idle" | "analyzing" | "preview" | "applying">("idle");
  const [progress, setProgress] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [appliedActions, setAppliedActions] = useState<Set<number>>(new Set());
  const [lastIndex, setLastIndex] = useState<number | undefined>(undefined);

  const currentActionIndex = isExternalControl ? (externalIndex ?? 0) : internalIndex;

  // Track applied actions and reset only when cycle completes
  useEffect(() => {
    if (isExternalControl && externalIndex !== undefined) {
      // If we're cycling back to 0 from the last index, reset everything
      if (lastIndex !== undefined && externalIndex === 0 && lastIndex === demoSequence.length - 1) {
        // Reset all applied actions and state
        setTimeout(() => {
          setAppliedActions(new Set());
          setHasStarted(false);
          setAnimationPhase("idle");
          setProgress(0);
        }, 100); // Small delay for smooth transition
      } else {
        // Don't reset applied actions - just prepare for new action animation
        setHasStarted(false);
        setAnimationPhase("idle");
        setProgress(0);
      }
      setLastIndex(externalIndex);
    }
  }, [externalIndex, isExternalControl, lastIndex]);

  // Start animation when shouldStart becomes true - go straight to preview
  // This is called exactly when prompt finishes typing
  useEffect(() => {
    if (shouldStart && isExternalControl) {
      setHasStarted(true);
      // Start preview immediately
      setAnimationPhase("preview");
    }
  }, [shouldStart, isExternalControl]);

  useEffect(() => {
    // Don't run animation if externally controlled and hasn't started yet or is idle
    if (isExternalControl && (!hasStarted || animationPhase === "idle")) {
      return;
    }

    // Simplified sequence - skip analyzing, go straight to preview
    // Timing synced with prompt: preview shows for 1.5s, then applying for 0.5s (very fast)
    const sequence = [
      { phase: "preview", duration: 1500 },
      { phase: "applying", duration: 500 },
    ];

    let timeoutId: NodeJS.Timeout;

    const currentSequence = sequence.find((s) => s.phase === animationPhase);
    
    if (currentSequence) {
      timeoutId = setTimeout(() => {
        const currentIndex = sequence.findIndex((s) => s.phase === animationPhase);
        if (currentIndex < sequence.length - 1) {
          setAnimationPhase(sequence[currentIndex + 1].phase as any);
        } else {
          // Mark action as applied when we finish applying phase
          if (isExternalControl && animationPhase === "applying") {
            setAppliedActions((prev) => new Set([...prev, currentActionIndex]));
          }
          // Stay in applying phase when externally controlled
          if (!isExternalControl) {
            setInternalActionIndex((prev) => (prev + 1) % demoSequence.length);
            setAnimationPhase("preview");
            setProgress(0);
          }
        }
      }, currentSequence.duration);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [animationPhase, currentActionIndex, isExternalControl, hasStarted]);

  const currentAction = demoSequence[currentActionIndex];

  return (
    <div className="relative w-full">
      {/* PDF Document Frame - Realistic PDF Viewer */}
      <div className="relative rounded-lg border-2 border-border bg-white shadow-2xl overflow-hidden" style={{ boxShadow: '0 25px 50px rgba(28, 25, 23, 0.12)' }}>
        {/* PDF Toolbar - macOS style */}
        <div className="bg-surface-subtle border-b border-border px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#FF5F57' }}></div>
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#FFBD2E' }}></div>
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#28CA42' }}></div>
          </div>
          <div className="flex-1 mx-4 max-w-md">
            <div className="h-1.5 bg-border rounded-full"></div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs text-text-tertiary font-mono px-2 py-1 bg-white rounded border border-border">document.pdf</div>
          </div>
        </div>

        {/* PDF Content - Realistic Document */}
        <div className="bg-white p-12 min-h-[600px] relative" style={{ backgroundImage: 'linear-gradient(to right, #f9f9f9 0px, #f9f9f9 40px, transparent 40px)' }}>
          {/* PDF Page Number Indicator */}
          <div className="absolute left-0 top-0 bottom-0 w-10 bg-surface-subtle/50 border-r border-border flex items-start justify-center pt-12">
            <div className="text-xs text-text-tertiary font-mono">1</div>
          </div>

          {/* Document Content */}
          <div className="ml-12 space-y-6 max-w-2xl">
            {/* Letterhead-style Header */}
            <div className="border-b-2 border-border pb-4 mb-6">
              <div className="text-3xl font-display font-semibold text-text-primary mb-2 transition-all duration-500">
                {(appliedActions.has(1) || (currentAction.type === "replace" && hasStarted && (animationPhase === "preview" || animationPhase === "applying"))) ? (
                  <span className="relative inline-block">
                    <span className="line-through text-text-tertiary opacity-60 transition-all duration-500">John Smith</span>
                    <span className="ml-3 transition-all duration-500 animate-in fade-in slide-in-from-right-4" style={{ color: 'var(--color-primary)' }}>Jane Doe</span>
                    <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary transition-all duration-500"></span>
                  </span>
                ) : (
                  <span className="transition-all duration-500">John Smith</span>
                )}
              </div>
              <div className="text-sm text-text-secondary font-body space-y-1">
                <div className={`transition-all duration-500 ${appliedActions.has(0) || (currentAction.type === "redact" && hasStarted && (animationPhase === "preview" || animationPhase === "applying")) ? "bg-black text-black select-none inline-block px-1" : ""}`}>
                  Senior Product Manager
                </div>
              </div>
            </div>

            {/* Contact Information Section */}
            <div className="space-y-3">
              <div className="text-sm font-body">
                <span className="text-text-secondary">Email:</span>{' '}
                <span className={`text-text-primary font-mono transition-all duration-500 ${appliedActions.has(0) || (currentAction.type === "redact" && hasStarted && (animationPhase === "preview" || animationPhase === "applying")) ? "bg-black text-black select-none inline-block px-1" : ""}`}>
                  john.smith@example.com
                </span>
              </div>
              <div className="text-sm font-body">
                <span className="text-text-secondary">Phone:</span>{' '}
                <span className={`text-text-primary font-mono transition-all duration-500 ${appliedActions.has(0) || (currentAction.type === "redact" && hasStarted && (animationPhase === "preview" || animationPhase === "applying")) ? "bg-black text-black select-none inline-block px-1" : ""}`}>
                  +1 (555) 123-4567
                </span>
              </div>
              <div className="text-sm font-body">
                <span className="text-text-secondary">Address:</span>{' '}
                <span className={`text-text-primary transition-all duration-500 ${appliedActions.has(0) || (currentAction.type === "redact" && hasStarted && (animationPhase === "preview" || animationPhase === "applying")) ? "bg-black text-black select-none inline-block px-1" : ""}`}>
                  123 Business Street, San Francisco, CA 94105
                </span>
              </div>
            </div>

            {/* Invoice Section */}
            <div className="mt-8 pt-6 border-t border-border">
              <h3 className="text-lg font-body font-semibold text-text-primary mb-4">Invoice #INV-2024-001</h3>
              <div className="space-y-2 text-sm font-body">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Date:</span>
                  <span className={`text-text-primary font-medium transition-all duration-500 ${appliedActions.has(2) || (currentAction.type === "highlight" && hasStarted && (animationPhase === "preview" || animationPhase === "applying")) ? "bg-yellow-200 px-2 py-0.5 rounded" : ""}`}>
                    March 15, 2024
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Payment due:</span>
                  <span className={`text-text-primary font-medium transition-all duration-500 ${appliedActions.has(2) || (currentAction.type === "highlight" && hasStarted && (animationPhase === "preview" || animationPhase === "applying")) ? "bg-yellow-200 px-2 py-0.5 rounded" : ""}`}>
                    April 15, 2024
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-border mt-2">
                  <span className="text-text-secondary font-semibold">Amount:</span>
                  <span className="text-text-primary font-semibold">$2,450.00</span>
                </div>
              </div>
            </div>

            {/* Additional Content */}
            <div className="mt-6 pt-6 border-t border-border">
              <p className="text-sm text-text-secondary font-body leading-relaxed">
                This document contains confidential information. Please handle with care.
                All personal data is subject to privacy regulations.
              </p>
            </div>

            {/* Split Indicator */}
            {(appliedActions.has(3) || (currentAction.type === "split" && hasStarted && (animationPhase === "preview" || animationPhase === "applying"))) && (
              <div className="mt-8 pt-8 border-t-2 border-dashed transition-all duration-500 animate-in fade-in slide-in-from-bottom-4" style={{ borderColor: 'var(--color-primary)' }}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--color-primary)' }}></div>
                  <div className="text-sm font-medium" style={{ color: 'var(--color-primary)' }}>
                    Split point: Invoice #INV-2024-002
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Subtle success indicator */}
          {animationPhase === "applying" && (
            <div className="absolute top-6 right-6 bg-success text-text-inverse px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-20 animate-in fade-in slide-in-from-top-4">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm font-medium font-body">Applied</span>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
