"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useUser, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getSocket } from "@/lib/socket";
import {
  AGENT_CONFIG,
  AGENT_ORDER,
  AgentId,
} from "@/lib/agents";
import { ChatBubble, BubbleType } from "@/components/ChatBubble";
import { FollowUpInput } from "@/components/FollowUpInput";
import { DebateStepper } from "@/components/DebateStepper";
import { AgentStrip, AgentStatus } from "@/components/AgentStrip";
import { SynthesisCard } from "@/components/SynthesisCard";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TimelineEntry {
  id: string;
  type: BubbleType | "synthesis";
  agentId?: AgentId;
  content: string;
  isStreaming: boolean;
  isDone: boolean;
}

type DebateStatus =
  | "idle"
  | "creating_session"
  | "debating"
  | "synthesizing"
  | "done"
  | "followup"
  | "error";

// ─── Component ────────────────────────────────────────────────────────────────

export default function DebateClient() {
  const { user, isLoaded } = useUser();
  const searchParams = useSearchParams();
  const _sessionId = searchParams.get("sessionId");

  const [problem, setProblem] = useState("");
  const [status, setStatus] = useState<DebateStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [isFollowupStreaming, setIsFollowupStreaming] = useState(false);
  const [synthesisContent, setSynthesisContent] = useState("");
  const [isSynthesisStreaming, setIsSynthesisStreaming] = useState(false);
  const [isSynthesisDone, setIsSynthesisDone] = useState(false);

  // Track agent statuses for the strip
  const [agentStatuses, setAgentStatuses] = useState<Record<AgentId, AgentStatus>>({
    strategist: "waiting",
    critic: "waiting",
    technical: "waiting",
    creative: "waiting",
  });

  // Map from agentId → DOM id of their last bubble (for scroll-to)
  const [bubbleIds, setBubbleIds] = useState<Record<AgentId, string | null>>({
    strategist: null,
    critic: null,
    technical: null,
    creative: null,
  });

  // Accumulated text refs for saving to DB
  const agentOutputsRef = useRef<Record<string, string>>({});
  const synthesisRef = useRef("");
  const followupOutputsRef = useRef<{ agentId: string; agentName: string; content: string }[]>([]);
  const timelineEndRef = useRef<HTMLDivElement>(null);
  const entryCounterRef = useRef(0);

  const genId = () => `entry-${++entryCounterRef.current}`;

  // Auto-scroll on timeline updates
  useEffect(() => {
    if (timelineEndRef.current) {
      timelineEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [timeline, synthesisContent]);

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const updateLastEntryOfType = useCallback(
    (
      agentId: string | undefined,
      type: TimelineEntry["type"],
      updater: (entry: TimelineEntry) => Partial<TimelineEntry>
    ) => {
      setTimeline((prev) => {
        const idx = [...prev].reverse().findIndex(
          (e) => e.type === type && (agentId === undefined || e.agentId === agentId)
        );
        if (idx === -1) return prev;
        const realIdx = prev.length - 1 - idx;
        const updated = [...prev];
        updated[realIdx] = { ...updated[realIdx], ...updater(updated[realIdx]) };
        return updated;
      });
    },
    []
  );

  const appendToLastEntry = useCallback(
    (agentId: string | undefined, type: TimelineEntry["type"], token: string) => {
      updateLastEntryOfType(agentId, type, (e) => ({ content: e.content + token }));
    },
    [updateLastEntryOfType]
  );

  const addEntry = useCallback((entry: TimelineEntry) => {
    setTimeline((prev) => [...prev, entry]);
    // Track bubble id for scroll-to in AgentStrip
    if (entry.agentId && entry.type !== "synthesis") {
      setBubbleIds((prev) => ({ ...prev, [entry.agentId!]: entry.id }));
    }
  }, []);

  // ─── Save to DB ──────────────────────────────────────────────────────────

  const saveDebateResults = useCallback(async (sessionId: string) => {
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
      console.warn("Failed to save debate results:", err);
    }
  }, []);

  const saveFollowupResults = useCallback(async (sessionId: string) => {
    if (followupOutputsRef.current.length === 0) return;
    try {
      await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followupTurns: followupOutputsRef.current }),
      });
      followupOutputsRef.current = [];
    } catch (err) {
      console.warn("Failed to save follow-up results:", err);
    }
  }, []);

  // ─── Reset helper ─────────────────────────────────────────────────────────

  const resetAll = useCallback(() => {
    setTimeline([]);
    setSynthesisContent("");
    setIsSynthesisStreaming(false);
    setIsSynthesisDone(false);
    agentOutputsRef.current = {};
    synthesisRef.current = "";
    followupOutputsRef.current = [];
    entryCounterRef.current = 0;
    setErrorMsg("");
    setCurrentSessionId(null);
    setAgentStatuses({
      strategist: "waiting",
      critic: "waiting",
      technical: "waiting",
      creative: "waiting",
    });
    setBubbleIds({
      strategist: null,
      critic: null,
      technical: null,
      creative: null,
    });
    setStatus("idle");
  }, []);

  // ─── Start debate ─────────────────────────────────────────────────────────

  const startDebate = useCallback(async () => {
    if (!problem.trim() || !user) return;

    resetAll();
    setStatus("creating_session");

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
      setErrorMsg("Couldn't start the debate. Check your database connection and try again.");
      setStatus("error");
      return;
    }

    setStatus("debating");

    // Pre-create Strategist bubble
    const strategistId = genId();
    addEntry({
      id: strategistId,
      type: "agent",
      agentId: "strategist",
      content: "",
      isStreaming: true,
      isDone: false,
    });
    setAgentStatuses((prev) => ({ ...prev, strategist: "thinking" }));

    const socket = getSocket();
    socket.off("agent_token");
    socket.off("agent_done");
    socket.off("synthesis_token");
    socket.off("debate_done");
    socket.off("followup_token");
    socket.off("followup_done");
    socket.off("error");

    socket.on(
      "agent_token",
      ({ agentId, token }: { agentId: AgentId; agentName: string; token: string }) => {
        agentOutputsRef.current[agentId] = (agentOutputsRef.current[agentId] ?? "") + token;
        appendToLastEntry(agentId, "agent", token);
      }
    );

    socket.on(
      "agent_done",
      ({ agentId }: { agentId: AgentId; agentName: string }) => {
        // Mark current agent done
        updateLastEntryOfType(agentId, "agent", () => ({ isStreaming: false, isDone: true }));
        setAgentStatuses((prev) => ({ ...prev, [agentId]: "done" }));

        // Pre-create next agent's waiting bubble
        const order = AGENT_ORDER;
        const nextIdx = order.indexOf(agentId) + 1;
        if (nextIdx < order.length) {
          const nextId = order[nextIdx];
          const newId = genId();
          addEntry({
            id: newId,
            type: "agent",
            agentId: nextId,
            content: "",
            isStreaming: true,
            isDone: false,
          });
          setAgentStatuses((prev) => ({ ...prev, [nextId]: "thinking" }));
        }
      }
    );

    // ── SYNTHESIS BUG FIX: use setSynthesisContent + updateLastEntryOfType
    // instead of the broken prev[prev.length-1] pattern ──────────────────────
    socket.on("synthesis_token", ({ token }: { token: string }) => {
      synthesisRef.current += token;
      setSynthesisContent((prev) => prev + token);
      setIsSynthesisStreaming(true);
      setStatus("synthesizing");
    });

    socket.on("debate_done", async () => {
      setIsSynthesisStreaming(false);
      setIsSynthesisDone(true);
      setStatus("done");
      await saveDebateResults(sessionId);
    });

    socket.on("error", ({ message }: { message: string }) => {
      setErrorMsg(message);
      setStatus("error");
    });

    if (!socket.connected) socket.connect();

    socket.emit("start_debate", {
      problem: problem.trim(),
      userId: user.id,
      sessionId,
    });
  }, [
    problem,
    user,
    resetAll,
    addEntry,
    appendToLastEntry,
    updateLastEntryOfType,
    saveDebateResults,
  ]);

  // ─── Follow-up Q&A ────────────────────────────────────────────────────────

  const submitFollowUp = useCallback(
    (question: string, targetAgent: AgentId | "all") => {
      if (!currentSessionId) return;

      setStatus("followup");
      setIsFollowupStreaming(true);

      addEntry({
        id: genId(),
        type: "you",
        agentId: undefined,
        content: question,
        isStreaming: false,
        isDone: true,
      });

      const socket = getSocket();
      socket.off("followup_token");
      socket.off("followup_done");

      let currentFollowupAgentId: string | null = null;

      socket.on(
        "followup_token",
        ({ agentId, agentName, token }: { agentId: string; agentName: string; token: string }) => {
          if (currentFollowupAgentId !== agentId) {
            currentFollowupAgentId = agentId;
            const cfg = AGENT_CONFIG[agentId as AgentId];
            const newId = genId();
            addEntry({
              id: newId,
              type: "followup_agent",
              agentId: agentId as AgentId,
              content: token,
              isStreaming: true,
              isDone: false,
            });
            followupOutputsRef.current.push({ agentId, agentName, content: token });
          } else {
            appendToLastEntry(agentId as AgentId, "followup_agent", token);
            const last = followupOutputsRef.current[followupOutputsRef.current.length - 1];
            if (last && last.agentId === agentId) last.content += token;
          }
        }
      );

      socket.on("followup_done", async () => {
        setIsFollowupStreaming(false);
        setTimeline((prev) => {
          const updated = [...prev];
          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i].type === "followup_agent") {
              updated[i] = { ...updated[i], isStreaming: false, isDone: true };
              break;
            }
          }
          return updated;
        });
        setStatus("done");
        await saveFollowupResults(currentSessionId!);
      });

      if (!socket.connected) socket.connect();

      socket.emit("followup_question", {
        sessionId: currentSessionId,
        question,
        targetAgent,
      });
    },
    [currentSessionId, addEntry, appendToLastEntry, saveFollowupResults]
  );

  // ─── Derived state ────────────────────────────────────────────────────────

  const isRunning = status === "debating" || status === "synthesizing" || status === "followup";
  const canStart = problem.trim().length > 0 && !isRunning && isLoaded && !!user;
  const showFollowUp = status === "done" && !!currentSessionId;
  const completedAgents = new Set(
    AGENT_ORDER.filter((id) => agentStatuses[id] === "done")
  );
  const activeAgentId = AGENT_ORDER.find((id) => agentStatuses[id] === "thinking") ?? null;

  // Filter the main debate agents out from timeline for rendering
  const debateTimeline = timeline.filter((e) => e.type !== "synthesis");

  return (
    <div className="min-h-screen bg-[#080b12] flex flex-col">
      <div className="absolute inset-0 bg-grid opacity-25 pointer-events-none" />

      {/* Header */}
      <header className="relative z-20 border-b border-white/5 bg-[#080b12]/80 backdrop-blur-sm sticky top-0">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <span className="text-sm font-bold text-white">M</span>
              </div>
              <span className="font-bold text-white text-lg">MultiMind</span>
            </Link>
            <span className="text-gray-700">·</span>
            <span className="text-gray-500 text-sm">Debate Room</span>
          </div>

          <div className="flex items-center gap-4">
            {/* Status pill */}
            {status === "debating" && (
              <div className="flex items-center gap-2 text-xs text-blue-400">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                {activeAgentId
                  ? `${AGENT_CONFIG[activeAgentId].name} is thinking...`
                  : "Agents thinking..."}
              </div>
            )}
            {status === "synthesizing" && (
              <div className="flex items-center gap-2 text-xs text-amber-400">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Bringing it all together...
              </div>
            )}
            {status === "followup" && (
              <div className="flex items-center gap-2 text-xs text-purple-400">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                Responding...
              </div>
            )}
            {status === "done" && (
              <div className="flex items-center gap-2 text-xs text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Done
              </div>
            )}
            <UserButton />
          </div>
        </div>
      </header>

      {/* Mobile agent strip — at top below header */}
      {timeline.length > 0 && (
        <AgentStrip agentStatuses={agentStatuses} bubbleIds={bubbleIds} />
      )}

      {/* Body layout: left strip + main content */}
      <div className="relative z-10 flex-1 flex max-w-6xl mx-auto w-full">

        {/* Desktop left agent strip */}
        {timeline.length > 0 && (
          <div className="hidden md:block w-20 flex-shrink-0">
            <AgentStrip agentStatuses={agentStatuses} bubbleIds={bubbleIds} />
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 px-4 md:px-6 py-6 flex flex-col gap-5 min-w-0">

          {/* Input section */}
          <section className="glass-card rounded-2xl p-5">
            <label htmlFor="problem-input" className="block text-sm font-semibold text-gray-300 mb-2">
              What's the problem you want the team to tackle?
            </label>
            <textarea
              id="problem-input"
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canStart) startDebate();
              }}
              placeholder={"e.g. \"Should our startup build our own infra or use AWS?\""}
              rows={2}
              disabled={isRunning}
              className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-gray-200 placeholder-gray-600 text-sm resize-none focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <div className="flex items-center justify-between mt-3">
              <p className="text-xs text-gray-700">
                Press{" "}
                <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-gray-600 text-xs font-mono">
                  Ctrl+Enter
                </kbd>{" "}
                to submit
              </p>
              <button
                id="start-debate-btn"
                onClick={startDebate}
                disabled={!canStart}
                className="
                  px-5 py-2 rounded-xl font-semibold text-sm
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
                  : timeline.length > 0
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

          {/* Progress stepper */}
          {timeline.length > 0 && (
            <section className="glass-card rounded-xl px-5 py-3">
              <DebateStepper
                activeAgentId={activeAgentId}
                completedAgents={completedAgents}
                isSynthesizing={status === "synthesizing"}
                isSynthesisDone={isSynthesisDone}
              />
            </section>
          )}

          {/* Idle empty state */}
          {status === "idle" && (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
              <div className="flex flex-col gap-2 mb-8 opacity-30 w-full max-w-sm">
                {AGENT_ORDER.map((id) => {
                  const cfg = AGENT_CONFIG[id];
                  return (
                    <div
                      key={id}
                      className={`h-10 rounded-r-xl rounded-bl-xl border-l-2 ${cfg.tw.border} border border-white/5 bg-white/[0.02] flex items-center px-3 gap-2`}
                    >
                      <svg viewBox="0 0 24 24" className={`w-3.5 h-3.5 ${cfg.tw.text} fill-current`}>
                        <path d={cfg.icon} />
                      </svg>
                      <span className="text-xs text-gray-500">{cfg.name} will join the debate...</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-gray-600 text-sm">
                Drop your problem above and hit <strong className="text-gray-500">Start Debate</strong>
              </p>
            </div>
          )}

          {/* Debate timeline */}
          {debateTimeline.length > 0 && (
            <section className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
                  The Debate
                </h2>
                <div className="flex-1 h-px bg-white/5" />
              </div>

              <div className="flex flex-col gap-3">
                {debateTimeline.map((entry) => (
                  <ChatBubble
                    key={entry.id}
                    id={entry.id}
                    type={entry.type === "followup_agent" ? "followup_agent" : entry.type as BubbleType}
                    agentId={entry.agentId}
                    content={entry.content}
                    isStreaming={entry.isStreaming}
                    isDone={entry.isDone}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Synthesis card */}
          {synthesisContent && (
            <SynthesisCard
              content={synthesisContent}
              isStreaming={isSynthesisStreaming}
              onNewDebate={() => {
                resetAll();
                setProblem("");
              }}
            />
          )}

          {/* Follow-up section */}
          {showFollowUp && (
            <section className="mt-2">
              <FollowUpInput
                onSubmit={submitFollowUp}
                isStreaming={isFollowupStreaming}
                synthesisComplete={isSynthesisDone}
              />
              <div className="flex justify-center mt-4">
                <Link
                  href="/dashboard"
                  className="text-sm text-gray-600 hover:text-gray-400 transition-colors"
                >
                  ← Back to all debates
                </Link>
              </div>
            </section>
          )}

          <div ref={timelineEndRef} />
        </main>
      </div>
    </div>
  );
}
