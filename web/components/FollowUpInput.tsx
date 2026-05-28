"use client";

import { useState, useCallback } from "react";
import { AGENT_CONFIG, AgentId } from "@/lib/agents";

type TargetAgent = AgentId | "all";

interface FollowUpInputProps {
  onSubmit: (question: string, targetAgent: TargetAgent) => void;
  isStreaming: boolean;
  synthesisComplete: boolean;
}

const MENTION_MAP: Record<string, TargetAgent> = {
  "@strategist": "strategist",
  "@critic":     "critic",
  "@techexpert": "technical",
  "@technical":  "technical",
  "@creative":   "creative",
  "@all":        "all",
};

const SUGGESTION_CHIPS = [
  "Critic, how do we fix your top concern?",
  "Tech Expert, give a step by step plan",
  "Ask all agents to reconsider",
];

const MENTION_LEGEND: { mention: string; label: string; color: string }[] = [
  { mention: "@strategist", label: "Strategist", color: "text-blue-400" },
  { mention: "@critic",     label: "Critic",     color: "text-red-400" },
  { mention: "@techexpert", label: "Tech Expert",color: "text-emerald-400" },
  { mention: "@creative",   label: "Creative",   color: "text-purple-400" },
  { mention: "@all",        label: "Everyone",   color: "text-gray-400" },
];

/** Parse @mention from text and return the target agent */
function parseMention(text: string): TargetAgent {
  const lower = text.toLowerCase();
  for (const [mention, target] of Object.entries(MENTION_MAP)) {
    if (lower.includes(mention)) return target;
  }
  return "all";
}

export function FollowUpInput({
  onSubmit,
  isStreaming,
  synthesisComplete,
}: FollowUpInputProps) {
  const [question, setQuestion] = useState("");
  const [targetAgent, setTargetAgent] = useState<TargetAgent>("all");

  // Parse @mention on every keystroke
  const handleChange = useCallback((val: string) => {
    setQuestion(val);
    const parsed = parseMention(val);
    setTargetAgent(parsed);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!question.trim() || isStreaming) return;
    onSubmit(question.trim(), targetAgent);
    setQuestion("");
    setTargetAgent("all");
  }, [question, isStreaming, targetAgent, onSubmit]);

  const handleChipClick = (chip: string) => {
    setQuestion(chip);
    setTargetAgent(parseMention(chip));
  };

  const canSubmit = question.trim().length > 0 && !isStreaming;

  if (!synthesisComplete) return null;

  return (
    <>
      {/* Suggestion chips */}
      <div className="flex flex-wrap gap-2 mb-3 px-1">
        {SUGGESTION_CHIPS.map((chip) => (
          <button
            key={chip}
            id={`chip-${chip.slice(0, 20).replace(/\s/g, "-").toLowerCase()}`}
            onClick={() => handleChipClick(chip)}
            className="
              px-3 py-1.5 rounded-full text-xs font-medium
              bg-white/[0.04] border border-white/10
              text-gray-400 hover:text-gray-200
              hover:bg-white/[0.08] hover:border-white/20
              transition-all duration-150
            "
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Input bar — pinned to bottom on mobile */}
      <div className="sticky bottom-0 md:static z-30">
        <div className="border border-white/10 rounded-2xl bg-[#080b12]/95 md:bg-white/[0.02] backdrop-blur-md overflow-hidden md:rounded-2xl rounded-t-2xl rounded-b-none md:rounded-b-2xl">
          {/* Current target indicator */}
          <div className="px-4 pt-3 flex items-center gap-2">
            <span className="text-xs text-gray-600">Directing to:</span>
            {targetAgent === "all" ? (
              <span className="text-xs font-medium text-gray-400 px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                All agents
              </span>
            ) : (
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${AGENT_CONFIG[targetAgent].tw.badge} border`}
              >
                {AGENT_CONFIG[targetAgent].name}
              </span>
            )}
          </div>

          <div className="p-3 flex gap-2 items-end">
            <textarea
              id="followup-input"
              value={question}
              onChange={(e) => handleChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSubmit) {
                  handleSubmit();
                }
              }}
              placeholder={
                targetAgent === "all"
                  ? "Ask everyone a question... (use @mention to target a specific agent)"
                  : `Asking ${AGENT_CONFIG[targetAgent as AgentId].name}... (type @mention to redirect)`
              }
              rows={2}
              disabled={isStreaming}
              className="
                flex-1 bg-white/[0.03] border border-white/10 rounded-xl
                px-4 py-2.5 text-gray-200 placeholder-gray-600 text-sm
                resize-none focus:outline-none focus:border-blue-500/50
                focus:ring-1 focus:ring-blue-500/20 transition-all duration-200
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            />

            <button
              id="followup-submit-btn"
              onClick={handleSubmit}
              disabled={!canSubmit}
              aria-label="Send follow-up"
              className="
                w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                bg-gradient-to-br from-blue-600 to-purple-600
                hover:from-blue-500 hover:to-purple-500
                disabled:from-gray-700 disabled:to-gray-700
                disabled:cursor-not-allowed
                text-white transition-all duration-200
                hover:scale-105 disabled:hover:scale-100
                shadow-lg shadow-blue-500/20 disabled:shadow-none
              "
            >
              {isStreaming ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              )}
            </button>
          </div>

          {/* @mention legend */}
          <div className="px-4 pb-3 flex flex-wrap gap-x-3 gap-y-0.5">
            {MENTION_LEGEND.map(({ mention, label, color }) => (
              <button
                key={mention}
                onClick={() => {
                  const newQ = question + (question ? " " : "") + mention + " ";
                  setQuestion(newQ);
                  setTargetAgent(parseMention(newQ));
                }}
                className="text-[10px] text-gray-700 hover:text-gray-500 transition-colors duration-100"
              >
                <span className={color}>{mention}</span>
                <span className="text-gray-700 ml-0.5">→ {label}</span>
              </button>
            ))}
            <span className="text-[10px] text-gray-700 ml-auto">
              Ctrl+Enter to send
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
