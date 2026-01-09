"use client";

import { useState, useEffect } from "react";
import { FadeInOnScroll } from "./scroll-animation";

interface Step {
  number: string;
  title: string;
  description: string;
  detail: string;
  example?: string;
  visual: "upload" | "preview" | "apply";
}

const steps: Step[] = [
  {
    number: "1",
    title: "Describe what you want",
    description: "Upload your PDF and tell Canon what to change. Use natural language—no training required.",
    detail: "Canon understands context, not just keywords. It knows that 'personal information' includes names, emails, phone numbers, and addresses.",
    example: "redact all personal information",
    visual: "upload",
  },
  {
    number: "2",
    title: "Review the preview",
    description: "See exactly what will change before you commit. Every modification is highlighted and explained.",
    detail: "Every change is highlighted and explained. You can see exactly what will be redacted, replaced, or modified before committing.",
    visual: "preview",
  },
  {
    number: "3",
    title: "Apply with confidence",
    description: "Approve the changes and Canon applies them directly to your PDF while preserving layout and formatting.",
    detail: "Your document structure stays intact. No broken layouts, no missing fonts, no reformatting. Just the changes you requested.",
    visual: "apply",
  },
];

export function HowItWorks() {
  const [activeStep, setActiveStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % steps.length);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const currentStep = steps[activeStep];

  return (
    <section className="relative border-t border-border py-20 sm:py-32 bg-background overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary rounded-full blur-3xl"></div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <FadeInOnScroll>
          <div className="mx-auto max-w-4xl text-center mb-16">
            <h2 className="text-h2 font-display font-semibold text-text-primary mb-4">
              How it works
            </h2>
            <p className="text-lg text-text-secondary font-body">
              Three simple steps. Zero complexity.
            </p>
          </div>
        </FadeInOnScroll>

        {/* Step Progress Bar - Moved Above */}
        <div className="mb-12 max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            {steps.map((step, index) => (
              <div
                key={index}
                className={`flex-1 text-center transition-all duration-300 ${
                  index <= activeStep ? "opacity-100" : "opacity-30"
                }`}
              >
                <div
                  className={`text-xs font-body font-medium mb-2 ${
                    index === activeStep ? "text-primary" : "text-text-tertiary"
                  }`}
                >
                  Step {step.number}
                </div>
              </div>
            ))}
          </div>
          <div className="relative h-2 bg-surface-subtle rounded-full overflow-hidden">
            <div
              className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all duration-500 ease-out"
              style={{ width: `${((activeStep + 1) / steps.length) * 100}%` }}
            >
              <div className="absolute inset-0 bg-white/30 animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-2 gap-16 items-center max-w-6xl mx-auto relative px-8 lg:px-12">
          {/* Left: Step Content */}
          <div className="relative min-h-[400px] flex items-center">
            {/* Previous Button - Left of text content */}
            <button
              onClick={() => {
                setActiveStep((prev) => (prev - 1 + steps.length) % steps.length);
              }}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-8 lg:-translate-x-20 w-12 h-12 rounded-full border-2 border-border bg-surface hover:bg-primary hover:border-primary hover:text-text-inverse transition-all duration-300 flex items-center justify-center group disabled:opacity-30 disabled:cursor-not-allowed shadow-lg z-20 cursor-pointer"
              disabled={isAnimating}
            >
              <svg
                className="w-6 h-6 text-text-primary group-hover:text-text-inverse transition-colors"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <div className="w-full">
              {steps.map((step, index) => (
                <div
                  key={index}
                  className={`transition-all duration-500 ${
                    activeStep === index
                      ? "opacity-100 translate-x-0"
                      : "opacity-0 absolute translate-x-[-20px] pointer-events-none"
                  }`}
                  style={{ display: activeStep === index ? "block" : "none" }}
                >
                  <div className="flex gap-8 items-start">
                    <div className="flex-shrink-0">
                      <div className="relative">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-text-inverse font-display font-semibold text-2xl shadow-lg transform transition-transform hover:scale-110">
                          {step.number}
                        </div>
                        <div className="absolute -inset-2 bg-primary/20 rounded-2xl blur-xl animate-pulse" />
                      </div>
                    </div>
                    <div className="flex-1 pt-1">
                      <h3 className="text-h3 font-body font-semibold text-text-primary mb-4">
                        {step.title}
                      </h3>
                      <p className="text-text-secondary font-body mb-5 leading-relaxed text-lg">
                        {step.description}
                      </p>
                      {step.example && (
                        <div className="mt-8 rounded-xl border-2 border-border bg-surface-subtle p-5 font-mono text-sm text-text-primary shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-2 h-2 rounded-full bg-success"></div>
                            <span className="text-xs text-text-tertiary font-body">Command</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-text-tertiary">$</span>
                            <span className="animate-pulse">|</span>
                            <span>{step.example}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Visual Illustration */}
          <div className="relative h-[500px] lg:h-[600px] flex items-center justify-center">
            {/* Next Button - Right of visual content */}
            <button
              onClick={() => {
                setActiveStep((prev) => (prev + 1) % steps.length);
              }}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-8 lg:translate-x-20 w-12 h-12 rounded-full border-2 border-border bg-surface hover:bg-primary hover:border-primary hover:text-text-inverse transition-all duration-300 flex items-center justify-center group disabled:opacity-30 disabled:cursor-not-allowed shadow-lg z-20 cursor-pointer"
              disabled={isAnimating}
            >
              <svg
                className="w-6 h-6 text-text-primary group-hover:text-text-inverse transition-colors"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <div className="relative w-full h-full">
              {/* Upload Visual */}
              {activeStep === 0 && (
                <div className="absolute inset-0 animate-fade-in">
                  <div className="relative w-full h-full flex items-center justify-center">
                    <div className="relative">
                      {/* Upload Icon Animation */}
                      <div className="w-32 h-32 mx-auto mb-8 relative">
                        <div className="absolute inset-0 border-4 border-dashed border-primary rounded-2xl animate-pulse"></div>
                        <div className="absolute inset-4 bg-primary/10 rounded-xl flex items-center justify-center">
                          <svg
                            className="w-16 h-16 text-primary animate-bounce"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                            />
                          </svg>
                        </div>
                      </div>
                      {/* Document Preview */}
                      <div className="mt-8 w-64 mx-auto bg-surface rounded-lg border-2 border-border p-4 shadow-lg transform transition-transform hover:scale-105">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 bg-primary/10 rounded flex items-center justify-center">
                            <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <div className="h-2 bg-border rounded w-3/4 mb-1"></div>
                            <div className="h-1.5 bg-border rounded w-1/2"></div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="h-1.5 bg-border rounded"></div>
                          <div className="h-1.5 bg-border rounded w-5/6"></div>
                          <div className="h-1.5 bg-border rounded w-4/6"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Preview Visual */}
              {activeStep === 1 && (
                <div className="absolute inset-0 animate-fade-in">
                  <div className="relative w-full h-full flex items-center justify-center">
                    <div className="relative w-80">
                      {/* Document with Highlights */}
                      <div className="bg-surface rounded-xl border-2 border-border p-6 shadow-2xl">
                        <div className="space-y-3">
                          <div className="h-3 bg-border rounded w-full"></div>
                          <div className="h-3 bg-border rounded w-3/4"></div>
                          <div className="relative">
                            <div className="h-3 bg-yellow-200 rounded w-full animate-pulse"></div>
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                              <svg className="w-3 h-3 text-text-inverse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </div>
                          </div>
                          <div className="h-3 bg-border rounded w-5/6"></div>
                          <div className="relative">
                            <div className="h-3 bg-black rounded w-full"></div>
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                              <svg className="w-3 h-3 text-text-inverse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </div>
                          </div>
                          <div className="h-3 bg-border rounded w-4/6"></div>
                        </div>
                      </div>
                      {/* Preview Badge */}
                      <div className="absolute -top-4 -right-4 bg-primary text-text-inverse px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-bounce">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        <span className="text-sm font-medium font-body">Preview</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Apply Visual */}
              {activeStep === 2 && (
                <div className="absolute inset-0 animate-fade-in">
                  <div className="relative w-full h-full flex items-center justify-center">
                    <div className="relative w-80">
                      {/* Success Animation */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-24 h-24 rounded-full bg-success/20 flex items-center justify-center animate-ping">
                          <div className="w-16 h-16 rounded-full bg-success/30 flex items-center justify-center">
                            <svg
                              className="w-12 h-12 text-success"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          </div>
                        </div>
                      </div>
                      {/* Final Document */}
                      <div className="bg-surface rounded-xl border-2 border-border p-6 shadow-2xl transform transition-transform hover:scale-105">
                        <div className="space-y-3">
                          <div className="h-3 bg-border rounded w-full"></div>
                          <div className="h-3 bg-border rounded w-3/4"></div>
                          <div className="h-3 bg-border rounded w-full"></div>
                          <div className="h-3 bg-border rounded w-5/6"></div>
                          <div className="h-3 bg-border rounded w-4/6"></div>
                        </div>
                        {/* Checkmark Badge */}
                        <div className="absolute -bottom-3 -right-3 bg-success text-text-inverse px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-sm font-medium font-body">Applied</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

