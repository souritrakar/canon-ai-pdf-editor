"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SyncedDemo } from "@/components/synced-demo";
import { FadeInOnScroll } from "@/components/scroll-animation";
import { HowItWorks } from "@/components/how-it-works";
import { useEffect, useState } from "react";

export default function Home() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div className="flex min-h-screen flex-col relative overflow-hidden">
      {/* Grain texture overlay */}
      <div className="fixed inset-0 grain-texture pointer-events-none z-50" />
      
      {/* Navigation */}
      <nav className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity group">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-text-inverse font-display font-semibold transition-transform group-hover:scale-105 shadow-sm">
              C
            </div>
            <span className="text-lg font-display font-semibold text-text-primary">Canon</span>
          </a>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="font-body">
              Sign in
            </Button>
            <Button size="sm" className="font-body bg-primary hover:bg-primary-hover shadow-sm hover:shadow-md transition-all duration-200 hover:translate-y-[-1px]">
              Get started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative container mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32 lg:py-40">
        {/* Animated gradient background */}
        <div 
          className="absolute inset-0 opacity-30 blur-3xl pointer-events-none transition-opacity duration-1000"
          style={{
            background: `radial-gradient(circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(235, 79, 52, 0.15), transparent 50%)`,
          }}
        />
        
        <div className="relative mx-auto max-w-7xl">
          <FadeInOnScroll>
            <div className="text-center mb-16">
              <h1 className="text-display font-display font-semibold text-text-primary mb-6 tracking-tight">
                Edit PDFs with
                <br />
                <span className="text-primary">natural language</span>
              </h1>
              <p className="text-xl text-text-secondary mb-4 max-w-2xl mx-auto leading-relaxed font-body">
                Stop wrestling with PDF editors. Describe what you want in plain English.
              </p>
              <p className="text-lg text-text-tertiary mb-10 max-w-2xl mx-auto leading-relaxed font-body">
                Canon understands context, shows you exactly what will change, and preserves your document's layout perfectly.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
                <Button 
                  size="lg" 
                  className="w-full sm:w-auto font-body bg-primary hover:bg-primary-hover text-text-inverse shadow-md hover:shadow-lg transition-all duration-200 hover:translate-y-[-2px] px-8"
                >
                  Start editing
                </Button>
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="w-full sm:w-auto font-body border-2 border-border hover:bg-surface-subtle transition-all duration-200 hover:translate-y-[-2px] px-8"
                >
                  Watch demo
                </Button>
              </div>
            </div>
          </FadeInOnScroll>

          {/* Aligned Prompt and PDF Demo */}
          <FadeInOnScroll delay={200}>
            <SyncedDemo />
          </FadeInOnScroll>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="relative border-t border-border py-20 sm:py-24 bg-surface-subtle/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <FadeInOnScroll>
            <div className="mx-auto max-w-3xl text-center mb-16">
              <h2 className="text-h2 font-display font-semibold text-text-primary mb-4">
                Built for real workflows
              </h2>
              <p className="text-lg text-text-secondary font-body">
                From legal documents to invoices, Canon handles the tedious work so you can focus on what matters.
              </p>
            </div>
          </FadeInOnScroll>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {[
              {
                title: "Legal & Compliance",
                description: "Redact sensitive information across hundreds of pages in seconds. Perfect for discovery, contracts, and regulatory filings.",
                icon: "⚖️",
                examples: ["Redact SSNs", "Remove client names", "Anonymize case files"],
              },
              {
                title: "Financial Documents",
                description: "Update invoice numbers, replace account details, and split multi-page statements automatically.",
                icon: "💰",
                examples: ["Update account numbers", "Split by invoice", "Replace payee names"],
              },
              {
                title: "HR & Onboarding",
                description: "Personalize offer letters, update employee handbooks, and generate custom documents at scale.",
                icon: "👥",
                examples: ["Personalize templates", "Update policies", "Generate contracts"],
              },
              {
                title: "Academic & Research",
                description: "Anonymize research papers, update citations, and prepare documents for publication.",
                icon: "📚",
                examples: ["Anonymize authors", "Update references", "Format citations"],
              },
              {
                title: "Real Estate",
                description: "Update property addresses, replace client names, and customize lease agreements efficiently.",
                icon: "🏠",
                examples: ["Update addresses", "Replace names", "Customize leases"],
              },
              {
                title: "Healthcare",
                description: "De-identify patient records, update provider information, and maintain HIPAA compliance.",
                icon: "🏥",
                examples: ["De-identify records", "Update providers", "Maintain compliance"],
              },
            ].map((useCase, index) => (
              <FadeInOnScroll key={index} delay={index * 100}>
                <Card 
                  className="transition-all duration-300 hover:shadow-lg hover:translate-y-[-4px] border-2 border-border bg-surface cursor-pointer h-full"
                  onMouseEnter={() => setHoveredCard(index)}
                  onMouseLeave={() => setHoveredCard(null)}
                >
                  <CardHeader>
                    <div className="text-4xl mb-4">{useCase.icon}</div>
                    <CardTitle className="font-body font-semibold text-text-primary text-lg">{useCase.title}</CardTitle>
                    <CardDescription className="font-body text-text-secondary leading-relaxed">
                      {useCase.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      {useCase.examples.map((example, i) => (
                        <div key={i} className="text-xs text-text-tertiary font-mono bg-surface-subtle px-2 py-1 rounded">
                          {example}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </FadeInOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* Video Demo Section */}
      <section className="relative border-t border-border py-20 sm:py-24 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <FadeInOnScroll>
            <div className="mx-auto max-w-5xl">
              <div className="text-center mb-12">
                <h2 className="text-h2 font-display font-semibold text-text-primary mb-4">
                  See Canon in action
                </h2>
                <p className="text-lg text-text-secondary font-body">
                  Watch how natural language commands transform document editing
                </p>
              </div>
              
              <div className="relative rounded-2xl border-2 border-border bg-surface overflow-hidden shadow-2xl group">
                <div className="aspect-video bg-gradient-to-br from-surface-subtle to-surface relative">
                  <video
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    autoPlay
                    loop
                    muted
                    playsInline
                    poster="https://o11.ai/_app/immutable/assets/hero-video-poster-optimized.CORCudIr.avif"
                  >
                    <source src="https://icfntnlzhkcstglvgigy.supabase.co/storage/v1/object/public/videos/output.mp4" type="video/mp4" />
                  </video>
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-surface-subtle to-surface opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <div className="text-center space-y-4">
                      <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                        <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p className="text-sm text-text-secondary font-body">Product demo video</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </FadeInOnScroll>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative border-t border-border py-20 sm:py-24 bg-surface-subtle/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <FadeInOnScroll>
            <div className="mx-auto max-w-2xl text-center mb-16">
              <h2 className="text-h2 font-display font-semibold text-text-primary mb-4">
                No more manual editing
              </h2>
              <p className="text-lg text-text-secondary font-body">
                Everything you need to edit PDFs efficiently, without the complexity.
              </p>
            </div>
          </FadeInOnScroll>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
            {[
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                ),
                title: "Natural language commands",
                description: "Describe what you want in plain English. No need to learn complex tools or remember keyboard shortcuts.",
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                ),
                title: "Precise preview",
                description: "See exactly what will change before you commit. Review every modification with confidence.",
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.051-.382-2.016z" />
                  </svg>
                ),
                title: "Layout preserved",
                description: "Your document structure stays intact. Fonts, spacing, and formatting remain exactly as designed.",
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                ),
                title: "Bulk operations",
                description: "Replace text across multiple pages, redact information everywhere, or split files intelligently.",
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
                title: "Fast & accurate",
                description: "Process documents in seconds, not minutes. AI understands context and makes intelligent decisions.",
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
                title: "Review before apply",
                description: "Nothing happens until you approve. Maintain full control over every change to your documents.",
              },
            ].map((feature, index) => (
              <FadeInOnScroll key={index} delay={index * 100}>
                <Card className="transition-all duration-300 hover:shadow-lg hover:translate-y-[-4px] border-2 border-border bg-surface">
                  <CardHeader>
                    <div className="mb-4 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary transition-transform hover:scale-110">
                      {feature.icon}
                    </div>
                    <CardTitle className="font-body font-semibold text-text-primary">{feature.title}</CardTitle>
                    <CardDescription className="font-body text-text-secondary">
                      {feature.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </FadeInOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <HowItWorks />

      {/* CTA Section */}
      <section className="relative border-t border-border bg-gradient-to-br from-surface-subtle to-background py-20 sm:py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <FadeInOnScroll>
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-h2 font-display font-semibold text-text-primary mb-4">
                Ready to edit PDFs the smart way?
              </h2>
              <p className="text-lg text-text-secondary font-body mb-8">
                Join early users and start editing documents with natural language today.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  size="lg" 
                  className="w-full sm:w-auto font-body bg-primary hover:bg-primary-hover text-text-inverse shadow-md hover:shadow-lg transition-all duration-200 hover:translate-y-[-2px] px-8"
                >
                  Get started
                </Button>
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="w-full sm:w-auto font-body border-2 border-border hover:bg-surface-subtle transition-all duration-200 hover:translate-y-[-2px] px-8"
                >
                  Schedule a demo
                </Button>
              </div>
            </div>
          </FadeInOnScroll>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-border py-12 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center">
            <a href="/" className="flex items-center gap-2 mb-4 sm:mb-0 hover:opacity-80 transition-opacity">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-text-inverse font-display font-semibold">
                C
              </div>
              <span className="text-sm font-display font-semibold text-text-primary">Canon</span>
            </a>
            <div className="flex flex-wrap gap-6 text-sm text-text-secondary font-body">
              <a href="#" className="hover:text-text-primary transition-colors">Privacy</a>
              <a href="#" className="hover:text-text-primary transition-colors">Terms</a>
              <a href="#" className="hover:text-text-primary transition-colors">Docs</a>
              <a href="#" className="hover:text-text-primary transition-colors">Contact</a>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-border text-center text-sm text-text-tertiary font-body">
            <p>© {new Date().getFullYear()} Canon. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
