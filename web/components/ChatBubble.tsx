"use client";

import { useState, useCallback, useRef } from "react";
import { AGENT_CONFIG, AgentId, getPreview } from "@/lib/agents";

export type BubbleType = "agent" | "you" | "followup_agent";

interface ChatBubbleProps {
  id: string;
  type: BubbleType;
  agentId?: AgentId;
  content: string;
  isStreaming: boolean;
  isDone: boolean;
}

// ─── TTS hook ────────────────────────────────────────────────────────────────

function useTTS(agentId: AgentId | undefined, text: string) {
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const play = useCallback(async () => {
    if (!agentId || !text.trim()) return;

    // Stop current playback
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      if (isPlaying) {
        setIsPlaying(false);
        return;
      }
    }

    const cfg = AGENT_CONFIG[agentId];
    setIsLoading(true);

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.slice(0, 500), voiceId: cfg.voiceId }),
      });

      if (!res.ok) throw new Error("TTS request failed");
      const { audioBase64 } = await res.json();

      // Decode base64 → ArrayBuffer → play
      const bytes = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);

      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => setIsPlaying(false);

      setIsLoading(false);
      setIsPlaying(true);
      audio.play();
    } catch (err) {
      console.warn("[TTS]", err);
      setIsLoading(false);
      setIsPlaying(false);
    }
  }, [agentId, text, isPlaying]);

  return { play, isLoading, isPlaying };
}

// ─── Agent icon SVG ───────────────────────────────────────────────────────────

function AgentIcon({ agentId, className }: { agentId: AgentId; className?: string }) {
  const cfg = AGENT_CONFIG[agentId];
  return (
    <svg
      viewBox="0 0 24 24"
      className={`fill-current ${className ?? "w-4 h-4"}`}
      aria-hidden="true"
    >
      <path d={cfg.icon} />
    </svg>
  );
}

// ─── Main ChatBubble ──────────────────────────────────────────────────────────

export function ChatBubble({
  id,
  type,
  agentId,
  content,
  isStreaming,
  isDone,
}: ChatBubbleProps) {
  const [expanded, setExpanded] = useState(false);

  const cfg = agentId ? AGENT_CONFIG[agentId] : null;
  const preview = getPreview(content);
  const isLong = content.length > preview.length + 20;
  const displayContent = !isStreaming && isLong && !expanded ? preview : content;

  const { play, isLoading, isPlaying } = useTTS(agentId, content);

  // ── "You" bubble ──────────────────────────────────────────────────────────
  if (type === "you") {
    return (
      <div id={id} className="flex justify-end">
        <div className="max-w-[78%] bg-blue-600/15 border border-blue-500/25 rounded-2xl rounded-tr-sm px-4 py-3">
          <p className="text-xs text-blue-400 font-semibold mb-1">You</p>
          <p className="text-gray-200 text-sm leading-relaxed">{content}</p>
        </div>
      </div>
    );
  }

  if (!cfg || !agentId) return null;

  const isWaiting = isStreaming && content === "";

  // ── Waiting bubble (pulsing dots) ─────────────────────────────────────────
  if (isWaiting) {
    return (
      <div
        id={id}
        className={`
          border-l-[3px] ${cfg.tw.border} ${cfg.tw.bg}
          rounded-r-2xl rounded-bl-2xl px-4 py-3
          border border-white/5
        `}
      >
        {/* Reaction tag */}
        {cfg.replyingTo && (
          <p className={`text-xs italic ${cfg.tw.text} opacity-50 mb-1`}>
            replying to {cfg.replyingTo}
          </p>
        )}

        <div className="flex items-center gap-2">
          {/* Avatar */}
          <div
            className={`
              w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0
              ${cfg.tw.bg} border border-white/10
            `}
          >
            <AgentIcon agentId={agentId} className={`w-3.5 h-3.5 ${cfg.tw.text}`} />
          </div>

          <span className={`text-xs font-bold ${cfg.tw.text}`}>
            {cfg.persona}
          </span>
          <span className="text-xs text-gray-600 italic">waiting to respond...</span>

          {/* Typing dots */}
          <span className="flex gap-1 ml-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`typing-dot w-1.5 h-1.5 rounded-full ${cfg.tw.dot}`}
              />
            ))}
          </span>
        </div>
      </div>
    );
  }

  // ── Normal agent bubble ────────────────────────────────────────────────────
  return (
    <div
      id={id}
      className={`
        border-l-[3px] ${cfg.tw.border} ${cfg.tw.bg}
        rounded-r-2xl rounded-bl-2xl px-4 py-3
        border border-white/5
        transition-all duration-300
      `}
    >
      {/* Reaction tag */}
      {cfg.replyingTo && (
        <p className={`text-xs italic ${cfg.tw.text} opacity-50 mb-1.5`}>
          replying to {cfg.replyingTo}
        </p>
      )}

      {/* Header row: avatar + name badge + TTS button */}
      <div className="flex items-center gap-2 mb-2.5">
        {/* Avatar circle */}
        <div
          className={`
            w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0
            ${cfg.tw.bg} border border-white/10
            ${isStreaming ? "ring-2 " + cfg.tw.avatarRing : ""}
          `}
        >
          <AgentIcon agentId={agentId} className={`w-3.5 h-3.5 ${cfg.tw.text}`} />
        </div>

        {/* Name + role */}
        <div className="flex flex-col min-w-0">
          <span className={`text-xs font-bold leading-none ${cfg.tw.text}`}>
            {cfg.name}
          </span>
        </div>

        {/* Streaming cursor */}
        {isStreaming && content !== "" && (
          <span className={`ml-1 inline-block w-0.5 h-3 ${cfg.tw.dot} animate-pulse`} />
        )}

        {/* TTS play button — only when done */}
        {isDone && (
          <button
            onClick={play}
            disabled={isLoading}
            title={isPlaying ? "Stop" : `Hear ${cfg.persona}`}
            aria-label={isPlaying ? "Stop audio" : `Play ${cfg.persona}'s response`}
            className={`
              ml-auto w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0
              border transition-all duration-150 hover:scale-110
              ${isPlaying
                ? `${cfg.tw.bg} ${cfg.tw.text} border-current`
                : "border-white/10 text-gray-600 hover:text-gray-300 hover:border-white/20"
              }
              ${isLoading ? "opacity-50 cursor-wait" : "cursor-pointer"}
            `}
          >
            {isLoading ? (
              <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
            ) : isPlaying ? (
              /* Stop icon */
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
                <rect x="6" y="6" width="12" height="12" rx="1" />
              </svg>
            ) : (
              /* Speaker icon */
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77 0-4.28-2.99-7.86-7-8.77z" />
              </svg>
            )}
          </button>
        )}
      </div>

      {/* Content body */}
      <div className={`bubble-body ${!isStreaming && isLong && !expanded ? "collapsed" : "expanded"}`}>
        <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">
          {displayContent}
          {isStreaming && (
            <span className={`inline-block w-0.5 h-3.5 ${cfg.tw.dot} ml-0.5 animate-pulse align-text-bottom`} />
          )}
        </p>
      </div>

      {/* Read more / Read less toggle */}
      {!isStreaming && isDone && isLong && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className={`mt-2 text-xs ${cfg.tw.text} opacity-70 hover:opacity-100 transition-opacity duration-150 font-medium`}
        >
          {expanded ? "Read less ↑" : "Read more ↓"}
        </button>
      )}
    </div>
  );
}
