"use client";

import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Sequence,
  Easing,
} from "remotion";

// ============================================================================
// DESIGN SYSTEM
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
  gradientStart: "#FAF8F5",
  gradientEnd: "#f5f0eb",
};

const FONTS = {
  display: '"Fraunces", Georgia, serif',
  body: '"Plus Jakarta Sans", system-ui, sans-serif',
  mono: '"JetBrains Mono", monospace',
};

// ============================================================================
// SCENE TIMING (in frames at 30fps)
// ============================================================================

const SCENE_TIMING = {
  intro: { start: 0, duration: 90 },           // 0-3s: Logo + tagline
  uploadPdf: { start: 90, duration: 60 },      // 3-5s: Upload animation
  selectElement: { start: 150, duration: 75 }, // 5-7.5s: Select an element
  redactDemo: { start: 225, duration: 120 },   // 7.5-11.5s: Redact personal info
  replaceDemo: { start: 345, duration: 120 },  // 11.5-15.5s: Find & replace
  highlightDemo: { start: 465, duration: 90 }, // 15.5-18.5s: Highlight dates
  outro: { start: 555, duration: 90 },         // 18.5-21.5s: CTA
};

const TOTAL_DURATION = 645; // ~21.5 seconds at 30fps

// ============================================================================
// INTRO SCENE - Canon Logo and Tagline
// ============================================================================

const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100, mass: 0.5 },
  });

  const taglineOpacity = interpolate(
    frame,
    [30, 50],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const taglineY = interpolate(
    frame,
    [30, 50],
    [20, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const v1BadgeOpacity = interpolate(
    frame,
    [50, 65],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${COLORS.gradientStart} 0%, ${COLORS.gradientEnd} 100%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
      }}
    >
      {/* Logo */}
      <div
        style={{
          transform: `scale(${logoScale})`,
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        {/* Canon Icon */}
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 16,
            background: COLORS.primary,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 8px 32px rgba(235, 79, 52, 0.3)",
          }}
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
            <path d="M12 18v-6" stroke="white" strokeWidth="2" fill="none" />
            <path d="M9 15l3 3 3-3" stroke="white" strokeWidth="2" fill="none" />
          </svg>
        </div>

        {/* Canon Text */}
        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: 64,
            fontWeight: 600,
            color: COLORS.text,
            letterSpacing: "-0.02em",
          }}
        >
          Canon
        </div>
      </div>

      {/* Tagline */}
      <div
        style={{
          opacity: taglineOpacity,
          transform: `translateY(${taglineY}px)`,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 28,
            color: COLORS.textSecondary,
            fontWeight: 500,
            marginBottom: 12,
          }}
        >
          AI-native document editing
        </div>
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 18,
            color: COLORS.textTertiary,
          }}
        >
          Edit PDFs with natural language
        </div>
      </div>

      {/* V1 Badge */}
      <div
        style={{
          opacity: v1BadgeOpacity,
          marginTop: 16,
        }}
      >
        <div
          style={{
            background: COLORS.primary,
            color: "white",
            fontFamily: FONTS.mono,
            fontSize: 12,
            fontWeight: 600,
            padding: "6px 16px",
            borderRadius: 20,
            letterSpacing: "0.05em",
          }}
        >
          v1.0
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================================
// BROWSER CHROME
// ============================================================================

const BrowserChrome: React.FC<{ children: React.ReactNode; opacity?: number }> = ({
  children,
  opacity = 1
}) => {
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
        opacity,
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
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#FF5F57" }} />
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#FFBD2E" }} />
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#28CA42" }} />
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

      {/* Content area */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {children}
      </div>
    </div>
  );
};

// ============================================================================
// PAGE THUMBNAILS SIDEBAR
// ============================================================================

interface SidebarProps {
  currentPage: number;
  showRedactions?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ currentPage, showRedactions = false }) => {
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
            border: page === currentPage ? `2px solid ${COLORS.primary}` : "2px solid transparent",
            opacity: page === currentPage ? 1 : 0.7,
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
            {showRedactions && page === 1 ? (
              <>
                <div style={{ height: 2, width: "60%", background: "#000", borderRadius: 1 }} />
                <div style={{ height: 2, width: "50%", background: "#000", borderRadius: 1 }} />
              </>
            ) : (
              <>
                <div style={{ height: 2, width: "90%", background: COLORS.border, borderRadius: 1 }} />
                <div style={{ height: 2, width: "80%", background: COLORS.border, borderRadius: 1 }} />
              </>
            )}
            <div style={{ height: 2, width: "85%", background: COLORS.border, borderRadius: 1 }} />
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

interface ToolbarProps {
  activeMode: "select" | "redact" | "highlight" | "comment";
}

const FloatingToolbar: React.FC<ToolbarProps> = ({ activeMode }) => {
  const tools = [
    { id: "select", icon: "M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z", label: "Select" },
    { id: "redact", icon: "M3 3h18v18H3z", label: "Redact" },
    { id: "highlight", icon: "M9 11l3 3L22 4", label: "Highlight" },
    { id: "comment", icon: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z", label: "Comment" },
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
            width: 36,
            height: 36,
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: activeMode === tool.id ? COLORS.primary : "transparent",
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke={activeMode === tool.id ? "white" : COLORS.textSecondary}
            strokeWidth="2"
          >
            <path d={tool.icon} />
          </svg>
        </div>
      ))}

      {/* Separator */}
      <div style={{ width: 1, background: COLORS.border, margin: "6px 4px" }} />

      {/* Undo/Redo */}
      <div style={{ display: "flex", gap: 2 }}>
        <div style={{ width: 32, height: 36, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.textTertiary} strokeWidth="2">
            <path d="M3 7v6h6" />
            <path d="M3 13a9 9 0 1 0 3-7.7L3 7" />
          </svg>
        </div>
        <div style={{ width: 32, height: 36, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.textTertiary} strokeWidth="2">
            <path d="M21 7v6h-6" />
            <path d="M21 13a9 9 0 1 1-3-7.7l3 2.7" />
          </svg>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// DOCUMENT CONTENT - Contract
// ============================================================================

interface DocumentContentProps {
  state: {
    selectedId?: string;
    redactedIds: Set<string>;
    replacements: Map<string, string>;
    highlightedIds: Set<string>;
    showScanLine?: boolean;
    scanProgress?: number;
  };
}

const DocumentContent: React.FC<DocumentContentProps> = ({ state }) => {
  const { selectedId, redactedIds, replacements, highlightedIds, showScanLine, scanProgress = 0 } = state;

  const isRedacted = (id: string) => redactedIds.has(id);
  const isHighlighted = (id: string) => highlightedIds.has(id);
  const isSelected = (id: string) => selectedId === id;
  const getReplacement = (id: string) => replacements.get(id);

  const selectionStyle = (id: string) => isSelected(id) ? {
    outline: `2px solid ${COLORS.primary}`,
    outlineOffset: 2,
    background: "rgba(235, 79, 52, 0.08)",
    borderRadius: 2,
  } : {};

  const redactedStyle = {
    background: "#000",
    color: "#000",
    padding: "2px 4px",
    borderRadius: 2,
  };

  const highlightStyle = {
    background: COLORS.highlight,
    padding: "2px 6px",
    borderRadius: 3,
  };

  return (
    <div
      style={{
        background: COLORS.surface,
        padding: 32,
        position: "relative",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Scanning line effect */}
      {showScanLine && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: `${scanProgress * 100}%`,
            height: 3,
            background: `linear-gradient(90deg, transparent, ${COLORS.primary}, transparent)`,
            boxShadow: `0 0 20px ${COLORS.primary}`,
            zIndex: 10,
          }}
        />
      )}

      {/* Contract Header */}
      <div style={{ borderBottom: `2px solid ${COLORS.text}`, paddingBottom: 16, marginBottom: 20 }}>
        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: 24,
            fontWeight: 700,
            color: COLORS.text,
            marginBottom: 4,
            letterSpacing: "-0.01em",
          }}
        >
          SERVICE AGREEMENT
        </div>
        <div style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.textTertiary }}>
          Contract #SA-2024-0892
        </div>
      </div>

      {/* Parties Section */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: FONTS.body, fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 10 }}>
          PARTIES
        </div>

        <div style={{ fontFamily: FONTS.body, fontSize: 12, color: COLORS.text, lineHeight: 1.8 }}>
          <div style={{ marginBottom: 8 }}>
            <span style={{ color: COLORS.textSecondary }}>Client: </span>
            <span style={{ ...selectionStyle("client-name"), ...(isRedacted("client-name") ? redactedStyle : {}) }}>
              {getReplacement("client-name") ? (
                <>
                  <span style={{ textDecoration: "line-through", opacity: 0.4, color: COLORS.textSecondary }}>
                    Acme Corporation
                  </span>
                  <span style={{ color: COLORS.primary, marginLeft: 4 }}>{getReplacement("client-name")}</span>
                </>
              ) : "Acme Corporation"}
            </span>
          </div>

          <div style={{ marginBottom: 8 }}>
            <span style={{ color: COLORS.textSecondary }}>Contact: </span>
            <span style={{ ...selectionStyle("contact-name"), ...(isRedacted("contact-name") ? redactedStyle : {}) }}>
              John Smith
            </span>
          </div>

          <div style={{ marginBottom: 8 }}>
            <span style={{ color: COLORS.textSecondary }}>Email: </span>
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: 11,
                ...selectionStyle("email"),
                ...(isRedacted("email") ? redactedStyle : {}),
              }}
            >
              john.smith@acme.com
            </span>
          </div>

          <div>
            <span style={{ color: COLORS.textSecondary }}>Phone: </span>
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: 11,
                ...selectionStyle("phone"),
                ...(isRedacted("phone") ? redactedStyle : {}),
              }}
            >
              +1 (555) 123-4567
            </span>
          </div>
        </div>
      </div>

      {/* Terms Section */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: FONTS.body, fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 10 }}>
          TERMS
        </div>

        <div style={{ fontFamily: FONTS.body, fontSize: 12, color: COLORS.text, lineHeight: 1.8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ color: COLORS.textSecondary }}>Effective Date:</span>
            <span style={isHighlighted("date-effective") ? highlightStyle : {}}>
              January 15, 2024
            </span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ color: COLORS.textSecondary }}>Expiration Date:</span>
            <span style={isHighlighted("date-expiry") ? highlightStyle : {}}>
              January 15, 2025
            </span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: COLORS.textSecondary }}>Renewal Date:</span>
            <span style={isHighlighted("date-renewal") ? highlightStyle : {}}>
              December 15, 2024
            </span>
          </div>
        </div>
      </div>

      {/* Value Section */}
      <div
        style={{
          borderTop: `1px solid ${COLORS.border}`,
          paddingTop: 16,
          display: "flex",
          justifyContent: "space-between",
          fontFamily: FONTS.body,
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        <span style={{ color: COLORS.textSecondary }}>Contract Value:</span>
        <span style={{ color: COLORS.text }}>$48,000.00 USD</span>
      </div>
    </div>
  );
};

// ============================================================================
// COMMAND CAPSULE
// ============================================================================

interface CapsuleProps {
  text: string;
  typingProgress: number;
  phase: "idle" | "typing" | "processing" | "done";
  showCursor?: boolean;
}

const CommandCapsuleComponent: React.FC<CapsuleProps> = ({ text, typingProgress, phase, showCursor = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const charsToShow = Math.floor(typingProgress * text.length);
  const displayText = text.slice(0, charsToShow);

  const cursorOpacity = phase === "typing" && showCursor
    ? interpolate((frame % 20), [0, 10, 20], [1, 0, 1])
    : 0;

  const entrance = spring({ frame, fps, config: { damping: 200 } });
  const translateY = interpolate(entrance, [0, 1], [20, 0]);
  const opacity = interpolate(entrance, [0, 1], [0, 1]);

  return (
    <div
      style={{
        position: "absolute",
        bottom: 24,
        left: "50%",
        transform: `translateX(-50%) translateY(${translateY}px)`,
        opacity,
        zIndex: 20,
      }}
    >
      <div
        style={{
          background: COLORS.surface,
          borderRadius: 28,
          padding: "12px 20px",
          boxShadow: "0 8px 40px rgba(0,0,0,0.15)",
          border: `1px solid ${COLORS.border}`,
          display: "flex",
          alignItems: "center",
          gap: 12,
          minWidth: 380,
        }}
      >
        {/* AI Icon */}
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: COLORS.primary,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
            <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5L12 2z" />
          </svg>
        </div>

        {/* Input text */}
        <div style={{ flex: 1, fontFamily: FONTS.body, fontSize: 14 }}>
          {phase === "idle" ? (
            <span style={{ color: COLORS.textTertiary }}>Describe a change...</span>
          ) : (
            <span style={{ color: COLORS.text }}>
              {displayText}
              {phase === "typing" && (
                <span style={{ opacity: cursorOpacity, color: COLORS.primary, marginLeft: 1 }}>|</span>
              )}
            </span>
          )}
        </div>

        {/* Status indicator */}
        {phase === "processing" && (
          <div
            style={{
              width: 18,
              height: 18,
              border: `2px solid ${COLORS.border}`,
              borderTopColor: COLORS.primary,
              borderRadius: "50%",
              transform: `rotate(${frame * 12}deg)`,
            }}
          />
        )}

        {phase === "done" && (
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: COLORS.success,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
              <path d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}

        {/* Shortcut hint */}
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 10,
            color: COLORS.textTertiary,
            background: COLORS.surfaceSubtle,
            padding: "3px 8px",
            borderRadius: 4,
            border: `1px solid ${COLORS.border}`,
          }}
        >
          Ctrl+Q
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// CHANGE APPLIED TOAST
// ============================================================================

interface ToastProps {
  message: string;
  count?: number;
}

const AppliedToast: React.FC<ToastProps> = ({ message, count }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({ frame, fps, config: { damping: 15, stiffness: 120 } });
  const scale = interpolate(entrance, [0, 1], [0.8, 1]);
  const opacity = interpolate(entrance, [0, 1], [0, 1]);

  return (
    <div
      style={{
        position: "absolute",
        top: 70,
        right: 24,
        transform: `scale(${scale})`,
        opacity,
        zIndex: 30,
      }}
    >
      <div
        style={{
          background: COLORS.success,
          color: "white",
          padding: "10px 16px",
          borderRadius: 10,
          fontFamily: FONTS.body,
          fontSize: 13,
          fontWeight: 500,
          display: "flex",
          alignItems: "center",
          gap: 8,
          boxShadow: "0 4px 20px rgba(34, 197, 94, 0.3)",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M5 13l4 4L19 7" />
        </svg>
        {message}
        {count && count > 1 && (
          <span style={{ opacity: 0.8, fontFamily: FONTS.mono, fontSize: 11 }}>({count})</span>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// EDITOR SCENE
// ============================================================================

interface EditorSceneProps {
  activeMode: "select" | "redact" | "highlight" | "comment";
  documentState: DocumentContentProps["state"];
  capsuleText: string;
  capsuleTypingProgress: number;
  capsulePhase: "idle" | "typing" | "processing" | "done";
  showToast?: boolean;
  toastMessage?: string;
  toastCount?: number;
}

const EditorScene: React.FC<EditorSceneProps> = ({
  activeMode,
  documentState,
  capsuleText,
  capsuleTypingProgress,
  capsulePhase,
  showToast,
  toastMessage,
  toastCount,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({ frame, fps, config: { damping: 200 } });
  const scale = interpolate(entrance, [0, 1], [0.95, 1]);
  const opacity = interpolate(entrance, [0, 1], [0, 1]);

  return (
    <AbsoluteFill
      style={{
        background: "#e5e5e5",
        padding: 32,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", height: "100%", transform: `scale(${scale})`, opacity }}>
        <BrowserChrome>
          <Sidebar currentPage={1} showRedactions={documentState.redactedIds.size > 0} />

          <div
            style={{
              flex: 1,
              background: COLORS.background,
              position: "relative",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Toolbar */}
            <div style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 10 }}>
              <FloatingToolbar activeMode={activeMode} />
            </div>

            {/* Document */}
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "70px 32px 90px" }}>
              <div
                style={{
                  background: COLORS.surface,
                  borderRadius: 8,
                  boxShadow: "0 4px 24px rgba(0,0,0,0.1)",
                  width: 400,
                  maxHeight: "100%",
                  overflow: "hidden",
                }}
              >
                <DocumentContent state={documentState} />
              </div>
            </div>

            {/* Command Capsule */}
            <CommandCapsuleComponent
              text={capsuleText}
              typingProgress={capsuleTypingProgress}
              phase={capsulePhase}
            />

            {/* Toast */}
            {showToast && toastMessage && <AppliedToast message={toastMessage} count={toastCount} />}
          </div>
        </BrowserChrome>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================================
// OUTRO SCENE
// ============================================================================

const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const textOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const textY = interpolate(frame, [0, 20], [30, 0], { extrapolateRight: "clamp" });

  const ctaOpacity = interpolate(frame, [25, 45], [0, 1], { extrapolateRight: "clamp" });
  const ctaScale = spring({ frame: Math.max(0, frame - 25), fps, config: { damping: 12 } });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${COLORS.gradientStart} 0%, ${COLORS.gradientEnd} 100%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 32,
      }}
    >
      {/* Main text */}
      <div style={{ opacity: textOpacity, transform: `translateY(${textY}px)`, textAlign: "center" }}>
        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: 48,
            fontWeight: 600,
            color: COLORS.text,
            marginBottom: 16,
            letterSpacing: "-0.02em",
          }}
        >
          Edit documents,
          <br />
          <span style={{ color: COLORS.primary }}>not software.</span>
        </div>
        <div style={{ fontFamily: FONTS.body, fontSize: 20, color: COLORS.textSecondary }}>
          Natural language document editing for everyone.
        </div>
      </div>

      {/* CTA */}
      <div style={{ opacity: ctaOpacity, transform: `scale(${ctaScale})` }}>
        <div
          style={{
            background: COLORS.primary,
            color: "white",
            fontFamily: FONTS.body,
            fontSize: 16,
            fontWeight: 600,
            padding: "14px 32px",
            borderRadius: 12,
            boxShadow: "0 8px 32px rgba(235, 79, 52, 0.4)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          Try Canon Free
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </div>
      </div>

      {/* Logo footer */}
      <div style={{ position: "absolute", bottom: 40, display: "flex", alignItems: "center", gap: 10, opacity: 0.6 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: COLORS.primary,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
          </svg>
        </div>
        <span style={{ fontFamily: FONTS.display, fontSize: 20, color: COLORS.text }}>Canon</span>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================================
// MAIN COMPOSITION
// ============================================================================

export const CanonProductDemoComposition: React.FC = () => {
  const frame = useCurrentFrame();

  // Demo prompts
  const DEMO_PROMPTS = {
    redact: "redact all personal information",
    replace: "replace Acme Corporation with TechStart Inc",
    highlight: "highlight all dates in the contract",
  };

  // Calculate scene states based on frame
  const getSceneState = () => {
    // REDACT DEMO (frames 225-345)
    if (frame >= 225 && frame < 345) {
      const sceneFrame = frame - 225;
      const typingEnd = 40;
      const processingEnd = 80;

      let phase: "idle" | "typing" | "processing" | "done" = "typing";
      let typingProgress = 0;
      let showScan = false;
      let scanProgress = 0;
      const redactedIds = new Set<string>();
      let showToast = false;

      if (sceneFrame < typingEnd) {
        typingProgress = sceneFrame / typingEnd;
      } else if (sceneFrame < processingEnd) {
        phase = "processing";
        typingProgress = 1;
        showScan = true;
        scanProgress = (sceneFrame - typingEnd) / (processingEnd - typingEnd);
      } else {
        phase = "done";
        typingProgress = 1;
        redactedIds.add("email");
        redactedIds.add("phone");
        redactedIds.add("contact-name");
        showToast = sceneFrame < 110;
      }

      return {
        activeMode: "redact" as const,
        documentState: {
          redactedIds,
          replacements: new Map(),
          highlightedIds: new Set<string>(),
          showScanLine: showScan,
          scanProgress,
        },
        capsuleText: DEMO_PROMPTS.redact,
        capsuleTypingProgress: typingProgress,
        capsulePhase: phase,
        showToast,
        toastMessage: "Redacted personal info",
        toastCount: 3,
      };
    }

    // REPLACE DEMO (frames 345-465)
    if (frame >= 345 && frame < 465) {
      const sceneFrame = frame - 345;
      const typingEnd = 45;
      const processingEnd = 85;

      let phase: "idle" | "typing" | "processing" | "done" = "typing";
      let typingProgress = 0;
      const replacements = new Map<string, string>();
      let showToast = false;

      // Keep previous redactions
      const redactedIds = new Set(["email", "phone", "contact-name"]);

      if (sceneFrame < typingEnd) {
        typingProgress = sceneFrame / typingEnd;
      } else if (sceneFrame < processingEnd) {
        phase = "processing";
        typingProgress = 1;
      } else {
        phase = "done";
        typingProgress = 1;
        replacements.set("client-name", "TechStart Inc");
        showToast = sceneFrame < 110;
      }

      return {
        activeMode: "select" as const,
        documentState: {
          redactedIds,
          replacements,
          highlightedIds: new Set<string>(),
        },
        capsuleText: DEMO_PROMPTS.replace,
        capsuleTypingProgress: typingProgress,
        capsulePhase: phase,
        showToast,
        toastMessage: "Replaced company name",
        toastCount: 1,
      };
    }

    // HIGHLIGHT DEMO (frames 465-555)
    if (frame >= 465 && frame < 555) {
      const sceneFrame = frame - 465;
      const typingEnd = 35;
      const processingEnd = 60;

      let phase: "idle" | "typing" | "processing" | "done" = "typing";
      let typingProgress = 0;
      const highlightedIds = new Set<string>();
      let showToast = false;

      // Keep previous changes
      const redactedIds = new Set(["email", "phone", "contact-name"]);
      const replacements = new Map([["client-name", "TechStart Inc"]]);

      if (sceneFrame < typingEnd) {
        typingProgress = sceneFrame / typingEnd;
      } else if (sceneFrame < processingEnd) {
        phase = "processing";
        typingProgress = 1;
      } else {
        phase = "done";
        typingProgress = 1;
        highlightedIds.add("date-effective");
        highlightedIds.add("date-expiry");
        highlightedIds.add("date-renewal");
        showToast = sceneFrame < 80;
      }

      return {
        activeMode: "highlight" as const,
        documentState: {
          redactedIds,
          replacements,
          highlightedIds,
        },
        capsuleText: DEMO_PROMPTS.highlight,
        capsuleTypingProgress: typingProgress,
        capsulePhase: phase,
        showToast,
        toastMessage: "Highlighted dates",
        toastCount: 3,
      };
    }

    // Default state (upload/select scenes)
    return {
      activeMode: "select" as const,
      documentState: {
        redactedIds: new Set<string>(),
        replacements: new Map(),
        highlightedIds: new Set<string>(),
      },
      capsuleText: "",
      capsuleTypingProgress: 0,
      capsulePhase: "idle" as const,
      showToast: false,
    };
  };

  const sceneState = getSceneState();

  return (
    <AbsoluteFill style={{ background: COLORS.background }}>
      {/* INTRO */}
      <Sequence from={SCENE_TIMING.intro.start} durationInFrames={SCENE_TIMING.intro.duration}>
        <IntroScene />
      </Sequence>

      {/* UPLOAD + SELECT (showing editor) */}
      <Sequence from={SCENE_TIMING.uploadPdf.start} durationInFrames={SCENE_TIMING.selectElement.start + SCENE_TIMING.selectElement.duration - SCENE_TIMING.uploadPdf.start}>
        <EditorScene {...sceneState} capsulePhase="idle" />
      </Sequence>

      {/* REDACT DEMO */}
      <Sequence from={SCENE_TIMING.redactDemo.start} durationInFrames={SCENE_TIMING.redactDemo.duration}>
        <EditorScene {...sceneState} />
      </Sequence>

      {/* REPLACE DEMO */}
      <Sequence from={SCENE_TIMING.replaceDemo.start} durationInFrames={SCENE_TIMING.replaceDemo.duration}>
        <EditorScene {...sceneState} />
      </Sequence>

      {/* HIGHLIGHT DEMO */}
      <Sequence from={SCENE_TIMING.highlightDemo.start} durationInFrames={SCENE_TIMING.highlightDemo.duration}>
        <EditorScene {...sceneState} />
      </Sequence>

      {/* OUTRO */}
      <Sequence from={SCENE_TIMING.outro.start} durationInFrames={SCENE_TIMING.outro.duration}>
        <OutroScene />
      </Sequence>
    </AbsoluteFill>
  );
};

export default CanonProductDemoComposition;
