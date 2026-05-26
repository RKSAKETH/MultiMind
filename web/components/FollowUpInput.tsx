"use client";

import { useState } from "react";

type TargetAgent = "strategist" | "critic" | "technical" | "creative" | "all";

interface FollowUpInputProps {
  onSubmit: (question: string, targetAgent: TargetAgent) => void;
  isStreaming: boolean;
}

const TARGET_OPTIONS: { value: TargetAgent; label: string; icon: string }[] = [
  { value: "all", label: "All Agents", icon: "🌐" },
  { value: "strategist", label: "Strategist", icon: "🎯" },
  { value: "critic", label: "Critic", icon: "⚔️" },
  { value: "technical", label: "Technical Expert", icon: "⚙️" },
  { value: "creative", label: "Creative", icon: "✨" },
];

export function FollowUpInput({ onSubmit, isStreaming }: FollowUpInputProps) {
  const [question, setQuestion] = useState("");
  const [targetAgent, setTargetAgent] = useState<TargetAgent>("all");

  const handleSubmit = () => {
    if (!question.trim() || isStreaming) return;
    onSubmit(question.trim(), targetAgent);
    setQuestion("");
  };

  const canSubmit = question.trim().length > 0 && !isStreaming;

  return (
    <div className="mt-6 border border-white/10 rounded-2xl bg-white/[0.02] backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
        <span className="text-base">💬</span>
        <span className="text-sm font-medium text-gray-300">Ask a follow-up</span>
        <span className="ml-auto text-xs text-gray-600">The panel is listening</span>
      </div>

      <div className="p-4 flex flex-col gap-3">
        {/* Target agent selector */}
        <div className="flex flex-wrap gap-2">
          {TARGET_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              id={`target-${opt.value}`}
              onClick={() => setTargetAgent(opt.value)}
              disabled={isStreaming}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                border transition-all duration-150
                disabled:opacity-50 disabled:cursor-not-allowed
                ${
                  targetAgent === opt.value
                    ? "bg-blue-600/30 border-blue-500/50 text-blue-300"
                    : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20 hover:text-gray-300"
                }
              `}
            >
              <span>{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>

        {/* Text input + submit */}
        <div className="flex gap-3 items-end">
          <textarea
            id="followup-input"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSubmit) {
                handleSubmit();
              }
            }}
            placeholder={
              targetAgent === "all"
                ? "Ask all four agents a follow-up question..."
                : `Ask the ${TARGET_OPTIONS.find((o) => o.value === targetAgent)?.label} a question...`
            }
            rows={2}
            disabled={isStreaming}
            className="
              flex-1 bg-white/[0.03] border border-white/10 rounded-xl
              px-4 py-3 text-gray-200 placeholder-gray-600 text-sm
              resize-none focus:outline-none focus:border-blue-500/50
              focus:ring-1 focus:ring-blue-500/20 transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          />
          <button
            id="followup-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="
              px-5 py-3 rounded-xl font-semibold text-sm
              bg-gradient-to-r from-blue-600 to-purple-600
              hover:from-blue-500 hover:to-purple-500
              disabled:from-gray-700 disabled:to-gray-700
              disabled:cursor-not-allowed disabled:text-gray-500
              text-white transition-all duration-200
              hover:scale-105 disabled:hover:scale-100
              shadow-lg shadow-blue-500/20 disabled:shadow-none
              flex-shrink-0
            "
          >
            {isStreaming ? (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Streaming
              </span>
            ) : (
              "Ask →"
            )}
          </button>
        </div>

        <p className="text-xs text-gray-700">
          Press{" "}
          <kbd className="px-1 py-0.5 rounded bg-white/5 border border-white/10 text-gray-600 text-xs font-mono">
            Ctrl+Enter
          </kbd>{" "}
          to submit
        </p>
      </div>
    </div>
  );
}
