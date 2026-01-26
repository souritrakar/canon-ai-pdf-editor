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
};

const FONTS = {
  display: '"Fraunces", Georgia, serif',
  body: '"Plus Jakarta Sans", system-ui, sans-serif',
  mono: '"JetBrains Mono", monospace',
};

// Demo prompts and their effects
const DEMO_SEQUENCE = [
  {
    prompt: "redact all personal information",
    action: "redact",
  },
  {
    prompt: "replace John Smith with Jane Doe",
    action: "replace",
  },
  {
    prompt: "highlight all dates in yellow",
    action: "highlight",
  },
];

// ============================================================================
// BROWSER CHROME COMPONENT
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
      {/* Browser toolbar */}
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
        {/* Traffic lights */}
        <div style={{ display: "flex", gap: 6 }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "#FF5F57",
            }}
          />
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "#FFBD2E",
            }}
          />
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "#28CA42",
            }}
          />
        </div>

        {/* URL bar */}
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
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke={COLORS.textTertiary}
            strokeWidth="2"
          >
            <rect x="3" y="11" width="18" height="10" rx="2" />
            <circle cx="12" cy="16" r="1" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 12,
              color: COLORS.textSecondary,
            }}
          >
            canon.app/editor
          </span>
        </div>
      </div>

      {/* Content area */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {children}
      </div>
    </div>
  );
};

// ============================================================================
// LEFT SIDEBAR - PAGE THUMBNAILS
// ============================================================================

interface SidebarProps {
  currentPage: number;
}

const Sidebar: React.FC<SidebarProps> = ({ currentPage }) => {
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
      {/* Page thumbnails */}
      {[1, 2].map((page) => (
        <div
          key={page}
          style={{
            background: COLORS.surface,
            borderRadius: 4,
            padding: 4,
            border:
              page === currentPage
                ? `2px solid ${COLORS.primary}`
                : "2px solid transparent",
            opacity: page === currentPage ? 1 : 0.7,
          }}
        >
          {/* Mini page preview */}
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
            {/* Mini text lines */}
            <div
              style={{
                height: 4,
                width: "70%",
                background: COLORS.border,
                borderRadius: 1,
              }}
            />
            <div
              style={{
                height: 3,
                width: "50%",
                background: COLORS.border,
                borderRadius: 1,
              }}
            />
            <div style={{ height: 4 }} />
            <div
              style={{
                height: 2,
                width: "90%",
                background: COLORS.border,
                borderRadius: 1,
              }}
            />
            <div
              style={{
                height: 2,
                width: "80%",
                background: COLORS.border,
                borderRadius: 1,
              }}
            />
            <div
              style={{
                height: 2,
                width: "85%",
                background: COLORS.border,
                borderRadius: 1,
              }}
            />
          </div>
          {/* Page number */}
          <div
            style={{
              textAlign: "center",
              fontFamily: FONTS.mono,
              fontSize: 9,
              color: COLORS.textTertiary,
              marginTop: 4,
            }}
          >
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

interface ToolbarProps {
  activeMode: string;
}

const FloatingToolbar: React.FC<ToolbarProps> = ({ activeMode }) => {
  const tools = [
    { id: "select", icon: "M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" },
    { id: "redact", icon: "M3 3h18v18H3zM9 9h6v6H9z" },
    { id: "highlight", icon: "M9 11l3 3L22 4M2 12l5 5 6-6" },
    { id: "comment", icon: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" },
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
            cursor: "pointer",
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
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
// DOCUMENT CONTENT
// ============================================================================

interface DocumentContentProps {
  activeAction: string | null;
  actionProgress: number;
  appliedActions: Set<string>;
}

const DocumentContent: React.FC<DocumentContentProps> = ({
  activeAction,
  actionProgress,
  appliedActions,
}) => {
  const isRedacted =
    appliedActions.has("redact") ||
    (activeAction === "redact" && actionProgress > 0.3);

  const isReplaced =
    appliedActions.has("replace") ||
    (activeAction === "replace" && actionProgress > 0.3);

  const isHighlighted =
    appliedActions.has("highlight") ||
    (activeAction === "highlight" && actionProgress > 0.3);

  // Scanning effect
  const showScanning = activeAction && actionProgress < 0.3;
  const scanLineY = showScanning
    ? interpolate(actionProgress, [0, 0.3], [0, 100])
    : 0;

  return (
    <div
      style={{
        background: COLORS.surface,
        padding: 28,
        position: "relative",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Scanning line effect */}
      {showScanning && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: `${scanLineY}%`,
            height: 2,
            background: `linear-gradient(90deg, transparent, ${COLORS.primary}, transparent)`,
            boxShadow: `0 0 15px ${COLORS.primary}`,
            zIndex: 10,
          }}
        />
      )}

      {/* Header */}
      <div
        style={{
          borderBottom: `2px solid ${COLORS.border}`,
          paddingBottom: 14,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: 22,
            fontWeight: 600,
            color: COLORS.text,
            marginBottom: 2,
          }}
        >
          {isReplaced ? (
            <span>
              <span
                style={{
                  textDecoration: "line-through",
                  opacity: 0.4,
                  color: COLORS.textSecondary,
                }}
              >
                John Smith
              </span>
              <span style={{ color: COLORS.primary, marginLeft: 6 }}>
                Jane Doe
              </span>
            </span>
          ) : (
            "John Smith"
          )}
        </div>
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 12,
            color: COLORS.textSecondary,
          }}
        >
          Senior Product Manager
        </div>
      </div>

      {/* Contact info */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 12,
            marginBottom: 6,
            display: "flex",
            gap: 6,
          }}
        >
          <span style={{ color: COLORS.textSecondary, width: 50 }}>Email:</span>
          <span
            style={
              isRedacted
                ? {
                    background: "#000",
                    color: "#000",
                    fontFamily: FONTS.mono,
                    padding: "1px 4px",
                    fontSize: 11,
                  }
                : {
                    fontFamily: FONTS.mono,
                    color: COLORS.text,
                    fontSize: 11,
                  }
            }
          >
            john.smith@example.com
          </span>
        </div>
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 12,
            marginBottom: 6,
            display: "flex",
            gap: 6,
          }}
        >
          <span style={{ color: COLORS.textSecondary, width: 50 }}>Phone:</span>
          <span
            style={
              isRedacted
                ? {
                    background: "#000",
                    color: "#000",
                    fontFamily: FONTS.mono,
                    padding: "1px 4px",
                    fontSize: 11,
                  }
                : {
                    fontFamily: FONTS.mono,
                    color: COLORS.text,
                    fontSize: 11,
                  }
            }
          >
            +1 (555) 123-4567
          </span>
        </div>
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 12,
            display: "flex",
            gap: 6,
          }}
        >
          <span style={{ color: COLORS.textSecondary, width: 50 }}>Addr:</span>
          <span
            style={
              isRedacted
                ? {
                    background: "#000",
                    color: "#000",
                    padding: "1px 4px",
                    fontSize: 11,
                  }
                : {
                    color: COLORS.text,
                    fontSize: 11,
                  }
            }
          >
            123 Business St, SF, CA
          </span>
        </div>
      </div>

      {/* Invoice section */}
      <div
        style={{
          borderTop: `1px solid ${COLORS.border}`,
          paddingTop: 14,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 13,
            fontWeight: 600,
            color: COLORS.text,
            marginBottom: 10,
          }}
        >
          Invoice #INV-2024-001
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: FONTS.body,
            fontSize: 11,
            marginBottom: 6,
          }}
        >
          <span style={{ color: COLORS.textSecondary }}>Date:</span>
          <span
            style={
              isHighlighted
                ? {
                    background: COLORS.highlight,
                    padding: "1px 6px",
                    borderRadius: 3,
                    color: COLORS.text,
                  }
                : { color: COLORS.text }
            }
          >
            March 15, 2024
          </span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: FONTS.body,
            fontSize: 11,
            marginBottom: 8,
          }}
        >
          <span style={{ color: COLORS.textSecondary }}>Due:</span>
          <span
            style={
              isHighlighted
                ? {
                    background: COLORS.highlight,
                    padding: "1px 6px",
                    borderRadius: 3,
                    color: COLORS.text,
                  }
                : { color: COLORS.text }
            }
          >
            April 15, 2024
          </span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: FONTS.body,
            fontSize: 11,
            fontWeight: 600,
            borderTop: `1px solid ${COLORS.border}`,
            paddingTop: 6,
          }}
        >
          <span style={{ color: COLORS.textSecondary }}>Amount:</span>
          <span style={{ color: COLORS.text }}>$2,450.00</span>
        </div>
      </div>

      {/* Applied indicator */}
      {activeAction && actionProgress > 0.7 && (
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
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M5 13l4 4L19 7" />
          </svg>
          Applied
        </div>
      )}
    </div>
  );
};

// ============================================================================
// COMMAND CAPSULE
// ============================================================================

interface CommandCapsuleProps {
  prompt: string;
  phase: "typing" | "processing" | "done";
  progress: number;
}

const CommandCapsule: React.FC<CommandCapsuleProps> = ({
  prompt,
  phase,
  progress,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const charsToShow = Math.min(Math.floor(progress * prompt.length), prompt.length);

  // Cursor blink
  const cursorOpacity =
    phase === "typing"
      ? interpolate((frame % 16), [0, 8, 16], [1, 0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;

  // Entrance animation
  const entrance = spring({
    frame,
    fps,
    config: { damping: 200 },
  });

  const translateY = interpolate(entrance, [0, 1], [10, 0]);
  const opacity = interpolate(entrance, [0, 1], [0, 1]);

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
        {/* Sparkle icon */}
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
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="white"
          >
            <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5L12 2z" />
          </svg>
        </div>

        {/* Input text */}
        <div
          style={{
            flex: 1,
            fontFamily: FONTS.body,
            fontSize: 13,
            color: charsToShow > 0 ? COLORS.text : COLORS.textTertiary,
          }}
        >
          {charsToShow > 0 ? (
            <>
              {prompt.slice(0, charsToShow)}
              {phase === "typing" && (
                <span
                  style={{
                    opacity: cursorOpacity,
                    color: COLORS.primary,
                    marginLeft: 1,
                  }}
                >
                  |
                </span>
              )}
            </>
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
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: COLORS.success,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="3"
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}

        {/* Keyboard shortcut hint */}
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 10,
            color: COLORS.textTertiary,
            background: COLORS.surfaceSubtle,
            padding: "2px 6px",
            borderRadius: 4,
          }}
        >
          ⌘Q
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPOSITION
// ============================================================================

export const CanonDemoComposition: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Calculate which demo step we're on and its progress
  const framesPerStep = Math.floor(durationInFrames / DEMO_SEQUENCE.length);

  const currentStepIndex = Math.min(
    Math.floor(frame / framesPerStep),
    DEMO_SEQUENCE.length - 1
  );
  const stepFrame = frame - currentStepIndex * framesPerStep;
  const stepProgress = stepFrame / framesPerStep;

  const currentDemo = DEMO_SEQUENCE[currentStepIndex];

  // Phase timing within each step
  const typingEndProgress = 0.35;
  const processingEndProgress = 0.55;

  let phase: "typing" | "processing" | "done" = "typing";
  let typingProgress = 0;
  let actionProgress = 0;

  if (stepProgress < typingEndProgress) {
    phase = "typing";
    typingProgress = stepProgress / typingEndProgress;
  } else if (stepProgress < processingEndProgress) {
    phase = "processing";
    typingProgress = 1;
    actionProgress =
      (stepProgress - typingEndProgress) /
      (processingEndProgress - typingEndProgress);
  } else {
    phase = "done";
    typingProgress = 1;
    actionProgress = 1;
  }

  // Track applied actions
  const appliedActions = new Set<string>();
  for (let i = 0; i < currentStepIndex; i++) {
    appliedActions.add(DEMO_SEQUENCE[i].action);
  }

  const activeAction = phase !== "typing" ? currentDemo.action : null;

  // Get active tool for toolbar
  const getActiveMode = () => {
    if (activeAction === "redact") return "redact";
    if (activeAction === "highlight") return "highlight";
    return "select";
  };

  // Overall entrance animation
  const overallEntrance = spring({
    frame,
    fps,
    config: { damping: 200 },
  });

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
      <div
        style={{
          width: "100%",
          height: "100%",
          transform: `scale(${scale})`,
          opacity,
        }}
      >
        <BrowserChrome>
          {/* Sidebar */}
          <Sidebar currentPage={1} />

          {/* Main editor area */}
          <div
            style={{
              flex: 1,
              background: COLORS.background,
              position: "relative",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Floating toolbar */}
            <div
              style={{
                position: "absolute",
                top: 16,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 10,
              }}
            >
              <FloatingToolbar activeMode={getActiveMode()} />
            </div>

            {/* Document area */}
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "60px 24px 80px",
              }}
            >
              <div
                style={{
                  background: COLORS.surface,
                  borderRadius: 8,
                  boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                  width: 340,
                  maxHeight: "100%",
                  overflow: "hidden",
                }}
              >
                <DocumentContent
                  activeAction={activeAction}
                  actionProgress={actionProgress}
                  appliedActions={appliedActions}
                />
              </div>
            </div>

            {/* Command Capsule */}
            <CommandCapsule
              prompt={currentDemo.prompt}
              phase={phase}
              progress={typingProgress}
            />
          </div>
        </BrowserChrome>
      </div>
    </AbsoluteFill>
  );
};

export default CanonDemoComposition;
