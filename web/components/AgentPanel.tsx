"use client";

import { useEffect, useRef } from "react";

interface AgentPanelProps {
  agentId: string;
  agentName: string;
  colorScheme: "blue" | "red" | "green" | "purple";
  tokens: string[];
  isDone: boolean;
  isActive: boolean;
}

const colorMap = {
  blue: {
    border: "border-blue-500/40",
    header: "from-blue-600/20 to-blue-500/10",
    headerBorder: "border-blue-500/30",
    badge: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    dot: "bg-blue-400",
    glow: "shadow-blue-500/10",
    title: "text-blue-300",
    icon: "🎯",
    pulse: "bg-blue-400",
  },
  red: {
    border: "border-red-500/40",
    header: "from-red-600/20 to-red-500/10",
    headerBorder: "border-red-500/30",
    badge: "bg-red-500/20 text-red-300 border-red-500/30",
    dot: "bg-red-400",
    glow: "shadow-red-500/10",
    title: "text-red-300",
    icon: "⚔️",
    pulse: "bg-red-400",
  },
  green: {
    border: "border-emerald-500/40",
    header: "from-emerald-600/20 to-emerald-500/10",
    headerBorder: "border-emerald-500/30",
    badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    dot: "bg-emerald-400",
    glow: "shadow-emerald-500/10",
    title: "text-emerald-300",
    icon: "⚙️",
    pulse: "bg-emerald-400",
  },
  purple: {
    border: "border-purple-500/40",
    header: "from-purple-600/20 to-purple-500/10",
    headerBorder: "border-purple-500/30",
    badge: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    dot: "bg-purple-400",
    glow: "shadow-purple-500/10",
    title: "text-purple-300",
    icon: "✨",
    pulse: "bg-purple-400",
  },
};

export function AgentPanel({
  agentId,
  agentName,
  colorScheme,
  tokens,
  isDone,
  isActive,
}: AgentPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const colors = colorMap[colorScheme];
  const content = tokens.join("");

  // Auto-scroll to bottom as tokens arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [tokens]);

  return (
    <div
      id={`agent-panel-${agentId}`}
      className={`
        relative flex flex-col rounded-2xl border ${colors.border} 
        bg-gray-900/60 backdrop-blur-sm overflow-hidden
        shadow-lg ${colors.glow}
        transition-all duration-300
        ${isActive ? "ring-1 ring-white/10" : ""}
        ${!isActive && !isDone ? "opacity-60" : ""}
      `}
    >
      {/* Header */}
      <div
        className={`
          flex items-center gap-3 px-4 py-3
          bg-gradient-to-r ${colors.header}
          border-b ${colors.headerBorder}
        `}
      >
        <span className="text-lg" aria-hidden="true">{colors.icon}</span>
        <div className="flex-1 min-w-0">
          <h3 className={`font-semibold text-sm ${colors.title}`}>
            {agentName}
          </h3>
        </div>

        {/* Status badge */}
        <div
          className={`
            flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border
            ${colors.badge}
          `}
        >
          {isActive && !isDone ? (
            <>
              {/* Typing indicator dots */}
              <span className="flex gap-0.5">
                <span
                  className={`w-1 h-1 rounded-full ${colors.pulse} animate-bounce`}
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className={`w-1 h-1 rounded-full ${colors.pulse} animate-bounce`}
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className={`w-1 h-1 rounded-full ${colors.pulse} animate-bounce`}
                  style={{ animationDelay: "300ms" }}
                />
              </span>
              <span>Thinking</span>
            </>
          ) : isDone ? (
            <>
              <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
              <span>Complete</span>
            </>
          ) : (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
              <span>Waiting</span>
            </>
          )}
        </div>
      </div>

      {/* Content area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 min-h-0"
        style={{ maxHeight: "320px" }}
      >
        {content ? (
          <div className="prose prose-invert prose-sm max-w-none">
            <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap font-mono">
              {content}
              {isActive && !isDone && (
                <span className="inline-block w-0.5 h-4 bg-white/70 ml-0.5 animate-pulse align-text-bottom" />
              )}
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-600 text-sm">
            {isActive ? "Connecting..." : "Waiting to start..."}
          </div>
        )}
      </div>

      {/* Active glow border animation */}
      {isActive && !isDone && (
        <div
          className={`absolute inset-0 rounded-2xl pointer-events-none`}
          style={{
            background: `linear-gradient(135deg, transparent 40%, rgba(255,255,255,0.03) 100%)`,
          }}
        />
      )}
    </div>
  );
}
