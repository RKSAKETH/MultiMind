"use client";

import { useEffect, useRef } from "react";
import { AGENT_ORDER, AGENT_CONFIG, AgentId } from "@/lib/agents";

export type AgentStatus = "waiting" | "thinking" | "done";

interface AgentStripProps {
  agentStatuses: Record<AgentId, AgentStatus>;
  /** Map from agentId to the DOM element id of their last bubble */
  bubbleIds: Record<AgentId, string | null>;
}

export function AgentStrip({ agentStatuses, bubbleIds }: AgentStripProps) {
  const prevThinking = useRef<Set<AgentId>>(new Set());

  // Track which agents just started thinking for bounce animation
  useEffect(() => {
    AGENT_ORDER.forEach((id) => {
      const el = document.getElementById(`agent-strip-avatar-${id}`);
      if (!el) return;
      const wasThinking = prevThinking.current.has(id);
      const isNowThinking = agentStatuses[id] === "thinking";
      if (!wasThinking && isNowThinking) {
        el.classList.remove("agent-bounce");
        // Force reflow to restart animation
        void el.offsetWidth;
        el.classList.add("agent-bounce");
      }
    });
    prevThinking.current = new Set(
      AGENT_ORDER.filter((id) => agentStatuses[id] === "thinking")
    );
  }, [agentStatuses]);

  function handleAvatarClick(agentId: AgentId) {
    const bubbleId = bubbleIds[agentId];
    if (!bubbleId) return;
    const el = document.getElementById(bubbleId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  return (
    <>
      {/* Desktop: fixed left vertical strip */}
      <aside
        className="hidden md:flex flex-col items-center gap-4 py-6 px-2 sticky top-[73px] self-start"
        aria-label="Agent navigator"
      >
        {AGENT_ORDER.map((id) => {
          const cfg = AGENT_CONFIG[id];
          const status = agentStatuses[id];
          const canClick = !!bubbleIds[id];

          return (
            <button
              key={id}
              id={`agent-strip-avatar-${id}`}
              onClick={() => handleAvatarClick(id)}
              disabled={!canClick}
              title={`${cfg.name} — ${status}`}
              aria-label={`Go to ${cfg.name}'s message`}
              className={`
                relative w-10 h-10 rounded-full flex items-center justify-center
                border-2 transition-all duration-200
                ${canClick ? "cursor-pointer hover:scale-110" : "cursor-default opacity-40"}
                ${cfg.tw.bg} ${cfg.tw.avatarRing}
                ${status === "thinking" ? "ring-2" : "border-transparent"}
              `}
              style={{
                borderColor:
                  status === "thinking"
                    ? undefined
                    : status === "done"
                    ? "transparent"
                    : "rgba(255,255,255,0.08)",
              }}
            >
              {/* Agent icon */}
              <svg
                viewBox="0 0 24 24"
                className={`w-5 h-5 ${cfg.tw.text} fill-current`}
                aria-hidden="true"
              >
                <path d={cfg.icon} />
              </svg>

              {/* Status dot */}
              <span
                className={`
                  absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border border-[#080b12]
                  ${
                    status === "thinking"
                      ? `${cfg.tw.dot} animate-pulse`
                      : status === "done"
                      ? cfg.tw.dot
                      : "bg-gray-600"
                  }
                `}
              />
            </button>
          );
        })}

        {/* Vertical divider */}
        <div className="w-px h-6 bg-white/5" />

        {/* Persona labels (condensed) */}
        {AGENT_ORDER.map((id) => (
          <span
            key={`label-${id}`}
            className={`text-[9px] font-medium uppercase tracking-widest ${AGENT_CONFIG[id].tw.text} opacity-50`}
            style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
          >
            {AGENT_CONFIG[id].persona}
          </span>
        ))}
      </aside>

      {/* Mobile: horizontal strip at the top */}
      <div
        className="md:hidden flex items-center justify-center gap-3 px-4 py-2 border-b border-white/5"
        aria-label="Agent navigator"
      >
        {AGENT_ORDER.map((id) => {
          const cfg = AGENT_CONFIG[id];
          const status = agentStatuses[id];
          const canClick = !!bubbleIds[id];

          return (
            <button
              key={id}
              id={`agent-strip-avatar-mobile-${id}`}
              onClick={() => handleAvatarClick(id)}
              disabled={!canClick}
              title={cfg.name}
              aria-label={`Go to ${cfg.name}`}
              className={`
                relative flex flex-col items-center gap-1
                ${canClick ? "cursor-pointer" : "cursor-default opacity-40"}
              `}
            >
              <div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center
                  ${cfg.tw.bg} border
                  ${status === "thinking" ? `border-current ${cfg.tw.text} ring-2 ${cfg.tw.avatarRing}` : "border-white/10"}
                `}
              >
                <svg
                  viewBox="0 0 24 24"
                  className={`w-4 h-4 ${cfg.tw.text} fill-current`}
                  aria-hidden="true"
                >
                  <path d={cfg.icon} />
                </svg>
                {/* Status dot */}
                <span
                  className={`
                    absolute -bottom-0 -right-0 w-2.5 h-2.5 rounded-full border border-[#080b12]
                    ${
                      status === "thinking"
                        ? `${cfg.tw.dot} animate-pulse`
                        : status === "done"
                        ? cfg.tw.dot
                        : "bg-gray-600"
                    }
                  `}
                />
              </div>
              <span className={`text-[9px] ${cfg.tw.text} opacity-70`}>
                {cfg.name}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
