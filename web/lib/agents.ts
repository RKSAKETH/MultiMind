// ─── Agent Identity System ────────────────────────────────────────────────────
// Single source of truth for all agent UI identity across the app.

export type AgentId = "strategist" | "critic" | "technical" | "creative";
export type ColorScheme = "blue" | "red" | "green" | "purple" | "amber" | "gray";

export interface AgentConfig {
  name: string;       // Role label
  persona: string;    // Human-like name shown in UI
  color: ColorScheme;
  /** SVG path data for the icon, rendered inside a 24×24 viewBox */
  icon: string;
  /** Sarvam AI TTS voice id */
  voiceId: string;
  /** The agent they are "replying to" (for reaction tags) */
  replyingTo: string | null;
  /** Tailwind color classes */
  tw: {
    border: string;
    bg: string;
    text: string;
    badge: string;
    dot: string;
    dotPulse: string;
    avatarRing: string;
  };
}

export const AGENT_ORDER: AgentId[] = [
  "strategist",
  "critic",
  "technical",
  "creative",
];

export const AGENT_CONFIG: Record<AgentId, AgentConfig> = {
  strategist: {
    name: "Strategist",
    persona: "Strategist",
    color: "blue",
    icon: // chess rook simplified
      "M7 4h10v2H7zM6 6h12v2H6zM8 8h8v8H8zM6 16h12v2H6zM5 18h14v2H5z",
    voiceId: "simran",
    replyingTo: null,
    tw: {
      border: "border-l-blue-500",
      bg: "bg-blue-500/5",
      text: "text-blue-300",
      badge: "bg-blue-500/15 border-blue-500/30 text-blue-300",
      dot: "bg-blue-400",
      dotPulse: "bg-blue-400/40",
      avatarRing: "ring-blue-500/50",
    },
  },
  critic: {
    name: "Critic",
    persona: "Critic",
    color: "red",
    icon: // warning triangle
      "M12 2L2 20h20L12 2zm0 3.5L19.5 19h-15L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z",
    voiceId: "shubh",
    replyingTo: "Strategist",
    tw: {
      border: "border-l-red-500",
      bg: "bg-red-500/5",
      text: "text-red-300",
      badge: "bg-red-500/15 border-red-500/30 text-red-300",
      dot: "bg-red-400",
      dotPulse: "bg-red-400/40",
      avatarRing: "ring-red-500/50",
    },
  },
  technical: {
    name: "Tech Expert",
    persona: "Tech Expert",
    color: "green",
    icon: // terminal prompt
      "M3 4h18a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm1 2v12h16V6H4zm2 2l4 4-4 4 1.4 1.4L13 12 7.4 6.6 6 8zm6 8h4v2h-4v-2z",
    voiceId: "ratan",
    replyingTo: "Critic",
    tw: {
      border: "border-l-emerald-500",
      bg: "bg-emerald-500/5",
      text: "text-emerald-300",
      badge: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300",
      dot: "bg-emerald-400",
      dotPulse: "bg-emerald-400/40",
      avatarRing: "ring-emerald-500/50",
    },
  },
  creative: {
    name: "Creative",
    persona: "Creative",
    color: "purple",
    icon: // lightbulb
      "M12 2a7 7 0 0 1 7 7c0 2.73-1.56 5.1-3.84 6.34L15 17H9l-.16-1.66A7 7 0 0 1 12 2zm-2 18h4v1a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-1zm-1-3h6l.16-1.5A5 5 0 1 0 6.84 15.5L7 17z",
    voiceId: "ishita",
    replyingTo: "Tech Expert",
    tw: {
      border: "border-l-purple-500",
      bg: "bg-purple-500/5",
      text: "text-purple-300",
      badge: "bg-purple-500/15 border-purple-500/30 text-purple-300",
      dot: "bg-purple-400",
      dotPulse: "bg-purple-400/40",
      avatarRing: "ring-purple-500/50",
    },
  },
};

/** Returns the first 2 sentences of a string */
export function getPreview(text: string): string {
  const sentences = text.match(/[^.!?]+[.!?]+/g);
  if (!sentences) return text.slice(0, 200);
  return sentences.slice(0, 2).join(" ").trim();
}

/**
 * Parses a synthesis text into 3 sections by paragraph splitting.
 * Falls back gracefully if the text has fewer paragraphs.
 */
export function parseSynthesis(text: string): {
  agreements: string;
  disagreements: string;
  recommendation: string;
} {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return {
    agreements: paragraphs[0] ?? text,
    disagreements: paragraphs[1] ?? "",
    recommendation: paragraphs[2] ?? "",
  };
}
