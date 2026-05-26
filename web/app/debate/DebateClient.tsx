"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useUser, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getSocket, disconnectSocket } from "@/lib/socket";
import { AgentPanel } from "@/components/AgentPanel";
import { SynthesisPanel } from "@/components/SynthesisPanel";

type AgentId = "strategist" | "critic" | "technical" | "creative";

interface AgentState {
  tokens: string[];
  isDone: boolean;
  isActive: boolean;
}

const AGENT_CONFIGS: {
  id: AgentId;
  name: string;
  colorScheme: "blue" | "red" | "green" | "purple";
}[] = [
  { id: "strategist", name: "Strategist", colorScheme: "blue" },
  { id: "critic", name: "Critic", colorScheme: "red" },
  { id: "technical", name: "Technical Expert", colorScheme: "green" },
  { id: "creative", name: "Creative", colorScheme: "purple" },
];

function createInitialAgentState(): Record<AgentId, AgentState> {
  return {
    strategist: { tokens: [], isDone: false, isActive: false },
    critic: { tokens: [], isDone: false, isActive: false },
    technical: { tokens: [], isDone: false, isActive: false },
    creative: { tokens: [], isDone: false, isActive: false },
  };
}

type DebateStatus =
  | "idle"
  | "creating_session"
  | "debating"
  | "synthesizing"
  | "done"
  | "error";

export default function DebateClient() {
  const { user, isLoaded } = useUser();
  const searchParams = useSearchParams();
  const _sessionId = searchParams.get("sessionId");

  const [problem, setProblem] = useState("");
  const [status, setStatus] = useState<DebateStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [agentStates, setAgentStates] = useState<Record<AgentId, AgentState>>(
    createInitialAgentState()
  );
  const [synthesisTokens, setSynthesisTokens] = useState<string[]>([]);
  const [synthesisDone, setSynthesisDone] = useState(false);
  const [showSynthesis, setShowSynthesis] = useState(false);

  const agentOutputsRef = useRef<Record<string, string>>({});
  const synthesisRef = useRef("");

  const resetState = useCallback(() => {
    setAgentStates(createInitialAgentState());
    setSynthesisTokens([]);
    setSynthesisDone(false);
    setShowSynthesis(false);
    agentOutputsRef.current = {};
    synthesisRef.current = "";
  }, []);

  const saveResults = useCallback(async (sessionId: string) => {
    try {
      await fetch(`/api/sessions/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentOutputs: agentOutputsRef.current,
          synthesisContent: synthesisRef.current,
        }),
      });
    } catch (err) {
      console.warn("Failed to save results to DB:", err);
    }
  }, []);

  const startDebate = useCallback(async () => {
    if (!problem.trim() || !user) return;

    resetState();
    setStatus("creating_session");
    setErrorMsg("");

    let sessionId: string;
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problem: problem.trim() }),
      });
      if (!res.ok) throw new Error("Failed to create session");
      const data = await res.json();
      sessionId = data.sessionId;
      setCurrentSessionId(sessionId);
    } catch {
      setErrorMsg("Failed to create session. Check your database connection.");
      setStatus("error");
      return;
    }

    setStatus("debating");

    setAgentStates((prev) => {
      const next = { ...prev };
      (Object.keys(next) as AgentId[]).forEach((id) => {
        next[id] = { ...next[id], isActive: true };
      });
      return next;
    });

    const socket = getSocket();

    socket.off("agent_token");
    socket.off("agent_done");
    socket.off("synthesis_token");
    socket.off("debate_done");
    socket.off("error");

    socket.on(
      "agent_token",
      ({ agentId, token }: { agentId: AgentId; token: string }) => {
        agentOutputsRef.current[agentId] =
          (agentOutputsRef.current[agentId] ?? "") + token;
        setAgentStates((prev) => ({
          ...prev,
          [agentId]: {
            ...prev[agentId],
            tokens: [...prev[agentId].tokens, token],
            isActive: true,
          },
        }));
      }
    );

    socket.on("agent_done", ({ agentId }: { agentId: AgentId }) => {
      setAgentStates((prev) => ({
        ...prev,
        [agentId]: { ...prev[agentId], isDone: true, isActive: false },
      }));
    });

    socket.on("synthesis_token", ({ token }: { token: string }) => {
      synthesisRef.current += token;
      setStatus("synthesizing");
      setShowSynthesis(true);
      setSynthesisTokens((prev) => [...prev, token]);
    });

    socket.on("debate_done", async () => {
      setSynthesisDone(true);
      setStatus("done");
      socket.disconnect();
      await saveResults(sessionId);
    });

    socket.on("error", ({ message }: { message: string }) => {
      setErrorMsg(message);
      setStatus("error");
    });

    if (!socket.connected) {
      socket.connect();
    }

    socket.emit("start_debate", {
      problem: problem.trim(),
      userId: user.id,
      sessionId,
    });
  }, [problem, user, resetState, saveResults]);

  useEffect(() => {
    return () => {
      disconnectSocket();
    };
  }, []);

  const isRunning = status === "debating" || status === "synthesizing";
  const canStart = problem.trim().length > 0 && !isRunning && isLoaded && !!user;
  const agentsDoneCount = Object.values(agentStates).filter((a) => a.isDone).length;

  return (
    <div className="min-h-screen bg-[#080b12] flex flex-col">
      <div className="absolute inset-0 bg-grid opacity-25 pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 bg-[#080b12]/80 backdrop-blur-sm sticky top-0">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <span className="text-sm font-bold text-white">M</span>
              </div>
              <span className="font-bold text-white text-lg">MultiMind</span>
            </Link>
            <span className="text-gray-700">·</span>
            <span className="text-gray-500 text-sm">Debate</span>
          </div>

          <div className="flex items-center gap-4">
            {isRunning && (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                {status === "debating"
                  ? `${agentsDoneCount}/4 agents done`
                  : "Synthesizing..."}
              </div>
            )}
            {status === "done" && (
              <div className="flex items-center gap-2 text-xs text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Complete
              </div>
            )}
            <UserButton />
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 max-w-7xl mx-auto w-full px-6 py-8 flex flex-col gap-8">
        {/* Input section */}
        <section className="glass-card rounded-2xl p-6">
          <div className="mb-4">
            <label
              htmlFor="problem-input"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              Your Problem or Question
            </label>
            <textarea
              id="problem-input"
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canStart) {
                  startDebate();
                }
              }}
              placeholder={
                "Enter any problem, question, or idea...\n\ne.g. 'Should our startup build our own infrastructure or use AWS?'"
              }
              rows={4}
              disabled={isRunning}
              className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-gray-200 placeholder-gray-600 text-sm resize-none focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-600">
              {problem.length > 0 && `${problem.length} chars · `}
              Press{" "}
              <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-gray-500 text-xs font-mono">
                Ctrl+Enter
              </kbd>{" "}
              to submit
            </p>
            <button
              id="start-debate-btn"
              onClick={startDebate}
              disabled={!canStart}
              className="
                px-6 py-2.5 rounded-xl font-semibold text-sm
                bg-gradient-to-r from-blue-600 to-purple-600
                hover:from-blue-500 hover:to-purple-500
                disabled:from-gray-700 disabled:to-gray-700
                disabled:cursor-not-allowed disabled:text-gray-500
                text-white transition-all duration-200
                hover:scale-105 disabled:hover:scale-100
                shadow-lg shadow-blue-500/20 disabled:shadow-none
              "
            >
              {status === "creating_session"
                ? "Starting..."
                : isRunning
                ? "Running..."
                : status === "done"
                ? "Run Again"
                : "Start Debate"}
            </button>
          </div>

          {status === "error" && errorMsg && (
            <div className="mt-3 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              ⚠️ {errorMsg}
            </div>
          )}
        </section>

        {/* Agent panels 2×2 grid */}
        {(isRunning || status === "done" || agentsDoneCount > 0) && (
          <section>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                Agent Responses
              </h2>
              {isRunning && status === "debating" && (
                <div className="flex gap-1">
                  {AGENT_CONFIGS.map((agent) => (
                    <div
                      key={agent.id}
                      className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                        agentStates[agent.id].isDone
                          ? "bg-emerald-400"
                          : agentStates[agent.id].isActive
                          ? "bg-blue-400 animate-pulse"
                          : "bg-gray-700"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {AGENT_CONFIGS.map((agent) => (
                <AgentPanel
                  key={agent.id}
                  agentId={agent.id}
                  agentName={agent.name}
                  colorScheme={agent.colorScheme}
                  tokens={agentStates[agent.id].tokens}
                  isDone={agentStates[agent.id].isDone}
                  isActive={agentStates[agent.id].isActive}
                />
              ))}
            </div>
          </section>
        )}

        {/* Synthesis panel */}
        {showSynthesis && (
          <section>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                Synthesis
              </h2>
              {!synthesisDone && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              )}
            </div>
            <SynthesisPanel
              tokens={synthesisTokens}
              isDone={synthesisDone}
              isVisible={showSynthesis}
            />
          </section>
        )}

        {status === "done" && currentSessionId && (
          <div className="flex justify-center pb-4">
            <Link
              href="/dashboard"
              className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              ← Back to all debates
            </Link>
          </div>
        )}

        {/* Idle empty state */}
        {status === "idle" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
            <div className="grid grid-cols-2 gap-3 mb-8 opacity-30">
              {[
                { color: "border-blue-500/40 bg-blue-500/5", label: "Strategist" },
                { color: "border-red-500/40 bg-red-500/5", label: "Critic" },
                { color: "border-emerald-500/40 bg-emerald-500/5", label: "Technical" },
                { color: "border-purple-500/40 bg-purple-500/5", label: "Creative" },
              ].map((a) => (
                <div
                  key={a.label}
                  className={`w-32 h-20 rounded-xl border ${a.color} flex items-center justify-center text-xs text-gray-500`}
                >
                  {a.label}
                </div>
              ))}
            </div>
            <p className="text-gray-600 text-sm">
              Enter your problem above and click{" "}
              <strong className="text-gray-500">Start Debate</strong>
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
