"use client";

import { useState, useEffect, useRef } from "react";
import { FadeInOnScroll } from "./scroll-animation";

interface Scene {
  scrollRange: [number, number];
  content: React.ReactNode;
}

export function CommandLineCinema() {
  const [scrollProgress, setScrollProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const elementTop = rect.top;
      const elementHeight = rect.height;
      
      // Calculate scroll progress (0 to 1)
      const progress = Math.max(0, Math.min(1, (windowHeight - elementTop) / (elementHeight + windowHeight)));
      setScrollProgress(progress);
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll(); // Initial calculation
    
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Scene 1: 0-25% - The problem
  const scene1Active = scrollProgress >= 0 && scrollProgress < 0.25;
  // Scene 2: 25-50% - First command
  const scene2Active = scrollProgress >= 0.25 && scrollProgress < 0.5;
  // Scene 3: 50-75% - Second command
  const scene3Active = scrollProgress >= 0.5 && scrollProgress < 0.75;
  // Scene 4: 75-100% - Success
  const scene4Active = scrollProgress >= 0.75;

  return (
    <section ref={containerRef} className="relative border-t border-border py-32 sm:py-40 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <FadeInOnScroll>
          <div className="mx-auto max-w-4xl text-center mb-16">
            <h2 className="text-h2 font-display font-semibold text-text-primary mb-4">
              How it works
            </h2>
            <p className="text-lg text-text-secondary font-body">
              Watch a real workflow unfold
            </p>
          </div>
        </FadeInOnScroll>

        {/* Terminal Window */}
        <div className="relative mx-auto max-w-5xl">
          <div className="rounded-xl border-2 border-border bg-surface shadow-2xl overflow-hidden">
            {/* Terminal Header */}
            <div className="bg-surface-subtle border-b border-border px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
              </div>
              <div className="text-xs text-text-tertiary font-mono">canon-terminal</div>
            </div>

            {/* Terminal Content */}
            <div className="bg-black text-green-400 font-mono text-sm p-8 min-h-[600px] relative overflow-hidden">
              {/* Cursor blinking in morse code easter egg */}
              <div className="absolute bottom-4 right-4 text-gray-600 text-xs opacity-50">
                <span className="inline-block w-2 h-4 bg-green-400 animate-pulse" style={{ animationDuration: '0.5s' }}></span>
              </div>
              {/* Scene 1: The Problem */}
              <div className={`absolute inset-0 p-8 transition-opacity duration-1000 ${scene1Active ? 'opacity-100' : 'opacity-0'}`}>
                <div className="space-y-4">
                  <div className="text-gray-400">$ ls -la documents/</div>
                  <div className="text-white">contract_2024.pdf (200 pages)</div>
                  <div className="text-gray-400 mt-6">$ date</div>
                  <div className="text-white">Mon Apr 15 16:47:23 PDT 2024</div>
                  <div className="text-gray-400 mt-6">$ cat urgent_email.txt</div>
                  <div className="text-red-400 italic">
                    "Opposing counsel needs redacted version by 9 AM tomorrow."
                  </div>
                  <div className="text-yellow-400 mt-4 animate-pulse">
                    ⚠️ 200 pages. 4:47 PM. Deadline: 9 AM.
                  </div>
                </div>
              </div>

              {/* Scene 2: First Command */}
              <div className={`absolute inset-0 p-8 transition-opacity duration-1000 ${scene2Active ? 'opacity-100' : 'opacity-0'}`}>
                <div className="space-y-4">
                  <div className="text-gray-400">$ canon redact --ssn --address --privileged contract_2024.pdf</div>
                  <div className="text-green-400 animate-pulse">Processing 200 pages...</div>
                  <div className="w-full bg-gray-800 rounded-full h-2 mt-4 overflow-hidden">
                    <div 
                      className="bg-green-500 h-full transition-all duration-2000"
                      style={{ width: scene2Active ? (scrollProgress > 0.3 && scrollProgress < 0.35 ? '69%' : '100%') : '0%' }}
                    />
                  </div>
                  <div className="text-white mt-4">
                    ✓ Analyzing document structure...<br/>
                    ✓ Identifying SSNs...<br/>
                    ✓ Locating addresses...<br/>
                    ✓ Finding privileged communications...<br/>
                  </div>
                  <div className="text-green-400 mt-4 font-bold">
                    ✓ 847 redactions made
                  </div>
                </div>
              </div>

              {/* Scene 3: Second Command */}
              <div className={`absolute inset-0 p-8 transition-opacity duration-1000 ${scene3Active ? 'opacity-100' : 'opacity-0'}`}>
                <div className="space-y-4">
                  <div className="text-gray-400">$ canon generate-privilege-log --output privilege_log.csv</div>
                  <div className="text-green-400">Generating privilege log...</div>
                  <div className="text-white mt-4">
                    <div className="bg-gray-800 p-4 rounded border border-gray-700">
                      <div className="text-gray-400 text-xs mb-2">privilege_log.csv</div>
                      <div className="space-y-1 text-xs">
                        <div>Page,Reason,Type</div>
                        <div>12,Attorney-client communication,Email</div>
                        <div>45,Work product,Memorandum</div>
                        <div>67,Privileged discussion,Meeting notes</div>
                        <div className="text-gray-500">... (844 more entries)</div>
                      </div>
                    </div>
                  </div>
                  <div className="text-green-400 mt-4">
                    ✓ CSV exported: privilege_log.csv
                  </div>
                </div>
              </div>

              {/* Scene 4: Success */}
              <div className={`absolute inset-0 p-8 transition-opacity duration-1000 ${scene4Active ? 'opacity-100' : 'opacity-0'}`}>
                <div className="space-y-4">
                  <div className="text-gray-400">$ date</div>
                  <div className="text-white">Mon Apr 15 17:12:45 PDT 2024</div>
                  <div className="text-gray-400 mt-6">$ ls -la output/</div>
                  <div className="text-white">
                    contract_2024_redacted.pdf<br/>
                    privilege_log.csv
                  </div>
                  <div className="text-green-400 mt-6 text-xl font-bold">
                    ✓ You're done. Time for dinner.
                  </div>
                  <div className="text-gray-400 mt-4">
                    Total time: 25 minutes<br/>
                    Redactions: 847<br/>
                    Errors: 0
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="mt-8 text-center">
          <p className="text-sm text-text-tertiary font-body">
            Scroll to see the story unfold
          </p>
        </div>
      </div>
    </section>
  );
}

