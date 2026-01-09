"use client";

import { useState, useEffect } from "react";
import { FadeInOnScroll } from "./scroll-animation";

export function WhyCanonReceipt() {
  const [manualHours, setManualHours] = useState(0);
  const [manualCost, setManualCost] = useState(0);
  const [canonCost, setCanonCost] = useState(0);
  const [savings, setSavings] = useState(0);

  useEffect(() => {
    // Animate the numbers
    const duration = 2000;
    const steps = 60;
    const stepDuration = duration / steps;
    let currentStep = 0;

    const interval = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;
      
      // Easing function
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      setManualHours(Math.floor(6 * easeOut));
      setManualCost(Math.floor(900 * easeOut));
      setCanonCost(49); // Fixed
      setSavings(Math.floor(851 * easeOut));

      if (currentStep >= steps) {
        clearInterval(interval);
        setManualHours(6);
        setManualCost(900);
        setSavings(851);
      }
    }, stepDuration);

    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative border-t border-border py-20 sm:py-32 bg-surface-subtle/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <FadeInOnScroll>
          <div className="mx-auto max-w-3xl text-center mb-16">
            <h2 className="text-h2 font-display font-semibold text-text-primary mb-4">
              Why Canon
            </h2>
            <p className="text-lg text-text-secondary font-body">
              The math is simple
            </p>
          </div>
        </FadeInOnScroll>

        <div className="max-w-2xl mx-auto">
          {/* Receipt Style */}
          <div className="bg-surface rounded-2xl border-2 border-border shadow-xl overflow-hidden">
            {/* Receipt Header */}
            <div className="bg-surface-subtle border-b border-border px-6 py-4">
              <div className="text-center">
                <h3 className="text-lg font-display font-semibold text-text-primary mb-1">
                  Document Processing Invoice
                </h3>
                <p className="text-xs text-text-tertiary font-body">
                  Based on average 200-page document
                </p>
              </div>
            </div>

            {/* Receipt Items */}
            <div className="p-8 space-y-6">
              {/* Manual Method */}
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div>
                    <div className="font-body font-semibold text-text-primary mb-1">
                      Manual redaction
                    </div>
                    <div className="text-sm text-text-tertiary font-body">
                      Clicking, dragging, checking, rechecking
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-semibold text-text-primary text-lg">
                      {manualHours} hours
                    </div>
                    <div className="text-sm text-text-tertiary font-body">
                      × $150/hr
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="font-mono text-xl font-semibold text-text-primary">
                    ${manualCost.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Canon Method */}
              <div className="space-y-3 pt-4 border-t-2 border-primary/20">
                <div className="flex items-center justify-between pb-3">
                  <div>
                    <div className="font-body font-semibold text-primary mb-1 flex items-center gap-2">
                      <span>Canon</span>
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Automated</span>
                    </div>
                    <div className="text-sm text-text-tertiary font-body">
                      One command. Perfect results.
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-semibold text-primary text-lg">
                      $49/month
                    </div>
                    <div className="text-sm text-text-tertiary font-body">
                      Unlimited documents
                    </div>
                  </div>
                </div>
              </div>

              {/* Total Savings */}
              <div className="pt-6 border-t-2 border-border mt-6">
                <div className="flex items-center justify-between">
                  <div className="font-body font-semibold text-text-primary text-lg">
                    You save:
                  </div>
                  <div className="font-mono text-2xl font-bold text-success">
                    ${savings.toLocaleString()}
                  </div>
                </div>
                <div className="text-sm text-text-tertiary font-body mt-2 text-right">
                  and your sanity
                </div>
              </div>
            </div>

            {/* Receipt Footer */}
            <div className="bg-surface-subtle border-t border-border px-6 py-4">
              <div className="text-center space-y-2">
                <p className="text-xs text-text-tertiary font-body">
                  <span className="font-semibold">Time saved:</span> 5 hours 51 minutes
                </p>
                <p className="text-xs text-text-tertiary font-body">
                  <span className="font-semibold">Errors avoided:</span> ~12 manual mistakes
                </p>
                <p className="text-xs text-text-tertiary font-body italic mt-4">
                  * Based on average 200-page document with 847 redactions
                </p>
              </div>
            </div>
          </div>

          {/* Interactive Prompt Demo */}
          <FadeInOnScroll delay={200}>
            <div className="mt-12 bg-surface rounded-xl border-2 border-border p-8 shadow-lg">
              <div className="mb-6">
                <label className="block text-sm font-body font-medium text-text-primary mb-2">
                  Try describing this edit:
                </label>
                <div className="bg-surface-subtle rounded-lg border border-border p-4 font-mono text-sm text-text-primary">
                  Remove all references to Person X including pronouns, redact their signature on pages where it appears, replace their email with [REDACTED], and generate a log of every change sorted by page number
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-text-secondary font-body">
                  <div className="w-2 h-2 rounded-full bg-success animate-pulse"></div>
                  <span>Canon understands complex, multi-part requests</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-text-secondary font-body">
                  <div className="w-2 h-2 rounded-full bg-success animate-pulse"></div>
                  <span>Executes all operations in a single command</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-text-secondary font-body">
                  <div className="w-2 h-2 rounded-full bg-success animate-pulse"></div>
                  <span>Generates detailed audit trail automatically</span>
                </div>
              </div>
            </div>
          </FadeInOnScroll>
        </div>
      </div>
    </section>
  );
}









