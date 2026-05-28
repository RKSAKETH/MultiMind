"use client";

import { useState, useCallback } from "react";
import { parseSynthesis } from "@/lib/agents";

interface SynthesisCardProps {
  content: string;
  isStreaming: boolean;
  onNewDebate: () => void;
}

export function SynthesisCard({
  content,
  isStreaming,
  onNewDebate,
}: SynthesisCardProps) {
  const [copied, setCopied] = useState(false);

  const { agreements, disagreements, recommendation } = parseSynthesis(content);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [content]);

  return (
    <div
      id="synthesis-card"
      className="fade-up-in mt-8 rounded-2xl border border-amber-500/20 bg-gradient-to-b from-amber-500/5 to-amber-500/[0.02] shadow-2xl shadow-amber-500/10 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-amber-500/15 bg-amber-500/5">
        <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-amber-400" aria-hidden="true">
            {/* gem / crystal icon */}
            <path d="M6 2l-6 8 12 12 12-12-6-8H6zm-.9 7L8 4.5 10.9 9H5.1zM13.1 9 16 4.5 18.9 9h-5.8zM12 18.5 4.3 10h15.4L12 18.5z" />
          </svg>
        </div>
        <div>
          <h2 className="text-amber-300 font-bold text-sm tracking-wide uppercase">
            Final Verdict
          </h2>
          <p className="text-amber-200/50 text-xs">All four agents have spoken</p>
        </div>

        {/* Status */}
        {isStreaming && (
          <div className="ml-auto flex items-center gap-2 text-amber-400 text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Synthesizing...
          </div>
        )}
      </div>

      {/* Sections */}
      <div className="px-6 py-5 flex flex-col gap-6">
        {/* Key Agreements */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 24 24" className="w-3 h-3 fill-emerald-400">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
              </svg>
            </div>
            <h3 className="text-emerald-400 text-xs font-semibold uppercase tracking-wider">
              Key Agreements
            </h3>
          </div>
          <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap pl-7">
            {agreements || (
              <span className="text-gray-600 italic">Synthesizing...</span>
            )}
          </p>
        </section>

        {/* Key Disagreements */}
        {(disagreements || isStreaming) && (
          <section>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <svg viewBox="0 0 24 24" className="w-3 h-3 fill-red-400">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
                </svg>
              </div>
              <h3 className="text-red-400 text-xs font-semibold uppercase tracking-wider">
                Key Disagreements
              </h3>
            </div>
            <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap pl-7">
              {disagreements || (
                <span className="text-gray-600 italic">Processing...</span>
              )}
            </p>
          </section>
        )}

        {/* Final Recommendation */}
        {(recommendation || isStreaming) && (
          <section>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <svg viewBox="0 0 24 24" className="w-3 h-3 fill-amber-400">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </div>
              <h3 className="text-amber-400 text-xs font-semibold uppercase tracking-wider">
                Final Recommendation
              </h3>
            </div>
            <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap pl-7">
              {recommendation || (
                <span className="text-gray-600 italic">Wrapping up...</span>
              )}
            </p>
          </section>
        )}
      </div>

      {/* Footer actions */}
      {!isStreaming && (
        <div className="px-6 py-4 border-t border-amber-500/10 flex items-center gap-3">
          <button
            id="copy-verdict-btn"
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/8 border border-white/10 hover:border-white/20 text-gray-300 hover:text-white text-sm font-medium transition-all duration-150"
          >
            {copied ? (
              <>
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-emerald-400">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                </svg>
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                  <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
                </svg>
                Copy verdict
              </>
            )}
          </button>

          <button
            id="new-debate-verdict-btn"
            onClick={onNewDebate}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600/20 to-purple-600/20 hover:from-blue-600/30 hover:to-purple-600/30 border border-blue-500/20 hover:border-blue-500/40 text-blue-300 hover:text-blue-200 text-sm font-medium transition-all duration-150"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
              <path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
            </svg>
            New debate
          </button>

          <div className="ml-auto text-xs text-gray-700">
            Powered by MultiMind · Sarvam AI
          </div>
        </div>
      )}
    </div>
  );
}
