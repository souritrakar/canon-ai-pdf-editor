"use client";

import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";

// ============================================================================
// COLORS & FONTS
// ============================================================================

const COLORS = {
  primary: "#EB4F34",
  background: "#FAF8F5",
  text: "#1C1917",
  textSecondary: "#78716c",
  textTertiary: "#a8a29e",
  border: "#e7e5e4",
  surface: "#ffffff",
  surfaceSubtle: "#fafaf9",
  success: "#22c55e",
  highlight: "#FCD34D",
  sidebarBg: "#525659",
  selection: "rgba(235, 79, 52, 0.15)",
  selectionBorder: "#EB4F34",
};

const FONTS = {
  display: '"Fraunces", Georgia, serif',
  body: '"Plus Jakarta Sans", system-ui, sans-serif',
  mono: '"JetBrains Mono", monospace',
};

// Demo sequence for context-specific edits
const DEMO_SEQUENCE = [
  {
    prompt: "redact this contact info",
    action: "redactSelection",
    selectionType: "drag",
  },
  {
    prompt: "make this section more formal",
    action: "rewriteSelection",
    selectionType: "click",
  },
  {
    prompt: "translate to Spanish",
    action: "translateSelection",
    selectionType: "drag",
  },
];

// ============================================================================
// BROWSER CHROME
// ============================================================================

const BrowserChrome: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div
      style={{
        background: COLORS.surface,
        borderRadius: 12,
        boxShadow: "0 25px 80px rgba(0,0,0,0.2)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
      }}
    >
      <div
        style={{
          background: "#f5f5f4",
          borderBottom: `1px solid ${COLORS.border}`,
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#FF5F57" }} />
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#FFBD2E" }} />
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#28CA42" }} />
        </div>
        <div
          style={{
            flex: 1,
            background: COLORS.surface,
            borderRadius: 6,
            padding: "6px 12px",
            border: `1px solid ${COLORS.border}`,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.textTertiary} strokeWidth="2">
            <rect x="3" y="11" width="18" height="10" rx="2" />
            <circle cx="12" cy="16" r="1" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: COLORS.textSecondary }}>
            canon.app/editor
          </span>
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>{children}</div>
    </div>
  );
};

// ============================================================================
// SIDEBAR
// ============================================================================

const Sidebar: React.FC = () => {
  return (
    <div
      style={{
        width: 80,
        background: COLORS.sidebarBg,
        borderRight: `1px solid ${COLORS.border}`,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {[1, 2].map((page) => (
        <div
          key={page}
          style={{
            background: COLORS.surface,
            borderRadius: 4,
            padding: 4,
            border: page === 1 ? `2px solid ${COLORS.primary}` : "2px solid transparent",
            opacity: page === 1 ? 1 : 0.7,
          }}
        >
          <div
            style={{
              width: "100%",
              aspectRatio: "8.5/11",
              background: COLORS.surface,
              borderRadius: 2,
              padding: 4,
              display: "flex",
              flexDirection: "column",
              gap: 3,
            }}
          >
            <div style={{ height: 4, width: "70%", background: COLORS.border, borderRadius: 1 }} />
            <div style={{ height: 3, width: "50%", background: COLORS.border, borderRadius: 1 }} />
            <div style={{ height: 4 }} />
            <div style={{ height: 2, width: "90%", background: COLORS.border, borderRadius: 1 }} />
            <div style={{ height: 2, width: "80%", background: COLORS.border, borderRadius: 1 }} />
          </div>
          <div style={{ textAlign: "center", fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textTertiary, marginTop: 4 }}>
            {page}
          </div>
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// FLOATING TOOLBAR
// ============================================================================

const FloatingToolbar: React.FC<{ activeMode: string }> = ({ activeMode }) => {
  const tools = [
    { id: "select", icon: "M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" },
    { id: "lasso", icon: "M3 12a9 9 0 1018 0 9 9 0 00-18 0M12 3v2M12 19v2" },
    { id: "redact", icon: "M3 3h18v18H3zM9 9h6v6H9z" },
    { id: "ai", icon: "M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5L12 2z" },
  ];

  return (
    <div
      style={{
        display: "flex",
        background: COLORS.surface,
        borderRadius: 10,
        padding: 4,
        gap: 2,
        boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
        border: `1px solid ${COLORS.border}`,
      }}
    >
      {tools.map((tool) => (
        <div
          key={tool.id}
          style={{
            width: 32,
            height: 32,
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: activeMode === tool.id ? COLORS.primary : "transparent",
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill={tool.id === "ai" && activeMode === tool.id ? "white" : "none"}
            stroke={activeMode === tool.id ? "white" : COLORS.textSecondary}
            strokeWidth="2"
          >
            <path d={tool.icon} />
          </svg>
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// CURSOR COMPONENT
// ============================================================================

interface CursorProps {
  x: number;
  y: number;
  isDragging: boolean;
}

const Cursor: React.FC<CursorProps> = ({ x, y, isDragging }) => {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        pointerEvents: "none",
        zIndex: 100,
        transform: "translate(-2px, -2px)",
      }}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill={isDragging ? COLORS.primary : COLORS.text}
        style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))" }}
      >
        <path d="M5.5 3.21V20.8l5.6-5.6 3.9 8.8 2.8-1.2-3.9-8.8h7.5L5.5 3.21z" />
      </svg>
      {isDragging && (
        <div
          style={{
            position: "absolute",
            top: 20,
            left: 12,
            background: COLORS.primary,
            color: "white",
            padding: "2px 6px",
            borderRadius: 4,
            fontSize: 9,
            fontFamily: FONTS.mono,
            whiteSpace: "nowrap",
          }}
        >
          selecting...
        </div>
      )}
    </div>
  );
};

// ============================================================================
// DOCUMENT CONTENT WITH SELECTION
// ============================================================================

interface DocumentContentProps {
  currentStep: number;
  stepProgress: number;
  phase: "selecting" | "prompting" | "processing" | "done";
  selectionProgress: number;
}

const DocumentContent: React.FC<DocumentContentProps> = ({
  currentStep,
  stepProgress,
  phase,
  selectionProgress,
}) => {
  const frame = useCurrentFrame();

  // Selection should only show AFTER drag completes (not during "selecting" phase)
  const selectionComplete = selectionProgress > 0.9;
  const showContentSelection = (phase === "prompting" || phase === "processing") ||
    (phase === "selecting" && selectionComplete);

  // Accurate content section positions (measured from DocumentContent container)
  // Layout: 20px padding + ~48px header (16px font + 16px margin + 10px padding + border)
  // Each section: 10px padding top/bottom, 14px marginBottom, ~14px title, variable content
  const sectionPositions = [
    { top: 48, height: 70 },   // Contact: header ends ~48px, section is ~70px tall
    { top: 132, height: 90 }, // Description: 48 + 70 + 14 margin = 132px
    { top: 236, height: 56 },  // Footer: 132 + 90 + 14 margin = 236px
  ];

  const sections = [
    {
      id: "contact",
      title: "Contact Information",
      content: "Email: sarah@company.com\nPhone: (555) 987-6543",
      isSelected: currentStep === 0 && showContentSelection,
      isRedacted: currentStep > 0 || (currentStep === 0 && phase === "done"),
      position: sectionPositions[0],
    },
    {
      id: "description",
      title: "Project Description",
      content: "Hey! So basically we gotta finish this ASAP. It's super important and stuff. Let me know if u need anything!",
      isSelected: currentStep === 1 && showContentSelection,
      isRewritten: currentStep > 1 || (currentStep === 1 && phase === "done"),
      rewrittenContent: "Dear Team, Please prioritize the completion of this project at your earliest convenience. Do not hesitate to reach out should you require any assistance.",
      position: sectionPositions[1],
    },
    {
      id: "footer",
      title: "Thank You Note",
      content: "Thank you for your business!",
      isSelected: currentStep === 2 && showContentSelection,
      isTranslated: currentStep === 2 && phase === "done",
      translatedContent: "¡Gracias por su negocio!",
      position: sectionPositions[2],
    },
  ];

  // Cursor position animation with smooth spring-based movement
  const getCursorPosition = () => {
    const section = sections[currentStep];
    const pos = section.position;

    // Selection box covers the section with some padding
    const boxLeft = 10;
    const boxTop = pos.top;
    const boxWidth = 220;
    const boxHeight = pos.height;

    // Cursor start/end positions (top-left to bottom-right of selection)
    const startX = boxLeft;
    const startY = boxTop;
    const endX = boxLeft + boxWidth;
    const endY = boxTop + boxHeight;

    if (phase === "selecting") {
      // Two phases: move to start position, then drag to end
      const movePhase = interpolate(selectionProgress, [0, 0.25], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
      const dragPhase = interpolate(selectionProgress, [0.25, 0.95], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

      // Smooth easing for natural movement
      const easedMove = movePhase < 1 ? (1 - Math.pow(1 - movePhase, 3)) : 1; // ease-out cubic
      const easedDrag = dragPhase < 1 ? (1 - Math.pow(1 - dragPhase, 2)) : 1; // ease-out quad

      // Idle position (center of document)
      const idleX = 120;
      const idleY = pos.top + pos.height / 2;

      // Current position
      const currentX = movePhase < 1
        ? interpolate(easedMove, [0, 1], [idleX, startX])
        : interpolate(easedDrag, [0, 1], [startX, endX]);

      const currentY = movePhase < 1
        ? interpolate(easedMove, [0, 1], [idleY, startY])
        : interpolate(easedDrag, [0, 1], [startY, endY]);

      return {
        x: currentX,
        y: currentY,
        isDragging: movePhase >= 1 && dragPhase > 0.05,
      };
    }

    return { x: endX, y: endY, isDragging: false };
  };

  const cursor = getCursorPosition();

  // Selection box that grows from cursor drag start to current position
  const getSelectionBox = () => {
    if (phase !== "selecting") return null;

    const section = sections[currentStep];
    const pos = section.position;

    // Only show after cursor reaches start position
    const dragPhase = interpolate(selectionProgress, [0.25, 0.95], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    if (dragPhase <= 0.02) return null;

    const easedDrag = 1 - Math.pow(1 - dragPhase, 2); // ease-out quad

    const boxLeft = 10;
    const boxTop = pos.top;
    const boxWidth = 220;
    const boxHeight = pos.height;

    return {
      top: boxTop,
      left: boxLeft,
      width: boxWidth * easedDrag,
      height: boxHeight * easedDrag,
      opacity: 1,
    };
  };

  const selectionBox = getSelectionBox();

  return (
    <div
      style={{
        background: COLORS.surface,
        padding: 20,
        position: "relative",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Document header */}
      <div
        style={{
          fontFamily: FONTS.display,
          fontSize: 16,
          fontWeight: 600,
          color: COLORS.text,
          marginBottom: 16,
          paddingBottom: 10,
          borderBottom: `2px solid ${COLORS.border}`,
        }}
      >
        Project Brief
      </div>

      {/* Content sections */}
      {sections.map((section) => (
        <div
          key={section.id}
          style={{
            marginBottom: 14,
            padding: 10,
            borderRadius: 6,
            background: section.isSelected ? COLORS.selection : "transparent",
            border: section.isSelected ? `2px solid ${COLORS.selectionBorder}` : "2px solid transparent",
            transition: "none", // No CSS transitions!
          }}
        >
          <div
            style={{
              fontFamily: FONTS.body,
              fontSize: 10,
              fontWeight: 600,
              color: COLORS.textSecondary,
              marginBottom: 4,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            {section.title}
          </div>
          <div
            style={{
              fontFamily: FONTS.body,
              fontSize: 11,
              color: section.isRedacted ? "#000" : COLORS.text,
              background: section.isRedacted ? "#000" : "transparent",
              padding: section.isRedacted ? "2px 4px" : 0,
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
            }}
          >
            {section.isRewritten
              ? section.rewrittenContent
              : section.isTranslated
              ? section.translatedContent
              : section.content}
          </div>

          {/* Show transformation indicator */}
          {(section.isRewritten || section.isTranslated) && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                marginTop: 6,
                padding: "2px 6px",
                background: COLORS.success + "20",
                borderRadius: 4,
                fontSize: 9,
                fontFamily: FONTS.mono,
                color: COLORS.success,
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 13l4 4L19 7" />
              </svg>
              {section.isRewritten ? "Rewritten" : "Translated"}
            </div>
          )}
        </div>
      ))}

      {/* Selection box overlay */}
      {selectionBox && (
        <div
          style={{
            position: "absolute",
            top: selectionBox.top,
            left: selectionBox.left,
            width: selectionBox.width,
            height: selectionBox.height,
            border: `2px dashed ${COLORS.selectionBorder}`,
            borderRadius: 4,
            background: COLORS.selection,
            opacity: selectionBox.opacity,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Animated cursor */}
      {phase === "selecting" && (
        <Cursor x={cursor.x} y={cursor.y} isDragging={cursor.isDragging} />
      )}

      {/* AI thinking indicator */}
      {phase === "processing" && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${COLORS.primary}, #f97316)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 0 20px ${COLORS.primary}40`,
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="white"
              style={{ transform: `rotate(${frame * 3}deg)` }}
            >
              <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5L12 2z" />
            </svg>
          </div>
          <div style={{ fontFamily: FONTS.body, fontSize: 10, color: COLORS.textSecondary }}>
            AI processing...
          </div>
        </div>
      )}

      {/* Applied indicator */}
      {phase === "done" && stepProgress > 0.6 && stepProgress < 0.95 && (
        <div
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            background: COLORS.success,
            color: "white",
            padding: "5px 10px",
            borderRadius: 6,
            fontFamily: FONTS.body,
            fontSize: 11,
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: 4,
            boxShadow: "0 2px 8px rgba(34, 197, 94, 0.3)",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 13l4 4L19 7" />
          </svg>
          Done
        </div>
      )}
    </div>
  );
};

// ============================================================================
// COMMAND CAPSULE WITH SELECTION CONTEXT
// ============================================================================

interface CommandCapsuleProps {
  prompt: string;
  phase: "selecting" | "prompting" | "processing" | "done";
  typingProgress: number;
  hasSelection: boolean;
}

const CommandCapsule: React.FC<CommandCapsuleProps> = ({ prompt, phase, typingProgress, hasSelection }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const charsToShow = phase === "prompting" || phase === "processing" || phase === "done"
    ? Math.min(Math.floor(typingProgress * prompt.length), prompt.length)
    : 0;

  const cursorOpacity = phase === "prompting"
    ? interpolate((frame % 16), [0, 8, 16], [1, 0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 0;

  const entrance = spring({ frame, fps, config: { damping: 200 } });
  const translateY = interpolate(entrance, [0, 1], [10, 0]);
  const opacity = interpolate(entrance, [0, 1], [0, 1]);

  // Selection chip animation
  const showChip = hasSelection && (phase === "prompting" || phase === "processing" || phase === "done");
  const chipEntrance = showChip ? spring({ frame, fps, config: { damping: 15 }, delay: 5 }) : 0;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 20,
        left: "50%",
        transform: `translateX(-50%) translateY(${translateY}px)`,
        opacity,
        zIndex: 20,
      }}
    >
      <div
        style={{
          background: COLORS.surface,
          borderRadius: 24,
          padding: "10px 16px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
          border: `1px solid ${COLORS.border}`,
          display: "flex",
          alignItems: "center",
          gap: 10,
          minWidth: 320,
        }}
      >
        {/* AI sparkle icon */}
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            background: COLORS.primary,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
            <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5L12 2z" />
          </svg>
        </div>

        {/* Selection chip */}
        {showChip && (
          <div
            style={{
              background: COLORS.selection,
              border: `1px solid ${COLORS.selectionBorder}`,
              borderRadius: 12,
              padding: "3px 8px",
              fontSize: 10,
              fontFamily: FONTS.mono,
              color: COLORS.primary,
              display: "flex",
              alignItems: "center",
              gap: 4,
              transform: `scale(${interpolate(chipEntrance, [0, 1], [0.8, 1])})`,
              opacity: interpolate(chipEntrance, [0, 1], [0, 1]),
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
            </svg>
            Selection
          </div>
        )}

        {/* Input text */}
        <div style={{ flex: 1, fontFamily: FONTS.body, fontSize: 13, color: charsToShow > 0 ? COLORS.text : COLORS.textTertiary }}>
          {charsToShow > 0 ? (
            <>
              {prompt.slice(0, charsToShow)}
              {phase === "prompting" && <span style={{ opacity: cursorOpacity, color: COLORS.primary, marginLeft: 1 }}>|</span>}
            </>
          ) : phase === "selecting" ? (
            "Select content to edit..."
          ) : (
            "Describe a change..."
          )}
        </div>

        {/* Processing indicator */}
        {phase === "processing" && (
          <div
            style={{
              width: 16,
              height: 16,
              border: `2px solid ${COLORS.border}`,
              borderTopColor: COLORS.primary,
              borderRadius: "50%",
              transform: `rotate(${frame * 12}deg)`,
            }}
          />
        )}

        {/* Done checkmark */}
        {phase === "done" && (
          <div style={{ width: 20, height: 20, borderRadius: "50%", background: COLORS.success, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
              <path d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}

        {/* Keyboard shortcut */}
        <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textTertiary, background: COLORS.surfaceSubtle, padding: "2px 6px", borderRadius: 4 }}>
          ⌘Q
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPOSITION
// ============================================================================

export const CanonDemoContextComposition: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const framesPerStep = Math.floor(durationInFrames / DEMO_SEQUENCE.length);
  const currentStepIndex = Math.min(Math.floor(frame / framesPerStep), DEMO_SEQUENCE.length - 1);
  const stepFrame = frame - currentStepIndex * framesPerStep;
  const stepProgress = stepFrame / framesPerStep;

  const currentDemo = DEMO_SEQUENCE[currentStepIndex];

  // Phase timing: selecting -> prompting -> processing -> done
  const selectingEnd = 0.25;
  const promptingEnd = 0.50;
  const processingEnd = 0.70;

  let phase: "selecting" | "prompting" | "processing" | "done" = "selecting";
  let selectionProgress = 0;
  let typingProgress = 0;

  if (stepProgress < selectingEnd) {
    phase = "selecting";
    selectionProgress = stepProgress / selectingEnd;
  } else if (stepProgress < promptingEnd) {
    phase = "prompting";
    selectionProgress = 1;
    typingProgress = (stepProgress - selectingEnd) / (promptingEnd - selectingEnd);
  } else if (stepProgress < processingEnd) {
    phase = "processing";
    selectionProgress = 1;
    typingProgress = 1;
  } else {
    phase = "done";
    selectionProgress = 1;
    typingProgress = 1;
  }

  // Overall entrance animation
  const overallEntrance = spring({ frame, fps, config: { damping: 200 } });
  const scale = interpolate(overallEntrance, [0, 1], [0.95, 1]);
  const opacity = interpolate(overallEntrance, [0, 1], [0, 1]);

  return (
    <AbsoluteFill
      style={{
        background: "#e5e5e5",
        fontFamily: FONTS.body,
        padding: 24,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", height: "100%", transform: `scale(${scale})`, opacity }}>
        <BrowserChrome>
          <Sidebar />
          <div style={{ flex: 1, background: COLORS.background, position: "relative", display: "flex", flexDirection: "column" }}>
            <div style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 10 }}>
              <FloatingToolbar activeMode={phase === "selecting" ? "lasso" : "ai"} />
            </div>
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 24px 80px" }}>
              <div style={{ background: COLORS.surface, borderRadius: 8, boxShadow: "0 4px 20px rgba(0,0,0,0.08)", width: 340, maxHeight: "100%", overflow: "hidden" }}>
                <DocumentContent
                  currentStep={currentStepIndex}
                  stepProgress={stepProgress}
                  phase={phase}
                  selectionProgress={selectionProgress}
                />
              </div>
            </div>
            <CommandCapsule
              prompt={currentDemo.prompt}
              phase={phase}
              typingProgress={typingProgress}
              hasSelection={selectionProgress > 0.5}
            />
          </div>
        </BrowserChrome>
      </div>
    </AbsoluteFill>
  );
};

export default CanonDemoContextComposition;
