"use client";

import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";

// ============================================================================
// COLORS & FONTS (shared constants)
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

// Demo sequence for creating content - focused on course/guide creators
const DEMO_SEQUENCE = [
  {
    prompt: "create a modern course cover page",
    action: "addCover",
  },
  {
    prompt: "add a table of contents with chapters",
    action: "addTOC",
  },
  {
    prompt: "insert a call-to-action section at the end",
    action: "addCTA",
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

const Sidebar: React.FC<{ currentPage: number }> = ({ currentPage }) => {
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

const FloatingToolbar: React.FC = () => {
  const tools = [
    { id: "select", icon: "M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" },
    { id: "add", icon: "M12 5v14M5 12h14" },
    { id: "text", icon: "M4 7V4h16v3M9 20h6M12 4v16" },
    { id: "image", icon: "M4 4h16v16H4zM4 15l4-4 3 3 5-5 4 4" },
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
      {tools.map((tool, i) => (
        <div
          key={tool.id}
          style={{
            width: 32,
            height: 32,
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: i === 1 ? COLORS.primary : "transparent",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={i === 1 ? "white" : COLORS.textSecondary} strokeWidth="2">
            <path d={tool.icon} />
          </svg>
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// DOCUMENT WITH CREATING ANIMATIONS
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
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const hasCover = appliedActions.has("addCover") || (activeAction === "addCover" && actionProgress > 0.5);
  const hasTOC = appliedActions.has("addTOC") || (activeAction === "addTOC" && actionProgress > 0.5);
  const hasCTA = appliedActions.has("addCTA") || (activeAction === "addCTA" && actionProgress > 0.5);

  // Animation for new elements appearing
  const coverEntrance = hasCover
    ? spring({ frame: frame - (activeAction === "addCover" ? Math.floor(actionProgress * 60) : 0), fps, config: { damping: 15 } })
    : 0;

  const tocEntrance = hasTOC
    ? spring({ frame: frame - (activeAction === "addTOC" ? Math.floor(actionProgress * 60) : 0), fps, config: { damping: 15 } })
    : 0;

  const ctaEntrance = hasCTA
    ? spring({ frame: frame - (activeAction === "addCTA" ? Math.floor(actionProgress * 60) : 0), fps, config: { damping: 15 } })
    : 0;

  // Sparkle effect during creation
  const showSparkle = activeAction && actionProgress > 0.3 && actionProgress < 0.7;

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
      {/* Course Cover Page */}
      {hasCover && (
        <div
          style={{
            transform: `scale(${interpolate(coverEntrance, [0, 1], [0.8, 1])})`,
            opacity: interpolate(coverEntrance, [0, 1], [0, 1]),
            background: `linear-gradient(135deg, ${COLORS.primary}15, #f9731615)`,
            borderRadius: 8,
            padding: 16,
            marginBottom: 14,
            textAlign: "center",
            border: `1px solid ${COLORS.primary}30`,
          }}
        >
          <div style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.primary, marginBottom: 6, letterSpacing: 1 }}>
            COMPLETE GUIDE
          </div>
          <div style={{ fontFamily: FONTS.display, fontSize: 18, fontWeight: 600, color: COLORS.text, marginBottom: 4, lineHeight: 1.2 }}>
            Mastering Digital Marketing
          </div>
          <div style={{ fontFamily: FONTS.body, fontSize: 10, color: COLORS.textSecondary, marginBottom: 8 }}>
            From Zero to Expert in 30 Days
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
            <div style={{ background: COLORS.primary, color: "white", padding: "3px 8px", borderRadius: 4, fontSize: 9, fontFamily: FONTS.body }}>
              2024 Edition
            </div>
            <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, padding: "3px 8px", borderRadius: 4, fontSize: 9, fontFamily: FONTS.body, color: COLORS.textSecondary }}>
              Premium
            </div>
          </div>
        </div>
      )}

      {/* Table of Contents */}
      {hasTOC && (
        <div
          style={{
            transform: `translateY(${interpolate(tocEntrance, [0, 1], [10, 0])}px)`,
            opacity: interpolate(tocEntrance, [0, 1], [0, 1]),
            marginBottom: 14,
          }}
        >
          <div style={{ fontFamily: FONTS.body, fontSize: 11, fontWeight: 600, color: COLORS.text, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={COLORS.primary} strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h10" />
            </svg>
            Table of Contents
          </div>
          {[
            { num: "01", title: "Getting Started", page: "3" },
            { num: "02", title: "Core Strategies", page: "12" },
            { num: "03", title: "Advanced Tactics", page: "28" },
            { num: "04", title: "Case Studies", page: "45" },
          ].map((item, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 0",
                borderBottom: `1px dotted ${COLORS.border}`,
              }}
            >
              <span style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.primary }}>{item.num}</span>
              <span style={{ flex: 1, fontFamily: FONTS.body, fontSize: 10, color: COLORS.text }}>{item.title}</span>
              <span style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textTertiary }}>{item.page}</span>
            </div>
          ))}
        </div>
      )}

      {/* Call to Action Section */}
      {hasCTA && (
        <div
          style={{
            position: "absolute",
            bottom: 20,
            left: 20,
            right: 20,
            transform: `scale(${interpolate(ctaEntrance, [0, 1], [0.9, 1])})`,
            opacity: interpolate(ctaEntrance, [0, 1], [0, 1]),
            background: `linear-gradient(135deg, ${COLORS.text}, #374151)`,
            borderRadius: 8,
            padding: 12,
            textAlign: "center",
          }}
        >
          <div style={{ fontFamily: FONTS.body, fontSize: 11, fontWeight: 600, color: "white", marginBottom: 4 }}>
            Ready to Level Up?
          </div>
          <div style={{ fontFamily: FONTS.body, fontSize: 9, color: "#d1d5db", marginBottom: 8 }}>
            Get exclusive bonuses and updates
          </div>
          <div
            style={{
              background: COLORS.primary,
              color: "white",
              padding: "6px 16px",
              borderRadius: 6,
              fontSize: 10,
              fontFamily: FONTS.body,
              fontWeight: 500,
              display: "inline-block",
            }}
          >
            Join the Community →
          </div>
        </div>
      )}

      {/* Placeholder content when nothing created yet */}
      {!hasCover && !hasTOC && !hasCTA && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: COLORS.textTertiary }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: "0 auto 12px", opacity: 0.5 }}>
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <path d="M14 2v6h6M12 18v-6M9 15h6" />
          </svg>
          <div style={{ fontFamily: FONTS.body, fontSize: 12 }}>Start creating your PDF...</div>
        </div>
      )}

      {/* Sparkle effect */}
      {showSparkle && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: `translate(-50%, -50%) rotate(${frame * 3}deg)`,
            pointerEvents: "none",
          }}
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill={COLORS.primary} opacity={0.5}>
            <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5L12 2z" />
          </svg>
        </div>
      )}

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
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 13l4 4L19 7" />
          </svg>
          Created
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

const CommandCapsule: React.FC<CommandCapsuleProps> = ({ prompt, phase, progress }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const charsToShow = Math.min(Math.floor(progress * prompt.length), prompt.length);

  const cursorOpacity = phase === "typing"
    ? interpolate((frame % 16), [0, 8, 16], [1, 0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 0;

  const entrance = spring({ frame, fps, config: { damping: 200 } });
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

        <div style={{ flex: 1, fontFamily: FONTS.body, fontSize: 13, color: charsToShow > 0 ? COLORS.text : COLORS.textTertiary }}>
          {charsToShow > 0 ? (
            <>
              {prompt.slice(0, charsToShow)}
              {phase === "typing" && <span style={{ opacity: cursorOpacity, color: COLORS.primary, marginLeft: 1 }}>|</span>}
            </>
          ) : (
            "Describe what to create..."
          )}
        </div>

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

        {phase === "done" && (
          <div style={{ width: 20, height: 20, borderRadius: "50%", background: COLORS.success, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
              <path d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}

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

export const CanonDemoCreateComposition: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const framesPerStep = Math.floor(durationInFrames / DEMO_SEQUENCE.length);
  const currentStepIndex = Math.min(Math.floor(frame / framesPerStep), DEMO_SEQUENCE.length - 1);
  const stepFrame = frame - currentStepIndex * framesPerStep;
  const stepProgress = stepFrame / framesPerStep;

  const currentDemo = DEMO_SEQUENCE[currentStepIndex];

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
    actionProgress = (stepProgress - typingEndProgress) / (processingEndProgress - typingEndProgress);
  } else {
    phase = "done";
    typingProgress = 1;
    actionProgress = 1;
  }

  const appliedActions = new Set<string>();
  for (let i = 0; i < currentStepIndex; i++) {
    appliedActions.add(DEMO_SEQUENCE[i].action);
  }

  const activeAction = phase !== "typing" ? currentDemo.action : null;

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
          <Sidebar currentPage={1} />
          <div style={{ flex: 1, background: COLORS.background, position: "relative", display: "flex", flexDirection: "column" }}>
            <div style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 10 }}>
              <FloatingToolbar />
            </div>
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 24px 80px" }}>
              <div style={{ background: COLORS.surface, borderRadius: 8, boxShadow: "0 4px 20px rgba(0,0,0,0.08)", width: 340, maxHeight: "100%", overflow: "hidden" }}>
                <DocumentContent activeAction={activeAction} actionProgress={actionProgress} appliedActions={appliedActions} />
              </div>
            </div>
            <CommandCapsule prompt={currentDemo.prompt} phase={phase} progress={typingProgress} />
          </div>
        </BrowserChrome>
      </div>
    </AbsoluteFill>
  );
};

export default CanonDemoCreateComposition;
