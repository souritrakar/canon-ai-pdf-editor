"use client";

import { useState, useEffect } from "react";

interface AnimatedPromptProps {
  currentIndex?: number;
  prompts?: string[];
  isExternalControl?: boolean;
  onTypingComplete?: () => void;
}

const defaultPrompts = [
  "redact all personal information",
  "replace John Smith with Jane Doe everywhere",
  "highlight all dates in yellow",
  "split this file whenever the invoice number changes",
];

export function AnimatedPrompt({ 
  currentIndex: externalIndex, 
  prompts = defaultPrompts,
  isExternalControl = false,
  onTypingComplete
}: AnimatedPromptProps = {}) {
  const [internalIndex, setInternalIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(true);
  const [showCursor, setShowCursor] = useState(true);

  const currentPromptIndex = isExternalControl ? (externalIndex ?? 0) : internalIndex;
  const currentPrompt = prompts[currentPromptIndex];

  useEffect(() => {
    if (isExternalControl && externalIndex !== undefined) {
      // Reset when external index changes
      setDisplayedText("");
      setIsTyping(true);
    }
  }, [externalIndex, isExternalControl]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (isTyping && displayedText.length < currentPrompt.length) {
      timeoutId = setTimeout(() => {
        setDisplayedText(currentPrompt.slice(0, displayedText.length + 1));
      }, 50);
    } else if (isTyping && displayedText.length === currentPrompt.length) {
      // Finished typing, notify parent immediately
      if (onTypingComplete && isExternalControl) {
        onTypingComplete();
      }
      // Minimal wait time for very fast cycles
      const displayTime = isExternalControl ? 500 : 2000;
      timeoutId = setTimeout(() => {
        setIsTyping(false);
      }, displayTime);
    } else if (!isTyping && displayedText.length > 0) {
      // Deleting - faster
      timeoutId = setTimeout(() => {
        setDisplayedText(currentPrompt.slice(0, displayedText.length - 1));
      }, 20);
    } else if (!isTyping && displayedText.length === 0 && !isExternalControl) {
      // Finished deleting, move to next prompt (only if not externally controlled)
      setInternalIndex((prev) => (prev + 1) % prompts.length);
      setIsTyping(true);
    }

    return () => clearTimeout(timeoutId);
  }, [displayedText, isTyping, currentPrompt, currentPromptIndex, isExternalControl, prompts, onTypingComplete]);

  // Cursor blink
  useEffect(() => {
    const interval = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 530);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <div className="relative rounded-2xl bg-surface border border-border shadow-lg overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex-1 min-h-[1.5rem]">
            <div className="flex items-center gap-2 text-text-primary font-body">
              <span className="text-base leading-relaxed">{displayedText}</span>
              <span
                className={`inline-block w-0.5 h-5 transition-opacity duration-150 ${
                  showCursor ? "opacity-100" : "opacity-0"
                }`}
                style={{ backgroundColor: 'var(--color-primary)' }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

