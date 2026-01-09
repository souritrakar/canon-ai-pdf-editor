"use client";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type EditorMode = "select" | "redact" | "highlight" | "comment";

interface ToolbarProps {
  className?: string;
  activeMode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  disabled?: boolean;
}

interface ToolButtonProps {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  isActive?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

function ToolButton({
  icon,
  label,
  shortcut,
  isActive,
  disabled,
  onClick,
}: ToolButtonProps): React.ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          disabled={disabled}
          className={cn(
            "w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-150 cursor-pointer",
            "hover:bg-surface-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
            "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent",
            isActive
              ? "bg-primary/10 text-primary shadow-sm"
              : "text-text-secondary hover:text-text-primary"
          )}
        >
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="flex items-center gap-2">
        <span>{label}</span>
        {shortcut && (
          <kbd className="px-1.5 py-0.5 rounded bg-surface-subtle border border-border text-[10px] font-mono text-text-secondary">
            {shortcut}
          </kbd>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

function ToolDivider(): React.ReactElement {
  return <div className="w-px h-6 bg-border mx-1" />;
}

export function EditorToolbar({
  className,
  activeMode,
  onModeChange,
  onZoomIn,
  onZoomOut,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  disabled = false,
}: ToolbarProps): React.ReactElement {
  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          "inline-flex items-center gap-0.5 px-2 py-1.5 rounded-xl",
          "bg-surface border border-border shadow-sm",
          "backdrop-blur-sm",
          className
        )}
      >
        {/* Selection Tools */}
        <ToolButton
          icon={
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59"
              />
            </svg>
          }
          label="Select"
          shortcut="V"
          isActive={activeMode === "select"}
          disabled={disabled}
          onClick={() => onModeChange("select")}
        />

        <ToolButton
          icon={
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5.636 5.636a9 9 0 1012.728 0M12 3v9"
              />
            </svg>
          }
          label="Redact"
          shortcut="R"
          isActive={activeMode === "redact"}
          disabled={disabled}
          onClick={() => onModeChange("redact")}
        />

        <ToolButton
          icon={
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42"
              />
            </svg>
          }
          label="Highlight"
          shortcut="H"
          isActive={activeMode === "highlight"}
          disabled={disabled}
          onClick={() => onModeChange("highlight")}
        />

        <ToolButton
          icon={
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
              />
            </svg>
          }
          label="Comment"
          shortcut="C"
          isActive={activeMode === "comment"}
          disabled={disabled}
          onClick={() => onModeChange("comment")}
        />

        <ToolDivider />

        {/* History */}
        <ToolButton
          icon={
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"
              />
            </svg>
          }
          label="Undo"
          shortcut="⌘Z"
          disabled={disabled || !canUndo}
          onClick={() => onUndo?.()}
        />

        <ToolButton
          icon={
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3"
              />
            </svg>
          }
          label="Redo"
          shortcut="⌘⇧Z"
          disabled={disabled || !canRedo}
          onClick={() => onRedo?.()}
        />

        <ToolDivider />

        {/* Zoom */}
        <ToolButton
          icon={
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6"
              />
            </svg>
          }
          label="Zoom In"
          shortcut="⌘+"
          disabled={disabled}
          onClick={() => onZoomIn?.()}
        />

        <ToolButton
          icon={
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM13.5 10.5h-6"
              />
            </svg>
          }
          label="Zoom Out"
          shortcut="⌘-"
          disabled={disabled}
          onClick={() => onZoomOut?.()}
        />
      </div>
    </TooltipProvider>
  );
}
