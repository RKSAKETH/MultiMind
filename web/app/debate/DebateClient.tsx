"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useUser, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getSocket } from "@/lib/socket";
import { ChatBubble, ColorScheme } from "@/components/ChatBubble";
import { FollowUpInput } from "@/components/FollowUpInput";

// ─── Types ──────────────────────────────────────────────────────────────────

type AgentId = "strategist" | "critic" | "technical" | "creative";
type TargetAgent = AgentId | "all";

interface TimelineEntry {
  id: string;
  type: "agent" | "synthesis" | "you" | "followup_agent";
  agentId?: AgentId;
  agentName: string;
  colorScheme: ColorScheme;
  content: string;
  isStreaming: boolean;
  isDone: boolean;
}

type DebateStatus = "idle" | "creating_session" | "debating" | "synthesizing" | "done" | "followup" | "error";

// ─── Constants ───────────────────────────────────────────────────────────────

const AGENT_CONFIG: Record<AgentId, { name: string; color: ColorScheme; icon: string }> = {
  strategist: { name: "Strategist", color: "blue", icon: "🎯" },
  critic: { name: "Critic", color: "red", icon: "⚔️" },
  technical: { name: "Technical Expert", color: "green", icon: "⚙️" },
  creative: { name: "Creative", color: "purple", icon: "✨" },
};

// ─── Component ───────────────────────────────────────────────────────────────

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

  // Accumulated text refs for saving to DB (avoids stale closures)
  const agentOutputsRef = useRef<Record<string, string>>({});
  const synthesisRef = useRef("");
  const followupOutputsRef = useRef<{ agentId: string; agentName: string; content: string }[]>([]);
  const timelineEndRef = useRef<HTMLDivElement>(null);
  const entryCounterRef = useRef(0);

  const genId = () => `entry-${++entryCounterRef.current}`;

  // Auto-scroll timeline to bottom on every update
  useEffect(() => {
    if (timelineEndRef.current) {
      timelineEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [timeline]);

  // ─── Helpers ───────────────────────────────────────────────────────────────

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
  }, []);

  // ─── Save debate results to DB ─────────────────────────────────────────────

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

  // ─── Start debate ──────────────────────────────────────────────────────────

  const startDebate = useCallback(async () => {
    if (!problem.trim() || !user) return;

    // Reset
    setTimeline([]);
    agentOutputsRef.current = {};
    synthesisRef.current = "";
    followupOutputsRef.current = [];
    entryCounterRef.current = 0;
    setErrorMsg("");
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
      setErrorMsg("Failed to create session. Check your database connection.");
      setStatus("error");
      return;
    }

    setStatus("debating");

    // Pre-create timeline entry for the first agent (Strategist) as "Thinking..."
    // The rest will be added reactively when each agent starts streaming
    addEntry({
      id: genId(),
      type: "agent",
      agentId: "strategist",
      agentName: "Strategist",
      colorScheme: "blue",
      content: "",
      isStreaming: true,
      isDone: false,
    });

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
      ({ agentId, agentName, token }: { agentId: AgentId; agentName: string; token: string }) => {
        agentOutputsRef.current[agentId] = (agentOutputsRef.current[agentId] ?? "") + token;
        appendToLastEntry(agentId, "agent", token);
      }
    );

    socket.on(
      "agent_done",
      ({ agentId, agentName }: { agentId: AgentId; agentName: string; fullResponse: string }) => {
        // Mark current agent done
        updateLastEntryOfType(agentId, "agent", () => ({ isStreaming: false, isDone: true }));

        // Add next agent's "Thinking..." bubble pre-emptively
        const order: AgentId[] = ["strategist", "critic", "technical", "creative"];
        const nextIdx = order.indexOf(agentId) + 1;
        if (nextIdx < order.length) {
          const nextId = order[nextIdx];
          const cfg = AGENT_CONFIG[nextId];
          addEntry({
            id: genId(),
            type: "agent",
            agentId: nextId,
            agentName: cfg.name,
            colorScheme: cfg.color,
            content: "",
            isStreaming: true,
            isDone: false,
          });
        }
      }
    );

    socket.on("synthesis_token", ({ token }: { token: string }) => {
      synthesisRef.current += token;
      setStatus("synthesizing");

      setTimeline((prev) => {
        const hasSynthesis = prev.some((e) => e.type === "synthesis");
        if (!hasSynthesis) {
          return [
            ...prev,
            {
              id: genId(),
              type: "synthesis",
              agentName: "Final Verdict",
              colorScheme: "amber" as ColorScheme,
              content: token,
              isStreaming: true,
              isDone: false,
            },
          ];
        }
        return prev.map((e, i) =>
          i === prev.length - 1 && e.type === "synthesis"
            ? { ...e, content: e.content + token }
            : e
        );
      });
    });

    socket.on("debate_done", async () => {
      updateLastEntryOfType(undefined, "synthesis", () => ({ isStreaming: false, isDone: true }));
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
  }, [problem, user, addEntry, appendToLastEntry, updateLastEntryOfType, saveDebateResults]);

  // ─── Follow-up Q&A ────────────────────────────────────────────────────────

  const submitFollowUp = useCallback(
    (question: string, targetAgent: TargetAgent) => {
      if (!currentSessionId) return;

      setStatus("followup");
      setIsFollowupStreaming(true);

      // Add "You" bubble
      addEntry({
        id: genId(),
        type: "you",
        agentName: "You",
        colorScheme: "gray",
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
            // New agent responding — add a new bubble
            currentFollowupAgentId = agentId;
            const cfg = AGENT_CONFIG[agentId as AgentId];
            addEntry({
              id: genId(),
              type: "followup_agent",
              agentId: agentId as AgentId,
              agentName: agentName,
              colorScheme: cfg?.color ?? "gray",
              content: token,
              isStreaming: true,
              isDone: false,
            });
            followupOutputsRef.current.push({ agentId, agentName, content: token });
          } else {
            // Same agent — append token
            appendToLastEntry(agentId as AgentId, "followup_agent", token);
            const last = followupOutputsRef.current[followupOutputsRef.current.length - 1];
            if (last && last.agentId === agentId) last.content += token;
          }
        }
      );

      socket.on("followup_done", async () => {
        setIsFollowupStreaming(false);
        // Mark the last followup bubble as done
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

  // ─── Derived state ─────────────────────────────────────────────────────────

  const isRunning = status === "debating" || status === "synthesizing" || status === "followup";
  const canStart = problem.trim().length > 0 && !isRunning && isLoaded && !!user;
  const showFollowUp = status === "done" && !!currentSessionId;
  const agentsDoneCount = Object.keys(agentOutputsRef.current).length;

  return (
    <div className="min-h-screen bg-[#080b12] flex flex-col">
      <div className="absolute inset-0 bg-grid opacity-25 pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 bg-[#080b12]/80 backdrop-blur-sm sticky top-0">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <span className="text-sm font-bold text-white">M</span>
              </div>
              <span className="font-bold text-white text-lg">MultiMind</span>
            </Link>
            <span className="text-gray-700">·</span>
            <span className="text-gray-500 text-sm">Debate</span>
          </div>

          <div className="flex items-center gap-4">
            {status === "debating" && (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                Agent {agentsDoneCount + 1} of 4
              </div>
            )}
            {status === "synthesizing" && (
              <div className="flex items-center gap-2 text-xs text-amber-400">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Synthesizing...
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
                Complete
              </div>
            )}
            <UserButton />
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 max-w-3xl mx-auto w-full px-6 py-8 flex flex-col gap-6">
        {/* Input section */}
        <section className="glass-card rounded-2xl p-6">
          <div className="mb-4">
            <label htmlFor="problem-input" className="block text-sm font-medium text-gray-300 mb-2">
              Your Problem or Question
            </label>
            <textarea
              id="problem-input"
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canStart) startDebate();
              }}
              placeholder={"Enter any problem, question, or idea...\n\ne.g. 'Should our startup build our own infrastructure or use AWS?'"}
              rows={3}
              disabled={isRunning}
              className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-gray-200 placeholder-gray-600 text-sm resize-none focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-600">
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

        {/* Idle empty state */}
        {status === "idle" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
            <div className="flex flex-col gap-2 mb-8 opacity-30 w-full max-w-md">
              {[
                { color: "border-l-blue-500", label: "🎯 Strategist will set the strategy..." },
                { color: "border-l-red-500", label: "⚔️ Critic will challenge it..." },
                { color: "border-l-emerald-500", label: "⚙️ Technical Expert will implement it..." },
                { color: "border-l-purple-500", label: "✨ Creative will reimagine it..." },
              ].map((a) => (
                <div
                  key={a.label}
                  className={`h-10 rounded-r-xl rounded-bl-xl border-l-2 ${a.color} border border-white/5 bg-white/[0.02] flex items-center px-3`}
                >
                  <span className="text-xs text-gray-500">{a.label}</span>
                </div>
              ))}
            </div>
            <p className="text-gray-600 text-sm">
              Enter your problem above and click{" "}
              <strong className="text-gray-500">Start Debate</strong>
            </p>
          </div>
        )}

        {/* Timeline */}
        {timeline.length > 0 && (
          <section className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                Round-Table Debate
              </h2>
              <div className="flex-1 h-px bg-white/5" />
            </div>

            <div className="flex flex-col gap-3">
              {timeline.map((entry) => (
                <ChatBubble
                  key={entry.id}
                  type={entry.type === "followup_agent" ? "followup_agent" : entry.type}
                  agentId={entry.agentId}
                  agentName={entry.agentName}
                  colorScheme={entry.colorScheme}
                  content={entry.content}
                  isStreaming={entry.isStreaming}
                  turnLabel={entry.type === "synthesis" ? "Final Verdict 🔮" : undefined}
                  icon={entry.type === "synthesis" ? "🔮" : undefined}
                />
              ))}
            </div>

            <div ref={timelineEndRef} />
          </section>
        )}

        {/* Follow-up Q&A section */}
        {showFollowUp && (
          <section>
            <FollowUpInput
              onSubmit={submitFollowUp}
              isStreaming={isFollowupStreaming}
            />
            <div className="flex justify-center mt-6">
              <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-400 transition-colors">
                ← Back to all debates
              </Link>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
