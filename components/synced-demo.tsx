"use client";

import { useState, useEffect } from "react";
import { AnimatedPrompt } from "./animated-prompt";
import { AnimatedPDFDemo } from "./animated-pdf-demo";

// Synchronized prompts and actions
const syncedPrompts = [
  "redact all personal information",
  "replace John Smith with Jane Doe everywhere",
  "highlight all dates in yellow",
  "split this file whenever the invoice number changes",
];

export function SyncedDemo() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [promptFinished, setPromptFinished] = useState(false);

  // Timing breakdown (optimized for minimal delays):
  // "redact all personal information" = 33 chars × 50ms = 1.65s typing
  // "replace John Smith with Jane Doe everywhere" = 42 chars × 50ms = 2.1s typing
  // "highlight all dates in yellow" = 30 chars × 50ms = 1.5s typing
  // "split this file whenever the invoice number changes" = 50 chars × 50ms = 2.5s typing
  // 
  // After typing: 0.5s display (minimal)
  // PDF preview: 1.5s (starts when typing completes)
  // PDF applying: 0.5s (quick)
  // Deleting: ~20ms per char = ~0.6-1s (faster)
  // 
  // Longest cycle: 2.5s + 0.5s + 1.5s + 0.5s + 1s = 6s
  // We'll use 6s for very fast cycles

  useEffect(() => {
    const cycleDuration = 6000; // 6 seconds per full cycle (much faster)
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % syncedPrompts.length);
      setPromptFinished(false);
    }, cycleDuration);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col gap-8 mb-8 max-w-5xl mx-auto">
      {/* Input Bar Above */}
      <div>
        <AnimatedPrompt 
          currentIndex={currentIndex} 
          prompts={syncedPrompts}
          isExternalControl={true}
          onTypingComplete={() => setPromptFinished(true)}
        />
      </div>

      {/* PDF Demo Below */}
      <div>
        <AnimatedPDFDemo 
          currentIndex={currentIndex}
          isExternalControl={true}
          shouldStart={promptFinished}
        />
      </div>
    </div>
  );
}

