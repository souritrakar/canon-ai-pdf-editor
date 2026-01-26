"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Player, PlayerRef } from "@remotion/player";
import { CanonDemoComposition } from "./CanonDemo";
import { CanonDemoCreateComposition } from "./CanonDemoCreate";
import { CanonDemoContextComposition } from "./CanonDemoContext";

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

const COLORS = {
  primary: "#EB4F34",
  text: "#1C1917",
  textSecondary: "#78716c",
  textTertiary: "#a8a29e",
  border: "#e7e5e4",
  surface: "#ffffff",
};

const SLIDES = [
  {
    id: "edit",
    title: "Edit",
    subtitle: "Transform documents with natural language",
    component: CanonDemoComposition,
  },
  {
    id: "create",
    title: "Create",
    subtitle: "Build professional PDFs from scratch",
    component: CanonDemoCreateComposition,
  },
  {
    id: "context",
    title: "Context",
    subtitle: "Select and edit specific content",
    component: CanonDemoContextComposition,
  },
];

// ============================================================================
// SLIDESHOW COMPONENT
// ============================================================================

interface CanonDemoSlideshowProps {
  className?: string;
}

export const CanonDemoSlideshow: React.FC<CanonDemoSlideshowProps> = ({ className }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const playerRef = useRef<PlayerRef>(null);

  const goToSlide = useCallback((index: number) => {
    if (isTransitioning || index === currentSlide) return;

    setIsTransitioning(true);
    setCurrentSlide(index);

    // Reset transition state after animation
    setTimeout(() => {
      setIsTransitioning(false);
      // Restart the player from beginning when slide changes
      if (playerRef.current) {
        playerRef.current.seekTo(0);
        playerRef.current.play();
      }
    }, 300);
  }, [currentSlide, isTransitioning]);

  const goToPrev = useCallback(() => {
    const newIndex = currentSlide === 0 ? SLIDES.length - 1 : currentSlide - 1;
    goToSlide(newIndex);
  }, [currentSlide, goToSlide]);

  const goToNext = useCallback(() => {
    const newIndex = currentSlide === SLIDES.length - 1 ? 0 : currentSlide + 1;
    goToSlide(newIndex);
  }, [currentSlide, goToSlide]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        goToPrev();
      } else if (e.key === "ArrowRight") {
        goToNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToPrev, goToNext]);

  const currentSlideData = SLIDES[currentSlide];

  return (
    <div className={className} style={{ position: "relative" }}>
      {/* Slide title and subtitle */}
      <div
        style={{
          textAlign: "center",
          marginBottom: 20,
          opacity: isTransitioning ? 0 : 1,
          transform: isTransitioning ? "translateY(-10px)" : "translateY(0)",
          transition: "opacity 0.2s ease, transform 0.2s ease",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 8,
          }}
        >
          {SLIDES.map((slide, index) => (
            <button
              key={slide.id}
              onClick={() => goToSlide(index)}
              style={{
                padding: "6px 16px",
                borderRadius: 20,
                border: "none",
                background: index === currentSlide ? COLORS.primary : "transparent",
                color: index === currentSlide ? "white" : COLORS.textSecondary,
                fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              {slide.title}
            </button>
          ))}
        </div>
        <p
          style={{
            fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
            fontSize: 14,
            color: COLORS.textSecondary,
            margin: 0,
          }}
        >
          {currentSlideData.subtitle}
        </p>
      </div>

      {/* Player container with navigation arrows */}
      <div style={{ position: "relative" }}>
        {/* Left arrow */}
        <button
          onClick={goToPrev}
          style={{
            position: "absolute",
            left: -60,
            top: "50%",
            transform: "translateY(-50%)",
            width: 44,
            height: 44,
            borderRadius: "50%",
            border: `1px solid ${COLORS.border}`,
            background: COLORS.surface,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            transition: "all 0.2s ease",
            zIndex: 10,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = COLORS.primary;
            e.currentTarget.style.borderColor = COLORS.primary;
            const svg = e.currentTarget.querySelector("svg");
            if (svg) svg.style.stroke = "white";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = COLORS.surface;
            e.currentTarget.style.borderColor = COLORS.border;
            const svg = e.currentTarget.querySelector("svg");
            if (svg) svg.style.stroke = COLORS.text;
          }}
          aria-label="Previous slide"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke={COLORS.text}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        {/* Right arrow */}
        <button
          onClick={goToNext}
          style={{
            position: "absolute",
            right: -60,
            top: "50%",
            transform: "translateY(-50%)",
            width: 44,
            height: 44,
            borderRadius: "50%",
            border: `1px solid ${COLORS.border}`,
            background: COLORS.surface,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            transition: "all 0.2s ease",
            zIndex: 10,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = COLORS.primary;
            e.currentTarget.style.borderColor = COLORS.primary;
            const svg = e.currentTarget.querySelector("svg");
            if (svg) svg.style.stroke = "white";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = COLORS.surface;
            e.currentTarget.style.borderColor = COLORS.border;
            const svg = e.currentTarget.querySelector("svg");
            if (svg) svg.style.stroke = COLORS.text;
          }}
          aria-label="Next slide"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke={COLORS.text}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        {/* Player */}
        <div
          style={{
            opacity: isTransitioning ? 0 : 1,
            transform: isTransitioning ? "scale(0.98)" : "scale(1)",
            transition: "opacity 0.2s ease, transform 0.2s ease",
          }}
        >
          <Player
            ref={playerRef}
            component={currentSlideData.component}
            durationInFrames={540}
            fps={30}
            compositionWidth={800}
            compositionHeight={600}
            loop
            autoPlay
            acknowledgeRemotionLicense
            style={{
              width: "100%",
              borderRadius: 16,
              overflow: "hidden",
              boxShadow: "0 25px 50px rgba(28, 25, 23, 0.12)",
            }}
          />
        </div>
      </div>

      {/* Dot indicators */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 8,
          marginTop: 20,
        }}
      >
        {SLIDES.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            style={{
              width: index === currentSlide ? 24 : 8,
              height: 8,
              borderRadius: 4,
              border: "none",
              background: index === currentSlide ? COLORS.primary : COLORS.border,
              cursor: "pointer",
              transition: "all 0.3s ease",
            }}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>

      {/* Keyboard hint */}
      <div
        style={{
          textAlign: "center",
          marginTop: 12,
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 11,
          color: COLORS.textTertiary,
        }}
      >
        Use ← → arrow keys to navigate
      </div>
    </div>
  );
};

export default CanonDemoSlideshow;
