"use client";

import { AGENT_ORDER, AGENT_CONFIG } from "@/lib/agents";

export type StepStatus = "pending" | "active" | "done";

interface DebateStepperProps {
  /** Which agent is currently active (or null for none / synthesis) */
  activeAgentId: string | null;
  /** Set of completed agent ids */
  completedAgents: Set<string>;
  /** Whether synthesis is active */
  isSynthesizing: boolean;
  /** Whether synthesis is done */
  isSynthesisDone: boolean;
}

const STEPS = [
  ...AGENT_ORDER.map((id) => ({
    id,
    label: AGENT_CONFIG[id].name,
    persona: AGENT_CONFIG[id].persona,
    tw: AGENT_CONFIG[id].tw,
  })),
  {
    id: "synthesis",
    label: "Synthesis",
    persona: "MultiMind",
    tw: {
      border: "border-l-amber-500",
      bg: "bg-amber-500/5",
      text: "text-amber-300",
      badge: "bg-amber-500/15 border-amber-500/30 text-amber-300",
      dot: "bg-amber-400",
      dotPulse: "bg-amber-400/40",
      avatarRing: "ring-amber-500/50",
    },
  },
];

export function DebateStepper({
  activeAgentId,
  completedAgents,
  isSynthesizing,
  isSynthesisDone,
}: DebateStepperProps) {
  function getStepStatus(stepId: string): StepStatus {
    if (stepId === "synthesis") {
      if (isSynthesisDone) return "done";
      if (isSynthesizing) return "active";
      return "pending";
    }
    if (completedAgents.has(stepId)) return "done";
    if (activeAgentId === stepId) return "active";
    return "pending";
  }

  return (
    <div
      className="w-full flex items-center gap-0 overflow-x-auto pb-1"
      role="list"
      aria-label="Debate progress"
    >
      {STEPS.map((step, i) => {
        const status = getStepStatus(step.id);
        const isLast = i === STEPS.length - 1;

        return (
          <div key={step.id} className="flex items-center flex-1 min-w-0" role="listitem">
            {/* Step node */}
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              {/* Circle */}
              <div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                  border transition-all duration-300
                  ${
                    status === "done"
                      ? `${step.tw.dot} border-transparent text-white`
                      : status === "active"
                      ? `bg-transparent ${step.tw.text} border-current ring-2 ${step.tw.avatarRing}`
                      : "bg-white/5 border-white/10 text-gray-600"
                  }
                  ${status === "active" ? step.tw.dotPulse + " animate-pulse" : ""}
                `}
              >
                {status === "done" ? (
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                  </svg>
                ) : (
                  <span>{i + 1}</span>
                )}
              </div>

              {/* Label */}
              <span
                className={`text-[10px] font-medium whitespace-nowrap transition-colors duration-200 ${
                  status === "done"
                    ? step.tw.text
                    : status === "active"
                    ? step.tw.text
                    : "text-gray-600"
                }`}
              >
                {step.persona}
              </span>
            </div>

            {/* Connector line */}
            {!isLast && (
              <div className="flex-1 h-px mx-2 bg-white/10 relative overflow-hidden">
                {(status === "done" || (status === "active" && i < STEPS.length - 1)) && (
                  <div
                    className={`absolute inset-y-0 left-0 transition-all duration-500 ${step.tw.dot}`}
                    style={{ width: status === "done" ? "100%" : "50%" }}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
