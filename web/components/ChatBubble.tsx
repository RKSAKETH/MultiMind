"use client";

import { useEffect, useRef } from "react";

export type BubbleType = "agent" | "synthesis" | "you" | "followup_agent";
export type ColorScheme = "blue" | "red" | "green" | "purple" | "amber" | "gray";

interface ChatBubbleProps {
  type: BubbleType;
  agentId?: string;
  agentName?: string;
  colorScheme?: ColorScheme;
  content: string;
  isStreaming: boolean;
  turnLabel?: string;
  icon?: string;
}

const COLOR_MAP: Record<ColorScheme, {
  border: string;
  nameBadge: string;
  nameText: string;
  cursor: string;
  bg: string;
}> = {
  blue: {
    border: "border-l-blue-500",
    nameBadge: "bg-blue-500/15 border-blue-500/30 text-blue-300",
    nameText: "text-blue-300",
    cursor: "bg-blue-400",
    bg: "bg-blue-500/5",
  },
  red: {
    border: "border-l-red-500",
    nameBadge: "bg-red-500/15 border-red-500/30 text-red-300",
    nameText: "text-red-300",
    cursor: "bg-red-400",
    bg: "bg-red-500/5",
  },
  green: {
    border: "border-l-emerald-500",
    nameBadge: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300",
    nameText: "text-emerald-300",
    cursor: "bg-emerald-400",
    bg: "bg-emerald-500/5",
  },
  purple: {
    border: "border-l-purple-500",
    nameBadge: "bg-purple-500/15 border-purple-500/30 text-purple-300",
    nameText: "text-purple-300",
    cursor: "bg-purple-400",
    bg: "bg-purple-500/5",
  },
  amber: {
    border: "border-l-amber-500",
    nameBadge: "bg-amber-500/15 border-amber-500/30 text-amber-300",
    nameText: "text-amber-300",
    cursor: "bg-amber-400",
    bg: "bg-amber-500/5",
  },
  gray: {
    border: "border-l-gray-500",
    nameBadge: "bg-gray-500/15 border-gray-500/30 text-gray-300",
    nameText: "text-gray-300",
    cursor: "bg-gray-400",
    bg: "bg-gray-500/5",
  },
};

const AGENT_ICONS: Record<string, string> = {
  Strategist: "🎯",
  Critic: "⚔️",
  "Technical Expert": "⚙️",
  Creative: "✨",
  Synthesis: "🔮",
  You: "💬",
};

export function ChatBubble({
  type,
  agentName,
  colorScheme = "gray",
  content,
  isStreaming,
  turnLabel,
  icon,
}: ChatBubbleProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const colors = COLOR_MAP[colorScheme];
  const displayName = turnLabel ?? agentName ?? "Agent";
  const displayIcon = icon ?? AGENT_ICONS[displayName] ?? "🤖";

  // Auto-scroll to the bottom of THIS bubble as content streams in
  useEffect(() => {
    if (isStreaming && endRef.current) {
      endRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [content, isStreaming]);

  // "You" bubble — right-aligned, simpler style
  if (type === "you") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] bg-blue-600/20 border border-blue-500/30 rounded-2xl rounded-tr-sm px-4 py-3">
          <p className="text-xs text-blue-400 font-medium mb-1">You</p>
          <p className="text-gray-200 text-sm leading-relaxed">{content}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`
        border-l-[3px] ${colors.border} ${colors.bg}
        rounded-r-2xl rounded-bl-2xl px-4 py-3
        border border-white/5
        transition-all duration-300
      `}
    >
      {/* Agent name badge */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base" aria-hidden="true">{displayIcon}</span>
        <span
          className={`
            text-xs font-semibold px-2 py-0.5 rounded-full border
            ${colors.nameBadge}
          `}
        >
          {displayName}
        </span>
        {isStreaming && content === "" && (
          <span className="flex gap-0.5 ml-1">
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                className={`w-1.5 h-1.5 rounded-full ${colors.cursor} animate-bounce`}
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </span>
        )}
        {isStreaming && content !== "" && (
          <span className="text-xs text-gray-600 ml-auto">streaming...</span>
        )}
      </div>

      {/* Content */}
      {content ? (
        <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">
          {content}
          {isStreaming && (
            <span
              className={`inline-block w-0.5 h-3.5 ${colors.cursor}/70 ml-0.5 animate-pulse align-text-bottom`}
            />
          )}
        </p>
      ) : (
        <p className="text-gray-600 text-sm italic">Thinking...</p>
      )}

      <div ref={endRef} />
    </div>
  );
}
