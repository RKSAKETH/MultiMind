"use client";

import { useEffect, useRef } from "react";

interface SynthesisPanelProps {
  tokens: string[];
  isDone: boolean;
  isVisible: boolean;
}

export function SynthesisPanel({ tokens, isDone, isVisible }: SynthesisPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const content = tokens.join("");

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [tokens]);

  if (!isVisible) return null;

  return (
    <div
      id="synthesis-panel"
      className={`
        relative rounded-2xl border border-amber-500/30
        bg-gradient-to-br from-amber-950/40 via-gray-900/60 to-orange-950/40
        backdrop-blur-sm overflow-hidden shadow-xl shadow-amber-500/5
        transition-all duration-700
        ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
      `}
    >
      {/* Decorative top gradient bar */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />

      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-amber-500/20 bg-gradient-to-r from-amber-600/10 to-orange-600/10">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30">
          <span className="text-base" aria-hidden="true">🔮</span>
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-amber-300 text-base">Synthesis</h3>
          <p className="text-amber-400/60 text-xs">
            Combined intelligence from all four agents
          </p>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
          {!isDone ? (
            <>
              <span className="flex gap-0.5">
                <span className="w-1 h-1 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1 h-1 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1 h-1 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "300ms" }} />
              </span>
              <span>Synthesizing</span>
            </>
          ) : (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>Complete</span>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div
        ref={scrollRef}
        className="p-6 overflow-y-auto"
        style={{ maxHeight: "400px" }}
      >
        {content ? (
          <div className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap font-mono">
            {content}
            {!isDone && (
              <span className="inline-block w-0.5 h-4 bg-amber-400/70 ml-0.5 animate-pulse align-text-bottom" />
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center py-8 text-amber-500/50 text-sm">
            Preparing synthesis...
          </div>
        )}
      </div>

      {/* Decorative bottom gradient */}
      {isDone && (
        <div className="h-px w-full bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
      )}
    </div>
  );
}
